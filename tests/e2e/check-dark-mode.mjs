/**
 * 设计 tokens 深浅色实测（#33）：加载构建后的扩展，分别模拟系统浅色 / 深色，
 * 读取「popup 页面」和「页内悬浮按钮 shadow root」里实际计算出的颜色。
 *
 * 测试页带 `Content-Security-Policy: style-src 'none'`，并放一段会被 CSP 拦掉的页面内联样式
 * 作为对照，用来证明：在最严格的 style-src 下，adoptedStyleSheets 注入的 tokens 依然生效。
 *
 * 运行：npm run build && node tests/e2e/check-dark-mode.mjs
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = fs.existsSync('/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
  ? '/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXT_DIR = path.resolve('.output/chrome-mv3');
const PORT = 8788;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PROFILE_DIR = '/tmp/pm-dark-profile';
const TEST_EXT_DIR = '/tmp/pm-dark-ext';

// 期望值：与 styles/tokens.css 的原始色值一致
const EXPECT = {
  light: { fg: 'rgb(31, 35, 41)', bg: 'rgb(255, 255, 255)' },
  dark: { fg: 'rgb(229, 231, 235)', bg: 'rgb(31, 35, 41)' },
};

const html = `<!doctype html><html><head><title>dark-mode check</title>
<style>body{background:rgb(255,0,0)}</style>
</head><body><main><h1>测试页</h1></main></body></html>`;
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "style-src 'none'",
  });
  res.end(html);
});

let failed = false;
function check(cond, msg) {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
  fs.cpSync(EXT_DIR, TEST_EXT_DIR, { recursive: true });
  const manifestPath = path.join(TEST_EXT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = [`${ORIGIN}/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [`--disable-extensions-except=${TEST_EXT_DIR}`, `--load-extension=${TEST_EXT_DIR}`, '--no-first-run'],
  });
  try {
    const warmup = await browser.newPage();
    await warmup.goto('about:blank').catch(() => undefined);
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 15000 },
    );
    const sw = await swTarget.worker();
    const extOrigin = swTarget.url().replace(/\/[^/]*$/, '');
    await warmup.close().catch(() => undefined);

    await sw.evaluate(async (origin) => {
      const now = Date.now();
      await chrome.storage.local.set({
        [`profile:${origin}`]: {
          formatVersion: 1,
          origin,
          switchState: 'original',
          disguisedTitle: null,
          faviconDataUrl: null,
          hideRules: [],
          floatingBtnPos: null,
          createdAt: now,
          updatedAt: now,
        },
        settings: { defaultTitle: '新建标签页' },
      });
      await chrome.scripting.registerContentScripts([
        { id: `pagemask:${origin}`, matches: [`${origin}/*`], js: ['content-scripts/content.js'], runAt: 'document_idle' },
      ]);
    }, ORIGIN);

    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#pagemask-floating-host', { timeout: 8000 });

    const popup = await browser.newPage();
    await popup.goto(`${extOrigin}/popup.html`, { waitUntil: 'networkidle0' });

    for (const scheme of ['light', 'dark']) {
      console.log(`\n[prefers-color-scheme: ${scheme}]`);
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);

      const shadow = await page.evaluate(() => {
        const host = document.getElementById('pagemask-floating-host');
        const root = host.shadowRoot;
        const mount = root.firstElementChild;
        const cs = getComputedStyle(mount);
        return {
          adopted: root.adoptedStyleSheets.length,
          styleEls: root.querySelectorAll('style').length,
          hostColorScheme: getComputedStyle(host).colorScheme,
          color: cs.color,
          lineHeight: cs.lineHeight,
          fontSize: cs.fontSize,
          pageBodyBg: getComputedStyle(document.body).backgroundColor,
        };
      });
      console.log('  shadow:', JSON.stringify(shadow));
      check(shadow.pageBodyBg !== 'rgb(255, 0, 0)', '对照：页面自身的内联 <style> 被 CSP 拦截（CSP 确实生效）');
      check(shadow.adopted === 1 && shadow.styleEls === 0, 'shadow 样式经 adoptedStyleSheets 注入');
      check(shadow.color === EXPECT[scheme].fg, `shadow 内前景色 = --pm-fg（${shadow.color}）`);

      const pop = await popup.evaluate(() => {
        const b = getComputedStyle(document.body);
        const btn = document.querySelector('.primary, .ghost');
        return {
          bodyBg: b.backgroundColor,
          bodyColor: b.color,
          fontSize: b.fontSize,
          button: btn ? `${btn.className}: color ${getComputedStyle(btn).color}, bg ${getComputedStyle(btn).backgroundColor}` : null,
        };
      });
      console.log('  popup:', JSON.stringify(pop));
      check(pop.bodyBg === EXPECT[scheme].bg, `popup 背景 = --pm-bg（${pop.bodyBg}）`);
      check(pop.bodyColor === EXPECT[scheme].fg, `popup 前景 = --pm-fg（${pop.bodyColor}）`);
    }
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
  }
  if (failed) {
    console.error('\n深浅色实测未通过');
    process.exit(1);
  }
  console.log('\n深浅色实测通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
