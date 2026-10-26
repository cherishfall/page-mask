/**
 * 真机 E2E：把构建产物加载进 Chrome for Testing（新 headless），在本地虚构夹具站点上验证全链路。
 * 运行：npm run test:e2e（= wxt build && node tests/e2e/run-e2e.mjs）
 *
 * - 浏览器：自动下载固定版本 CfT 到 .cache/chrome（CHROME_PATH / CFT_BASE_URL / CFT_CACHE_DIR 可覆盖，见 lib/browser.mjs）
 * - 授权：权限弹窗无法自动化点击，测试来源通过拷贝 manifest 预授予（见 lib/extension.mjs）
 * - 启用站点走与 popup 相同的 enableSite 消息入口
 * - 截图写到 test-results/e2e/（已忽略）
 * - 已知缺陷以 expectFail 形式存在：失败打印「预期失败 → #NN」，意外通过则计为失败
 */
import { createReporter, resultsDir, startServer, waitFor } from './lib/harness.mjs';
import {
  getProfile,
  launchExtension,
  patchProfile,
  removePermission,
  reloadExtension,
  sendToBackground,
  sendToTab,
  setProfile,
  stopServiceWorker,
  tabIdOf,
  waitForServiceWorkerIdle,
} from './lib/extension.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';
import { FIXTURE_TITLE, fixtureHandler } from './fixtures.mjs';
import path from 'node:path';

const DISGUISED_TITLE = '新建标签页';
const TOGGLE_HOST = '#pagemask-floating-host';
const TOGGLE_BTN = '[title^="PageMask"]';
const WIZARD_HOST = '#pagemask-wizard-host';
const EDITOR_HOST = '#pagemask-editor-host';
const tid = (id) => `[data-testid="${id}"]`;

const r = createReporter();
const { check, expectFail } = r;
const OUT = resultsDir('e2e');
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

/** 页面内元素计算样式快照 */
function styleOf(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, height: rect.height };
  }, selector);
}

const isShown = (s) => !!s && s.display !== 'none' && s.visibility === 'visible' && s.height > 0;

/** 等待某元素的计算样式满足条件 */
function waitStyle(page, label, selector, prop, expected, { not = false, timeout } = {}) {
  return waitFor(
    page,
    label,
    (sel, p, v, n) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const actual = getComputedStyle(el)[p];
      return n ? actual !== v : actual === v;
    },
    [selector, prop, expected, not],
    { timeout },
  );
}

function seedProfile(origin) {
  const now = Date.now();
  return {
    formatVersion: 1,
    origin,
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
        createdAt: now,
      },
      {
        id: 'r_e2e_footer',
        elementName: '页脚',
        candidates: ['#site-footer'],
        strategy: 'blank',
        scope: { type: 'all' },
        onlyThis: false,
        createdAt: now,
      },
      {
        id: 'r_e2e_promo',
        elementName: '活动栏',
        candidates: ['#side-promo'],
        strategy: 'remove',
        scope: { type: 'include', patterns: [{ label: '章节页', prefix: `${origin}/article/` }] },
        onlyThis: false,
        createdAt: now,
      },
    ],
    floatingBtnPos: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const t0 = Date.now();
  const srv = await startServer(fixtureHandler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN] });
  const { browser } = ext;
  console.log(`✓ 扩展已加载（${ext.extensionId}），测试站点 ${ORIGIN}`);

  try {
    // ===================== 启用站点（真实 enableSite 消息入口） =====================
    console.log('\n--- 启用站点与清爽态 ---');
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    check(
      !(await page.evaluate((h) => !!document.querySelector(h), TOGGLE_HOST)),
      '未启用的站点不注入任何东西（零影响）',
    );

    await ext.control.evaluate((s) => chrome.storage.local.set({ settings: s }), { defaultTitle: DISGUISED_TITLE });
    await setProfile(ext.control, ORIGIN, seedProfile(ORIGIN));
    const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const enabled = await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId });
    check(enabled?.ok === true, `enableSite 回复成功（${JSON.stringify(enabled)}）`);

    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await waitFor(page, '标题伪装生效', (t) => document.title === t, [DISGUISED_TITLE]);
    await waitStyle(page, '页头被移除', '#site-header', 'display', 'none');
    check(true, '悬浮按钮挂载、标题已伪装');
    check((await styleOf(page, '#site-header')).display === 'none', '方案A：页头 display:none');
    const footer = await styleOf(page, '#site-footer');
    check(footer.visibility === 'hidden' && footer.opacity === '0', '方案B：页脚原地留白 visibility:hidden + opacity:0');
    check(isShown(await styleOf(page, '#page-title')), '没有规则命中的元素保持可见（#page-title）');
    check(isShown(await styleOf(page, '.rec-card')), '没有规则命中的元素保持可见（.rec-card）');
    check(isShown(await styleOf(page, '#side-promo')), '生效范围外：仅章节页生效的规则在首页不隐藏 #side-promo');
    await shot(page, 'disguised');

    // 生效范围内：同一规则在章节页生效
    await page.goto(`${ORIGIN}/article/1`, { waitUntil: 'load' });
    await waitStyle(page, '章节页 #side-promo 被移除', '#side-promo', 'display', 'none');
    check(true, '生效范围内：章节页隐藏 #side-promo');
    check((await styleOf(page, '#site-header')).display === 'none', '整站规则在章节页同样生效');
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await waitStyle(page, '回到首页后页头被移除', '#site-header', 'display', 'none');

    // ===================== 开关切换 =====================
    console.log('\n--- 开关切换 ---');
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitFor(page, '点击悬浮按钮后标题还原', (t) => document.title === t, [FIXTURE_TITLE]);
    await waitStyle(page, '原样态页头恢复', '#site-header', 'display', 'none', { not: true });
    await waitStyle(page, '原样态页脚恢复', '#site-footer', 'visibility', 'visible');
    check(true, '真实点击悬浮按钮 → 原样态：标题、隐藏、留白全部还原');
    check((await getProfile(ext.control, ORIGIN)).switchState === 'original', '开关状态写入存储（original）');
    check(await page.evaluate((h) => !!document.querySelector(h), TOGGLE_HOST), '原样态保留悬浮按钮（切回入口）');
    await shot(page, 'original');

    // 存储变化驱动（多标签页联动语义）
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await waitStyle(page, '存储切回清爽态后样式重新注入', '#site-header', 'display', 'none');
    check(true, '存储切回清爽态 → 样式重新注入');

    // ===================== 向导全流程（拾取 → 预览 → 保存） =====================
    console.log('\n--- 向导全流程 ---');
    await patchProfile(ext.control, ORIGIN, { hideRules: [], switchState: 'original' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'newSite' });
    await waitForShadow(page, WIZARD_HOST, tid('pm-wizard-toolbar'));
    check(true, '向导工具条出现');

    // 拾取：真实鼠标点击页头左侧（避开顶部中央的工具条）+ 第一张推荐卡
    const headerPt = await page.evaluate(() => {
      const rc = document.getElementById('site-header').getBoundingClientRect();
      return { x: rc.x + 40, y: rc.y + rc.height / 2 };
    });
    const cardPt = await page.evaluate(() => {
      const rc = document.querySelector('.rec-card').getBoundingClientRect();
      return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 };
    });
    await page.mouse.click(headerPt.x, headerPt.y);
    await page.mouse.click(cardPt.x, cardPt.y);
    await waitFor(
      page,
      '预览按钮显示已选 2 个',
      (h, s) => (document.querySelector(h)?.shadowRoot?.querySelector(s)?.textContent ?? '').includes('2'),
      [WIZARD_HOST, tid('pm-wiz-preview')],
    );
    check(true, `两个元素已选中（预览按钮：${(await shadowText(page, WIZARD_HOST, tid('pm-wiz-preview'))).trim()}）`);

    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-preview'));
    await waitStyle(page, '预览：导航被移除', '.top-nav', 'display', 'none');
    await waitStyle(page, '预览：推荐卡被移除', '.rec-card', 'display', 'none');
    check(true, '预览：两个元素按方案A移除');
    const markers = await page.evaluate(
      (h) => document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid^="pm-marker-"]').length ?? 0,
      WIZARD_HOST,
    );
    check(markers === 2, `预览：两个幽灵标记存在（实际 ${markers}）`);
    check(isShown(await styleOf(page, '#page-title')), '预览：未选中的元素保持可见');
    await shot(page, 'wizard-preview');

    // 点第一个标记 → 弹片 → 换成方案B（原地留白）→ 移出。标记 1 在页顶，点左侧避开顶部中央的工具条
    await clickInShadow(page, WIZARD_HOST, tid('pm-marker-1'), { offset: { x: 20, y: 10 } });
    await waitForShadow(page, WIZARD_HOST, tid('pm-pop-strategy-blank'));
    await clickInShadow(page, WIZARD_HOST, tid('pm-pop-strategy-blank'));
    await waitStyle(page, '标记弹片换方案B', '.top-nav', 'visibility', 'hidden');
    check(true, '标记弹片换方案B生效（visibility:hidden）');
    await clickInShadow(page, WIZARD_HOST, tid('pm-pop-remove'));
    await waitStyle(page, '移出后导航恢复', '.top-nav', 'visibility', 'visible');

    // 保存（默认整站）
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-save'));
    await waitForShadow(page, WIZARD_HOST, tid('pm-wiz-save-yes'));
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-save-yes'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [WIZARD_HOST]);
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await waitFor(page, '新站点保存后自动进入清爽态', (t) => document.title === t, [DISGUISED_TITLE]);
    await waitStyle(page, '正式规则生效', '.rec-card', 'display', 'none');
    check(true, '保存后向导关闭、悬浮按钮回归、自动进入清爽态、正式规则生效');
    check((await styleOf(page, '.top-nav')).visibility === 'visible', '已移出的元素没有被保存成规则');
    const stored = await getProfile(ext.control, ORIGIN);
    check(stored.hideRules.length === 1, `规则落库 1 条（实际 ${stored.hideRules.length}）`);
    check(stored.switchState === 'disguised', '站点开关为清爽态');
    await shot(page, 'wizard-saved');

    // ===================== 编辑面板 + 方案C遮罩 =====================
    console.log('\n--- 编辑面板与方案C遮罩 ---');
    await sendToTab(ext.control, tabId, { t: 'openEditor' });
    await waitForShadow(page, EDITOR_HOST, tid('pm-editor-panel'));
    check(true, '编辑面板打开');
    const ruleId = stored.hideRules[0].id;
    await clickInShadow(page, EDITOR_HOST, tid(`pm-ed-strategy-${ruleId}-mask`));
    await waitFor(page, '遮罩覆盖层出现', () => (document.getElementById('pagemask-mask-host')?.children.length ?? 0) >= 1);
    await waitStyle(page, '方案C不移除元素', '.rec-card', 'display', 'none', { not: true });
    const maskState = await page.evaluate(() => {
      const maskHost = document.getElementById('pagemask-mask-host');
      const first = document.querySelector('.rec-card').getBoundingClientRect();
      const box = maskHost.children[0].getBoundingClientRect();
      return box.top <= first.top + 2 && box.bottom >= first.bottom - 2 && box.width > 10;
    });
    check(maskState, '方案C：遮罩出现且覆盖元素，元素本身不再被移除');
    check((await getProfile(ext.control, ORIGIN)).hideRules[0].strategy === 'mask', '方案C 写入存储');
    await shot(page, 'mask');
    await clickInShadow(page, EDITOR_HOST, tid('pm-editor-close'));
    await waitFor(page, '编辑面板关闭', (h) => !document.querySelector(h), [EDITOR_HOST]);
    check(true, '编辑面板关闭');

    // ===================== 悬浮按钮右键菜单（真实鼠标） =====================
    await expectFail('悬浮按钮右键菜单「编辑规则」打开编辑面板', 25, async () => {
      await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN, { button: 'right' });
      await waitForShadow(page, TOGGLE_HOST, `${TOGGLE_BTN} > div > div:first-child`, { timeout: 3000 });
      await clickInShadow(page, TOGGLE_HOST, `${TOGGLE_BTN} > div > div:first-child`);
      await waitForShadow(page, EDITOR_HOST, tid('pm-editor-panel'), { timeout: 3000 });
      check(true, '编辑面板打开');
      check((await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '点菜单不应切换开关');
    });
    // 无论结果如何，把状态复位给后续用例
    await page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-editor-close"]')?.click(), EDITOR_HOST);
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await waitStyle(page, '复位到清爽态', '.rec-card', 'display', 'none', { not: true });

    // ===================== 管理页 / 引导页 =====================
    console.log('\n--- 管理页与引导页 ---');
    const mPage = await browser.newPage();
    await mPage.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
    await mPage.waitForSelector('.site', { timeout: 5000 });
    const mgmt = await mPage.evaluate(() => ({
      host: document.querySelector('.site .host')?.textContent ?? '',
      state: document.querySelector('.site .state')?.textContent ?? '',
      hasExport: !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('导出配置')),
    }));
    check(mgmt.host.includes('127.0.0.1'), `管理页列出站点（${mgmt.host}）`);
    check(mgmt.state.includes('规则'), `管理页显示规则数与状态（${mgmt.state.trim()}）`);
    check(mgmt.hasExport, '管理页有导出/导入');
    await shot(mPage, 'management');
    await mPage.close();

    const oPage = await browser.newPage();
    await oPage.goto(`${ext.extOrigin}/onboarding.html`, { waitUntil: 'load' });
    await oPage.waitForSelector('.step', { timeout: 5000 });
    check((await oPage.$$('.step')).length === 3, '引导页 3 步图文');
    const next = await oPage.waitForSelector('xpath/.//button[normalize-space()="下一步"]', { timeout: 3000 });
    await next.click();
    await waitFor(oPage, '引导页切到第 2 步', () => document.querySelector('.step.active .num')?.textContent === '2');
    check(true, '引导页步骤可切换');
    await oPage.close();

    // ===================== SW 回收后还原（#20） =====================
    // 注入记录由页面内的内容脚本按文档持有，SW 被回收后新实例照样能删掉。
    // 先用 CDP 立即停止（快），再做自然空闲回收（关键回归，约 30 秒）
    // 每个用例前：清爽态 + 重载页面，让当前 SW 实例注入隐藏样式
    const prepareDisguised = async (p = page) => {
      await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
      await p.reload({ waitUntil: 'load' });
      await waitFor(p, '清爽态标题', (t) => document.title === t, [DISGUISED_TITLE]);
      await waitStyle(p, '清爽态页头被移除', '#site-header', 'display', 'none');
      await p.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    };
    // 换回带 remove 规则的配置（上一节把唯一规则改成了遮罩），便于观察隐藏样式是否被撤掉
    await patchProfile(ext.control, ORIGIN, { hideRules: seedProfile(ORIGIN).hideRules });
    await prepareDisguised();

    console.log('\n--- SW 被 CDP 停止后切回原样 ---');
    await stopServiceWorker(ext);
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitFor(page, '标题还原', (t) => document.title === t, [FIXTURE_TITLE]);
    await waitStyle(page, '页头重新可见', '#site-header', 'display', 'none', { not: true, timeout: 3000 });
    check(true, 'SW 被 CDP 停止后点悬浮按钮切回原样：页头重新可见');

    console.log('\n--- 向导预览停留到 SW 被停止后点「放弃」 ---');
    await prepareDisguised();
    await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'addElement' });
    await waitForShadow(page, WIZARD_HOST, tid('pm-wizard-toolbar'));
    await waitStyle(page, '进向导临时还原：页头可见', '#site-header', 'display', 'none', { not: true });
    const cardPt2 = await page.evaluate(() => {
      const rc = document.querySelector('.rec-card').getBoundingClientRect();
      return { x: rc.x + 40, y: rc.y + rc.height / 2 };
    });
    await page.mouse.click(cardPt2.x, cardPt2.y);
    await waitFor(
      page,
      '已选 1 个',
      (h, sel) => (document.querySelector(h)?.shadowRoot?.querySelector(sel)?.textContent ?? '').includes('1'),
      [WIZARD_HOST, tid('pm-wiz-preview')],
    );
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-preview'));
    await waitStyle(page, '预览：推荐卡被移除', '.rec-card', 'display', 'none');
    await stopServiceWorker(ext);
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-giveup'));
    await waitForShadow(page, WIZARD_HOST, tid('pm-wiz-exit-yes'));
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-exit-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD_HOST]);
    await waitStyle(page, '放弃后推荐卡重新可见', '.rec-card', 'display', 'none', { not: true, timeout: 3000 });
    await waitStyle(page, '放弃后回到清爽态', '#site-header', 'display', 'none');
    check(true, '预览期间 SW 被停止，点「放弃」后预览样式被撤掉，正式规则照常恢复');
    check((await getProfile(ext.control, ORIGIN)).hideRules.length === 3, '放弃不保存任何规则');

    console.log('\n--- SW 自然空闲回收后切回原样 ---');
    await prepareDisguised();
    const ms = await waitForServiceWorkerIdle(ext);
    console.log(`  · SW 已自然空闲回收（等待 ${(ms / 1000).toFixed(1)} 秒）`);
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitFor(page, '标题还原', (t) => document.title === t, [FIXTURE_TITLE]);
    await waitStyle(page, '页头重新可见', '#site-header', 'display', 'none', { not: true, timeout: 3000 });
    await waitStyle(page, '页脚重新可见', '#site-footer', 'visibility', 'visible', { timeout: 1000 });
    check(true, 'SW 自然空闲回收后点悬浮按钮切回原样：页头、页脚重新可见');

    // ===================== bfcache 后退（#20） =====================
    console.log('\n--- A 页清爽态 → 同源跳 B → 后退 → 切原样 ---');
    /** 后退到首页并报告是否从 bfcache 恢复（同一文档的 JS 状态还在 + pageshow.persisted） */
    const backToA = async () => {
      // bfcache 恢复不触发 load；goBack 自身的等待条件不可靠，只等地址回到 A
      await Promise.race([page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined), new Promise((res) => setTimeout(res, 3000))]);
      await waitFor(page, '回到 A 页', () => location.pathname === '/index.html');
      return page.evaluate(() => ({
        restored: (window.__pmPageshow ?? []).includes(true),
        navType: performance.getEntriesByType('navigation')[0]?.type,
      }));
    };
    const markA = () =>
      page.evaluate(() => {
        window.__pmPageshow = [];
        addEventListener('pageshow', (e) => window.__pmPageshow.push(e.persisted));
      });
    const expectNoResidue = async (label) => {
      await waitStyle(page, `${label}：页头可见`, '#site-header', 'display', 'none', { not: true, timeout: 3000 });
      await waitStyle(page, `${label}：页脚可见`, '#site-footer', 'visibility', 'visible', { timeout: 1000 });
      await waitFor(page, `${label}：标题还原`, (t) => document.title === t, [FIXTURE_TITLE]);
      const all = await Promise.all(['#site-header', '#site-footer', '#side-promo', '.rec-card'].map((sel) => styleOf(page, sel)));
      check(all.every((st) => isShown(st) && st.opacity === '1'), `${label}：A 页无残留样式`);
    };

    await prepareDisguised();
    await markA();
    await page.goto(`${ORIGIN}/article/1`, { waitUntil: 'load' });
    await waitStyle(page, 'B 页 #side-promo 被移除', '#side-promo', 'display', 'none');
    let back = await backToA();
    console.log(`  · 后退：${back.restored ? '从 bfcache 恢复' : `未走 bfcache（navigation type = ${back.navType}）`}`);
    check(back.restored, '测试环境中 bfcache 生效（A 页文档被原样恢复）');
    await waitStyle(page, 'A 页仍是清爽态', '#site-header', 'display', 'none');
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await expectNoResidue('后退后切原样');

    console.log('\n--- A 页在 bfcache 期间切了原样 → 后退 ---');
    await prepareDisguised();
    await markA();
    await page.goto(`${ORIGIN}/article/1`, { waitUntil: 'load' });
    await waitStyle(page, 'B 页 #side-promo 被移除', '#side-promo', 'display', 'none');
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitStyle(page, 'B 页随存储切回原样', '#side-promo', 'display', 'none', { not: true });
    back = await backToA();
    check(back.restored, 'A 页从 bfcache 恢复');
    await expectNoResidue('恢复后按新状态同步');

    // ===================== 首屏防闪（#20） =====================
    console.log('\n--- 刷新已配置站点：首帧已隐藏、标题已替换 ---');
    await prepareDisguised();
    // 主世界钩子（每个新文档最先执行）：目标元素首次进入 DOM 起，逐个动画帧（rAF 在该帧绘制之前执行）
    // 记录目标元素与普通内容是否可见、当时的标题，共 20 帧
    const hook = await page.evaluateOnNewDocument(() => {
      const vis = (el) => !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      window.__pmFrames = [];
      const sample = () => {
        window.__pmFrames.push({
          t: Math.round(performance.now()),
          target: vis(document.getElementById('site-header')),
          content: vis(document.getElementById('page-title')),
          title: document.title,
        });
        if (window.__pmFrames.length < 20) requestAnimationFrame(sample);
      };
      const mo = new MutationObserver(() => {
        if (!document.getElementById('site-header')) return;
        mo.disconnect();
        requestAnimationFrame(sample);
      });
      mo.observe(document, { childList: true, subtree: true });
    });
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'load' });
      await waitFor(page, '采样 20 帧', () => window.__pmFrames?.length >= 20);
      runs.push(await page.evaluate(() => window.__pmFrames));
    }
    await page.removeScriptToEvaluateOnNewDocument(hook.identifier);
    for (const frames of runs) {
      const firstShown = frames.find((f) => f.content);
      console.log(
        `  · 首帧 t=${frames[0].t}ms；内容首次可见 ${firstShown ? `t=${firstShown.t}ms（第 ${frames.indexOf(firstShown) + 1} 帧）` : '未出现'}；` +
          `目标元素可见的帧 ${frames.filter((f) => f.target).length} 个`,
      );
    }
    check(runs.every((frames) => frames.every((f) => !f.target)), '刷新后从首帧起目标元素始终不可见（3 次 × 20 帧）');
    check(
      runs.every((frames) => frames.some((f) => f.content) && frames.filter((f) => f.content).every((f) => f.title === DISGUISED_TITLE)),
      '页面内容可见的每一帧标题都已替换（3 次）',
    );
    check(isShown(await styleOf(page, '#page-title')), '过渡遮挡已撤掉，普通内容正常显示');

    // ===================== 扩展重载（#21） =====================
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await expectFail('runtime.reload() 后已配置站点仍然生效', 21, async () => {
      await reloadExtension(ext);
      const p2 = await browser.newPage();
      try {
        await p2.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
        await p2.waitForSelector(TOGGLE_HOST, { timeout: 5000 }).catch(() => {
          throw new Error('重载后新开页面没有悬浮按钮（内容脚本未注入）');
        });
        await waitStyle(p2, '重载后页头被移除', '#site-header', 'display', 'none');
        check(true, '重载后新开页面仍处于清爽态');
      } finally {
        await p2.close();
      }
    });

    // ===================== 撤销授权（工具自检 + 零影响） =====================
    console.log('\n--- 撤销授权 ---');
    // 确保动态注册存在（重载可能把它清掉），并用一个新页面做正向对照
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    const before = await browser.newPage();
    await before.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await before.waitForSelector(TOGGLE_HOST, { timeout: 5000 });
    check(true, '撤销前：新开页面会注入');
    await before.close();
    const stillGranted = await removePermission(ext.control, ORIGIN);
    check(stillGranted === false, 'permissions.remove 后不再持有该站点权限');
    const after = await browser.newPage();
    await after.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    // 负向断言：等过内容脚本的 document_idle 时机后确认没有注入（这里必须是固定等待）
    await new Promise((res) => setTimeout(res, 1000));
    check(!(await after.evaluate((h) => !!document.querySelector(h), TOGGLE_HOST)), '撤销后新开页面不再注入');
    check(isShown(await styleOf(after, '#site-header')), '撤销后页面保持原样');
    await after.close();

    console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒，截图在 ${path.relative(process.cwd(), OUT)}/`);
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
