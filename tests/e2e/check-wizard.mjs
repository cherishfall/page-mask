/**
 * 设置向导状态机验收（#34、#44、#51、#52、#53，审查 N6–N15、N21、N22）：真实鼠标 / 键盘操作，夹具是虚构的长页面。
 *
 * 运行：npm run build && node tests/e2e/check-wizard.mjs     （约 20 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 两条独立流程（#81）：「收起内容」两步（选内容 → 看效果，每一步显示「第 N 步 / 共 M 步」）、
 *   「标题和图标」单步小表单；没有「首次设置」模式，新网站与老网站同一条路
 * - 底栏只放按钮（说明文字不进操作栏）；退出是文字按钮「退出设置」；「上一步」写清退回去做什么；
 *   退出确认的两个按钮同一次级（继续设置 = 次按钮，退出 = 红字红边的次按钮）
 * - 标题和图标（单步）：默认标题已填、快捷标题、选预置图标后标签页标题 / 图标实时跟着变；
 *   保存 0 条收起设置的清爽态配置、向导关闭、页面上仍然显示小胶囊（有设置就显示，#67），
 *   列表里能看到它；关掉向导后有一句轻提示说明标签页标题已经换了（#53）
 * - 新网站取消：确认框说明已选内容不保存、标签页会变回原来的标题；退出后完全还原、授权收回（#81）
 * - 页内空清单：空状态说明（#71）；不把空清单摆给用户看
 * - 选 A/B/C 后取消 A：序号牌只剩 1、2 并跟着 B、C（N6）；「选大一点」作用对象显示为最后选中的那项（N13）
 * - 预览：默认行只有序号 / 名字 / 一句话摘要 / 调整 / ✕，收起方式等折在「调整」里（#69、审查第 8 条）；
 *   删除按钮无框、悬停才出底色（#53）；
 *   行内换收起方式（原生 radio）立即生效、下面的解释跟着换、第 2 项号码牌位置不变（N7、N8）；
 *   号码牌之外的标记不拦截点击（N8）；点号码牌滚到清单对应行并高亮，不再有调整弹片
 * - 「页面上另外 N 个一样的也一起收起」勾选框住在选内容清单的行内（#82）：勾谁看谁、一次一组整组展开——
 *   整组统一一条描边样式规则（小组与大组同一形态，#100；不为成员逐个建 DOM，滚动新出现的同类自动带上）；
 *   点已勾选的行切换亮着的组；
 *   点带标记的组员 = 取消那条规则，再点 = 按默认值加回；看效果不再有这道勾选框，勾了同类的行摘要报数
 * - 底部「在哪些页面收起」三选一；清爽态点保存直接落库并关掉向导，原样态先问一次
 *   「保存后看不到效果」（#159：两条路都保存，只有「现在打开」切开关）
 * - 行内改名在清单重绘后保留；点 ✕ 删除这一项后选择集同步减少，删到 0 项回到点选阶段（N11）
 * - Esc：没有浮层时 Esc 弹出退出确认；确认框上 Esc = 继续设置（N9）
 * - 「上一步」后已改的方案与选项保留，只给新元素建草稿（N12）
 * - 退出后预览样式撤掉（不允许免保存临时隐藏）
 * - 选择阶段：滚轮滚动后不移动鼠标直接点击，选中的是指针下的元素，悬停框也换到新元素（N14）
 * - 「选大一点」作用于最后选中的元素并原位替换（N13、N6）
 * - 工具条默认在底部、不挡页面顶部；拖动把手和方向键能移动且不出可视区（N15）
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, poll, siteKeyOf, startServer, waitFor } from './lib/harness.mjs';
import {
  getProfile,
  launchExtension,
  sendToBackground,
  sendToTab,
  setProfile,
  tabIdOf,
} from './lib/extension.mjs';
import { clickInShadow, shadowExists, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const HOST = 'pagemask-wizard';
const TOGGLE = 'pagemask-toggle';
const NOTICE = 'pagemask-notice';
const tid = (id) => `[data-testid="${id}"]`;
const C1 = '.card:nth-child(1)';
const C2 = '.card:nth-child(2)';
const C3 = '.card:nth-child(3)';

/** 虚构长页面：顶部导航、三张同类卡片、25 条同类帖子（大组描边档）、活动栏、横幅，以及 40 行可滚动的内容 */
const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 书房 · 向导测试</title>
<style>body{margin:0;font:14px system-ui,sans-serif}nav{height:48px;background:#eef;padding:0 16px;line-height:48px}
.cards{display:flex;gap:12px;padding:12px 16px;margin:0;list-style:none}.card{flex:1;height:80px;background:#ffe}
#promo{height:60px;background:#fee;margin:12px 16px}#banner{height:60px;background:#efe;margin:12px 16px}
#feed .post{height:40px;background:#f6f6ff;border-bottom:1px solid #dde;padding:0 16px;line-height:40px;margin:0}
#dense-list{list-style:none;margin:0;padding:0 0 0 40px}#dense-list li{height:24px;line-height:24px;padding:0 16px;background:#f0fff4;border-bottom:1px solid #dde}
.row{height:60px;border-bottom:1px solid #ddd;padding:0 16px;line-height:60px}.row .txt{display:inline-block;width:120px}</style>
</head><body>
<nav id="top-nav">首页 书架 发现</nav>
<ul class="cards"><li class="card">卡片一</li><li class="card">卡片二</li><li class="card">卡片三</li></ul>
<aside id="promo">活动栏（示例）</aside>
<section id="banner">横幅（示例）</section>
${Array.from({ length: 40 }, (_, i) => `<div class="row" id="r${i}"><span class="txt" id="t${i}">第 ${i} 行</span></div>`).join('\n')}
<div id="feed">${Array.from({ length: 25 }, (_, i) => `<p class="post">帖子 ${i + 1}</p>`).join('\n')}</div>
<ul id="dense-list"><li><span class="dense-t">密行一</span></li><li><span class="dense-t">密行二</span></li><li><span class="dense-t">密行三</span></li></ul>
</body></html>`;

function handler(req, res) {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}

/** 页面元素的视口矩形 */
const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  }, sel);

/** 向导 shadow 内元素的视口矩形 */
const shadowRect = (page, sel) =>
  page.evaluate(
    (h, s) => {
      const r = document.querySelector(h)?.shadowRoot?.querySelector(s)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    },
    HOST,
    sel,
  );

const shadowTexts = (page, sel) =>
  page.evaluate(
    (h, s) => [...(document.querySelector(h)?.shadowRoot?.querySelectorAll(s) ?? [])].map((e) => e.textContent.trim()),
    HOST,
    sel,
  );

/** 保存前确认框（#159）的状态：文案、按钮顺序与档位、默认焦点、aria-labelledby */
const openDialogState = (page) =>
  page.evaluate((h) => {
    const sr = document.querySelector(h)?.shadowRoot;
    const dlg = sr?.querySelector('[data-testid="pm-wizard-open-confirm"]');
    if (!dlg) return null;
    const heading = dlg.querySelector('h2');
    return {
      open: dlg.open,
      tag: dlg.tagName,
      label: dlg.getAttribute('aria-labelledby'),
      headingId: heading?.id ?? null,
      heading: heading?.textContent.trim() ?? '',
      body: dlg.querySelector('p')?.textContent.trim() ?? '',
      buttons: [...dlg.querySelectorAll('.pm-wiz-actions button')].map((b) => ({
        testid: b.dataset.testid ?? null,
        text: b.textContent.trim(),
        primary: b.classList.contains('primary'),
      })),
      focus: sr.activeElement?.dataset.testid ?? null,
    };
  }, HOST);

/** 保存前是否真的弹出过确认框（清爽态 / 新站点不该弹；用 open 属性的变更抓，不靠事后看不见） */
async function watchOpenDialog(page) {
  await page.evaluate((h) => {
    window.__pmOpenDialogSeen = false;
    const dlg = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wizard-open-confirm"]');
    if (!dlg) return;
    new MutationObserver(() => {
      if (dlg.open) window.__pmOpenDialogSeen = true;
    }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  }, HOST);
}
const sawOpenDialog = (page) => page.evaluate(() => window.__pmOpenDialogSeen === true);

/**
 * 等第 seq 个标记的*框*与页面元素重合（标记跟随是逐帧的）。
 * 号码牌从 #52 起单独一个盒子、贴在元素外面（不压住元素自己的文字），所以这里核对的是框，
 * 号码牌位置另由 badgeOutsideEl 断言。
 */
function waitBoxOn(page, label, seq, elSel) {
  return waitFor(
    page,
    label,
    (h, s, e) => {
      const box = document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-box-${s}"]`);
      const el = document.querySelector(e);
      if (!box || !el) return false;
      const br = box.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return Math.abs(br.x - er.x) < 1.5 && Math.abs(br.y - er.y) < 1.5 && Math.abs(br.width - er.width) < 1.5;
    },
    [HOST, seq, elSel],
  );
}

/**
 * 号码牌不压住元素自己的文字：够高的元素浮在上方（完全在外），密行跨在左上角
 * （垂直中线与元素上边相接，#82 标记语言）。返回 null 表示还没画出来。
 */
function badgeOutsideEl(page, seq, elSel) {
  return page.evaluate(
    (h, s, sel) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const b = sr?.querySelector(`[data-testid="pm-badge-${s}"]`)?.getBoundingClientRect();
      const e = document.querySelector(sel)?.getBoundingClientRect();
      if (!b || !e) return null;
      const outside = b.bottom <= e.top + 0.5 || b.top >= e.bottom - 0.5;
      // 密行：牌的垂直中线与元素上边相接（跨角），横向不超出元素宽度
      const corner =
        Math.abs(b.top + b.height / 2 - e.top) < 1.5 && b.left < e.left + e.width && b.right > e.left;
      return outside || corner;
    },
    HOST,
    seq,
    elSel,
  );
}

const visible = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility === 'visible' && el.getBoundingClientRect().height > 0;
  }, sel);

function waitVisible(page, label, sel, want = true) {
  return waitFor(
    page,
    label,
    (s, w) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const cs = getComputedStyle(el);
      const v = cs.display !== 'none' && cs.visibility === 'visible' && el.getBoundingClientRect().height > 0;
      return v === w;
    },
    [sel, want],
  );
}

const wizardOpen = (page) => page.evaluate((h) => !!document.querySelector(h), HOST);

/** 清单行数（每行一个列表项） */
const draftCount = (page) =>
  page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid="pm-wiz-drafts"] > li').length ?? 0, HOST);

/** 第 n 行当前选中的收起方式（读原生 radio 的 checked value，而不是文本） */
const checkedStrategy = (page, n) =>
  page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`input[name="pm-strategy-${i}"]:checked`)?.value ?? null,
    HOST,
    n,
  );

/** 展开第 n 行的「调整」：收起方式、范围、重选、高级选择器都在里面（审查第 8 条） */
async function openAdjust(page, n) {
  const open = await page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-${i}-adjust"]`)?.getAttribute('aria-expanded') === 'true',
    HOST,
    n,
  );
  if (!open) await clickInShadow(page, HOST, tid(`pm-draft-${n}-adjust`));
}

const adjustExpanded = (page, n) =>
  page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-${i}-adjust"]`)?.getAttribute('aria-expanded'),
    HOST,
    n,
  );

/** 第 n 行下面那行解释文字 */
const rowHint = async (page, n) => (await shadowTexts(page, tid(`pm-draft-${n}-hint`)))[0] ?? '';
/** 选内容清单第 n 行那道勾选框的文字（「页面上另外 N 个一样的也一起收起」；不出现时返回空串，#82） */
const sameLabel = async (page, n) =>
  (await shadowTexts(page, `${tid(`pm-sel-${n}-same-group`)} span`)).join('');
/** 第 n 行勾选框的状态：true = 连页面上一样的也一起收；没有这道勾选框返回 null（#82 起在选内容行内） */
const sameChecked = (page, n) =>
  page.evaluate(
    (h, i) => {
      const box = document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-sel-${i}-same-toggle"]`);
      return box ? box.checked : null;
    },
    HOST,
    n,
  );
/** 回归守卫（#100 起应为空）：同一组统一走描边，页面上不该再出现 3.1、3.2 这类子号牌 */
const subBadgeTexts = (page) =>
  page.evaluate(
    (h) => [...(document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid^="pm-sub-badge-"]') ?? [])].map((e) => e.textContent.trim()),
    HOST,
  );
/** 页面元素的描边样式（大组 > 20 个时整片一条描边样式规则，#82） */
const outlineStyleOf = (page, sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).outlineStyle, sel);
const nameValue = (page, n) =>
  page.evaluate((h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-name-${i}"]`)?.value ?? null, HOST, n);
const inputValue = (page, id) =>
  page.evaluate((h, s) => document.querySelector(h)?.shadowRoot?.querySelector(s)?.value ?? null, HOST, tid(id));
const badgeCount = (page) =>
  page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid^="pm-badge-"]').length ?? 0, HOST);
const progressOf = async (page) => (await shadowTexts(page, tid('pm-wiz-progress')))[0] ?? '';
const headingOf = async (page) => (await shadowTexts(page, tid('pm-wiz-heading')))[0] ?? '';

/**
 * 底栏的直接子元素（纯空白文本节点不算）。
 * 操作栏只放按钮：任何说明文字都不许塞进这里（AGENTS.md「界面整屏审查」第 1 条）。
 */
const footerChildren = (page) =>
  page.evaluate(
    (h) => {
      const foot = document.querySelector(h)?.shadowRoot?.querySelector('.pm-wiz-footer');
      if (!foot) return null;
      return [...foot.childNodes]
        .filter((n) => n.nodeType === 1 || (n.textContent ?? '').trim() !== '')
        .map((n) => (n.nodeType === 1 ? { tag: n.tagName, testid: n.dataset?.testid ?? null } : { tag: '#text', testid: null }));
    },
    HOST,
  );

/** 某个按钮属于四档里的哪一档：看类名，也看实际算出来的底色 / 文字色 / 边框 */
const buttonLook = (page, id) =>
  page.evaluate(
    (h, s) => {
      const b = document.querySelector(h)?.shadowRoot?.querySelector(s);
      if (!b) return null;
      const cs = getComputedStyle(b);
      return {
        cls: String(b.className),
        text: b.textContent.trim(),
        bg: cs.backgroundColor,
        color: cs.color,
        border: parseFloat(cs.borderTopWidth),
        h: b.getBoundingClientRect().height,
      };
    },
    HOST,
    tid(id),
  );

/** 真实鼠标点页面元素（相对左上角的偏移，默认中心） */
async function clickEl(page, sel, dx, dy) {
  const rc = await rectOf(page, sel);
  if (!rc) throw new Error(`页面上没有 ${sel}`);
  await page.mouse.click(rc.x + (dx ?? rc.w / 2), rc.y + (dy ?? rc.h / 2));
}

async function main() {
  const srv = await startServer(handler);
  // 三个干净来源：#81 的「新站点取消」「新站点保存」「标题和图标保存」各用一个（取消会收回授权，不能复用）
  const srvNew = await startServer(handler);
  const srvNew2 = await startServer(handler);
  const srvNew3 = await startServer(handler);
  // 0.8.15（#150）单独一个干净来源：测工具条收窄 / 收起，不复用主流程已改过 profile 的页
  const srvC = await startServer(handler);
  const ORIGIN = srv.origin;
  const NEW_ORIGIN = srvNew.origin;
  const TITLE_ONLY_ORIGIN = srvNew2.origin;
  const CANCEL_ORIGIN = srvNew3.origin;
  const C_ORIGIN = srvC.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN, NEW_ORIGIN, TITLE_ONLY_ORIGIN, CANCEL_ORIGIN, C_ORIGIN] });
  try {
    const page = await ext.browser.newPage();
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/wizard.html`, { waitUntil: 'load' });
    const now = Date.now();
    await setProfile(ext.control, ORIGIN, {
      formatVersion: 1,
      origin: ORIGIN,
      switchState: 'original',
      disguisedTitle: null,
      icon: { kind: 'none' },
      // 老站点：已有 1 条规则，但范围只含一个不存在的页面——
      // #77 起向导会把「本页适用的旧规则」铺成草稿，这条不该被铺进来；保存时验证它原样不动
      hideRules: [
        {
          id: 'r_e2e_existing',
          elementName: '以前收起的项',
          candidates: ['#pm-not-in-this-page'],
          strategy: 'remove',
          scope: { type: 'include', patterns: [{ label: '只在不存在页面', prefix: `${ORIGIN}/never.html` }] },
          onlyThis: false,
          createdAt: now,
        },
      ],
      floatingBtnPos: null,
      createdAt: now,
      updatedAt: now,
    });
    const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const enabled = await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId });
    check(enabled?.ok === true, '测试站点已启用');
    await page.waitForSelector('pagemask-toggle', { timeout: 8000 });
    const openWizard = async () => {
      await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'editContent' });
      await waitForShadow(page, HOST, tid('pm-wizard-toolbar'));
    };

    // ===================== 序号重新编号（N6）、调整对象（N13） =====================
    console.log('\n--- 选择阶段：序号随选择变化重新编号 ---');
    await openWizard();
    check((await progressOf(page)) === '第 1 步 / 共 2 步', `「收起内容」停在选内容，第 1 步 / 共 2 步（${await progressOf(page)}）`);
    check((await headingOf(page)) === '点选要收起的内容', `标题说明这一步做什么（${await headingOf(page)}）`);
    check(!(await shadowExists(page, HOST, tid('pm-wiz-back'))), '选内容这一步左下角没有「上一步」（#81 两步流程）');
    check(!(await shadowExists(page, HOST, tid('pm-wiz-title-done'))), '「只改标题，完成」已经退场（#81）');
    // 右上角退出：文字按钮，不再是 28px 的裸 ✕
    const exitBtn = await buttonLook(page, 'pm-wiz-exit');
    check(
      exitBtn?.text === '退出设置' && exitBtn.cls.includes('pm-btn') && exitBtn.border > 0 && exitBtn.bg !== 'rgba(0, 0, 0, 0)',
      `右上角退出是文字按钮「退出设置」（${exitBtn?.text}，边框 ${exitBtn?.border}px、高 ${Math.round(exitBtn?.h ?? 0)}）`,
    );
    check(
      !(await shadowTexts(page, '.pm-wiz-head')).join(' ').includes('✕'),
      '右上角不再是一个裸的 ✕（✕ 只留给「去掉列表里这一项」）',
    );
    const tb = await shadowRect(page, tid('pm-wizard-toolbar'));
    const vh = await page.evaluate(() => innerHeight);
    check(tb.y > vh / 2 && tb.y + tb.h <= vh, `工具条默认在底部，不挡页面顶部导航（top=${Math.round(tb.y)}，视口高 ${vh}）`);

    // #123：刚打开、什么都没改，点「退出设置」也先问一次（按钮挨着拖动区，误触要拦一下）
    await clickInShadow(page, HOST, tid('pm-wiz-exit'));
    await waitFor(
      page,
      '没改动时点退出也弹确认',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open,
      [HOST],
      { timeout: 3000 },
    );
    const plainBody = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').innerText,
      HOST,
    );
    check(plainBody.includes('还没有改过内容'), `什么都没改时如实说明还要问这一次（${plainBody.replace(/\s+/g, ' ').slice(0, 40)}…）`);
    await clickInShadow(page, HOST, tid('pm-wiz-exit-no'));
    await waitFor(
      page,
      '「继续设置」关掉确认框',
      (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open,
      [HOST],
      { timeout: 3000 },
    );
    check(await shadowExists(page, HOST, tid('pm-wiz-exit')), '选了「继续设置」之后向导还在');

    // ===================== 第 2 步重排（#52）：说明分行、按用途分组、0 项出口 =====================
    console.log('\n--- 选内容：说明分行、按钮分组、0 项时前进禁用 ---');
    const leadLines = await shadowTexts(page, `${tid('pm-wiz-pick-lead')} li`);
    check(leadLines.length >= 3 && leadLines.every((t) => t.length <= 24), `说明拆成多行短句（${leadLines.join(' / ')}）`);
    check(
      !(await shadowExists(page, HOST, tid('pm-wiz-clear'))),
      '旧的整块「清空（N）」按钮已经不在了',
    );
    check(await shadowExists(page, HOST, tid('pm-wiz-group-adjust')), '「选大一点 / 选小一点」自成一组');
    const groupTitles = await shadowTexts(page, `${tid('pm-wiz-group-adjust')} .pm-wiz-group-title`);
    check(groupTitles.length === 1 && groupTitles[0].length > 0, `调整组有一行小标题（${groupTitles[0]}）`);
    check(
      (await shadowTexts(page, `${tid('pm-wiz-group-adjust')} .pm-wiz-group-note`))[0]?.includes('先在页面上点一下'),
      '没选中时，调整组里说明先选一个',
    );
    const groupBg = await page.evaluate(
      (h) => getComputedStyle(document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-group-adjust"]')).backgroundColor,
      HOST,
    );
    check(/rgb/.test(groupBg) && groupBg !== 'rgba(0, 0, 0, 0)', `分组有浅色底（${groupBg}）`);
    const btnGeom = await page.evaluate(
      (h) => {
        const sr = document.querySelector(h).shadowRoot;
        const a = sr.querySelector('[data-testid="pm-wiz-bigger"]').getBoundingClientRect();
        const b = sr.querySelector('[data-testid="pm-wiz-smaller"]').getBoundingClientRect();
        const other = sr.querySelector('[data-testid="pm-wiz-preview"]').getBoundingClientRect();
        return { sameSize: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, adjustW: a.width, otherW: other.width, otherY: other.y, adjustY: a.y };
      },
      HOST,
    );
    check(btnGeom.sameSize, `组内两个按钮尺寸一致（宽 ${Math.round(btnGeom.adjustW)}）`);
    check(btnGeom.otherY > btnGeom.adjustY + 8, '前进按钮不和调整按钮挤在同一行');
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').disabled, HOST)) === true,
      '0 项时前进按钮是灰的（disabled）',
    );
    check(
      !(await shadowExists(page, HOST, tid('pm-wiz-next-hint'))),
      '底栏里没有说明文字（「先在页面上点一下要收起的内容」已从操作栏删掉，空状态在清单里说）',
    );
    const footEmpty = await footerChildren(page);
    check(
      footEmpty?.length === 1 &&
        footEmpty.every((n) => n.tag === 'BUTTON') &&
        footEmpty[0].testid === 'pm-wiz-preview',
      `底栏只有按钮：选内容这一步只有前进（${JSON.stringify(footEmpty)}）`,
    );
    check((await shadowTexts(page, tid('pm-wiz-list-empty')))[0]?.includes('还没有选任何东西'), '0 项时清单是空状态');
    check(!(await shadowExists(page, HOST, tid('pm-wiz-clear-all'))), '清单为空时不显示「全部取消选择」');

    // 选三张同类卡片：清单一行一项，序号与号码牌一致
    await clickEl(page, C1);
    await clickEl(page, C2);
    await clickEl(page, C3);
    await waitFor(page, '清单三行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 3, [HOST]);
    const rowNums = await shadowTexts(page, `${tid('pm-wiz-selected')} .pm-wiz-num`);
    const rowNames = await shadowTexts(page, `${tid('pm-wiz-selected')} .pm-wiz-row-name`);
    check(JSON.stringify(rowNums) === '["1","2","3"]', `清单一行一项、序号 1/2/3（实际 ${JSON.stringify(rowNums)}）`);
    check(rowNames.length === 3 && rowNames[0].includes('卡片一') && rowNames[2].includes('卡片三'), `每行显示元素名字（${rowNames.join(' / ')}）`);
    check(
      !!(await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-group-list"]').querySelector('[data-testid="pm-wiz-clear-all"]')?.classList.contains('pm-wiz-link'), HOST)),
      '「全部取消选择」在清单标题行里、是文字链接（不是按钮）',
    );
    const listHeight = await shadowRect(page, tid('pm-wiz-selected'));
    const listScrollable = await page.evaluate((h) => {
      const el = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-selected"]');
      return { max: getComputedStyle(el).maxBlockSize, overflow: getComputedStyle(el).overflowY };
    }, HOST);
    check(
      listScrollable.overflow === 'auto' && (parseFloat(listScrollable.max) || 0) <= 200 && listHeight.h <= 200,
      `清单限高、内部滚动（max ${listScrollable.max}，当前高 ${Math.round(listHeight.h)}）`,
    );

    // 号码牌不再压住元素自己的文字（#52）
    await waitFor(page, '号码牌画到元素外面', (h) => {
      const sr = document.querySelector(h).shadowRoot;
      const b = sr.querySelector('[data-testid="pm-badge-1"]')?.getBoundingClientRect();
      const e = document.querySelector('.card:nth-child(1)')?.getBoundingClientRect();
      if (!b || !e) return false;
      const outside = b.bottom <= e.top + 0.5 || b.top >= e.bottom - 0.5;
      const corner = Math.abs(b.top + b.height / 2 - e.top) < 1.5 && b.left < e.left + e.width;
      return outside || corner;
    }, [HOST]);
    check((await badgeOutsideEl(page, 1, C1)) === true, '号码牌 1 不遮住「卡片一」的文字');
    check((await badgeOutsideEl(page, 3, C3)) === true, '号码牌 3 同样不遮住元素文字');

    // 键盘：聚焦第 2 行的删除按钮，回车只删这一项，序号与号码牌一起重排
    await page.evaluate((h) => {
      document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-sel-2-remove"]').focus();
    }, HOST);
    await page.keyboard.press('Enter');
    await waitFor(page, '清单剩两行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 2, [HOST]);
    const afterNames = await shadowTexts(page, `${tid('pm-wiz-selected')} .pm-wiz-row-name`);
    const afterNums = await shadowTexts(page, `${tid('pm-wiz-selected')} .pm-wiz-num`);
    check(
      afterNames[0].includes('卡片一') && afterNames[1].includes('卡片三') && JSON.stringify(afterNums) === '["1","2"]',
      `只删掉这一项，剩下的序号重排（${afterNames.join(' / ')}）`,
    );
    const badgeTexts = await shadowTexts(page, '[data-testid^="pm-badge-"]');
    check(JSON.stringify(badgeTexts) === '["1","2"]', `页面上的号码牌跟着重排（${JSON.stringify(badgeTexts)}）`);
    await waitBoxOn(page, '号码牌 1 还在卡片一上', 1, C1);
    await waitBoxOn(page, '号码牌 2 换到卡片三', 2, C3);
    check(true, '号码牌与清单一致：1 = 卡片一、2 = 卡片三');
    const focusedAfterDelete = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid, HOST);
    check(focusedAfterDelete === 'pm-sel-2-remove', `删除后焦点落在下一行的删除按钮上（${focusedAfterDelete}）`);
    const delLabel = await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-sel-2-remove"]').getAttribute('aria-label'), HOST);
    check(/取消选中第 2 项/.test(delLabel) && delLabel.includes('卡片三'), `删除按钮有读屏可读的名字（${delLabel}）`);

    // 「全部取消选择」：文字链接，一按全清，回到 0 项状态
    await clickInShadow(page, HOST, tid('pm-wiz-clear-all'));
    await waitFor(page, '全部取消选择后清单为空', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 0, [HOST]);
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).length === 0, '全部取消选择后页面上的号码牌也没了');
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').disabled, HOST)) === true,
      '全部取消选择后前进按钮又变灰',
    );
    check(!(await shadowExists(page, HOST, tid('pm-wiz-next-hint'))), '全部取消选择后底栏也没有多出说明文字');
    const focusAfterClear = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid, HOST);
    check(focusAfterClear === 'pm-wiz-group-list', `全部取消选择后焦点留在清单上（${focusAfterClear}）`);

    // ===================== 序号重新编号（N6）、调整对象（N13） =====================
    await clickEl(page, C1);
    await clickEl(page, '#promo');
    await clickEl(page, '#banner');
    await waitFor(page, '三个序号牌', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 3, [HOST]);
    await clickEl(page, C1); // 再点一次取消 A
    await waitFor(page, '取消后剩两个序号牌', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 2, [HOST]);
    const nums = await shadowTexts(page, '[data-testid^="pm-badge-"]');
    check(JSON.stringify(nums) === '["1","2"]', `取消 A 后序号显示 1、2（实际 ${JSON.stringify(nums)}）`);
    await waitBoxOn(page, '序号 1 跟着 B', 1, '#promo');
    await waitBoxOn(page, '序号 2 跟着 C', 2, '#banner');
    check(true, '序号 1 框住 B（活动栏）、序号 2 框住 C（横幅）');
    const target = (await shadowTexts(page, tid('pm-wiz-adjust-target')))[0];
    check(target.includes('第 2 项'), `「选大一点」作用对象显示为最后选中的第 2 项（${target}）`);

    // ===================== 预览：行内换方式、标记不坍缩、号码牌跳转（N7、N8、#44） =====================
    console.log('\n--- 预览：行内换收起方式立即生效；号码牌跳到清单对应行 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：活动栏被移除', '#promo', false);
    await waitVisible(page, '预览：横幅被移除', '#banner', false);
    check((await progressOf(page)) === '第 2 步 / 共 2 步', `看效果是第 2 步（${await progressOf(page)}）`);
    check((await shadowExists(page, HOST, tid('pm-wiz-back'))), '看效果这一步左下角有「上一步」');
    const backToPick = (await shadowTexts(page, tid('pm-wiz-back')))[0] ?? '';
    check(backToPick === '上一步：重新选内容', `「上一步」写清退回去重新选内容（${backToPick}）`);
    const footPreview = await footerChildren(page);
    check(
      footPreview?.length === 2 && footPreview.every((n) => n.tag === 'BUTTON') && footPreview[0].testid === 'pm-wiz-back' && footPreview[1].testid === 'pm-wiz-save',
      `看效果这一步底栏是「上一步」加「保存」（${JSON.stringify(footPreview)}）`,
    );
    check((await draftCount(page)) === 2, `草稿清单是一行一项（实际 ${await draftCount(page)} 行）`);

    // 默认行（审查第 8 条）：序号 / 名称 / 一句话摘要 / 调整 / 行尾 ✕；收起方式等折在「调整」里
    const adjustText = (await shadowTexts(page, tid('pm-draft-1-adjust')))[0] ?? '';
    check(adjustText === '调整', `行上有「调整」按钮（${adjustText}）`);
    check((await adjustExpanded(page, 1)) === 'false', '默认收起：调整按钮 aria-expanded=false');
    check(!(await shadowExists(page, HOST, tid('pm-draft-1-body'))), '默认不展开：收起方式、范围、重选、高级都不在页面上');
    const summary1 = (await shadowTexts(page, tid('pm-draft-1-summary')))[0] ?? '';
    check(summary1 === '消失 · 整个网站', `摘要写成「收起方式 · 范围」（${summary1}）`);
    const collapsedText = (await shadowTexts(page, tid('pm-draft-1'))).join(' ');
    check(
      !collapsedText.includes('在哪些页面') && !collapsedText.includes('范围'),
      '收起状态的行里没有「在哪些页面」「范围」这组控件（也不重复叫法）',
    );
    const delBox = await page.evaluate(
      (h) => {
        const b = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-1-remove"]');
        const cs = getComputedStyle(b);
        return {
          bg: cs.backgroundColor,
          border: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
          w: b.getBoundingClientRect().width,
        };
      },
      HOST,
    );
    check(
      delBox.bg === 'rgba(0, 0, 0, 0)' &&
        delBox.borderColor === 'rgba(0, 0, 0, 0)' &&
        Math.round(delBox.w) === 28,
      `删除按钮是无框 28px 的 ✕，悬停才出底色（底色 ${delBox.bg}、边框 ${delBox.borderColor}、宽 ${Math.round(delBox.w)}）`,
    );
    const delName = await page.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-1-remove"]').getAttribute('aria-label'),
      HOST,
    );
    const row1Name = await nameValue(page, 1);
    check(delName === `取消选中第 1 项：${row1Name}`, `删除按钮有完整的读屏名字（${delName}）`);

    // 展开「调整」：收起方式、范围、重选、高级按顺序出现
    await openAdjust(page, 1);
    await openAdjust(page, 2);
    check((await adjustExpanded(page, 1)) === 'true', '点「调整」后 aria-expanded=true');
    check(await shadowExists(page, HOST, tid('pm-draft-1-body')), '点「调整」后展开出控制器');
    const bodyGeom = await page.evaluate(
      (h) => {
        const sr = document.querySelector(h).shadowRoot;
        const head = sr.querySelector('[data-testid="pm-draft-1-head"]').getBoundingClientRect();
        const body = sr.querySelector('[data-testid="pm-draft-1-body"]').getBoundingClientRect();
        const q = (id) => sr.querySelector(`[data-testid="${id}"]`);
        const inBody = (el) => {
          const r = el.getBoundingClientRect();
          return r.top >= body.top - 0.5 && r.bottom <= body.bottom + 0.5;
        };
        return {
          below: body.top >= head.bottom - 0.5,
          holds: [
            q('pm-draft-1-strategy-remove'),
            q('pm-draft-1-scope-all'),
            q('pm-draft-1-advanced'),
          ].every((el) => !!el && inBody(el)),
        };
      },
      HOST,
    );
    check(bodyGeom.below, '展开区整体落在默认行下面');
    check(bodyGeom.holds, '展开区依次有收起方式、在哪些页面收起、高级选择器');
    check(
      (await checkedStrategy(page, 1)) === 'remove' && (await checkedStrategy(page, 2)) === 'remove',
      '每一项的收起方式默认是「消失」（原生 radio 的选中值）',
    );
    check((await rowHint(page, 1)) === '整块消失，下面的内容往上顶', `选中方式下面显示对应解释（${await rowHint(page, 1)}）`);

    // 行内范围：与收起方式同构的原生单选分段（#142）；摘要跟着变
    const rowScopeTexts = await shadowTexts(page, `${tid('pm-draft-1-scope')} .pm-wiz-seg-opt`);
    const rowScopeChecked = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      return [...sr.querySelectorAll('[data-testid="pm-draft-1-scope"] input[type="radio"]')].map((r) => r.checked);
    }, HOST);
    check(
      rowScopeTexts.join('|') === '整个网站|只在这类页面|除了这类页面' &&
        rowScopeChecked.join('|') === 'true|false|false',
      `行内范围是三档原生单选、当前档 checked=true（${rowScopeTexts.join(' / ')} / ${rowScopeChecked.join(',')}）`,
    );
    // 勾选框已搬进选内容清单的行内（#82）：看效果的「调整」里不再有它
    check(!(await shadowExists(page, HOST, tid('pm-draft-1-same-group'))), '看效果的「调整」里不再有同类勾选框（#82 移进选内容行内）');
    check(!(await shadowExists(page, HOST, tid('pm-draft-2-same-group'))), '任何行在看效果里都不再有这道勾选框');

    // 底部的整批「在哪些页面收起」已删（#76）：范围只在每行「调整」里，两个控件管同一件事只会打架
    check(!(await shadowExists(page, HOST, tid('pm-wiz-scope'))), '这一步底部不再有整批的范围控件');
    check(
      !(await shadowExists(page, HOST, tid('pm-wizard-save-pop'))),
      '原来的保存对话框已经从 DOM 里删掉（点保存不再弹第二个框）',
    );
    const before = await shadowRect(page, tid('pm-marker-2'));
    check(before && before.w > 0 && before.h > 0, `第 2 项号码牌可见（${JSON.stringify(before)}）`);

    // 行内切到「留空」：页面立刻变、解释跟着换
    await clickInShadow(page, HOST, tid('pm-draft-1-strategy-blank'));
    await waitFor(page, '活动栏改为留空', () => getComputedStyle(document.querySelector('#promo')).visibility === 'hidden');
    check((await rowHint(page, 1)) === '看不见了，但位置还占着', `切到「留空」后解释跟着变（${await rowHint(page, 1)}）`);
    const after = await shadowRect(page, tid('pm-marker-2'));
    check(
      after && after.w > 0 && after.h > 0 && Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1,
      `改第 1 项方式后，第 2 项号码牌位置不变、不是 0×0（前 ${JSON.stringify(before)} 后 ${JSON.stringify(after)}）`,
    );

    // 行内切到「盖住」：元素不被移除，页面上出现遮盖板
    await clickInShadow(page, HOST, tid('pm-draft-2-strategy-mask'));
    await waitFor(
      page,
      '横幅改成盖住',
      (h) => {
        const sr = document.querySelector(h).shadowRoot;
        const bannerEl = document.querySelector('#banner');
        return getComputedStyle(bannerEl).visibility === 'visible' && !!sr.querySelector('.pm-wiz-mask');
      },
      [HOST],
    );
    check((await rowHint(page, 2)) === '在原位盖一块和背景同色的方块', `「盖住」下面显示对应解释（${await rowHint(page, 2)}）`);
    await clickInShadow(page, HOST, tid('pm-draft-2-strategy-remove'));
    await waitVisible(page, '改回消失：横幅又被移除', '#banner', false);

    // 点页面上的号码牌 = 滚到清单对应行并高亮，不再打开浮层
    check(
      await page.evaluate((h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-popover"]'), HOST),
      '旧的「调整」弹片已经从 DOM 里删掉',
    );
    await clickInShadow(page, HOST, tid('pm-marker-2'));
    await waitFor(
      page,
      '点号码牌后清单第 2 行高亮',
      (h) => !!document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-2"]')?.classList.contains('flash'),
      [HOST],
      { timeout: 3000 },
    );
    check((await wizardOpen(page)) && !(await visible(page, '#banner')), '点号码牌：清单对应行高亮，向导与预览都不受影响');

    // N8：留空后目标本身 visibility:hidden、不可命中；断言框中心命中页面，而不是扩展覆盖层
    const promo = await rectOf(page, '#promo');
    const hit = await page.evaluate(
      (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el ? { name: el.id || el.tagName, own: el.tagName === 'PAGEMASK-WIZARD' } : null;
      },
      promo.x + promo.w / 2,
      promo.y + promo.h / 2,
    );
    check(hit && !hit.own, `留白项上的虚线框不拦截点击（框中心命中页面元素 ${hit?.name ?? '无'}）`);

    // N9：没有浮层时 Esc = 请求退出（有草稿 → 确认框）；确认框上 Esc = 继续设置
    await page.keyboard.press('Escape');
    await waitFor(page, '预览阶段 Esc 弹出退出确认', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check(true, '预览阶段没有浮层时按 Esc：弹出退出确认');
    const dialogText = await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').innerText, HOST);
    check(
      dialogText.includes('不会保存') && dialogText.includes('标签页会变回原来的标题'),
      `退出确认说清楚已选内容不保存、标签页会变回原来的标题（${dialogText.split('\n').join(' / ')}）`,
    );
    // 两个按钮同一档（#175 视觉审查）：退出不丢任何已保存的东西，草稿丢了可以重选——
    // 不是「严重且不可撤销」的破坏动作，GOV.UK 的危险色不适用，两颗都是普通次按钮
    const dlgStay = await buttonLook(page, 'pm-wiz-exit-no');
    const dlgExit = await buttonLook(page, 'pm-wiz-exit-yes');
    check(
      dlgStay?.cls.includes('pm-btn') &&
        !dlgStay.cls.includes('danger') &&
        dlgExit?.cls.includes('pm-btn') &&
        !dlgExit.cls.includes('danger') &&
        !dlgExit.cls.includes('primary'),
      `退出确认两颗都是次按钮：退出不属破坏动作，危险色退场（${dlgStay?.cls} / ${dlgExit?.cls}）`,
    );
    check(
      dlgStay?.bg === dlgExit?.bg && dlgExit?.border > 0 && dlgExit?.color === dlgStay?.color,
      `「退出」与「继续设置」同款：同底色同文字色（${dlgExit?.bg} / ${dlgExit?.color}）`,
    );
    const focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid, HOST);
    check(focused === 'pm-wiz-exit-no', `退出确认默认聚焦「继续设置」（${focused}）`);
    await page.keyboard.press('Escape');
    await waitFor(page, '确认框上 Esc 关掉确认框', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check((await wizardOpen(page)) && !(await visible(page, '#banner')), '退出确认框上按 Esc = 继续设置：向导还在，预览照常');

    // ===================== 上一步保留已改方式（N12）、「同类一起」住进选内容行内（#82） =====================
    console.log('\n--- 从看效果回到选内容：已改的方式保留；勾选框在选内容行内，勾谁看谁一次一组 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回到选择阶段：预览撤掉', '#banner');
    await clickEl(page, C2);
    await waitFor(page, '已选 3 个', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('3'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：卡片二被移除', C2, false);
    await openAdjust(page, 3); // 新加的第 3 行默认收起，先展开
    check(
      (await checkedStrategy(page, 1)) === 'blank' &&
        (await checkedStrategy(page, 2)) === 'remove' &&
        (await checkedStrategy(page, 3)) === 'remove',
      `从看效果回到选内容后第 1 项仍是「留空」，新加的是默认「消失」（${await checkedStrategy(page, 1)} / ${await checkedStrategy(page, 2)} / ${await checkedStrategy(page, 3)}）`,
    );
    check(
      (await page.evaluate(() => getComputedStyle(document.querySelector('#promo')).visibility)) === 'hidden',
      '第 1 项的留空预览照常生效',
    );
    check(await visible(page, C1) && await visible(page, C3), '默认只收这一个：卡片一、三还看得见（预览=保存结果，#76）');

    // 回到选内容：勾选框现在住在选内容清单的行内（#82）
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回选内容：预览撤掉，卡片一回来了', '#banner');

    // 勾选框出现在第 3 行（卡片二）行内；只有一处的行不出现
    check(!(await shadowExists(page, HOST, tid('pm-sel-1-same-group'))), '只有一处的项不出现勾选框（#82 行内，条件与原来一致）');
    check((await sameLabel(page, 3)) === '页面上另外 2 个一样的也一起收起', `勾选框说的是具体几个（${await sameLabel(page, 3)}）`);
    check((await sameChecked(page, 3)) === false, '默认不勾（只收这一个）');
    check(
      (await outlineStyleOf(page, C1)) !== 'dashed' && (await outlineStyleOf(page, C3)) !== 'dashed',
      '默认没有组标记（成员不带描边）',
    );

    // 勾上 → 整组亮出：另外两张卡片统一描边（小组与大组同一形态，#100）；选内容阶段页面保持原样
    await clickInShadow(page, HOST, tid('pm-sel-3-same-toggle'));
    await waitFor(page, '勾上后另外两张卡片出现描边', () => {
      const one = document.querySelector('.card:nth-child(1)');
      const three = document.querySelector('.card:nth-child(3)');
      return getComputedStyle(one).outlineStyle === 'dashed' && getComputedStyle(three).outlineStyle === 'dashed';
    });
    check(await visible(page, C1) && await visible(page, C3), '选内容阶段勾选只是亮出这一组，页面保持原样（不是收起）');
    check((await subBadgeTexts(page)).length === 0, '成员不再挂 3.1/3.2 子号牌：一组只有一种标记（#100）');
    check((await sameChecked(page, 3)) === true, '勾上后勾选框跟着勾上');

    // 同类逐个查看（0.8.11，#140）：导航行出现、从第一个其他成员开始、强调框可移动、到底循环
    check(!!(await shadowExists(page, HOST, tid('pm-sel-3-same-nav'))), '勾选后行内出现同类导航（#140）');
    const posOf = async (n) => (await shadowTexts(page, tid(`pm-sel-${n}-same-pos`))).join('');
    check((await posOf(3)) === '第 1 / 2 个', `位置文字从第一个其他成员开始（${await posOf(3)}）`);
    await clickInShadow(page, HOST, tid('pm-sel-3-same-next'));
    const curRect = await page.evaluate((h) => {
      const b = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-box-same-current"]');
      return b ? b.getBoundingClientRect().toJSON() : null;
    }, HOST);
    check(!!curRect, '当前成员有实线强调框（与整组的虚线描边区分）');
    const overlapsCard3 = await page.evaluate((b) => {
      const c = document.querySelector('.card:nth-child(3)').getBoundingClientRect();
      return b.left < c.right && b.right > c.left && b.top < c.bottom && b.bottom > c.top;
    }, curRect);
    check(overlapsCard3, '点「下一个」后强调框落在第二个成员上');
    check((await posOf(3)) === '第 2 / 2 个', `位置文字跟着走（${await posOf(3)}）`);
    await clickInShadow(page, HOST, tid('pm-sel-3-same-next'));
    check((await posOf(3)) === '第 1 / 2 个', '最后一个之后循环回第一个（找得到、看得完）');
    await clickInShadow(page, HOST, tid('pm-sel-3-same-prev'));
    check((await posOf(3)) === '第 2 / 2 个', '「上一个」从第一个循环回最后一个');

    // #88「检查同类」：预览行跳回点选亮出整组，看完「下一步」回来草稿不丢
    console.log('\n--- 看效果 ↔ 检查同类：往返一圈状态都在（#88） ---');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitFor(page, '进入看效果', (h) => (document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-progress"]')?.textContent ?? '').includes('第 2 步'), [HOST]);
    await waitFor(page, '看效果第 3 行有「检查同类」入口', (h) => !!document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-3-inspect-same"]'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-draft-3-inspect-same'));
    await waitFor(page, '跳回点选阶段', (h) => (document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-progress"]')?.textContent ?? '').includes('第 1 步'), [HOST]);
    await waitFor(page, '整组描边重新亮出', () => {
      const one = document.querySelector('.card:nth-child(1)');
      const three = document.querySelector('.card:nth-child(3)');
      return getComputedStyle(one).outlineStyle === 'dashed' && getComputedStyle(three).outlineStyle === 'dashed';
    });
    check(true, '「检查同类」跳回点选，第 3 行的组员都带描边');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitFor(page, '回到看效果', (h) => (document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-progress"]')?.textContent ?? '').includes('第 2 步'), [HOST]);
    check(true, '回到看效果：第 2 步 / 共 2 步，草稿原样（摘要细节由上面既有断言覆盖）');
    // 后续用例在点选阶段继续：走「上一步」回点选（也顺带验返回按钮）
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitFor(page, '上一步回到点选', (h) => (document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-progress"]')?.textContent ?? '').includes('第 1 步'), [HOST]);
    check(true, '「上一步：重新选内容」回到点选，继续大组用例');


    // 焦点切换：选一条大组（25 条帖子 > 20）勾上 → 上一组收回，整片一条描边样式规则。
    // 滚到视口顶部再点：底部居中的工具条加了行内勾选框后更高，视口中央会被它盖住
    await page.evaluate(() => document.querySelector('#feed .post:first-child').scrollIntoView());
    await clickEl(page, '#feed .post:first-child');
    await waitFor(page, '第 4 行进入清单', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 4, [HOST]);
    check((await sameLabel(page, 4)) === '页面上另外 24 个一样的也一起收起', `大组勾选框报具体个数（${await sameLabel(page, 4)}）`);
    await clickInShadow(page, HOST, tid('pm-sel-4-same-toggle'));
    await waitFor(page, '大组整片描边', () => getComputedStyle(document.querySelector('#feed .post:nth-child(20)')).outlineStyle === 'dashed');
    check(
      (await outlineStyleOf(page, C1)) !== 'dashed' && (await outlineStyleOf(page, C3)) !== 'dashed',
      '焦点切走上一组：卡片组的描边收回（一次只亮一组）',
    );
    check((await subBadgeTexts(page)).length === 0, '同类组不再逐个挂牌（回归守卫：一个 3.x 子号牌都不该有）');
    check(
      (await shadowTexts(page, tid('pm-sel-4-same-pos'))).join('') === '第 1 / 24 个',
      '大组的导航报具体个数（勾上即从第一个其他成员开始）',
    );
    check(!(await shadowExists(page, HOST, tid('pm-sel-3-same-nav'))), '焦点切走后上一组的导航行收回（导航属于亮着的那一组，#140）');
    check(
      (await page.evaluate(() => {
        const el = document.createElement('p');
        el.className = 'post';
        document.querySelector('#feed').appendChild(el);
        return getComputedStyle(el).outlineStyle;
      })) === 'dashed',
      '新出现的同类元素自动带上描边（一条样式规则，滚动加载自动覆盖，不是逐元素 DOM）',
    );

    // 点已勾选的行 = 把亮着的组换成这一行的（上一组收回）。点在名称区，避开勾选框与 ✕
    await clickInShadow(page, HOST, tid('pm-sel-3'), { offset: { x: 100, y: 8 } });
    await waitFor(page, '焦点切回卡片组：描边回来', () => {
      const one = document.querySelector('.card:nth-child(1)');
      const three = document.querySelector('.card:nth-child(3)');
      return getComputedStyle(one).outlineStyle === 'dashed' && getComputedStyle(three).outlineStyle === 'dashed';
    });
    check((await outlineStyleOf(page, '#feed .post:nth-child(20)')) !== 'dashed', '大组的描边同时收回（一次只亮一组）');
    await clickInShadow(page, HOST, tid('pm-sel-4'), { offset: { x: 100, y: 8 } });
    await waitFor(page, '焦点切回大组：描边回来', () => getComputedStyle(document.querySelector('#feed .post:nth-child(20)')).outlineStyle === 'dashed');
    check((await outlineStyleOf(page, C1)) !== 'dashed', '卡片组的描边同时收回');

    // 点带标记的组员 = 取消那条规则：整行从清单去掉、整组解标记（等同行上的 ✕，#82 交接铁律）
    await clickEl(page, '#feed .post:nth-child(3)');
    await waitFor(page, '点组员后清单少一行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 3, [HOST]);
    check((await outlineStyleOf(page, '#feed .post:nth-child(20)')) !== 'dashed', '整组解标记：描边撤掉');
    check(!(await shadowExists(page, HOST, tid('pm-sel-4-same-group'))), '被取消的那一行整个从清单去掉（第 4 行不再存在）');
    check((await sameChecked(page, 3)) === true, '卡片二那一行的勾选不受影响（取消的是被点的这一组）');
    check((await outlineStyleOf(page, C1)) !== 'dashed', '亮着的组随取消一并收回（描边撤掉）');

    // 再点刚才的组员位置 = 按默认值当新的一项加回（同类默认只收一个）
    await clickEl(page, '#feed .post:first-child');
    await waitFor(page, '加回后清单又 4 行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 4, [HOST]);
    check((await sameChecked(page, 4)) === false, '加回的一项默认只收这一个（勾选框回到不勾）');
    // 收掉这一行，后面用例回到 3 行
    await clickInShadow(page, HOST, tid('pm-sel-4-remove'));
    await waitFor(page, '收掉帖子行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 3, [HOST]);
    check(!(await shadowExists(page, HOST, tid('pm-sel-2-same-group'))), '只有一处的行（横幅）不出现勾选框');

    // 密行（#82 标记语言）：牌子跨在元素左上角，垂直中线与上边相接——不落在上一行里
    await page.evaluate(() => document.querySelector('#dense-list .dense-t')?.scrollIntoView());
    await clickEl(page, '#dense-list .dense-t');
    const denseBadge = await page.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const boxes = [...(sr?.querySelectorAll('[data-testid^="pm-badge-"]') ?? [])];
      const rows = [...document.querySelectorAll('#dense-list .dense-t')].map((el) => el.getBoundingClientRect());
      for (const box of boxes) {
        const b = box.getBoundingClientRect();
        for (const e of rows) {
          // 密行：牌在元素左侧、垂直居中（不遮行首文字），归属与该行同高
          if (e.height < b.height && Math.abs(b.top + b.height / 2 - (e.top + e.height / 2)) < 1.5) {
            return { mid: b.top + b.height / 2, rowMid: e.top + e.height / 2, rowHeight: e.height, leftOf: b.right <= e.left + 0.5 };
          }
        }
      }
      return null;
    }, HOST);
    check(
      denseBadge !== null && denseBadge.leftOf,
      `密行的号码牌在该行左侧、与该行同高，不遮行首文字（行高 ${Math.round(denseBadge?.rowHeight ?? 0)}px）`,
    );
    // 收掉这一行，后面的用例清单行数不受影响（删清单里的最后一行）
    const denseRowIdx = await page.evaluate((h) => {
      const rows = [...document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li')];
      return rows.length;
    }, HOST);
    await clickInShadow(page, HOST, tid(`pm-sel-${denseRowIdx}-remove`));

    // 「盖住」：预览必须盖住这一组全部，保存后遮的也是全部（#70，之前只盖了点中的那一个）
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：卡片二被移除', C2, false);
    const maskBoxes = () =>
      page.evaluate((h) => document.querySelector(h).shadowRoot.querySelectorAll('.pm-wiz-mask').length, HOST);
    const maskBefore = await maskBoxes();
    await clickInShadow(page, HOST, tid('pm-draft-3-strategy-mask'));
    await waitFor(page, '盖住：遮盖板重画', (h, n) => document.querySelector(h).shadowRoot.querySelectorAll('.pm-wiz-mask').length > n, [HOST, maskBefore]);
    check((await maskBoxes()) === maskBefore + 3, `「盖住」的预览盖住这一组全部 3 张，与保存后一致（${maskBefore} → ${await maskBoxes()}）`);
    await clickInShadow(page, HOST, tid('pm-draft-3-strategy-remove'));
    await waitVisible(page, '切回消失：卡片一又被移除', C1, false);

    // 回第 2 步再回来：草稿不变（方案、勾选都还在），预览样式重新应用（#53）
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回第 2 步：预览撤掉，卡片一回来了', C1);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '再回到看效果：卡片一又被收起', C1, false);
    const strategy1 = await checkedStrategy(page, 1);
    const summary3 = (await shadowTexts(page, tid('pm-draft-3-summary')))[0] ?? '';
    const summary1b = (await shadowTexts(page, tid('pm-draft-1-summary')))[0] ?? '';
    if (!summary3 || !summary1b) {
      // 展开状态下摘要是隐藏的：先收起这两行的「调整」再读（前面用例把它们展开了）
      for (const n of [1, 3]) {
        const open = await page.evaluate(
          (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-${i}-adjust"]`)?.getAttribute('aria-expanded') === 'true',
          HOST,
          n,
        );
        if (open) await clickInShadow(page, HOST, tid(`pm-draft-${n}-adjust`));
      }
    }
    const summary3c = (await shadowTexts(page, tid('pm-draft-3-summary')))[0] ?? '';
    const summary1c = (await shadowTexts(page, tid('pm-draft-1-summary')))[0] ?? '';
    check(
      (await draftCount(page)) === 3 &&
        summary3c === '消失 · 整个网站 · 连一样的共 3 个' &&
        summary1c === '留空 · 整个网站' &&
        strategy1 === 'blank',
      `从第 2 步返回后草稿不变、勾了同类的行摘要报数（${summary3c} / ${summary1c} / 第 1 项 ${strategy1}）`,
    );

    // 行内改名：不点开任何浮层，改名后清单重绘仍保留
    await clickInShadow(page, HOST, tid('pm-draft-name-1'));
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-name-1"]').select(), HOST);
    await page.keyboard.type('活动栏（改名）');
    check((await nameValue(page, 1)) === '活动栏（改名）', `行内改名生效（${await nameValue(page, 1)}）`);

    // N11：点 ✕ 删掉这一项 → 清单与选择集同步减少
    await clickInShadow(page, HOST, tid('pm-draft-3-remove'));
    await waitVisible(page, '删除后卡片二恢复', C2);
    check((await draftCount(page)) === 2, '删除后清单少了一行');
    check((await nameValue(page, 1)) === '活动栏（改名）', '清单重绘后行内改的名字还在');
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitFor(page, '回到选择阶段', (h) => !!document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]'), [HOST]);
    const left = await shadowTexts(page, '[data-testid^="pm-badge-"]');
    check(left.length === 2, `删掉的那项没有带着序号牌回来（剩 ${left.length} 个）`);

    // 删到最后一项：回到点选阶段
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：横幅被移除', '#banner', false);
    await clickInShadow(page, HOST, tid('pm-draft-2-remove'));
    await waitVisible(page, '删掉第二项后横幅恢复', '#banner');
    await clickInShadow(page, HOST, tid('pm-draft-1-remove'));
    await waitFor(
      page,
      '删到最后一项回到点选阶段',
      (h) => {
        const sr = document.querySelector(h)?.shadowRoot;
        return !!sr?.querySelector('[data-testid="pm-wiz-bigger"]') && !sr.querySelector('[data-testid="pm-wiz-drafts"]');
      },
      [HOST],
    );
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).length === 0, '删到 0 项：回到点选阶段，没有序号牌');
    await waitVisible(page, '删到 0 项：活动栏恢复', '#promo');

    // 没有已选内容时点「退出设置」：先确认一次，再退出（#123）
    await clickInShadow(page, HOST, tid('pm-wiz-exit'));
    await waitFor(
      page,
      '退出前先确认',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open,
      [HOST],
      { timeout: 3000 },
    );
    await clickInShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [HOST]);
    check(await visible(page, '#promo'), '退出不保存：预览样式全部撤掉');

    // ===================== 滚动后按指针位置命中（N14）、选大一点（N13） =====================
    console.log('\n--- 选择阶段：滚动后点击选中的是指针下的元素 ---');
    // 前面的「同类一起」用例把页面滚到了信息流那里：回到页顶，第 2 行才在视口里
    await page.evaluate(() => window.scrollTo(0, 0));
    await openWizard();
    // 坐标取第 2 行的中心：既不要用固定坐标（可能落在元素之间的空隙上），
    // 也不要取靠底部的行（默认底部居中的工具条会盖住那里，指针落不到拾取层——#52 起面板更高）
    const r2 = await rectOf(page, '#r1');
    const X = Math.round(r2.x + r2.w / 2);
    const Y = Math.round(r2.y + r2.h / 2);
    await page.mouse.move(X + 20, Y + 20);
    await page.mouse.move(X, Y, { steps: 2 });
    await waitFor(page, '悬停框出现', (h) => !!document.querySelector(h).shadowRoot.querySelector('.pm-wiz-hover'), [HOST]);
    await waitFor(
      page,
      '悬停框框住指针下的第 2 行',
      (h) => {
        const box = document.querySelector(h).shadowRoot.querySelector('.pm-wiz-hover').getBoundingClientRect();
        const er = document.getElementById('r1').getBoundingClientRect();
        return Math.abs(box.y - er.y) < 1.5 && Math.abs(box.height - er.height) < 1.5;
      },
      [HOST],
    );
    const hoverBefore = await page.evaluate((x, y) => document.elementsFromPoint(x, y).find((e) => !e.tagName.startsWith('PAGEMASK-'))?.id, X, Y);
    check(hoverBefore === 'r1', `悬停框跟着指针下的元素（${hoverBefore}）`);
    await page.mouse.wheel({ deltaY: 900 });
    await waitFor(page, '页面滚动了', () => scrollY > 300);
    const under = await page.evaluate((x, y) => document.elementsFromPoint(x, y).find((e) => !e.tagName.startsWith('PAGEMASK-'))?.id, X, Y);
    check(under && under !== hoverBefore, `滚动后指针下换成了别的元素（${hoverBefore} → ${under}）`);
    await waitFor(
      page,
      '滚动后悬停框换到指针下的新元素',
      (h, id) => {
        const box = document.querySelector(h).shadowRoot.querySelector('.pm-wiz-hover').getBoundingClientRect();
        const er = document.getElementById(id).getBoundingClientRect();
        return Math.abs(box.y - er.y) < 1.5 && Math.abs(box.height - er.height) < 1.5;
      },
      [HOST, under],
    );
    check(true, '滚动后（没有移动鼠标）悬停框换到指针下的元素');
    await page.mouse.click(X, Y); // 不移动鼠标直接点
    await waitBoxOn(page, '选中指针下的元素', 1, `#${under}`);
    check(true, `滚动后点击选中的是指针下的元素（#${under}），不是滚动前悬停的 #${hoverBefore}`);

    // #88 捕获层不挡内层容器滚动：信息流站常把滚动放在内层容器上，点选阶段也要能滚。
    // 把 #feed（25 条帖子，天然高过一屏）固定成满屏滚动容器，滚轮打在它内部
    console.log('\n--- 选择阶段：内层容器滚动（信息流站）不被捕获层挡住（#88） ---');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.dataset.pmProbe = 'inner-scroll';
      style.textContent = 'html,body{overflow:hidden;height:100%;margin:0} #feed{position:fixed;inset:0;overflow-y:auto;background:#fff;z-index:50}';
      document.head.appendChild(style);
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      spacer.id = 'pm-probe-spacer';
      document.querySelector('#feed')?.appendChild(spacer); // 不依赖前情，保证内层有可滚高度
    });
    // 滚轮落点要在 #feed 上、同时避开底部的设置面板（#160 起面板多了一行复位出口，会更高一点）：
    // 打在面板上滚的是面板自己，就测不到「捕获层不挡内层容器滚动」了
    const tbInner = await shadowRect(page, tid('pm-wizard-toolbar'));
    const wheelY = Math.max(24, Math.round((tbInner?.y ?? 400) - 40));
    await page.mouse.move(640, wheelY);
    await page.mouse.wheel({ deltaY: 500 });
    await waitFor(page, '内层容器滚动了', () => (document.querySelector('#feed')?.scrollTop ?? 0) > 300);
    check(true, '点选阶段：内层容器的滚动不被捕获层挡住（#88）');
    await page.evaluate(() => {
      document.querySelector('style[data-pm-probe="inner-scroll"]')?.remove();
      document.getElementById('pm-probe-spacer')?.remove();
      window.scrollTo(0, 0);
    });

    console.log('\n--- 「选大一点」作用于最后选中的元素 ---');
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitFor(page, '滚回顶部', () => scrollY === 0);
    const txtSel = '#t0';
    await clickEl(page, txtSel);
    await waitBoxOn(page, '第 2 项是行内文字', 2, txtSel);
    // 鼠标经过别的元素再去点按钮（以前会作用到最后划过的元素上）
    await page.mouse.move(X, Y + 120);
    await clickInShadow(page, HOST, tid('pm-wiz-bigger'));
    const rowSel = '#r' + txtSel.slice(2);
    await waitBoxOn(page, '第 2 项换成所在的整行', 2, rowSel);
    await waitBoxOn(page, '第 1 项不受影响', 1, `#${under}`);
    check(true, `「选大一点」把最后选中的 ${txtSel} 换成 ${rowSel}，序号不变，第 1 项不受影响`);

    // ===================== 工具条拖动 / 方向键（N15） =====================
    console.log('\n--- 工具条可拖动、可用方向键移动，且不出可视区 ---');
    const h0 = await shadowRect(page, tid('pm-wiz-drag'));
    check(h0.w >= 24 && h0.h >= 24, `拖动把手命中区 ${Math.round(h0.w)}×${Math.round(h0.h)} ≥ 24×24（图形只有 10×16，命中区由按钮撑足，#189 实测登记）`);
    const t0 = await shadowRect(page, tid('pm-wizard-toolbar'));
    await page.mouse.move(h0.x + h0.w / 2, h0.y + h0.h / 2);
    await page.mouse.down();
    await page.mouse.move(h0.x + h0.w / 2 - 150, h0.y + h0.h / 2 - 250, { steps: 5 });
    await page.mouse.up();
    const t1 = await shadowRect(page, tid('pm-wizard-toolbar'));
    check(Math.abs(t1.x - (t0.x - 150)) < 2 && Math.abs(t1.y - (t0.y - 250)) < 2, `拖动把手移动工具条（${Math.round(t0.x)},${Math.round(t0.y)} → ${Math.round(t1.x)},${Math.round(t1.y)}）`);
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).length === 2, '拖动工具条不会选中页面元素');
    await page.mouse.move(h0.x + h0.w / 2 - 150, h0.y + h0.h / 2 - 250);
    await page.mouse.down();
    await page.mouse.move(1, 1, { steps: 5 });
    await page.mouse.up();
    const t2 = await shadowRect(page, tid('pm-wizard-toolbar'));
    check(
      t2.x >= 16 && t2.y >= 16 && t2.x < 17 && t2.y < 17,
      `拖出左上角时留 16 的边，不出可视区（${Math.round(t2.x)},${Math.round(t2.y)}）`,
    );
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-drag"]').focus(), HOST);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const t3 = await shadowRect(page, tid('pm-wizard-toolbar'));
    check(t3.x > t2.x + 10 && t3.y > t2.y + 10, `方向键移动工具条（→ ${Math.round(t3.x)},${Math.round(t3.y)}）`);

    // #119：整条标题栏都能拖——从标题文字按下同样有效（按钮不参与拖动）
    const headRect = await shadowRect(page, tid('pm-wiz-heading'));
    const t4a = await shadowRect(page, tid('pm-wizard-toolbar'));
    await page.mouse.move(headRect.x + headRect.w / 2, headRect.y + headRect.h / 2);
    await page.mouse.down();
    await page.mouse.move(headRect.x + headRect.w / 2 + 40, headRect.y + headRect.h / 2 + 30, { steps: 5 });
    await page.mouse.up();
    const t4b = await shadowRect(page, tid('pm-wizard-toolbar'));
    check(
      Math.abs(t4b.x - (t4a.x + 40)) < 2 && Math.abs(t4b.y - (t4a.y + 30)) < 2,
      `从标题文字也能拖动整条工具条（${Math.round(t4a.x)},${Math.round(t4a.y)} → ${Math.round(t4b.x)},${Math.round(t4b.y)}）`,
    );

    // 选择阶段 Esc：有选择 → 确认；确认框上 Esc = 继续设置；再确认退出
    await page.keyboard.press('Escape');
    await waitFor(page, '选择阶段 Esc 弹出退出确认', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    await page.keyboard.press('Escape');
    await waitFor(page, '确认框关闭', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).length === 2, '选择阶段：确认框上 Esc = 继续设置，已选内容还在');
    await page.keyboard.press('Escape');
    await waitForShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await clickInShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [HOST]);
    check(true, '确认后退出向导');

    // ===================== 原样态保存先问一次（#159）：两条路都落库 =====================
    console.log('\n--- 保存：范围在行内改；原样态先问「现在打开」，选「先保持原样」照常保存 ---');
    await openWizard();
    await clickEl(page, C1);
    await clickEl(page, C2);
    await waitFor(page, '已选 2 个', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('2'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：卡片一被移除', C1, false);
    await openAdjust(page, 1);
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-1-scope-all"]')?.checked, HOST)) === true,
      '新选的项「在哪些页面收起」默认整个网站（#76）',
    );
    await clickInShadow(page, HOST, tid('pm-draft-1-scope-include'));
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '原样态点保存弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    const openDlgState = await openDialogState(page);
    check(
      openDlgState?.tag === 'DIALOG' &&
        openDlgState.label === 'pm-open-title' &&
        openDlgState.headingId === 'pm-open-title' &&
        openDlgState.heading === '保存后看不到效果' &&
        openDlgState.body === '「按你的设置显示」还关着，现在打开吗？',
      `确认框文案与 aria-labelledby（${openDlgState?.heading} / ${openDlgState?.body}）`,
    );
    check(
      openDlgState?.buttons.length === 2 &&
        openDlgState.buttons[0].testid === 'pm-wiz-open-stay' &&
        openDlgState.buttons[0].text === '保存，先保持原样' &&
        openDlgState.buttons[0].primary === false &&
        openDlgState.buttons[1].testid === 'pm-wiz-open-yes' &&
        openDlgState.buttons[1].text === '保存，现在打开' &&
        openDlgState.buttons[1].primary === true,
      `两个按钮：左「先保持原样」次操作、右「现在打开」唯一主操作（${openDlgState?.buttons.map((b) => `${b.text}${b.primary ? '·实心' : ''}`).join(' / ')}）`,
    );
    check(openDlgState?.focus === 'pm-wiz-open-stay', `默认焦点在「先保持原样」，防手滑回车打开开关（${openDlgState?.focus}）`);
    await clickInShadow(page, HOST, tid('pm-wiz-open-stay'));
    await waitFor(page, '选「先保持原样」后向导关闭', (h) => !document.querySelector(h), [HOST]);
    check(true, '「先保持原样」也完成保存并结束向导，不是取消保存');
    const savedProfile = await getProfile(ext.control, ORIGIN);
    const added = (savedProfile?.hideRules ?? []).filter((r) => r.id !== 'r_e2e_existing');
    const patternPrefix = `${ORIGIN}/wizard.html`;
    check(
      added.length === 2 &&
        added[0].scope.type === 'include' &&
        added[0].scope.patterns.length === 1 &&
        added[0].scope.patterns[0].prefix === patternPrefix &&
        added[1].scope.type === 'all',
      `行内改的那条落库 include + 当前这类页面，没改的那条保持整个网站（${JSON.stringify(added.map((r) => r.scope))}）`,
    );
    check(savedProfile?.switchState === 'original', `「先保持原样」不动开关（${savedProfile?.switchState}）`);
    check(
      !(await page.evaluate((h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-page-notice"]'), NOTICE)),
      '原样态保存后不发页底轻提示（标题没换，那句话是假的）',
    );

    // ===================== 确认框：Esc / 点外面回向导；「现在打开」保存并切开关（#159） =====================
    console.log('\n--- 原样态确认框：Esc / 点外面不保存，「现在打开」保存并切到按设置显示 ---');
    const beforeAsk = await getProfile(ext.control, ORIGIN);
    await openWizard();
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitForShadow(page, HOST, tid('pm-wiz-save'));
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '再次点保存弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    await page.keyboard.press('Escape');
    await waitFor(
      page,
      '确认框上 Esc 关掉确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === false,
      [HOST],
      { timeout: 3000 },
    );
    const afterEsc = await getProfile(ext.control, ORIGIN);
    check(
      (await shadowExists(page, HOST, tid('pm-wiz-save'))) &&
        !(await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, HOST)),
      'Esc 只关确认框，回到向导（没有连带弹退出确认）',
    );
    check(
      afterEsc.switchState === 'original' && afterEsc.updatedAt === beforeAsk.updatedAt,
      `Esc 不保存、不开开关、不写存储（${afterEsc.switchState}，updatedAt ${beforeAsk.updatedAt} → ${afterEsc.updatedAt}）`,
    );

    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '点外面之前确认框已开',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    await page.mouse.click(4, 4); // ::backdrop 区域
    await waitFor(
      page,
      '点框外关掉确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === false,
      [HOST],
      { timeout: 3000 },
    );
    const afterOutside = await getProfile(ext.control, ORIGIN);
    check(
      (await shadowExists(page, HOST, tid('pm-wiz-save'))) && afterOutside.updatedAt === beforeAsk.updatedAt,
      '点框外也回到向导，不保存、不开开关',
    );

    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '第三次点保存弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    await clickInShadow(page, HOST, tid('pm-wiz-open-yes'));
    await waitFor(page, '「现在打开」后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const opened = await getProfile(ext.control, ORIGIN);
    check(opened.switchState === 'disguised', `「现在打开」保存并写 switchState=disguised（${opened.switchState}）`);
    check(opened.hideRules.map((r) => r.id).join('|') === beforeAsk.hideRules.map((r) => r.id).join('|'), '「现在打开」没有把规则再写一遍');
    await waitVisible(page, '现在打开后页面当场生效（卡片一被收起）', C1, false);

    // ===================== 新站点：无首次模式，「收起内容」直接进点选（#81） =====================
    console.log('\n--- 新站点：收起内容直接进点选（没有标题步骤），保存即建站 ---');
    const pageNew = await ext.browser.newPage();
    pageNew.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await pageNew.goto(`${NEW_ORIGIN}/new-site.html`, { waitUntil: 'load' });
    /** 站点还没有配置：走与 popup 相同的 enableSite 入口，注入内容脚本并打开向导 */
    async function openNewSite(target, origin, open) {
      const tabId = await tabIdOf(ext.control, `${origin}/*`);
      const res = await sendToBackground(ext.control, { t: 'enableSite', origin, tabId, open });
      check(res?.ok === true, `站点 ${origin} 已启用并打开向导（${open}）`);
      await waitForShadow(target, HOST, tid('pm-wizard-toolbar'));
      return tabId;
    }
    await openNewSite(pageNew, NEW_ORIGIN, 'editContent');
    check((await progressOf(pageNew)) === '第 1 步 / 共 2 步', `新站点「收起内容」从点选开始，共 2 步（${await progressOf(pageNew)}）`);
    check((await headingOf(pageNew)) === '点选要收起的内容', `标题说明这一步做什么（${await headingOf(pageNew)}）`);
    check(
      !(await shadowExists(pageNew, HOST, tid('pm-wiz-back'))) && !(await shadowExists(pageNew, HOST, tid('pm-wiz-title-done'))),
      '没有「上一步」也没有「只改标题，完成」（#81 无首次模式）',
    );
    // 选内容 → 看效果 → 保存：新网站保存即建站
    await clickEl(pageNew, '#promo');
    await waitFor(pageNew, '已选 1 个', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('1'), [HOST]);
    await clickInShadow(pageNew, HOST, tid('pm-wiz-preview'));
    await waitForShadow(pageNew, HOST, tid('pm-wiz-save'));
    check((await progressOf(pageNew)) === '第 2 步 / 共 2 步', `看效果是第 2 步（${await progressOf(pageNew)}）`);
    await watchOpenDialog(pageNew);
    await clickInShadow(pageNew, HOST, tid('pm-wiz-save'));
    await waitFor(pageNew, '保存后向导直接关闭', (h) => !document.querySelector(h), [HOST]);
    check(!(await sawOpenDialog(pageNew)), '新站点保存即建站，不弹「现在打开」确认框（保存后页面当场变）');
    const newProfile = await getProfile(ext.control, NEW_ORIGIN);
    check(
      newProfile?.hideRules.length === 1 &&
        newProfile.switchState === 'disguised' &&
        !newProfile.disguisedTitle &&
        newProfile.titleIconSet === false,
      `新站点保存即建站：1 条收起设置、清爽态、没写标题、也没标「设置过标题和图标」（${JSON.stringify(newProfile && { rules: newProfile.hideRules.length, state: newProfile.switchState, title: newProfile.disguisedTitle, titleIconSet: newProfile.titleIconSet })}）`,
    );
    // #98：只保存收起内容的网站，标签页标题与图标保持网站原样
    check(
      (await pageNew.title()) === 'Acme 书房 · 向导测试',
      `只设收起规则：标签页标题没有被改成默认标题（${await pageNew.title()}）`,
    );
    await pageNew.close();

    // ===================== 新站点取消：退出确认后授权收回、完全还原（#81） =====================
    console.log('\n--- 新站点取消：退出确认、授权收回、标签页完全还原 ---');
    const pageCancel = await ext.browser.newPage();
    pageCancel.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await pageCancel.goto(`${CANCEL_ORIGIN}/cancel.html`, { waitUntil: 'load' });
    await openNewSite(pageCancel, CANCEL_ORIGIN, 'editContent');
    await clickEl(pageCancel, '#promo');
    await waitFor(pageCancel, '已选 1 个', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('1'), [HOST]);
    await clickInShadow(pageCancel, HOST, tid('pm-wiz-exit'));
    await waitFor(pageCancel, '弹出退出确认', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    const newExitText = await pageCancel.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').innerText, HOST);
    check(
      newExitText.includes('不会保存') && newExitText.includes('标签页会变回原来的标题'),
      `退出确认写明已选内容不保存、标签页会变回原来的标题（${newExitText.split('\n').join(' / ')}）`,
    );
    const newFocus = await pageCancel.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid, HOST);
    check(newFocus === 'pm-wiz-exit-no', `退出确认默认焦点在「继续设置」（${newFocus}）`);
    await pageCancel.keyboard.press('Escape');
    await waitFor(pageCancel, '确认框上 Esc 继续设置', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check((await badgeCount(pageCancel)) === 1, '确认框上 Esc = 继续设置：已选内容还在');
    await clickInShadow(pageCancel, HOST, tid('pm-wiz-exit'));
    await waitForShadow(pageCancel, HOST, tid('pm-wiz-exit-yes'));
    await clickInShadow(pageCancel, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(pageCancel, '取消后向导关闭', (h) => !document.querySelector(h), [HOST]);
    await waitFor(pageCancel, '页面恢复原样', () => getComputedStyle(document.querySelector('#promo')).display !== 'none');
    check(
      await pageCancel.evaluate(() => document.querySelectorAll('link[rel~="icon"]').length === 0),
      '取消后标签页图标也完全还原（页面本来没有图标）',
    );
    await poll(
      async () => !(await ext.control.evaluate((o) => chrome.permissions.contains({ origins: [o] }), `${CANCEL_ORIGIN}/*`)),
      '新站点取消后收回授权',
      { timeout: 8000 },
    );
    check((await getProfile(ext.control, CANCEL_ORIGIN)) === null, '取消后没有留下任何站点配置');
    await pageCancel.close();

    // ===================== 「标题和图标」：单步小表单，保存即建站（#81） =====================
    console.log('\n--- 标题和图标：单步表单、实时预览、保存 0 条规则 ---');
    const pageOnly = await ext.browser.newPage();
    pageOnly.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await pageOnly.goto(`${TITLE_ONLY_ORIGIN}/title-only.html`, { waitUntil: 'load' });
    const onlyTabId = await openNewSite(pageOnly, TITLE_ONLY_ORIGIN, 'editTitle');
    check((await headingOf(pageOnly)) === '标题和图标', `标题说明这是哪一组设置（${await headingOf(pageOnly)}）`);
    check(!(await shadowExists(pageOnly, HOST, tid('pm-wiz-progress'))), '单步表单不显示进度行');
    check(!(await shadowExists(pageOnly, HOST, tid('pm-wiz-back'))), '单步表单没有「上一步」');
    const onlyFooter = await footerChildren(pageOnly);
    check(
      onlyFooter?.length === 1 && onlyFooter[0].testid === 'pm-wiz-save',
      `右下角只有「保存」一颗主按钮（${JSON.stringify(onlyFooter)}）`,
    );
    const initialTitle = await inputValue(pageOnly, 'pm-wiz-title-input');
    check(!!initialTitle && initialTitle.trim() !== '', `标题输入框默认已填（${initialTitle}）`);
    await waitFor(pageOnly, '打开表单就把默认标题压到标签页', (t) => document.title === t, [initialTitle]);

    // 打字：标签页标题立刻跟着变（不点保存）
    await pageOnly.evaluate((h) => {
      const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-title-input"]');
      input.focus();
      input.select();
    }, HOST);
    await pageOnly.keyboard.type('工作笔记');
    await waitFor(pageOnly, '输入标题时标签页立刻跟着变', () => document.title === '工作笔记');
    check(true, '输入标题：标签页标题实时变成「工作笔记」');

    // 快捷标题：点一下填入并立刻生效
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-quick-1'));
    await waitFor(pageOnly, '快捷标题「阅读」实时生效', () => document.title === '阅读');
    check((await inputValue(pageOnly, 'pm-wiz-title-input')) === '阅读', '快捷标题一键填入输入框');

    // 图标三态（#121）：点「换成别的图标」→ 选一个预置图标，标签页图标立刻跟着变
    check(await shadowExists(pageOnly, HOST, tid('pm-wiz-icon-kind-site')), '表单里有「网站原来的图标」选项');
    check(await shadowExists(pageOnly, HOST, tid('pm-wiz-icon-kind-none')), '表单里有「不显示图标」选项');
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-icon-kind-preset'));
    await waitForShadow(pageOnly, HOST, tid('pm-wiz-icon-preset-doc'));
    check(
      (await pageOnly.evaluate(
        (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-wiz-icon-preset-"]').length,
        HOST,
      )) === 10,
      '选「换成别的图标」后展开 10 个预置图标',
    );
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-icon-preset-doc'));
    await waitFor(
      pageOnly,
      '选预置图标后标签页图标立刻跟着变',
      () => (document.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? '').startsWith('data:image/png'),
    );
    check(true, '选预置图标：标签页 favicon 实时换掉');

    // 换回要保存的标题再保存
    await pageOnly.evaluate((h) => {
      const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-title-input"]');
      input.focus();
      input.select();
    }, HOST);
    await pageOnly.keyboard.type('只看标题');
    await waitFor(pageOnly, '标题实时跟着变回「只看标题」', () => document.title === '只看标题');

    // 保存：0 条规则 + 清爽态，向导直接关闭（新站点不弹「现在打开」）
    await watchOpenDialog(pageOnly);
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-save'));
    await waitFor(pageOnly, '向导直接关闭（不弹保存对话框）', (h) => !document.querySelector(h), [HOST]);
    check(!(await sawOpenDialog(pageOnly)), '新站点「标题和图标」保存直接完成，不弹确认框');
    // 0 条收起设置：关掉向导后给一句轻提示，说明生效的是标签页标题（#53）
    await waitForShadow(pageOnly, NOTICE, tid('pm-page-notice'));
    const notice = await pageOnly.evaluate((n) => {
      const root = document.querySelector(n)?.shadowRoot;
      const el = root?.querySelector('[data-testid="pm-page-notice"]');
      return el
        ? { text: el.textContent.trim(), role: el.getAttribute('role'), buttons: root.querySelectorAll('button, dialog').length }
        : null;
    }, NOTICE);
    check(
      notice?.text === '已保存，标签页标题换成「只看标题」了',
      `0 条收起设置保存后有一句轻提示，说明标签页标题已经换了（${notice?.text}）`,
    );
    check(notice?.role === 'status' && notice.buttons === 0, '这句提示是状态消息，不是拦人的弹窗');
    const onlyProfile = await getProfile(ext.control, TITLE_ONLY_ORIGIN);
    check(
      onlyProfile?.hideRules.length === 0 &&
        onlyProfile.disguisedTitle === '只看标题' &&
        onlyProfile.switchState === 'disguised' &&
        onlyProfile.titleIconSet === true &&
        onlyProfile.icon?.kind === 'preset' &&
        onlyProfile.icon.id === 'doc',
      `保存 0 条收起设置 + 标题 + 预置图标，站点进入清爽态（${JSON.stringify(onlyProfile && { rules: onlyProfile.hideRules.length, title: onlyProfile.disguisedTitle, state: onlyProfile.switchState, titleIconSet: onlyProfile.titleIconSet, icon: onlyProfile.icon })}）`,
    );
    await waitFor(pageOnly, '标签页保持保存后的标题', () => document.title === '只看标题');
    // 有设置就显示（#67）：只改过标题的网站页面上也要有小胶囊，否则用户下次想改只能靠记住工具栏图标
    await pageOnly.waitForSelector(TOGGLE, { timeout: 5000 });
    check(true, '0 条收起设置、只改过标题的网站也显示小胶囊');
    check(
      await pageOnly.evaluate(() => !document.querySelector('pagemask-wizard')),
      '页面上也没有别的常驻界面',
    );

    // 列表里能看到它
    const mgmt = await ext.browser.newPage();
    await mgmt.goto(`${ext.extOrigin}/management.html#/sites`, { waitUntil: 'load' });
    await mgmt.waitForSelector(`li[data-origin="${siteKeyOf(TITLE_ONLY_ORIGIN)}"]`, { timeout: 8000 });
    const onlyRow = await mgmt.$eval(`li[data-origin="${siteKeyOf(TITLE_ONLY_ORIGIN)}"]`, (e) => e.innerText);
    check(
      onlyRow.includes('按设置') && onlyRow.includes('还没有收起设置'),
      `列表里能看到这个只改标题的网站（${onlyRow.split('\n').join(' / ')}）`,
    );
    await mgmt.close();

    // 这一页没有可编辑的收起项：点「收起内容」直接从点选开始（#71 / #81）
    await sendToTab(ext.control, onlyTabId, { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(pageOnly, HOST, tid('pm-wizard-toolbar'));
    check((await progressOf(pageOnly)) === '第 1 步 / 共 2 步', `「收起内容」从点选开始（${await progressOf(pageOnly)}）`);
    check(!(await shadowExists(pageOnly, HOST, tid('pm-wiz-drafts-empty'))), '不把空清单摆给用户看');
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-exit'));
    await waitFor(
      pageOnly,
      '退出前先确认（没有已选内容）',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open,
      [HOST],
      { timeout: 3000 },
    );
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(pageOnly, '向导关闭（没有已选内容）', (h) => !document.querySelector(h), [HOST]);
    check(true, '这个入口打开的向导可以正常退出');

    // ===================== 回退出口：恢复网站原来的标题和图标（#99） =====================
    console.log('\n--- 恢复网站原来的标题和图标：回到没设置过，不动收起内容 ---');
    await clickInShadow(pageOnly, TOGGLE, tid('pm-toggle-more'));
    await waitForShadow(pageOnly, TOGGLE, tid('pm-toggle-title'));
    await clickInShadow(pageOnly, TOGGLE, tid('pm-toggle-title'));
    await waitForShadow(pageOnly, HOST, tid('pm-wiz-title-reset'));
    check(true, '保存过标题和图标的网站，表单底部出现回退出口');
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-title-reset'));
    await waitFor(pageOnly, '恢复后向导关闭', (h) => !document.querySelector(h), [HOST]);
    await waitFor(pageOnly, '标签页回到网站原来的标题', () => document.title === 'Acme 书房 · 向导测试');
    const afterReset = await getProfile(ext.control, TITLE_ONLY_ORIGIN);
    check(
      afterReset?.titleIconSet === false &&
        afterReset.disguisedTitle === null &&
        afterReset.icon?.kind === 'site',
      `恢复后配置回到「没设置过」（${JSON.stringify(afterReset && { title: afterReset.disguisedTitle, icon: afterReset.icon, titleIconSet: afterReset.titleIconSet })}）`,
    );
    check(afterReset?.hideRules.length === 0, '恢复不产生也不删除收起规则');
    // 0.8.13（#143）：恢复标题让配置全空，但胶囊本页挂出过——会话保留，页面上留个入口
    // （与 check-toggle 的「中途清空配置：胶囊不拆」同一语义；「删除这个网站的设置」才清场）
    await waitFor(pageOnly, '恢复后胶囊仍在（会话保留）', (h) => !!document.querySelector(h), [TOGGLE], { timeout: 5000 });
    check(true, '恢复后胶囊保留：页面回到原样但入口留着（#143）');
    // ===================== 回退出口：恢复网站原来的内容（#160） =====================
    console.log('\n--- 恢复网站原来的内容：选内容底部有出口，只动收起项 ---');
    const nowReset = Date.now();
    // 两条规则都只作用于别的页面：本页 initialRules = 0，但网站已保存 2 项——
    // 入口必须按「总数」出现，否则用户在这个页面上就没有出口（#160 的判据）
    await setProfile(ext.control, TITLE_ONLY_ORIGIN, {
      formatVersion: 1,
      origin: TITLE_ONLY_ORIGIN,
      switchState: 'disguised',
      disguisedTitle: '工作台',
      icon: { kind: 'preset', id: 'doc' },
      titleIconSet: true,
      mediaGray: true,
      floatingBtnPos: null,
      hideRules: [
        {
          id: 'r_rules_1',
          elementName: '卡片',
          candidates: ['.card'],
          strategy: 'remove',
          scope: { type: 'include', patterns: [{ label: '只在别处', prefix: `${TITLE_ONLY_ORIGIN}/never.html` }] },
          onlyThis: false,
          createdAt: nowReset,
        },
        {
          id: 'r_rules_2',
          elementName: '活动栏',
          candidates: ['#promo'],
          strategy: 'remove',
          scope: { type: 'include', patterns: [{ label: '只在别处', prefix: `${TITLE_ONLY_ORIGIN}/never.html` }] },
          onlyThis: false,
          createdAt: nowReset,
        },
      ],
      createdAt: nowReset,
      updatedAt: nowReset,
    });
    await sendToTab(ext.control, onlyTabId, { t: 'openWizard', mode: 'editContent' });
    await waitForShadow(pageOnly, HOST, tid('pm-wizard-toolbar'));
    check((await shadowExists(pageOnly, HOST, tid('pm-wiz-rules-reset-row'))) === true, '有已保存的收起项：选内容底部出现复位行');
    check((await shadowExists(pageOnly, HOST, tid('pm-wiz-list-empty'))) === true, '前置：本页没有用得上的旧规则（清单为空）');
    const resetRowText = await shadowText(pageOnly, HOST, tid('pm-wiz-rules-reset-row'));
    check(
      resetRowText.includes('恢复网站原来的内容') && resetRowText.includes('只恢复收起的内容，标题和图标不受影响'),
      `复位行文字逐字对（${resetRowText.split('\n').join(' / ')}）`,
    );
    const resetRowPos = await pageOnly.evaluate((h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const row = sr?.querySelector('[data-testid="pm-wiz-rules-reset-row"]');
      const list = sr?.querySelector('[data-testid="pm-wiz-group-list"]');
      const footer = sr?.querySelector('.pm-wiz-footer');
      if (!row || !list || !footer) return null;
      return {
        afterList: !!(list.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeFooter: !!(row.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
        inPick: !!row.closest('.pm-wiz-pick'),
      };
    }, HOST);
    check(
      resetRowPos?.inPick && resetRowPos.afterList && resetRowPos.beforeFooter,
      '复位行在选内容底部：清单之后、footer 之前',
    );

    // 取消分支：文字与默认焦点；Esc 回向导，存储一点没动
    const beforeRulesReset = await getProfile(ext.control, TITLE_ONLY_ORIGIN);
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-rules-reset'));
    await waitFor(
      pageOnly,
      '恢复内容确认框打开',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-rules-reset-dialog"]').open,
      [HOST],
      { timeout: 3000 },
    );
    const resetDlgInfo = await pageOnly.evaluate((h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const dlg = sr?.querySelector('[data-testid="pm-wizard-rules-reset-dialog"]');
      return {
        tag: dlg?.tagName,
        heading: dlg?.querySelector('h2')?.textContent.trim(),
        body: dlg?.querySelector('p')?.textContent.trim(),
        buttons: [...(dlg?.querySelectorAll('.pm-wiz-actions button') ?? [])].map((b) => ({
          testid: b.dataset.testid,
          text: b.textContent.trim(),
          danger: b.classList.contains('danger'),
          primary: b.classList.contains('primary'),
        })),
        focus: sr.activeElement?.dataset.testid,
      };
    }, HOST);
    check(
      resetDlgInfo.tag === 'DIALOG' && resetDlgInfo.heading === '恢复网站原来的内容？' && resetDlgInfo.body === '2 项收起设置会全部删除。',
      `确认框标题与正文逐字对（${resetDlgInfo.heading} / ${resetDlgInfo.body}）`,
    );
    const resetCancelBtn = resetDlgInfo.buttons.find((b) => b.testid === 'pm-wizard-rules-reset-cancel');
    const resetConfirmBtn = resetDlgInfo.buttons.find((b) => b.testid === 'pm-wizard-rules-reset-confirm');
    check(
      resetCancelBtn?.text === '取消' && resetConfirmBtn?.text === '恢复内容' && resetConfirmBtn.danger && !resetConfirmBtn.primary,
      `按钮文字逐字对，确认是红字红边、不填实心红（${resetCancelBtn?.text} / ${resetConfirmBtn?.text}）`,
    );
    check(resetDlgInfo.focus === 'pm-wizard-rules-reset-cancel', '默认焦点在「取消」');
    await pageOnly.keyboard.press('Escape');
    await waitFor(
      pageOnly,
      'Esc 关确认框、向导还在',
      (h) => {
        const sr = document.querySelector(h)?.shadowRoot;
        return !!sr?.querySelector('[data-testid="pm-wizard-toolbar"]') && !sr.querySelector('[data-testid="pm-wizard-rules-reset-dialog"]').open;
      },
      [HOST],
      { timeout: 3000 },
    );
    const afterRulesCancel = await getProfile(ext.control, TITLE_ONLY_ORIGIN);
    check(
      afterRulesCancel.hideRules.length === 2 && afterRulesCancel.updatedAt === beforeRulesReset.updatedAt,
      '取消：仍在向导里，收起项与 updatedAt 都没变',
    );

    // 复位行不进看效果步骤；选一项再进去看，回来时取消选择
    await clickEl(pageOnly, C1);
    await waitFor(
      pageOnly,
      '选内容：已选 1 项',
      (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 1,
      [HOST],
    );
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-preview'));
    await waitForShadow(pageOnly, HOST, tid('pm-wiz-save'));
    check(!(await shadowExists(pageOnly, HOST, tid('pm-wiz-rules-reset-row'))), '看效果步骤里没有复位行（只属于选内容这一步）');
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-back'));
    await waitForShadow(pageOnly, HOST, tid('pm-wiz-rules-reset-row'));

    // 让页面上挂着「同类描边」草稿样式：复位前必须先清掉
    await clickInShadow(pageOnly, HOST, tid('pm-sel-1-same-toggle'));
    await waitFor(
      pageOnly,
      '勾上同类：另外两张卡片带描边',
      (sel) => getComputedStyle(document.querySelector(sel)).outlineStyle === 'dashed',
      [C2],
      { timeout: 3000 },
    );

    // 确认分支：向导关闭、页内提示、只清 hideRules、草稿样式一并撤掉
    await clickInShadow(pageOnly, HOST, tid('pm-wiz-rules-reset'));
    await waitFor(
      pageOnly,
      '复位确认框再次打开',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-rules-reset-dialog"]').open,
      [HOST],
      { timeout: 3000 },
    );
    await clickInShadow(pageOnly, HOST, tid('pm-wizard-rules-reset-confirm'));
    await waitFor(pageOnly, '确认后向导关闭', (h) => !document.querySelector(h), [HOST]);
    // 页内提示的宿主常驻（内容换新）：等文字真的换成复位那一句，不只看节点在不在。
    // 提示只活 4 秒，所以这里不再二次读文本——两次读之间它可能已经自己消失（偶发红的来源）
    await waitFor(
      pageOnly,
      '页内提示换成复位那句（已恢复网站原来的内容）',
      (n) => document.querySelector(n)?.shadowRoot?.querySelector('[data-testid="pm-page-notice"]')?.textContent.trim() === '已恢复网站原来的内容',
      [NOTICE],
      { timeout: 5000 },
    );
    const afterRulesReset = await getProfile(ext.control, TITLE_ONLY_ORIGIN);
    check(afterRulesReset?.hideRules.length === 0, '存储里的收起项已清空');
    check(
      afterRulesReset?.switchState === 'disguised' &&
        afterRulesReset.titleIconSet === true &&
        afterRulesReset.disguisedTitle === '工作台' &&
        afterRulesReset.icon?.kind === 'preset' &&
        afterRulesReset.icon.id === 'doc' &&
        afterRulesReset.mediaGray === true,
      `只动收起项：开关 / 标题图标 / 灰度原样（${JSON.stringify(afterRulesReset && { state: afterRulesReset.switchState, titleIconSet: afterRulesReset.titleIconSet, title: afterRulesReset.disguisedTitle, mediaGray: afterRulesReset.mediaGray })}）`,
    );
    check((await pageOnly.title()) === '工作台', `标签页标题不受影响（${await pageOnly.title()}）`);
    await waitFor(
      pageOnly,
      '页面上的同类描边草稿样式已清空',
      (c1, c2, c3) => [c1, c2, c3].every((s) => getComputedStyle(document.querySelector(s)).outlineStyle !== 'dashed'),
      [C1, C2, C3],
      { timeout: 3000 },
    );
    check(true, '页面上的同类描边草稿样式已清空');
    await pageOnly.close();

    // ===================== 0.8.15（#150）：工具条收窄 480 + 可收起 =====================
    console.log('\n--- 0.8.15 #150：两步同宽且 ≤480、可收起让开页面 ---');
    const pageC = await ext.browser.newPage();
    pageC.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await pageC.goto(`${C_ORIGIN}/c.html`, { waitUntil: 'load' });
    await openNewSite(pageC, C_ORIGIN, 'editContent');

    // 320px 窄视口：宽度公式里的 calc(100vw - 32px) 仍生效、工具条不越界。
    // resize 时 reclampToolbar 只在 tbPos 存在时动作，本段从不拖动，不会给工具条加 moved 定位
    await pageC.setViewport({ width: 320, height: 640 });
    await waitFor(pageC, '320px 窄视口下工具条收窄', (h) => {
      const tb = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wizard-toolbar"]');
      return !!tb && tb.getBoundingClientRect().width <= 288.5;
    }, [HOST]);
    const wNarrow = (await shadowRect(pageC, tid('pm-wizard-toolbar'))).w;
    check(wNarrow > 100 && wNarrow <= 288.5 && wNarrow <= 480.5, `320px 窄视口下工具条 ${Math.round(wNarrow)}px（= 100vw - 32，不越界、仍 ≤480）`);
    await pageC.setViewport({ width: 1280, height: 800 });
    await waitFor(pageC, '恢复 1280 视口', (h) => {
      const tb = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wizard-toolbar"]');
      return !!tb && tb.getBoundingClientRect().width > 400;
    }, [HOST]);

    // ① pick 阶段宽度：≤480 且仍是个像样的浮层（run-e2e.mjs:386 的 w > 100 口径）
    const wPick = (await shadowRect(pageC, tid('pm-wizard-toolbar'))).w;
    check(wPick > 100 && wPick <= 480.5, `选内容阶段工具条宽 ${Math.round(wPick)}px（≤480）`);

    // ⑤ 「收起」按钮：初始 aria-expanded=true、命中区 ≥24×24、排在退出设置左边、aria 齐全且有落点
    const collapseLook = await pageC.evaluate((h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const b = sr?.querySelector('[data-testid="pm-wiz-collapse"]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const exit = sr.querySelector('[data-testid="pm-wiz-exit"]').getBoundingClientRect();
      return {
        expanded: b.getAttribute('aria-expanded'),
        controls: b.getAttribute('aria-controls'),
        label: b.getAttribute('aria-label'),
        controlled: !!sr.querySelector('#pm-wiz-body'),
        text: b.textContent.trim(),
        w: r.width, h: r.height,
        leftOfExit: r.right <= exit.left + 0.5,
      };
    }, HOST);
    check(
      collapseLook && collapseLook.expanded === 'true' && collapseLook.controlled &&
        collapseLook.controls === 'pm-wiz-body' && /收起面板/.test(collapseLook.label) &&
        collapseLook.text === '收起面板' && collapseLook.w >= 24 && collapseLook.h >= 24 && collapseLook.leftOfExit,
      `「收起」按钮初始展开、命中区 ${Math.round(collapseLook?.w ?? 0)}×${Math.round(collapseLook?.h ?? 0)} ≥24、在退出左侧、aria-expanded/controls/label 齐全且 controls 有落点（${collapseLook?.text}）`,
    );

    // 量展开态工具条矩形（后面「折叠后露出的区域」要用）
    const tbExp = await shadowRect(pageC, tid('pm-wizard-toolbar'));

    // ③ 点「收起」：只剩标题栏（其余直接子内容 display:none、不占高度），live region 常驻、退出设置仍在
    await clickInShadow(pageC, HOST, tid('pm-wiz-collapse'));
    const folded = await pageC.evaluate((h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const tb = sr?.querySelector('[data-testid="pm-wizard-toolbar"]');
      const b = sr?.querySelector('[data-testid="pm-wiz-collapse"]');
      if (!tb || !b) return null;
      const live = tb.querySelector('.pm-wiz-sr');
      const head = tb.querySelector('.pm-wiz-head');
      const others = [...tb.children].filter((k) => k !== live && k !== head);
      return {
        expanded: b.getAttribute('aria-expanded'),
        text: b.textContent.trim(),
        label: b.getAttribute('aria-label'),
        liveKept: !!live && live.getAttribute('aria-live') === 'polite' && getComputedStyle(live).display !== 'none',
        headVisible: !!head && head.getBoundingClientRect().height > 0,
        othersHidden: others.length >= 2 && others.every((k) => getComputedStyle(k).display === 'none' && k.getBoundingClientRect().height === 0),
        othersCount: others.length,
        exitPresent: !!sr.querySelector('[data-testid="pm-wiz-exit"]'),
        h: tb.getBoundingClientRect().height,
      };
    }, HOST);
    check(
      folded && folded.expanded === 'false' && folded.text === '展开面板' && /展开面板/.test(folded.label) &&
        folded.liveKept && folded.headVisible && folded.othersHidden && folded.exitPresent,
      `收起后只剩标题栏：${folded?.othersCount} 个内容节点 display:none、live region 与标题栏常驻、退出设置仍在、按钮变「展开」且 aria-expanded=false（高 ${Math.round(folded?.h ?? 0)}）`,
    );
    const tbCol = await shadowRect(pageC, tid('pm-wizard-toolbar'));
    check(tbCol.h < tbExp.h - 20, `收起后工具条明显变矮（${Math.round(tbExp.h)} → ${Math.round(tbCol.h)}），原内容区露出`);

    // ③ 续：在「展开态工具条覆盖、折叠态标题栏之上」的区域真实点选一次页面元素。
    // 工具条 bottom 固定，收起变矮后露出的是标题栏【上方】那条带（y ∈ [tbExp.y, tbCol.y)）；
    // 这一带展开时压着工具条内容、点击落不到捕获层，收起后才能落到捕获层完成点选。
    const pickHit = await pageC.evaluate(({ x0, y0, x1, y1 }) => {
      for (let y = y0; y <= y1; y += 12) {
        for (let x = x0; x <= x1; x += 24) {
          for (const e of document.elementsFromPoint(x, y)) {
            if (e === document.documentElement || e === document.body) continue;
            if (e.getRootNode && e.getRootNode() instanceof ShadowRoot) continue; // 捕获层等 shadow 内节点
            if (e.matches && e.matches('pagemask-wizard, pagemask-toggle, pagemask-notice')) continue;
            const r = e.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) continue;
            return { x, y, tag: e.tagName, text: (e.textContent || '').trim().slice(0, 16) };
          }
        }
      }
      return null;
    }, {
      x0: Math.round(tbExp.x + 12), x1: Math.round(tbExp.x + tbExp.w - 12),
      y0: Math.round(tbExp.y + 12), y1: Math.round(tbCol.y - 12),
    });
    check(!!pickHit, `原工具条盖住的区域里找得到真实页面元素（${pickHit ? `${pickHit.tag}「${pickHit.text}」@(${pickHit.x},${pickHit.y})` : '没找到'}）`);
    if (pickHit) {
      await pageC.mouse.click(pickHit.x, pickHit.y);
      await waitFor(
        pageC, '折叠后在原工具条盖住的区域完成一次点选',
        (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 1,
        [HOST],
      );
      check(true, `折叠后页面完全可点：在 (${pickHit.x},${pickHit.y}) 点中 ${pickHit.tag}「${pickHit.text}」，选中 1 项`);
    }

    // ④ 点「展开」还原：内容可见、aria-expanded 切回 true、已选条目还在（不丢草稿 / 选择）
    await clickInShadow(pageC, HOST, tid('pm-wiz-collapse'));
    const reopened = await pageC.evaluate((h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      const tb = sr?.querySelector('[data-testid="pm-wizard-toolbar"]');
      const b = sr?.querySelector('[data-testid="pm-wiz-collapse"]');
      const foot = tb?.querySelector('.pm-wiz-footer');
      const pick = tb?.querySelector('.pm-wiz-pick');
      return {
        expanded: b?.getAttribute('aria-expanded'),
        text: b?.textContent.trim(),
        footVisible: !!foot && getComputedStyle(foot).display !== 'none' && foot.getBoundingClientRect().height > 0,
        pickVisible: !!pick && getComputedStyle(pick).display !== 'none',
        badges: sr.querySelectorAll('[data-testid^="pm-badge-"]').length,
        previewText: sr.querySelector('[data-testid="pm-wiz-preview"]')?.textContent ?? '',
      };
    }, HOST);
    check(
      reopened && reopened.expanded === 'true' && reopened.text === '收起面板' &&
        reopened.footVisible && reopened.pickVisible && reopened.badges === 1 && reopened.previewText.includes('1'),
      `展开后内容还原（底栏 / 选内容区可见）、aria-expanded=true，已选 1 项还在（${reopened?.previewText.trim()}，号牌 ${reopened?.badges}）`,
    );

    // ① 续 / ②：进「看效果」，量 preview 宽度 + 展开「调整」后不折行不溢出
    await clickInShadow(pageC, HOST, tid('pm-wiz-preview'));
    await waitForShadow(pageC, HOST, tid('pm-wiz-drafts'));
    const wPreview = (await shadowRect(pageC, tid('pm-wizard-toolbar'))).w;
    check(
      Math.abs(wPick - wPreview) < 1 && wPreview <= 480.5,
      `pick / preview 两步同宽且 ≤480（${Math.round(wPick)} / ${Math.round(wPreview)}px），#140 定宽成果不回退`,
    );
    await openAdjust(pageC, 1);
    const adjustGeom = await pageC.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const tb = sr.querySelector('[data-testid="pm-wizard-toolbar"]');
      const tr = tb.getBoundingClientRect();
      const body = sr.querySelector('[data-testid="pm-draft-1-body"]');
      let rightMost = 0;
      for (const el of body.querySelectorAll('*')) {
        if (getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0) rightMost = Math.max(rightMost, r.right);
      }
      // #142 起范围与收起方式同构（原生单选分段）：两套分段各自判「同一行」
      const segs = [...sr.querySelectorAll('[data-testid="pm-draft-1-body"] .pm-wiz-seg')];
      const strategySpans = [...(segs[0]?.querySelectorAll('.pm-wiz-seg-opt span') ?? [])];
      const scopeSpans = [...(segs[1]?.querySelectorAll('.pm-wiz-seg-opt span') ?? [])];
      const oneLine = (els) => {
        const tops = els.map((e) => Math.round(e.getBoundingClientRect().top));
        return els.length >= 2 && tops.every((t) => Math.abs(t - tops[0]) <= 1);
      };
      return {
        w: tr.width, scrollWidth: tb.scrollWidth, clientWidth: tb.clientWidth,
        rightMost, toolbarRight: tr.right,
        scopeOneLine: oneLine(scopeSpans), scopeCount: scopeSpans.length,
        segOneLine: oneLine(strategySpans), segCount: strategySpans.length,
      };
    }, HOST);
    check(
      adjustGeom.scrollWidth <= adjustGeom.clientWidth + 1 &&
        adjustGeom.rightMost <= adjustGeom.toolbarRight + 1 &&
        adjustGeom.scopeOneLine && adjustGeom.segOneLine,
      `展开「调整」后不溢出、不折行：宽 ${Math.round(adjustGeom.w)}，scrollWidth ${adjustGeom.scrollWidth} ≤ clientWidth ${adjustGeom.clientWidth}，最右内容 ${Math.round(adjustGeom.rightMost)} ≤ ${Math.round(adjustGeom.toolbarRight)}，范围 ${adjustGeom.scopeCount} 档 / 收起方式 ${adjustGeom.segCount} 档都各自同一行`,
    );

    // ④ 续（草稿）：折叠 → 展开，草稿清单与行内控件都还在，不退出向导、不重置
    const draftsBefore = await draftCount(pageC);
    const nameBefore = await nameValue(pageC, 1);
    await clickInShadow(pageC, HOST, tid('pm-wiz-collapse'));
    const draftsFolded = await pageC.evaluate((h) => {
      const sr = document.querySelector(h).shadowRoot;
      const d = sr.querySelector('[data-testid="pm-wiz-drafts"]');
      return {
        hidden: getComputedStyle(d).display === 'none',
        expanded: sr.querySelector('[data-testid="pm-wiz-collapse"]').getAttribute('aria-expanded'),
        exitPresent: !!sr.querySelector('[data-testid="pm-wiz-exit"]'),
      };
    }, HOST);
    check(draftsFolded.hidden && draftsFolded.expanded === 'false' && draftsFolded.exitPresent, '折叠态下草稿清单隐藏、退出设置仍在、aria-expanded=false');
    await clickInShadow(pageC, HOST, tid('pm-wiz-collapse'));
    const draftsAfter = await draftCount(pageC);
    const nameAfter = await nameValue(pageC, 1);
    check(
      draftsAfter === draftsBefore && draftsAfter === 1 && nameAfter === nameBefore &&
        (await pageC.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-draft-1-body"]') !== null, HOST)),
      `展开后草稿还在：${draftsAfter} 行、名称「${nameAfter}」不变、「调整」展开态也保留`,
    );

    // ⑥ 折叠态下退出流程不受影响：收起 → 点退出设置 → 确认框弹出 → 确认退出 → 向导关闭
    await clickInShadow(pageC, HOST, tid('pm-wiz-collapse'));
    check(await shadowExists(pageC, HOST, tid('pm-wiz-exit')), '折叠态下「退出设置」仍在标题栏');
    await clickInShadow(pageC, HOST, tid('pm-wiz-exit'));
    await waitFor(
      pageC, '折叠态点退出也弹确认',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open,
      [HOST], { timeout: 3000 },
    );
    const exitBodyC = await pageC.evaluate(
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').innerText,
      HOST,
    );
    check(exitBodyC.includes('退出'), `折叠态下退出确认框照常弹出（${exitBodyC.replace(/\s+/g, ' ').slice(0, 30)}…）`);
    await clickInShadow(pageC, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(pageC, '折叠态确认退出后向导关闭', (h) => !document.querySelector(h), [HOST]);
    check(true, '折叠态下退出流程完整可用');
    await pageC.close();


  } catch (e) {
    r.fail(e);
  } finally {
    await ext.cleanup();
    await srv.close();
    await srvNew.close();
    await srvNew2.close();
    await srvNew3.close();
    await srvC.close();
  }
  process.exitCode = r.summary();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
