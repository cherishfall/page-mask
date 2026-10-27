/**
 * 动态内容脚本注册计划（纯函数，供单测与后台共用）。
 * manifest 里没有任何 content_scripts（构建钩子删除，见 wxt.config.ts），
 * 真实站点全部走 chrome.scripting.registerContentScripts 按需注册（ADR-0001/0002），
 * 由后台对账（core/reconcile.ts）保持与站点配置、授权一致。
 */

export const CONTENT_SCRIPT_FILE = 'content-scripts/content.js' as const;

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

export function registrationPlan(origin: string): RegistrationPlan {
  return {
    id: `${REGISTRATION_ID_PREFIX}${origin}`,
    // 注意：来源不带端口时，该匹配模式会命中这个主机的所有端口（REVIEW B28），
    // 内容脚本入口按 location.origin 再核对一次站点配置
    matches: [`${origin}/*`],
    js: [CONTENT_SCRIPT_FILE],
    runAt: 'document_start',
    persistAcrossSessions: true,
  };
}

/** 站点授权对应的匹配模式（与注册的 matches 相同） */
export const originPattern = (origin: string) => `${origin}/*`;
