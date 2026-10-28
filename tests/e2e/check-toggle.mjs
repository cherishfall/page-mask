/**
 * 悬浮按钮与页内无障碍验收（#25，审查 N1、N16–N18、N29–N34、对比度表）：真实鼠标 / 键盘。
 * 幕布（#45）：一键遮住整页的入口、恢复分支、生命周期，也在这里验。
 *
 * 运行：npm run build && node tests/e2e/check-toggle.mjs     （约 15 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 菜单：默认右下角时菜单完整在视口内（右侧与底部都不出屏）；Esc 关闭；点页面关闭；
 *   右键胶囊不再弹出菜单（「永不做」清单：不新增右键菜单入口）
 * - 点菜单「编辑规则」打开编辑面板，且开关状态不变（N1 的实测故障）
 * - 键盘：Tab 能聚焦把手 / 主按钮 / 「⋯」，主按钮上回车切换开关；主按钮有 aria-pressed 与可见文字
 * - 拖动：专用把手 + setPointerCapture，拖出左上角时贴边不出视口，松手后位置落库（贴边 + 纵向坐标）
 * - 对比度：白底 / 深色 / 灰底三种页面上，胶囊本体（底色 vs 页面底色）≥3:1、文字 ≥4.5:1
 * - 幕布：清爽态 / 原样态的恢复分支（进哪态回哪态）、页面内容不可见、标题与图标替换、
 *   底色取页面画布底色（深色页面不发白）、刷新即消失、进向导先撤幕布、
 *   遮住期间别的标签页切开关后幕布仍在、不写配置不改开关
 * - 叠放：页面里有 z-index:2147483647 的固定浮层时，向导的模态 <dialog> 仍在最上层
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, launchExtension, patchProfile, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const TOGGLE = 'pagemask-toggle';
const WIZARD = 'pagemask-wizard';
const EDITOR = 'pagemask-editor';
const tid = (id) => `[data-testid="${id}"]`;

/** 三种底色的页面：白底、深色、灰底；都带一个 >2147483646 的固定浮层 */
const pages = {
  '/white': { bg: '#ffffff', label: '白底页面' },
  '/dark': { bg: '#111111', label: '深色页面' },
  '/gray': { bg: '#9aa0a6', label: '灰底页面' },
};
const pageHtml = (bg) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 阅读</title>
<style>body{margin:0;background:${bg};font:14px system-ui}
#overlay{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:transparent}
#content{min-height:900px;padding:24px}
.ad{height:60px;margin:12px 16px;background:#fc0}</style></head><body>
<div id="overlay">页面自己的超高浮层</div>
<div class="ad" id="ad">广告位（示例）</div>
<main id="content"><h1>正文</h1><p>段落内容</p></main>
</body></html>`;

const handler = (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const meta = pages[pathname];
  if (!meta) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml(meta.bg));
};

const now = Date.now();
const profileOf = (origin) => ({
  formatVersion: 1,
  origin,
  switchState: 'disguised',
  disguisedTitle: '低调阅读', // 幕布用例断言标题时用固定值，不依赖浏览器界面语言
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

/** shadow 内元素与视口的矩形 */
const rectIn = (page, host, sel) =>
  page.evaluate(
    (h, s) => {
      const el = document.querySelector(h)?.shadowRoot?.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    },
    host,
    sel,
  );

const menuOpen = (page) =>
  page.evaluate(
    (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-menu"]')?.matches(':popover-open'),
    TOGGLE,
  );

/** WCAG 相对亮度 / 对比度（与 tests/tokens-contrast.test.ts 同一套公式） */
function contrastInPage(page, host) {
  return page.evaluate((h) => {
    const sr = document.querySelector(h).shadowRoot;
    const pill = sr.querySelector('[data-testid="pm-toggle-main"]').closest('.pm-tg');
    const label = sr.querySelector('.pm-tg-label');
    const pillBg = getComputedStyle(pill).backgroundColor;
    const fg = getComputedStyle(label).color;
    // 外圈颜色经一个探针元素归一化：构建时 rgb(0 0 0 / 0.5) 会被压成 #00000080 之类的写法
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(pill).getPropertyValue('--pm-tg-ring');
    document.body.appendChild(probe);
    const ringColor = getComputedStyle(probe).color;
    probe.remove();
    const parse = (s) => s.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const la = lum(parse(a));
      const lb = lum(parse(b));
      const light = Math.max(la, lb);
      const dark = Math.min(la, lb);
      return (light + 0.05) / (dark + 0.05);
    };
    // 外圈是半透明黑：按页面底色合成后再比（阴影不参与 getComputedStyle 颜色计算）
    const pageBg = getComputedStyle(document.body).backgroundColor;
    const [rr, rg, rb, ra = 1] = parse(ringColor);
    const [pr, pg, pb] = parse(pageBg);
    const ring = `rgb(${Math.round(rr * ra + pr * (1 - ra))}, ${Math.round(rg * ra + pg * (1 - ra))}, ${Math.round(rb * ra + pb * (1 - ra))})`;
    return {
      pageBg,
      ring,
      textVsPill: Number(ratio(fg, pillBg).toFixed(2)),
      pillVsPage: Number(ratio(pillBg, pageBg).toFixed(2)),
      ringVsPage: Number(ratio(ring, pageBg).toFixed(2)),
    };
  }, host);
}

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN], revocable: false });
  try {
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    const page = await ext.browser.newPage();
    await page.setViewport({ width: 1000, height: 700 });
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // ===================== 菜单：默认位置不出屏 =====================
    console.log('\n--- 默认右下角：菜单完整在视口内 ---');
    const pill = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(pill.right <= 1000 && pill.bottom <= 700, `胶囊默认在视口内右下角（right=${Math.round(pill.right)}, bottom=${Math.round(pill.bottom)}）`);
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitFor(page, '菜单打开', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE], { timeout: 3000 });
    check(true, '点「⋯」打开菜单');
    const menu = await rectIn(page, TOGGLE, tid('pm-toggle-menu'));
    check(
      menu.x >= 0 && menu.y >= 0 && menu.right <= 1000 && menu.bottom <= 700,
      `菜单完整在视口内（x=${Math.round(menu.x)}, y=${Math.round(menu.y)}, right=${Math.round(menu.right)}, bottom=${Math.round(menu.bottom)}）`,
    );
    check(menu.bottom <= pill.y + 1, `空间不够时向上翻转，菜单在胶囊上方（菜单底 ${Math.round(menu.bottom)} ≤ 胶囊顶 ${Math.round(pill.y)}）`);

    // Esc 关闭
    await page.keyboard.press('Escape');
    await waitFor(page, 'Esc 关闭菜单', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE], { timeout: 3000 });
    check(true, 'Esc 关闭菜单');

    // 点页面关闭
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitFor(page, '菜单再次打开', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE], { timeout: 3000 });
    await page.mouse.click(60, 400);
    await waitFor(page, '点页面关闭菜单', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE], { timeout: 3000 });
    check(true, '点菜单外面关闭菜单');

    // 右键不再弹菜单（「永不做」：不新增右键菜单入口）
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'), { button: 'right' });
    await new Promise((res) => setTimeout(res, 300));
    check(!(await menuOpen(page)), '右键胶囊不会打开菜单（没有右键菜单入口）');

    // ===================== 菜单「编辑规则」不切开关（N1） =====================
    console.log('\n--- 点菜单「编辑规则」：打开面板、开关不变 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-edit'));
    await waitForShadow(page, EDITOR, tid('pm-editor-panel'), { timeout: 5000 });
    check(true, '菜单「编辑规则」打开了编辑面板');
    const afterMenu = await getProfile(ext.control, ORIGIN);
    check(afterMenu.switchState === 'disguised', `开关没有被菜单点击切掉（${afterMenu.switchState}）`);
    await page.keyboard.press('Escape');
    await waitFor(page, '面板关闭', (h) => !document.querySelector(h), [EDITOR], { timeout: 3000 });

    // ===================== 键盘：Tab 聚焦、回车切换 =====================
    console.log('\n--- 键盘操作 ---');
    const aria = await page.evaluate(
      (h) => {
        const sr = document.querySelector(h).shadowRoot;
        const main = sr.querySelector('[data-testid="pm-toggle-main"]');
        return {
          pressed: main.getAttribute('aria-pressed'),
          text: main.textContent.trim(),
          gripLabel: sr.querySelector('[data-testid="pm-toggle-grip"]')?.getAttribute('aria-label'),
          moreLabel: sr.querySelector('[data-testid="pm-toggle-more"]')?.getAttribute('aria-label'),
        };
      },
      TOGGLE,
    );
    check(aria.pressed === 'true' && aria.text === '清爽', `主按钮有 aria-pressed 与可见文字（aria-pressed=${aria.pressed}，文字「${aria.text}」）`);
    check(!!aria.gripLabel && !!aria.moreLabel, `把手与菜单按钮都有可访问名称（${aria.gripLabel} / ${aria.moreLabel}）`);

    // 从页面开头 Tab 进来：先把焦点放回页面
    await page.mouse.click(60, 400);
    await page.keyboard.press('Tab');
    let focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid ?? null, TOGGLE);
    check(focused === 'pm-toggle-grip', `Tab 第一个停靠点是拖动把手（${focused}）`);
    await page.keyboard.press('Tab');
    focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid ?? null, TOGGLE);
    check(focused === 'pm-toggle-main', `再 Tab 到主按钮（${focused}）`);
    await page.keyboard.press('Enter');
    const switched = await (async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.switchState === 'original') return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(switched.switchState === 'original', `主按钮上按回车切换开关（${switched.switchState}）`);
    const label = await shadowText(page, TOGGLE, '.pm-tg-label');
    check(label === '原样', `按钮文字随状态变化（${label}）`);
    // 复位
    await setProfile(ext.control, ORIGIN, { ...switched, switchState: 'disguised' });
    await waitFor(page, '回到清爽态', (h) => !!document.querySelector(h), [TOGGLE], { timeout: 5000 });

    // ===================== 拖动：专用把手、贴边、落库 =====================
    console.log('\n--- 拖动把手 ---');
    const grip = await rectIn(page, TOGGLE, tid('pm-toggle-grip'));
    await page.mouse.move(grip.x + grip.w / 2, grip.y + grip.h / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.w / 2 - 400, grip.y + grip.h / 2 - 300, { steps: 6 });
    await page.mouse.up();
    const moved = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(moved.x >= 0 && moved.y >= 0, `拖动后位置在视口内（${Math.round(moved.x)},${Math.round(moved.y)}）`);
    const stored = await (async () => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.floatingBtnPos) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(!!stored.floatingBtnPos, `松手后坐标落库（${JSON.stringify(stored.floatingBtnPos)}）`);
    check(
      stored.floatingBtnPos.x === 8 || stored.floatingBtnPos.x > 500,
      `落库坐标贴在左/右边缘，不是飘在中间（x=${stored.floatingBtnPos.x}）`,
    );
    // 再拖一次到左上角外侧：贴边不出视口
    const grip2 = await rectIn(page, TOGGLE, tid('pm-toggle-grip'));
    await page.mouse.move(grip2.x + grip2.w / 2, grip2.y + grip2.h / 2);
    await page.mouse.down();
    await page.mouse.move(0, 0, { steps: 4 });
    await page.mouse.up();
    const corner = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      corner.x >= 0 && corner.x <= 10 && corner.y >= 0 && corner.y <= 10,
      `拖到左上角时贴边、不出视口（${Math.round(corner.x)},${Math.round(corner.y)}）`,
    );

    // 按钮归位
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-reset'));
    const reset = await (async () => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.floatingBtnPos === null) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(reset.floatingBtnPos === null, '「按钮归位」清掉保存的坐标');
    const home = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(home.right <= 1000 && home.bottom <= 700, `归位后回到右下角（right=${Math.round(home.right)}, bottom=${Math.round(home.bottom)}）`);

    // ===================== 对比度：白底 / 深色 / 灰底 =====================
    console.log('\n--- 三种底色页面的对比度 ---');
    for (const [path, meta] of Object.entries(pages)) {
      await page.goto(`${ORIGIN}${path}`, { waitUntil: 'load' });
      await page.waitForSelector(TOGGLE, { timeout: 8000 });
      await new Promise((res) => setTimeout(res, 150));
      const c = await contrastInPage(page, TOGGLE);
      check(
        c.pillVsPage >= 3 || c.ringVsPage >= 3,
        `${meta.label}：胶囊本体可辨（本体 ${c.pillVsPage}:1 / 外圈 ${c.ringVsPage}:1，页面 ${c.pageBg}）`,
      );
      check(c.textVsPill >= 4.5, `${meta.label}：文字对胶囊底 ≥4.5:1（${c.textVsPill}:1）`);
    }

    // ===================== 幕布：一键遮住整页（#45） =====================
    console.log('\n--- 幕布：遮住 / 恢复（#45） ---');
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // ---- 清爽态遮住：内容不可见、标题替换、胶囊收起成「恢复」、不写配置 ----
    const beforeCover = await getProfile(ext.control, ORIGIN);
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-restore'), { timeout: 3000 });
    const covered = await page.evaluate(() => {
      const cover = document.querySelector('pagemask-curtain')?.shadowRoot?.querySelector('[data-pm-curtain]');
      const r = cover?.getBoundingClientRect();
      const sr = document.querySelector('pagemask-toggle')?.shadowRoot;
      return {
        present: !!cover,
        w: r?.width ?? 0,
        h: r?.height ?? 0,
        bg: cover ? getComputedStyle(cover).backgroundColor : '',
        hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
        title: document.title,
        iconLinks: document.querySelectorAll('link[rel~="icon"]').length,
        onlyRestore: !sr?.querySelector('[data-testid="pm-toggle-main"]') && !sr?.querySelector('[data-testid="pm-toggle-more"]'),
      };
    });
    check(covered.present, '幕布覆盖层已铺上');
    check(covered.w >= 1000 && covered.h >= 700, `覆盖层铺满视口（${Math.round(covered.w)}×${Math.round(covered.h)}）`);
    check(covered.bg === 'rgb(255, 255, 255)', `白底页面的幕布取页面画布底色（${covered.bg}）`);
    check(covered.hit === 'pagemask-curtain', `页面内容不可见（视口中心命中落在幕布宿主上：${covered.hit}）`);
    check(covered.title === '低调阅读', `标签页标题换成清爽标题（${covered.title}）`);
    check(covered.iconLinks === 1, `图标换成伪装图标（icon link ×${covered.iconLinks}）`);
    check(covered.onlyRestore, '胶囊收起成单个「恢复」，清爽/原样与「编辑规则」都不再可点');
    const afterCover = await getProfile(ext.control, ORIGIN);
    check(afterCover.switchState === beforeCover.switchState, `遮住不改开关状态（${afterCover.switchState}）`);
    check(JSON.stringify(afterCover) === JSON.stringify(beforeCover), '遮住不写配置（站点配置逐字段没变）');

    // ---- 清爽态「恢复」：回到清爽态（不是原样态），隐藏规则仍生效 ----
    await clickInShadow(page, TOGGLE, tid('pm-toggle-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), ['pagemask-curtain'], { timeout: 3000 });
    const restored = await page.evaluate(() => ({
      title: document.title,
      ad: getComputedStyle(document.querySelector('#ad')).display,
    }));
    check(restored.title === '低调阅读', `清爽态「恢复」后仍是清爽标题（${restored.title}）`);
    check(restored.ad === 'none', `隐藏规则仍生效（#ad display=${restored.ad}）`);
    const afterRestore = await getProfile(ext.control, ORIGIN);
    check(afterRestore.switchState === 'disguised', `遮住前后开关状态不变（${afterRestore.switchState}）`);

    // ---- 原样态遮住再「恢复」：标题被替换，恢复回到真实标题与图标 ----
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(page, '切到原样', (h) => document.title === 'Acme 阅读', [], { timeout: 5000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-restore'), { timeout: 3000 });
    const coveredOriginal = await page.evaluate(() => ({
      title: document.title,
      iconLinks: document.querySelectorAll('link[rel~="icon"]').length,
    }));
    check(coveredOriginal.title === '低调阅读', `原样态遮住后标题被替换（${coveredOriginal.title}）`);
    check(coveredOriginal.iconLinks === 1, `原样态遮住后图标被替换（icon link ×${coveredOriginal.iconLinks}）`);
    await clickInShadow(page, TOGGLE, tid('pm-toggle-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), ['pagemask-curtain'], { timeout: 3000 });
    const restoredOriginal = await page.evaluate(() => ({
      title: document.title,
      iconLinks: document.querySelectorAll('link[rel~="icon"]').length,
    }));
    check(restoredOriginal.title === 'Acme 阅读', `原样态「恢复」回到真实标题（${restoredOriginal.title}）`);
    check(restoredOriginal.iconLinks === 0, `原样态「恢复」回到真实图标（icon link ×${restoredOriginal.iconLinks}）`);

    // ---- 深色页面的幕布取深色画布底色；刷新即消失（临时语义，不做跨刷新保持） ----
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await page.goto(`${ORIGIN}/dark`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-restore'), { timeout: 3000 });
    const darkBg = await page.evaluate(
      () => getComputedStyle(document.querySelector('pagemask-curtain').shadowRoot.querySelector('[data-pm-curtain]')).backgroundColor,
    );
    check(darkBg === 'rgb(17, 17, 17)', `深色页面里幕布取页面画布底色，不是纯白（${darkBg}）`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const afterReload = await page.evaluate(() => ({
      curtain: !!document.querySelector('pagemask-curtain'),
      hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
    }));
    check(!afterReload.curtain, '刷新后幕布消失、没有残留覆盖层');
    check(afterReload.hit !== 'pagemask-curtain', `刷新后页面内容正常可见（命中 ${afterReload.hit}）`);

    // ---- 进向导前先撤幕布 ----
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-restore'), { timeout: 3000 });
    await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    const wizardState = await page.evaluate(() => ({
      curtain: !!document.querySelector('pagemask-curtain'),
      hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
    }));
    check(!wizardState.curtain, '进向导前幕布先撤掉');
    check(wizardState.hit !== 'pagemask-curtain', `向导打开后页面可见（命中 ${wizardState.hit}）`);
    // 没有选中任何元素，点退出直接关掉向导
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-exit"]').click(), WIZARD);
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });

    // ---- 遮住期间别的标签页切开关：幕布仍在、标题仍是低调查 ----
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-restore'), { timeout: 3000 });
    const page2 = await ext.browser.newPage();
    await page2.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(
      page,
      '幕布仍在且标题仍低调',
      () => !!document.querySelector('pagemask-curtain') && document.title === '低调阅读',
      [],
      { timeout: 5000 },
    );
    check(true, '遮住期间别的标签页切开关：幕布仍在、标题仍是低调查');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), ['pagemask-curtain'], { timeout: 3000 });
    await page2.close();
    const finalProfile = await getProfile(ext.control, ORIGIN);
    check(finalProfile.switchState === 'original', `开关以存储为准（${finalProfile.switchState}）`);
    check(
      JSON.stringify(Object.keys(finalProfile).sort()) === JSON.stringify(Object.keys(beforeCover).sort()),
      '存储里没有任何新字段',
    );
    // 复位开关，不让幕布用例影响后面的叠放用例
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });

    // ===================== 叠放：页面超高浮层之上的模态对话框 =====================
    console.log('\n--- 页面浮层 z-index:2147483647 时，向导对话框仍在最上层 ---');
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'addElement' });
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'));
    // 先选一个元素，退出时才需要确认框（没有选择会直接退出）
    const ad = await page.evaluate(() => {
      const r = document.querySelector('#ad').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(ad.x, ad.y);
    await waitForShadow(page, WIZARD, '[data-testid^="pm-badge-"]');
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-exit"]').click(), WIZARD);
    await waitForShadow(page, WIZARD, tid('pm-wizard-exit-confirm'));
    const top = await page.evaluate(
      (h) => {
        const dlg = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]');
        const r = dlg.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 12);
        return { open: dlg.open, onTop: hit?.tagName?.toLowerCase() === 'pagemask-wizard' };
      },
      WIZARD,
    );
    check(top.open && top.onTop, `确认框在页面 z-index:2147483647 浮层之上（命中测试落在向导宿主上：${top.onTop}）`);

    // ===================== 幕布：未添加网站的一次性脚本（#46） =====================
    console.log('\n--- 幕布：未添加网站的一次性脚本（#46） ---');
    // 删掉配置：这个网站从此"没添加过"，页面里没有内容脚本、没有悬浮胶囊
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), ORIGIN);
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 800)); // 负向断言：等过注入时机
    check(!(await page.$(TOGGLE)), '没添加的网站上没有悬浮按钮');

    /** 用 activeTab 同款的路径注入一次性脚本（E2E 的 openPopup 不授予 activeTab，只能直接注入） */
    const injectOnce = async () => {
      const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
      await ext.control.evaluate(async (id) => {
        await chrome.scripting.executeScript({ target: { tabId: id }, files: ['curtain-oneshot.js'] });
      }, tabId);
    };

    await injectOnce();
    await waitForShadow(page, 'pagemask-curtain', tid('pm-curtain-restore'), { timeout: 5000 });
    const oneShot = await page.evaluate(() => ({
      title: document.title,
      cover: !!document.querySelector('pagemask-curtain'),
      hit: document.elementFromPoint(500, 300)?.shadowRoot ? 'pagemask-curtain' : (document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null),
    }));
    check(oneShot.cover, '一次性幕布覆盖层已铺上');
    check(oneShot.hit === 'pagemask-curtain', `页面内容不可见（视口中心命中 ${oneShot.hit}）`);
    check(oneShot.title !== 'Acme 阅读', `标签页标题已换成低调标题（${oneShot.title}）`);
    check(!(await page.$(TOGGLE)), '幕布上没有悬浮胶囊（没添加的网站本来就没有）');

    // 幂等：重复注入不叠加第二层
    await injectOnce();
    await injectOnce();
    const layers = await page.evaluate(() => document.querySelectorAll('pagemask-curtain').length);
    check(layers === 1, `重复注入不叠加（实际 ${layers} 层）`);

    await clickInShadow(page, 'pagemask-curtain', tid('pm-curtain-restore'));
    await waitFor(page, '点「恢复」后幕布撤掉', (h) => !document.querySelector(h), ['pagemask-curtain'], { timeout: 3000 });
    const back = await page.evaluate(() => ({ title: document.title, hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null }));
    check(back.title === 'Acme 阅读', `恢复后标题回到原值（${back.title}）`);
    check(back.hit !== 'pagemask-curtain', `恢复后页面内容正常可见（命中 ${back.hit}）`);
    check(
      (await ext.control.evaluate(async (o) => (await chrome.storage.local.get(`profile:${o}`))[`profile:${o}`], ORIGIN)) === undefined,
      '没有留下任何站点配置',
    );

    // 刷新后脚本随文档消失：即使之前遮住过，新文档也是干净的
    await injectOnce();
    await waitForShadow(page, 'pagemask-curtain', tid('pm-curtain-restore'), { timeout: 5000 });
    await page.reload({ waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 500));
    check(!(await page.$('pagemask-curtain')), '刷新后一次性幕布随之消失');
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
