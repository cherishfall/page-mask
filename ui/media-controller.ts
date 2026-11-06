/**
 * 内容脚本侧：媒体收起的两件 CSS 管不了的事（#116）。
 *
 * 1. 小图豁免：纯 CSS 没法按「渲染尺寸」选元素，所以只在「收起图片」打开期间，给 ≤32px 的
 *    图标 / 表情打一个 data-pm-media-keep 属性，core/media.ts 的选择器据此放行。
 *    默认先全灰、小图确认后再放行——宁可多灰一帧，也不让大图露出来（首屏防闪优先）。
 * 2. 视频停播 + 静音：display:none / filter 都不会暂停播放（调研已核实），藏了画面还响声音
 *    比不藏更糟。扫到 video 就 pause + muted，并在 document 的捕获阶段拦 play 事件
 *    （play 不冒泡，但捕获阶段经过 document）——站点脚本反复调 play 也会被压住。
 *    不装定时器、不包 HTMLMediaElement.prototype.play：不和站点死守播放的脚本对着抢，
 *    每次 play 事件就地压一次，代价是两次同步赋值。
 *
 * 生命周期：只有开关打开时才挂 MutationObserver 与两个 document 监听；关掉就断开、
 * 清掉标记、把改过的 video.muted 还原（不替站点恢复播放，原样态把画面还回去即可）。
 * 增量扫描按 rAF 分批，读写分两阶段，避免和站点框架互相触发重排。
 */
import { MEDIA_KEEP_ATTR, shouldKeepMedia, type MediaFlags, type MediaSizeFacts } from '@/core/media';

/** 每帧最多处理多少个新增节点：无限滚动一次插几百张图时不堵主线程 */
const BATCH = 60;

export interface MediaController {
  /** 按当前站点开关同步（幂等，重复调用不会重复挂监听） */
  sync(flags: MediaFlags): void;
  /** 内容脚本失效 / 卸载前的收尾 */
  dispose(): void;
}

function numberAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function baseFacts(el: HTMLImageElement): MediaSizeFacts {
  return {
    widthAttr: numberAttr(el, 'width'),
    heightAttr: numberAttr(el, 'height'),
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    className: el.getAttribute('class') ?? '',
    alt: el.getAttribute('alt') ?? '',
    src: el.getAttribute('src') ?? '',
  };
}

/**
 * 先用不需要布局的尺寸判定；定不了再读一次渲染尺寸。
 * 大图被 CSS 缩小显示时也放行——它在页面上确实只占那么点地方，不显眼。
 */
function decideImage(img: HTMLImageElement): boolean {
  const base = baseFacts(img);
  if (shouldKeepMedia(base)) return true;
  const rect = img.getBoundingClientRect();
  return shouldKeepMedia({ ...base, renderedWidth: rect.width, renderedHeight: rect.height });
}

export function createMediaController(doc: Document): MediaController {
  let wantImages = false;
  let wantVideos = false;
  let disposed = false;
  let observer: MutationObserver | null = null;
  let frame = 0;
  const pending = new Set<Element>();
  /** 改过 muted 的视频，还原时按改之前的值放回去（站点本来静音的不能被我们打开声音） */
  const originalMuted = new WeakMap<HTMLVideoElement, boolean>();
  const touchedVideos = new Set<HTMLVideoElement>();

  function applyVideo(video: HTMLVideoElement): void {
    if (!wantVideos) return;
    if (!originalMuted.has(video)) {
      originalMuted.set(video, video.muted);
      touchedVideos.add(video);
    }
    if (!video.muted) video.muted = true;
    if (!video.paused) video.pause();
  }

  /** 一批元素两阶段处理：先只读判定（含 rect），再统一写属性 / 停播，避免读写交替触发重排 */
  function processBatch(elements: Element[]): void {
    const images: [HTMLImageElement, boolean][] = [];
    const videos: HTMLVideoElement[] = [];
    for (const el of elements) {
      if (!el.isConnected) continue;
      if (el.tagName === 'IMG' && wantImages) {
        const img = el as HTMLImageElement;
        images.push([img, decideImage(img)]);
      } else if (el.tagName === 'VIDEO') {
        videos.push(el as HTMLVideoElement);
      }
    }
    for (const [img, keep] of images) {
      if (keep) img.setAttribute(MEDIA_KEEP_ATTR, '');
      else img.removeAttribute(MEDIA_KEEP_ATTR);
    }
    for (const video of videos) applyVideo(video);
  }

  function flush(): void {
    frame = 0;
    if (disposed || pending.size === 0) return;
    const batch = Array.from(pending).slice(0, BATCH);
    for (const el of batch) pending.delete(el);
    processBatch(batch);
    if (pending.size) schedule();
  }

  function schedule(): void {
    if (frame || disposed) return;
    frame = requestAnimationFrame(flush) as unknown as number;
  }

  function collect(node: Node): void {
    if (!(node instanceof Element)) return;
    if (node.tagName === 'IMG' || node.tagName === 'VIDEO') pending.add(node);
    for (const el of node.querySelectorAll('img, video')) pending.add(el);
  }

  function onMutation(records: MutationRecord[]): void {
    for (const r of records) {
      if (r.type === 'childList') {
        for (const n of r.addedNodes) collect(n);
      } else if (r.type === 'attributes' && r.target instanceof Element) {
        // src / srcset 换了（懒加载占位换成真图）：尺寸可能变，重新判定一次
        if (r.target.tagName === 'IMG') pending.add(r.target);
      }
    }
    schedule();
  }

  function onPlay(e: Event): void {
    if (!wantVideos) return;
    const el = e.target as Element | null;
    if (el?.tagName === 'VIDEO') applyVideo(el as HTMLVideoElement);
  }

  function onLoad(e: Event): void {
    if (!wantImages) return;
    const el = e.target as Element | null;
    if (el?.tagName === 'IMG') pending.add(el); // 图片加载完才知道真实尺寸
  }

  function start(): void {
    if (observer) return;
    observer = new MutationObserver(onMutation);
    observer.observe(doc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'width', 'height'],
    });
    // 捕获阶段：play / load 都不冒泡，但会经过 document
    doc.addEventListener('play', onPlay, true);
    doc.addEventListener('load', onLoad, true);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending.clear();
    doc.removeEventListener('play', onPlay, true);
    doc.removeEventListener('load', onLoad, true);
  }

  function clearKeepMarks(): void {
    for (const el of doc.querySelectorAll(`img[${MEDIA_KEEP_ATTR}]`)) el.removeAttribute(MEDIA_KEEP_ATTR);
  }

  function restoreVideos(): void {
    for (const video of touchedVideos) {
      const original = originalMuted.get(video);
      if (original !== undefined) video.muted = original;
      // 必须连「原值」一起删：否则下次再打开时 applyVideo 以为已经记过，
      // 既不记原值也不把视频放回 touchedVideos，第二次关就再也还原不了（E2E 抓到的回归）
      originalMuted.delete(video);
    }
    touchedVideos.clear();
  }

  function scanExisting(): void {
    // 首帧不等 rAF：document_start 时页面上已有的 img / video 当场压住
    processBatch(Array.from(doc.querySelectorAll('img, video')));
  }

  return {
    sync(flags: MediaFlags): void {
      if (disposed) return;
      const nextImages = flags.hideImages === true;
      const nextVideos = flags.hideVideos === true;
      const wasOn = wantImages || wantVideos;
      const isOn = nextImages || nextVideos;
      if (wantVideos && !nextVideos) restoreVideos();
      wantImages = nextImages;
      wantVideos = nextVideos;
      if (!isOn) {
        stop();
        clearKeepMarks();
        return;
      }
      if (!wasOn) start();
      scanExisting();
    },
    dispose(): void {
      if (disposed) return;
      restoreVideos();
      wantImages = false;
      wantVideos = false;
      stop();
      clearKeepMarks();
      disposed = true;
    },
  };
}
