/**
 * 商店素材补拍：弹窗展示图（居中放大）+ 440×280 宣传图块
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const EXT_DIR = path.resolve('.output/chrome-mv3');
const TEST_EXT_DIR = '/tmp/pm-shots2-ext';
const OUT = 'docs/store-assets';
const PORT = 8790;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const html = `<!doctype html><html><head><title>微信读书-电子书阅读</title></head><body>
<header id="site-header" style="background:#f7f7f7;padding:12px 24px;border-bottom:1px solid #eee"><nav style="display:flex;gap:24px;font-size:14px;color:#333"><b>微信读书</b><span>书架</span><span>发现</span><span>想法</span></nav></header>
<main style="max-width:900px;margin:20px auto;padding:0 16px"><h1 style="font-size:22px">三体（纪念版）</h1><p style="color:#666;font-size:14px">刘慈欣 · 科幻 · 9.2 分</p></main>
<footer style="text-align:center;color:#aaa;font-size:12px;padding:20px">© 微信读书</footer></body></html>`;

const server = http.createServer((q, r) => {
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(html);
});

fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
fs.rmSync('/tmp/pm-shots2-profile', { recursive: true, force: true });
fs.cpSync(EXT_DIR, TEST_EXT_DIR, { recursive: true });
{
  const mp = path.join(TEST_EXT_DIR, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.host_permissions = [`${ORIGIN}/*`];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: '/tmp/pm-shots2-profile',
  args: [`--disable-extensions-except=${TEST_EXT_DIR}`, `--load-extension=${TEST_EXT_DIR}`, '--remote-debugging-port=9338', '--no-first-run', '--window-size=1400,940', '--lang=zh-CN'],
});

try {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const warm = await browser.newPage();
  await warm.goto('about:blank').catch(() => undefined);
  const swT = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 15000 });
  const sw = await swT.worker();
  const extBase = swT.url().replace(/\/[^/]*$/, '');
  await warm.close();

  await sw.evaluate(async (o) => {
    await chrome.storage.local.set({
      settings: { defaultTitle: '新建标签页' },
      [`profile:${o}`]: {
        formatVersion: 1, origin: o, switchState: 'disguised', disguisedTitle: null, faviconDataUrl: null,
        floatingBtnPos: null, createdAt: Date.now(), updatedAt: Date.now(),
        hideRules: [
          { id: 'r1', elementName: '页头', candidates: ['#site-header'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: Date.now(), lastHealth: 'ok' },
          { id: 'r2', elementName: '页脚', candidates: ['#site-footer'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: Date.now(), lastHealth: 'ok' },
        ],
      },
    });
    try {
      await chrome.scripting.registerContentScripts([{ id: `pagemask:${o}`, matches: [`${o}/*`], js: ['content-scripts/content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
    } catch {}
  }, ORIGIN);

  // 弹窗展示图：popup 作为页面打开，注入样式居中放大
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(`${extBase}/popup.html`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 500));
  await p.addStyleTag({
    content: `
      body { display: flex; align-items: center; justify-content: center; height: 100vh;
             margin: 0; background: linear-gradient(135deg, #eef3fb 0%, #e2ecf9 60%, #dce8f8 100%); }
      .popup { transform: scale(2); transform-origin: center center;
               box-shadow: 0 12px 48px rgba(37, 99, 235, 0.18); border-radius: 16px;
               background: #fff; padding: 12px; }
    `,
  });
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: `${OUT}/screenshot-3-popup.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await p.close();

  // 管理页（与弹窗同一份种子数据）
  const pm = await browser.newPage();
  await pm.setViewport({ width: 1280, height: 800 });
  await pm.goto(`${extBase}/management.html`, { waitUntil: 'load' });
  await pm.waitForSelector('.site', { timeout: 5000 });
  await pm.screenshot({ path: `${OUT}/screenshot-4-management.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await pm.close();

  // 440×280 宣传图块：品牌 + 一句话 + 微缩效果演示
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
    </div></body></html>`);
  await new Promise((r) => setTimeout(r, 300));
  await p2.screenshot({ path: `${OUT}/promo-tile-440x280.png`, clip: { x: 0, y: 0, width: 440, height: 280 } });
  await p2.close();

  console.log('popup 展示图 + 宣传图块 + 管理页完成');
} finally {
  await browser.close().catch(() => undefined);
  server.close();
}
