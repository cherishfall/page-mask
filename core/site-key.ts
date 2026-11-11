/**
 * 站点身份内核（#162）：一个网站 = 一个可注册域名（eTLD+1），忽略协议与非默认端口。
 * weibo.com / www.weibo.com / s.weibo.com 是同一个网站；weibo.com 与 weibo.cn 是两个。
 *
 * 与 core/origin.ts 的分工：
 * - 这里的站点 key 只表达「这是哪个网站」，用于配置的身份、存储 key、权限与动态注册；
 * - normalizeOrigin（含协议与端口的页面来源）语义不变，生效范围仍按页面实际 URL 判定——
 *   合并站点不等于合并范围（「只在 weibo.com 首页收起」不会套到 s.weibo.com）。
 *
 * 全部纯函数，无外部依赖、不联网。公共后缀只内置一份子集：
 * 覆盖常见多段后缀（com.cn / co.uk / com.au …）与常见私有后缀（github.io / vercel.app …），
 * 其余按「单段后缀」处理（取最后两段）。**这是有意的取舍**：完整 PSL 体积与维护成本都不适合放进扩展，
 * 不在表里的后缀最多表现为「同后缀的两个站点被当成一个」，不会丢用户数据。
 */

/** 公共后缀子集：命中时按「后缀 + 1 段」求可注册域名 */
const MULTI_LABEL_SUFFIXES = [
  // 中国二级后缀
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'edu.cn',
  'ac.cn',
  // 常见国家码多段后缀
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'net.uk',
  'ltd.uk',
  'plc.uk',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.jp',
  'go.jp',
  'com.br',
  'net.br',
  'org.br',
  'com.tw',
  'net.tw',
  'org.tw',
  'edu.tw',
  'com.hk',
  'net.hk',
  'org.hk',
  'edu.hk',
  'co.kr',
  'or.kr',
  'co.nz',
  'org.nz',
  'co.za',
  'com.mx',
  'com.ar',
  'com.sg',
  'com.my',
  'co.in',
  'co.id',
  'com.tr',
  'co.il',
  // 常见私有后缀（注册人之间互相独立，不能合并）
  'github.io',
  'gitee.io',
  'gitlab.io',
  'blogspot.com',
  'pages.dev',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'workers.dev',
  'web.app',
  'firebaseapp.com',
  'appspot.com',
  'glitch.me',
  'readthedocs.io',
] as const;

const MULTI_LABEL_SUFFIX_SET = new Set<string>(MULTI_LABEL_SUFFIXES);

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** IPv4 / IPv6 字面量（URL 的 hostname 对 IPv6 带方括号，如 [::1]） */
function isIpLiteral(host: string): boolean {
  return host.startsWith('[') || IPV4.test(host);
}

/**
 * 可注册域名（eTLD+1），入参必须是 ASCII（punycode）主机名。
 * 内置后缀表按最长匹配；主机恰好等于某个后缀时原样返回（它自己没有 eTLD+1）。
 */
export function registrableDomain(host: string): string {
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 1) return host;
  for (let i = 0; i < labels.length; i++) {
    const suffix = labels.slice(i).join('.');
    if (!MULTI_LABEL_SUFFIX_SET.has(suffix)) continue;
    const keep = labels.length - i + 1; // 后缀 + 1 段
    if (keep > labels.length) return host; // 主机本身就是后缀
    return labels.slice(-keep).join('.');
  }
  return labels.slice(-2).join('.');
}

/**
 * 计算站点 key：
 * - 入参可以是完整 URL、origin 或裸主机名（如 weibo.com / 127.0.0.1:8080）
 * - 只认 http / https
 * - IP 字面量、localhost、单标签主机名、带非默认端口的地址 → 保留 host[:port]，不合并子域
 * - 其余 → eTLD+1（小写、punycode/ASCII 形态）
 * - 无法解析 → null
 *
 * 端口是保守取舍：`weibo.com:8443` 与 `weibo.com` 视为两个站点，不把带端口的站点并进整站，
 * 避免把本地开发 / 内网服务与公网站点混在一起。
 */
export function siteKey(input: string): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    } else {
      // 裸主机名 / host:port；也接受 //host 这种协议相对写法
      url = new URL(raw.startsWith('//') ? `http:${raw}` : `http://${raw}`);
    }
  } catch {
    return null;
  }

  const host = url.hostname.replace(/\.+$/, '').toLowerCase();
  if (!host) return null;
  const port = url.port; // URL 已去掉默认端口（80 / 443）

  if (port || isIpLiteral(host) || host === 'localhost' || !host.includes('.')) {
    return port ? `${host}:${port}` : host;
  }
  return registrableDomain(host);
}

/** 是否为「不合并子域」的站点 key：IP、localhost、单标签主机名或带端口 */
function isExactOnlyKey(key: string): boolean {
  if (key.includes(':')) return true; // 端口（含 IPv6 的冒号）
  if (isIpLiteral(key) || key === 'localhost' || !key.includes('.')) return true;
  return false;
}

/** key 是否带端口：IPv6 字面量本身就含冒号，方括号之后的冒号才是端口 */
function hasPort(key: string): boolean {
  return key.lastIndexOf(':') > key.indexOf(']');
}

/**
 * 站点对应的匹配模式（权限申请、动态注册共用）：
 * - 普通域名：裸域在前、子域在后，两条都申请 / 注册——不依赖 `*://*.x/*` 是否覆盖裸域
 * - IP / localhost / 单标签主机名：只有一条精确模式（不能造无效的通配子域模式）
 * - 带端口：不能用 `*` 方案——Chrome 的匹配模式只允许 `*` 搭配默认端口（80 / 443），
 *   `*://host:8080/*` 会被判 "Invalid port"（permissions.request / remove 整批失败）。
 *   显式给出 http、https 两条：协议不参与站点身份（#162），两条合起来仍是一个站点。
 */
export function sitePatterns(key: string): string[] {
  if (hasPort(key)) return [`http://${key}/*`, `https://${key}/*`];
  const exact = `*://${key}/*`;
  if (isExactOnlyKey(key)) return [exact];
  return [exact, `*://*.${key}/*`];
}

/**
 * 把 match pattern 归到站点 key：`*://*.weibo.com/*` → weibo.com；`https://weibo.com/*` → weibo.com。
 * `<all_urls>` 等不是站点模式的输入返回 null。
 */
export function siteKeyOfPattern(pattern: string): string | null {
  const m = /^(?:\*|[a-z][a-z0-9+.-]*):\/\/([^/]*)/i.exec(pattern);
  if (!m) return null;
  let host = m[1]!.toLowerCase();
  if (host.startsWith('*.')) host = host.slice(2);
  if (!host || host.includes('*')) return null;
  if (host.startsWith('.')) host = host.slice(1);
  return siteKey(host);
}

/**
 * 站点 key 是否合法（存储校验用）：
 * - 必须是 siteKey 的规范输出（小写、punycode、无协议、无路径、无默认端口）
 * - 带 `://` 的一律不合法（旧版 origin 形态请在边界处先过 siteKey）
 */
export function isValidSiteKey(v: unknown): v is string {
  return typeof v === 'string' && !!v && !v.includes('://') && siteKey(v) === v;
}
