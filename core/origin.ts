/**
 * URL/origin 工具：站点身份、支持性判断、"这类页面"的零输入推导。
 * 全部纯函数，vitest 可测。
 */

/** 提取站点身份：scheme + host（+非默认端口）。如 https://weread.qq.com */
export function normalizeOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const port = u.port && !isDefaultPort(u.protocol, u.port) ? `:${u.port}` : '';
    return `${u.protocol}//${u.hostname}${port}`;
  } catch {
    return null;
  }
}

function isDefaultPort(protocol: string, port: string): boolean {
  return (protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80');
}

/** 判断 URL 是否允许配置伪装：chrome:// 、file:// 等不支持（design.md「入口拦截」） */
export function isSupportedPage(url: string): { ok: boolean; reason?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: '无法识别的网址' };
  }
  const unsupported = ['chrome:', 'edge:', 'about:', 'devtools:', 'view-source:', 'chrome-extension:'];
  if (unsupported.includes(u.protocol)) {
    return { ok: false, reason: '浏览器内部页面不支持伪装' };
  }
  if (u.protocol === 'file:') {
    return { ok: false, reason: '本地文件页面不支持伪装' };
  }
  if (u.protocol === 'https:' && u.hostname === 'chromewebstore.google.com') {
    return { ok: false, reason: 'Chrome 应用商店页面不支持伪装' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: '此类页面不支持伪装' };
  }
  return { ok: true };
}

/**
 * 从当前网址自动推导"这类页面"（design.md：生效范围零输入按钮）。
 * 推导规则：去掉文件名一段，保留目录前缀。
 * 例：https://weread.qq.com/web/reader/a1b2 → prefix https://weread.qq.com/web/reader/
 */
export function deriveScopePattern(url: string): { label: string; prefix: string } | null {
  const origin = normalizeOrigin(url);
  if (!origin) return null;
  const u = new URL(url);
  const path = u.pathname.replace(/[^/]*$/, ''); // 去掉最后一段文件名，保留目录
  const prefix = `${origin}${path}`;
  const host = u.hostname.replace(/^www\./, '');
  const seg = path.replace(/^\/|\/$/g, '');
  const label = seg
    ? `${host} 上 /${seg}/ 开头的页面`
    : `${host} 的首页`;
  return { label, prefix };
}

/** URL 是否命中某个前缀模式 */
export function urlMatchesPrefix(url: string, prefix: string): boolean {
  return url.startsWith(prefix);
}
