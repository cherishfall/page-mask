/**
 * 真机 E2E：把构建产物加载进 Chrome for Testing（新 headless），在本地虚构夹具站点上验证全链路。
 * 运行：npm run test:e2e（= wxt build && node tests/e2e/run-e2e.mjs）
 *
 * - 浏览器：自动下载固定版本 CfT 到 .cache/chrome（CHROME_PATH / CFT_BASE_URL / CFT_CACHE_DIR 可覆盖，见 lib/browser.mjs）
 * - 授权：权限弹窗无法自动化点击，测试来源通过拷贝 manifest 预授予（见 lib/extension.mjs）
 * - 启用站点走与 popup 相同的 enableSite 消息入口
 * - 截图写到 test-results/e2e/（已忽略）
 * - 已知缺陷以 expectFail 形式存在：失败打印「预期失败 → #NN」，意外通过则计为失败（当前已无）
 * - 站点生命周期（#21）：重载后仍生效、撤销授权后 popup「重新授权」、一键清空即时还原、
 *   导出 → 清空 → 导入后「一次授权全部」、安装警告为空。权限弹窗本身无法自动化：
 *   测试只断言按钮发起了正确的权限请求，授予改用 grantPermissions（重载 + manifest），弹窗部分人工验收
 */
import { removeTempDir } from './lib/tmp.mjs';
import { createReporter, poll, resultsDir, startServer, waitFor } from './lib/harness.mjs';
import {
  BUILD_DIR,
  getProfile,
  grantPermissions,
  launchExtension,
  openPopup,
  permissionWarnings,
  patchProfile,
  removePermission,
  reloadExtension,
  sendToBackground,
  sendToTab,
  setProfile,
  stopServiceWorker,
  tabIdOf,
  waitForServiceWorkerIdle,
  evalInContentWorld,
} from './lib/extension.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';
import { FIXTURE_TITLE, fixtureHandler } from './fixtures.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 不用 0.1.0 的旧默认值「新建标签页」：#35 起它在没有版本标记时会被当作"没设置"迁移掉
const DISGUISED_TITLE = '工作笔记';
/** 预览清单里行内改的名字（#44）：保存后的规则名、编辑面板显示的都应是它 */
const RENAMED_CARD = '推荐卡片（改名）';
// 页内界面宿主是自定义元素（core/host-shield.ts HOST_TAGS）
const TOGGLE_HOST = 'pagemask-toggle';
const TOGGLE_BTN = '[title^="PageMask"]';
const WIZARD_HOST = 'pagemask-wizard';
const EDITOR_HOST = 'pagemask-editor';
const MASK_HOST = 'pagemask-mask';
const ALL_HOSTS = [TOGGLE_HOST, WIZARD_HOST, EDITOR_HOST, MASK_HOST].join(', ');
const tid = (id) => `[data-testid="${id}"]`;

const r = createReporter();
const { check } = r;
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

/** 在页面里替换 permissions.request：记录参数并返回 false（权限弹窗无法自动化；「允许」改用 grantPermissions） */
function stubPermissionRequest(page) {
  return page.evaluate(() => {
    window.__pmRequests = [];
    const fake = async (p) => {
      window.__pmRequests.push(JSON.parse(JSON.stringify(p)));
      return false;
    };
    chrome.permissions.request = fake;
    if (globalThis.browser?.permissions) globalThis.browser.permissions.request = fake;
  });
}

async function main() {
  const t0 = Date.now();
  const srv = await startServer(fixtureHandler);
  const srv2 = await startServer(fixtureHandler);
  const ORIGIN = srv.origin;
  // 第二个测试站点（同主机不同端口）：导入后「一次授权全部」用
  const ORIGIN2 = srv2.origin;
  // tabs 仅加在测试拷贝里：openPopup() 打开的 popup 没有 activeTab，需要它才读得到当前标签页网址
  const ext = await launchExtension({ hostOrigins: [ORIGIN, ORIGIN2], extraPermissions: ['tabs'] });
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

    // ===================== 向导全流程（第 1 步 → 拾取 → 预览 → 保存） =====================
    console.log('\n--- 向导全流程 ---');
    await patchProfile(ext.control, ORIGIN, { hideRules: [], switchState: 'original' });
    await page.reload({ waitUntil: 'load' });
    // 0 条规则不再挂胶囊（#51）：等隔离环境里的内容脚本就绪，而不是等页面上某个界面
    await poll(async () => evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive()').catch(() => false), '内容脚本就绪');
    await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'newSite' });
    await waitForShadow(page, WIZARD_HOST, tid('pm-wizard-toolbar'));
    check((await shadowText(page, WIZARD_HOST, tid('pm-wiz-progress'))).trim() === '第 1 步 / 共 3 步', '新站点向导从第 1 步（标题与图标）开始，共 3 步');
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-next'));
    await waitForShadow(page, WIZARD_HOST, tid('pm-wiz-preview'));
    check(true, '向导工具条出现（第 2 步：选内容）');

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

    // 点第一个号码牌 → 清单对应行高亮（#44）；行内切「留空」；行内改名；点 ✕ 删掉导航（#34、#44）
    await clickInShadow(page, WIZARD_HOST, tid('pm-marker-1'));
    await waitFor(
      page,
      '点号码牌后清单第 1 行高亮',
      (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-draft-1"]')?.classList.contains('flash'),
      [WIZARD_HOST],
    );
    check(true, '点页面上的号码牌：清单滚到对应行并高亮');
    await clickInShadow(page, WIZARD_HOST, tid('pm-draft-1-strategy-blank'));
    await waitStyle(page, '行内换「留空」', '.top-nav', 'visibility', 'hidden');
    check(true, '行内换「留空」立即生效（visibility:hidden）');
    // 行内改名：保存后规则名用的是改过的名字（#44）
    await clickInShadow(page, WIZARD_HOST, tid('pm-draft-name-2'));
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-name-2"]').select(), WIZARD_HOST);
    await page.keyboard.type(RENAMED_CARD);
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-name-2"]').value, WIZARD_HOST)) === RENAMED_CARD,
      `行内改名生效（${RENAMED_CARD}）`,
    );
    await clickInShadow(page, WIZARD_HOST, tid('pm-draft-1-remove'));
    await waitStyle(page, '删掉后导航恢复', '.top-nav', 'visibility', 'visible');
    check(true, '点 ✕ 不收起导航：这一项从清单消失、页面效果消失');

    // 保存（默认整站）
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-save'));
    await waitForShadow(page, WIZARD_HOST, tid('pm-wiz-save-yes'));
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-save-yes'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [WIZARD_HOST]);
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await waitFor(page, '新站点保存后自动进入清爽态', (t) => document.title === t, [DISGUISED_TITLE]);
    await waitStyle(page, '正式规则生效', '.rec-card', 'display', 'none');
    check(true, '保存后向导关闭、悬浮按钮回归、自动进入清爽态、正式规则生效');
    check((await styleOf(page, '.top-nav')).visibility === 'visible', '删掉的那项没有被保存成规则');
    const stored = await getProfile(ext.control, ORIGIN);
    check(stored.hideRules.length === 1, `规则落库 1 条（实际 ${stored.hideRules.length}）`);
    check(stored.hideRules[0].elementName === RENAMED_CARD, `行内改的名字被保存（${stored.hideRules[0].elementName}）`);
    check(stored.switchState === 'disguised', '站点开关为清爽态');
    await shot(page, 'wizard-saved');

    // ===================== 编辑面板 + 方案C遮罩 =====================
    console.log('\n--- 编辑面板与方案C遮罩 ---');
    await sendToTab(ext.control, tabId, { t: 'openEditor' });
    await waitForShadow(page, EDITOR_HOST, tid('pm-editor-panel'));
    check(true, '编辑面板打开');
    const shownName = (await shadowText(page, EDITOR_HOST, '.pm-ed-name')).trim();
    check(shownName === RENAMED_CARD, `编辑面板显示行内改的名字（${shownName}）`);
    const ruleId = stored.hideRules[0].id;
    await clickInShadow(page, EDITOR_HOST, tid(`pm-ed-strategy-${ruleId}-mask`));
    await waitFor(
      page,
      '遮罩覆盖层出现',
      (h) => (document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0) >= 1,
      [MASK_HOST],
    );
    await waitStyle(page, '方案C不移除元素', '.rec-card', 'display', 'none', { not: true });
    const maskState = await page.evaluate((h) => {
      const first = document.querySelector('.rec-card').getBoundingClientRect();
      const box = document.querySelector(h).shadowRoot.querySelector('[data-pm-mask]').getBoundingClientRect();
      return box.top <= first.top + 2 && box.bottom >= first.bottom - 2 && box.width > 10;
    }, MASK_HOST);
    check(maskState, '方案C：遮罩出现且覆盖元素，元素本身不再被移除');
    check((await getProfile(ext.control, ORIGIN)).hideRules[0].strategy === 'mask', '方案C 写入存储');
    await shot(page, 'mask');
    await clickInShadow(page, EDITOR_HOST, tid('pm-editor-close'));
    await waitFor(page, '编辑面板关闭', (h) => !document.querySelector(h), [EDITOR_HOST]);
    check(true, '编辑面板关闭');

    // ===================== 悬浮按钮菜单（真实鼠标，#25） =====================
    console.log('\n--- 悬浮按钮「⋯」菜单打开编辑面板 ---');
    await clickInShadow(page, TOGGLE_HOST, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE_HOST, '[data-testid="pm-toggle-menu"]', { timeout: 3000 });
    await clickInShadow(page, TOGGLE_HOST, tid('pm-toggle-edit'));
    await waitForShadow(page, EDITOR_HOST, tid('pm-editor-panel'), { timeout: 5000 });
    check(true, '点菜单「编辑规则」打开编辑面板');
    check((await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '点菜单没有把开关切掉');
    await page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-editor-close"]')?.click(), EDITOR_HOST);
    await waitFor(page, '编辑面板关闭（复位）', (h) => !document.querySelector(h), [EDITOR_HOST]);
    await waitStyle(page, '复位到清爽态', '.rec-card', 'display', 'none', { not: true });

    // ===================== 页面样式隔离（#22） =====================
    console.log('\n--- 敌意页面样式：插件界面可见、外观不变 ---');
    await patchProfile(ext.control, ORIGIN, { hideRules: seedProfile(ORIGIN).hideRules, switchState: 'disguised' });
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    const normalUi = await snapshotUi(page, tabId);
    const hostile = await browser.newPage();
    await hostile.goto(`${ORIGIN}/hostile.html`, { waitUntil: 'load' });
    await hostile.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    const hostileTab = await tabIdOf(ext.control, `${ORIGIN}/hostile.html`);
    const hostileUi = await snapshotUi(hostile, hostileTab);
    check(
      (await hostile.evaluate(() => getComputedStyle(document.getElementById('page-title')).direction)) === 'rtl',
      '对照：敌意样式确实作用在页面上（正文 direction:rtl）',
    );
    check(
      hostileUi.toggleVisible && hostileUi.toggleHit,
      `敌意页面：悬浮按钮可见且点得到（宿主未被 html>*、body~* 规则藏掉；可见=${hostileUi.toggleVisible} 命中=${hostileUi.toggleHit}）`,
    );
    check(hostileUi.editorVisible, '敌意页面：编辑面板可见');
    check(hostileUi.lang === 'zh-CN', `shadow 内根容器 lang=zh-CN（${hostileUi.lang}）`);
    for (const part of ['toggle', 'editorClose', 'editorTitle']) {
      check(
        JSON.stringify(hostileUi[part]) === JSON.stringify(normalUi[part]),
        `敌意页面：${part} 的 line-height / direction / color / 字体与普通页面一致（${JSON.stringify(hostileUi[part])}）`,
      );
    }
    check(normalUi.editorClose.direction === 'ltr' && normalUi.editorClose.color !== 'rgb(255, 0, 0)', '界面文字 ltr、不是页面的红色');

    console.log('\n--- 输入框按键不冒泡到页面（不触发站点快捷键） ---');
    await sendToTab(ext.control, hostileTab, { t: 'openEditor' });
    await waitForShadow(hostile, EDITOR_HOST, '[data-testid^="pm-ed-selector-"]');
    await hostile.evaluate((h) => {
      window.__pmKeys = [];
      document.addEventListener('keydown', (e) => window.__pmKeys.push(e.key));
      const ta = document.querySelector(h).shadowRoot.querySelector('[data-testid^="pm-ed-selector-"]');
      ta.closest('details').open = true;
      ta.value = '';
      ta.focus();
    }, EDITOR_HOST);
    await hostile.keyboard.type('jk ');
    const typed = await hostile.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid^="pm-ed-selector-"]').value,
      EDITOR_HOST,
    );
    check(typed === 'jk ', `输入框照常收到按键（${JSON.stringify(typed)}）`);
    check((await hostile.evaluate(() => window.__pmKeys.length)) === 0, '页面 document 上的 keydown 监听一次都没触发');
    await hostile.evaluate(() => document.activeElement?.blur?.());
    await hostile.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.blur(), EDITOR_HOST);
    await hostile.keyboard.press('j');
    check((await hostile.evaluate(() => window.__pmKeys)).includes('j'), '对照：焦点不在插件界面时页面照常收到按键');
    await clickInShadow(hostile, EDITOR_HOST, tid('pm-editor-close'));

    console.log('\n--- 敌意页面上的向导工具条与 Esc ---');
    await sendToTab(ext.control, hostileTab, { t: 'openWizard', mode: 'addElement' });
    await waitForShadow(hostile, WIZARD_HOST, tid('pm-wizard-toolbar'));
    const wiz = await hostile.evaluate((h) => {
      const tb = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-toolbar"]');
      const r = tb.getBoundingClientRect();
      return { visible: tb.checkVisibility({ opacityProperty: true, visibilityProperty: true }), w: r.width, dir: getComputedStyle(tb).direction };
    }, WIZARD_HOST);
    check(wiz.visible && wiz.w > 100 && wiz.dir === 'ltr', `敌意页面：向导工具条可见、方向正常（${JSON.stringify(wiz)}）`);
    await hostile.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-exit"]').focus(), WIZARD_HOST);
    await hostile.keyboard.press('Escape');
    await waitFor(hostile, '焦点在向导内按 Esc 退出向导', (h) => !document.querySelector(h), [WIZARD_HOST], { timeout: 3000 });
    check(true, '按键隔离不影响向导自己的 Esc');
    await hostile.close();

    // ===================== SPA 路由变化（#22） =====================
    console.log('\n--- SPA 路由切换：生效范围立即重评估 ---');
    await page.bringToFront();
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await waitStyle(page, '首页页头被移除', '#site-header', 'display', 'none');
    check(isShown(await styleOf(page, '#side-promo')), '首页：仅章节页生效的 #side-promo 可见');
    check(
      (await evalInContentWorld(page, ext.extOrigin, "typeof navigation?.addEventListener === 'function'")) === true,
      '内容脚本隔离环境里有 Navigation API（WXT 路由事件不退回 1 秒轮询）',
    );
    for (let i = 1; i <= 3; i++) {
      await page.evaluate((n) => history.pushState({}, '', `/article/${n}`), i);
      await waitStyle(page, `pushState 到章节页 ${i} 后 #side-promo 立即被藏`, '#side-promo', 'display', 'none', { timeout: 600 });
      await page.evaluate(() => history.pushState({}, '', '/index.html'));
      await waitStyle(page, `pushState 回首页后 #side-promo 立即可见`, '#side-promo', 'display', 'none', { not: true, timeout: 600 });
    }
    check(true, 'pushState 往返 3 次，每次 600ms 内按新地址重评估（不等轮询）');
    await page.evaluate(() => history.back());
    await waitStyle(page, '浏览器后退（popstate）到章节页同样重评估', '#side-promo', 'display', 'none', { timeout: 600 });
    check(true, '后退（同文档历史）后同样立即重评估');

    console.log('\n--- 清爽期间翻页后切回原样：标题为最新页标题 ---');
    await page.evaluate(() => {
      history.pushState({}, '', '/article/9');
      document.title = '示例章节：第九章';
    });
    await waitFor(page, '翻页后标题仍被压成伪装标题', (t) => document.title === t, [DISGUISED_TITLE]);
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitFor(page, '切回原样后标题为最新页标题', () => document.title === '示例章节：第九章', [], { timeout: 3000 });
    check(true, '切回原样：标题是翻页后站点写入的「示例章节：第九章」');
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });

    // ===================== 管理页 / 引导页 =====================
    console.log('\n--- 管理页与引导页 ---');
    const mPage = await browser.newPage();
    await mPage.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
    await mPage.waitForSelector('.site-row', { timeout: 5000 });
    const mgmt = await mPage.evaluate(() => ({
      host: document.querySelector('.site-row .site-host')?.textContent ?? '',
      state: document.querySelector('.site-row .site-meta')?.textContent ?? '',
    }));
    check(mgmt.host.includes('127.0.0.1'), `管理页列出站点（${mgmt.host}）`);
    check(mgmt.state.includes('已收起'), `管理页显示收起项数与状态（${mgmt.state.trim()}）`);
    // 导出 / 导入在独立的「插件设置」页（#55）
    const sPage = await browser.newPage();
    await sPage.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
    await sPage.waitForSelector('input[type="file"][accept="application/json"]', { timeout: 3000 });
    const hasExport = await sPage.evaluate(() =>
      !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('导出配置')),
    );
    check(hasExport, '插件设置页有导出/导入');
    await sPage.close();
    await mPage.bringToFront();
    await shot(mPage, 'management');
    await mPage.close();

    const oPage = await browser.newPage();
    await oPage.goto(`${ext.extOrigin}/onboarding.html`, { waitUntil: 'load' });
    await oPage.waitForSelector('.step', { timeout: 5000 });
    check((await oPage.$$('.step')).length === 4, '引导页 4 步（含固定到工具栏）');
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
    await clickInShadow(page, WIZARD_HOST, tid('pm-wiz-exit'));
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
    console.log('\n--- runtime.reload() 后已配置站点仍然生效 ---');
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    // 已打开的清爽态页面：给旧实例的按钮打上标记，重载后检查它是否被撤下
    await page.bringToFront();
    await page.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await page.evaluate((h) => (document.querySelector(h).dataset.e2eOld = '1'), TOGGLE_HOST);
    await reloadExtension(ext);
    await expectDisguisedInNewPage(ORIGIN, '重载后新开页面仍处于清爽态（onInstalled 对账补注册）');

    // 约定：扩展更新 / 重载后，后台向已打开页面重新注入新脚本；旧实例收尾（撤下按钮、还原标题、
    // 交出样式记录），新实例接管。断言：旧按钮不在、只有一个按钮且属于活着的新实例；页面改标题后
    // 由新实例压回（没有两个守卫来回改）；用新按钮切回原样时标题为页面最新写入的值、旧实例注入的隐藏样式被撤掉
    console.log('\n--- 扩展重载后已打开页面：旧实例收尾、新实例接管 ---');
    await page.bringToFront();
    await waitFor(page, '旧实例的悬浮按钮被撤下', (h) => !document.querySelector(`${h}[data-e2e-old]`), [TOGGLE_HOST]);
    await waitFor(page, '新实例挂上悬浮按钮', (h) => document.querySelectorAll(h).length === 1, [TOGGLE_HOST]);
    check(true, '旧页面里没有僵尸按钮：旧按钮已撤下，只剩新实例的一个');
    check(
      (await evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive?.() === true')) === true,
      'window.__pagemask 登记的是活着的新实例',
    );
    await waitFor(page, '新实例保持清爽态标题', (t) => document.title === t, [DISGUISED_TITLE]);
    const fight = await page.evaluate(async () => {
      let mutations = 0;
      const mo = new MutationObserver((list) => (mutations += list.length));
      mo.observe(document.head, { childList: true, subtree: true, characterData: true });
      document.title = '重载后的新章节';
      await new Promise((res) => setTimeout(res, 1000));
      mo.disconnect();
      return { mutations, title: document.title };
    });
    check(
      fight.title === DISGUISED_TITLE && fight.mutations < 10,
      `页面改标题后只被新实例压回一次，没有互相改（1 秒内 head 变化 ${fight.mutations} 次）`,
    );
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitFor(page, '用新按钮切回原样：标题为页面最新写入的值', () => document.title === '重载后的新章节', [], { timeout: 3000 });
    await waitStyle(page, '旧实例注入的隐藏样式被新实例撤掉', '#site-header', 'display', 'none', { not: true, timeout: 3000 });
    check(true, '新实例接管：切回原样后标题为页面最新写入值，旧实例留下的隐藏样式也被撤掉');
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });

    // ===================== 撤销授权（工具自检 + 零影响） =====================
    console.log('\n--- 撤销授权 ---');
    // 确保动态注册存在（重载可能把它清掉），并用一个新页面做正向对照
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    // 上面的 enableSite 对已有运行时的页面又 executeScript 了一次（同一隔离环境的重复注入）：
    // 旧实例交出样式记录、新实例接管。只剩一个按钮；切回原样时隐藏样式被撤干净（同文本注入几次要删几次，
    // 没交接的话会多出一份删不掉）
    console.log('\n--- 同一页面被重复注入：新实例接管、样式记录交接 ---');
    await page.bringToFront();
    await waitStyle(page, '重复注入前后保持清爽态', '#site-header', 'display', 'none');
    await waitFor(page, '重复注入后只有一个悬浮按钮', (h) => document.querySelectorAll(h).length === 1, [TOGGLE_HOST]);
    check(
      (await evalInContentWorld(page, ext.extOrigin, 'window.__pagemask?.alive?.() === true')) === true,
      '重复注入后 window.__pagemask 指向活着的新实例，界面未被误撤',
    );
    await clickInShadow(page, TOGGLE_HOST, TOGGLE_BTN);
    await waitStyle(page, '切回原样后页头可见（没有多出删不掉的样式）', '#site-header', 'display', 'none', { not: true, timeout: 3000 });
    check(true, '重复注入后切回原样：隐藏样式被撤干净');
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await waitStyle(page, '切回清爽态', '#site-header', 'display', 'none');
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
    check((await getProfile(ext.control, ORIGIN)) !== null, '撤销授权不删站点配置');
    await after.close();

    // ===================== popup「重新授权」（#21） =====================
    console.log('\n--- 撤销授权后 popup 显示「重新授权」 ---');
    const site = await browser.newPage();
    await site.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    let popup = await openPopup(ext, site);
    await popup.waitForSelector(tid('pm-popup-reauth'), { timeout: 5000 });
    check(true, 'popup 显示「重新授权」');
    check(!(await popup.$(tid('pm-popup-setup'))), '待授权时不显示「添加要去掉的元素」');
    // 权限请求现在由后台发起（payload 由 core/background-engine.test.ts 覆盖），popup 里已经没有可替换的
    // permissions.request；真实权限弹窗无法自动化，这里只验证「允许之后恢复生效」这一半。
    await popup.close().catch(() => undefined);
    // 「允许」改用测试手段授予（重载 + manifest），之后对账让站点恢复生效。
    // 连 ORIGIN2 一起授予：这一步的重载会让只写 ORIGIN 的 manifest 丢掉 ORIGIN2 的运行时授权，
    // 而下面还要断言 ORIGIN2 配置后生效。
    await grantPermissions(ext, [ORIGIN, ORIGIN2]);
    await expectDisguisedInNewPage(ORIGIN, '重新授权后站点恢复生效（新开页面清爽态）');
    popup = await openPopup(ext, site);
    await popup.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
    check(!(await popup.$(tid('pm-popup-reauth'))), '授权恢复后 popup 不再显示「重新授权」');
    await popup.close().catch(() => undefined);
    await site.close();

    // ===================== 导出 → 一键清空 → 导入 → 一次授权全部（#21） =====================
    console.log('\n--- 导出配置 ---');
    await setProfile(ext.control, ORIGIN2, seedProfile(ORIGIN2));
    await expectDisguisedInNewPage(ORIGIN2, '第二个站点配置后生效');
    let mgmtPage = await openManagement();
    const exported = await exportFromManagement(mgmtPage);
    check(exported.profiles.length === 2, `导出包含 2 个站点（${exported.profiles.map((x) => x.origin).join('、')}）`);

    console.log('\n--- 一键清空后已打开页面立即恢复原样 ---');
    const open1 = await browser.newPage();
    await open1.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await waitFor(open1, '清空前：标题已替换', (t) => document.title === t, [DISGUISED_TITLE]);
    await waitStyle(open1, '清空前：页头被移除', '#site-header', 'display', 'none');
    await open1.waitForSelector(TOGGLE_HOST, { timeout: 8000 });
    await resetInManagement(mgmtPage, ORIGIN);
    await open1.bringToFront();
    // 不刷新页面：样式、标题、图标、悬浮按钮应立即全部还原
    await waitStyle(open1, '清空后页头立即可见', '#site-header', 'display', 'none', { not: true, timeout: 3000 });
    await waitStyle(open1, '清空后页脚立即可见', '#site-footer', 'visibility', 'visible', { timeout: 1000 });
    await waitFor(open1, '清空后标题还原', (t) => document.title === t, [FIXTURE_TITLE], { timeout: 3000 });
    await waitFor(open1, '清空后悬浮按钮消失', (h) => !document.querySelector(h), [TOGGLE_HOST], { timeout: 3000 });
    const icons = await open1.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel~="icon"]')).map((l) => l.getAttribute('href')),
    );
    check(icons.length === 1 && icons[0].startsWith('data:image/png;base64,iVBOR'), `清空后标签页图标还原为网站自己的（${icons.length} 个）`);
    check(
      !(await open1.evaluate((sel) => !!document.querySelector(sel), ALL_HOSTS)),
      '清空后页面上没有任何 PageMask 界面',
    );
    // 宿主保护样式也已撤掉：页面自己造一个同名元素，不再被设成 fixed
    const shieldLeft = await open1.evaluate((tag) => {
      const probe = document.createElement(tag);
      document.body.append(probe);
      const pos = getComputedStyle(probe).position;
      probe.remove();
      return pos;
    }, MASK_HOST);
    check(shieldLeft !== 'fixed', `清空后宿主保护样式已撤掉（同名探针 position=${shieldLeft}）`);
    check(true, '一键清空后已打开页面立即恢复原样（标题、图标、样式、悬浮按钮）');
    check((await getProfile(ext.control, ORIGIN)) === null, '站点配置已删除');
    check(
      !(await ext.control.evaluate((pt) => chrome.permissions.contains({ origins: [pt] }), `${ORIGIN}/*`)),
      '站点授权已收回',
    );
    await open1.close();
    await resetInManagement(mgmtPage, ORIGIN2);
    await waitFor(mgmtPage, '两个站点都已清空', () => document.querySelectorAll('.site-row').length === 0);

    console.log('\n--- 导入后一次授权全部 ---');
    await importInManagement(mgmtPage, exported);
    await mgmtPage.evaluate(() => {
      location.hash = '#/sites';
    });
    await mgmtPage.waitForSelector(tid('pm-mgmt-authorize-all'), { timeout: 5000 });
    const pendingCount = await mgmtPage.$$eval(tid('pm-mgmt-pending'), (els) => els.length);
    check(pendingCount === 2, `导入后两个站点都显示「待授权」（${pendingCount}）`);
    check(true, '管理页出现「一次授权全部」');
    const unregistered = await browser.newPage();
    await unregistered.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 1000)); // 负向断言：等过注入时机
    check(!(await unregistered.evaluate((h) => !!document.querySelector(h), TOGGLE_HOST)), '授权前导入的站点不生效');
    await unregistered.close();
    await stubPermissionRequest(mgmtPage);
    await mgmtPage.bringToFront();
    await mgmtPage.click(tid('pm-mgmt-authorize-all'));
    await waitFor(mgmtPage, '点击后发起权限请求', () => window.__pmRequests.length > 0);
    const batch = await mgmtPage.evaluate(() => window.__pmRequests);
    check(
      batch.length === 1 && [...batch[0].origins].sort().join() === [`${ORIGIN}/*`, `${ORIGIN2}/*`].sort().join(),
      `一次权限请求带上全部待授权站点（${JSON.stringify(batch)}）`,
    );
    await mgmtPage.close().catch(() => undefined);
    await grantPermissions(ext, [ORIGIN, ORIGIN2]);
    await expectDisguisedInNewPage(ORIGIN, '授权后导入的站点 1 生效');
    await expectDisguisedInNewPage(ORIGIN2, '授权后导入的站点 2 生效');
    mgmtPage = await openManagement();
    await waitFor(mgmtPage, '管理页列出两个站点', () => document.querySelectorAll('.site-row').length === 2);
    check(!(await mgmtPage.$(tid('pm-mgmt-pending'))), '授权后管理页不再显示「待授权」');
    await mgmtPage.close();

    // ===================== 安装警告（#21） =====================
    console.log('\n--- 安装时权限警告 ---');
    const prodManifest = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, 'manifest.json'), 'utf8'));
    check(!('content_scripts' in prodManifest) && !('host_permissions' in prodManifest), '产物 manifest 无 content_scripts / host_permissions');
    const warnings = await permissionWarnings(ext.control, prodManifest);
    check(Array.isArray(warnings) && warnings.length === 0, `安装警告为空数组（${JSON.stringify(warnings)}）`);

    // 以上用到的页面辅助函数
    async function expectDisguisedInNewPage(origin, label) {
      // 先等后台把内容脚本注册好：写入配置 → 对账注册之间有毫秒级空隙，
      // 直接开页面有时撞上「还没注册」，就会表现成内容脚本没注入。
      await waitFor(
        ext.control,
        `${label}：内容脚本已注册`,
        (o) => chrome.scripting.getRegisteredContentScripts().then((list) => list.some((s) => s.id === `pagemask:${o}`)),
        [origin],
        { timeout: 8000 },
      );
      const p = await browser.newPage();
      try {
        await p.goto(`${origin}/index.html`, { waitUntil: 'load' });
        await p.waitForSelector(TOGGLE_HOST, { timeout: 8000 }).catch(() => {
          throw new Error(`${label}：新开页面没有悬浮按钮（内容脚本未注入）`);
        });
        await waitStyle(p, `${label}：页头被移除`, '#site-header', 'display', 'none');
        check(true, label);
      } finally {
        await p.close();
      }
    }

    /**
     * 打开编辑面板，采集悬浮按钮与编辑面板里元素的计算样式、可见性（含祖先宿主的 display/opacity/visibility）
     * 与命中测试，然后关掉面板。用于对比普通页面与敌意页面。
     */
    async function snapshotUi(p, tab) {
      // 先采悬浮按钮（编辑面板是右侧抽屉，打开后会盖住右下角的按钮），再打开编辑面板采面板
      const collect = (part) =>
        p.evaluate(
          (which, th, tb, eh) => {
            const pick = (el) => {
              if (!el) return null;
              const cs = getComputedStyle(el);
              return {
                lineHeight: cs.lineHeight,
                direction: cs.direction,
                color: cs.color,
                fontFamily: cs.fontFamily,
                fontSize: cs.fontSize,
                letterSpacing: cs.letterSpacing,
              };
            };
            const visible = (el) => !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
            if (which === 'toggle') {
              const toggleHost = document.querySelector(th);
              const btn = toggleHost?.shadowRoot?.querySelector(tb);
              const r = btn?.getBoundingClientRect();
              return {
                toggleVisible: visible(btn) && r.width > 0 && r.height > 0,
                toggleHit: !!r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === toggleHost,
                lang: toggleHost?.shadowRoot?.querySelector('.pm-root')?.lang ?? null,
                toggle: pick(btn),
              };
            }
            const editorRoot = document.querySelector(eh)?.shadowRoot;
            const panel = editorRoot?.querySelector('[data-testid="pm-editor-panel"]');
            return {
              editorVisible: visible(panel),
              editorClose: pick(editorRoot?.querySelector('[data-testid="pm-editor-close"]')),
              editorTitle: pick(panel?.querySelector('span')),
            };
          },
          part,
          TOGGLE_HOST,
          TOGGLE_BTN,
          EDITOR_HOST,
        );
      const toggle = await collect('toggle');
      await sendToTab(ext.control, tab, { t: 'openEditor' });
      await waitForShadow(p, EDITOR_HOST, tid('pm-editor-panel'));
      const editor = await collect('editor');
      await clickInShadow(p, EDITOR_HOST, tid('pm-editor-close'));
      await waitFor(p, '编辑面板关闭', (h) => !document.querySelector(h), [EDITOR_HOST]);
      return { ...toggle, ...editor };
    }

    async function openManagement() {
      const m = await browser.newPage();
      await m.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
      await m.waitForSelector('.masthead h1', { timeout: 5000 });
      return m;
    }

    /** 点「导出配置」，截获生成的文件内容（不真的下载到磁盘）；导出在独立的「插件设置」页（#55） */
    async function exportFromManagement(m) {
      await m.bringToFront();
      await m.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
      await m.waitForSelector('xpath/.//button[normalize-space()="导出配置"]', { timeout: 3000 });
      await m.evaluate(() => {
        window.__pmBlobs = [];
        const orig = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (b) => {
          window.__pmBlobs.push(b);
          return orig(b);
        };
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (!this.download) click.call(this);
        };
      });
      await m.click('xpath/.//button[normalize-space()="导出配置"]');
      await waitFor(m, '导出文件生成', () => window.__pmBlobs.length > 0);
      const text = await m.evaluate(() => window.__pmBlobs[0].text());
      // 后面的步骤还在用这个页面（站点设置、清空），导完回到管理页
      await m.goto(`${ext.extOrigin}/management.html`, { waitUntil: 'load' });
      return JSON.parse(text);
    }

    /** 进某站点的设置页，点页脚的「一键清空」并确认（#41：入口从列表行迁到站点设置页） */
    async function resetInManagement(m, origin) {
      // 后台标签页里不跑动画帧，puppeteer 的点击会一直等元素稳定；先切到前台
      await m.bringToFront();
      const host = new URL(origin).host;
      await m.evaluate((h) => {
        location.hash = `#/sites/${h}`;
      }, host);
      const btn = await m.waitForSelector(tid('pm-mgmt-reset'), { timeout: 5000 });
      await btn.click();
      const yes = await m.waitForSelector('xpath/.//button[normalize-space()="确认清空"]', { timeout: 3000 });
      await yes.click();
      // 清空后站点设置页自动回列表：先等地址变回列表，再等这一行消失
      // （不先等地址的话，停在设置页上「行不存在」会被误判成清空成功）
      await waitFor(m, '清空后回到网站列表', () => location.hash === '#/sites', [], { timeout: 5000 });
      await waitFor(m, `管理页移除 ${origin}`, (o) => !document.querySelector(`li[data-origin="${o}"]`), [origin]);
    }

    /** 通过「插件设置」页的文件选择框导入（默认合并模式，#55） */
    async function importInManagement(m, bundle) {
      await m.bringToFront();
      await m.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
      await m.waitForSelector('input[type="file"][accept="application/json"]', { timeout: 3000 });
      const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm-e2e-import-')), 'pagemask-config.json');
      fs.writeFileSync(file, JSON.stringify(bundle));
      try {
        const input = await m.$('input[type="file"][accept="application/json"]');
        await input.uploadFile(file);
        await waitFor(m, '导入完成', () => document.body.innerText.includes('导入完成'));
      } finally {
        removeTempDir(path.dirname(file)); // 收尾失败不改用例结论
      }
      // 导入在插件设置页完成（0.4.0 起导出/导入搬到了独立页面），
      // 后续断言都在网站列表页上，这里把页面带回列表并让 store 重新读一遍
      await m.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
    }

    console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒，截图在 ${path.relative(process.cwd(), OUT)}/`);
  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
    await srv2.close();
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
