/**
 * 0.8.0 真机验收（#131，ADR-0013）：按站点「图片和视频变灰」一处开关 + 幕布静音。
 *
 * 运行：npm run build && node tests/e2e/check-media.mjs
 * 也接在 npm run test:e2e 之后（见 package.json）。
 *
 * 覆盖：
 * - 弹窗：一行开关的叫法、默认关、点击写进站点配置；
 * - 页面效果：大图 grayscale(1)、≤32px 小图标留原样（豁免标记）、视频的 muted 全程没人动；
 * - 自动播放压制：play 事件被按停（paused 变 true）；点击视频区域后放行（synthetic play 不再被按停）
 * - 胶囊媒体钮：全功能与 mini 形态都有、aria-pressed 与实心/描边两态、点一下写存储
 * - 站点设置页：「图片和视频」卡片、一行开关与说明、点击后页面效果即时变化
 * - 幕布静音：遮住即静音（reason=extension）、恢复即还原；媒体层不写 muted
 * - 两态边界（0.8.3）：切「网站原样」定制还原、灰度独立照常生效；原样态下媒体钮有可见反应；
 *   切回来压制照常
 *
 * 不测：请求是否被拦（「看起来变灰 ≠ 不加载」）、iframe 内嵌播放器、背景图。
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

/** 内联 SVG，避免测试页发起额外请求（也不含 emoji 字样，不会走选择器里的豁免） */
const PICTURE = 'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="tomato"/></svg>');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>media check</title>
<style>
  #big { display: block; width: 200px; height: 120px; }
  #icon { display: block; width: 16px; height: 16px; }
  #vid, #vid2 { display: block; width: 160px; height: 90px; background: #333; }
</style></head><body>
  <img id="big" src="${PICTURE}" alt="大图">
  <img id="icon" src="${PICTURE}" alt="按钮小图标">
  <!-- 两个都不带 muted 初始标记：媒体层不写 muted，全程应保持 false -->
  <video id="vid"></video>
  <video id="vid2"></video>
</body></html>`;
const handler = (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};

/** 页面上媒体元素的实际状态（读计算样式与 DOM 属性，不看存储） */
const mediaState = (page) =>
  page.evaluate(() => {
    const big = document.querySelector('#big');
    const icon = document.querySelector('#icon');
    const vid = document.querySelector('#vid');
    return {
      bigFilter: getComputedStyle(big).filter,
      iconFilter: getComputedStyle(icon).filter,
      iconKept: icon.hasAttribute('data-pm-media-keep'),
      videoMuted: vid.muted,
      videoPaused: vid.paused,
    };
  });

const grayed = (filter) => filter.includes('grayscale(1)');

/** 真实调一次 play()：无源视频也会同步置 paused=false、异步触发 play 事件——
 *  被内容脚本按停的会回到 true，被放行的停在 false，两条断言都有分辨力。
 *  play() 的 promise 可能永远 pending（没有可播的资源），绝不能把它返回给 evaluate */
const tryPlay = (page, sel) =>
  page.evaluate((s) => {
    const p = document.querySelector(s).play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, sel);

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
    console.log('\n--- 弹窗：一行开关、叫法与写入 ---');
    const popup = await openPopup(ext, page);
    await popup.waitForSelector(tid('pm-popup-media'), { timeout: 5000 });
    const popupSwitch = await popup.$eval(`${tid('pm-popup-media')} .switch-row`, (row) => ({
      label: row.querySelector('label')?.textContent.trim() ?? '',
      role: row.querySelector('input')?.getAttribute('role'),
      checked: row.querySelector('input')?.checked,
    }));
    check(popupSwitch.label === '图片和视频变灰', `开关叫法一致（${popupSwitch.label}）`);
    check(popupSwitch.role === 'switch' && popupSwitch.checked === false, '读屏认得的开关，默认关');
    check(
      (await popup.$eval(tid('pm-popup-media'), (g) => g.getAttribute('role'))) === 'group',
      '开关带说明收成一组（role=group）',
    );

    await popup.click(tid('pm-popup-media-mediaGray'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === true, '弹窗拨「图片和视频变灰」写入存储');
    await waitFor(page, '大图变灰', () => getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    await waitFor(page, '小图标被豁免', () => document.querySelector('#icon').hasAttribute('data-pm-media-keep'), [], { timeout: 8000 });
    const imageState = await mediaState(page);
    check(grayed(imageState.bigFilter), `大图是灰度（filter=${imageState.bigFilter}）`);
    check(imageState.iconKept && !grayed(imageState.iconFilter), `小图标留原样（filter=${imageState.iconFilter}）`);
    check(imageState.videoMuted === false, '媒体层不写视频的 muted（声音归播放器与用户）');

    await popup.close();

    // ===================== 页面效果：压制与放行 =====================
    console.log('\n--- 自动播放压制与点击放行 ---');
    await tryPlay(page, '#vid');
    await waitFor(page, '自动播放被按停', () => document.querySelector('#vid').paused, [], { timeout: 8000 });
    check(true, '站点自己触发的 play 被压住（paused 回到 true）');
    check((await mediaState(page)).videoMuted === false, '按停也不碰 muted');

    await page.click('#vid2'); // 用户点视频区域：真实 pointerdown
    await tryPlay(page, '#vid2');
    await waitFor(page, '点击放行', () => !document.querySelector('#vid2').paused, [], { timeout: 8000 });
    check(true, '点击视频区域后放行（synthetic play 不再被按停）');

    // ===================== 胶囊媒体钮 =====================
    console.log('\n--- 悬浮按钮「媒体」钮：状态与写入 ---');
    await page.bringToFront();
    const btnState = await page.evaluate((h) => {
      const b = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-media"]');
      return {
        pressed: b?.getAttribute('aria-pressed'),
        state: b?.querySelector('svg')?.getAttribute('data-state'),
        inMini: null,
      };
    }, TOGGLE);
    check(btnState.pressed === 'true' && btnState.state === 'on', `弹窗拨过的状态在媒体钮上显示开（${JSON.stringify(btnState)}）`);

    await clickInShadow(page, TOGGLE, tid('pm-toggle-media'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === undefined, '媒体钮点一下写回存储（关）');
    await waitFor(page, '关掉后大图恢复彩色', () => !getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    const btnOff = await page.evaluate((h) => {
      const b = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-media"]');
      return { pressed: b?.getAttribute('aria-pressed'), state: b?.querySelector('svg')?.getAttribute('data-state') };
    }, TOGGLE);
    check(btnOff.pressed === 'false' && btnOff.state === 'off', '按钮状态就地变成关（描边）');

    // mini 形态也要有媒体钮（#131）
    await clickInShadow(page, TOGGLE, tid('pm-toggle-shrink'));
    await poll(
      async () => (await getProfile(control, ORIGIN)).capsuleMini === true,
      '切成 mini 形态',
    );
    const miniHas = await page.evaluate(
      (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-media"]'),
      TOGGLE,
    );
    check(miniHas, 'mini 形态也有媒体钮');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-media'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === true, 'mini 的媒体钮也能开');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-expand'));
    await poll(
      async () => (await getProfile(control, ORIGIN)).capsuleMini !== true, // 关掉的布尔字段在存储里消失
      '展开回全功能',
    );

    // ===================== 站点设置页 =====================
    console.log('\n--- 站点设置页：卡片、说明与写入 ---');
    const m = await browser.newPage();
    await m.bringToFront();
    await m.goto(`${extOrigin}/management.html#/sites/${HOST}`, { waitUntil: 'load' });
    await m.waitForSelector(tid('pm-mgmt-media-mediaGray'), { timeout: 8000 });
    const sections = await m.$$eval('main h3', (hs) => hs.map((h) => h.textContent.trim()));
    check(sections.includes('图片和视频'), `站点设置页有「图片和视频」卡片（${sections.join(' / ')}）`);
    const row = await m.$eval('.media-row', (el) => ({
      label: el.querySelector('label')?.textContent.trim() ?? '',
      hint: el.querySelector('.hint')?.textContent.trim() ?? '',
      checked: el.querySelector('input')?.checked,
    }));
    check(row.label === '图片和视频变灰', '与弹窗同一个叫法');
    check(row.hint.length > 0, '说明跟着开关走');
    check(row.checked === true, '三处界面读同一份存储：媒体钮拨回来的状态在设置页也是开');
    check((await m.evaluate(() => document.body.innerText)).includes('图片其实还在加载'), '卡片底部如实说明「不是不加载」');
    await m.click(tid('pm-mgmt-media-mediaGray'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === undefined, '站点设置页关掉写入存储');
    await waitFor(page, '大图恢复彩色', () => !getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    check(true, '另一处入口拨动，页面效果即时跟着变');
    await m.click(tid('pm-mgmt-media-mediaGray'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === true, '站点设置页拨回来');
    await m.close();

    // ===================== 幕布静音 =====================
    console.log('\n--- 幕布静音：遮住即静音，恢复即还原 ---');
    const popupCover = await openPopup(ext, page);
    await popupCover.click(tid('pm-popup-cover'));
    await poll(async () => (await tabMuted())?.muted === true, '遮住整页连声音一起按住', { timeout: 8000 });
    const curtainMuted = await tabMuted();
    check(curtainMuted.reason === 'extension', `静音由本扩展设置（reason=${curtainMuted.reason}）`);
    check((await mediaState(page)).videoMuted === false, '幕布静音走标签页级，不碰 video.muted');
    await popupCover.close().catch(() => {}); // 遮住动作后弹窗可能已自行关闭
    // 遮住后重开弹窗：按钮自己写着「恢复这一页」（#54），点它撤幕布
    const popupRestore = await openPopup(ext, page);
    const restoreLabel = await popupRestore.$eval(tid('pm-popup-cover'), (b) => b.textContent.trim());
    check(restoreLabel.includes('恢复'), `遮住后重开弹窗，按钮自己写「恢复这一页」（${restoreLabel}）`);
    await popupRestore.click(tid('pm-popup-cover'));
    await poll(async () => (await tabMuted())?.muted === false, '恢复整页声音回来', { timeout: 8000 });
    check((await tabMuted())?.muted === false, '幕布撤掉不留哑标签页');
    await popupRestore.close().catch(() => {});

    // ===================== 两态边界（0.8.3：灰度独立于主开关） =====================
    console.log('\n--- 「网站原样」还原定制，灰度独立 ---');
    await page.bringToFront();
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main')); // 胶囊主按钮切到原样
    await poll(async () => (await getProfile(control, ORIGIN)).switchState === 'original', '切到「网站原样」');
    // 灰度独立于两态（0.8.3）：原样态下灰度照常生效、小图标照常豁免、压制照常工作
    await waitFor(page, '原样态灰度仍在', () => getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    const originalState = await mediaState(page);
    check(grayed(originalState.bigFilter) && originalState.iconKept, '原样态：定制还原，灰度与小图标豁免照常');

    // 独立性证明：原样态下关媒体钮，颜色立刻恢复（主开关不再压着灰度）
    await clickInShadow(page, TOGGLE, tid('pm-toggle-media'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === undefined, '原样态下关媒体钮写入存储');
    await waitFor(page, '关媒体钮后颜色恢复', () => !getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    check(true, '原样态下媒体钮有可见反应：灰度独立于主开关（不再有死按钮）');

    // 开回来，然后切回按设置
    await clickInShadow(page, TOGGLE, tid('pm-toggle-media'));
    await poll(async () => (await getProfile(control, ORIGIN)).mediaGray === true, '媒体钮开回来');
    await waitFor(page, '灰度重新生效', () => getComputedStyle(document.querySelector('#big')).filter.includes('grayscale(1)'), [], { timeout: 8000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'));
    await poll(async () => (await getProfile(control, ORIGIN)).switchState === 'disguised', '切回「按你的设置显示」');
    await tryPlay(page, '#vid');
    await waitFor(page, '压制照常', () => document.querySelector('#vid').paused, [], { timeout: 8000 });
    check(true, '切回清爽态：压制照常，配置没丢');
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
