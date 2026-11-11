import { describe, expect, it } from 'vitest';
import { isOriginCovered } from './site-grant';
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

  it('模式带端口只匹配该端口；没写端口只匹配默认端口', () => {
    expect(isOriginCovered('http://127.0.0.1:8080/x', ['http://127.0.0.1:8080/*'])).toBe(true);
    expect(isOriginCovered('http://127.0.0.1:8081/x', ['http://127.0.0.1:8080/*'])).toBe(false);
    expect(isOriginCovered('https://127.0.0.1:8080/x', ['http://127.0.0.1:8080/*'])).toBe(false);
    // 默认端口：URL 解析后 port 为空，`*://host/*` 覆盖
    expect(isOriginCovered('https://weibo.com/x', ['*://weibo.com/*'])).toBe(true);
    // 非默认端口的页面不会被无端口模式覆盖
    expect(isOriginCovered('https://weibo.com:8443/x', ['*://weibo.com/*'])).toBe(false);
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
