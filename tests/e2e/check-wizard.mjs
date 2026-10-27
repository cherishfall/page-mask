/**
 * 设置向导状态机验收（#34，审查 N6–N15、N21、N22）：真实鼠标 / 键盘操作，夹具是虚构的长页面。
 *
 * 运行：npm run build && node tests/e2e/check-wizard.mjs     （约 15 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 选 A/B/C 后取消 A：序号牌只剩 1、2 并跟着 B、C（N6）；「选大一点」作用对象显示为最后选中的那项（N13）
 * - 预览：改第 1 项的方案后，第 2 项（彻底移除）的号码牌位置不变、不是 0×0、仍可点击打开调整弹片（N7、N8）；
 *   号码牌之外的标记不拦截点击（N8）
 * - Esc：预览阶段弹片打开时 Esc 只关弹片；没有浮层时 Esc 弹出退出确认；确认框上 Esc = 继续编辑（N9）
 * - 「继续选择」后已改的方案保留，只给新元素建草稿（N12）；「只收起点选的这一个」切换后同类其它元素立即恢复可见（N10）
 * - 「移出本次选择」后选择集同步减少（N11）；退出后预览样式撤掉（不允许免保存临时隐藏）
 * - 选择阶段：滚轮滚动后不移动鼠标直接点击，选中的是指针下的元素，悬停框也换到新元素（N14）
 * - 「选大一点」作用于最后选中的元素并原位替换（N13、N6）
 * - 工具条默认在底部、不挡页面顶部；拖动把手和方向键能移动且不出可视区（N15）
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import { launchExtension, sendToBackground, sendToTab, setProfile, tabIdOf } from './lib/extension.mjs';
import { clickInShadow, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const HOST = 'pagemask-wizard';
const tid = (id) => `[data-testid="${id}"]`;
const C1 = '.card:nth-child(1)';
const C2 = '.card:nth-child(2)';
const C3 = '.card:nth-child(3)';

/** 虚构长页面：顶部导航、三张同类卡片、活动栏、横幅，以及 40 行可滚动的内容 */
const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 书房 · 向导测试</title>
<style>body{margin:0;font:14px system-ui,sans-serif}nav{height:48px;background:#eef;padding:0 16px;line-height:48px}
.cards{display:flex;gap:12px;padding:12px 16px;margin:0;list-style:none}.card{flex:1;height:80px;background:#ffe}
#promo{height:60px;background:#fee;margin:12px 16px}#banner{height:60px;background:#efe;margin:12px 16px}
.row{height:60px;border-bottom:1px solid #ddd;padding:0 16px;line-height:60px}.row .txt{display:inline-block;width:120px}</style>
</head><body>
<nav id="top-nav">首页 书架 发现</nav>
<ul class="cards"><li class="card">卡片一</li><li class="card">卡片二</li><li class="card">卡片三</li></ul>
<aside id="promo">活动栏（示例）</aside>
<section id="banner">横幅（示例）</section>
${Array.from({ length: 40 }, (_, i) => `<div class="row" id="r${i}"><span class="txt" id="t${i}">第 ${i} 行</span></div>`).join('\n')}
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

/** 等某个号码牌所在的标记框与页面元素重合（标记跟随是逐帧的） */
function waitBoxOn(page, label, badgeSel, elSel) {
  return waitFor(
    page,
    label,
    (h, b, e) => {
      const badge = document.querySelector(h)?.shadowRoot?.querySelector(b);
      const el = document.querySelector(e);
      if (!badge || !el) return false;
      const br = badge.parentElement.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return Math.abs(br.x - er.x) < 1.5 && Math.abs(br.y - er.y) < 1.5 && Math.abs(br.width - er.width) < 1.5;
    },
    [HOST, badgeSel, elSel],
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

const dialogOpen = (page, sel) =>
  page.evaluate((h, s) => !!document.querySelector(h)?.shadowRoot?.querySelector(s)?.open, HOST, sel);
const popoverOpen = (page) =>
  page.evaluate(
    (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-wizard-popover"]')?.matches(':popover-open'),
    HOST,
  );
const wizardOpen = (page) => page.evaluate((h) => !!document.querySelector(h), HOST);

/** 真实鼠标点页面元素（相对左上角的偏移，默认中心） */
async function clickEl(page, sel, dx, dy) {
  const rc = await rectOf(page, sel);
  if (!rc) throw new Error(`页面上没有 ${sel}`);
  await page.mouse.click(rc.x + (dx ?? rc.w / 2), rc.y + (dy ?? rc.h / 2));
}

async function main() {
  const srv = await startServer(handler);
  const ORIGIN = srv.origin;
  const ext = await launchExtension({ hostOrigins: [ORIGIN] });
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
      faviconDataUrl: null,
      hideRules: [],
      floatingBtnPos: null,
      createdAt: now,
      updatedAt: now,
    });
    const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const enabled = await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId });
    check(enabled?.ok === true, '测试站点已启用');
    await page.waitForSelector('pagemask-toggle', { timeout: 8000 });
    const openWizard = async () => {
      await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'addElement' });
      await waitForShadow(page, HOST, tid('pm-wizard-toolbar'));
    };

    // ===================== 序号重新编号（N6）、调整对象（N13） =====================
    console.log('\n--- 选择阶段：序号随选择变化重新编号 ---');
    await openWizard();
    const tb = await shadowRect(page, tid('pm-wizard-toolbar'));
    const vh = await page.evaluate(() => innerHeight);
    check(tb.y > vh / 2 && tb.y + tb.h <= vh, `工具条默认在底部，不挡页面顶部导航（top=${Math.round(tb.y)}，视口高 ${vh}）`);

    await clickEl(page, C1);
    await clickEl(page, '#promo');
    await clickEl(page, '#banner');
    await waitFor(page, '三个序号牌', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 3, [HOST]);
    await clickEl(page, C1); // 再点一次取消 A
    await waitFor(page, '取消后剩两个序号牌', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 2, [HOST]);
    const nums = await shadowTexts(page, '[data-testid^="pm-badge-"]');
    check(JSON.stringify(nums) === '["1","2"]', `取消 A 后序号显示 1、2（实际 ${JSON.stringify(nums)}）`);
    await waitBoxOn(page, '序号 1 跟着 B', tid('pm-badge-1'), '#promo');
    await waitBoxOn(page, '序号 2 跟着 C', tid('pm-badge-2'), '#banner');
    check(true, '序号 1 框住 B（活动栏）、序号 2 框住 C（横幅）');
    const target = (await shadowTexts(page, tid('pm-wiz-adjust-target')))[0];
    check(target.includes('第 2 项'), `「选大一点」作用对象显示为最后选中的第 2 项（${target}）`);

    // ===================== 预览：标记不坍缩、可点击（N7、N8） =====================
    console.log('\n--- 预览：改第 1 项方案后，第 2 项的标记仍在、仍可点 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：活动栏被移除', '#promo', false);
    await waitVisible(page, '预览：横幅被移除', '#banner', false);
    const drafts = await shadowTexts(page, '[data-testid^="pm-draft-edit-"]');
    check(drafts.length === 2, `草稿清单 2 项（实际 ${drafts.length}）`);
    const before = await shadowRect(page, tid('pm-marker-2'));
    check(before && before.w > 0 && before.h > 0, `第 2 项号码牌可见（${JSON.stringify(before)}）`);

    await clickInShadow(page, HOST, tid('pm-draft-edit-1'));
    await waitFor(page, '弹片打开', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-popover"]').matches(':popover-open'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-pop-strategy-blank'));
    await waitFor(page, '活动栏改为原地留白', () => getComputedStyle(document.querySelector('#promo')).visibility === 'hidden');
    const after = await shadowRect(page, tid('pm-marker-2'));
    check(
      after && after.w > 0 && after.h > 0 && Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1,
      `改第 1 项方案后，第 2 项号码牌位置不变、不是 0×0（前 ${JSON.stringify(before)} 后 ${JSON.stringify(after)}）`,
    );

    // N9：弹片打开时 Esc 只关弹片
    await page.keyboard.press('Escape');
    await waitFor(page, 'Esc 关掉弹片', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-popover"]').matches(':popover-open'), [HOST], { timeout: 3000 });
    check((await wizardOpen(page)) && !(await dialogOpen(page, tid('pm-wizard-exit-confirm'))), '预览阶段弹片打开时按 Esc：只关弹片，向导还在、没弹退出确认');

    // 第 2 项的号码牌仍可点（真实鼠标点击经过命中测试）
    await clickInShadow(page, HOST, tid('pm-marker-2'));
    await waitFor(page, '点号码牌打开第 2 项', (h) => document.querySelector(h).shadowRoot.querySelector('#pm-pop-title')?.textContent.includes('第 2 项'), [HOST]);
    check(true, '改过第 1 项后，第 2 项的号码牌仍可点击，打开「调整第 2 项」');
    await page.keyboard.press('Escape');

    // N8：原地留白后目标本身 visibility:hidden、不可命中；断言框中心命中页面，而不是扩展覆盖层
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

    // N9：没有浮层时 Esc = 请求退出（有草稿 → 确认框）；确认框上 Esc = 继续编辑
    await waitFor(page, '弹片已关', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-popover"]').matches(':popover-open'), [HOST]);
    await page.keyboard.press('Escape');
    await waitFor(page, '预览阶段 Esc 弹出退出确认', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check(true, '预览阶段没有浮层时按 Esc：弹出退出确认');
    const focused = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid, HOST);
    check(focused === 'pm-wiz-exit-no', `退出确认默认聚焦「继续编辑」（${focused}）`);
    await page.keyboard.press('Escape');
    await waitFor(page, '确认框上 Esc 关掉确认框', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check((await wizardOpen(page)) && !(await visible(page, '#banner')), '退出确认框上按 Esc = 继续编辑：向导还在，预览照常');

    // ===================== 继续选择保留已改方案（N12）、只藏这一个（N10） =====================
    console.log('\n--- 继续选择后已改的方案保留；只收起这一个立即刷新预览 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-continue'));
    await waitVisible(page, '回到选择阶段：预览撤掉', '#banner');
    await clickEl(page, C2);
    await waitFor(page, '已选 3 个', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('3'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：卡片二被移除', C2, false);
    const metas = await shadowTexts(page, '[data-testid^="pm-draft-"] .meta');
    check(metas[0] === '原地留白' && metas[1] === '彻底移除' && metas[2] === '彻底移除', `继续选择后第 1 项仍是「原地留白」，新加的是默认方案（${JSON.stringify(metas)}）`);
    check(
      (await page.evaluate(() => getComputedStyle(document.querySelector('#promo')).visibility)) === 'hidden',
      '第 1 项的原地留白预览照常生效',
    );
    check(!(await visible(page, C1)) && !(await visible(page, C3)), '默认同类一起收起：卡片一、三也被预览移除');
    await clickInShadow(page, HOST, tid('pm-draft-edit-3'));
    await waitForShadow(page, HOST, tid('pm-pop-onlythis'));
    await clickInShadow(page, HOST, tid('pm-pop-onlythis'));
    await waitVisible(page, '只收起这一个：卡片一恢复可见', C1);
    await waitVisible(page, '只收起这一个：卡片三恢复可见', C3);
    check(!(await visible(page, C2)), '「只收起点选的这一个」切换后立即刷新预览：同类其它卡片恢复可见，卡片二仍被收起');

    // N11：移出本次选择 → 选择集同步减少
    await clickInShadow(page, HOST, tid('pm-pop-remove'));
    await waitVisible(page, '移出后卡片二恢复', C2);
    await clickInShadow(page, HOST, tid('pm-wiz-continue'));
    await waitFor(page, '回到选择阶段', (h) => !!document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]'), [HOST]);
    const left = await shadowTexts(page, '[data-testid^="pm-badge-"]');
    check(left.length === 2, `移出的那项没有带着序号牌回来（剩 ${left.length} 个）`);

    // 退出：确认后预览样式撤掉
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：横幅被移除', '#banner', false);
    await clickInShadow(page, HOST, tid('pm-wiz-exit'));
    await waitForShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await clickInShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [HOST]);
    await waitVisible(page, '退出后横幅恢复', '#banner');
    check(await visible(page, '#promo'), '退出不保存：预览样式全部撤掉');

    // ===================== 滚动后按指针位置命中（N14）、选大一点（N13） =====================
    console.log('\n--- 选择阶段：滚动后点击选中的是指针下的元素 ---');
    await openWizard();
    // 坐标取第 3 行的中心：既不要用固定坐标（可能落在元素之间的空隙上），
    // 也不要取靠底部的行（默认底部居中的工具条会盖住那里，指针落不到拾取层）
    const r2 = await rectOf(page, '#r2');
    const X = Math.round(r2.x + r2.w / 2);
    const Y = Math.round(r2.y + r2.h / 2);
    await page.mouse.move(X + 20, Y + 20);
    await page.mouse.move(X, Y, { steps: 2 });
    await waitFor(page, '悬停框出现', (h) => !!document.querySelector(h).shadowRoot.querySelector('.pm-wiz-hover'), [HOST]);
    await waitFor(
      page,
      '悬停框框住指针下的第 3 行',
      (h) => {
        const box = document.querySelector(h).shadowRoot.querySelector('.pm-wiz-hover').getBoundingClientRect();
        const er = document.getElementById('r2').getBoundingClientRect();
        return Math.abs(box.y - er.y) < 1.5 && Math.abs(box.height - er.height) < 1.5;
      },
      [HOST],
    );
    const hoverBefore = await page.evaluate((x, y) => document.elementsFromPoint(x, y).find((e) => !e.tagName.startsWith('PAGEMASK-'))?.id, X, Y);
    check(hoverBefore === 'r2', `悬停框跟着指针下的元素（${hoverBefore}）`);
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
    await waitBoxOn(page, '选中指针下的元素', tid('pm-badge-1'), `#${under}`);
    check(true, `滚动后点击选中的是指针下的元素（#${under}），不是滚动前悬停的 #${hoverBefore}`);

    console.log('\n--- 「选大一点」作用于最后选中的元素 ---');
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitFor(page, '滚回顶部', () => scrollY === 0);
    const txtSel = '#t3';
    await clickEl(page, txtSel);
    await waitBoxOn(page, '第 2 项是行内文字', tid('pm-badge-2'), txtSel);
    // 鼠标经过别的元素再去点按钮（以前会作用到最后划过的元素上）
    await page.mouse.move(X, Y + 120);
    await clickInShadow(page, HOST, tid('pm-wiz-bigger'));
    const rowSel = '#r' + txtSel.slice(2);
    await waitBoxOn(page, '第 2 项换成所在的整行', tid('pm-badge-2'), rowSel);
    await waitBoxOn(page, '第 1 项不受影响', tid('pm-badge-1'), `#${under}`);
    check(true, `「选大一点」把最后选中的 ${txtSel} 换成 ${rowSel}，序号不变，第 1 项不受影响`);

    // ===================== 工具条拖动 / 方向键（N15） =====================
    console.log('\n--- 工具条可拖动、可用方向键移动，且不出可视区 ---');
    const h0 = await shadowRect(page, tid('pm-wiz-drag'));
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
    check(t2.x >= 0 && t2.y >= 0 && t2.x < 1 && t2.y < 1, `拖出左上角时贴边，不出可视区（${Math.round(t2.x)},${Math.round(t2.y)}）`);
    await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-drag"]').focus(), HOST);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const t3 = await shadowRect(page, tid('pm-wizard-toolbar'));
    check(t3.x > t2.x + 10 && t3.y > t2.y + 10, `方向键移动工具条（→ ${Math.round(t3.x)},${Math.round(t3.y)}）`);

    // 选择阶段 Esc：有选择 → 确认；确认框上 Esc = 继续编辑；再确认退出
    await page.keyboard.press('Escape');
    await waitFor(page, '选择阶段 Esc 弹出退出确认', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    await page.keyboard.press('Escape');
    await waitFor(page, '确认框关闭', (h) => !document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-exit-confirm"]').open, [HOST], { timeout: 3000 });
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).length === 2, '选择阶段：确认框上 Esc = 继续编辑，已选内容还在');
    await page.keyboard.press('Escape');
    await waitForShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await clickInShadow(page, HOST, tid('pm-wiz-exit-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [HOST]);
    check(true, '确认后退出向导');
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
