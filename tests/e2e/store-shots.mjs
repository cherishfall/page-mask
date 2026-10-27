/**
 * 商店截图草稿：四张 1280×800（清爽页面、向导预览、弹窗、管理页）。
 * 输出到 test-results/store-shots/（已忽略），不进 test:e2e；正式商店素材由 #29 重做后再入库。
 * 运行：npm run build && node tests/e2e/store-shots.mjs
 */
import path from 'node:path';
import { resultsDir, startServer, waitFor } from './lib/harness.mjs';
import { launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const OUT = resultsDir('store-shots');

// 虚构站点「Acme 书房」，书名均为占位
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Acme 书房 · 示例阅读站</title></head><body style="margin:0;font-family:system-ui,'PingFang SC',sans-serif">
<header id="site-header" style="background:#f7f7f7;padding:12px 24px;border-bottom:1px solid #eee"><nav style="display:flex;gap:24px;font-size:14px;color:#333"><b>Acme 书房</b><span>书架</span><span>发现</span><span>想法</span></nav></header>
<main style="max-width:900px;margin:20px auto;padding:0 16px">
<h1 style="font-size:22px">示例书籍：星海旅人</h1>
<p style="color:#666;font-size:14px">示例作者 · 虚构类 · 示例评分</p>
<ul id="rec-list" style="list-style:none;padding:0;display:grid;gap:12px">
${['示例书籍 A', '示例书籍 B', '示例书籍 C'].map((t) => `<li class="rec-card" style="border:1px solid #eee;border-radius:10px;padding:14px"><b>${t}</b><p style="color:#888;font-size:13px;margin:6px 0 0">猜你喜欢：根据阅读偏好推荐</p></li>`).join('')}
</ul></main>
<footer id="site-footer" style="text-align:center;color:#aaa;font-size:12px;padding:20px">© Acme 书房（虚构站点）</footer>
</body></html>`;

const srv = await startServer((q, r) => {
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(html);
});
const ORIGIN = srv.origin;
const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
const { browser, control } = ext;
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 800 } });

try {
  const now = Date.now();
  await control.evaluate((s) => chrome.storage.local.set({ settings: s }), { defaultTitle: '阅读' });
  await setProfile(control, ORIGIN, {
    formatVersion: 1, origin: ORIGIN, switchState: 'disguised', disguisedTitle: null, faviconDataUrl: null,
    floatingBtnPos: null, createdAt: now, updatedAt: now,
    hideRules: [{ id: 'r_demo_1', elementName: '页头', candidates: ['#site-header'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: now, lastHealth: 'ok' }],
  });

  // 1. 清爽模式生效的页面
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1280, height: 800 });
  await p1.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(control, `${ORIGIN}/*`) });
  await p1.waitForSelector('#pagemask-floating-host');
  await waitFor(p1, '页头被移除', () => getComputedStyle(document.getElementById('site-header')).display === 'none');
  await shot(p1, 'screenshot-1-clean-page');

  // 2. 向导预览（点选推荐卡 → 预览幽灵标记）
  await sendToTab(control, await tabIdOf(control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
  await waitForShadow(p1, '#pagemask-wizard-host', '[data-testid="pm-wizard-toolbar"]');
  const pt = await p1.evaluate(() => {
    const rc = document.querySelector('.rec-card').getBoundingClientRect();
    return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 };
  });
  await p1.mouse.click(pt.x, pt.y);
  await clickInShadow(p1, '#pagemask-wizard-host', '[data-testid="pm-wiz-preview"]');
  await waitForShadow(p1, '#pagemask-wizard-host', '[data-testid="pm-marker-1"]');
  await shot(p1, 'screenshot-2-wizard');
  await p1.close();

  // 3. 弹窗（作为扩展页打开）
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 1280, height: 800 });
  await p3.goto(`${ext.extOrigin}/popup.html`, { waitUntil: 'networkidle0' });
  await shot(p3, 'screenshot-3-popup');
  await p3.close();

  // 4. 管理页
  const p4 = await browser.newPage();
  await p4.setViewport({ width: 1280, height: 800 });
  await p4.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
  await p4.waitForSelector('.site', { timeout: 5000 });
  await shot(p4, 'screenshot-4-management');
  await p4.close();

  console.log(`4 张截图完成 → ${path.relative(process.cwd(), OUT)}/`);
} finally {
  await ext.cleanup();
  await srv.close();
}
