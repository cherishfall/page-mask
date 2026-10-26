/**
 * 动态内容脚本注册计划（纯函数，供单测与后台共用）。
 * manifest 里 content_scripts 只有一个永不命中的占位（pagemask.invalid），
 * 真实站点全部走 chrome.scripting.registerContentScripts 按需注册（ADR-0001/0002）。
 */

export const CONTENT_SCRIPT_FILE = 'content-scripts/content.js' as const;

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
    id: `pagemask:${origin}`,
    matches: [`${origin}/*`],
    js: [CONTENT_SCRIPT_FILE],
    runAt: 'document_start',
    persistAcrossSessions: true,
  };
}
