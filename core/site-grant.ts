/**
 * 站点授权的读取（浏览器边界的薄封装，纯逻辑在 core/reconcile.ts）。
 *
 * 授权是按 match pattern 给的，模式再按 siteKeyOfPattern 归到站点：迁移用户手里只有
 * `https://weibo.com/*` 这类旧精确模式时，它们仍然算「这个站点已授权」。
 * 后台对账、弹窗、管理页共用这一份判断，避免三处各写一遍。
 */
import { grantedPatternsFor } from './reconcile';
import { sitePatterns } from './site-key';

/** 只依赖用到的两个方法，便于单测替身 */
export interface PermissionsApi {
  getAll(): Promise<{ origins?: string[] }>;
  contains(permissions: { origins: string[] }): Promise<boolean>;
}

/** 全部已授权的主机模式（不含 API 权限） */
export async function allGrantedPatterns(browser: { permissions: PermissionsApi }): Promise<string[]> {
  try {
    const all = await browser.permissions.getAll();
    return (all.origins ?? []).filter((o): o is string => typeof o === 'string');
  } catch {
    return [];
  }
}

/**
 * 一个站点当前有效的授权模式（为空 = 待授权），保持 sitePatterns 的顺序：
 * 裸域在前、子域在后；其余归到同一站点的旧精确模式排在后面。
 * all 可由调用方预先取好，避免一次对账里为每个站点各调一次 getAll。
 */
export async function grantedPatternsOfSite(
  browser: { permissions: PermissionsApi },
  key: string,
  all?: readonly string[],
): Promise<string[]> {
  const granted = all ?? (await allGrantedPatterns(browser));
  const own = grantedPatternsFor(key, granted);
  if (own.length > 0) return own;
  // 用户在扩展详情里授了「所有网站」时 getAll 里是一个全站通配模式，归不到任何站点 key；
  // 按本站点的两条模式问 contains 会返回 true
  const canonical = sitePatterns(key);
  try {
    return (await browser.permissions.contains({ origins: canonical })) ? canonical : [];
  } catch {
    return []; // 非法站点 key（旧版导入的脏数据）当作没授权
  }
}

/** 这个站点是否已授权（有任何一条有效模式即可；旧精确模式也算） */
export async function isSiteGranted(
  browser: { permissions: PermissionsApi },
  key: string,
  all?: readonly string[],
): Promise<boolean> {
  return (await grantedPatternsOfSite(browser, key, all)).length > 0;
}
