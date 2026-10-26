import { describe, expect, it } from 'vitest';
import {
  deriveScopePattern,
  displayHost,
  isHashRouted,
  isSupportedPage,
  normalizeOrigin,
  scopeUnavailableHint,
  urlMatchesPattern,
  urlMatchesPrefix,
} from './origin';

describe('normalizeOrigin', () => {
  it('提取标准 https 站点', () => {
    expect(normalizeOrigin('https://weread.qq.com/web/reader/abc')).toBe('https://weread.qq.com');
  });
  it('忽略默认端口', () => {
    expect(normalizeOrigin('https://a.com:443/x')).toBe('https://a.com');
    expect(normalizeOrigin('http://a.com:80/x')).toBe('http://a.com');
  });
  it('保留非默认端口', () => {
    expect(normalizeOrigin('http://localhost:3000/app')).toBe('http://localhost:3000');
  });
  it('非 http(s) 协议返回 null', () => {
    expect(normalizeOrigin('chrome://extensions')).toBeNull();
    expect(normalizeOrigin('file:///Users/x/y.html')).toBeNull();
    expect(normalizeOrigin('not a url')).toBeNull();
  });
});

describe('isSupportedPage', () => {
  it('普通网页支持', () => {
    expect(isSupportedPage('https://weread.qq.com/')).toEqual({ ok: true });
    expect(isSupportedPage('http://example.com:8080/')).toEqual({ ok: true });
    expect(isSupportedPage('https://chrome.google.com/search')).toEqual({ ok: true });
  });
  it('浏览器内部页面拦截并给出清爽话术', () => {
    expect(isSupportedPage('chrome://extensions').ok).toBe(false);
    expect(isSupportedPage('chrome://newtab').reason).toBe('浏览器内部页面无法使用清爽模式');
    expect(isSupportedPage('about:blank').ok).toBe(false);
    expect(isSupportedPage('devtools://devtools/bundled/devtools_app.html').ok).toBe(false);
  });
  it('本地文件与商店页面拦截（含旧商店域名）', () => {
    expect(isSupportedPage('file:///tmp/a.html').reason).toContain('本地文件');
    expect(isSupportedPage('https://chromewebstore.google.com/detail/x').ok).toBe(false);
    expect(isSupportedPage('https://chrome.google.com/webstore/detail/x').reason).toContain('应用商店');
    expect(isSupportedPage('https://chrome.google.com/webstore').ok).toBe(false);
  });
  it('所有不支持理由都用清爽话术', () => {
    for (const u of ['chrome://x', 'file:///a', 'https://chromewebstore.google.com/', 'ftp://a.com/', 'nonsense']) {
      expect(isSupportedPage(u).reason).not.toContain('伪装');
    }
  });
});

describe('deriveScopePattern 零输入推导"这类页面"', () => {
  it('多级路径：去掉最后一段，保留目录', () => {
    const p = deriveScopePattern('https://weread.qq.com/web/reader/a1b2c3');
    expect(p).toEqual({ label: 'weread.qq.com 上 /web/reader 下的页面', prefix: 'https://weread.qq.com/web/reader' });
  });
  it('目录形式（尾部斜杠）等价于不带斜杠', () => {
    expect(deriveScopePattern('https://weread.qq.com/web/reader/')?.prefix).toBe('https://weread.qq.com/web/reader');
  });
  it('一级路径保留完整路径，不退化成整站', () => {
    const p = deriveScopePattern('https://weread.qq.com/web');
    expect(p).toEqual({ label: 'weread.qq.com 上 /web 下的页面', prefix: 'https://weread.qq.com/web' });
    expect(deriveScopePattern('https://weread.qq.com/web/')?.prefix).toBe('https://weread.qq.com/web');
  });
  it('根路径推导为"只有首页"的精确匹配，而不是整站前缀', () => {
    const p = deriveScopePattern('https://weread.qq.com/?from=nav');
    expect(p).toEqual({ label: 'weread.qq.com 的首页', prefix: 'https://weread.qq.com/', match: 'exact' });
    expect(urlMatchesPattern('https://weread.qq.com/', p!)).toBe(true);
    expect(urlMatchesPattern('https://weread.qq.com/?x=1#top', p!)).toBe(true);
    expect(urlMatchesPattern('https://weread.qq.com/web/shelf', p!)).toBe(false);
  });
  it('hash 路由站点不提供"这类页面"，并给出提示', () => {
    expect(isHashRouted('https://x.com/#/reader/1')).toBe(true);
    expect(isHashRouted('https://x.com/#!/reader/1')).toBe(true);
    expect(isHashRouted('https://x.com/#top')).toBe(false);
    expect(isHashRouted('https://x.com/app/#/reader')).toBe(false);
    expect(deriveScopePattern('https://x.com/#/reader/1')).toBeNull();
    expect(scopeUnavailableHint('https://x.com/#/reader/1')).toBe('这个网站用 # 区分页面，暂时只能按整站生效');
    expect(scopeUnavailableHint('https://x.com/web/a')).toBeNull();
  });
  it('普通锚点 # 不算 hash 路由：根路径仍是首页', () => {
    expect(deriveScopePattern('https://x.com/#top')?.match).toBe('exact');
  });
  it('去掉 www 展示', () => {
    const p = deriveScopePattern('https://www.dedao.cn/course/list');
    expect(p?.label).toBe('dedao.cn 上 /course 下的页面');
  });
  it('中文路径：标签显示解码后的路径，前缀保持编码形式', () => {
    const p = deriveScopePattern('https://example.com/%E4%B9%A6%E6%9E%B6/%E5%88%97%E8%A1%A8');
    expect(p?.label).toBe('example.com 上 /书架 下的页面');
    expect(p?.prefix).toBe('https://example.com/%E4%B9%A6%E6%9E%B6');
    expect(urlMatchesPattern('https://example.com/%E4%B9%A6%E6%9E%B6/abc', p!)).toBe(true);
    // 没编码的写法（如手动粘贴）也能命中
    expect(urlMatchesPattern('https://example.com/书架/abc', p!)).toBe(true);
    expect(urlMatchesPattern('https://example.com/书架集/abc', p!)).toBe(false);
  });
  it('国际化域名标签显示 Unicode 主机名', () => {
    const p = deriveScopePattern('https://xn--fiq228c.com/a/b');
    expect(p?.label).toBe('中文.com 上 /a 下的页面');
  });
});

describe('displayHost', () => {
  // 期望值取自 Node 的 url.domainToUnicode（独立实现）
  it.each([
    ['xn--fiq228c.com', '中文.com'],
    ['www.xn--55qx5d.cn', '公司.cn'],
    ['weread.qq.com', 'weread.qq.com'],
    ['xn--bcher-kva.example', 'bücher.example'],
  ])('%s → %s', (host, expected) => {
    expect(displayHost(host)).toBe(expected);
  });
  it('畸形 punycode 原样返回', () => {
    expect(displayHost('xn--.com')).toBe('xn--.com');
  });
});

describe('前缀匹配带边界', () => {
  const p = 'https://weread.qq.com/web';
  it.each([
    ['https://weread.qq.com/web', true],
    ['https://weread.qq.com/web/', true],
    ['https://weread.qq.com/web?x=1', true],
    ['https://weread.qq.com/web#a', true],
    ['https://weread.qq.com/web/a', true],
    ['https://weread.qq.com/website', false],
    ['https://weread.qq.com/we', false],
    ['https://weread.qq.com:8443/web', false],
  ])('/web vs %s → %s', (url, expected) => {
    expect(urlMatchesPrefix(url, p)).toBe(expected);
  });
  it('旧数据：带尾部斜杠的前缀照常匹配', () => {
    expect(urlMatchesPrefix('https://weread.qq.com/web/reader/x', 'https://weread.qq.com/web/reader/')).toBe(true);
    expect(urlMatchesPrefix('https://weread.qq.com/web/shelf', 'https://weread.qq.com/web/reader/')).toBe(false);
  });
});
