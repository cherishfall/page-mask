/**
 * 标题/图标伪装与"自动补刀"（design.md「标题与图标伪装」）：
 * 伪装态改写 document.title + 替换 favicon；SPA 站点（微信读书等）翻页时会把标题
 * 改回去，用 MutationObserver 监听 head 变化立即压回（参考 Tabee 模式）。
 * 原样态完全还原：标题、图标一并还原。
 */

export { effectiveTitle } from './titles';

/**
 * 默认图标：1×1 真正全透明 PNG（RGBA 全 0，单测解码校验）。图片能正常加载，Chrome 就照常
 * 显示它——全透明即标签页图标位留空（不会变成地球；地球只在没有图标或加载失败时出现）。
 * 不使用、也不复刻任何浏览器自带图标。
 */
export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

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
  /** 我们插入的那一张图标（区分站点自己的图标声明） */
  private ownLink: HTMLLinkElement | null = null;

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
    this.ownLink = null;
    if (!snap) return;
    this.doc.title = snap.title;
    for (const link of this.doc.querySelectorAll(ICON_SELECTOR)) link.remove();
    const parent = this.doc.head ?? this.doc.documentElement;
    for (const link of snap.iconLinks) parent.appendChild(link);
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
      // 移除站点全部图标声明，换成我们的一张。
      // document_start 时 <head> 可能还没解析出来：先不插图标（Chrome 只认 head 里的图标声明），
      // 观察器会在 head 出现时再补上。
      for (const link of this.doc.querySelectorAll(ICON_SELECTOR)) link.remove();
      this.ownLink = null;
      if (this.doc.head) {
        const link = this.doc.createElement('link');
        link.rel = 'icon';
        link.href = this.wantedIcon;
        this.doc.head.appendChild(link);
        this.ownLink = link;
      }
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
      if (titleDiverged || iconDiverged) {
        this.recordSiteValues(titleDiverged);
        this.force();
      }
    });
  }

  /**
   * 观察到的变化都来自站点（我们自己的写入前后断开了观察器）：记下站点最新的标题与图标，
   * 还原时回到它们。document_start 启动时快照还是空的，站点的 <title>/<link> 要靠这里补记。
   */
  private recordSiteValues(titleDiverged: boolean): void {
    if (!this.snapshot) return;
    const title = this.doc.title;
    if (titleDiverged && title.trim()) this.snapshot.title = title;
    const siteLinks = Array.from(this.doc.querySelectorAll(ICON_SELECTOR)).filter((l) => l !== this.ownLink);
    if (siteLinks.length) this.snapshot.iconLinks = siteLinks.map((l) => l.cloneNode(false) as Element);
  }

  private iconDiverged(): boolean {
    if (!this.doc.head) return false; // 还没有 head，图标无处可放，等 head 出现
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
