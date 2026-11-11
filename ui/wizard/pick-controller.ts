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
  /** 点到了 shadow DOM 或 iframe 里的东西（#167）：design.md 承诺的「检测到时给出提示」；
   *  这类规则在文档级样式表里永远命中不了，还可能误伤外层同名元素，所以拒绝选中 */
  onWarnNested(kind: 'shadow' | 'iframe'): void;
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
    // 捕获层会吞掉滚轮的默认滚动（实测文档滚动也滚不动，#88）：手动把滚动量
    // 交给指针下最近的竖向可滚动祖先，没有就滚文档；preventDefault 防止再滚一遍
    layer.addEventListener('wheel', this.onWheel, { passive: false });
    // 捕获阶段：页面里任何滚动容器滚动都能收到（scroll 不冒泡）
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  stop(): void {
    this.layer?.removeEventListener('pointermove', this.onPointerMove);
    this.layer?.removeEventListener('pointerdown', this.onPointerDown);
    this.layer?.removeEventListener('pointerleave', this.onPointerLeave);
    this.layer?.removeEventListener('wheel', this.onWheel);
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

  /** 直接加入选择集（进入点选时已收起的项从这里进：它已是一条草稿，统一编号，#81） */
  add(el: Element): void {
    if (this.selection.includes(el)) return;
    this.selection = [...this.selection, el];
    this.lastEl = el;
    this.cb.onSelectionChange(this.selected);
  }

  /** 工具条「清空」：一次去掉全部已选，仍留在点选模式 */
  clear(): void {
    if (this.selection.length === 0) return;
    this.selection = [];
    this.lastEl = null;
    this.cb.onSelectionChange(this.selected);
  }

  /**
   * 整体替换选择集（#82：点带标记的组员取消整条规则时用）：一次换好，只发一次选择变化。
   * 由调用方先把界面状态对齐，这里的回调按「无变化」落一遍序号与标记。
   */
  replaceAll(els: Element[]): void {
    this.selection = [...els];
    if (this.lastEl && !this.selection.includes(this.lastEl)) {
      this.lastEl = this.selection[this.selection.length - 1] ?? null;
    }
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

  /** 滚轮路由（#88）：信息流页面必须能边选边滚——懒加载的内容在下面 */
  private readonly onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return; // Ctrl/⌘+滚轮是页面缩放，还给浏览器
    e.preventDefault();
    const dx = e.deltaX;
    const dy = e.deltaY;
    if (!dx && !dy) return;
    const scroller = scrollableAncestor(this.elementUnderPoint(e.clientX, e.clientY));
    if (scroller) scroller.scrollBy(dx, dy);
    else window.scrollBy(dx, dy);
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    this.lastPoint = { x: e.clientX, y: e.clientY };
    const target = this.elementUnderPoint(e.clientX, e.clientY);
    this.setHover(target);
    if (!target) return;
    // 嵌套区域检测（#167）：elementsFromPoint 会穿透 open shadow root；
    // iframe 里点到的命中栈上是 <iframe> 元素本身。这两类选择生成的选择器
    // 走文档级 insertCSS 永远命中不了（shadow 边界进不去），还可能把外层
    // 文档里的同名元素一起藏掉——design.md「已知边界」承诺给出提示，这里兑现
    const kind = nestedKindOf(target);
    if (kind) {
      this.cb.onWarnNested(kind);
      return;
    }
    const adding = !this.selection.includes(target);
    if (adding && isTooBigForPick(target.getBoundingClientRect(), viewport())) this.cb.onWarnTooBig(target);
    this.selection = toggleSelection(this.selection, target);
    if (adding) this.lastEl = target;
    this.cb.onSelectionChange(this.selected);
  };
}

/** 点中的元素在 open shadow root 里（getRootNode 不是 document）或 iframe 里（另一个文档 / 就是 iframe 元素）。
 *  ownerDocument 分支是防御性的：现行命中栈来自 document.elementsFromPoint，只会返回顶层文档元素；
 *  iframe 内的点击实际命中的是 <iframe> 元素本身，由第三个分支拦下（0.9.1 回归审查留痕）。 */
export function nestedKindOf(el: Element): 'shadow' | 'iframe' | null {
  if (el.ownerDocument !== document) return 'iframe';
  if (el.getRootNode() !== document) return 'shadow';
  if (el.tagName === 'IFRAME') return 'iframe';
  return null;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** 指针下元素往上找第一个竖向可滚动的容器（信息流站常把滚动放在内层容器上，#88） */
function scrollableAncestor(el: Element | null): HTMLElement | null {
  let node: HTMLElement | null = el as HTMLElement | null;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}
