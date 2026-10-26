/**
 * URL/origin 工具：站点身份、支持性判断、"这类页面"的零输入推导与匹配。
 * 全部纯函数，vitest 可测。
 */
import type { ScopePattern } from './types';

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

/**
 * 判断 URL 能否使用清爽模式：chrome:// 、file:// 、应用商店等页面扩展无法注入脚本（design.md「入口拦截」）。
 * 应用商店有新旧两个地址：chromewebstore.google.com 与 chrome.google.com/webstore。
 */
export function isSupportedPage(url: string): { ok: boolean; reason?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: '无法识别的网址' };
  }
  const unsupported = ['chrome:', 'edge:', 'about:', 'devtools:', 'view-source:', 'chrome-extension:'];
  if (unsupported.includes(u.protocol)) {
    return { ok: false, reason: '浏览器内部页面无法使用清爽模式' };
  }
  if (u.protocol === 'file:') {
    return { ok: false, reason: '本地文件无法使用清爽模式' };
  }
  const isStore =
    u.hostname === 'chromewebstore.google.com' ||
    (u.hostname === 'chrome.google.com' && /^\/webstore(?:\/|$)/.test(u.pathname));
  if ((u.protocol === 'https:' || u.protocol === 'http:') && isStore) {
    return { ok: false, reason: 'Chrome 应用商店页面无法使用清爽模式' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: '这类页面无法使用清爽模式' };
  }
  return { ok: true };
}

// ---------- 展示用：国际化域名转回 Unicode ----------

const PUNY_BASE = 36;
const PUNY_TMIN = 1;
const PUNY_TMAX = 26;

function punyAdapt(delta: number, numPoints: number, first: boolean): number {
  let d = first ? Math.floor(delta / 700) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((PUNY_BASE - PUNY_TMIN) * PUNY_TMAX) >> 1) {
    d = Math.floor(d / (PUNY_BASE - PUNY_TMIN));
    k += PUNY_BASE;
  }
  return k + Math.floor(((PUNY_BASE - PUNY_TMIN + 1) * d) / (d + 38));
}

function punyDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 22; // 0-9 → 26-35
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 97; // a-z
  return PUNY_BASE;
}

/** RFC 3492 Punycode 解码（不含 xn-- 前缀）。输入不合法时抛错 */
function punycodeDecode(input: string): string {
  const out: number[] = [];
  const basic = Math.max(input.lastIndexOf('-'), 0);
  for (let j = 0; j < basic; j++) {
    const c = input.charCodeAt(j);
    if (c >= 0x80) throw new Error('bad punycode');
    out.push(c);
  }
  let n = 128;
  let bias = 72;
  let i = 0;
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i;
    let w = 1;
    for (let k = PUNY_BASE; ; k += PUNY_BASE) {
      if (idx >= input.length) throw new Error('bad punycode');
      const digit = punyDigit(input.charCodeAt(idx++));
      if (digit >= PUNY_BASE) throw new Error('bad punycode');
      i += digit * w;
      const t = k <= bias ? PUNY_TMIN : k >= bias + PUNY_TMAX ? PUNY_TMAX : k - bias;
      if (digit < t) break;
      w *= PUNY_BASE - t;
    }
    const len = out.length + 1;
    bias = punyAdapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) throw new Error('bad punycode');
    out.splice(i++, 0, n);
  }
  if (out.length === 0) throw new Error('bad punycode');
  return String.fromCodePoint(...out);
}

/**
 * 展示用主机名：去掉 www.，国际化域名（URL 里是 xn-- 开头的 Punycode）转回 Unicode。
 * 浏览器的 URL 对象只会把中文域名转成 xn--，不提供反向转换，所以这里自带一个解码器；解不开就原样显示。
 */
export function displayHost(hostname: string): string {
  let host = hostname;
  try {
    host = hostname
      .split('.')
      .map((label) => (/^xn--/i.test(label) ? punycodeDecode(label.slice(4)) : label))
      .join('.');
  } catch {
    host = hostname;
  }
  return host.replace(/^www\./, '');
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// ---------- "这类页面"推导 ----------

/**
 * hash 路由：路径是根、页面靠 `#/xxx` 或 `#!/xxx` 区分（老式单页应用常见）。
 * 这类网站的每个页面网址路径都一样，按路径无法区分"这类页面"。普通锚点 `#top` 不算。
 */
export function isHashRouted(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === '/' && /^#!?\//.test(u.hash);
  } catch {
    return false;
  }
}

/** 当前网址不提供"这类页面"选项时给用户的说明；有选项时返回 null */
export function scopeUnavailableHint(url: string): string | null {
  return isHashRouted(url) ? '这个网站用 # 区分页面，暂时只能按整站生效' : null;
}

/**
 * 从当前网址自动推导"这类页面"（design.md：生效范围零输入按钮）。
 * - 多级路径：去掉最后一段，保留目录。/web/reader/a1b2 → /web/reader 下的页面
 * - 一级路径：保留完整路径（去掉最后一段就成了整站）。/web → /web 下的页面
 * - 根路径：精确匹配首页（match: 'exact'），不能写成前缀——根路径前缀等于整站
 * - hash 路由：返回 null，不提供该选项（见 scopeUnavailableHint）
 * prefix 保持浏览器网址的编码形式（中文路径是 %E4%B9%A6），label 显示解码后的路径与 Unicode 主机名。
 */
export function deriveScopePattern(url: string): ScopePattern | null {
  const origin = normalizeOrigin(url);
  if (!origin) return null;
  const u = new URL(url);
  const port = origin.slice(`${u.protocol}//${u.hostname}`.length); // 非默认端口才有，如 ":3000"
  const host = displayHost(u.hostname) + port;
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length === 0) {
    if (isHashRouted(url)) return null;
    return { label: `${host} 的首页`, prefix: `${origin}/`, match: 'exact' };
  }
  const keep = u.pathname.endsWith('/') || segs.length === 1 ? segs : segs.slice(0, -1);
  const path = `/${keep.join('/')}`;
  return { label: `${host} 上 ${decodePath(path)} 下的页面`, prefix: `${origin}${path}` };
}

/** 把网址规范成浏览器的标准形式（编码中文、去默认端口），解析失败原样返回 */
function canonicalUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

/**
 * URL 是否命中某个前缀（带边界）：前缀后面必须是结尾、`/`、`?` 或 `#`。
 * 例：前缀 /web 命中 /web、/web/、/web?x、/web/a，不命中 /website。
 * 以 `/` 结尾的前缀（旧数据）本身就是边界，按普通前缀比较。
 */
export function urlMatchesPrefix(url: string, prefix: string): boolean {
  const href = canonicalUrl(url);
  if (!href.startsWith(prefix)) return false;
  if (prefix.endsWith('/')) return true;
  const next = href.charAt(prefix.length);
  return next === '' || next === '/' || next === '?' || next === '#';
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** URL 是否命中一条生效范围模式：exact = 只比 站点+路径（忽略 ?查询 与 #锚点）；缺省 = 带边界的前缀 */
export function urlMatchesPattern(url: string, pattern: ScopePattern): boolean {
  if (pattern.match !== 'exact') return urlMatchesPrefix(url, pattern.prefix);
  const origin = normalizeOrigin(url);
  if (!origin || origin !== normalizeOrigin(pattern.prefix)) return false;
  return stripTrailingSlash(new URL(url).pathname) === stripTrailingSlash(new URL(pattern.prefix).pathname);
}
