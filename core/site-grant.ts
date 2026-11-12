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

/**
 * 全部已授权的主机模式（不含 API 权限）。
 * 失败（瞬时异常）返回 null：调用方跳过这一轮，**不**当作「全没授权」——
 * 对账里那样算会把所有站点注销一轮（#186）。
 */
export async function allGrantedPatterns(browser: { permissions: PermissionsApi }): Promise<string[] | null> {
  try {
    const all = await browser.permissions.getAll();
    return (all.origins ?? []).filter((o): o is string => typeof o === 'string');
  } catch {
    return null;
  }
}

/**
 * 一个站点当前有效的授权模式（为空 = 待授权），保持 sitePatterns 的顺序：
 * 裸域在前、子域在后；其余归到同一站点的旧精确模式排在后面。
 * all 可由调用方预先取好（allGrantedPatterns 的结果，含失败时的 null），避免一次对账里
 * 为每个站点各调一次 getAll；为 null 时跳过按模式的归并，直接落到下面的 contains 兜底。
 */
export async function grantedPatternsOfSite(
  browser: { permissions: PermissionsApi },
  key: string,
  all?: readonly string[] | null,
): Promise<string[]> {
  const granted = all === undefined ? await allGrantedPatterns(browser) : all;
  if (granted) {
    const own = grantedPatternsFor(key, granted);
    if (own.length > 0) return own;
  }
  // 用户在扩展详情里授了「所有网站」时 getAll 里是一个全站通配模式，归不到任何站点 key；
  // 按本站点的两条模式问 contains 会返回 true。getAll 失败（granted 为 null）时也走到这里：
  // contains 是独立的调用，还能给出正确答案，不把站点误判成没授权
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

interface ParsedPattern {
  /** '*'(http / https 都算) 或具体协议（不含冒号） */
  scheme: string;
  host: string;
  /** ''（未写端口，按 Chrome 口径通配所有端口）或模式里的端口数字 */
  port: string;
  path: RegExp;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** match pattern 的路径是按 `*` 通配的 glob（Chrome 只在路径段支持 `*`） */
function pathRegExp(glob: string): RegExp {
  let out = '^';
  for (const ch of glob) out += ch === '*' ? '.*' : escapeRegExp(ch);
  return new RegExp(`${out}$`);
}

/** 拆 host[:port]，兼容 IPv6 字面量的方括号（[::1]:8080） */
function splitHostPort(host: string): { host: string; port: string } {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end < 0) return { host, port: '' };
    const rest = host.slice(end + 1);
    return { host: host.slice(0, end + 1), port: rest.startsWith(':') ? rest.slice(1) : '' };
  }
  const at = host.lastIndexOf(':');
  return at < 0 ? { host, port: '' } : { host: host.slice(0, at), port: host.slice(at + 1) };
}

/**
 * 解析本项目会用到的 match pattern：`<*|http|https>://<host><path>`。
 * 只认 http / https / `*` 方案；`<all_urls>`、file / ftp 等返回 null（不参与页面覆盖判断）。
 */
function parsePattern(pattern: string): ParsedPattern | null {
  const m = /^(\*|https?):\/\/([^/]*)(\/.*)?$/i.exec(pattern.trim());
  if (!m) return null;
  let { host, port } = splitHostPort(m[2]!.toLowerCase());
  if (!host) return null;
  // 官方端口语法里显式写 `:*` 也是「通配所有端口」（developer.chrome.com match patterns：
  // port 是 1–65535 或 *），与「没写端口」同一口径——'*' 不是数字，不归一的话任何页面
  // 的有效端口都对不上、这条模式永不命中。项目自己产不出这个形态，防御性补齐（#192）
  if (port === '*') port = '';
  return { scheme: m[1]!.toLowerCase(), host, port, path: pathRegExp(m[3] ?? '/*') };
}

/**
 * 这个页面的 URL 是否被这批匹配模式覆盖（#162 第二阶段）。
 *
 * 站点已授权 ≠ 当前页面已覆盖：用户在 weibo.com 允许过访问、随后打开 s.weibo.com，
 * 站点级判断说「已授权」，但内容脚本只注册在授权的那几条模式上，s.weibo.com 上什么都没跑。
 * 弹窗据此决定显示「就绪」还是「这个页面还没允许访问」。
 *
 * 边界（与 Chrome 的 match pattern 同口径，官方文档：「Match patterns match all ports
 * unless an explicit port is specified」，见 developer.chrome.com match patterns）：
 * - `*` 方案覆盖 http 与 https，具体方案只覆盖自己；
 * - `*.weibo.com` 覆盖子域、**不覆盖裸域 weibo.com**（两条都申请，不依赖这条边界，见 sitePatterns）；
 * - 模式没写端口 = 通配所有端口（#185 前误当作「只匹配默认端口」，导致已授权站点的带端口
 *   页面被弹窗误报未授权）；写了端口只匹配页面的**有效端口**——页面没写端口时按方案默认值
 *   算（http 80、https 443），与 Chromium `URLPattern` 的 `EffectiveIntPort` 比较同口径，
 *   即 `https://weibo.com:443/*` 也覆盖 `https://weibo.com/`；
 * - 主机写成 `*` 时按「任意主机」处理（全站通配授权）；
 * - 路径按 `*` 通配做前缀匹配，匹配 pathname + 查询串（项目目前只用 `/*`，但不假设）。
 *
 * 无法解析的 URL、非 http(s) 页面、空模式列表一律 false。
 */
export function isOriginCovered(url: string, patterns: readonly string[]): boolean {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    return false;
  }
  const protocol = page.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  const pageHost = page.hostname.replace(/\.+$/, '').toLowerCase();
  if (!pageHost) return false;
  const pagePort = page.port; // URL 已去掉默认端口（80 / 443）
  // 页面的有效端口（与 GURL::EffectiveIntPort 同口径）：没写端口时取方案默认值
  const pageEffectivePort = pagePort || (protocol === 'https:' ? '443' : '80');
  const pagePath = page.pathname + page.search;

  for (const raw of patterns) {
    const p = parsePattern(raw);
    if (!p) continue;
    if (p.scheme !== '*' && `${p.scheme}:` !== protocol) continue;
    // Chrome 官方口径：模式没写端口 = 通配所有端口；写了端口精确匹配有效端口
    // （主机是否为 `*` 与端口判断互不影响，和 URLPattern 的判断顺序一致）
    if (p.port !== '' && p.port !== pageEffectivePort) continue;
    const anyHost = p.host === '*';
    const hostOk = anyHost || (p.host.startsWith('*.') ? pageHost.endsWith(`.${p.host.slice(2)}`) : pageHost === p.host);
    if (!hostOk) continue;
    if (p.path.test(pagePath)) return true;
  }
  return false;
}
