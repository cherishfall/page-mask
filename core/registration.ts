/**
 * 动态内容脚本注册计划（纯函数，供单测与后台共用）。
 * manifest 里没有任何 content_scripts（构建钩子删除，见 wxt.config.ts），
 * 真实站点全部走 chrome.scripting.registerContentScripts 按需注册（ADR-0001/0002），
 * 由后台对账（core/reconcile.ts）保持与站点配置、授权一致。
 *
 * 站点身份是站点 key（core/site-key.ts，#162）：id 为 `pagemask:<key>`，
 * matches 由调用方传入——普通域名是「裸域 + 子域」两条（core/site-key.ts 的 sitePatterns），
 * 迁移前只授权了精确模式的站点则沿用那些旧模式。
 */

export const CONTENT_SCRIPT_FILE = 'content-scripts/content.js' as const;

/**
 * 一次性幕布脚本（#46）：未添加过的网站里没有内容脚本，popup 点「遮住本页」时由后台
 * 用 activeTab 注入这一份。**不注册**（不是动态注册计划的一部分），也不写进 manifest。
 */
export const CURTAIN_ONESHOT_FILE = 'curtain-oneshot.js' as const;

/** 本扩展动态注册 id 的命名空间；对账只处理带这个前缀的注册 */
export const REGISTRATION_ID_PREFIX = 'pagemask:';

export type ScriptFile = `${string}.js`;

export interface RegistrationPlan {
  id: string;
  matches: string[];
  js: ScriptFile[];
  runAt: 'document_start';
  persistAcrossSessions: boolean;
}

/**
 * 一个站点的注册计划。matches 必须是该站点**已授权**的模式（对账时按站点求出来的有效模式），
 * 否则 Chrome 会拒绝注册；不写端口的主机模式会命中该主机的所有端口，
 * 内容脚本入口按站点 key 再核对一次配置。
 */
export function registrationPlan(key: string, patterns: string[]): RegistrationPlan {
  return {
    id: `${REGISTRATION_ID_PREFIX}${key}`,
    matches: [...patterns],
    js: [CONTENT_SCRIPT_FILE],
    runAt: 'document_start',
    persistAcrossSessions: true,
  };
}
