/**
 * 真机 E2E：加载真实扩展到系统 Chrome，验证伪装引擎全链路。
 * 权限弹窗无法自动化点击，因此不走 popup 授权流程，而是直接在扩展
 * Service Worker 里预置站点配置并动态注册内容脚本（与 enableSite 等价）。
 * 运行：npm run test:e2e
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// 自动化加载未打包扩展需要 Chrome for Testing（品牌版 Chrome 137+ 忽略 --load-extension）。
// 首次会从 npmmirror 下载到 /tmp/cft（tests/e2e/get-browser.sh）。
const CHROME = fs.existsSync('/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
  ? '/tmp/cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXT_DIR = path.resolve('.output/chrome-mv3');
const PORT = 8787;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PROFILE_DIR = '/tmp/pm-e2e-profile';
const EVIDENCE_DIR = 'docs/dev/evidence';
/** E2E 专用扩展目录：拷贝构建产物并把测试站点写进 host_permissions（安装即授权，
 *  等价于用户在弹窗里点过「允许」；权限弹窗本身无法自动化点击） */
const TEST_EXT_DIR = '/tmp/pm-e2e-ext';

const html = `<!doctype html><html><head>
<title>极客时间-深耕一站式服务</title>
<link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">
</head><body>
<header id="site-header" data-testid="site-header"><nav class="top-nav">学习导航 学习圈 商城</nav></header>
<main><h1>课程推荐</h1><ul id="rec-list"><li class="rec-card">左耳听风</li><li class="rec-card">架构师训练营</li><li class="rec-card">算法面试40讲</li></ul></main>
<footer id="site-footer">© 极客时间</footer>
</body></html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

function assert(cond, msg) {
  if (!cond) throw new Error(`E2E 断言失败: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.rmSync(TEST_EXT_DIR, { recursive: true, force: true });
  fs.cpSync(EXT_DIR, TEST_EXT_DIR, { recursive: true });
  const manifestPath = path.join(TEST_EXT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = [`${ORIGIN}/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false, // 扩展需要完整浏览器；夜间屏幕关闭不影响
    userDataDir: PROFILE_DIR,
    args: [
      `--disable-extensions-except=${TEST_EXT_DIR}`,
      `--load-extension=${TEST_EXT_DIR}`,
      '--remote-debugging-port=9334',
      '--no-first-run',
      '--window-size=1280,900',
    ],
  });

  try {
    // MV3 Service Worker 懒启动：先做一次导航（tabs.onUpdated 会唤醒后台）
    const warmup = await browser.newPage();
    await warmup.goto('about:blank').catch(() => undefined);

    // 1. 等待扩展 Service Worker 就绪
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      { timeout: 15000 },
    );
    const sw = await swTarget.worker();
    await warmup.close().catch(() => undefined);
    console.log('✓ 扩展 Service Worker 已启动');

    const seedProfile = {
      formatVersion: 1,
      origin: ORIGIN,
      switchState: 'disguised',
      disguisedTitle: null,
      faviconDataUrl: null,
      hideRules: [
        {
          id: 'r_e2e_header',
          elementName: '页头',
          candidates: ['#site-header', '[data-testid="site-header"]'],
          strategy: 'remove',
          scope: { type: 'all' },
          onlyThis: false,
          createdAt: Date.now(),
        },
        {
          id: 'r_e2e_footer',
          elementName: '页脚',
          candidates: ['#site-footer'],
          strategy: 'blank',
          scope: { type: 'all' },
          onlyThis: false,
          createdAt: Date.now(),
        },
      ],
      floatingBtnPos: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 2. 在 SW 里预置配置 + 注册内容脚本（与 popup enableSite 路径等价）
    await sw.evaluate(async (origin, profile) => {
      await chrome.storage.local.set({ [`profile:${origin}`]: profile, settings: { defaultTitle: '新建标签页' } });
      await chrome.scripting.registerContentScripts([
        {
          id: `pagemask:${origin}`,
          matches: [`${origin}/*`],
          js: ['content-scripts/content.js'],
          runAt: 'document_idle',
          persistAcrossSessions: true,
        },
      ]);
    }, ORIGIN, seedProfile);
    console.log('✓ 已预置站点配置并注册内容脚本');

    // 3. 打开测试页
    const page = await browser.newPage();
    page.on('console', (m) => console.log(`  [page:${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    const probe = await page.evaluate(() => ({
      title: document.title,
      headerDisplay: getComputedStyle(document.getElementById('site-header')).display,
      hostExists: !!document.getElementById('pagemask-floating-host'),
    }));
    console.log('  [probe]', JSON.stringify(probe));
    await page.waitForSelector('#pagemask-floating-host', { timeout: 8000 });
    console.log('✓ 内容脚本已注入，悬浮按钮存在');

    // 4. 断言伪装效果
    await new Promise((r) => setTimeout(r, 600));
    const disguised = await page.evaluate(() => ({
      title: document.title,
      headerDisplay: getComputedStyle(document.getElementById('site-header')).display,
      footerVisibility: getComputedStyle(document.getElementById('site-footer')).visibility,
      recCards: document.querySelectorAll('.rec-card').length,
      toggleHost: !!document.getElementById('pagemask-floating-host'),
    }));
    assert(disguised.toggleHost, '悬浮按钮挂载');
    assert(disguised.title === '新建标签页', `标题已伪装（实际: ${disguised.title}）`);
    assert(disguised.headerDisplay === 'none', `方案A彻底移除生效（实际: ${disguised.headerDisplay}）`);
    assert(disguised.footerVisibility === 'hidden', `方案B原地留白生效（实际: ${disguised.footerVisibility}）`);
    assert(disguised.recCards === 3, '范围外元素不受影响');
    await page.screenshot({ path: `${EVIDENCE_DIR}/e2e-disguised.png` });

    // 5. 切回原样态：完全还原（标题、样式一并还原）
    await sw.evaluate(async (origin) => {
      const key = `profile:${origin}`;
      const items = await chrome.storage.local.get(key);
      const p = items[key];
      p.switchState = 'original';
      await chrome.storage.local.set({ [key]: p });
    }, ORIGIN);
    await new Promise((r) => setTimeout(r, 800));
    const original = await page.evaluate(() => ({
      title: document.title,
      headerDisplay: getComputedStyle(document.getElementById('site-header')).display,
      footerVisibility: getComputedStyle(document.getElementById('site-footer')).visibility,
      toggleHost: !!document.getElementById('pagemask-floating-host'),
    }));
    assert(original.title === '极客时间-深耕一站式服务', `原样态标题还原（实际: ${original.title}）`);
    assert(original.headerDisplay !== 'none', '原样态隐藏样式移除');
    assert(original.footerVisibility === 'visible', '原样态留白样式移除');
    assert(original.toggleHost, '原样态悬浮按钮保留（切回入口）');
    await page.screenshot({ path: `${EVIDENCE_DIR}/e2e-original.png` });

    // 6. 再切回伪装态（多标签页联动语义：同一 storage 键变化驱动）
    await sw.evaluate(async (origin) => {
      const key = `profile:${origin}`;
      const items = await chrome.storage.local.get(key);
      const p = items[key];
      p.switchState = 'disguised';
      await chrome.storage.local.set({ [key]: p });
    }, ORIGIN);
    await new Promise((r) => setTimeout(r, 800));
    const again = await page.evaluate(() => getComputedStyle(document.getElementById('site-header')).display);
    assert(again === 'none', '再次进入伪装态样式重新注入');

    console.log('\n全部 E2E 断言通过 ✅');
    process.exitCode = 0;
  } catch (e) {
    console.error('\nE2E 失败 ❌\n', e);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
    server.close();
  }
}

main();
