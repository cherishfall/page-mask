/**
 * 点选控制器：悬停高亮、点击多选、层级调整。
 * 事件策略（uBlock 元素选择器同款思路）：拾取阶段在页面上盖一层全屏透明捕获层，
 * 指针事件全部落在我们自己的层上，用 elementsFromPoint 反查目标元素——
 * 站点自身的捕获监听/事件拦截（极客时间等）无从干扰，链接跳转也被天然挡住。
 *
 * 命中一律按指针的实际位置（N14）：按下时用 pointerdown 自带的坐标重新命中，不用上一次悬停的结果
 * （滚轮滚动不触发 pointermove，触屏没有悬停）；页面滚动时按最后的指针位置重新命中，悬停框跟着换。
 * 选择集是有序列表（顺序 = 序号牌编号，core/wizard-logic.ts）。
 * 键盘（Esc）不在这里处理：向导在选择、预览两个阶段都要响应，由 WizardApp 统一判断（N9）。
 */
import {
  isTooBigForPick,
  navigateLevel,
  removeFromSelection,
  replaceInSelection,
  toggleSelection,
} from '@/core/wizard-logic';

export interface PickCallbacks {
  /** 该节点属于插件自身界面（阴影树或宿主），不算页面元素 */
  isOwnNode(n: Node): boolean;
  onHoverChange(el: Element | null): void;
  onSelectionChange(els: Element[]): void;
  onWarnTooBig(el: Element): void;
}

export class PickController {
  private selection: Element[] = [];
  private hoverEl: Element | null = null;
  /** 最近一次点选或调整的元素（被取消后退回选择集末尾） */
  private lastEl: Element | null = null;
  private layer: HTMLElement | null = null;
  /** 最后一次指针位置（视口坐标）；滚动后用它重新命中 */
  private lastPoint: { x: number; y: number } | null = null;

  constructor(private cb: PickCallbacks) {}

  get hover(): Element | null {
    return this.hoverEl;
  }

  get selected(): Element[] {
    return [...this.selection];
  }

  /** 「选大 / 选小一点」的作用对象：最后选中的元素（N13） */
  get last(): Element | null {
    if (this.lastEl && this.selection.includes(this.lastEl)) return this.lastEl;
    return this.selection[this.selection.length - 1] ?? null;
  }

  /** 挂到全屏捕获层（透明、crosshair 光标；层本身 pointer-events:auto） */
  attach(layer: HTMLElement): void {
    this.stop();
    this.layer = layer;
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.zIndex = '1'; // 阴影树内低于工具条等交互元素
    layer.style.pointerEvents = 'auto';
    layer.style.cursor = 'crosshair';
    layer.addEventListener('pointermove', this.onPointerMove);
    layer.addEventListener('pointerdown', this.onPointerDown);
    layer.addEventListener('pointerleave', this.onPointerLeave);
    // 捕获阶段：页面里任何滚动容器滚动都能收到（scroll 不冒泡）
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  stop(): void {
    this.layer?.removeEventListener('pointermove', this.onPointerMove);
    this.layer?.removeEventListener('pointerdown', this.onPointerDown);
    this.layer?.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('scroll', this.onScroll, { capture: true });
    this.layer = null;
    this.setHover(null);
  }

  /** 删除这一项（预览里点 ✕ 时同步到这里，N11） */
  remove(el: Element): void {
    if (!this.selection.includes(el)) return;
    this.selection = removeFromSelection(this.selection, el);
    this.cb.onSelectionChange(this.selected);
  }

  /** 工具条「清空」：一次去掉全部已选，仍留在点选模式 */
  clear(): void {
    if (this.selection.length === 0) return;
    this.selection = [];
    this.lastEl = null;
    this.cb.onSelectionChange(this.selected);
  }

  /** 工具条「选大一点 / 选小一点」：作用于最后选中的元素，原位替换（N13、N6） */
  adjust(dir: 'bigger' | 'smaller'): void {
    const el = this.last;
    if (!el) return;
    const next = navigateLevel(el, dir);
    if (!next || next === document.body) {
      if (dir === 'bigger') this.cb.onWarnTooBig(next ?? el);
      return;
    }
    // 原位替换（序号不变）；换上的元素已在选择里时去重。它成为下一次调整的对象，可以连续选大
    this.selection = replaceInSelection(this.selection, el, next);
    this.lastEl = next;
    if (dir === 'bigger' && isTooBigForPick(next.getBoundingClientRect(), viewport())) this.cb.onWarnTooBig(next);
    this.cb.onSelectionChange(this.selected);
  }

  /** 从命中栈里取第一个不属于插件自身的元素 */
  private elementUnderPoint(x: number, y: number): Element | null {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!this.cb.isOwnNode(el) && el !== document.documentElement && el !== document.body) {
        return el;
      }
    }
    return null;
  }

  private setHover(el: Element | null): void {
    if (el === this.hoverEl) return;
    this.hoverEl = el;
    this.cb.onHoverChange(el);
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    this.lastPoint = { x: e.clientX, y: e.clientY };
    this.setHover(this.elementUnderPoint(e.clientX, e.clientY));
  };

  private readonly onPointerLeave = () => {
    this.lastPoint = null;
    this.setHover(null);
  };

  private readonly onScroll = () => {
    if (this.lastPoint) this.setHover(this.elementUnderPoint(this.lastPoint.x, this.lastPoint.y));
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    this.lastPoint = { x: e.clientX, y: e.clientY };
    const target = this.elementUnderPoint(e.clientX, e.clientY);
    this.setHover(target);
    if (!target) return;
    const adding = !this.selection.includes(target);
    if (adding && isTooBigForPick(target.getBoundingClientRect(), viewport())) this.cb.onWarnTooBig(target);
    this.selection = toggleSelection(this.selection, target);
    if (adding) this.lastEl = target;
    this.cb.onSelectionChange(this.selected);
  };
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}
