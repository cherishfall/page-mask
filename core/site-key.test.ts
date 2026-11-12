import { describe, expect, it } from 'vitest';
import { isValidSiteKey, registrableDomain, siteKey, siteKeyOfPattern, sitePatterns } from './site-key';

describe('siteKey：一个网站 = 可注册域名', () => {
  it('同站点的裸域与子域合并', () => {
    expect(siteKey('https://weibo.com')).toBe('weibo.com');
    expect(siteKey('https://www.weibo.com')).toBe('weibo.com');
    expect(siteKey('https://s.weibo.com')).toBe('weibo.com');
    expect(siteKey('http://weibo.com/home?x=1#top')).toBe('weibo.com');
    expect(siteKey('weibo.com')).toBe('weibo.com');
  });

  it('不同注册域名不合并', () => {
    expect(siteKey('https://weibo.com')).not.toBe(siteKey('https://weibo.cn'));
    expect(siteKey('https://a.example')).not.toBe(siteKey('https://b.example'));
  });

  it('多段公共后缀：com.cn / co.uk', () => {
    expect(siteKey('https://www.example.com.cn')).toBe('example.com.cn');
    expect(siteKey('https://a.example.com.cn')).toBe('example.com.cn');
    expect(siteKey('https://news.example.co.uk')).toBe('example.co.uk');
    expect(siteKey('https://example.co.uk')).toBe('example.co.uk');
    // 后缀本身没有 eTLD+1，原样返回
    expect(registrableDomain('co.uk')).toBe('co.uk');
    expect(siteKey('https://com.cn')).toBe('com.cn');
  });

  it('私有后缀按注册人隔离：a.github.io 与 b.github.io 是两个站点', () => {
    expect(siteKey('https://a.github.io')).toBe('a.github.io');
    expect(siteKey('https://b.github.io')).toBe('b.github.io');
    expect(siteKey('https://a.github.io')).not.toBe(siteKey('https://b.github.io'));
    expect(siteKey('https://foo.pages.dev')).toBe('foo.pages.dev');
    expect(siteKey('https://bar.pages.dev')).not.toBe(siteKey('https://foo.pages.dev'));
    expect(siteKey('https://x.vercel.app')).toBe('x.vercel.app');
    expect(siteKey('https://x.blogspot.com')).toBe('x.blogspot.com');
  });

  it('IDN 在 punycode 主机名上计算，子域仍合并', () => {
    const apex = siteKey('https://例子.中国');
    expect(apex).toBe('xn--fsqu00a.xn--fiqs8s');
    expect(siteKey('https://www.例子.中国')).toBe(apex);
    expect(siteKey('https://s.例子.中国/x')).toBe(apex);
    // 协议、大小写、结尾的点都不影响
    expect(siteKey('HTTP://WWW.WEIBO.COM.')).toBe('weibo.com');
  });

  it('IP 字面量保留主机与端口，不合并', () => {
    expect(siteKey('http://127.0.0.1')).toBe('127.0.0.1');
    expect(siteKey('http://127.0.0.1:8080')).toBe('127.0.0.1:8080');
    expect(siteKey('http://127.0.0.1:8080/x')).toBe('127.0.0.1:8080');
    expect(siteKey('http://127.0.0.1:8080')).not.toBe(siteKey('http://127.0.0.1:8081'));
    expect(siteKey('http://[::1]')).toBe('[::1]');
    expect(siteKey('http://[::1]:8080')).toBe('[::1]:8080');
    expect(siteKey('http://[::1]:8080')).not.toBe(siteKey('http://[::1]:8081'));
  });

  it('localhost 与单标签主机名按原样', () => {
    expect(siteKey('http://localhost')).toBe('localhost');
    expect(siteKey('http://localhost:3000')).toBe('localhost:3000');
    expect(siteKey('http://intranet')).toBe('intranet');
  });

  it('带非默认端口的普通域名也不合并（有意的保守取舍）', () => {
    expect(siteKey('https://weibo.com:8443')).toBe('weibo.com:8443');
    expect(siteKey('https://weibo.com:8443')).not.toBe(siteKey('https://weibo.com'));
    // 子域带同一端口也不并成裸域，保留完整 host
    expect(siteKey('https://s.weibo.com:8443')).toBe('s.weibo.com:8443');
  });

  it('只认 http / https，无法解析的输入返回 null', () => {
    expect(siteKey('ftp://x.com')).toBeNull();
    expect(siteKey('javascript:alert(1)')).toBeNull();
    expect(siteKey('chrome://settings')).toBeNull();
    expect(siteKey('file:///tmp/x')).toBeNull();
    expect(siteKey('')).toBeNull();
    expect(siteKey('   ')).toBeNull();
  });
});

describe('sitePatterns：裸域在前，特殊情况只给精确模式', () => {
  it('普通域名两条：裸域在前，子域在后', () => {
    expect(sitePatterns('weibo.com')).toEqual(['*://weibo.com/*', '*://*.weibo.com/*']);
    expect(sitePatterns('example.com.cn')).toEqual(['*://example.com.cn/*', '*://*.example.com.cn/*']);
    expect(sitePatterns('a.github.io')).toEqual(['*://a.github.io/*', '*://*.a.github.io/*']);
  });

  it('IP / localhost / 单标签只有一条精确模式', () => {
    expect(sitePatterns('127.0.0.1')).toEqual(['*://127.0.0.1/*']);
    expect(sitePatterns('[::1]')).toEqual(['*://[::1]/*']);
    expect(sitePatterns('localhost')).toEqual(['*://localhost/*']);
    expect(sitePatterns('intranet')).toEqual(['*://intranet/*']);
  });

  // Chrome 的匹配模式里 `*` 方案只接受通配端口，任何显式端口（连 :80 / :443 在内）都报
  // Invalid port（Chromium URLPattern::IsValidPortForScheme），权限申请 / 收回会整批失败。
  // 带端口的站点因此显式给出 http、https 两条。
  it('带端口的站点给 http + https 两条（不能用 * 方案）', () => {
    expect(sitePatterns('127.0.0.1:8080')).toEqual(['http://127.0.0.1:8080/*', 'https://127.0.0.1:8080/*']);
    expect(sitePatterns('[::1]:8080')).toEqual(['http://[::1]:8080/*', 'https://[::1]:8080/*']);
    expect(sitePatterns('weibo.com:8443')).toEqual(['http://weibo.com:8443/*', 'https://weibo.com:8443/*']);
  });
});

describe('siteKeyOfPattern：match pattern → 站点 key', () => {
  it('裸域、子域、带协议、带端口都能归到同一个 key', () => {
    expect(siteKeyOfPattern('*://weibo.com/*')).toBe('weibo.com');
    expect(siteKeyOfPattern('*://*.weibo.com/*')).toBe('weibo.com');
    expect(siteKeyOfPattern('https://weibo.com/*')).toBe('weibo.com');
    expect(siteKeyOfPattern('http://s.weibo.com/*')).toBe('weibo.com');
    expect(siteKeyOfPattern('*://127.0.0.1:8080/*')).toBe('127.0.0.1:8080');
    expect(siteKeyOfPattern('http://[::1]:8080/*')).toBe('[::1]:8080');
  });

  it('不是站点模式的输入返回 null', () => {
    expect(siteKeyOfPattern('<all_urls>')).toBeNull();
    expect(siteKeyOfPattern('*://*/*')).toBeNull();
    expect(siteKeyOfPattern('')).toBeNull();
  });
});

describe('isValidSiteKey：存储校验', () => {
  it('规范 key 通过', () => {
    for (const v of ['weibo.com', 'example.com.cn', 'a.github.io', '127.0.0.1', '127.0.0.1:8080', '[::1]:8080', 'localhost', 'intranet']) {
      expect(isValidSiteKey(v)).toBe(true);
    }
  });

  it('带协议、带路径、非规范形态一律不通过', () => {
    for (const v of ['https://weibo.com', 'http://127.0.0.1:8080', 'weibo.com/x', 'WWW.WEIBO.COM', 'www.weibo.com', '', '   ']) {
      expect(isValidSiteKey(v)).toBe(false);
    }
    expect(isValidSiteKey(42)).toBe(false);
    expect(isValidSiteKey(null)).toBe(false);
  });

  it('含 `*` 或不含字母数字的单段值不通过：真实主机名不长这样，放进来会成为幻影站点（#186）', () => {
    // siteKey 对这类输入原样返回（单标签主机名保留），必须在存储校验这里拦下
    for (const v of ['*', '-', '___', 'x*', ':', '[::]']) {
      expect(isValidSiteKey(v), v).toBe(false);
    }
  });
});
