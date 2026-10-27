/**
 * 方案C遮罩覆盖层（#23，REVIEW N25 / N42）：给命中元素盖上与背后底色一致的不透明贴纸，滚动跟手。
 *
 * - 后加载元素：节流的 MutationObserver（子节点增删 + class / id / style / hidden 变化）合并到
 *   每 RESCAN_MS 最多重扫一次：新命中的补遮罩、不再命中或已移除的撤掉，并刷新颜色（页面切深色等）。
 *   插件自己的节点（宿主及其内部）引起的变化忽略，插件界面里的元素也不遮
 * - 只在调用 show() 期间观察；clear() 断开观察器、撤掉宿主。原样态下运行时不调用 show()，什么都不挂
 * - 跟随定位交给 ElementFollower（事件驱动，静止停帧）；DOM 变化后量一次，被遮元素真动了才逐帧
 * - 遮罩盒子 pointer-events:auto：命中测试落在遮罩上，下面的链接点不到、悬停不触发；
 *   点击 / 指针事件在 shadow root 上截住，不再冒泡到页面（与方案B「不可点」一致）
 * - 盒子放在受保护的宿主 `pagemask-mask` 的 shadow 里（ui/page-host.ts、core/host-shield.ts）
 */
import { isOwnUiNode } from '@/core/host-shield';
import { ElementFollower } from './follow';
import { applyMaskAppearance } from './mask-color';
import type { PageHost } from './page-host';

/** DOM 变化后重扫的最小间隔 */
const RESCAN_MS = 100;

/** 观察的属性：它们的变化可能让元素开始 / 不再命中选择器，或改变布局 */
const WATCHED_ATTRIBUTES = ['class', 'id', 'style', 'hidden'];

/** 在遮罩宿主的 shadow root 上截住、不让页面收到的事件（不拦滚轮：用户照常滚动页面） */
const BLOCKED_EVENTS = [
  'click',
  'auxclick',
  'dblclick',
  'contextmenu',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
] as const;

export interface MaskLayerDeps {
  /** 创建遮罩宿主（运行时：createPageHost(ctx, 'mask')） */
  createHost(): PageHost;
  /** 延时执行，返回取消函数（运行时交给 ctx 托管） */
  schedule(fn: () => void, ms: number): () => void;
}

/** 一条记录是否完全由插件自己的界面引起 */
function ownMutation(m: MutationRecord): boolean {
  if (isOwnUiNode(m.target)) return true;
  if (m.type !== 'childList') return false;
  const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)];
  return nodes.length > 0 && nodes.every((n) => n instanceof Element && isOwnUiNode(n));
}

export class MaskLayer {
  private follower = new ElementFollower();
  private host: PageHost | null = null;
  private selectors: string[] = [];
  private observer: MutationObserver | null = null;
  private cancelRescan: (() => void) | null = null;

  constructor(private deps: MaskLayerDeps) {}

  /** 是否在观察 DOM（测试与排查用） */
  get observing(): boolean {
    return this.observer !== null;
  }

  /** 按这组选择器遮罩（替换之前的）；空数组等于 clear() */
  show(selectors: readonly string[]): void {
    this.clear();
    this.selectors = [...new Set(selectors)];
    if (this.selectors.length === 0) return;
    this.rescan();
    this.observer = new MutationObserver((records) => {
      if (records.every(ownMutation)) return;
      this.scheduleRescan();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRIBUTES,
    });
  }

  clear(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.cancelRescan?.();
    this.cancelRescan = null;
    this.follower.stop();
    this.host?.remove();
    this.host = null;
    this.selectors = [];
  }

  private scheduleRescan(): void {
    if (this.cancelRescan) return; // 节流：一个间隔内的变化合并成一次重扫
    this.cancelRescan = this.deps.schedule(() => {
      this.cancelRescan = null;
      if (this.observer) this.rescan();
    }, RESCAN_MS);
  }

  /** 当前命中的页面元素（去重、按选择器顺序；跳过非法选择器与插件自己的节点） */
  private matches(): Set<Element> {
    const out = new Set<Element>();
    for (const sel of this.selectors) {
      let els: NodeListOf<Element>;
      try {
        els = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const el of Array.from(els)) if (!isOwnUiNode(el)) out.add(el);
    }
    return out;
  }

  private rescan(): void {
    const wanted = this.matches();
    const tracked = this.follower.liveElements();
    const covered = new Set<Element>();
    for (const [box, el] of tracked) {
      if (wanted.has(el)) {
        covered.add(el);
        applyMaskAppearance(box, el);
      } else {
        this.follower.drop(box);
      }
    }
    for (const el of wanted) {
      if (covered.has(el)) continue;
      const box = this.createBox();
      applyMaskAppearance(box, el);
      this.follower.trackLive(el, box);
    }
    if (this.follower.liveElements().size === 0) {
      // 没有要遮的了：撤掉空宿主（观察器留着，等元素再出现）
      this.host?.remove();
      this.host = null;
    }
    this.follower.check();
  }

  private ensureHost(): PageHost {
    if (this.host) return this.host;
    const host = this.deps.createHost();
    // 根容器本身不占位、不接指针；遮罩盒子自己 pointer-events:auto
    host.root.style.pointerEvents = 'none';
    for (const type of BLOCKED_EVENTS) host.shadow.addEventListener(type, (e) => e.stopPropagation());
    this.host = host;
    return host;
  }

  private createBox(): HTMLElement {
    const box = document.createElement('div');
    box.dataset.pmMask = '';
    Object.assign(box.style, {
      position: 'fixed',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      // 盒子没有子节点：自成布局 / 绘制边界，改位置不牵动别处
      contain: 'strict',
    } as Partial<CSSStyleDeclaration>);
    this.ensureHost().root.appendChild(box);
    return box;
  }
}
