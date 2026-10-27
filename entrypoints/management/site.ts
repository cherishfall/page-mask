/**
 * 管理页里「一个网站」的身份与展示：路由参数、给人看的名字、失效项。
 * 纯函数，页面与 store 共用，避免三个视图各写一份。
 */
import { displayHost } from '@/core/origin';
import type { HideRule, SiteProfile } from '@/core/types';

/**
 * 站点在地址里的标识：origin 的 host（含非默认端口，如 127.0.0.1:8080），
 * 也是 `#/sites/<host>` 的路由参数。用 host 而不是 hostname，避免同主机不同端口互相串。
 */
export function siteHostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** 把路由参数规范成 URL 的 host 形式（中文域名转 Punycode、去掉多余写法）；解析不了就原样返回 */
export function normalizeSiteHost(host: string): string {
  try {
    return new URL(`http://${host}`).host;
  } catch {
    return host;
  }
}

/** 展示用名字：去掉 www.、国际化域名转回 Unicode，端口保留 */
export function siteLabelOf(origin: string): string {
  try {
    const u = new URL(origin);
    const host = displayHost(u.hostname);
    return u.port ? `${host}:${u.port}` : host;
  } catch {
    return origin;
  }
}

/** 可能失效的收起项（失效体检结果） */
export function staleRulesOf(p: SiteProfile): HideRule[] {
  return p.hideRules.filter((r) => r.lastHealth === 'stale');
}
