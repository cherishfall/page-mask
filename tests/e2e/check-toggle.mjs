/**
 * 悬浮按钮与页内无障碍验收（#25，审查 N1、N16–N18、N29–N34、对比度表）：真实鼠标 / 键盘。
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
 * - 叠放：页面里有 z-index:2147483647 的固定浮层时，向导的模态 <dialog> 仍在最上层
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
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
  disguisedTitle: null,
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
