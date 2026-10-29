/**
 * 标签页标题/图标的替换与"自动改回"（design.md「标签页标题与图标」）：
 * 伪装态改写 document.title + 替换 favicon；SPA 站点（微信读书等）翻页时会把标题
 * 改回去，用 MutationObserver 监听 head 变化立即压回（参考 Tabee 模式）。
 * 原样态完全还原：标题、图标一并还原，用的是伪装期间站点最新写入的值（B21）。
 * #22：只观察 <head>（B22）；运行时失效（扩展更新 / 重载）后不再补刀。
 * #49：网站自己守标题时不再和它抢——
 *  - 站点写入引起的补刀合并到一拍（`debounceMs` 窗口），同一串连击只写一次；
 *  - 图标不再删除重建：我们那张已存在就原地改 href，站点图标只在挡路时移除；
 *  - 一秒内写到上限即熔断，之后不再写 DOM（页面停在网站自己的标题上）并 console.warn 留证。
 *    熔断不被重复的 apply() 重置（上层每次存储变化都会调它），只有 restore() 后重新进入、
 *    或目标标题 / 图标真的变了才解封。
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
/** 熔断窗口：这段时间内写入次数到上限就彻底停手 */
const FORCE_WINDOW_MS = 1000;
/** 站点写入与补刀之间的合并窗口，约一帧（同一拍内的一串变化只写一次） */
const DEFAULT_DEBOUNCE_MS = 16;

interface Snapshot {
  title: string;
  iconLinks: Element[];
}

export interface GuardOptions {
  /** 一秒内最多写入几次；到上限即熔断（站点自己死守标题时彻底放手，见 #49）。默认 5 */
  maxForcesPerSecond?: number;
  /** 站点写入与补刀之间的合并窗口（毫秒）；同一窗口内的连续变化只补一次。默认 16 */
  debounceMs?: number;
  /**
   * 运行时是否仍有效（内容脚本传 () => ctx.isValid：扩展更新 / 重载后读它会触发失效收尾）。
   * 无效时不再补刀，站点写入的标题照常保留
   */
  isAlive?: () => boolean;
  /** 可注入的时钟与定时器（单测用；内容脚本传 ctx.setTimeout 包装，失效时自动清掉） */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => () => void;
}

/** 只观察 head 的标题 / 图标变化（B22：不再观察整个 documentElement 的 subtree） */
const HEAD_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['href', 'rel'],
};

export class TitleFaviconGuard {
  private observer: MutationObserver | null = null;
  private snapshot: Snapshot | null = null;
  private active = false;
  private wantedTitle = '';
  private wantedIcon = '';
  /** 我们插入的那一张图标（区分站点自己的图标声明）；存在期间原地复用，不删不重建 */
  private ownLink: HTMLLinkElement | null = null;
  /** 窗口内的写入时刻（含进入伪装态的第一笔） */
  private forceTimes: number[] = [];
  private cancelPending: (() => void) | null = null;
  /** 熔断：连续抢不过后停止一切写入，直到 restore 或目标真的变了 */
  private tripped = false;
  private readonly maxForces: number;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => () => void;
  private readonly isAlive: () => boolean;

  constructor(
    private doc: Document,
    opts: GuardOptions = {},
  ) {
    this.maxForces = opts.maxForcesPerSecond ?? 5;
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer =
      opts.setTimer ??
      ((fn, ms) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      });
    this.isAlive = opts.isAlive ?? (() => true);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** 进入伪装态。title 为最终展示文字；iconDataUrl 为空时用中性透明图标 */
  apply(title: string, iconDataUrl: string | null): void {
    const icon = iconDataUrl || TRANSPARENT_PNG;
    if (!this.active) {
      this.wantedTitle = title;
      this.wantedIcon = icon;
      this.snapshot = this.takeSnapshot();
      this.active = true;
      this.resetLimit();
      this.startObserving();
      this.force();
      return;
    }
    // 上层每次存储变化都会重复调用 apply；目标没变就什么都不做——尤其不能清空熔断计数，
    // 否则站点每次写标题后紧跟一次存储变化，熔断就永远触发不了（#49）
    if (title === this.wantedTitle && icon === this.wantedIcon) return;
    this.wantedTitle = title;
    this.wantedIcon = icon;
    this.resetLimit();
    this.force();
  }

  /** 回到原样态：标题、图标一并还原 */
  restore(): void {
    if (!this.active) return;
    this.stopObserving();
    this.active = false;
    this.resetLimit();
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
    if (!this.active || this.tripped) return;
    if (!this.takeForceSlot()) return;
    this.cancelPendingForce();
    this.observer?.disconnect();
    try {
      if (this.doc.title !== this.wantedTitle) this.doc.title = this.wantedTitle;
      this.syncIcon();
    } finally {
      this.observeTargets();
    }
  }

  /**
   * 图标同步：已有我们那张就原地改 href，没有才插入；站点图标只在挡路时移除。
   * 一切都对得上时不动 DOM（每次补刀都重建 favicon 会让标签栏反复重绘）。
   */
  private syncIcon(): void {
    const head = this.doc.head;
    // document_start 时 <head> 可能还没解析出来：先不插图标（Chrome 只认 head 里的图标声明），
    // 观察器会在 head 出现时再补上。
    if (!head) return;
    const links = Array.from(this.doc.querySelectorAll(ICON_SELECTOR));
    if (this.ownLink && !this.ownLink.isConnected) this.ownLink = null;
    if (!this.ownLink) {
      for (const link of links) link.remove();
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'icon');
      link.setAttribute('href', this.wantedIcon);
      head.appendChild(link);
      this.ownLink = link;
      return;
    }
    const own = this.ownLink;
    for (const link of links) if (link !== own) link.remove();
    if (own.getAttribute('href') !== this.wantedIcon) own.setAttribute('href', this.wantedIcon);
    if (own.parentElement !== head) head.appendChild(own);
  }

  /**
   * 观察目标：<head> 的 subtree（标题、图标都在这里），外加 <html> 的直接子节点（只为发现 head
   * 出现或被整体替换，正文里的变化不会触发）。document_start 时 head 还不存在，先只看 <html>。
   */
  private observeTargets(): void {
    if (!this.active || !this.observer) return;
    const root = this.doc.documentElement;
    if (!root) return;
    this.observer.observe(root, { childList: true });
    if (this.doc.head) this.observer.observe(this.doc.head, HEAD_OPTIONS);
  }

  /** 站点把标题/图标改回去时压回来（自动补刀）。自己引发的变更不会触发（force 前后断开观察） */
  private startObserving(): void {
    this.observer = new MutationObserver(() => {
      if (!this.active) return;
      const titleDiverged = this.doc.title !== this.wantedTitle;
      const iconDiverged = this.iconDiverged();
      if (!titleDiverged && !iconDiverged) {
        // 可能只是 head 刚出现 / 被替换：重新挂上观察目标
        this.observer?.disconnect();
        this.observeTargets();
        return;
      }
      // 先记下站点写入的值，再判断运行时是否仍有效：失效收尾时的还原要用到最新标题
      this.recordSiteValues(titleDiverged);
      if (!this.isAlive() || !this.active) return;
      // 同一拍内的一串站点变化只安排一次补刀；熔断后连安排都不做
      this.scheduleForce();
    });
    this.observeTargets();
  }

  /** 合并窗口：站点写入后最多一拍补一次；窗口内后续写入不重复排期 */
  private scheduleForce(): void {
    if (this.tripped || this.cancelPending) return;
    this.cancelPending = this.setTimer(() => {
      this.cancelPending = null;
      if (!this.active || this.tripped) return;
      if (!this.isAlive()) return;
      if (this.doc.title === this.wantedTitle && !this.iconDiverged()) return;
      this.force();
    }, this.debounceMs);
  }

  private cancelPendingForce(): void {
    this.cancelPending?.();
    this.cancelPending = null;
  }

  /** 熔断后的解封条件只有两个：restore 后重新进入、目标标题/图标真的变了（resetLimit 的调用点） */
  private resetLimit(): void {
    this.tripped = false;
    this.forceTimes = [];
  }

  /** 记一次写入；窗口内到上限则熔断并拒绝这次写入 */
  private takeForceSlot(): boolean {
    const t = this.now();
    this.forceTimes = this.forceTimes.filter((x) => t - x < FORCE_WINDOW_MS);
    if (this.forceTimes.length >= this.maxForces) {
      this.tripBreaker();
      return false;
    }
    this.forceTimes.push(t);
    return true;
  }

  /** 彻底放手：不再写 DOM，留一条可查的记录（判断是网站太顽固还是我们写错了） */
  private tripBreaker(): void {
    if (this.tripped) return;
    this.tripped = true;
    this.forceTimes = [];
    this.cancelPendingForce();
    console.warn(
      `[PageMask] 标签页标题 / 图标在 ${FORCE_WINDOW_MS} 毫秒内已改写 ${this.maxForces} 次，网站仍在改回；` +
        '已停止改写，页面保留网站自己的标题',
    );
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
    const only = links[0]!;
    if (only !== this.ownLink) return true; // 站点自己的声明还在，需要换成我们那张
    if (only.parentElement !== this.doc.head) return true;
    return only.getAttribute('href') !== this.wantedIcon;
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.cancelPendingForce();
    this.forceTimes = [];
  }
}
