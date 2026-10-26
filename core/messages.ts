/**
 * 各上下文（popup / background / content）之间的消息协议。
 * 零影响铁律：内容脚本只通过动态注册注入已授权站点，其余一切通信都发生在
 * 已授权站点的标签页与扩展内部之间。
 */

export interface EnableSiteRequest {
  t: 'enableSite';
  origin: string;
  /** 需要立即注入内容脚本的已打开标签页（popup 当前标签） */
  tabId: number;
}

export interface EnableSiteResponse {
  ok: boolean;
  error?: string;
}

export interface ResetSiteRequest {
  t: 'resetSite';
  origin: string;
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

/** popup → 内容脚本：打开设置向导（新站点或添加元素） */
export interface OpenWizardMsg {
  t: 'openWizard';
  mode: 'newSite' | 'addElement';
}

/** popup → 内容脚本：打开页面内编辑面板 */
export interface OpenEditorMsg {
  t: 'openEditor';
}

export type BgRequest =
  | EnableSiteRequest
  | ResetSiteRequest
  | ApplyDisguiseRequest
  | RestoreOriginalRequest
  | DraftCssRequest;
export type ContentMsg = OpenWizardMsg | OpenEditorMsg;
