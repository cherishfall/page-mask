/**
 * 管理页里「一个网站」的身份与展示：路由参数、给人看的名字、失效项。
 * 纯函数，页面与 store 共用，避免三个视图各写一份。
 *
 * 站点身份是站点 key（core/site-key.ts，#162）：weibo.com / 127.0.0.1:8080 / [::1]:8080。
 * 路由参数就是站点 key 本身（`#/sites/<key>`）——同一个网站只有一份配置。
 */
import { displayHost } from '@/core/origin';
import type { HideRule, SiteProfile } from '@/core/types';

/**
 * 站点 key → 路由参数。key 本身已经是规范形态，旧调用点传 origin 时退回 host 形式。
 */
export function siteHostOf(key: string): string {
  try {
    return new URL(key).host;
  } catch {
    return key;
  }
}

/** 把路由参数规范成主机形式（中文域名转 Punycode、去掉多余写法）；解析不了就原样返回 */
export function normalizeSiteHost(host: string): string {
  try {
    return new URL(`http://${host}`).host;
  } catch {
    return host;
  }
}

/** 展示用名字：去掉 www.、国际化域名转回 Unicode，端口保留（站点 key 也能直接传入） */
export function siteLabelOf(key: string): string {
  let hostname = key;
  let port = '';
  try {
    const u = new URL(key.includes('://') ? key : `http://${key}`);
    hostname = u.hostname;
    port = u.port;
  } catch {
    return key;
  }
  const host = displayHost(hostname);
  return port ? `${host}:${port}` : host;
}

/** 可能失效的收起项（失效体检结果） */
export function staleRulesOf(p: SiteProfile): HideRule[] {
  return p.hideRules.filter((r) => r.lastHealth === 'stale');
}
