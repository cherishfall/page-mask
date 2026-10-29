/**
 * 元素跟随定位：把盒子（遮罩、向导标记）同步到目标元素当前的视口矩形（design.md：遮罩滚动跟手）。
 *
 * 事件驱动（#23，REVIEW N42 / 旧审查 C6），静止页面上没有逐帧回调：
 * - 触发：滚动（window 捕获阶段，页面里任何滚动容器的滚动都经过这里；scroll 事件本身不冒泡）、
 *   窗口尺寸变化、被跟随元素与 <body> 的尺寸变化（ResizeObserver，图片加载撑高页面也算）、
 *   CSS 过渡 / 动画开始与结束（元素可能在动），以及调用方的 kick() / check()（DOM 变化后）
 * - 触发后逐帧跟随，连续 STABLE_FRAMES 帧所有矩形都没变就停
 * - 每帧先读完全部矩形再统一写样式（读写分批，避免布局抖动）
 * - 没有被跟随的东西时撤掉全部监听
 *
 * 幽灵标记（元素已被移除、没有矩形）用「初始矩形 + 页面滚动差值」跟随。
 */

export interface LivePair {
  el: Element;
  box: HTMLElement;
  place?: PlacementFn;
}

export interface GhostPair {
  /** 进入预览时捕获的视口矩形 */
  baseRect: { left: number; top: number; width: number; height: number };
  baseScroll: { x: number; y: number };
  box: HTMLElement;
  place?: PlacementFn;
}

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 可选的位置修正：拿到目标元素的真实视口矩形，返回盒子要放的位置（默认原样）。
 * 用于号码牌这类「要贴在元素外面、又不能被视口边裁掉」的标记——盒子位置随滚动变化，
 * 只有每帧拿到矩形才能夹紧（见 core/wizard-logic.ts badgePlacement）。
 */
export type PlacementFn = (rect: Placement) => Placement;

/** 连续多少帧位置不变算静止 */
const STABLE_FRAMES = 3;

/** 可能让元素移动、但不伴随 DOM 变化的事件（window 捕获阶段监听） */
const MOTION_EVENTS = ['scroll', 'transitionrun', 'transitionend', 'animationstart', 'animationend'] as const;

const samePlacement = (a: Placement | undefined, b: Placement | null) =>
  !!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

export class ElementFollower {
  private live = new Map<HTMLElement, LivePair>();
  private ghosts = new Map<HTMLElement, GhostPair>();
  /** 每个盒子上一次写入的位置（null = 隐藏） */
  private last = new Map<HTMLElement, Placement | null>();
  private raf = 0;
  private stableFrames = 0;
  private listening: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;

  trackLive(el: Element, box: HTMLElement, place?: PlacementFn): void {
    this.live.set(box, { el, box, place });
    this.listen();
    this.resizeObserver?.observe(el);
    this.check();
    this.kick();
  }

  trackGhost(baseRect: GhostPair['baseRect'], box: HTMLElement, place?: PlacementFn): void {
    this.ghosts.set(box, {
      baseRect,
      baseScroll: { x: window.scrollX, y: window.scrollY },
      box,
      place,
    });
    this.listen();
    this.check();
    this.kick();
  }

  /** 正在跟随的元素（运行时遮罩据此对比新旧命中） */
  liveElements(): Map<HTMLElement, Element> {
    const out = new Map<HTMLElement, Element>();
    for (const [box, { el }] of this.live) out.set(box, el);
    return out;
  }

  drop(box: HTMLElement): void {
    const pair = this.live.get(box);
    this.live.delete(box);
    this.ghosts.delete(box);
    this.last.delete(box);
    if (pair && ![...this.live.values()].some((p) => p.el === pair.el)) this.resizeObserver?.unobserve(pair.el);
    box.remove();
    if (this.live.size === 0 && this.ghosts.size === 0) this.stop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.listening?.abort();
    this.listening = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const { box } of this.live.values()) box.remove();
    for (const { box } of this.ghosts.values()) box.remove();
    this.live.clear();
    this.ghosts.clear();
    this.last.clear();
  }

  /** 开始（或延续）逐帧跟随，直到连续几帧静止 */
  kick(): void {
    this.stableFrames = 0;
    if (!this.raf && this.size() > 0) this.raf = requestAnimationFrame(() => this.loop());
  }

  /**
   * 立即量一次并更新盒子；有变化才开始逐帧跟随（元素可能还在动）。返回是否有变化。
   * DOM 变化后调用：页面别处频繁变动（例如轮播）但被遮元素没动时，不会因此逐帧。
   */
  check(): boolean {
    const changed = this.tick();
    if (changed) this.kick();
    return changed;
  }

  private size(): number {
    return this.live.size + this.ghosts.size;
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = new AbortController();
    const opts = { capture: true, passive: true, signal: this.listening.signal };
    const onMotion = () => this.kick();
    for (const type of MOTION_EVENTS) window.addEventListener(type, onMotion, opts);
    window.addEventListener('resize', onMotion, opts);
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(onMotion);
      // <body> 尺寸变化（图片加载、内容展开）会让下面的元素移动
      if (document.body) this.resizeObserver.observe(document.body);
    }
  }

  private loop(): void {
    this.raf = 0;
    if (this.size() === 0) return;
    if (this.tick()) this.stableFrames = 0;
    else this.stableFrames++;
    if (this.stableFrames < STABLE_FRAMES) this.raf = requestAnimationFrame(() => this.loop());
  }

  /** 读完全部矩形再统一写；返回是否有盒子位置变化 */
  private tick(): boolean {
    const plan: [HTMLElement, Placement | null][] = [];
    for (const { el, box, place } of this.live.values()) {
      const r = el.getBoundingClientRect();
      const p = r.width === 0 && r.height === 0 ? null : { left: r.left, top: r.top, width: r.width, height: r.height };
      plan.push([box, p && place ? place(p) : p]);
    }
    const sx = window.scrollX;
    const sy = window.scrollY;
    for (const { baseRect, baseScroll, box, place } of this.ghosts.values()) {
      const p = {
        left: baseRect.left - (sx - baseScroll.x),
        top: baseRect.top - (sy - baseScroll.y),
        width: baseRect.width,
        height: baseRect.height,
      };
      plan.push([box, place ? place(p) : p]);
    }
    let changed = false;
    for (const [box, p] of plan) {
      const prev = this.last.get(box);
      if (this.last.has(box) && (prev === p || samePlacement(prev ?? undefined, p))) continue;
      changed = true;
      this.last.set(box, p);
      if (!p) {
        box.style.display = 'none';
        continue;
      }
      box.style.display = '';
      box.style.left = `${p.left}px`;
      box.style.top = `${p.top}px`;
      box.style.width = `${p.width}px`;
      box.style.height = `${p.height}px`;
    }
    return changed;
  }
}
