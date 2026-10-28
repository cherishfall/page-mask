/**
 * 幕布覆盖层（#45，design.md「幕布」一节，ADR-0007）：铺满视口的不透明层，挂在受保护宿主
 * （core/host-shield.ts 的 curtain）的 shadow 里。上面不放任何文字、图标、logo。
 *
 * - 颜色取页面自己的画布底色（ui/mask-color.ts curtainBackgroundFor），取不到才用浅色白 / 深色近黑
 * - 覆盖层挡住指针（命中测试落在它身上，下面的链接点不到、悬停不触发），点击等指针事件在 shadow root
 *   上截住不再冒泡到页面（与 ui/mask-layer.ts 同一套）；滚轮与键盘不拦——幕布只挡眼睛不挡输入
 * - 幕布是页面内的临时状态：不写存储、刷新 / 整页跳转即消失；不是安全边界，页面脚本可以直接删掉宿主
 */
import { curtainBackgroundFor } from './mask-color';
import type { PageHost } from './page-host';

/** 在幕布宿主的 shadow root 上拦住、不让页面收到的事件（不拦滚轮与键盘） */
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

export interface CurtainLayerDeps {
  /** 创建幕布宿主（运行时：createPageHost(ctx, 'curtain')） */
  createHost(): PageHost;
}

export class CurtainLayer {
  private host: PageHost | null = null;
  private cover: HTMLElement | null = null;

  constructor(private deps: CurtainLayerDeps) {}

  /** 幕布是否开着 */
  get active(): boolean {
    return this.host !== null;
  }

  /** 幕布宿主的根容器：需要在幕布上放额外控件时用（例如一次性脚本的「恢复」入口） */
  get root(): HTMLElement | null {
    return this.host?.root ?? null;
  }

  /** 铺开幕布（已开着时无操作） */
  show(): void {
    if (this.host) return;
    const host = this.deps.createHost();
    for (const type of BLOCKED_EVENTS) host.shadow.addEventListener(type, (e) => e.stopPropagation());
    const cover = document.createElement('div');
    cover.dataset.pmCurtain = '';
    Object.assign(cover.style, {
      position: 'fixed',
      inset: '0',
      background: curtainBackgroundFor(document),
      pointerEvents: 'auto',
    } as Partial<CSSStyleDeclaration>);
    host.root.appendChild(cover);
    this.host = host;
    this.cover = cover;
  }

  /** 撤掉幕布（可重复调用） */
  hide(): void {
    this.host?.remove();
    this.host = null;
    this.cover = null;
  }

  /**
   * 重新压住覆盖层（applyAll / restoreAll 末尾调用）：底色按当前页面重取（SPA 换页可能改了主题），
   * 宿主挪到文档末尾——宿主层级相同时 DOM 靠后的排在最上，幕布保持在最上层
   */
  reassert(): void {
    const host = this.host;
    if (!host) return;
    if (this.cover) this.cover.style.background = curtainBackgroundFor(document);
    document.documentElement.appendChild(host.host);
  }
}
