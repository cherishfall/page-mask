/**
 * 内容脚本侧：媒体变灰的两件 CSS 管不了的事（0.8.0，#131，ADR-0013）。
 *
 * 1. 小图豁免：纯 CSS 没法按「渲染尺寸」选元素，所以只在「图片和视频变灰」打开期间，给 ≤32px 的
 *    图标 / 表情打一个 data-pm-media-keep 属性，core/media.ts 的选择器据此放行。
 *    默认先全灰、小图确认后再放行——宁可多灰一帧，也不让大图露出来（首屏防闪优先）。
 * 2. 视频自动播放压制：灰度管不住「动」。站点脚本自己让视频播起来的（X 刷信息流的自动播放）
 *    一律按停；**用户点了视频区域就把那一个视频放行**，正常播放、画面保持灰度——
 *    「不显眼」要压的是没人看的自动播放，不该拦住主动想看的视频。
 *    **不写任何 muted、不碰 <audio>**：音量归播放器自己的按钮与 Chrome 右键静音（ADR-0013）。
 *
 * 「用户点了」的判定：document 捕获阶段记录最近一次意图事件（pointerdown / 键盘 Enter、空格，
 * 键盘用户点不到播放钮也能放行），play 事件到来时看它是否落在视频本身或其三层祖先内、
 * 且在 10 秒内——播放按钮通常是视频元素的兄弟节点（X 的播放器覆盖层），只看视频内部会误拦。
 * 放行按文档生命周期记忆，本次页面里这个视频之后随便播。
 *
 * 生命周期：只有开关打开时才挂 MutationObserver 与三个 document 监听；关掉就断开、清掉标记。
 * 被按停的视频不替网站恢复播放（切回原样后用户自己点播放，0.7.x 同款语义）。
 * 增量扫描按 rAF 分批，读写分两阶段，避免和站点框架互相触发重排。
 */
import { MEDIA_KEEP_ATTR, shouldKeepMedia, type MediaFlags, type MediaSizeFacts } from '@/core/media';

/** 每帧最多处理多少个新增节点：无限滚动一次插几百张图时不堵主线程 */
const BATCH = 60;

/** 意图事件还有效的窗口：点了播放钮后站点可能要缓冲几秒才真正 play */
const INTENT_WINDOW_MS = 10_000;

/** 视频向上找几层祖先来匹配「点的是播放器这块区域」：X 的播放钮与 video 隔两层左右 */
const ANCESTOR_DEPTH = 3;

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
 * 渲染尺寸说了算（#126 / #128）：属性写 16×16、却被 CSS 放大到 600px 的图不是小图标；
 * 反过来大图被缩小显示也放行——它在页面上只占那么点地方。
 *
 * rect 为 0×0（未布局 / display:none / 懒加载占位）时**不回退到属性 / 原始尺寸**：
 * CSS 随时能覆盖它们，回退等于把删掉的属性短路从判定函数内部复活，大图就露出来了。
 * 这时只按文字线索放行表情，其余先灰一帧（本来就是「宁可多灰一帧」的设计），
 * 等 load 或 class / style 变化后重判，小图标会补上标记。
 */
function decideImage(img: HTMLImageElement): boolean {
  const facts = baseFacts(img);
  const rect = img.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return shouldKeepMedia({ ...facts, renderedWidth: rect.width, renderedHeight: rect.height });
  }
  return shouldKeepMedia({ className: facts.className, alt: facts.alt, src: facts.src });
}

/** 最近一次用户意图事件：放行判定的唯一依据 */
interface IntentMark {
  target: EventTarget | null;
  at: number;
}

/** 意图事件是否落在 video 的「播放器区域」内（视频本身、内部，或三层祖先以内） */
function intentCoversVideo(intent: IntentMark, video: HTMLVideoElement): boolean {
  const target = intent.target;
  if (!(target instanceof Element)) return false;
  if (video.contains(target)) return true;
  let ancestor: HTMLElement | null = video.parentElement;
  for (let depth = 0; depth < ANCESTOR_DEPTH && ancestor; depth++) {
    if (ancestor.contains(target)) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

export function createMediaController(doc: Document): MediaController {
  let wantMedia = false;
  let disposed = false;
  let observer: MutationObserver | null = null;
  let frame = 0;
  const pending = new Set<Element>();
  /** 已被用户放行的视频：本次文档生命周期内不再压制 */
  const allowed = new Set<HTMLVideoElement>();
  /** 最近一次意图事件：pointerdown / Enter / 空格，捕获阶段记录 */
  let lastIntent: IntentMark | null = null;

  /** 非用户意图的播放就地按停（站点脚本反复调 play 也一样，每次 play 事件压一次）；
   *  已放行的视频不再管——重扫（挪位置、新插入）也不得把用户正在看的视频按停 */
  function applyVideo(video: HTMLVideoElement): void {
    if (allowed.has(video)) return;
    if (!video.paused) video.pause();
  }

  /** 一批元素两阶段处理：先只读判定（含 rect），再统一写属性 / 按停，避免读写交替触发重排 */
  function processBatch(elements: Element[]): void {
    const images: [HTMLImageElement, boolean][] = [];
    const videos: HTMLVideoElement[] = [];
    for (const el of elements) {
      if (!el.isConnected) continue;
      if (el.tagName === 'IMG' && wantMedia) {
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

  /** 子树被移出文档：把它从待办与放行集合里放掉，别让强引用钉住已被信息流替换掉的元素（#126 / #128）。
   *  挪位置（isConnected 仍真）不当移除：换容器后渲染尺寸可能变，仍要重判一次（#129）。
   *  放行记录一并清除：信息流把放行过的视频换掉后，同一个 <video> 元素再插回来按新的一轮算，
   *  不会再被旧记录放行；这也是 allowed 集合唯一的瘦身路径，长会话信息流不会钉住已移除的元素。 */
  function forget(node: Node): void {
    if (!(node instanceof Element)) return;
    if (node.isConnected) return;
    if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
      pending.delete(node);
      if (node.tagName === 'VIDEO') allowed.delete(node as HTMLVideoElement);
    }
    for (const el of node.querySelectorAll('img, video')) {
      pending.delete(el);
      if (el.tagName === 'VIDEO') allowed.delete(el as HTMLVideoElement);
    }
  }

  function onMutation(records: MutationRecord[]): void {
    for (const r of records) {
      if (r.type === 'childList') {
        // 先忘掉真移除的、再收新增的：removedNodes 里若有「只是挪位置」的节点，forget() 会
        // 按 isConnected 自己放行，这里再 collect 一次让它按新容器重判（#129）。
        for (const n of r.removedNodes) forget(n);
        for (const n of r.addedNodes) collect(n);
      } else if (r.type === 'attributes' && r.target instanceof Element) {
        // src / srcset 换了（懒加载占位换成真图），或 class / style 改了尺寸：重新判定一次
        if (r.target.tagName === 'IMG') pending.add(r.target);
      }
    }
    schedule();
  }

  function onPlay(e: Event): void {
    if (!wantMedia) return;
    const el = e.target as Element | null;
    if (el?.tagName !== 'VIDEO') return;
    const video = el as HTMLVideoElement;
    if (allowed.has(video)) return;
    // 用户意图在窗口期内、且点的是这个视频的播放器区域：放行，此后不再管它
    if (lastIntent && Date.now() - lastIntent.at <= INTENT_WINDOW_MS && intentCoversVideo(lastIntent, video)) {
      allowed.add(video);
      return;
    }
    applyVideo(video);
  }

  function onIntent(e: Event): void {
    // 键盘可达性（WCAG 2.1.1）：Enter / 空格触发的播放同样算用户意图；其余按键不记账
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (key !== 'Enter' && key !== ' ') return;
    }
    lastIntent = { target: e.target, at: Date.now() };
  }

  function onLoad(e: Event): void {
    if (!wantMedia) return;
    const el = e.target as Element | null;
    if (el?.tagName !== 'IMG') return;
    // 图片加载完才知道真实尺寸：放进待办后必须自己排一帧（#128）。
    // 0.7.0 这里只 add 不 schedule，重判全靠页面恰好还有别的变动顺带触发，
    // 首屏那批懒加载小图标因此可能一直灰着。
    pending.add(el);
    schedule();
  }

  function start(): void {
    if (observer) return;
    observer = new MutationObserver(onMutation);
    observer.observe(doc, {
      childList: true,
      subtree: true,
      attributes: true,
      // class / style 会改变渲染尺寸（隐藏的小图被显示成大图、图标被 CSS 放大），
      // 也要重判一次（#128）。只在开关打开期间观察，未开启的页面零开销。
      attributeFilter: ['src', 'srcset', 'width', 'height', 'class', 'style'],
    });
    // 捕获阶段：play / load 不冒泡，但会经过 document；意图事件要抢在站点脚本前面记账
    doc.addEventListener('play', onPlay, true);
    doc.addEventListener('load', onLoad, true);
    doc.addEventListener('pointerdown', onIntent, true);
    doc.addEventListener('keydown', onIntent, true);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending.clear();
    doc.removeEventListener('play', onPlay, true);
    doc.removeEventListener('load', onLoad, true);
    doc.removeEventListener('pointerdown', onIntent, true);
    doc.removeEventListener('keydown', onIntent, true);
  }

  function clearKeepMarks(): void {
    for (const el of doc.querySelectorAll(`img[${MEDIA_KEEP_ATTR}]`)) el.removeAttribute(MEDIA_KEEP_ATTR);
  }

  function scanExisting(): void {
    // 首帧不等 rAF：document_start 时页面上已有的 img / video 当场处理（播放中的视频按停）
    processBatch(Array.from(doc.querySelectorAll('img, video')));
  }

  return {
    sync(flags: MediaFlags): void {
      if (disposed) return;
      const next = flags.mediaGray === true;
      if (next === wantMedia) return;
      wantMedia = next;
      if (!wantMedia) {
        // 关掉：断监听、清标记。放行集合一并清掉；正在播的视频让它继续播，
        // 被我们按停的不替网站恢复播放（用户自己点播放，ADR-0013）
        stop();
        clearKeepMarks();
        allowed.clear();
        lastIntent = null;
        return;
      }
      allowed.clear();
      lastIntent = null;
      start();
      scanExisting();
    },
    dispose(): void {
      if (disposed) return;
      wantMedia = false;
      stop();
      clearKeepMarks();
      allowed.clear();
      disposed = true;
    },
  };
}
