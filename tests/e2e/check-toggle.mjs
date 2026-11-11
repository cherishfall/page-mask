/**
 * 悬浮按钮与页内无障碍验收（#25，审查 N1、N16–N18、N29–N34、对比度表）：真实鼠标 / 键盘。
 * 幕布（#45）：一键遮住整页的入口、恢复分支、生命周期，也在这里验。
 *
 * 运行：npm run build && node tests/e2e/check-toggle.mjs     （约 15 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 菜单：默认右下角时菜单完整在视口内（右侧与底部都不出屏）；Esc 关闭；点页面关闭；
 *   右键胶囊不再弹出菜单（「永不做」清单：不新增右键菜单入口）
 * - 菜单按用途分组（#56 / #77）：标题和图标 / 收起内容 ｜ 按钮放回右下角 ｜ 删除这个网站的设置
 *   （红字，与上面用分隔线隔开）；两项各进一条流程（#81：单步表单 / 两步点选）
 * - 显示条件（#67）：站点有任何设置（标题 / 图标 / 收起项）就显示胶囊，三样全空才不显示
 * - 点菜单「标题和图标」进单步小表单（#81），「收起内容」停在选内容；开关状态都不变（N1 的实测故障）
 * - 「标题和图标」就地实时预览，「保存」保存走人；原样态下不顺手打开清爽
 * - 删除这个网站的设置（#56）：确认框标题带域名、默认焦点在「取消」、按钮实底红；
 *   确认后配置删除、权限收回、页面还原、标签页恢复真名、列表里也没有了
 * - 键盘：Tab 能聚焦把手 / 主按钮 / 「⋯」，主按钮上回车切换开关；主按钮有 aria-pressed 与可见文字
 * - 命中区与字号（#72）：把手 / 遮住 / ⋯ 的可点区域 ≥24×24（触屏 40×40，用 touch 模拟量），
 *   图标本体不变大；胶囊里最小字号 12px
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
import { createReporter, poll, siteKeyOf, startServer, waitFor } from './lib/harness.mjs';
import { getProfile, getSettings, launchExtension, patchProfile, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, exitWizardByButton, shadowText, waitForShadow } from './lib/shadow.mjs';
import { loadSurfaces, menuOrder, menuRows } from './lib/surfaces.mjs';

const r = createReporter();
const { check } = r;
const TOGGLE = 'pagemask-toggle';
const WIZARD = 'pagemask-wizard';
/** 三处界面的唯一对照表（docs/design-surfaces.md）：条目顺序与叫法只从这一份取（#157） */
const SURFACES = loadSurfaces();
/**
 * 状态过渡落定的等待条件（#149；0.8.16 #152 改选中底口径）：交给项目 waitFor 在页面内轮询
 * 「会因过渡而变的观测量」，取代固定 250ms sleep。DEVLOG 0.8.14「断言的等待条件要落在会因
 * 刷新而变的观测量上」——固定 sleep 在慢机器 / CDP 抖动下仍可能读到 rgba(...,0.x) /
 * -1.2px 这类插值中间态（0.8.15 票第一版即因此失败）。每个目标按钮须同时满足：
 *   - color 已等于探针实测的目标色（开 = --pm-fg 墨色 / 关 = --pm-fg-muted，不锁死 RGB，随主题变）；
 *   - background 已等于探针实测的目标底（开 = --pm-bg-selected 选中底 / 关 = 透明；
 *     静止时没有 state layer 薄层）；
 *   - box-shadow === 'none'（state layer 只在悬停 / 按下出现，静止为 none；过渡终点才稳定）。
 * 目标色在 shadow root 内用探针实测（:host 语义变量），与紧随其后的计算样式断言同一个观测量。
 */
const toggleSettled = (h, ids, on) => {
  const sr = document.querySelector(h)?.shadowRoot;
  if (!sr) return false;
  const probe = document.createElement('span');
  probe.style.color = on ? 'var(--pm-fg)' : 'var(--pm-fg-muted)';
  if (on) probe.style.backgroundColor = 'var(--pm-bg-selected)';
  sr.appendChild(probe);
  const pcs = getComputedStyle(probe);
  const target = { color: pcs.color, bg: pcs.backgroundColor };
  probe.remove();
  return ids.every((id) => {
    const b = sr.querySelector(`[data-testid="${id}"]`);
    if (!b) return false;
    const cs = getComputedStyle(b);
    return cs.color === target.color && cs.backgroundColor === target.bg && cs.boxShadow === 'none';
  });
};

/** 保存前确认框（#159）是否真的弹过：抓 open 属性的变更，清爽态不该出现 */
async function watchOpenDialog(page) {
  await page.evaluate((h) => {
    window.__pmOpenDialogSeen = false;
    const dlg = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wizard-open-confirm"]');
    if (!dlg) return;
    new MutationObserver(() => {
      if (dlg.open) window.__pmOpenDialogSeen = true;
    }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  }, WIZARD);
}
const sawOpenDialog = (page) => page.evaluate(() => window.__pmOpenDialogSeen === true);

/** 在「标题和图标」表单里填入标题（触发 input，实时预览跟着走） */
async function typeTitle(page, value) {
  await page.evaluate(
    (h, v) => {
      const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-title-input"]');
      input.focus();
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    WIZARD,
    value,
  );
}

/** 原样态保存前的确认框（#159）：文案、按钮顺序 / 档位、默认焦点 */
const openDialogState = (page) =>
  page.evaluate((h) => {
    const sr = document.querySelector(h)?.shadowRoot;
    const dlg = sr?.querySelector('[data-testid="pm-wizard-open-confirm"]');
    if (!dlg) return null;
    return {
      open: dlg.open,
      heading: dlg.querySelector('h2')?.textContent.trim() ?? '',
      body: dlg.querySelector('p')?.textContent.trim() ?? '',
      buttons: [...dlg.querySelectorAll('.pm-wiz-actions button')].map((b) => ({
        testid: b.dataset.testid ?? null,
        text: b.textContent.trim(),
        primary: b.classList.contains('primary'),
      })),
      focus: sr.activeElement?.dataset.testid ?? null,
    };
  }, WIZARD);

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
  icon: { kind: 'none' },
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
    const main = sr.querySelector('[data-testid="pm-toggle-main"]');
    const label = main?.querySelector('.pm-tg-main-icon');
    const pillBg = getComputedStyle(pill).backgroundColor;
    const fg = label ? getComputedStyle(label).color : '';
    // 图标的实际底色：0.8.15（#149）起开态容器也保持中性透明底、不再整钮填实，
    // 图标始终落在胶囊底（--pm-bg）上；透明（开/关两态）时统一回落 pillBg
    const mainBg = main ? getComputedStyle(main).backgroundColor : 'rgba(0, 0, 0, 0)';
    const iconBackdrop = mainBg === 'rgba(0, 0, 0, 0)' ? pillBg : mainBg;
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
      textVsPill: Number(ratio(fg, iconBackdrop).toFixed(2)),
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

    // ===================== 图标按钮的命中区（#72，WCAG 2.5.8） =====================
    console.log('\n--- 图标按钮：可点区域不小于 24×24、字号不小于 12 ---');
    const hitBoxes = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      return ['pm-toggle-main', 'pm-toggle-cover', 'pm-toggle-more'].map((id) => {
        const b = sr.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
        return { id, w: b.width, h: b.height };
      });
    }, TOGGLE);
    for (const b of hitBoxes) {
      check(b.w >= 24 && b.h >= 24, `${b.id} 命中区 ${b.w.toFixed(1)}×${b.h.toFixed(1)} ≥ 24×24`);
    }
    // 整壳收到 WCAG 允许的最小（#109）：高 26（24 可点区 + 上下边框），宽约 101
    // （0.8.8：把手退场，四段全 24 图标钮，#136）
    const fullPill = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(fullPill.h - 26) <= 1,
      `全功能胶囊高 ${fullPill.h.toFixed(1)} ≈ 26（可点区 24 + 上下边框）`,
    );
    check(fullPill.w >= 96 && fullPill.w <= 106, `全功能胶囊宽 ${Math.round(fullPill.w)} 收到约 101（四段全图标钮，把手退场 #136）`);
    // 胶囊本体：渲染后的按钮顺序与叫法必须等于对照表（#157）。顺序从 DOM 里取，不是源码字符串。
    const bodyContracts = await page.evaluate(
      ({ h, controls }) => {
        const sr = document.querySelector(h).shadowRoot;
        const order = [...sr.querySelectorAll('[data-testid]')]
          .map((el) => el.getAttribute('data-testid'))
          .filter((id) => controls.includes(id));
        const labels = Object.fromEntries(
          controls.map((id) => {
            const el = sr.querySelector(`[data-testid="${id}"]`);
            return [id, (el?.getAttribute('aria-label') || el?.textContent || '').trim()];
          }),
        );
        return { order, labels };
      },
      { h: TOGGLE, controls: SURFACES.capsuleBody.map((row) => row.control) },
    );
    check(
      bodyContracts.order.join(' / ') === SURFACES.capsuleBody.map((row) => row.control).join(' / '),
      `胶囊本体按钮顺序与对照表一致（${bodyContracts.order.join(' / ')}）`,
    );
    for (const row of SURFACES.capsuleBody) {
      if (row.labelZh === '—') continue; // 主按钮是图标钮，读屏名随状态变
      check(
        bodyContracts.labels[row.control] === row.labelZh,
        `胶囊「${row.item}」与三处同叫法（${bodyContracts.labels[row.control]}）`,
      );
    }
    const pillFont = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      let min = Infinity;
      let who = '';
      for (const el of sr.querySelectorAll('.pm-tg, .pm-tg *')) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (Number.isFinite(size) && size < min) {
          min = size;
          who = el.className?.baseVal ?? el.className ?? el.tagName;
        }
      }
      return { min, who };
    }, TOGGLE);
    check(pillFont.min >= 12, `胶囊里最小的字号 ${pillFont.min}px ≥ 12px（${pillFont.who || '无'}）`);
    // 图标本身没跟着放大：遮住图标 13×13、⋯ 仍是 13px 的字（0.8.8 起没有把手图形）
    const iconBoxes = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const box = (sel) => {
        const r = sr.querySelector(sel).getBoundingClientRect();
        return { w: r.width, h: r.height };
      };
      return { cover: box('.pm-tg-cover-icon'), more: box('[data-testid="pm-toggle-more"] span') };
    }, TOGGLE);
    check(
      iconBoxes.cover.w <= 14 && iconBoxes.more.w <= 16,
      `图标本身仍然很小（遮住 ${iconBoxes.cover.w}、⋯ ${iconBoxes.more.w}）`,
    );
    // 触屏（pointer: coarse）：可点区域放大到 40×40
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const isCoarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const coarseBoxes = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      return ['pm-toggle-main', 'pm-toggle-cover', 'pm-toggle-more'].map((id) => {
        const b = sr.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
        return { id, w: b.width, h: b.height };
      });
    }, TOGGLE);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    check(isCoarse, '触屏媒体查询已生效（pointer: coarse）');
    for (const b of coarseBoxes) {
      check(b.w >= 40 && b.h >= 40, `触屏时 ${b.id} 命中区 ${b.w.toFixed(1)}×${b.h.toFixed(1)} ≥ 40×40`);
    }
    // 变大之后位置不变：胶囊总宽只多了几个像素，仍然贴右下角、不越过视口
    const after = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(after.right - pill.right) < 1 && Math.abs(after.bottom - pill.bottom) < 1 && after.x >= 0 && after.y >= 0,
      `放大后位置没变（right=${Math.round(after.right)}、bottom=${Math.round(after.bottom)}，宽 ${Math.round(after.w)}）`,
    );
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

    // ===================== 菜单（#67 / #90 / #116）：默认位七项、拖过之后八项，四组三条线 =====================
    console.log('\n--- 菜单：默认位时「按钮放回右下角」隐藏，四组三条线 ---');
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
      // 三个媒体开关（0.7.x）已退场：媒体开关在胶囊本体的「媒体」钮上，菜单回到「改内容 / 按钮自己 / 删除」三组
      const label = (b) => b.textContent.trim();
      const items = [...menu.querySelectorAll('.pm-tg-item')].map(label);
      const del = menu.querySelector('[data-testid="pm-toggle-delete"]');
      return {
        items,
        seps: menu.querySelectorAll('.pm-tg-sep').length,
        order: [...menu.children].map((el) => {
          if (el.classList.contains('pm-tg-sep')) return '---';
          return el.textContent.trim();
        }),
        deleteColor: del ? getComputedStyle(del).color : '',
        danger,
      };
    }, TOGGLE);
    const defaultMenuItems = menuRows(SURFACES, false).map((row) => row.labelZh);
    const defaultMenuOrder = menuOrder(SURFACES, false);
    const defaultMenuSeps = new Set(menuRows(SURFACES, false).map((row) => row.group)).size - 1;
    check(
      menuShape.items.join(' / ') === defaultMenuItems.join(' / '),
      `默认位（没存过坐标）时菜单项与对照表一致、媒体开关在胶囊媒体钮上不进菜单（#131，${menuShape.items.join(' / ')}）`,
    );
    check(
      menuShape.seps === defaultMenuSeps,
      `菜单分隔线条数与对照表的分组数一致（${defaultMenuSeps} 条，实际 ${menuShape.seps} 条）`,
    );
    check(
      menuShape.order.join(' | ') === defaultMenuOrder.join(' | '),
      `分组顺序与对照表一致：改内容 / 按钮 / 删除设置（${menuShape.order.join(' | ')}）`,
    );
    check(
      menuShape.deleteColor === menuShape.danger,
      `删除项是红字、与上面两项分开（${menuShape.deleteColor}）`,
    );
    await page.keyboard.press('Escape');
    await waitFor(page, '菜单关闭', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'), [TOGGLE]);

    // #120：菜单「调整不透明度」→ 插件设置的不透明度那张卡（深链 + 焦点）
    console.log('\n--- 菜单「调整不透明度」直达插件设置 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    const settingsOpened = ext.browser.waitForTarget((t) => t.url().includes('/settings.html#opacity'), { timeout: 8000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-opacity'));
    const settingsTab = await (await settingsOpened).asPage();
    await settingsTab.waitForFunction(() => document.readyState === 'complete');
    check(settingsTab.url().endsWith('/settings.html#opacity'), `点「调整不透明度」打开插件设置并带上锚点（${settingsTab.url()}）`);
    await settingsTab.waitForSelector(tid('pm-settings-opacity'), { timeout: 5000 });
    const focusedId = await settingsTab.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
    check(focusedId === 'pm-settings-opacity', `跳过去焦点落在不透明度滑杆上（焦点在 ${focusedId || '无'}）`);
    const highlighted = await settingsTab.$eval(tid('pm-settings-toggle'), (el) => el.classList.contains('target'));
    check(highlighted, '落点那张卡有描边高亮（不只靠颜色）');
    await settingsTab.close();
    await page.bringToFront();
    const menuClosed = await page.evaluate(
      (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]').matches(':popover-open'),
      TOGGLE,
    );
    check(menuClosed, '点完菜单已关闭');

    // ===================== 菜单「收起内容」：直接进向导（#67 / #77） =====================
    console.log('\n--- 点菜单「收起内容」：打开向导 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more-items'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    check(!(await page.$(TOGGLE)), '打开向导时胶囊让位，页面上只有一套界面');
    await exitWizardByButton(page, WIZARD);
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    check(true, '退出向导后胶囊挂回来');

    // ===================== 菜单「标题和图标」不切开关（N1、#77） =====================
    console.log('\n--- 点菜单「标题和图标」：停在向导第 1 步、开关不变 ---');
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    check(
      (await shadowText(page, WIZARD, tid('pm-wiz-heading'))) === '标题和图标',
      '菜单「标题和图标」进单步小表单（#81）',
    );
    check(!(await page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wiz-progress"]'), WIZARD)), '单步表单没有进度行');
    const afterMenu = await getProfile(ext.control, ORIGIN);
    check(afterMenu.switchState === 'disguised', `开关没有被菜单点击切掉（${afterMenu.switchState}）`);
    // #123 起「退出设置」每次都先问一次（没改动也要问）
    await exitWizardByButton(page, WIZARD);
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });
    // 进向导时胶囊让位；退出后运行时重新挂回来，再继续点菜单
    await page.waitForSelector(TOGGLE, { timeout: 5000 });

    // ===================== 「标题和图标」单步表单（#81） =====================
    console.log('\n--- 菜单「标题和图标」：单步表单就地实时预览，「保存」走人 ---');
    const urlBefore = page.url();
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    check(page.url() === urlBefore, `就地打开，没有跳到别的标签页（地址仍是 ${new URL(page.url()).pathname}）`);
    // 实时预览：改标题 → 标签页当场改名（不等保存）
    const NEW_TITLE = '安静的标题';
    await typeTitle(page, NEW_TITLE);
    await waitFor(page, '改标题实时预览', (t) => document.title === t, [NEW_TITLE], { timeout: 3000 });
    // 清爽态：保存就是最后一下，不弹「现在打开」（#159 把 #53 的结论收窄到清爽态）
    await watchOpenDialog(page);
    await clickInShadow(page, WIZARD, tid('pm-wiz-save'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });
    check(!(await sawOpenDialog(page)), '清爽态保存不弹「现在打开」确认框');
    check((await getProfile(ext.control, ORIGIN)).disguisedTitle === NEW_TITLE, '标题写进存储');
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    check(true, '保存后胶囊挂回来');
    check((await page.title()) === NEW_TITLE, '清爽态保存后标签页当场换成新标题');
    // 等前一句页底提示自己走完（4 秒），下面才断言原样态不会再发提示
    await waitFor(page, '前一句页底提示消失', () => !document.querySelector('pagemask-notice'), [], { timeout: 6000 });

    // 原样态（#159）：打开向导时还是清爽态，保存前被别处切回原样 —— 必须读最新值才弹框
    const STAY_TITLE = '原样下改的标题';
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await typeTitle(page, STAY_TITLE);
    await waitFor(page, '原样态下输入标题仍实时预览', (t) => document.title === t, [STAY_TITLE], { timeout: 3000 });
    await clickInShadow(page, WIZARD, tid('pm-wiz-save'));
    await waitFor(
      page,
      '原样态点保存弹出确认框（用的是最新状态）',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [WIZARD],
      { timeout: 3000 },
    );
    const dlg = await openDialogState(page);
    check(
      dlg?.heading === '保存后看不到效果' &&
        dlg.body === '「按你的设置显示」还关着，现在打开吗？' &&
        dlg.buttons.map((b) => `${b.text}${b.primary ? '·实心' : ''}`).join('/') === '保存，先保持原样/保存，现在打开·实心' &&
        dlg.focus === 'pm-wiz-open-stay',
      `确认框文案、按钮顺序与默认焦点（${dlg?.heading} / ${dlg?.buttons.map((b) => b.text).join(' / ')} / 焦点 ${dlg?.focus}）`,
    );
    await clickInShadow(page, WIZARD, tid('pm-wiz-open-stay'));
    await waitFor(page, '「先保持原样」后向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });
    const afterOriginal = await getProfile(ext.control, ORIGIN);
    check(
      afterOriginal.disguisedTitle === STAY_TITLE && afterOriginal.switchState === 'original',
      `「先保持原样」保存标题、开关不动（${afterOriginal.disguisedTitle} / ${afterOriginal.switchState}）`,
    );
    check((await page.title()) === 'Acme 阅读', '原样态下标签页仍是真名（保存不硬改）');
    check(
      !(await page.evaluate(() => !!document.querySelector('pagemask-notice'))),
      '原样态「先保持原样」保存后没有页底提示（标题没换，那句话是假的）',
    );

    // 原样态（#159）：「现在打开」保存标题并当场切到按设置显示；清爽态的页底提示照旧
    const OPEN_TITLE = '打开后再看的标题';
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    await clickInShadow(page, TOGGLE, tid('pm-toggle-title'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    await typeTitle(page, OPEN_TITLE);
    await waitFor(page, '原样态下输入标题实时预览', (t) => document.title === t, [OPEN_TITLE], { timeout: 3000 });
    await clickInShadow(page, WIZARD, tid('pm-wiz-save'));
    await waitFor(
      page,
      '再次弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [WIZARD],
      { timeout: 3000 },
    );
    await clickInShadow(page, WIZARD, tid('pm-wiz-open-yes'));
    await waitFor(page, '「现在打开」后向导关闭', (h) => !document.querySelector(h), [WIZARD], { timeout: 3000 });
    const afterOpen = await getProfile(ext.control, ORIGIN);
    check(
      afterOpen.disguisedTitle === OPEN_TITLE && afterOpen.switchState === 'disguised',
      `「现在打开」保存标题并写 switchState=disguised（${afterOpen.disguisedTitle} / ${afterOpen.switchState}）`,
    );
    await waitFor(page, '标签页当场换成新标题', (t) => document.title === t, [OPEN_TITLE], { timeout: 5000 });
    await waitForShadow(page, 'pagemask-notice', tid('pm-page-notice'), { timeout: 5000 });
    check(true, '清爽态（「现在打开」后）仍发那句页底提示，与改动前一致');

    // 复位：后面的幕布用例断言固定的清爽标题
    await patchProfile(ext.control, ORIGIN, { disguisedTitle: '低调阅读', switchState: 'disguised' });
    await waitFor(page, '复位到固定标题', (t) => document.title === t, ['低调阅读'], { timeout: 5000 });

    // ===================== 键盘：Tab 聚焦、回车切换 =====================
    console.log('\n--- 键盘操作 ---');
    await page.mouse.move(60, 400); // 指针离开主按钮：开态 hover 才有 state layer，别读进状态断言（#152）
    await waitFor(page, '主按钮开态计算样式落定（color / 选中底不再插值，#152）', toggleSettled, [TOGGLE, ['pm-toggle-main'], true], { timeout: 8000 });
    const aria = await page.evaluate(
      (h) => {
        const sr = document.querySelector(h).shadowRoot;
        const main = sr.querySelector('[data-testid="pm-toggle-main"]');
        const root = sr.querySelector('[data-testid="pm-toggle"]');
        const svg = main?.querySelector('svg');
        const body = svg?.querySelector('.pm-mask-body');
        const cs = main ? getComputedStyle(main) : null;
        // 实测 --pm-fg / --pm-bg-selected 当前主题下的计算色（探针放进 shadow root 才能解析 :host 上的变量）
        const probe = document.createElement('span');
        probe.style.color = 'var(--pm-fg)';
        probe.style.backgroundColor = 'var(--pm-bg-selected)';
        sr.appendChild(probe);
        const pcs = getComputedStyle(probe);
        const fg = pcs.color;
        const selectedBg = pcs.backgroundColor;
        probe.remove();
        return {
          pressed: main.getAttribute('aria-pressed'),
          text: main.textContent.trim(),
          bg: cs ? cs.backgroundColor : '',
          selectedBg,
          fg,
          iconColor: svg ? getComputedStyle(svg).color : '',
          bodyFill: body ? getComputedStyle(body).fill : '',
          boxShadow: cs ? cs.boxShadow : '',
          rootLabel: root?.getAttribute('aria-label'),
          moreLabel: sr.querySelector('[data-testid="pm-toggle-more"]')?.getAttribute('aria-label'),
        };
      },
      TOGGLE,
    );
    // 0.8.6（#135）：文字标签退场，主按钮状态由面具图标填实/描边 + aria-pressed + title 表达
    const mainTitle = await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"]').title, TOGGLE);
    check(aria.pressed === 'true' && mainTitle.length > 0, `主按钮有 aria-pressed 与悬停全称提示（aria-pressed=${aria.pressed}，title「${mainTitle}」）`);
    // 0.8.16（#152）：开态 = 淡灰选中底 + 墨色填实图标；指示条（#149）已按用户反馈退场
    const INK_BG = 'rgb(31, 35, 41)'; // 0.8.9 墨底（浅色 --pm-fg），用来锁「不再整颗填实」
    check(
      aria.bg !== INK_BG && aria.bg === aria.selectedBg,
      `主按钮开态是淡灰选中底，不是墨底也不是透明（bg=${aria.bg}，#152）`,
    );
    check(
      aria.boxShadow === 'none',
      `主按钮开态静止时没有指示条 / state layer（boxShadow=${aria.boxShadow}，#152）`,
    );
    check(aria.iconColor === aria.fg, `主按钮开态图标色 = --pm-fg 实算值（${aria.iconColor}，#152）`);
    check(aria.bodyFill !== 'none', `主按钮开态面具身体填实、与关态描边不同形（fill=${aria.bodyFill}，#152）`);
    check(!!aria.rootLabel && !!aria.moreLabel, `胶囊本体与菜单按钮都有可访问名称（${aria.rootLabel} / ${aria.moreLabel}）`);

    // 从页面开头 Tab 进来：先把焦点放回页面
    await page.mouse.click(60, 400);
    await page.keyboard.press('Tab');
    let focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid ?? null, TOGGLE);
    check(focused === 'pm-toggle', `Tab 第一个停靠点是胶囊本体（0.8.8 起方向键挂本体，${focused}）`);
    await page.keyboard.press('Tab');
    focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid ?? null, TOGGLE);
    check(focused === 'pm-toggle-main', `再 Tab 到主按钮（${focused}）`);
    await page.keyboard.press('Enter');
    // 当场变：面具图标状态与悬停提示都不等存储回来（Nielsen 1「状态可见」；
    // 0.8.6 起文字标签退场，图标描边/填实 + title + aria-pressed 三路表达状态，#135）
    const instant = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const main = sr.querySelector('[data-testid="pm-toggle-main"]');
      return {
        state: main.querySelector('.pm-tg-main-icon')?.dataset.state ?? null,
        tip: main.getAttribute('title'),
        pressed: main.getAttribute('aria-pressed'),
      };
    }, TOGGLE);
    check(
      instant.state === 'off' && instant.pressed === 'false',
      `切换后面具图标当场变（state=${instant.state}，aria-pressed=${instant.pressed}）`,
    );
    check(instant.tip === '点一下切换到「按设置」', `悬停提示跟着换（${instant.tip}）`);
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
    const mainState = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"] .pm-tg-main-icon')?.dataset.state ?? null,
      TOGGLE,
    );
    check(mainState === 'off', `按钮图标随状态变化（state=${mainState}）`);
    // 复位：等到面具图标真的回到填实（胶囊一直在场，等「在场」等于没等——拖动用例要在此基础上断言状态）
    await setProfile(ext.control, ORIGIN, { ...switched, switchState: 'disguised' });
    await waitFor(
      page,
      '回到清爽态（面具图标回到填实）',
      (h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-main"] .pm-tg-main-icon')?.dataset.state === 'on',
      [TOGGLE],
      { timeout: 5000 },
    );

    // ===================== 拖动：整根胶囊可拖（0.8.8，#136）、阈值消歧、落库 =====================
    console.log('\n--- 拖胶囊本体 ---');
    // 从主按钮上发起拖动：移动跨过阈值才算拖，松手不触发开关
    const grabMain = await rectIn(page, TOGGLE, tid('pm-toggle-main'));
    await page.mouse.move(grabMain.x + grabMain.w / 2, grabMain.y + grabMain.h / 2);
    await page.mouse.down();
    // #94 回归断言：拖动中要跟手——中心应落在「原中心 - 400」，不能被钉在右缘
    const beforeDrag = await rectIn(page, TOGGLE, tid('pm-toggle'));
    await page.mouse.move(grabMain.x + grabMain.w / 2 - 400, grabMain.y + grabMain.h / 2 - 300, { steps: 6 });
    const midDrag = await rectIn(page, TOGGLE, tid('pm-toggle'));
    const expectCenter = beforeDrag.x + beforeDrag.w / 2 - 400;
    check(
      Math.abs(midDrag.x + midDrag.w / 2 - expectCenter) < 5,
      `拖动中跟手，不被钉在右缘（中心 ${Math.round(midDrag.x + midDrag.w / 2)}，期望 ${Math.round(expectCenter)}）`,
    );
    const midState = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"] .pm-tg-main-icon')?.dataset.state ?? null,
      TOGGLE,
    );
    check(midState === 'on', `从按钮上发起的拖动不误触开关（面具图标仍是 on=${midState}）`);
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
    // 0.8.6 自由定位（#135）：落库的就是拖到的坐标（已夹进视口），不再贴边
    check(
      stored.floatingBtnPos.x >= 8 && stored.floatingBtnPos.x <= 1000 - 101 - 8,
      `落库坐标在视口内且不再贴边（x=${stored.floatingBtnPos.x}）`,
    );
    // 再拖一次到左上角外侧：贴边不出视口（这次从「⋯」上发起——四颗钮都能当拖动起点）
    const grabMore = await rectIn(page, TOGGLE, tid('pm-toggle-more'));
    await page.mouse.move(grabMore.x + grabMore.w / 2, grabMore.y + grabMore.h / 2);
    await page.mouse.down();
    await page.mouse.move(0, 0, { steps: 4 });
    await page.mouse.up();
    const corner = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      corner.x >= 0 && corner.x <= 10 && corner.y >= 0 && corner.y <= 10,
      `拖到左上角时贴边、不出视口（${Math.round(corner.x)},${Math.round(corner.y)}）`,
    );
    // 阈值内的小幅移动仍是点击：按下移动 3px 抬起，开关照常切换（不误判成拖动）
    const j = await rectIn(page, TOGGLE, tid('pm-toggle-main'));
    await page.mouse.move(j.x + j.w / 2, j.y + j.h / 2);
    await page.mouse.down();
    await page.mouse.move(j.x + j.w / 2 + 3, j.y + j.h / 2 + 3, { steps: 2 });
    await page.mouse.up();
    await new Promise((res) => setTimeout(res, 150));
    const jitterState = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"] .pm-tg-main-icon')?.dataset.state ?? null,
      TOGGLE,
    );
    check(jitterState === 'off', `阈值内移动仍是点击：开关切换了（state=${jitterState}，8px 阈值不误伤点击）`);
    // 复位开关，别让下面的用例踩到原样态
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised' });
    await new Promise((res) => setTimeout(res, 300));
    // 方向键移动（0.8.8 挂在胶囊本体上）：本体聚焦后按右箭头，位置与存储一起动
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle"]').focus(), TOGGLE);
    const kbBefore = await rectIn(page, TOGGLE, tid('pm-toggle'));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await new Promise((res) => setTimeout(res, 300));
    const kbAfter = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(Math.abs(kbAfter.x - (kbBefore.x + 30)) <= 2, `方向键右移 2×15px（x ${Math.round(kbBefore.x)} → ${Math.round(kbAfter.x)}）`);

    // 按钮放回右下角（#90：坐标已存，菜单这时是八项三条线）
    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'));
    const movedMenu = await page.evaluate((h) => {
      const menu = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-menu"]');
      const label = (b) => b.textContent.trim();
      return {
        items: [...menu.querySelectorAll('.pm-tg-item')].map(label),
        seps: menu.querySelectorAll('.pm-tg-sep').length,
      };
    }, TOGGLE);
    const movedItems = menuRows(SURFACES, true).map((row) => row.labelZh);
    check(
      movedMenu.items.join(' / ') === movedItems.join(' / ') &&
        movedMenu.seps === new Set(menuRows(SURFACES, true).map((row) => row.group)).size - 1,
      `拖过之后菜单项与对照表一致、两条分隔线（媒体开关在胶囊媒体钮上，#131；${movedMenu.items.join(' / ')}，${movedMenu.seps} 条）`,
    );
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

    // ===================== 显示条件：有设置就显示（#67） =====================
    console.log('\n--- 显示条件：有设置就显示，加载时四项全空才不显示（#135） ---');
    const RULES = profileOf(ORIGIN).hideRules;
    // 只改过标题、一条收起项都没有：胶囊仍然要在（否则页面上一点痕迹都没有，下次想改只能靠记住工具栏图标）
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised', hideRules: [] });
    await waitFor(
      page,
      '0 条规则已生效（广告位重新可见）',
      () => getComputedStyle(document.querySelector('#ad')).display !== 'none',
      [],
      { timeout: 5000 },
    );
    check(!!(await page.$(TOGGLE)), '只改过标题、0 条收起项的网站也显示胶囊');

    await clickInShadow(page, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(page, TOGGLE, tid('pm-toggle-menu'), { timeout: 3000 });
    const noRulesMenu = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const menu = sr.querySelector('[data-testid="pm-toggle-menu"]');
      const label = (b) => b.textContent.trim();
      return {
        items: [...menu.querySelectorAll('.pm-tg-item')].map(label),
      };
    }, TOGGLE);
    check(
      noRulesMenu.items.join(' / ') === menuRows(SURFACES, false).map((row) => row.labelZh).join(' / '),
      `0 条收起项时菜单与对照表一致：收起内容这时就是纯添加（#90/#120：上一用例已归位、默认位时无「放回右下角」，${noRulesMenu.items.join(' / ')}）`,
    );
    await page.keyboard.press('Escape');

    // 原样态、0 条规则：切换入口本身有用，同样要挂着（0.8.6 起状态由面具图标描边表达，#135）
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitFor(
      page,
      '原样态、0 条规则时胶囊仍在且面具摘下',
      (h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-main"] .pm-tg-main-icon')?.dataset.state === 'off',
      [TOGGLE],
      { timeout: 5000 },
    );
    check(true, '原样态下 0 条收起项也显示胶囊，文字是「原样」');

    // 四项全空才不挂（#98：还要把「保存过标题和图标」的标记一起清掉，否则仍算有设置）。
    // 但判据只在页面加载时决定胶囊生死（#135）：中途清空，已挂着的胶囊不拆——
    // 否则页面上一点入口都不剩；刷新后按判据该藏就藏（灰-only 场景在 check-media.mjs 验证）
    await patchProfile(ext.control, ORIGIN, {
      disguisedTitle: null,
      icon: { kind: 'none' },
      titleIconSet: false,
      hideRules: [],
    });
    await waitFor(page, '配置清空后标题还原（这轮刷新已跑完）', (t) => document.title === t, ['Acme 阅读'], { timeout: 5000 });
    await new Promise((res) => setTimeout(res, 500));
    check(!!(await page.$(TOGGLE)), '中途清空配置：胶囊不拆（#135 会话内不消失）');

    // 恢复：后面的幕布用例要 1 条规则与固定标题
    await patchProfile(ext.control, ORIGIN, {
      switchState: 'disguised',
      disguisedTitle: '低调阅读',
      titleIconSet: true,
      hideRules: RULES,
    });
    await waitFor(page, '恢复设置后胶囊挂回来', (t) => document.title === t, ['低调阅读'], { timeout: 5000 });
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    check(true, '重新有设置后胶囊挂回来');

    // ===================== 空设置时点主按钮：照常切换 + 一句说明（#158） =====================
    console.log('\n--- 空设置时点主按钮：开关照常切换，另用说明框讲一句（#158） ---');
    // 段末整份写回：后面幕布段有「存储里没有新字段」的断言，字段集合必须与进来时一模一样
    const beforeEmptyNote = await getProfile(ext.control, ORIGIN);
    // 只开灰度：主开关管不到灰度（ADR-0014）→ 算「空设置」；胶囊按 #116 仍要挂在页面上
    await setProfile(ext.control, ORIGIN, {
      ...profileOf(ORIGIN),
      switchState: 'original',
      disguisedTitle: null,
      titleIconSet: false,
      hideRules: [],
      mediaGray: true,
    });
    await page.reload({ waitUntil: 'load' });
    await page.bringToFront();
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const noteStage = () =>
      page.evaluate((h) => {
        const sr = document.querySelector(h)?.shadowRoot;
        const dlg = sr?.querySelector('[data-testid="pm-tg-empty-dialog"]');
        return {
          open: !!dlg?.matches(':modal'),
          text: sr?.querySelector('[data-testid="pm-tg-empty-text"]')?.textContent.trim() ?? '',
          focus: sr?.activeElement?.dataset?.testid ?? null,
          buttons: dlg ? [...dlg.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
        };
      }, TOGGLE);
    check(!(await noteStage()).open, '前置：空设置的站点平时没有说明框（只在点下去那一刻出现）');

    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'));
    await waitFor(page, '空设置说明框打开', (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]')?.matches(':modal'), [TOGGLE], { timeout: 3000 });
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '点主按钮仍照常切换开关');
    check(true, '空设置时点主按钮：开关照常切到「按设置」（不是死按钮，三处行为一致）');
    const note = await noteStage();
    check(note.text === '打开后页面不变', `说明框写同一句话（${note.text}）`);
    check(note.buttons.length === 1 && note.buttons[0] === '知道了', `只有一个「${note.buttons.join(' / ')}」，没有第二个选择`);
    check(note.focus === 'pm-tg-empty-ok', `默认焦点在「知道了」上（${note.focus}）`);

    // 回车关：焦点已在按钮上，回车即提交表单
    await page.keyboard.press('Enter');
    await waitFor(page, '回车关掉说明框', (h) => !document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]'), [TOGGLE], { timeout: 3000 });
    check(true, '回车关掉说明框');
    check((await getProfile(ext.control, ORIGIN)).switchState === 'disguised', '关掉说明框不会再多拨一次开关');

    // Esc 关：原生 <dialog> 的 Esc 行为，关掉后节点一并卸掉
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'));
    await waitFor(page, '说明框再次打开', (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]')?.matches(':modal'), [TOGGLE], { timeout: 3000 });
    await page.keyboard.press('Escape');
    await waitFor(page, 'Esc 关掉说明框', (h) => !document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]'), [TOGGLE], { timeout: 3000 });
    check(true, 'Esc 关掉说明框');

    // 点框外（幕布区域）关：纯说明不是要用户做选择，点外面即撤
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'));
    await waitFor(page, '说明框第三次打开', (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]')?.matches(':modal'), [TOGGLE], { timeout: 3000 });
    await page.mouse.click(8, 8);
    await waitFor(page, '点框外关掉说明框', (h) => !document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-empty-dialog"]'), [TOGGLE], { timeout: 3000 });
    check(true, '点框外关掉说明框');

    // 有了收起内容 → 判据不成立：点主按钮只切换开关，不再弹说明（说明自动消失）
    await patchProfile(ext.control, ORIGIN, { hideRules: RULES });
    await waitFor(page, '广告位恢复收起（这条规则已生效）', () => getComputedStyle(document.querySelector('#ad')).display === 'none', [], { timeout: 5000 });
    const before = (await getProfile(ext.control, ORIGIN)).switchState;
    await clickInShadow(page, TOGGLE, tid('pm-toggle-main'));
    await poll(async () => (await getProfile(ext.control, ORIGIN)).switchState !== before, '有设置时点主按钮照常切换');
    await new Promise((res) => setTimeout(res, 300));
    check(!(await noteStage()).open, '有设置之后不再弹说明框（判据成立就消失）');

    // 收尾：整份写回进来时的配置（字段集合不变）
    await setProfile(ext.control, ORIGIN, beforeEmptyNote);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await waitFor(page, '恢复基线：清爽态标题', (t) => document.title === t, ['低调阅读'], { timeout: 5000 });

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
      check(c.textVsPill >= 4.5, `${meta.label}：开态墨色图标对选中底 ≥4.5:1（${c.textVsPill}:1，#152）`);
    }

    // ===================== 开启态外观（0.8.15 #149）：两颗共用一条规则 + reduced-motion 过渡 =====================
    console.log('\n--- 开启态：主按钮与媒体钮同源同态、状态过渡 ---');
    const savedProfile = await getProfile(ext.control, ORIGIN); // 段末整份写回，避免给幕布段的字段集合断言添新字段
    await patchProfile(ext.control, ORIGIN, { switchState: 'disguised', mediaGray: true });
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await waitFor(page, '主按钮与媒体钮都处于开启态', () => {
      const sr = document.querySelector('pagemask-toggle')?.shadowRoot;
      return sr?.querySelector('[data-testid="pm-toggle-main"]')?.getAttribute('data-state') === 'on'
        && sr?.querySelector('[data-testid="pm-toggle-media"]')?.getAttribute('data-state') === 'on';
    }, [], { timeout: 5000 });
    await page.mouse.move(60, 400);
    await waitFor(page, '主按钮与媒体钮开态计算样式都落定（#152）', toggleSettled, [TOGGLE, ['pm-toggle-main', 'pm-toggle-media'], true], { timeout: 8000 });
    const onPair = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const probe = document.createElement('span');
      probe.style.color = 'var(--pm-fg)';
      probe.style.backgroundColor = 'var(--pm-bg-selected)';
      sr.appendChild(probe);
      const pcs = getComputedStyle(probe);
      const fg = pcs.color;
      const selectedBg = pcs.backgroundColor;
      probe.remove();
      const read = (id) => {
        const b = sr.querySelector(`[data-testid="${id}"]`);
        const cs = getComputedStyle(b);
        return {
          bg: cs.backgroundColor,
          color: cs.color,
          boxShadow: cs.boxShadow,
          iconColor: getComputedStyle(b.querySelector('svg')).color,
          pressed: b.getAttribute('aria-pressed'),
        };
      };
      return { fg, selectedBg, main: read('pm-toggle-main'), media: read('pm-toggle-media') };
    }, TOGGLE);
    check(
      onPair.main.bg !== 'rgb(31, 35, 41)' && onPair.main.bg === onPair.selectedBg &&
        onPair.media.bg === onPair.selectedBg,
      `两颗开态都是淡灰选中底、不是墨底反白（主 ${onPair.main.bg} / 媒体 ${onPair.media.bg}，#152）`,
    );
    check(
      onPair.main.color === onPair.fg && onPair.media.color === onPair.fg &&
        onPair.main.iconColor === onPair.fg && onPair.media.iconColor === onPair.fg,
      `两颗开态图标色都是 --pm-fg 实算值（${onPair.fg}，#152）`,
    );
    check(
      onPair.main.boxShadow === 'none' && onPair.media.boxShadow === 'none',
      `两颗开态静止时没有指示条 / state layer（主 ${onPair.main.boxShadow}，#152）`,
    );
    check(
      onPair.main.color === onPair.media.color &&
        onPair.main.iconColor === onPair.media.iconColor &&
        onPair.main.boxShadow === onPair.media.boxShadow &&
        onPair.main.bg === onPair.media.bg,
      '主按钮与媒体钮开态共用一套外观（墨色图标 / 选中底 / 无指示条全一致，#152）',
    );
    check(
      onPair.main.pressed === 'true' && onPair.media.pressed === 'true',
      '两颗开态仍由 aria-pressed 向读屏报状态（#152 不动 data-state 契约）',
    );

    // 悬停 / 按下的可见反馈（#152）：state layer 薄层盖在选中底上，background 不变
    const hoverState = await (async () => {
      const btn = await page.evaluate((h) => {
        const b = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-media"]');
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, bg: getComputedStyle(b).backgroundColor };
      }, TOGGLE);
      await page.mouse.move(btn.x, btn.y);
      await page.waitForFunction(
        (h) => {
          const b = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-media"]');
          const cs = getComputedStyle(b);
          return cs.boxShadow !== 'none' && cs.boxShadow.includes('inset') && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
        },
        { timeout: 4000, polling: 50 },
        TOGGLE,
      );
      return page.evaluate((h) => {
        const b = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-media"]');
        const cs = getComputedStyle(b);
        return { shadow: cs.boxShadow, bg: cs.backgroundColor, color: cs.color };
      }, TOGGLE);
    })();
    check(
      hoverState.shadow.includes('inset') && hoverState.bg === onPair.selectedBg && hoverState.color === onPair.fg,
      `开态悬停有 state layer 薄层、选中底与图标色不变（shadow=${hoverState.shadow}，#152）`,
    );
    await page.mouse.move(60, 400);

    // prefers-reduced-motion 下不是 0ms：保留 120ms 纯色 / opacity 淡变、去掉位移缩放（#149）
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reduceMotion = await page.evaluate((h) => {
      const main = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"]');
      const cs = getComputedStyle(main);
      return { property: cs.transitionProperty, duration: cs.transitionDuration };
    }, TOGGLE);
    const reduceProps = reduceMotion.property.split(',').map((s) => s.trim());
    const reduceDurs = reduceMotion.duration.split(',').map((s) => parseFloat(s.trim()));
    check(
      reduceProps.includes('color') && reduceProps.includes('opacity') &&
        reduceDurs.length > 0 && reduceDurs.every((d) => d > 0 && d <= 0.4),
      `reduced-motion 下仍有 >0 且 <400ms 的 color/opacity 过渡（property=${reduceMotion.property} / duration=${reduceMotion.duration}，#149）`,
    );
    // 普通模式：状态过渡是 150ms，不是 0ms 突变
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const normalMotion = await page.evaluate((h) => {
      const main = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-toggle-main"]');
      const cs = getComputedStyle(main);
      return { property: cs.transitionProperty, duration: cs.transitionDuration };
    }, TOGGLE);
    const normalDurs = normalMotion.duration.split(',').map((s) => parseFloat(s.trim()));
    check(
      normalMotion.property.includes('box-shadow') && normalDurs.length > 0 && normalDurs.every((d) => Math.abs(d - 0.15) < 0.001),
      `普通模式状态过渡 150ms（property=${normalMotion.property} / duration=${normalMotion.duration}，#149）`,
    );
    await setProfile(ext.control, ORIGIN, savedProfile); // 整份写回，精确恢复字段集合（幕布段要断言「没有新字段」）

    // ===================== 幕布：一键遮住整页（#45 / #50） =====================
    console.log('\n--- 幕布：遮住 / 恢复（#45 / #50） ---');
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });

    // 先把胶囊放到一个已知的自由坐标（x=1000，y=220；0.8.6 起不再贴边，#135）：
    // 幕布恢复按钮与该站胶囊共用同一份坐标（遮住前后同位，不跳位）
    await patchProfile(ext.control, ORIGIN, { floatingBtnPos: { x: 800, y: 220 } });
    const vw = await page.evaluate(() => window.innerWidth);
    await waitFor(
      page,
      '胶囊挂在指定自由坐标',
      (h) => {
        const r = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle"]')?.getBoundingClientRect();
        return !!r && Math.round(r.x) === 800 && Math.round(r.y) === 220;
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
        capsuleY: (() => {
          const t = document.querySelector('pagemask-toggle');
          return t ? Math.round(t.getBoundingClientRect().y) : null;
        })(),
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
      covered.btn !== null &&
        Math.abs(covered.btn.x - 800) <= 1 &&
        Math.round(covered.btn.y) === 220,
      `恢复按钮落在该站胶囊记录的自由坐标（x=${covered.btn?.x}，y=${covered.btn?.y}）`,
    );
    check(covered.opacity === '1', `恢复按钮常态全不透明（遮住后唯一出路，白底上要过 3:1，#87；${covered.opacity}）`);
    check(
      covered.labelText === '恢复' && covered.labelOpacity === '1',
      `「恢复」二字常显，不靠悬停才自我解释（#92 审查；文字不透明度 ${covered.labelOpacity}）`,
    );
    check(covered.radius === '999px' && covered.btnBg === 'rgb(255, 255, 255)', `与胶囊同一套材质（圆角 ${covered.radius}、底色 ${covered.btnBg}）`);
    check(!!covered.aria && covered.aria.includes('取消遮住'), `按钮有可读名字（${covered.aria}）`);

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
      Math.round(capsuleBack.x) === 800 && Math.round(capsuleBack.y) === 220,
      `撤幕后胶囊在原自由坐标挂回来（x=${Math.round(capsuleBack.x)}，y=${Math.round(capsuleBack.y)}）`,
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
        if (p?.floatingBtnPos && p.floatingBtnPos.y !== 220) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(
      !!draggedProfile.floatingBtnPos && draggedProfile.floatingBtnPos.y !== 220,
      `拖动后写回该站胶囊坐标（floatingBtnPos=${JSON.stringify(draggedProfile.floatingBtnPos)}）`,
    );
    const draggedRect = await rectIn(page, CURTAIN, tid('pm-curtain-restore'));
    // 0.8.6 自由定位：松手落在拖到的位置（不贴边），与落库坐标一致
    check(
      Math.abs(draggedRect.x - draggedProfile.floatingBtnPos.x) < 2 &&
        Math.abs(draggedRect.y - draggedProfile.floatingBtnPos.y) < 2,
      `松手停在拖到的自由坐标（x=${Math.round(draggedRect.x)} ≈ 落库 ${draggedProfile.floatingBtnPos.x}）`,
    );
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });
    await page.waitForSelector(TOGGLE, { timeout: 5000 });
    const capsuleMoved = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(capsuleMoved.x - draggedProfile.floatingBtnPos.x) < 2,
      `撤幕后胶囊停在拖动后的自由坐标（x=${Math.round(capsuleMoved.x)}）`,
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
    await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 5000 });
    const wizardState = await page.evaluate(() => ({
      curtain: !!document.querySelector('pagemask-curtain'),
      hit: document.elementFromPoint(500, 300)?.tagName?.toLowerCase() ?? null,
    }));
    check(!wizardState.curtain, '进向导前幕布先撤掉');
    check(wizardState.hit !== 'pagemask-curtain', `向导打开后页面可见（命中 ${wizardState.hit}）`);
    // #123 起退出设置每次都先问一次
    await exitWizardByButton(page, WIZARD);
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

    // ===================== 单形态确认（0.8.6 单形态 + 0.8.8 无把手，#136） =====================
    console.log('\n--- 单形态胶囊：无折叠钮、无把手、本体可拖可聚焦 ---');
    const singleShape = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const root = sr.querySelector('[data-testid="pm-toggle"]');
      return {
        fold: !!sr.querySelector('[data-testid="pm-toggle-shrink"], [data-testid="pm-toggle-expand"]'),
        grip: !!sr.querySelector('[data-testid="pm-toggle-grip"]'),
        more: !!sr.querySelector('[data-testid="pm-toggle-more"]'),
        label: !!sr.querySelector('.pm-tg-label'),
        focusable: root?.getAttribute('tabindex'),
        role: root?.getAttribute('role'),
        cursor: getComputedStyle(root).cursor,
      };
    }, TOGGLE);
    check(!singleShape.fold && !singleShape.label, '折叠钮与文字标签退场：单一形态（#135）');
    check(!singleShape.grip && singleShape.more, '把手退场（整根胶囊都能拖）、⋯ 菜单常驻（#136）');
    check(
      singleShape.focusable === '0' && singleShape.role === 'group',
      `本体可聚焦、role=group（方向键挂本体：${singleShape.role}/tabindex=${singleShape.focusable}）`,
    );
    check(singleShape.cursor === 'grab', `本体空闲光标是抓手（${singleShape.cursor}）`);

    // 自由坐标拖动（#135→#136）：从胶囊本体拖到视口中部，落库原坐标、不再贴边
    const dragFrom2 = await rectIn(page, TOGGLE, tid('pm-toggle-main'));
    await page.mouse.move(dragFrom2.x + dragFrom2.w / 2, dragFrom2.y + dragFrom2.h / 2);
    await page.mouse.down();
    await page.mouse.move(600, 350, { steps: 8 });
    await page.mouse.up();
    await new Promise((res) => setTimeout(res, 400));
    const movedPill = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(movedPill.x - (600 - (dragFrom2.x + dragFrom2.w / 2 - dragFrom2.x))) < 60 || Math.abs(movedPill.x - 600) < 60,
      `拖到视口中部生效（x=${Math.round(movedPill.x)}）`,
    );
    check(Math.abs(movedPill.y - 350) < 60, `纵向也自由（y=${Math.round(movedPill.y)}）`);

    // ===================== 叠放：页面超高浮层之上的模态对话框 =====================
    console.log('\n--- 页面浮层 z-index:2147483647 时，向导对话框仍在最上层 ---');
    await page.goto(`${ORIGIN}/white`, { waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'));
    // 先选一个元素，退出时才需要确认框（没有选择会直接退出）。不能点 #ad：
    // 这个网站的规则本来就收着它（.ad），点它属于原地替换那一条而不是新选（#77）
    const body = await page.evaluate(() => {
      const r = document.querySelector('#content h1').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(body.x, body.y);
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

    // ===================== 单站「不显示胶囊」（#111：数据与行为） =====================
    console.log('\n--- 不显示胶囊：隐藏后有设置也不挂，其余功能不受影响 ---');
    // 隐藏 + 故意留一堆旧形态残留（mini、非默认位置）：模拟「藏之前用过的状态」
    await patchProfile(ext.control, ORIGIN, { capsuleHidden: true, floatingBtnPos: { x: 0, y: 100 } });
    await page.reload({ waitUntil: 'load' });
    await new Promise((res) => setTimeout(res, 800)); // 负向断言：等过挂载时机
    check(!(await page.$(TOGGLE)), 'capsuleHidden:true：有设置也不挂胶囊');
    const hiddenState = await page.evaluate(() => ({
      title: document.title,
      ad: getComputedStyle(document.querySelector('#ad')).display,
    }));
    check(hiddenState.title === '低调阅读' && hiddenState.ad === 'none', '隐藏胶囊不影响收起规则与标题（仍是清爽态）');

    // 隐藏期间快捷键遮住 → 幕布正常、恢复按钮在（隐藏只影响胶囊本身）
    await sendToTab(ext.control, await tabIdOf(ext.control, `${ORIGIN}/*`), { t: 'curtainToggle' });
    await waitForShadow(page, CURTAIN, tid('pm-curtain-restore'), { timeout: 3000 });
    check(!!(await page.$(CURTAIN)), '隐藏胶囊时快捷键仍能遮住整页');
    await clickInShadow(page, CURTAIN, tid('pm-curtain-restore'));
    await waitFor(page, '幕布撤掉', (h) => !document.querySelector(h), [CURTAIN], { timeout: 3000 });

    // 重新显示：按弹窗（#112）将要做的那次写入——hidden=false、位置与形态一并重置——
    // 直写存储后刷新：胶囊回到右下角默认位置、全功能形态
    await patchProfile(ext.control, ORIGIN, { capsuleHidden: false, floatingBtnPos: null });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    const reshown = await rectIn(page, TOGGLE, tid('pm-toggle'));
    check(
      Math.abs(vw - reshown.right - 16) < 2 && Math.abs(reshown.bottom - 684) < 3,
      `显示后胶囊回到右下角默认位置（右距 ${Math.round(vw - reshown.right)}px、底距 ${Math.round(700 - reshown.bottom)}px）`,
    );
    check(
      !(await page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-grip"]'), TOGGLE)),
      '显示后是全功能形态（无把手残留，mini 旧态被清掉，#136）',
    );
    check(!!(await page.evaluate((h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-toggle-more"]'), TOGGLE)), '显示后是全功能形态（⋯ 菜单常驻）');

    // ===================== 幕布：未添加网站的一次性脚本（#46 / #50） =====================
    console.log('\n--- 幕布：未添加网站的一次性脚本（#46 / #50） ---');
    // 删掉配置：这个网站从此"没添加过"，页面里没有内容脚本、没有悬浮胶囊
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), siteKeyOf(ORIGIN));
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
      oneShot.opacity === '1' && oneShot.radius === '999px' && oneShot.btnBg === 'rgb(255, 255, 255)',
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
      (await ext.control.evaluate(async (o) => (await chrome.storage.local.get(`profile:${o}`))[`profile:${o}`], siteKeyOf(ORIGIN))) === undefined,
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
    await ext.control.evaluate((o) => chrome.storage.local.remove(`profile:${o}`), siteKeyOf(ORIGIN));
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
        del.impact.includes('从列表里消失'),
      `正文说清删什么、还会发生什么（${del.impact}）`,
    );
    check(del.focus === 'pm-tg-delete-cancel', `默认焦点在「取消」上（${del.focus}）`);
    check(
      del.confirmText === '删除设置' && del.confirmBg === del.danger,
      `危险按钮是实底红、写「${del.confirmText}」（${del.confirmBg}）`,
    );

    // Esc 取消：什么都不删
    await page.keyboard.press('Escape');
    // 等元素真正从 DOM 移除：只看 :modal 会在 Vue 移除前的这一帧里返回，
    // 紧接着的第二次「⋯ → 删除」会落在还没卸载的对话框上（deleteOpen 仍为 true，不会重新挂载）
    await waitFor(
      page,
      'Esc 关闭确认框',
      (h) => !document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-tg-delete-dialog"]'),
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
      'pagemask-toggle, pagemask-wizard, pagemask-mask, pagemask-curtain, pagemask-notice',
    );
    check(afterDelete.hosts === 0, `页面上没有任何 PageMask 界面（${afterDelete.hosts} 个宿主）`);
    check(afterDelete.hit !== 'pagemask-toggle', `页面内容恢复正常（视口中心命中 ${afterDelete.hit}）`);
    check((await getProfile(ext.control, ORIGIN)) === null, '站点配置已删除');
    check(
      (await ext.control.evaluate((pt) => chrome.permissions.contains({ origins: [pt] }), `${ORIGIN}/*`)) === false,
      '浏览器给 PageMask 的访问权限已收回',
    );

    // 「全部网站设置」列表里也没有了
    const mgmt = await ext.browser.newPage();
    await mgmt.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
    await mgmt.waitForSelector(tid('pm-mgmt-empty'), { timeout: 5000 });
    check(
      (await mgmt.$$eval('li[data-origin]', (rows) => rows.length)) === 0,
      '管理页「全部网站设置」里已经没有它',
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
