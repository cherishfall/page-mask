/**
 * 各上下文（popup / 管理页 / background / content）之间的消息协议。
 * 零影响铁律：内容脚本只通过动态注册注入已授权站点，其余一切通信都发生在
 * 已授权站点的标签页与扩展内部之间。
 *
 * 特权消息（enableSite / resetSite / reconcile）后台只接受扩展自己的页面发来的（REVIEW B26），
 * 内容脚本发来一律拒绝；内容脚本能发的消息只作用于发送方自己的文档 / 自己的站点（按 sender 判断）。
 */

/** 启用站点后要在页面里打开的界面 */
export type OpenIntent = 'newSite' | 'addElement';

/** 扩展页面 → 后台：为当前标签页的站点对账注册并立即注入内容脚本（可选随即打开向导） */
export interface EnableSiteRequest {
  t: 'enableSite';
  origin: string;
  /** 需要立即注入内容脚本的已打开标签页（popup 当前标签）；后台会核对它的当前来源 */
  tabId: number;
  /** 注入后直接打开的向导模式；不传则只注入 */
  open?: OpenIntent;
  /**
   * 先向用户请求这个站点的访问权限，再继续。
   * 请求必须由后台在消息监听器的第一个同步回合里发起：popup 会在权限框弹出时被销毁，
   * 而用户手势可以跨 runtime.sendMessage 传到后台（只在同一个同步回合内有效）。
   */
  requestPermission?: boolean;
}

/**
 * 失败原因：tabMismatch = 标签页已不在该站点；notGranted = 没有站点授权；
 * injectFailed = 页面拒绝注入；denied = 用户在权限框上拒绝；
 * gestureLost = 后台调用权限请求时已不在用户手势内（popup 可退回自己发起，见 popup 的兜底分支）
 */
export type EnableSiteErrorCode =
  | 'tabMismatch'
  | 'notGranted'
  | 'injectFailed'
  | 'forbidden'
  | 'denied'
  | 'gestureLost';

export interface EnableSiteResponse {
  ok: boolean;
  error?: string;
  code?: EnableSiteErrorCode;
}

/** 扩展页面 → 后台：一键清空某站点（先还原已打开页面，再收回授权、注销、删配置） */
export interface ResetSiteRequest {
  t: 'resetSite';
  origin: string;
}

/** 扩展页面 → 后台：立即对账一次（导入、授权之后），回复仍待授权的站点 */
export interface ReconcileRequest {
  t: 'reconcile';
}

export interface ReconcileResponse {
  ok: boolean;
  error?: string;
  /** 有配置、没授权的来源 */
  pending?: string[];
}

/** 内容脚本 → 后台：新站点首次向导被取消（还没保存过配置），撤销本站授权与注册 */
export interface CancelNewSiteRequest {
  t: 'cancelNewSite';
}

/*
 * 隐藏样式按「文档」跟踪（不是按标签页，ADR-0002 补充、REVIEW B5）：
 * - 内容脚本持有本文档已注入的两份文本：正式样式、向导预览样式，每次请求带上 prev（本文档当前文本）
 * - 后台不记任何状态：用 sender.tab.id + sender.documentId 定位文档，用 sender.url 判断生效范围，
 *   按 prev → next 替换（相同跳过；不同先插新后删旧），把替换后文档里的文本作为 css 回传
 * 因此 SW 被回收、bfcache 后退、预渲染激活都不会删错或漏删。
 */

/** 内容脚本 → 后台：按当前存储与 sender.url 同步本文档的正式隐藏样式（原样态 / 无规则 → 移除） */
export interface ApplyDisguiseRequest {
  t: 'applyDisguise';
  /** 本文档当前已注入的正式样式文本（null = 没有） */
  prev: string | null;
  /**
   * 本页当前地址（SPA 路由变化后 sender.url 可能还没更新）。后台只在与 sender.url 同源时采用，
   * 否则仍按 sender.url 计算——内容脚本不能借此拿到别的站点的样式
   */
  url?: string;
}

/**
 * 内容脚本 → 后台：开 / 关本文档的宿主保护样式（core/host-shield.ts，固定文本由后台决定）。
 * 页内界面存在期间一直开着，与伪装态 / 原样态无关
 */
export interface HostShieldRequest {
  t: 'hostShield';
  on: boolean;
  prev: string | null;
}

/**
 * 内容脚本 → 后台：本文档里有失联旧实例（扩展更新 / 重载前的）留下的用户样式表，新实例已经注入了
 * 自己的一份，请把旧的各撤一份：宿主保护样式、按当前配置与地址算出的正式样式。
 * 同一文本注入几次就要删几次才会消失（实测），所以新实例先插、再请后台删旧的，中间不闪。
 * 旧实例的样式文本拿不到（不在同一隔离环境），只能按当前配置重算；对不上的删除是空操作。
 */
export interface ReleaseOrphanCssRequest {
  t: 'releaseOrphanCss';
  url?: string;
}

/** 内容脚本 → 后台：移除本文档的正式隐藏样式（例如进入向导前临时还原） */
export interface RestoreOriginalRequest {
  t: 'restoreOriginal';
  prev: string | null;
}

/** 向导（内容脚本内）→ 后台：把本文档的预览样式从 prev 换成 next（next = null 即清除预览） */
export interface DraftCssRequest {
  t: 'draftCss';
  prev: string | null;
  next: string | null;
}

export interface Ack {
  ok: boolean;
  error?: string;
}

/** 样式请求的回复：css = 处理后本文档里实际存在的文本（失败时通常仍是 prev），内容脚本据此更新记录 */
export interface CssAck extends Ack {
  css: string | null;
}

/** popup / E2E → 内容脚本：打开设置向导（新站点或添加元素） */
export interface OpenWizardMsg {
  t: 'openWizard';
  mode: OpenIntent;
}

/** popup → 内容脚本：打开页面内编辑面板 */
export interface OpenEditorMsg {
  t: 'openEditor';
}

/** 后台 → 内容脚本：本站即将被一键清空，立即移除隐藏样式、标题图标与所有界面，完成后回复 Ack */
export interface SiteResetMsg {
  t: 'siteReset';
}

/**
 * 扩展页面 → 内容脚本 / 一次性脚本：本页当前是不是遮着的（#50）。
 * 没遮住时回 { ok: true, covered: false }，不报错。
 */
export interface CurtainStateMsg {
  t: 'curtainState';
}

/**
 * 扩展页面 → 内容脚本 / 一次性脚本：撤掉本页的幕布（#50）。
 * 没遮住时什么也不做、同样回复成功；撤掉后仍可再次遮住。
 */
export interface CurtainDismissMsg {
  t: 'curtainDismiss';
}

/** 幕布状态查询的回复 */
export interface CurtainStateReply extends Ack {
  covered: boolean;
}

/**
 * 消息是不是本扩展自己的页面（popup / 管理页 / 引导页）发来的。
 * 特权消息（后台的 enableSite / resetSite 等）与「作用于当前文档」的幕布消息都用它把关：
 * 网页里的内容脚本 / 网页脚本发来的消息 sender.url 是网页地址，一律不算（REVIEW B26）。
 */
export function fromExtensionPage(
  sender: { id?: string; url?: string } | undefined | null,
  extensionId: string,
  extensionBase: string,
): boolean {
  return !!sender && sender.id === extensionId && typeof sender.url === 'string' && sender.url.startsWith(extensionBase);
}

/**
 * popup → 后台：给当前标签页铺一次幕布（#46，未添加过的网站）。
 * 未添加的网站里没有内容脚本，只能由后台用 activeTab 注入一次性脚本
 * （entrypoints/curtain-oneshot.ts），不注册、不写配置。
 */
export interface CoverPageRequest {
  t: 'coverPage';
  tabId: number;
}

export type BgRequest =
  | EnableSiteRequest
  | ResetSiteRequest
  | ReconcileRequest
  | CancelNewSiteRequest
  | CoverPageRequest
  | ApplyDisguiseRequest
  | RestoreOriginalRequest
  | DraftCssRequest
  | HostShieldRequest
  | ReleaseOrphanCssRequest;
export type ContentMsg = OpenWizardMsg | OpenEditorMsg | SiteResetMsg | CurtainStateMsg | CurtainDismissMsg;

/** 内容脚本 / 一次性脚本给扩展页面的回复 */
export type ContentReply = Ack | CurtainStateReply;
