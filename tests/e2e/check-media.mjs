/**
 * #116 真机验收：按站点「收起图片 / 收起视频 / 静音网页」三处入口 + 页面效果。
 *
 * 运行：npm run build && node tests/e2e/check-media.mjs
 * 也接在 npm run test:e2e 之后（见 package.json）。
 *
 * 覆盖：
 * - 弹窗：三个开关的叫法、默认关、点击写进站点配置、只改拨动的那一个字段；
 *   重开弹窗后仍按存储显示（与站点设置页、胶囊菜单同一份数据）
 * - 站点设置页：「图片、视频和声音」卡片、三个开关与逐行说明、点击后页面效果即时变化
 * - 悬浮按钮 ⋯ 菜单：三个 role="switch" 的勾选项、aria-checked、点一下不关菜单、写入后勾选就地变
 * - 页面效果：大图变灰块（filter: brightness(0)）、≤32px 小图标留原样、视频被静音、
 *   标签页静音由本扩展设置（reason=extension）
 * - 两态边界：切「网站原样」后灰块、视频静音、标签页静音全部还原；切回来重新生效
 *
 * 不测：请求是否被拦（本期明确「视觉收起 ≠ 不加载」）、iframe 内嵌播放器、背景图。
 */
import { createReporter, poll, startServer, waitFor } from './lib/harness.mjs';
import {
  getProfile,
  launchExtension,
  openPopup,
  patchSettings,
  setProfile,
  sendToBackground,
  tabIdOf,
} from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const tid = (id) => `[data-testid="${id}"]`;
const TOGGLE = 'pagemask-toggle';
const KEYS = ['hideImages', 'hideVideos', 'mutePage'];
const LABELS = ['收起图片', '收起视频', '静音网页'];

/** 内联 SVG，避免测试页发起额外请求（也不含 emoji 字样，不会走选择器里的豁免） */
const PICTURE = 'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="tomato"/></svg>');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>media check</title>
<style>
  #big { display: block; width: 200px; height: 120px; }
  #icon { display: block; width: 16px; height: 16px; }
  #vid { display: block; width: 160px; height: 90px; background: #333; }
</style></head><body>
  <img id="big" src="${PICTURE}" alt="大图">
  <img id="icon" src="${PICTURE}" alt="按钮小图标">
  <!-- 初始不出声标记不能有：media-controller 要还原成它记住的原值，E2E 才分得清「被我们静音」 -->
  <video id="vid"></video>
</body></html>`;
const handler = (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};

/** 页面上三种媒体元素的实际状态（读计算样式与 DOM 属性，不看存储） */
const mediaState = (page) =>
  page.evaluate(() => {
    const big = document.querySelector('#big');
    const icon = document.querySelector('#icon');
    const vid = document.querySelector('#vid');
    return {
      bigFilter: getComputedStyle(big).filter,
      bigBg: getComputedStyle(big).backgroundColor,
      iconFilter: getComputedStyle(icon).filter,
      iconKept: icon.hasAttribute('data-pm-media-keep'),
      videoMuted: vid.muted,
      videoPaused: vid.paused,
    };
  });

const greyed = (filter) => filter.includes('brightness(0)');

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const HOST = new URL(ORIGIN).host;
  // extraPermissions:['tabs'] 只给测试拷贝：action.openPopup() 不授予 activeTab，popup 读网址需要它
  const ext = await launchExtension({ hostOrigins: [ORIGIN], extraPermissions: ['tabs'], revocable: false });
  const { browser, control, extOrigin } = ext;
  try {
    await patchSettings(control, { uiLanguage: 'zh' }); // 文案断言固定走中文
    const now = Date.now();
    await setProfile(control, ORIGIN, {
      formatVersion: 1,
      origin: ORIGIN,
      switchState: 'disguised',
      disguisedTitle: null,
      icon: { kind: 'none' },
      // 一条不命中的规则：让这个站点「有设置」，页面上的悬浮按钮才会挂
      hideRules: [
        { id: 'r_media', elementName: '不存在的元素', candidates: ['#pm-not-in-this-page'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: now },
      ],
      floatingBtnPos: null,
      createdAt: now,
      updatedAt: now,
    });
    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
    const tabId = await tabIdOf(control, `${ORIGIN}/*`);
    await sendToBackground(control, { t: 'enableSite', origin: ORIGIN, tabId });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const tabMuted = () =>
      control.evaluate(async (id) => (await chrome.tabs.get(id)).mutedInfo ?? null, tabId);

    // ===================== 弹窗 =====================
    console.log('\n--- 弹窗：三行开关、叫法与写入 ---');
    const popup = await openPopup(ext, page);
    await popup.waitForSelector(tid('pm-popup-media'), { timeout: 5000 });
    const popupRows = await popup.$$eval(`${tid('pm-popup-media')} .switch-row`, (rows) =>
      rows.map((row) => ({
        label: row.querySelector('label')?.textContent.trim() ?? '',
        role: row.querySelector('input')?.getAttribute('role'),
        checked: row.querySelector('input')?.checked,
      })),
    );
    check(popupRows.length === 3, `弹窗里正好三行媒体开关（实际 ${popupRows.length}）`);
    check(
      popupRows.map((x) => x.label).join(' / ') === LABELS.join(' / '),
      `三行叫法一致（${popupRows.map((x) => x.label).join(' / ')}）`,
    );
    check(popupRows.every((x) => x.role === 'switch' && x.checked === false), '三行都是读屏认得的开关，默认关');
    check(
      (await popup.$eval(tid('pm-popup-media'), (g) => g.getAttribute('role'))) === 'group',
      '三行收成一组（role=group），不是三个散落的开关',
    );

    await popup.click(tid('pm-popup-media-hideImages'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideImages === true, '弹窗拨「收起图片」写入存储');
    const afterImages = await getProfile(control, ORIGIN);
    check(afterImages.hideVideos === undefined && afterImages.mutePage === undefined, '只改拨动的那一个字段');
    await waitFor(page, '大图变灰块', () => getComputedStyle(document.querySelector('#big')).filter.includes('brightness(0)'), [], { timeout: 8000 });
    await waitFor(page, '小图标被豁免', () => document.querySelector('#icon').hasAttribute('data-pm-media-keep'), [], { timeout: 8000 });
    const imageState = await mediaState(page);
    check(greyed(imageState.bigFilter) && imageState.bigBg !== 'rgba(0, 0, 0, 0)', `大图是灰块（filter=${imageState.bigFilter}，底色=${imageState.bigBg}）`);
    check(imageState.iconKept && !greyed(imageState.iconFilter), `小图标留原样（filter=${imageState.iconFilter}）`);

    await popup.click(tid('pm-popup-media-hideVideos'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideVideos === true, '弹窗拨「收起视频」写入存储');
    await waitFor(page, '视频被静音', () => document.querySelector('#vid').muted === true, [], { timeout: 8000 });
    const videoState = await mediaState(page);
    check(videoState.videoMuted && videoState.videoPaused, '视频停播且不出声');

    await popup.click(tid('pm-popup-media-mutePage'));
    await poll(async () => (await getProfile(control, ORIGIN)).mutePage === true, '弹窗拨「静音网页」写入存储');
    await poll(async () => (await tabMuted())?.muted === true, '标签页静音生效', { timeout: 8000 });
    const muted = await tabMuted();
    check(muted.reason === 'extension', `静音由本扩展设置（reason=${muted.reason}）`);

    await popup.close();

    // ===================== 胶囊 ⋯ 菜单 =====================
    console.log('\n--- 悬浮按钮 ⋯ 菜单：勾选项与就地状态 ---');
    await page.bringToFront();
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    const menuBefore = await page.evaluate((h, keys) => {
      const menu = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]');
      return keys.map((k) => {
        const b = menu.querySelector(`[data-testid="pm-toggle-media-${k}"]`);
        return { role: b?.getAttribute('role'), checked: b?.getAttribute('aria-checked'), mark: !!b?.querySelector('.pm-tg-tick') };
      });
    }, TOGGLE, KEYS);
    check(menuBefore.length === 3 && menuBefore.every((x) => x.role === 'switch'), '菜单里三个勾选项都是 role=switch');
    check(menuBefore.every((x) => x.checked === 'true' && x.mark), '弹窗里拨过的三个开关，菜单里都显示勾中');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-media-hideVideos'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideVideos === undefined, '菜单拨「收起视频」写回存储');
    const menuStillOpen = await page.evaluate(
      (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-menu"]')?.matches(':popover-open'),
      TOGGLE,
    );
    check(menuStillOpen, '拨一下不关菜单，可以连着拨几个');
    const flipped = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-media-hideVideos"]')?.getAttribute('aria-checked'),
      TOGGLE,
    );
    check(flipped === 'false', '勾选就地变成未选中（aria-checked=false）');
    const offBox = await page.evaluate(
      (h) =>
        !!document
          .querySelector(h)
          ?.shadowRoot?.querySelector('[data-testid="pm-toggle-media-hideVideos"] .pm-tg-box'),
      TOGGLE,
    );
    check(offBox, '未选中项也画一个淡空框，不和菜单里的普通动作项混淆（#127）');
    await waitFor(page, '关掉后视频恢复原来的静音状态', () => document.querySelector('#vid').muted === false, [], { timeout: 8000 });
    check(true, '关掉「收起视频」后视频的静音被还原');
    // 拨回来，留给后面的两态边界检查
    await clickInShadow(page, TOGGLE, tid('pm-toggle-media-hideVideos'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideVideos === true, '菜单把「收起视频」拨回来');
    await page.keyboard.press('Escape');

    // ===================== 站点设置页 =====================
    console.log('\n--- 站点设置页：卡片、逐行说明与写入 ---');
    const m = await browser.newPage();
    await m.bringToFront();
    await m.goto(`${extOrigin}/management.html#/sites/${HOST}`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-media-hideImages'), { timeout: 8000 });
    const sections = await m.$$eval('main h3', (hs) => hs.map((h) => h.textContent.trim()));
    check(sections.includes('图片、视频和声音'), `站点设置页有「图片、视频和声音」卡片（${sections.join(' / ')}）`);
    const siteRows = await m.$$eval('.media-row', (rows) =>
      rows.map((row) => ({
        label: row.querySelector('label')?.textContent.trim() ?? '',
        hint: row.querySelector('.hint')?.textContent.trim() ?? '',
        checked: row.querySelector('input')?.checked,
      })),
    );
    check(siteRows.length === 3, '站点设置页正好三行开关');
    check(siteRows.map((x) => x.label).join(' / ') === LABELS.join(' / '), '与弹窗同一组叫法');
    check(siteRows.every((x) => x.hint.length > 0), '每行都有一句说明，跟着它解释的开关走');
    check(siteRows.every((x) => x.checked === true), '三处界面读同一份存储：菜单拨回来的状态在设置页也是开');
    check((await m.evaluate(() => document.body.innerText)).includes('图片其实还在加载'), '卡片底部如实说明「不是不加载」');
    await m.click(tid('pm-mgmt-media-hideImages'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideImages === undefined, '站点设置页关掉「收起图片」写入存储');
    await waitFor(page, '大图不再是灰块', () => !getComputedStyle(document.querySelector('#big')).filter.includes('brightness(0)'), [], { timeout: 8000 });
    check(true, '另一处入口拨动，页面效果即时跟着变');
    await m.click(tid('pm-mgmt-media-hideImages'));
    await poll(async () => (await getProfile(control, ORIGIN)).hideImages === true, '站点设置页把「收起图片」拨回来');
    await m.close();

    // ===================== 两态边界 =====================
    console.log('\n--- 「网站原样」全部还原，切回来重新生效 ---');
    await page.bringToFront();
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main')); // 胶囊主按钮切到原样
    await poll(async () => (await getProfile(control, ORIGIN)).switchState === 'original', '切到「网站原样」');
    await waitFor(page, '原样态大图不再灰', () => !getComputedStyle(document.querySelector('#big')).filter.includes('brightness(0)'), [], { timeout: 8000 });
    await waitFor(page, '原样态视频恢复静音状态', () => document.querySelector('#vid').muted === false, [], { timeout: 8000 });
    await poll(async () => (await tabMuted())?.muted === false, '原样态标签页声音回来', { timeout: 8000 });
    const originalState = await mediaState(page);
    check(!greyed(originalState.bigFilter) && !originalState.videoMuted && !originalState.iconKept, '原样态：灰块、视频静音、小图标记一并撤掉');
    check((await tabMuted())?.muted === false, '原样态：标签页静音解除，不留一个哑掉的标签页');

    await clickInShadow(page, TOGGLE, tid('pm-toggle-main')); // 切回按设置
    await poll(async () => (await getProfile(control, ORIGIN)).switchState === 'disguised', '切回「按你的设置显示」');
    await waitFor(page, '切回来大图重新变灰块', () => getComputedStyle(document.querySelector('#big')).filter.includes('brightness(0)'), [], { timeout: 8000 });
    await poll(async () => (await tabMuted())?.muted === true, '切回来标签页重新静音', { timeout: 8000 });
    check(true, '切回清爽态：三个开关的效果全部回来，配置没丢');
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
