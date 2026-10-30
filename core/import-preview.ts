/**
 * 导入前的影响预览与导入失败提示（#26）。纯函数。
 *
 * 「整体替换」会删掉本机现有的全部设置，确认框必须如实列出影响：本机有多少网站 / 多少条规则会被替换，
 * 其中哪些网站在文件里没有、会被彻底移除；文件里有多少网站 / 规则。
 * 真正的校验与写入仍由 storage.importBundle 负责（预览只读，不改任何数据）。
 */
import { sanitizeProfile } from './validate';
import { t } from './i18n';
import type { SiteProfile } from './types';

export interface ReplaceImpact {
  /** 本机现有站点数 / 规则数（全部会被替换） */
  localSites: number;
  localRules: number;
  /** 文件里没有、会被彻底移除的本机站点（来源，按字母序） */
  removedOrigins: string[];
  /** 被彻底移除的站点上的规则数 */
  removedRules: number;
  /** 文件里的有效站点数 / 规则数 */
  incomingSites: number;
  incomingRules: number;
  /** 文件里带全局设置（默认标签页标题也会被替换） */
  replacesSettings: boolean;
}

/**
 * 计算整体替换的影响。文件不是有效的 PageMask 导出文件、或里面没有有效站点时返回 null
 * （此时不弹确认框，直接交给 importBundle 报出具体原因）。
 */
export function previewReplace(local: SiteProfile[], bundle: unknown): ReplaceImpact | null {
  if (!isObject(bundle) || bundle.app !== 'pagemask' || bundle.formatVersion !== 1 || !Array.isArray(bundle.profiles)) {
    return null;
  }
  const incoming = new Map<string, number>();
  for (const raw of bundle.profiles) {
    const s = sanitizeProfile(raw);
    if (!s) continue;
    // 同一站点出现多次时 importBundle 会合并，这里取较大的规则数做近似
    incoming.set(s.profile.origin, Math.max(incoming.get(s.profile.origin) ?? 0, s.profile.hideRules.length));
  }
  if (incoming.size === 0) return null;
  const removed = local.filter((p) => !incoming.has(p.origin));
  return {
    localSites: local.length,
    localRules: local.reduce((n, p) => n + p.hideRules.length, 0),
    removedOrigins: removed.map((p) => p.origin).sort(),
    removedRules: removed.reduce((n, p) => n + p.hideRules.length, 0),
    incomingSites: incoming.size,
    incomingRules: [...incoming.values()].reduce((a, b) => a + b, 0),
    replacesSettings: isObject(bundle.settings),
  };
}

/**
 * 导入失败时给用户看的话：storage 层对文件内容抛出的原因原样保留；
 * 其它错误（读文件失败、写入存储失败等，可能带英文报错）不暴露原文，统一成人话。
 * 文件不是 JSON 时调用方应先换成 invalidExportFile()。
 */
export function importErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  const messages = t().errors;
  if (msg.startsWith(messages.invalidExportFile) || msg.includes(messages.newerImport)) {
    return messages.importFailed(msg);
  }
  return messages.importFailedGeneric;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
