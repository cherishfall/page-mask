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

/** 内容脚本 → 后台：应用伪装（计算并注入该页 CSS）。tabId 由后台从 sender 取；携带页面自身 URL 以判断生效范围 */
export interface ApplyDisguiseRequest {
  t: 'applyDisguise';
  url: string;
}

/** 内容脚本 → 后台：还原（移除注入的 CSS） */
export interface RestoreOriginalRequest {
  t: 'restoreOriginal';
}

/** 向导 → 后台：预览草稿样式（null = 清除预览） */
export interface DraftCssRequest {
  t: 'draftCss';
  css: string | null;
}

export interface Ack {
  ok: boolean;
  error?: string;
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
