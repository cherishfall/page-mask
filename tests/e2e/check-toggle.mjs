/**
 * 悬浮按钮与页内无障碍验收（#25，审查 N1、N16–N18、N29–N34、对比度表）：真实鼠标 / 键盘。
 * 幕布（#45）：一键遮住整页的入口、恢复分支、生命周期，也在这里验。
 *
 * 运行：npm run build && node tests/e2e/check-toggle.mjs     （约 15 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 菜单：默认右下角时菜单完整在视口内（右侧与底部都不出屏）；Esc 关闭；点页面关闭；
 *   右键胶囊不再弹出菜单（「永不做」清单：不新增右键菜单入口）
 * - 菜单四项与两条分隔线（#56）：标签页标题和图标 / 编辑收起的内容 / 按钮放回右下角 /
 *   删除这个网站的设置（红字，与上面用分隔线隔开）
 * - 点菜单「编辑收起的内容」打开编辑面板，且开关状态不变（N1 的实测故障）
 * - 就地改标题与图标（#56）：不跳标签页，保存即生效；原样态下保存完提示「切到清爽」并给入口
 * - 删除这个网站的设置（#56）：确认框标题带域名、默认焦点在「取消」、按钮实底红；
 *   确认后配置删除、权限收回、页面还原、标签页恢复真名、列表里也没有了
 * - 键盘：Tab 能聚焦把手 / 主按钮 / 「⋯」，主按钮上回车切换开关；主按钮有 aria-pressed 与可见文字
 * - 拖动：专用把手 + setPointerCapture，拖出左上角时贴边不出视口，松手后位置落库（贴边 + 纵向坐标）
 * - 对比度：白底 / 深色 / 灰底三种页面上，胶囊本体（底色 vs 页面底色）≥3:1、文字 ≥4.5:1
 * - 幕布：清爽态 / 原样态的恢复分支（进哪态回哪态）、页面内容不可见、标题与图标替换、
 *   底色取页面画布底色（深色页面不发白）、刷新即消失、进向导先撤幕布、
 *   遮住期间别的标签页切开关后幕布仍在、不写配置不改开关
 * - 幕布恢复按钮（#50）：胶囊整体不渲染、位置与该站胶囊同一锚点、常态 85% 不透明度且只显示图标、
 *   悬停 / 键盘聚焦升到 100% 并显字且不位移、拖动不恢复且落库、查询 / 撤掉幕布两条消息
 * - 一次性脚本（#46 / #50）：同一颗按钮与同一套样式、幂等注入、全局位置记忆、待授权站点用自己的标题
 * - 叠放：页面里有 z-index:2147483647 的固定浮层时，向导的模态 <dialog> 仍在最上层
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, getSettings, launchExtension, patchProfile, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const TOGGLE = 'pagemask-toggle';
const WIZARD = 'pagemask-wizard';
const EDITOR = 'pagemask-editor';
/** 幕布宿主：遮住后「恢复」按钮住在这里（#50 起不再由胶囊渲染） */
const CURTAIN = 'pagemask-curtain';
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
  // revocable：站点权限以「可选权限、运行时已授予」的方式存在，删除设置时才能真的收回（#56）
  const ext = await launchExtension({ hostOrigins: [ORIGIN] });
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

    // ===================== 菜单四项与两条分隔线（#56） =====================
    console.log('\n--- 菜单：四项、两条分隔线、删除项红字 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    const menuShape = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const menu = sr.querySelector('[data-testid="pm-toggle-menu"]');
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(menu).getPropertyValue('--pm-danger');
      menu.appendChild(probe);
      const danger = getComputedStyle(probe).color;
      probe.remove();
      const items = [...menu.querySelectorAll('.pm-tg-item')].map((b) => b.textContent.trim());
      const del = menu.querySelector('[data-testid="pm-toggle-delete"]');
      return {
        items,
        seps: menu.querySelectorAll('.pm-tg-sep').length,
        order: [...menu.children].map((el) => (el.classList.contains('pm-tg-sep') ? '---' : el.textContent.trim())),
        deleteColor: del ? getComputedStyle(del).color : '',
        danger,
      };
    }, TOGGLE);
    check(
      menuShape.items.join(' / ') === '标签页标题和图标 / 编辑收起的内容 / 按钮放回右下角 / 删除这个网站的设置',
      `菜单是四项、叫法一致（${menuShape.items.join(' / ')}）`,
    );
    check(menuShape.seps === 2, `四项之间有两条分隔线（实际 ${menuShape.seps} 条）`);
    check(
      menuShape.order.join(' | ') ===
        '标签页标题和图标 | 编辑收起的内容 | --- | 按钮放回右下角 | --- | 删除这个网站的设置',
      `分组顺序：日常两项 / 按钮位置 / 删除设置（${menuShape.order.join(' | ')}）`,
    );
    check(
      menuShape.deleteColor === menuShape.danger,
      `删除项是红字、与上面三项分开（${menuShape.deleteColor}）`,
    );
    await page.keyboard.press('Escape');
    await waitFor(page, '菜单关闭', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE]);

    // ===================== 菜单「编辑收起的内容」不切开关（N1） =====================
    console.log('\n--- 点菜单「编辑收起的内容」：打开面板、开关不变 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-edit'));
    await waitForShadow(page, EDITOR, tid('pm-editor-panel'), { timeout: 5000 });
    check(true, '菜单「编辑收起的内容」打开了编辑面板');
    const afterMenu = await getProfile(ext.control, ORIGIN);
    check(afterMenu.switchState === 'disguised', `开关没有被菜单点击切掉（${afterMenu.switchState}）`);
    await page.keyboard.press('Escape');
    await waitFor(page, '面板关闭', (h) => !document.querySelector(h), [EDITOR], { timeout: 3000 });

    // ===================== 就地改标题与图标（#56） =====================
    console.log('\n--- 菜单「标签页标题和图标」：就地弹出小面板、保存即生效 ---');
    const urlBefore = page.url();
    const panelOpen = () =>
      page.evaluate(
        (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tp-panel"]')?.matches(':popover-open'),
        TOGGLE,
      );
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitFor(page, '小面板打开', (h) => {
      const el = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tp-panel"]');
      return !!el && el.matches(':popover-open');
    }, [TOGGLE], { timeout: 3000 });
    check(page.url() === urlBefore, `就地打开，没有跳到别的标签页（地址仍是 ${new URL(page.url()).pathname}）`);
    check(!(await page.$(WIZARD)) && !(await page.$(EDITOR)), '没有借道向导或编辑面板');
    const panelShape = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const menu = sr.querySelector('[data-testid="pm-toggle-menu"]');
      return {
        menuClosed: !menu.matches(':popover-open'),
        titleInput: !!sr.querySelector('[data-testid="pm-tp-title-input"]'),
        quick: sr.querySelectorAll('[data-testid^="pm-tp-quick-"]').length,
        iconInput: !!sr.querySelector('[data-testid="pm-tp-icon-input"]'),
        iconEmpty: !!sr.querySelector('[data-testid="pm-tp-icon-empty"]'),
        save: sr.querySelector('[data-testid="pm-tp-save"]')?.textContent.trim() ?? '',
        cancel: sr.querySelector('[data-testid="pm-tp-cancel"]')?.textContent.trim() ?? '',
      };
    }, TOGGLE);
    check(panelShape.menuClosed, '打开小面板时菜单先关掉');
    check(
      panelShape.titleInput && panelShape.quick === 4 && panelShape.iconInput && panelShape.iconEmpty,
      `表单与向导第 1 步同一套：标题、4 个快捷标题、图标上传与预览位（${JSON.stringify(panelShape)}）`,
    );
    check(panelShape.save === '保存' && panelShape.cancel === '取消', '面板底部是「取消」「保存」');
    const box = await rectIn(page, TOGGLE, tid('pm-tp-panel'));
    check(
      box.x >= 0 && box.y >= 0 && box.right <= 1000 && box.bottom <= 700,
      `小面板完整在视口内（${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}×${Math.round(box.h)}）`,
    );

    // 清爽态：改标题 → 保存 → 标签页当场改名
    const NEW_TITLE = '安静的标题';
    await page.evaluate(
      (h, v) => {
        const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-tp-title-input"]');
        input.focus();
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      TOGGLE,
      NEW_TITLE,
    );
    await clickInShadow(page, TOGGLE, tid('pm-tp-save'));
    await waitFor(page, '保存后标签页当场改名', (t) => document.title === t, [NEW_TITLE], { timeout: 3000 });
    check(!(await panelOpen()), '清爽态下保存后面板收起');
    check((await getProfile(ext.control, ORIGIN)).disguisedTitle === NEW_TITLE, '标题写进存储');

    // 原样态：保存后要说明「现在是原样态」，并给一个切换入口
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(page, '切到原样', (t) => document.title === t, ['Acme 阅读'], { timeout: 5000 });
    const ORIGINAL_TITLE = '原样下改的标题';
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitFor(page, '小面板再次打开', (h) => {
      const el = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tp-panel"]');
      return !!el && el.matches(':popover-open');
    }, [TOGGLE], { timeout: 3000 });
    await page.evaluate(
      (h, v) => {
        const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-tp-title-input"]');
        input.focus();
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      TOGGLE,
      ORIGINAL_TITLE,
    );
    await clickInShadow(page, TOGGLE, tid('pm-tp-save'));
    await waitForShadow(page, TOGGLE, tid('pm-tp-original-note'), { timeout: 3000 });
    const noteText = await shadowText(page, TOGGLE, tid('pm-tp-original-note'));
    check(noteText.includes('原样态') && noteText.includes('切到清爽'), `原样态下保存给出说明（${noteText.trim()}）`);
    check((await page.title()) === 'Acme 阅读', '原样态下标签页仍是真名（保存不硬改）');
    await clickInShadow(page, TOGGLE, tid('pm-tp-switch-clean'));
    await waitFor(page, '面板里的「切到清爽」当场生效', (t) => document.title === t, [ORIGINAL_TITLE], { timeout: 5000 });
    check(!(await panelOpen()), '切换后面板收起');
    // 复位：后面的幕布用例断言固定的清爽标题
    await patchProfile(ext.control, ORIGIN, { disguisedTitle: '低调阅读', switchState: 'disguised' });
    await waitFor(page, '复位到固定标题', (t) => document.title === t, ['低调阅读'], { timeout: 5000 });

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

    // 按钮放回右下角
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
    check(reset.floatingBtnPos === null, '「按钮放回右下角」清掉保存的坐标');
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

    // ===================== 幕布：一键遮住整页（#45 / #50） =====================
    console.log('\n--- 幕布：遮住 / 恢复（#45 / #50） ---');
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // 先把胶囊放到一个已知坐标：幕布恢复按钮与该站胶囊共用同一个锚点（遮住前后不跳位）
    await patchProfile(ext.control, ORIGIN, { floatingBtnPos: { x: 300, y: 220 } });
    await waitFor(
      page,
      '胶囊挪到指定坐标',
      (h) => {
        const r = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle"]')?.getBoundingClientRect();
        return !!r && Math.round(r.x) === 300 && Math.round(r.y) === 220;
      },
      [TOGGLE],
      { timeout: 5000 },
    );

    // ---- 清爽态遮住：内容不可见、标题替换、胶囊整体卸掉、恢复按钮与胶囊同款（#50）、不写配置 ----
    const beforeCover = await getProfile(ext.control, ORIGIN);
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const covered = await page.evaluate(() => {
      const sr = document.querySelector('pagemask-curtain')?.shadowRoot;
      const cover = sr?.querySelector('[data-pm-curtain]');
      const btn = sr?.querySelector('[data-testid="pm-curtain-restore"]');
      const label = btn?.querySelector('.pm-curtain-restore-label');
      const r = cover?.getBoundingClientRect();
      const b = btn?.getBoundingClientRect();
      const cs = btn ? getComputedStyle(btn) : null;
      return {
        present: !!cover,
        w: r?.width ?? 0,
        h: r?.height ?? 0,
        bg: cover ? getComputedStyle(cover).backgroundColor : '',
        hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
        title: document.title,
        iconLinks: document.querySelectorAll('link[rel~="icon"]').length,
        capsule: !!document.querySelector('pagemask-toggle'),
        btn: b ? { x: Math.round(b.x), y: Math.round(b.y), w: b.width, h: b.height } : null,
        opacity: cs?.opacity ?? '',
        radius: cs?.borderRadius ?? '',
        btnBg: cs?.backgroundColor ?? '',
        labelText: label?.textContent ?? '',
        labelOpacity: label ? getComputedStyle(label).opacity : '',
        aria: btn?.getAttribute('aria-label') ?? null,
      };
    });
    check(covered.present, '幕布覆盖层已铺上');
    check(covered.w >= 1000 && covered.h >= 700, `覆盖层铺满视口（${Math.round(covered.w)}×${Math.round(covered.h)}）`);
    check(covered.bg === 'rgb(255, 255, 255)', `白底页面的幕布取页面画布底色（${covered.bg}）`);
    check(covered.hit === 'pagemask-curtain', `页面内容不可见（视口中心命中落在幕布宿主上：${covered.hit}）`);
    check(covered.title === '低调阅读', `标签页标题换成清爽标题（${covered.title}）`);
    check(covered.iconLinks === 1, `图标换成伪装图标（icon link ×${covered.iconLinks}）`);
    check(!covered.capsule, '幕布期间整根小胶囊不渲染（一个页面上只有一套恢复入口）');
    check(
      covered.btn !== null && covered.btn.x === 300 && covered.btn.y === 220,
      `恢复按钮与该站胶囊共用同一锚点（${JSON.stringify(covered.btn)}，胶囊原本在 300,220）`,
    );
    check(covered.opacity === '0.85', `恢复按钮常态不透明度 85%（${covered.opacity}）`);
    check(
      covered.labelText === '恢复' && covered.labelOpacity === '0',
      `常态只显示图标：「恢复」在 DOM 里但不显示（文字不透明度 ${covered.labelOpacity}）`,
    );
    check(covered.radius === '999px' && covered.btnBg === 'rgb(255, 255, 255)', `与胶囊同一套材质（圆角 ${covered.radius}、底色 ${covered.btnBg}）`);
    check(!!covered.aria && covered.aria.includes('撤掉幕布'), `按钮有可读名字（${covered.aria}）`);

    // 悬停 / 键盘聚焦：整体升到 100% 并显出「恢复」，而且不产生位移（#50 的硬指标）
    const restBox = covered.btn;
    await page.mouse.move(restBox.x + restBox.w / 2, restBox.y + restBox.h / 2);
    await new Promise((res) => setTimeout(res, 250)); // 等不透明度过渡结束
    const hovered = await page.evaluate(() => {
      const btn = document.querySelector('pagemask-curtain')?.shadowRoot?.querySelector('[data-testid="pm-curtain-restore"]');
      const label = btn?.querySelector('.pm-curtain-restore-label');
      const r = btn?.getBoundingClientRect();
      return {
        opacity: btn ? getComputedStyle(btn).opacity : '',
        labelOpacity: label ? getComputedStyle(label).opacity : '',
        x: Math.round(r?.x ?? -1),
        y: Math.round(r?.y ?? -1),
        w: r?.width ?? 0,
      };
    });
    check(hovered.opacity === '1', `悬停时整体升到 100%（${hovered.opacity}）`);
    check(hovered.labelOpacity === '1', `悬停时显出「恢复」（文字不透明度 ${hovered.labelOpacity}）`);
    check(
      hovered.x === restBox.x && hovered.y === restBox.y && Math.round(hovered.w) === Math.round(restBox.w),
      `显字不引起位移或挤压（${hovered.x},${hovered.y} / 宽 ${Math.round(hovered.w)} 与常态一致）`,
    );

    // 键盘可达：Tab 聚焦后同样升到 100%、显出「恢复」，焦点环可见
    await page.mouse.click(60, 400); // 焦点回页面
    await page.keyboard.press('Tab');
    const focusState = await page.evaluate((h) => {
      const host = document.querySelector(h);
      const active = host?.shadowRoot?.activeElement;
      return { testid: active?.dataset.testid ?? null, tag: active?.tagName?.toLowerCase() ?? null };
    }, CURTAIN);
    check(
      focusState.testid === 'pm-curtain-restore' && focusState.tag === 'button',
      `Tab 能聚焦到恢复按钮（${focusState.tag} / ${focusState.testid}）`,
    );
    await new Promise((res) => setTimeout(res, 250));
    const focusStyle = await page.evaluate((h) => {
      const btn = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-curtain-restore"]');
      return {
        opacity: btn ? getComputedStyle(btn).opacity : '',
        labelOpacity: btn ? getComputedStyle(btn.querySelector('.pm-curtain-restore-label')).opacity : '',
        outlineWidth: btn ? getComputedStyle(btn).outlineWidth : '',
      };
    }, CURTAIN);
    check(focusStyle.opacity === '1' && focusStyle.labelOpacity === '1', `键盘聚焦时同样升到 100% 并显出「恢复」（${focusStyle.opacity}）`);
    check(parseFloat(focusStyle.outlineWidth) > 0, `键盘聚焦时焦点环可见（outline ${focusStyle.outlineWidth}）`);

    const afterCover = await getProfile(ext.control, ORIGIN);
    check(afterCover.switchState === beforeCover.switchState, `遮住不改开关状态（${afterCover.switchState}）`);
    check(JSON.stringify(afterCover) === JSON.stringify(beforeCover), '遮住不写配置（站点配置逐字段没变）');

    // ---- 清爽态「恢复」：回到清爽态（不是原样态），隐藏规则仍生效，胶囊回到原位 ----
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    const restored = await page.evaluate(() => ({
      title: document.title,
      ad: getComputedStyle(document.querySelector('#ad')).display,
    }));
    check(restored.title === '低调阅读', `清爽态「恢复」后仍是清爽标题（${restored.title}）`);
    check(restored.ad === 'none', `隐藏规则仍生效（#ad display=${restored.ad}）`);
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    const capsuleBack = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.round(capsuleBack.x) === 300 && Math.round(capsuleBack.y) === 220,
      `撤幕后胶囊按原坐标挂回来（${Math.round(capsuleBack.x)},${Math.round(capsuleBack.y)}）`,
    );
    const afterRestore = await getProfile(ext.control, ORIGIN);
    check(afterRestore.switchState === 'disguised', `遮住前后开关状态不变（${afterRestore.switchState}）`);

    // ---- 幕布恢复按钮可拖动：位移超过阈值算拖动（不恢复），坐标写回该站胶囊的同一个字段 ----
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const dragFrom = await rectIn(page, CURTAIN, tid('pm-curtain-restore'));
    await page.mouse.move(dragFrom.x + dragFrom.w / 2, dragFrom.y + dragFrom.h / 2);
    await page.mouse.down();
    await page.mouse.move(dragFrom.x + dragFrom.w / 2 - 200, dragFrom.y + dragFrom.h / 2 + 120, { steps: 8 });
    await page.mouse.up();
    await new Promise((res) => setTimeout(res, 400));
    check(!!(await page.$(CURTAIN)), '拖动时不恢复：松手后幕布还在');
    const draggedProfile = await (async () => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.floatingBtnPos && p.floatingBtnPos.x !== 300) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(
      !!draggedProfile.floatingBtnPos && draggedProfile.floatingBtnPos.y !== 220,
      `拖动后写回该站胶囊坐标（floatingBtnPos=${JSON.stringify(draggedProfile.floatingBtnPos)}）`,
    );
    const draggedRect = await rectIn(page, CURTAIN, tid('pm-curtain-restore'));
    check(
      Math.abs(draggedRect.x - draggedProfile.floatingBtnPos.x) < 2,
      `按钮停在松手处（${Math.round(draggedRect.x)} ≈ ${draggedProfile.floatingBtnPos.x}）`,
    );
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    const capsuleMoved = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(capsuleMoved.x - draggedProfile.floatingBtnPos.x) < 2,
      `撤幕后胶囊出现在拖动后的位置（${Math.round(capsuleMoved.x)} ≈ ${draggedProfile.floatingBtnPos.x}）`,
    );

    // ---- 消息通道（#50）：查询本页是否遮着、命令撤掉；都只作用于发送方自己的文档 ----
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const siteTab = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const stateOn = await sendToTab(ext.control, siteTab, { t: 'curtainState' });
    check(stateOn?.covered === true, `内容脚本应答「现在遮着没有」= true（${JSON.stringify(stateOn)}）`);
    const dismissAck = await sendToTab(ext.control, siteTab, { t: 'curtainDismiss' });
    await waitFor(page, '消息撤掉幕布', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(dismissAck?.ok === true, `内容脚本应答「撤掉幕布」（${JSON.stringify(dismissAck)}）`);
    const stateOff = await sendToTab(ext.control, siteTab, { t: 'curtainState' });
    check(stateOff?.ok === true && stateOff.covered === false, `没遮住时查询回 false 而不是报错（${JSON.stringify(stateOff)}）`);

    // ---- 原样态遮住再「恢复」：标题被替换，恢复回到真实标题与图标 ----
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(page, '切到原样', (h) => document.title === 'Acme 阅读', [], { timeout: 5000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-cover'));
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    const coveredOriginal = await page.evaluate(() => ({
      title: document.title,
      iconLinks: document.querySelectorAll('link[rel~="icon"]').length,
    }));
    check(coveredOriginal.title === '低调阅读', `原样态遮住后标题被替换（${coveredOriginal.title}）`);
    check(coveredOriginal.iconLinks === 1, `原样态遮住后图标被替换（icon link ×${coveredOriginal.iconLinks}）`);
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
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
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
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
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
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
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
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
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
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

    // ===================== 幕布：未添加网站的一次性脚本（#46 / #50） =====================
    console.log('\n--- 幕布：未添加网站的一次性脚本（#46 / #50） ---');
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
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    const oneShot = await page.evaluate(() => {
      const sr = document.querySelector('pagemask-curtain')?.shadowRoot;
      const btn = sr?.querySelector('[data-testid="pm-curtain-restore"]');
      const cs = btn ? getComputedStyle(btn) : null;
      return {
        title: document.title,
        cover: !!document.querySelector('pagemask-curtain'),
        hit: document.elementFromPoint(500, 300)?.shadowRoot ? 'pagemask-curtain' : (document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null),
        capsule: !!document.querySelector('pagemask-toggle'),
        opacity: cs?.opacity ?? '',
        radius: cs?.borderRadius ?? '',
        btnBg: cs?.backgroundColor ?? '',
      };
    });
    check(oneShot.cover, '一次性幕布覆盖层已铺上');
    check(oneShot.hit === 'pagemask-curtain', `页面内容不可见（视口中心命中 ${oneShot.hit}）`);
    check(oneShot.title !== 'Acme 阅读', `标签页标题已换成低调标题（${oneShot.title}）`);
    check(!oneShot.capsule, '幕布上没有悬浮胶囊（没添加的网站本来就没有）');
    check(
      oneShot.opacity === '0.85' && oneShot.radius === '999px' && oneShot.btnBg === 'rgb(255, 255, 255)',
      `一次性脚本的按钮与已添加站点同一套（不透明度 ${oneShot.opacity}、圆角 ${oneShot.radius}、底色 ${oneShot.btnBg}）`,
    );

    // 幂等：重复注入不叠加第二层、不重复注册监听（还是一个控制器、一颗按钮）
    await injectOnce();
    await injectOnce();
    const layers = await page.evaluate(() => {
      const hosts = document.querySelectorAll('pagemask-curtain');
      return {
        hosts: hosts.length,
        buttons: hosts[0]?.shadowRoot?.querySelectorAll('[data-testid="pm-curtain-restore"]').length ?? 0,
      };
    });
    check(layers.hosts === 1, `重复注入不叠加（实际 ${layers.hosts} 层）`);
    check(layers.buttons === 1, `重复注入不重复注册（恢复按钮 ${layers.buttons} 个）`);

    // 消息通道（#50）：查询状态 → 命令撤掉 → 再查询回 false（不报错）
    const oneShotTab = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const osStateOn = await sendToTab(ext.control, oneShotTab, { t: 'curtainState' });
    check(osStateOn?.covered === true, `一次性脚本应答「现在遮着没有」= true（${JSON.stringify(osStateOn)}）`);
    const osDismiss = await sendToTab(ext.control, oneShotTab, { t: 'curtainDismiss' });
    await waitFor(page, '消息撤掉一次性幕布', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(osDismiss?.ok === true, `一次性脚本应答「撤掉幕布」（${JSON.stringify(osDismiss)}）`);
    const osStateOff = await sendToTab(ext.control, oneShotTab, { t: 'curtainState' });
    check(osStateOff?.ok === true && osStateOff.covered === false, `没遮住时查询回 false 而不是报错（${JSON.stringify(osStateOff)}）`);
    const back = await page.evaluate(() => ({ title: document.title, hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null }));
    check(back.title === 'Acme 阅读', `恢复后标题回到原值（${back.title}）`);
    check(back.hit !== 'pagemask-curtain', `恢复后页面内容正常可见（命中 ${back.hit}）`);

    // 撤掉后再次遮住仍正常（重复注入让活着的控制器再遮一次，不叠第二层）
    await injectOnce();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    const relayer = await page.evaluate(() => document.querySelectorAll('pagemask-curtain').length);
    check(relayer === 1, `撤掉后再次遮住仍正常（幕布 ${relayer} 层）`);

    // 拖动记住位置（全局一份）：没添加过的网站下次遮住仍在原处
    const osBefore = await rectIn(page, CURTAIN, tid('pm-curtain-restore'));
    await page.mouse.move(osBefore.x + osBefore.w / 2, osBefore.y + osBefore.h / 2);
    await page.mouse.down();
    await page.mouse.move(osBefore.x + osBefore.w / 2 - 160, osBefore.y + osBefore.h / 2 - 90, { steps: 8 });
    await page.mouse.up();
    await new Promise((res) => setTimeout(res, 400));
    check(!!(await page.$(CURTAIN)), '一次性脚本：拖动时不恢复');
    const savedGlobal = await (async () => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const s = await getSettings(ext.control);
        if (s?.curtainBtnPos) return s.curtainBtnPos;
        await new Promise((res) => setTimeout(res, 100));
      }
      return null;
    })();
    check(!!savedGlobal, `拖动后写回全局位置（curtainBtnPos=${JSON.stringify(savedGlobal)}）`);
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '一次性幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    check(
      (await ext.control.evaluate(async (o) => (await chrome.storage.local.get(`profile:${o}`))[`profile:${o}`], ORIGIN)) === undefined,
      '没有留下任何站点配置',
    );
    await injectOnce();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    const osAfter = await rectIn(page, CURTAIN, tid('pm-curtain-restore'));
    check(
      Math.abs(osAfter.x - savedGlobal.x) < 2 && Math.abs(osAfter.y - savedGlobal.y) < 2,
      `再次遮住仍在记住的位置（${Math.round(osAfter.x)},${Math.round(osAfter.y)} ≈ ${Math.round(savedGlobal.x)},${Math.round(savedGlobal.y)}）`,
    );

    // 待授权的网站（有配置、页面里没有内容脚本）：遮住时用它自己设置的标题，不用全局默认
    await sendToTab(ext.control, oneShotTab, { t: 'curtainDismiss' });
    await waitFor(page, '一次性幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    await setProfile(ext.control, ORIGIN, { ...profileOf(ORIGIN), disguisedTitle: '这个网站自己的标题' });
    await new Promise((res) => setTimeout(res, 300));
    check(!(await page.$(TOGGLE)), '待授权站点：页面里没有内容脚本，也就没有胶囊');
    await injectOnce();
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 5000 });
    const pendingTitle = await page.evaluate(() => document.title);
    check(pendingTitle === '这个网站自己的标题', `待授权站点遮住时用它自己设置的标题（${pendingTitle}）`);

    // 刷新后脚本随文档消失：即使之前遮住过，新文档也是干净的
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), ORIGIN);
    await page.reload({ waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 500));
    check(!(await page.$('pagemask-curtain')), '刷新后一次性幕布随之消失');
    check(!(await page.$(TOGGLE)), '刷新后也不会有悬浮胶囊（配置已删掉）');

    // ===================== 删除这个网站的设置（#56） =====================
    console.log('\n--- 菜单「删除这个网站的设置」：确认框 → 删配置、收权限、页面还原 ---');
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN));
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId: await tabIdOf(ext.control, `${ORIGIN}/*`) });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await waitFor(page, '删除前：清爽态', (t) => document.title === t, ['低调阅读']);
    await new Promise((res) => setTimeout(res, 200));

    const openDeleteDialog = async () => {
      await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
      await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
      await clickInShadow(page, TOGGLE, tid('pm-toggle-delete'));
      await waitFor(
        page,
        '删除确认框打开',
        (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-delete-dialog"]')?.matches(':modal'),
        [TOGGLE],
        { timeout: 3000 },
      );
    };
    const dialogInfo = () =>
      page.evaluate((h) => {
        const sr = document.querySelector(h).shadowRoot;
        const menu = sr.querySelector('[data-testid="pm-toggle-menu"]');
        const confirm = sr.querySelector('[data-testid="pm-tg-delete-confirm"]');
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(confirm).getPropertyValue('--pm-danger');
        sr.querySelector('[data-testid="pm-tg-delete-dialog"]').appendChild(probe);
        const danger = getComputedStyle(probe).color;
        probe.remove();
        return {
          menuClosed: !menu.matches(':popover-open'),
          title: sr.querySelector('[data-testid="pm-tg-delete-title"]')?.textContent.trim() ?? '',
          impact: sr.querySelector('[data-testid="pm-tg-delete-impact"]')?.textContent.trim() ?? '',
          focus: sr.activeElement?.dataset.testid ?? null,
          confirmText: confirm?.textContent.trim() ?? '',
          confirmBg: confirm ? getComputedStyle(confirm).backgroundColor : '',
          danger,
          curtain: !!document.querySelector('pagemask-curtain'),
        };
      }, TOGGLE);

    await openDeleteDialog();
    const del = await dialogInfo();
    check(del.menuClosed, '点「删除这个网站的设置」先关掉菜单，再弹确认框');
    check(!del.curtain, '弹确认框时页面上没有幕布');
    check(
      del.title === `删除 ${new URL(ORIGIN).host} 的设置？`,
      `确认框标题带域名（${del.title}）`,
    );
    check(
      del.impact.includes('标签页标题、图标、收起的内容都会删掉') &&
        del.impact.includes('访问权限也会收回') &&
        del.impact.includes('你添加的网站'),
      `正文说清删什么、还会发生什么（${del.impact}）`,
    );
    check(del.focus === 'pm-tg-delete-cancel', `默认焦点在「取消」上（${del.focus}）`);
    check(
      del.confirmText === '删除设置' && del.confirmBg === del.danger,
      `危险按钮是实底红、写「${del.confirmText}」（${del.confirmBg}）`,
    );

    // Esc 取消：什么都不删
    await page.keyboard.press('Escape');
    await waitFor(
      page,
      'Esc 关闭确认框',
      (h) => !document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-delete-dialog"]')?.matches(':modal'),
      [TOGGLE],
      { timeout: 3000 },
    );
    check((await getProfile(ext.control, ORIGIN)) !== null, 'Esc 取消不删除任何东西');
    check((await page.title()) === '低调阅读', '取消后仍是清爽态、标题没变');

    // 确认删除：配置、权限、页面、列表一起干净
    await openDeleteDialog();
    await clickInShadow(page, TOGGLE, tid('pm-tg-delete-confirm'));
    await waitFor(page, '标题恢复真名', (t) => document.title === t, ['Acme 阅读'], { timeout: 5000 });
    await waitFor(page, '页面还原：广告位重新可见', () => getComputedStyle(document.querySelector('#ad')).display !== 'none');
    await waitFor(page, '小胶囊消失', (h) => !document.querySelector(h), [TOGGLE], { timeout: 5000 });
    const afterDelete = await page.evaluate(
      (sel) => ({
        hosts: document.querySelectorAll(sel).length,
        hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
      }),
      'pagemask-toggle, pagemask-wizard, pagemask-editor, pagemask-mask, pagemask-curtain, pagemask-notice',
    );
    check(afterDelete.hosts === 0, `页面上没有任何 PageMask 界面（${afterDelete.hosts} 个宿主）`);
    check(afterDelete.hit !== 'pagemask-toggle', `页面内容恢复正常（视口中心命中 ${afterDelete.hit}）`);
    check((await getProfile(ext.control, ORIGIN)) === null, '站点配置已删除');
    check(
      (await ext.control.evaluate((pt) => chrome.permissions.contains({ origins: [pt] }), `${ORIGIN}/*`)) === false,
      '浏览器给 PageMask 的访问权限已收回',
    );

    // 「你添加的网站」列表里也没有了
    const mgmt = await ext.browser.newPage();
    await mgmt.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
    await mgmt.waitForSelector(tid('pm-mgmt-empty'), { timeout: 5000 });
    check(
      (await mgmt.$$eval('li[data-origin]', (rows) => rows.length)) === 0,
      '管理页「你添加的网站」里已经没有它',
    );
    await mgmt.close();
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
