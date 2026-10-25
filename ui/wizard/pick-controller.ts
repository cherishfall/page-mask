/**
 * 点选控制器：悬停高亮、点击多选（挂序号牌）、层级调整、Esc。
 * 事件挂在 window 捕获阶段；自家 UI（阴影 DOM 内）的事件不参与选点。
 */
import { isTooBigForPick, navigateLevel } from '@/core/wizard-logic';

export interface PickCallbacks {
  /** 返回 true 表示该事件目标属于向导自身 UI，不参与选点 */
  isOwnUi(target: EventTarget | null): boolean;
  onHoverChange(el: Element | null): void;
  onSelectionChange(els: Element[]): void;
  onWarnTooBig(el: Element): void;
  onEsc(): void;
}

export class PickController {
  private selection = new Set<Element>();
  private hoverEl: Element | null = null;

  constructor(private cb: PickCallbacks) {}

  get hover(): Element | null {
    return this.hoverEl;
  }

  get selected(): Element[] {
    return Array.from(this.selection);
  }

  start(): void {
    window.addEventListener('mousemove', this.onMouseMove, true);
    window.addEventListener('click', this.onClick, true);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  stop(): void {
    window.removeEventListener('mousemove', this.onMouseMove, true);
    window.removeEventListener('click', this.onClick, true);
    window.removeEventListener('keydown', this.onKeyDown, true);
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

  private readonly onMouseMove = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target || this.cb.isOwnUi(target)) {
      if (this.hoverEl) {
        this.hoverEl = null;
        this.cb.onHoverChange(null);
      }
      return;
    }
    if (target !== this.hoverEl) {
      this.hoverEl = target;
      this.cb.onHoverChange(target);
    }
  };

  private readonly onClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target || this.cb.isOwnUi(target)) return;
    e.preventDefault();
    e.stopPropagation();
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
