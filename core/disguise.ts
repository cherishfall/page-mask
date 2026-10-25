/**
 * 标题/图标伪装与"自动补刀"（design.md「标题与图标伪装」）：
 * 伪装态改写 document.title + 替换 favicon；SPA 站点（微信读书等）翻页时会把标题
 * 改回去，用 MutationObserver 监听 head 变化立即压回（参考 Tabee 模式）。
 * 原样态完全还原：标题、图标一并还原。
 */

export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const ICON_SELECTOR = 'link[rel~="icon"]';

interface Snapshot {
  title: string;
  iconLinks: Element[];
}

export class TitleFaviconGuard {
  private observer: MutationObserver | null = null;
  private snapshot: Snapshot | null = null;
  private active = false;
  private wantedTitle = '';
  private wantedIcon = '';

  constructor(private doc: Document) {}

  get isActive(): boolean {
    return this.active;
  }

  /** 进入伪装态。title 为最终展示文字；iconDataUrl 为空时用中性透明图标 */
  apply(title: string, iconDataUrl: string | null): void {
    this.wantedTitle = title;
    this.wantedIcon = iconDataUrl || TRANSPARENT_PNG;
    if (!this.active) {
      this.snapshot = this.takeSnapshot();
      this.active = true;
      this.startObserving();
    }
    this.force();
  }

  /** 回到原样态：标题、图标一并还原 */
  restore(): void {
    if (!this.active) return;
    this.stopObserving();
    this.active = false;
    const snap = this.snapshot;
    this.snapshot = null;
    if (!snap) return;
    this.doc.title = snap.title;
    for (const link of this.doc.querySelectorAll(ICON_SELECTOR)) link.remove();
    for (const link of snap.iconLinks) this.doc.head.appendChild(link);
  }

  /** 伪装参数变更（改标题/图标）时直接生效 */
  update(title: string, iconDataUrl: string | null): void {
    if (!this.active) return;
    this.apply(title, iconDataUrl);
  }

  private takeSnapshot(): Snapshot {
    return {
      title: this.doc.title,
      iconLinks: Array.from(this.doc.querySelectorAll(ICON_SELECTOR)).map((l) => l.cloneNode(false) as Element),
    };
  }

  private force(): void {
    this.observer?.disconnect();
    try {
      if (this.doc.title !== this.wantedTitle) this.doc.title = this.wantedTitle;
      // 移除站点全部图标声明，换成我们的一张
      for (const link of this.doc.querySelectorAll(ICON_SELECTOR)) link.remove();
      const link = this.doc.createElement('link');
      link.rel = 'icon';
      link.href = this.wantedIcon;
      this.doc.head.appendChild(link);
    } finally {
      if (this.active) this.observer?.observe(this.doc.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'rel'],
      });
    }
  }

  /** 站点把标题/图标改回去时压回来（自动补刀）。自己引发的变更不会触发（force 前后断开观察） */
  private startObserving(): void {
    this.observer = new MutationObserver(() => {
      if (!this.active) return;
      const titleDiverged = this.doc.title !== this.wantedTitle;
      const iconDiverged = this.iconDiverged();
      if (titleDiverged || iconDiverged) this.force();
    });
  }

  private iconDiverged(): boolean {
    const links = Array.from(this.doc.querySelectorAll(ICON_SELECTOR));
    if (links.length !== 1) return true;
    const href = links[0]?.getAttribute('href') ?? '';
    return href !== this.wantedIcon;
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

/** 站点配置的生效标题：站点覆盖 > 全局默认 */
export function effectiveTitle(
  profile: { disguisedTitle: string | null },
  settings: { defaultTitle: string },
): string {
  const t = profile.disguisedTitle ?? settings.defaultTitle;
  return t.trim() ? t : settings.defaultTitle;
}
