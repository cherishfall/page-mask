/**
 * 扩展重载后的孤儿样式接管（#213）：胶囊隐藏的站点（capsuleHidden）没有任何页面 UI，
 * 宿主保护样式不在场，旧探测信号恒为假——重载后旧实例插在文档里的用户样式表无人认领，
 * 用户改配置（删规则 / 关灰度）页面不变样，直到手动刷新。
 *
 * 路径：真 chrome.runtime.reload() → onInstalled → reinjectOpenTabs executeScript 进原文档，
 * 新实例无条件请后台 releaseOrphanCss（同文本 removeCSS），随后改配置当场生效。
 *
 * 运行：npm run build && node tests/e2e/check-orphan-css.mjs
 */
import { createReporter, poll, startServer, waitFor } from './lib/harness.mjs';
import { evalInContentWorld, launchExtension, patchProfile, reloadExtension, sendToBackground, setProfile, tabIdOf } from './lib/extension.mjs';

const r = createReporter();
const { check } = r;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>orphan</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}
#site-header{padding:16px;background:#eef}</style></head><body>
<header id="site-header">页头导航（示例）</header><main><p>正文</p></main></body></html>`;

const now = Date.now();
const rule = (id, name, sel) => ({
  id, elementName: name, candidates: [sel], strategy: 'remove',
  scope: { type: 'all' }, onlyThis: false, createdAt: now, lastHealth: 'ok',
});
const baseProfile = (overrides = {}) => ({
  formatVersion: 1,
  origin: '',
  switchState: 'disguised',
  disguisedTitle: null,
  icon: { kind: 'none' },
  hideRules: [rule('r_header', '页头导航', '#site-header')],
  capsuleHidden: true, // 关键前提：没有任何页面 UI，旧探测信号（宿主保护样式）不存在
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

async function main() {
  const srv = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  });
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
  try {
    const page = await ext.browser.newPage();
    page.on('console', (m) => {
      if (m.text().includes('[pm-debug]')) console.log('[page]', m.text());
    });
    await setProfile(ext.control, ORIGIN, baseProfile({ origin: ORIGIN }));
    await page.setViewport({ width: 1000, height: 700 });
    await page.goto(ORIGIN, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    await waitFor(page, '收起规则生效', () => getComputedStyle(document.getElementById('site-header')).display === 'none', [], { timeout: 10000 });
    check(true, '初始：收起规则生效，页面无胶囊（capsuleHidden）');
    check(!(await page.$('pagemask-toggle')), '对照：胶囊确实没挂');

    // ---------- 真重载：旧实例样式成为孤儿 ----------
    console.log('\n--- chrome.runtime.reload() → reinjectOpenTabs ---');
    await reloadExtension(ext);
    // alive 检查用 Node 侧 poll：waitFor 的断言在浏览器里跑，闭包引用 Node 函数（evalInContentWorld）取不到
    await poll(
      async () => evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive?.() === true').catch(() => false),
      '新实例注入（隔离环境 alive）',
      { timeout: 20000 },
    );
    check(true, '重载后新实例接管原文档');
    await waitFor(page, '规则仍然生效（孤儿文本已由新实例重插）',
      () => getComputedStyle(document.getElementById('site-header')).display === 'none', [], { timeout: 10000 });
    check(true, '重载后收起规则照常生效（新旧文本一致，删一份留一份）');

    // ---------- 改配置：不刷新页面必须当场还原 ----------
    await patchProfile(ext.control, ORIGIN, { hideRules: [] });
    await waitFor(page, '删规则后页头还原（不刷新）',
      () => getComputedStyle(document.getElementById('site-header')).display !== 'none', [], { timeout: 10000 });
    check(true, '删规则后页头当场还原（孤儿样式被接管撤掉，#213 主场景）');

    // ---------- 灰度同理 ----------
    console.log('\n--- 灰度同路径 ---');
    await patchProfile(ext.control, ORIGIN, { mediaGray: true });
    await waitFor(page, '整页变灰生效',
      () => (getComputedStyle(document.body).filter + getComputedStyle(document.documentElement).filter).includes('grayscale'), [], { timeout: 10000 });
    await reloadExtension(ext);
    await poll(
      async () => evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive?.() === true').catch(() => false),
      '新实例注入',
      { timeout: 20000 },
    );
    await waitFor(page, '重载后灰度照常生效',
      () => (getComputedStyle(document.body).filter + getComputedStyle(document.documentElement).filter).includes('grayscale'), [], { timeout: 10000 });
    await patchProfile(ext.control, ORIGIN, { mediaGray: false });
    await waitFor(page, '关灰度后颜色还原（不刷新）',
      () => !(getComputedStyle(document.body).filter + getComputedStyle(document.documentElement).filter).includes('grayscale'), [], { timeout: 10000 });
    check(true, '重载后关灰度当场还原（灰度孤儿同路径）');
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.browser.close().catch(() => undefined);
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
