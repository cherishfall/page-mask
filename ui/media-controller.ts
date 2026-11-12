/**
 * 内容脚本侧：整页变灰唯一管不了的「动」（0.8.0 建立压制；0.8.18，#156 起这是本文件的唯一职责）。
 *
 * 背景：0.8.18 整页灰度用一条 CSS 规则覆盖一切像素（core/media.ts），此前的
 * 小图豁免打标、背景图扫描、MutationObserver 全套随媒体路线退场——灰度不再需要
 * 认识任何 DOM 元素。只剩 CSS 管不了的一件事：**动**。站点脚本自己让视频播起来的
 * 一律按停；**用户点了视频区域就把那一个视频放行**，正常播放、画面保持黑白——
 * 「不显眼」要压的是没人看的自动播放，不该拦住主动想看的视频。
 * **不写任何 muted、不碰 <audio>**：音量归播放器自己的按钮与 Chrome 右键静音（ADR-0013）。
 *
 * 「用户点了」的判定：document 捕获阶段记录最近一次意图事件（pointerdown / 键盘 Enter、空格，
 * 键盘用户点不到播放钮也能放行），play 事件到来时看它是否落在视频本身或其三层祖先内、
 * 且在 10 秒内——播放按钮通常是视频元素的兄弟节点（X 的播放器覆盖层），只看视频内部会误拦。
 * 放行按文档生命周期记忆，本次页面里这个视频之后随便播。
 *
 * 生命周期：只有开关打开时才挂两个 document 监听；关掉就断开。
 * 被按停的视频不替网站恢复播放（切回原样后用户自己点播放，0.7.x 同款语义）。
 */
import { isOwnUiNode } from '@/core/host-shield';
import type { MediaFlags } from '@/core/media';

/** 意图事件还有效的窗口：点了播放钮后站点可能要缓冲几秒才真正 play */
const INTENT_WINDOW_MS = 10_000;

/** 视频向上找几层祖先来匹配「点的是播放器区域」：X 的播放钮与 video 隔两层左右 */
const ANCESTOR_DEPTH = 3;

export interface MediaController {
  /** 按当前站点开关同步（幂等，重复调用不会重复挂监听） */
  sync(flags: MediaFlags): void;
  /** 内容脚本失效 / 卸载前的收尾 */
  dispose(): void;
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

/**
 * 页面上的输入位置：一切 <input>（不限文本类——复选框、单选、按钮同样算）、<textarea>
 * 与可编辑区域。这里的操作不算「想看视频」：在搜索框里敲空格 / 回车、点任何表单控件，
 * 都不该给三层层级内的视频「背书」放行（#186）。注释按现实现写全口径，行为不动（保守方向）
 */
function isPageEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export function createMediaController(doc: Document): MediaController {
  let wantMedia = false;
  let disposed = false;
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
    // 点我们自己的界面（胶囊、遮罩、向导）不算「想看视频」：否则在胶囊上拨媒体钮的
    // 那一下，会在 10 秒窗口内给页面上所有浅层视频背书放行（E2E 揪出的真问题）
    if (isOwnUiNode(e.target as Node)) return;
    // 页面输入框里的按键 / 点击同样不算（#186）：在搜索框里敲空格、回车是打字，不是想看视频
    if (isPageEditable(e.target as Element | null)) return;
    // 键盘可达性（WCAG 2.1.1）：Enter / 空格触发的播放同样算用户意图；其余按键不记账
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (key !== 'Enter' && key !== ' ') return;
    }
    lastIntent = { target: e.target, at: Date.now() };
  }

  function start(): void {
    // 捕获阶段：play 不冒泡，但会经过 document；意图事件要抢在站点脚本前面记账
    doc.addEventListener('play', onPlay, true);
    doc.addEventListener('pointerdown', onIntent, true);
    doc.addEventListener('keydown', onIntent, true);
    // 开关打开的这一刻，页面上正在播的视频当场按停（自动播放压制对存量视频同样生效）
    for (const video of doc.querySelectorAll('video')) applyVideo(video);
  }

  function stop(): void {
    doc.removeEventListener('play', onPlay, true);
    doc.removeEventListener('pointerdown', onIntent, true);
    doc.removeEventListener('keydown', onIntent, true);
  }

  return {
    sync(flags: MediaFlags): void {
      if (disposed) return;
      const next = flags.mediaGray === true;
      if (next === wantMedia) return;
      wantMedia = next;
      if (!wantMedia) {
        // 关掉：断监听。放行集合一并清掉；正在播的视频让它继续播，
        // 被我们按停的不替网站恢复播放（用户自己点播放，ADR-0013）
        stop();
        allowed.clear();
        lastIntent = null;
        return;
      }
      allowed.clear();
      lastIntent = null;
      start();
    },
    dispose(): void {
      if (disposed) return;
      wantMedia = false;
      stop();
      allowed.clear();
      disposed = true;
    },
  };
}
