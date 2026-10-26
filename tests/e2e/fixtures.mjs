/**
 * E2E 夹具：虚构的阅读站点「Acme 书房」。品牌、书名、文案均为虚构，不含任何真实商标或作品名。
 */
export const FIXTURE_TITLE = 'Acme 书房 · 示例阅读站';

/** 1×1 透明 PNG，作为夹具页面自带的图标 */
const FAVICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export function fixtureHtml(pathname = '/') {
  const isArticle = pathname.startsWith('/article/');
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${FIXTURE_TITLE}</title>
<link rel="icon" href="${FAVICON}">
<style>body{font-family:system-ui,sans-serif;margin:0}header,footer,aside,main{padding:12px 16px}header{background:#eef}aside{background:#ffe}</style>
</head><body>
<header id="site-header" data-testid="site-header"><nav class="top-nav">首页 书架 发现 我的</nav></header>
<main><h1 id="page-title">${isArticle ? '示例章节：第一章' : '今日推荐'}</h1>
<ul id="rec-list"><li class="rec-card">示例书籍 A</li><li class="rec-card">示例书籍 B</li><li class="rec-card">示例书籍 C</li></ul></main>
<aside id="side-promo">限时活动（示例）</aside>
<footer id="site-footer">© Acme 书房（虚构站点，仅供测试）</footer>
</body></html>`;
}

/** 本地服务器请求处理：任意路径返回同一夹具页（标题与 h1 随路径略有不同） */
export function fixtureHandler(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fixtureHtml(pathname));
}
