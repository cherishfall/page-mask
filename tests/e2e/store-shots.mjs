/**
 * 商店截图生成：四张 1280×800 标准尺寸（弹窗、管理页、引导页、向导预览实况）
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const EXT_DIR = path.resolve('.output/chrome-mv3');
const TEST_EXT_DIR = '/tmp/pm-shots-ext';
const OUT = 'docs/store-assets';
const PORT = 8789;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const html = `<!doctype html><html><head><title>微信读书-电子书阅读_微信读书官网</title></head><body>
<header id="site-header" style="background:#f7f7f7;padding:12px 24px;border-bottom:1px solid #eee"><nav style="display:flex;gap:24px;font-size:14px;color:#333"><b>微信读书</b><span>书架</span><span>发现</span><span>想法</span></nav></header>
<main style="max-width:900px;margin:20px auto;padding:0 16px">
<h1 style="font-size:22px">三体（纪念版）</h1>
<p style="color:#666;font-size:14px">刘慈欣 · 科幻 · 9.2 分</p>
<ul id="rec-list" style="list-style:none;padding:0;display:grid;gap:12px">
${['球状闪电', '流浪地球', '超新星纪元'].map((t) => `<li class="rec-card" style="border:1px solid #eee;border-radius:10px;padding:14px"><b>${t}</b><p style="color:#888;font-size:13px;margin:6px 0 0">猜你喜欢：根据阅读偏好推荐</p></li>`).join('')}
</ul></main>
<footer id="site-footer" style="text-align:center;color:#aaa;font-size:12px;padding:20px">© 微信读书</footer>
</body></html>`;

const server = http.createServer((q, r) => {
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(html);
});

fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
fs.rmSync('/tmp/pm-shots-profile', { recursive: true, force: true });
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
  userDataDir: '/tmp/pm-shots-profile',
  args: [`--disable-extensions-except=${TEST_EXT_DIR}`, `--load-extension=${TEST_EXT_DIR}`, '--remote-debugging-port=9337', '--no-first-run', '--window-size=1400,940', '--lang=zh-CN'],
});

try {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const warm = await browser.newPage();
  await warm.goto('about:blank').catch(() => undefined);
  const swT = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 15000 });
  const sw = await swT.worker();
  const extBase = swT.url().replace(/\/[^/]*$/, '');
  await warm.close();

  // 造一个站点配置（演示数据）
  await sw.evaluate(async (o) => {
    await chrome.storage.local.set({
      settings: { defaultTitle: '新建标签页' },
      [`profile:${o}`]: {
        formatVersion: 1, origin: o, switchState: 'disguised', disguisedTitle: null, faviconDataUrl: null,
        floatingBtnPos: null, createdAt: Date.now(), updatedAt: Date.now(),
        hideRules: [{
          id: 'r_demo_1', elementName: '页头', candidates: ['#site-header'],
          strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: Date.now(), lastHealth: 'ok',
        }],
      },
    });
    try {
      await chrome.scripting.registerContentScripts([{ id: `pagemask:${o}`, matches: [`${o}/*`], js: ['content-scripts/content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
    } catch {}
  }, ORIGIN);

  const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });

  // 1. 主截图：清爽模式生效的页面（页头已收起、标题已换、悬浮按钮在）
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1280, height: 800 });
  await p1.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1200));
  await shot(p1, 'screenshot-1-clean-page');
  await p1.close();

  // 2. 向导预览实况（点选推荐卡 → 预览幽灵标记）
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1280, height: 800 });
  await p2.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 800));
  await sw.evaluate(async (o) => {
    const t = (await chrome.tabs.query({ url: `${o}/*` }))[0];
    await chrome.tabs.sendMessage(t.id, { t: 'openWizard', mode: 'addElement' });
  }, ORIGIN);
  await new Promise((r) => setTimeout(r, 600));
  const pt = await p2.evaluate(() => {
    const r = document.querySelector('.rec-card').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p2.mouse.click(pt.x, pt.y);
  await new Promise((r) => setTimeout(r, 350));
  await p2.evaluate(() => {
    document.getElementById('pagemask-wizard-host')?.shadowRoot?.querySelector('[data-testid="pm-wiz-preview"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  await shot(p2, 'screenshot-2-wizard');
  await p2.close();

  // 3. 弹窗（作为扩展页打开放大呈现）
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 1280, height: 800 });
  await p3.goto(`${extBase}/popup.html`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 600));
  await shot(p3, 'screenshot-3-popup');
  await p3.close();

  // 4. 管理页
  const p4 = await browser.newPage();
  await p4.setViewport({ width: 1280, height: 800 });
  await p4.goto(`${extBase}/management.html`, { waitUntil: 'load' });
  await p4.waitForSelector('.site', { timeout: 5000 });
  await shot(p4, 'screenshot-4-management');
  await p4.close();

  console.log('4 张商店截图完成');
} finally {
  await browser.close().catch(() => undefined);
  server.close();
}
