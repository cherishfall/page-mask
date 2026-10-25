import { describe, expect, it } from 'vitest';
import { deriveScopePattern, isSupportedPage, normalizeOrigin, urlMatchesPrefix } from './origin';

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
  });
  it('浏览器内部页面拦截并给出人话理由', () => {
    expect(isSupportedPage('chrome://extensions').ok).toBe(false);
    expect(isSupportedPage('chrome://newtab').reason).toContain('内部页面');
    expect(isSupportedPage('about:blank').ok).toBe(false);
    expect(isSupportedPage('devtools://devtools/bundled/devtools_app.html').ok).toBe(false);
  });
  it('本地文件与商店页面拦截', () => {
    expect(isSupportedPage('file:///tmp/a.html').reason).toContain('本地文件');
    expect(isSupportedPage('https://chromewebstore.google.com/detail/x').ok).toBe(false);
  });
});

describe('deriveScopePattern 零输入推导"这类页面"', () => {
  it('去掉最后一段文件名，保留目录前缀', () => {
    const p = deriveScopePattern('https://weread.qq.com/web/reader/a1b2c3');
    expect(p?.prefix).toBe('https://weread.qq.com/web/reader/');
    expect(p?.label).toBe('weread.qq.com 上 /web/reader/ 开头的页面');
  });
  it('首页推导为整站根', () => {
    const p = deriveScopePattern('https://weread.qq.com/');
    expect(p?.prefix).toBe('https://weread.qq.com/');
    expect(p?.label).toBe('weread.qq.com 的首页');
  });
  it('去掉 www 展示', () => {
    const p = deriveScopePattern('https://www.dedao.cn/course/list');
    expect(p?.label).toContain('dedao.cn 上 /course/ 开头的页面');
  });
});

describe('urlMatchesPrefix', () => {
  it('前缀命中', () => {
    expect(urlMatchesPrefix('https://weread.qq.com/web/reader/x', 'https://weread.qq.com/web/reader/')).toBe(true);
    expect(urlMatchesPrefix('https://weread.qq.com/web/shelf', 'https://weread.qq.com/web/reader/')).toBe(false);
  });
});
