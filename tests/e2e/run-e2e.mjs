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

/** 在向导阴影 DOM 中按 data-testid 查找（弹窗/标记等 UI 都在 shadow root 里） */
async function shadowQuery(page, testid) {
  return page.evaluate((tid) => {
    const host = document.getElementById('pagemask-wizard-host') ?? document.getElementById('pagemask-floating-host');
    const root = host?.shadowRoot;
    return root?.querySelector(`[data-testid="${tid}"]`) ?? null;
  }, testid);
}

async function shadowExists(page, testid) {
  return (await shadowQuery(page, testid)) !== null;
}

async function shadowClick(page, testid) {
  return page.evaluate((tid) => {
    const host = document.getElementById('pagemask-wizard-host') ?? document.getElementById('pagemask-floating-host');
    const el = host?.shadowRoot?.querySelector(`[data-testid="${tid}"]`);
    if (el) el.click();
    return !!el;
  }, testid);
}

async function shadowText(page, testid) {
  return page.evaluate((tid) => {
    const host = document.getElementById('pagemask-wizard-host') ?? document.getElementById('pagemask-floating-host');
    return host?.shadowRoot?.querySelector(`[data-testid="${tid}"]`)?.textContent ?? '';
  }, testid);
}

async function centerOf(page, selector) {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
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
    // Node 的 URL 对 chrome-extension 这类非特殊协议 .origin 返回 "null"，手动截取
    const extOrigin = swTarget.url().replace(/\/[^/]*$/, '');
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

    // ===================== 向导全流程（拾取 → 预览 → 保存） =====================
    console.log('\n--- 向导全流程 ---');
    // 重置为"新站点"状态：空规则 + 原样态，然后重载页面
    await sw.evaluate(async (origin) => {
      const key = `profile:${origin}`;
      const items = await chrome.storage.local.get(key);
      const p = items[key];
      p.hideRules = [];
      p.switchState = 'original';
      await chrome.storage.local.set({ [key]: p });
    }, ORIGIN);
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // 以 popup 同款消息触发向导（新站点模式）：从 SW 找到页面 tabId 后 sendMessage
    const realTabId = await sw.evaluate(async (origin) => {
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      return tabs[0]?.id ?? -1;
    }, ORIGIN);
    assert(realTabId !== -1, '找到测试页 tabId');
    await sw.evaluate(async (id) => {
      await chrome.tabs.sendMessage(id, { t: 'openWizard', mode: 'newSite' });
    }, realTabId);
    await new Promise((r) => setTimeout(r, 500));

    const wizVisible = await shadowExists(page, 'pm-wizard-toolbar');
    assert(wizVisible, '向导工具条出现');

    // 拾取：真实鼠标点击两个元素（页头左侧 + 第一张推荐卡）。
    // 注意避开顶部中央的工具条（它 pointer-events:auto，盖住的区域点不到页面元素）
    const headerPt = await page.evaluate(() => {
      const r = document.getElementById('site-header').getBoundingClientRect();
      return { x: r.x + 40, y: r.y + r.height / 2 };
    });
    const cardPt = await centerOf(page, '.rec-card');
    await page.mouse.click(headerPt.x, headerPt.y);
    await new Promise((r) => setTimeout(r, 250));
    await page.mouse.click(cardPt.x, cardPt.y);
    await new Promise((r) => setTimeout(r, 400));
    const previewBtnReady = await shadowText(page, 'pm-wiz-preview');
    assert(previewBtnReady.includes('2'), `两个元素已选中（预览按钮：${previewBtnReady}）`);

    // 进入预览
    await shadowClick(page, 'pm-wiz-preview');
    await new Promise((r) => setTimeout(r, 700));
    const previewState = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector('.top-nav')).display,
      card: getComputedStyle(document.querySelector('.rec-card')).display,
    }));
    assert(previewState.nav === 'none', `预览：导航按方案A移除（实际 ${previewState.nav}）`);
    assert(previewState.card === 'none', `预览：推荐卡按方案A移除（实际 ${previewState.card}）`);
    const markerOk = await page.evaluate(() => {
      const host = document.getElementById('pagemask-wizard-host');
      const boxes = host?.shadowRoot?.querySelectorAll('[data-testid^="pm-marker-"]');
      return boxes?.length ?? 0;
    });
    assert(markerOk === 2, `预览：两个幽灵标记存在（实际 ${markerOk}）`);
    await page.screenshot({ path: `${EVIDENCE_DIR}/e2e-wizard-preview.png` });

    // 点第一个标记 → 弹片 → 换成方案B（原地留白）
    await shadowClick(page, 'pm-marker-1');
    await new Promise((r) => setTimeout(r, 300));
    await shadowClick(page, 'pm-pop-strategy-blank');
    await new Promise((r) => setTimeout(r, 600));
    const afterBlank = await page.evaluate(() => ({
      navVisibility: getComputedStyle(document.querySelector('.top-nav')).visibility,
    }));
    assert(afterBlank.navVisibility === 'hidden', `标记弹片换方案B生效（visibility=${afterBlank.navVisibility}）`);
    await shadowClick(page, 'pm-pop-remove');
    await new Promise((r) => setTimeout(r, 500));

    // 保存（默认整站）
    await shadowClick(page, 'pm-wiz-save');
    await new Promise((r) => setTimeout(r, 300));
    await shadowClick(page, 'pm-wiz-save-yes');
    await new Promise((r) => setTimeout(r, 900));

    const saved = await page.evaluate(() => ({
      wizardGone: !document.getElementById('pagemask-wizard-host'),
      toggleBack: !!document.getElementById('pagemask-floating-host'),
      title: document.title,
      card: getComputedStyle(document.querySelector('.rec-card')).display,
    }));
    assert(saved.wizardGone, '保存后向导关闭');
    assert(saved.toggleBack, '悬浮按钮回归');
    assert(saved.title === '新建标签页', `新站点保存后自动进入伪装态（标题=${saved.title}）`);
    assert(saved.card === 'none', `正式规则生效（推荐卡 display=${saved.card}）`);

    const stored = await sw.evaluate(async (origin) => {
      const items = await chrome.storage.local.get(`profile:${origin}`);
      const p = items[`profile:${origin}`];
      return { rules: p.hideRules.length, state: p.switchState };
    }, ORIGIN);
    assert(stored.rules === 1, `规则落库（1 条方案B，另一条已移出；实际 ${stored.rules}）`);
    assert(stored.state === 'disguised', '站点开关切到伪装态');
    await page.screenshot({ path: `${EVIDENCE_DIR}/e2e-wizard-saved.png` });

    // ===================== 编辑面板 + 方案C遮罩 =====================
    console.log('\n--- 编辑面板与方案C遮罩 ---');
    await sw.evaluate(async (id) => {
      await chrome.tabs.sendMessage(id, { t: 'openEditor' });
    }, realTabId);
    await new Promise((r) => setTimeout(r, 500));
    const editorOk = await page.evaluate(() => {
      const host = document.getElementById('pagemask-editor-host');
      return !!host?.shadowRoot?.querySelector('[data-testid="pm-editor-panel"]');
    });
    assert(editorOk, '编辑面板打开，列出当前页面生效规则');

    // 把刚保存的规则换成方案C遮罩 → 出现覆盖层，元素不再 display:none
    const ruleId = await sw.evaluate(async (origin) => {
      const items = await chrome.storage.local.get(`profile:${origin}`);
      return items[`profile:${origin}`].hideRules[0].id;
    }, ORIGIN);
    await page.evaluate((rid) => {
      const host = document.getElementById('pagemask-editor-host');
      const btn = host?.shadowRoot?.querySelector(`[data-testid="pm-ed-strategy-${rid}-mask"]`);
      btn?.click();
      return !!btn;
    }, ruleId);
    await new Promise((r) => setTimeout(r, 900));
    const maskState = await page.evaluate(() => {
      const maskHost = document.getElementById('pagemask-mask-host');
      const boxes = maskHost?.children.length ?? 0;
      const cards = document.querySelectorAll('.rec-card');
      const first = cards[0]?.getBoundingClientRect();
      const box = maskHost?.children[0]?.getBoundingClientRect();
      const covered = !!first && !!box && box.top <= first.top + 2 && box.bottom >= first.bottom - 2 && box.width > 10;
      return { boxes, cardDisplay: getComputedStyle(cards[0]).display, covered };
    });
    assert(maskState.cardDisplay !== 'none', `方案C：元素不再被移除（display=${maskState.cardDisplay}）`);
    assert(maskState.boxes >= 1, `方案C：遮罩覆盖层出现（${maskState.boxes} 个）`);
    assert(maskState.covered, '方案C：遮罩位置覆盖元素');
    await page.screenshot({ path: `${EVIDENCE_DIR}/e2e-mask.png` });

    // 关闭面板
    await page.evaluate(() => {
      const host = document.getElementById('pagemask-editor-host');
      host?.shadowRoot?.querySelector('[data-testid="pm-editor-close"]')?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const editorClosed = await page.evaluate(() => !document.getElementById('pagemask-editor-host'));
    assert(editorClosed, '编辑面板关闭');

    // ===================== 管理页 / 引导页 =====================
    console.log('\n--- 管理页与引导页 ---');
    const mPage = await browser.newPage();
    await mPage.goto(`${extOrigin}/management.html`, { waitUntil: 'load' });
    await mPage.waitForSelector('.site', { timeout: 5000 });
    const mgmt = await mPage.evaluate(() => ({
      host: document.querySelector('.site .host')?.textContent ?? '',
      state: document.querySelector('.site .state')?.textContent ?? '',
      hasExport: !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('导出配置')),
    }));
    assert(mgmt.host.includes('127.0.0.1'), `管理页列出站点（${mgmt.host}）`);
    assert(mgmt.state.includes('规则'), `管理页显示规则数与状态（${mgmt.state.trim()}）`);
    assert(mgmt.hasExport, '管理页有导出/导入');
    await mPage.screenshot({ path: `${EVIDENCE_DIR}/e2e-management.png` });
    await mPage.close();

    const oPage = await browser.newPage();
    await oPage.goto(`${extOrigin}/onboarding.html`, { waitUntil: 'load' });
    const onboard = await oPage.evaluate(async () => {
      const steps = document.querySelectorAll('.step').length;
      const next = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === '下一步');
      next?.click();
      await new Promise((r) => setTimeout(r, 150));
      const active2 = document.querySelector('.step.active .num')?.textContent;
      return { steps, active2 };
    });
    assert(onboard.steps === 3, `引导页 3 步图文（${onboard.steps}）`);
    assert(onboard.active2 === '2', '引导页步骤可切换');
    await oPage.close();

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
