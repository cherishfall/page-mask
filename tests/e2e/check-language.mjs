/**
 * 界面语言即时切换（#57）实测：中文浏览器里把语言切成 English，所有已经打开的页面
 * （插件弹窗、管理页、插件设置页、页面内的小胶囊 / 向导 / 编辑面板）不刷新立刻变英文；
 * 切回「自动」后立刻变回中文。同时验证英文下弹窗（320px 最窄）不横向溢出。
 *
 * 运行：npm run build && node tests/e2e/check-language.mjs
 * （macOS 用 -AppleLanguages 把浏览器界面启动成中文，见 check-i18n.mjs 的实测记录）
 */
import { createReporter, startServer } from './lib/harness.mjs';
import {
  getSettings,
  launchExtension,
  openPopup,
  patchProfile,
  sendToBackground,
  sendToTab,
  tabIdOf,
} from './lib/extension.mjs';
import { fixtureHandler } from './fixtures.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const TOGGLE = 'pagemask-toggle';
const WIZARD = 'pagemask-wizard';
const EDITOR = 'pagemask-editor';
const tid = (id) => `[data-testid="${id}"]`;

const srv = await startServer(fixtureHandler);
const ORIGIN = srv.origin;

const now = Date.now();
const profileOf = (o) => ({
  formatVersion: 1,
  origin: o,
  switchState: 'disguised',
  disguisedTitle: 'Reading later',
  faviconDataUrl: null,
  hideRules: [
    {
      id: 'r-ad',
      elementName: '广告位',
      candidates: ['.ad'],
      strategy: 'remove',
      scope: { type: 'all' },
      onlyThis: false,
      createdAt: now,
      lastHealth: 'ok',
    },
  ],
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
});

/** 把浏览器界面启动成中文（macOS CfT 只认 -AppleLanguages，见 check-i18n.mjs） */
const langArgs = ['--lang=zh-CN', '-AppleLanguages', '(zh-CN)'];

const ext = await launchExtension({ hostOrigins: [ORIGIN], args: langArgs, extraPermissions: ['tabs'] });
try {
  await patchProfile(ext.control, ORIGIN, profileOf(ORIGIN));
  // 固定站点页面（小胶囊 / 向导 / 编辑面板住在这里）
  const page = await ext.browser.newPage();
  await page.setViewport({ width: 1000, height: 700 });
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
  await page.waitForSelector(TOGGLE, { timeout: 8000 });

  // 管理页与插件设置页各开一个标签页，全程不刷新——切语言要即时生效
  const mgmt = await ext.browser.newPage();
  await mgmt.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
  const settingsPage = await ext.browser.newPage();
  await settingsPage.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
  const textOf = (p, sel) => p.$eval(sel, (el) => el.textContent.trim());
  const bodyHas = async (p, text) => p.evaluate((t) => document.body.textContent.includes(t), text);

  // ---------- 初始：auto = 浏览器中文 ----------
  console.log('\n--- 初始状态（自动 → 浏览器中文） ---');
  check((await shadowText(page, TOGGLE, `${tid('pm-toggle-main')} .pm-tg-label`)) === '清爽', '小胶囊显示「清爽」');
  check(await bodyHas(mgmt, '你添加的网站'), '管理页是中文');
  check(await bodyHas(settingsPage, '插件设置'), '插件设置页是中文');
  const autoLabel = await textOf(settingsPage, 'label[for="pm-settings-lang-auto"]');
  check(autoLabel === '自动（当前：简体中文）', `「自动」后面显示当前探测结果（${autoLabel}）`);
  check((await textOf(settingsPage, 'label[for="pm-settings-lang-zh"]')) === '简体中文', '语言名用本语言书写（简体中文）');
  check((await textOf(settingsPage, 'label[for="pm-settings-lang-en"]')) === 'English', '语言名用本语言书写（English）');
  const checked = await settingsPage.$eval('input[name="pm-settings-language"]:checked', (el) => el.value);
  check(checked === 'auto', '默认选中「自动」');

  // 弹窗（popup 会死上下文，每次重新开）
  let popup = await openPopup(ext, page);
  check(await popup.evaluate(() => document.body.textContent.includes('管理全部网站')), '弹窗是中文');
  check(await popup.evaluate(() => document.body.textContent.includes('遮住本页')), '弹窗「遮住本页」是中文');
  await popup.close();

  // 页内向导
  await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
  await waitForShadow(page, WIZARD, tid('pm-wiz-heading'));
  check((await shadowText(page, WIZARD, tid('pm-wiz-heading'))) === '点选要收起的内容', '向导标题是中文');
  await clickInShadow(page, WIZARD, tid('pm-wiz-exit'));
  await page.waitForFunction((h) => !document.querySelector(h), { timeout: 5000 }, WIZARD);
  await page.waitForFunction((h) => !document.querySelector(h), { timeout: 5000 }, WIZARD);

  // ---------- 切到 English：一切打开着的页面立刻变，不刷新 ----------
  console.log('\n--- 切到 English（不刷新任何页面） ---');
  await settingsPage.bringToFront();
  await settingsPage.evaluate(
    (sel) => document.querySelector(sel)?.click(),
    tid('pm-settings-lang-en'),
  );
  await settingsPage.waitForFunction(
    () => document.querySelector('h1')?.textContent.trim() === 'Settings',
    { timeout: 5000 },
  );
  check(true, '插件设置页本页立刻变英文');

  await mgmt.waitForFunction(() => document.body.textContent.includes('Your sites'), { timeout: 5000 });
  check(true, '管理页（另一个标签页）没刷新就变英文');

  await page.waitForFunction(
    (h) => document.querySelector(h)?.shadowRoot?.querySelector('.pm-tg-label')?.textContent === 'Clean',
    { timeout: 5000 },
    TOGGLE,
  );
  check(true, '页面内小胶囊没刷新就变英文');

  await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
  await waitForShadow(page, WIZARD, tid('pm-wiz-heading'));
  check((await shadowText(page, WIZARD, tid('pm-wiz-heading'))) === 'Pick what to hide', '向导变英文');
  await clickInShadow(page, WIZARD, tid('pm-wiz-exit'));
  await page.waitForFunction((h) => !document.querySelector(h), { timeout: 5000 }, WIZARD);
  await page.waitForFunction((h) => !document.querySelector(h), { timeout: 5000 }, WIZARD);

  // 页内编辑面板
  await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openEditor' });
  await waitForShadow(page, EDITOR, tid('pm-editor-panel'));
  check((await shadowText(page, EDITOR, '#pm-ed-title')) === 'Edit hidden items', '编辑面板标题是英文');
  check(
    (await shadowText(page, EDITOR, tid('pm-editor-add'))).includes('Hide more'),
    '编辑面板「收起更多内容」是英文',
  );
  await page.keyboard.press('Escape');

  popup = await openPopup(ext, page);
  check(await popup.evaluate(() => document.body.textContent.includes('Manage all sites')), '弹窗变英文');
  check(await popup.evaluate(() => document.body.textContent.includes('Cover this page')), '弹窗「Cover this page」');
  // 英文排版：320px 最窄弹窗不横向溢出
  const overflow = await popup.evaluate(() => ({
    scroll: document.scrollingElement.scrollWidth,
    client: document.scrollingElement.clientWidth,
    width: document.querySelector('main.popup')?.getBoundingClientRect().width ?? 0,
  }));
  check(overflow.scroll <= overflow.client, `英文弹窗不横向溢出（scroll=${overflow.scroll} ≤ client=${overflow.client}）`);
  check(Math.round(overflow.width) === 320, `弹窗宽度仍是最窄 320px（${Math.round(overflow.width)}px）`);
  await popup.close();

  // 语言名不翻译：英文界面下仍是 简体中文 / English
  check((await textOf(settingsPage, 'label[for="pm-settings-lang-zh"]')) === '简体中文', '英文界面下「简体中文」不翻译');
  const intro = await textOf(settingsPage, 'label[for="pm-settings-lang-auto"]');
  check(intro.startsWith('Automatic (currently '), `英文下「自动」显示探测结果（${intro}）`);

  // ---------- 切回自动：立刻变回中文 ----------
  console.log('\n--- 切回自动（浏览器中文） ---');
  await settingsPage.bringToFront();
  await settingsPage.evaluate(
    (sel) => document.querySelector(sel)?.click(),
    tid('pm-settings-lang-auto'),
  );
  await settingsPage.waitForFunction(() => document.querySelector('h1')?.textContent.trim() === '插件设置', { timeout: 5000 });
  check(true, '设置页变回中文');
  await mgmt.waitForFunction(() => document.body.textContent.includes('你添加的网站'), { timeout: 5000 });
  check(true, '管理页变回中文');
  await page.waitForFunction(
    (h) => document.querySelector(h)?.shadowRoot?.querySelector('.pm-tg-label')?.textContent === '清爽',
    { timeout: 5000 },
    TOGGLE,
  );
  check(true, '小胶囊变回中文');
  const popup2 = await openPopup(ext, page);
  check(await popup2.evaluate(() => document.body.textContent.includes('管理全部网站')), '重开的弹窗也是中文');
  await popup2.close();

  // 设置确实落库（uiLanguage 回到 auto）
  const settings = await getSettings(ext.control);
  check(settings.uiLanguage === 'auto', `uiLanguage 落库为 auto（${settings.uiLanguage}）`);

  await mgmt.close();
  await settingsPage.close();
} finally {
  await ext.cleanup();
  srv.close();
}

process.exitCode = r.summary();
