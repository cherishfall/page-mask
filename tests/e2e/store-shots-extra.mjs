/**
 * 商店素材草稿补拍：弹窗展示图（居中放大）+ 管理页 + 440×280 宣传图块。
 * 输出到 test-results/store-shots/（已忽略），不进 test:e2e；正式素材由 #29 重做。
 * 运行：npm run build && node tests/e2e/store-shots-extra.mjs
 */
import path from 'node:path';
import { resultsDir, startServer } from './lib/harness.mjs';
import { launchExtension, setProfile } from './lib/extension.mjs';

const OUT = resultsDir('store-shots');

const srv = await startServer((q, r) => {
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end('<!doctype html><meta charset="utf-8"><title>Acme 书房 · 示例阅读站</title><h1>示例书籍</h1>');
});
const ORIGIN = srv.origin;
const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
const { browser, control } = ext;
const clip = (w, h) => ({ x: 0, y: 0, width: w, height: h });

try {
  const now = Date.now();
  await control.evaluate((s) => chrome.storage.local.set({ settings: s }), { defaultTitle: '新建标签页' });
  await setProfile(control, ORIGIN, {
    formatVersion: 1, origin: ORIGIN, switchState: 'disguised', disguisedTitle: null, faviconDataUrl: null,
    floatingBtnPos: null, createdAt: now, updatedAt: now,
    hideRules: [
      { id: 'r1', elementName: '页头', candidates: ['#site-header'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: now, lastHealth: 'ok' },
      { id: 'r2', elementName: '页脚', candidates: ['#site-footer'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: now, lastHealth: 'ok' },
    ],
  });

  // 弹窗展示图：popup 作为页面打开，注入样式居中放大
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(`${ext.extOrigin}/popup.html`, { waitUntil: 'networkidle0' });
  await p.waitForSelector('.popup', { timeout: 5000 });
  await p.addStyleTag({
    content: `
      body { display: flex; align-items: center; justify-content: center; height: 100vh;
             margin: 0; background: linear-gradient(135deg, #eef3fb 0%, #e2ecf9 60%, #dce8f8 100%); }
      .popup { transform: scale(2); transform-origin: center center;
               box-shadow: 0 12px 48px rgba(37, 99, 235, 0.18); border-radius: 16px;
               background: #fff; padding: 12px; }
    `,
  });
  await p.screenshot({ path: path.join(OUT, 'screenshot-3-popup.png'), clip: clip(1280, 800) });
  await p.close();

  // 管理页（与弹窗同一份种子数据）
  const pm = await browser.newPage();
  await pm.setViewport({ width: 1280, height: 800 });
  await pm.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
  await pm.waitForSelector('.site', { timeout: 5000 });
  await pm.screenshot({ path: path.join(OUT, 'screenshot-4-management.png'), clip: clip(1280, 800) });
  await pm.close();

  // 440×280 宣传图块：品牌 + 一句话
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 440, height: 280 });
  await p2.setContent(`<!doctype html><html><body style="margin:0;font-family:system-ui,'PingFang SC',sans-serif">
    <div style="width:440px;height:280px;box-sizing:border-box;background:linear-gradient(135deg,#4E9AF1,#2563EB);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:44px;height:44px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:24px">📄</div>
        <div style="color:#fff;font-size:30px;font-weight:700;letter-spacing:1px">PageMask</div>
      </div>
      <div style="color:#fff;font-size:16px;opacity:.95">页面清爽模式 · 专注阅读</div>
      <div style="display:flex;gap:8px;margin-top:2px">
        <span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:4px 10px;border-radius:999px">点选收起干扰</span>
        <span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:4px 10px;border-radius:999px">标签页定制</span>
        <span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:4px 10px;border-radius:999px">完全本地</span>
      </div>
    </div></body></html>`, { waitUntil: 'load' });
  await p2.screenshot({ path: path.join(OUT, 'promo-tile-440x280.png'), clip: clip(440, 280) });
  await p2.close();

  console.log(`popup 展示图 + 管理页 + 宣传图块完成 → ${path.relative(process.cwd(), OUT)}/`);
} finally {
  await ext.cleanup();
  await srv.close();
}
