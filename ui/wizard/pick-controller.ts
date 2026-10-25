/**
 * 点选控制器：悬停高亮、点击多选（挂序号牌）、层级调整、Esc。
 * 事件策略（uBlock 元素选择器同款思路）：拾取阶段在页面上盖一层全屏透明捕获层，
 * 指针事件全部落在我们自己的层上，用 elementsFromPoint 反查目标元素——
 * 站点自身的捕获监听/事件拦截（极客时间等）无从干扰，链接跳转也被天然挡住。
 */
import { isTooBigForPick, navigateLevel } from '@/core/wizard-logic';

export interface PickCallbacks {
  /** 该节点属于向导自身 UI（阴影树或宿主），不算页面元素 */
  isOwnNode(n: Node): boolean;
  onHoverChange(el: Element | null): void;
  onSelectionChange(els: Element[]): void;
  onWarnTooBig(el: Element): void;
  onEsc(): void;
}

export class PickController {
  private selection = new Set<Element>();
  private hoverEl: Element | null = null;
  private layer: HTMLElement | null = null;

  constructor(private cb: PickCallbacks) {}

  get hover(): Element | null {
    return this.hoverEl;
  }

  get selected(): Element[] {
    return Array.from(this.selection);
  }

  /** 挂到全屏捕获层（透明、crosshair 光标；层本身 pointer-events:auto） */
  attach(layer: HTMLElement): void {
    this.layer = layer;
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.zIndex = '1'; // 阴影树内低于工具条等交互元素
    layer.style.pointerEvents = 'auto';
    layer.style.cursor = 'crosshair';
    layer.addEventListener('pointermove', this.onPointerMove);
    layer.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  stop(): void {
    this.layer?.removeEventListener('pointermove', this.onPointerMove);
    this.layer?.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.layer = null;
  }

  clear(): void {
    this.selection.clear();
    this.cb.onSelectionChange(this.selected);
  }

  /** 工具条「选大一点 / 选小一点」：作用于当前悬停元素；若它已选中则替换 */
  adjust(dir: 'bigger' | 'smaller'): void {
    const el = this.hoverEl;
    if (!el) return;
    const next = navigateLevel(el, dir);
    if (!next || next === document.body) {
      if (dir === 'bigger') this.cb.onWarnTooBig(next ?? el);
      return;
    }
    if (this.selection.delete(el)) this.selection.add(next);
    this.hoverEl = next;
    this.cb.onHoverChange(next);
    this.cb.onSelectionChange(this.selected);
  }

  /** 从命中栈里取第一个不属于向导自身的元素 */
  private elementUnderPoint(x: number, y: number): Element | null {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!this.cb.isOwnNode(el) && el !== document.documentElement && el !== document.body) {
        return el;
      }
    }
    return null;
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    const el = this.elementUnderPoint(e.clientX, e.clientY);
    if (el !== this.hoverEl) {
      this.hoverEl = el;
      this.cb.onHoverChange(el);
    }
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    const target = this.hoverEl ?? this.elementUnderPoint(e.clientX, e.clientY);
    if (!target) return;
    if (isTooBigForPick(target.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })) {
      this.cb.onWarnTooBig(target);
    }
    if (this.selection.has(target)) {
      this.selection.delete(target);
    } else {
      this.selection.add(target);
    }
    this.cb.onSelectionChange(this.selected);
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onEsc();
    }
  };
}
