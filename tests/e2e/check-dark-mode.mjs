/**
 * 设计 tokens 深浅色实测（#33）：加载构建后的扩展，分别模拟系统浅色 / 深色，
 * 读取「popup 页面」和「页内悬浮按钮 shadow root」里实际计算出的颜色。
 *
 * 测试页带 `Content-Security-Policy: style-src 'none'`，并放一段会被 CSP 拦掉的页面内联样式
 * 作为对照，用来证明：在最严格的 style-src 下，adoptedStyleSheets 注入的 tokens 依然生效。
 *
 * 运行：npm run build && node tests/e2e/check-dark-mode.mjs
 */
import { startServer } from './lib/harness.mjs';
import { launchExtension, sendToBackground, setProfile, tabIdOf } from './lib/extension.mjs';
// 期望值：与 styles/tokens.css 的原始色值一致
const EXPECT = {
  light: { fg: 'rgb(31, 35, 41)', bg: 'rgb(255, 255, 255)' },
  dark: { fg: 'rgb(229, 231, 235)', bg: 'rgb(31, 35, 41)' },
};

const html = `<!doctype html><html><head><title>dark-mode check</title>
<style>body{background:rgb(255,0,0)}</style>
</head><body><main><h1>测试页</h1></main></body></html>`;
const handler = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "style-src 'none'",
  });
  res.end(html);
};

let failed = false;
function check(cond, msg) {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
}

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
  const { browser, control, extOrigin } = ext;
  try {
    const now = Date.now();
    await control.evaluate((st) => chrome.storage.local.set({ settings: st }), { defaultTitle: '阅读' });
    await setProfile(control, ORIGIN, {
      formatVersion: 1,
      origin: ORIGIN,
      switchState: 'original',
      disguisedTitle: null,
      faviconDataUrl: null,
      hideRules: [],
      floatingBtnPos: null,
      createdAt: now,
      updatedAt: now,
    });
    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(control, `${ORIGIN}/*`) });
    await page.waitForSelector('pagemask-toggle', { timeout: 8000 });
    const popup = await browser.newPage();
    await popup.goto(`${extOrigin}/popup.html`, { waitUntil: 'networkidle0' });

    for (const scheme of ['light', 'dark']) {
      console.log(`\n[prefers-color-scheme: ${scheme}]`);
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);

      const shadow = await page.evaluate(() => {
        const host = document.querySelector('pagemask-toggle');
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
    await ext.cleanup();
    await srv.close();
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
