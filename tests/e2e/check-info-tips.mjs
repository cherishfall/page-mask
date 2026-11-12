/**
 * ⓘ 信息标真机守门（#183）：三个界面逐枚悬停 ⓘ，断言相邻气泡真的浮出来（display 非 none）、
 * boundingBox 完整落在视口内，并按宿主形态断言相对位置：
 * - 行内有开关（弹窗两行、站点设置页 media 行）：ⓘ 右缘 ≤ 开关左缘且间距 ≤ 12px（ⓘ 贴开关左侧）；
 * - 行内是标题（插件设置页三张卡头）：ⓘ 左缘 ≥ 标题右缘且间距 ≤ 12px（ⓘ 贴标题右侧）。
 *
 * 这条 E2E 就是 0.9.4 站点设置页漏掉的那个检查（#183）：气泡靠宿主行 pm-info-anchor
 * （position:relative）锚定，漏加时气泡贴到页面头上、渲染在视口外——静态上一切正常，
 * 只有真机 hover 才看得出来。「有没有锚」由 tests/info-tip-anchor.test.ts 静态守（少一个即红），
 * 这里守「锚得对不对」。相对位置全部用相对比较、不写死绝对 px：间距上限 12px ≈ 行 gap
 * （--pm-space-2 = 8px）减去 ⓘ 图标的负 margin（--pm-space-1 = 4px），实测约 4px，
 * 只挡「ⓘ 居中 / 跑远」这类形态回归，不锁具体布局参数。
 *
 * 覆盖：弹窗（ready 态，两枚）／插件设置页（三枚）／站点设置页（一枚，即 #183 修的那行）。
 * 不测：键盘聚焦浮出与 Esc 撤下（组件契约由 tests/copy-guidance.test.ts 真实挂载守着）。
 *
 * 运行：npm run build && node tests/e2e/check-info-tips.mjs
 * 也接在 npm run test:e2e 之后（见 package.json，check-media 之后）。
 */
import { createReporter, startServer } from './lib/harness.mjs';
import { launchExtension, openPopup, sendToBackground, setProfile, tabIdOf } from './lib/extension.mjs';
import { fixtureHandler } from './fixtures.mjs';

const r = createReporter();
const { check } = r;
const tid = (id) => `[data-testid="${id}"]`;

/** 间距上限（px），见文件头注释 */
const MAX_GAP = 12;

/**
 * 悬停一枚 ⓘ 并断言（形态见文件头注释）。hover 前先把宿主行滚到视口中部：
 * 要断言的是「锚得对不对」（气泡弹在行上方、行同宽），不是用户此刻碰巧的滚动位置。
 */
async function checkTip(page, trigger, label) {
  await page.evaluate((el) => el.closest('.pm-info-anchor')?.scrollIntoView({ block: 'center' }), trigger);
  await trigger.hover();
  await page.waitForFunction(
    (el) => getComputedStyle(el.nextElementSibling).display !== 'none',
    { timeout: 2000, polling: 50 },
    trigger,
  );
  const res = await page.evaluate((el) => {
    const bubble = el.nextElementSibling;
    const b = bubble.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const host = el.closest('.pm-info-anchor');
    const input = host?.querySelector('input[role="switch"]');
    const heading = host?.querySelector('h2, h3');
    return {
      isBubble: bubble.classList.contains('pm-info-tip-bubble'),
      text: (bubble.textContent ?? '').trim(),
      hasSwitch: !!input,
      hasHeading: !!heading,
      gap: input
        ? input.getBoundingClientRect().left - t.right
        : heading
          ? t.left - heading.getBoundingClientRect().right
          : null,
      inViewport:
        b.width > 0 &&
        b.height > 0 &&
        b.top >= 0 &&
        b.left >= 0 &&
        b.right <= window.innerWidth &&
        b.bottom <= window.innerHeight,
      rect: { top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), bottom: Math.round(b.bottom) },
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  }, trigger);
  check(res.isBubble && res.text.length > 0, `${label}：相邻兄弟是常驻 DOM 里的气泡，正文非空（组件契约）`);
  check(res.hasSwitch || res.hasHeading, `${label}：宿主行带 pm-info-anchor，行内能找到参照元素（开关或标题）`);
  check(
    res.inViewport,
    `${label}：气泡完整在视口内（rect=${JSON.stringify(res.rect)}，viewport=${res.viewport.w}x${res.viewport.h}）`,
  );
  if (res.hasSwitch) {
    check(res.gap >= 0, `${label}：ⓘ 不压住开关（ⓘ 右缘 ≤ 开关左缘，间距=${res.gap.toFixed(1)}px）`);
    check(res.gap <= MAX_GAP, `${label}：ⓘ 贴开关左侧（间距=${res.gap.toFixed(1)}px ≤ ${MAX_GAP}px）`);
  } else {
    check(res.gap >= 0, `${label}：ⓘ 不压住标题（ⓘ 左缘 ≥ 标题右缘，间距=${res.gap.toFixed(1)}px）`);
    check(res.gap <= MAX_GAP, `${label}：ⓘ 贴标题右侧（间距=${res.gap.toFixed(1)}px ≤ ${MAX_GAP}px）`);
  }
}

async function main() {
  const srv = await startServer(fixtureHandler);
  const ORIGIN = srv.origin;
  const HOST = new URL(ORIGIN).host;
  // extraPermissions:['tabs'] 只给测试拷贝：action.openPopup() 不授予 activeTab，popup 读网址需要它
  const ext = await launchExtension({ hostOrigins: [ORIGIN], extraPermissions: ['tabs'], revocable: false });
  try {
    // 有配置的站点（ready 态）：弹窗两枚 ⓘ（灰度行 + 悬浮按钮行）都在，站点设置页也才有内容
    const now = Date.now();
    await setProfile(ext.control, ORIGIN, {
      formatVersion: 1,
      origin: ORIGIN,
      switchState: 'disguised',
      disguisedTitle: null,
      icon: { kind: 'none' },
      // 一条不命中的规则：让这个站点「有设置」（悬浮按钮行以 hasProfile 为前提）
      hideRules: [
        { id: 'r_tip', elementName: '不存在的元素', candidates: ['#pm-not-in-this-page'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: now },
      ],
      floatingBtnPos: null,
      createdAt: now,
      updatedAt: now,
    });
    const page = await ext.browser.newPage();
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });

    // ===================== 弹窗（ready 态，两枚） =====================
    console.log('\n--- 弹窗：灰度行与悬浮按钮行的两枚 ⓘ ---');
    const popup = await openPopup(ext, page);
    await popup.waitForSelector(tid('pm-popup-media'), { timeout: 5000 });
    const popupTips = await popup.$$('.pm-info-tip-trigger');
    check(popupTips.length === 2, `弹窗 ready 态有两枚 ⓘ（${popupTips.length}）`);
    for (const [i, t] of popupTips.entries()) await checkTip(popup, t, `弹窗 ⓘ ${i + 1}/${popupTips.length}`);
    await popup.close();

    // ===================== 插件设置页（三枚） =====================
    console.log('\n--- 插件设置页：三张卡头的三枚 ⓘ ---');
    const settingsPage = await ext.browser.newPage();
    await settingsPage.bringToFront();
    await settingsPage.goto(`${ext.extOrigin}/settings.html`, { waitUntil: 'load' });
    await settingsPage.waitForSelector('.pm-info-tip-trigger', { timeout: 8000 });
    const settingsTips = await settingsPage.$$('.pm-info-tip-trigger');
    check(settingsTips.length === 3, `插件设置页有三枚 ⓘ（${settingsTips.length}）`);
    for (const [i, t] of settingsTips.entries()) await checkTip(settingsPage, t, `插件设置页 ⓘ ${i + 1}/${settingsTips.length}`);
    await settingsPage.close();

    // ===================== 站点设置页（一枚，#183 修的那行） =====================
    console.log('\n--- 站点设置页：「整页变灰」行的一枚 ⓘ（#183 回归点） ---');
    const mgmtPage = await ext.browser.newPage();
    await mgmtPage.bringToFront();
    await mgmtPage.goto(`${ext.extOrigin}/management.html#/sites/${HOST}`, { waitUntil: 'load' });
    await mgmtPage.waitForSelector(tid('pm-mgmt-media-mediaGray'), { timeout: 8000 });
    // #183 的直接回归点：宿主行必须带 pm-info-anchor（closest 找不到时 checkTip 也会红）
    const mediaRowClass = await mgmtPage.$eval('.media-switch', (el) => el.className);
    check(mediaRowClass.includes('pm-info-anchor'), `「整页变灰」行带 pm-info-anchor（class="${mediaRowClass}"）`);
    const mgmtTips = await mgmtPage.$$('.pm-info-tip-trigger');
    check(mgmtTips.length === 1, `站点设置页只有一枚 ⓘ（${mgmtTips.length}）`);
    for (const [i, t] of mgmtTips.entries()) await checkTip(mgmtPage, t, `站点设置页 ⓘ ${i + 1}/${mgmtTips.length}`);
    await mgmtPage.close();
  } finally {
    await ext.cleanup();
    await srv.close();
  }
}

try {
  await main();
} catch (e) {
  r.fail(e);
}
process.exitCode = r.summary();
