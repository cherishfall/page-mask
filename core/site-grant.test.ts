import { describe, expect, it } from 'vitest';
import { grantedPatternsOfSite, isOriginCovered, isSiteGranted } from './site-grant';
import { sitePatterns } from './site-key';

describe('isOriginCovered：当前页面是否被这批模式覆盖', () => {
  it('`*` 方案覆盖 http 与 https，具体方案只覆盖自己', () => {
    expect(isOriginCovered('https://weibo.com/home', ['*://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('http://weibo.com/home', ['*://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('https://weibo.com/home', ['https://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('http://weibo.com/home', ['https://weibo.com/*'])).toBe(false);
    expect(isOriginCovered('https://weibo.com/home', ['http://weibo.com/*'])).toBe(false);
  });

  it('`*.` 前缀覆盖子域，不覆盖裸域，也不覆盖形似的别家域名', () => {
    const sub = ['*://*.weibo.com/*'];
    expect(isOriginCovered('https://s.weibo.com/hot', sub)).toBe(true);
    expect(isOriginCovered('https://a.b.weibo.com/', sub)).toBe(true);
    expect(isOriginCovered('https://weibo.com/', sub)).toBe(false);
    expect(isOriginCovered('https://notweibo.com/', sub)).toBe(false);
    expect(isOriginCovered('https://weibo.com.evil.test/', sub)).toBe(false);
  });

  it('精确主机只覆盖自己，不覆盖子域', () => {
    expect(isOriginCovered('https://weibo.com/x', ['*://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('https://s.weibo.com/x', ['*://weibo.com/*'])).toBe(false);
  });

  it('模式没写端口按 Chrome 口径通配所有端口（官方：match all ports unless an explicit port）', () => {
    // 默认端口的页面照常命中
    expect(isOriginCovered('https://weibo.com/x', ['*://weibo.com/*'])).toBe(true);
    // #185 核心回归：无端口模式 × 非默认端口页面 = 命中（此前误判 false，弹窗死循环误导）
    expect(isOriginCovered('https://weibo.com:8443/x', ['*://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('https://weibo.com:8443/x', ['https://weibo.com/*'])).toBe(true);
    expect(isOriginCovered('http://localhost:3000/x', ['http://localhost/*'])).toBe(true);
    // 全站通配授权（主机 `*`、无端口）覆盖任意端口的页面
    expect(isOriginCovered('https://a.b.example:9090/', ['*://*/*'])).toBe(true);
    // IPv6 字面量同样按通配端口处理
    expect(isOriginCovered('https://[::1]/x', ['*://[::1]/*'])).toBe(true);
    expect(isOriginCovered('https://[::1]:8080/x', ['*://[::1]/*'])).toBe(true);
  });

  it('模式写了端口只匹配该端口（页面对比用有效端口：没写端口按方案默认值算）', () => {
    expect(isOriginCovered('http://127.0.0.1:8080/x', ['http://127.0.0.1:8080/*'])).toBe(true);
    expect(isOriginCovered('http://127.0.0.1:8081/x', ['http://127.0.0.1:8080/*'])).toBe(false);
    expect(isOriginCovered('https://127.0.0.1:8080/x', ['http://127.0.0.1:8080/*'])).toBe(false);
    expect(isOriginCovered('https://weibo.com/x', ['https://weibo.com:8443/*'])).toBe(false);
    // 页面没写端口时有效端口是方案默认值：https 页面被显式 :443 模式覆盖（EffectiveIntPort 口径）
    expect(isOriginCovered('https://weibo.com/x', ['https://weibo.com:443/*'])).toBe(true);
    expect(isOriginCovered('https://weibo.com/x', ['https://weibo.com:80/*'])).toBe(false);
    expect(isOriginCovered('https://weibo.com:8443/x', ['https://weibo.com:8443/*'])).toBe(true);
  });

  it('路径按 `*` 通配做前缀匹配（项目默认 /*，但不假设）', () => {
    expect(isOriginCovered('https://example.com/docs/a', ['https://example.com/docs/*'])).toBe(true);
    expect(isOriginCovered('https://example.com/docs', ['https://example.com/docs/*'])).toBe(false);
    expect(isOriginCovered('https://example.com/blog/a', ['https://example.com/docs/*'])).toBe(false);
    expect(isOriginCovered('https://example.com/', ['https://example.com/*'])).toBe(true);
    // 边界：`/docs/*` 不命中 `/docs`，`/docs` 前缀也不吃掉 `/docsx`
    expect(isOriginCovered('https://example.com/docsx/a', ['https://example.com/docs/*'])).toBe(false);
    expect(isOriginCovered('https://example.com/docs/a?q=1', ['https://example.com/docs/*'])).toBe(true);
  });

  it('与 sitePatterns 配合：裸域与子域都被「裸域 + 子域」两条覆盖', () => {
    const patterns = sitePatterns('weibo.com');
    expect(isOriginCovered('https://weibo.com/', patterns)).toBe(true);
    expect(isOriginCovered('https://s.weibo.com/', patterns)).toBe(true);
    // 迁移用户手里只有旧的 https 精确模式：子域不在覆盖内，弹窗要提示「这个页面还没允许访问」
    expect(isOriginCovered('https://s.weibo.com/', ['https://weibo.com/*'])).toBe(false);
    expect(isOriginCovered('https://weibo.com/', ['https://weibo.com/*'])).toBe(true);
  });

  it('无法解析 / 非 http(s) / 空列表一律 false', () => {
    expect(isOriginCovered('chrome://settings', ['*://*/*'])).toBe(false);
    expect(isOriginCovered('file:///tmp/x.html', ['*://*/*'])).toBe(false);
    expect(isOriginCovered('not a url', ['*://*/*'])).toBe(false);
    expect(isOriginCovered('', ['*://*/*'])).toBe(false);
    expect(isOriginCovered('https://weibo.com/', [])).toBe(false);
    expect(isOriginCovered('https://weibo.com/', ['<all_urls>'])).toBe(false);
  });

  it('`*://*/*` 覆盖任意 http(s) 页面；`*` 主机也支持子域写法', () => {
    expect(isOriginCovered('https://a.b.example/x', ['*://*/*'])).toBe(true);
    expect(isOriginCovered('http://127.0.0.1:3000/', ['*://*/*'])).toBe(true);
    expect(isOriginCovered('https://[::1]:8080/x', ['https://[::1]:8080/*'])).toBe(true);
  });
});

describe('grantedPatternsOfSite：全站通配授权的 contains 兜底（#177 补盲区）', () => {
  /** contains 替身：只认 canonical 两条，精确匹配（此前测试里的 stub 是精确匹配，兜底永远走不到） */
  const browserWithWildcard = (canonical: string[]) => ({
    permissions: {
      getAll: async () => ({ origins: ['*://*/*'] }),
      contains: async (p: { origins: string[] }) => p.origins.every((o) => canonical.includes(o)),
    },
  });

  it('getAll 里只有全站通配时：按本站点的两条模式问 contains，命中即返回这两条', async () => {
    const canonical = sitePatterns('weibo.com');
    const browser = browserWithWildcard(canonical);
    expect(await grantedPatternsOfSite(browser, 'weibo.com')).toEqual(canonical);
    expect(await isSiteGranted(browser, 'weibo.com')).toBe(true);
  });

  it('contains 不认（非法站点 key 等异常路径）返回空——当作没授权', async () => {
    const browser = {
      permissions: {
        getAll: async () => ({ origins: ['*://*/*'] }),
        contains: async () => {
          throw new Error('Invalid site key');
        },
      },
    };
    expect(await grantedPatternsOfSite(browser, 'weibo.com')).toEqual([]);
    expect(await isSiteGranted(browser, 'weibo.com')).toBe(false);
  });
});
