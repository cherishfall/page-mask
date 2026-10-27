/**
 * 编辑面板验收（#24，审查 N4、N5、N39）：popup 入口、重选不丢规则、开关不被覆盖、
 * 高级后门逐行校验、删除可撤销。
 *
 * 运行：npm run build && node tests/e2e/check-editor.mjs     （约 20 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - popup 的「编辑当前网站」真实点击 → 页面内出现编辑面板，且面板以 <dialog popover="manual"> 打开
 * - 重选 → 退出向导：规则数、规则 id、页面效果都不变（旧规则不再先删）
 * - 重选 → 选中新元素 → 预览 → 保存：旧规则被同一次写入替换（id 变、候选变），旧元素恢复可见、新元素被收起
 * - 面板打开期间在 popup 里关掉清爽模式，之后面板内改收起方案：开关仍是「原样」，不被面板写回
 * - 高级后门写两行、第 2 行不命中：保存被拒并提示「第 2 行」，存储里的候选不变
 * - 删除后出现撤销条（live region），点「撤销」规则回到原位置、原 id
 *
 * 不写截图、不留临时文件。
 */
import { createReporter, startServer, waitFor } from './lib/harness.mjs';
import {
  getProfile,
  launchExtension,
  openPopup,
  sendToBackground,
  sendToTab,
  setProfile,
  tabIdOf,
} from './lib/extension.mjs';
import { clickInShadow, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const EDITOR = 'pagemask-editor';
const WIZARD = 'pagemask-wizard';
const tid = (id) => `[data-testid="${id}"]`;

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 商店 · 编辑面板测试</title>
<style>body{margin:0;font:14px system-ui,sans-serif}nav{height:48px;background:#eef;line-height:48px;padding:0 16px}
.ad{height:60px;background:#fee;margin:12px 16px;border-radius:8px}
#banner{height:60px;background:#efe;margin:12px 16px}
#content{min-height:600px;padding:16px}</style></head><body>
<nav id="top-nav">首页 分类</nav>
<div class="ad" id="ad">广告位（示例）</div>
<div id="banner">横幅（示例）</div>
<main id="content"><h1>商品列表</h1><p>正文内容</p></main>
</body></html>`;

const srv = await startServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});
const ORIGIN = srv.origin;

const now = Date.now();
const ruleOf = (id, sel, name) => ({
  id,
  elementName: name,
  candidates: [sel],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: now,
  lastHealth: 'ok',
});
const profileOf = (origin, rules) => ({
  formatVersion: 1,
  origin,
  switchState: 'disguised',
  disguisedTitle: null,
  faviconDataUrl: null,
  hideRules: rules,
  floatingBtnPos: null,
  createdAt: now,
  updatedAt: now,
});

const visible = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility === 'visible' && el.getBoundingClientRect().height > 0;
  }, sel);

const waitVisible = (page, label, sel, want = true) =>
  waitFor(
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

const panelOpen = (page) =>
  page.evaluate(
    (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-editor-panel"]'),
    EDITOR,
  );
const panelIsPopover = (page) =>
  page.evaluate(
    (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-editor-panel"]')?.matches(':popover-open'),
    EDITOR,
  );
const wizardOpen = (page) => page.evaluate((h) => !!document.querySelector(h), WIZARD);

/** 在 shadow 里给 textarea 赋值并触发 v-model 的 input 事件 */
const setTextarea = (page, sel, value) =>
  page.evaluate(
    (h, s, v) => {
      const ta = document.querySelector(h)?.shadowRoot?.querySelector(s);
      if (!ta) return false;
      ta.value = v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    EDITOR,
    sel,
    value,
  );

/** 真实鼠标点页面元素（页面元素在向导的拾取层下面，按坐标点） */
async function clickEl(page, sel) {
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, sel);
  if (!r) throw new Error(`页面上没有 ${sel}`);
  await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
}

async function main() {
  const ext = await launchExtension({ hostOrigins: [ORIGIN], extraPermissions: ['tabs'] });
  try {
    const page = await ext.browser.newPage();
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/shop`, { waitUntil: 'load' });
    const oldRule = ruleOf('r-old', '#ad', '广告位');
    await setProfile(ext.control, ORIGIN, profileOf(ORIGIN, [oldRule]));
    const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const enabled = await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId });
    check(enabled?.ok === true, '测试站点已启用');
    await page.waitForSelector('pagemask-toggle', { timeout: 8000 });
    await waitVisible(page, '规则生效：广告位被收起', '#ad', false);

    // ===================== popup 入口 =====================
    console.log('\n--- popup 的「编辑当前网站」打开面板 ---');
    const popup = await openPopup(ext, page);
    await popup.waitForSelector(tid('pm-popup-edit'), { timeout: 5000 });
    check(true, 'popup 里有「编辑当前网站」按钮');
    await popup.bringToFront();
    await popup.click(tid('pm-popup-edit'));
    await waitForShadow(page, EDITOR, tid('pm-editor-panel'), { timeout: 8000 });
    check(await panelOpen(page), '从 popup 点按钮后页面内出现编辑面板');
    check(await panelIsPopover(page), '面板以 <dialog popover="manual"> 打开（进 top layer，页面仍可操作）');
    const focusInPanel = await page.evaluate(
      (h) => document.querySelector(h)?.shadowRoot?.activeElement?.dataset?.testid ?? null,
      EDITOR,
    );
    check(focusInPanel === 'pm-editor-panel', `打开后焦点进入面板（${focusInPanel}）`);

    // ===================== 重选 → 取消 =====================
    console.log('\n--- 重选元素：取消向导，旧规则原样保留 ---');
    await clickInShadow(page, EDITOR, tid('pm-ed-reselect-r-old'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'), { timeout: 8000 });
    await waitFor(page, '编辑面板已关闭', (h) => !document.querySelector(h), [EDITOR]);
    await clickInShadow(page, WIZARD, tid('pm-wiz-exit'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD]);
    const afterCancel = await getProfile(ext.control, ORIGIN);
    check(afterCancel.hideRules.length === 1 && afterCancel.hideRules[0].id === 'r-old', `取消后规则数不变、id 不变（${JSON.stringify(afterCancel.hideRules.map((x) => x.id))}）`);
    await waitVisible(page, '取消后旧规则仍然生效', '#ad', false);

    // ===================== 重选 → 保存 =====================
    console.log('\n--- 重选元素：保存时同一笔写入替换旧规则 ---');
    await sendToTab(ext.control, tabId, { t: 'openEditor' });
    await waitForShadow(page, EDITOR, tid('pm-editor-panel'));
    await clickInShadow(page, EDITOR, tid('pm-ed-reselect-r-old'));
    await waitForShadow(page, WIZARD, tid('pm-wizard-toolbar'));
    await clickEl(page, '#banner');
    await waitForShadow(page, WIZARD, tid('pm-wiz-preview'));
    await clickInShadow(page, WIZARD, tid('pm-wiz-preview'));
    await waitVisible(page, '预览：横幅被收起', '#banner', false);
    await clickInShadow(page, WIZARD, tid('pm-wiz-save'));
    await waitForShadow(page, WIZARD, tid('pm-wiz-save-yes'));
    await clickInShadow(page, WIZARD, tid('pm-wiz-save-yes'));
    await waitFor(page, '向导关闭', (h) => !document.querySelector(h), [WIZARD]);
    const afterSave = await getProfile(ext.control, ORIGIN);
    check(afterSave.hideRules.length === 1, `保存后仍然只有 1 条规则（${afterSave.hideRules.length}）`);
    check(afterSave.hideRules[0].id !== 'r-old', `旧规则被替换成新规则（新 id ${afterSave.hideRules[0].id}）`);
    await waitVisible(page, '新元素被收起', '#banner', false);
    await waitVisible(page, '旧元素恢复可见', '#ad');
    const newId = afterSave.hideRules[0].id;

    // ===================== 面板改动不会把开关改回 =====================
    console.log('\n--- 面板打开时在 popup 关掉清爽模式：面板内的改动不会把开关改回 ---');
    await sendToTab(ext.control, tabId, { t: 'openEditor' });
    await waitForShadow(page, EDITOR, tid('pm-editor-panel'));
    const popup2 = await openPopup(ext, page);
    await popup2.waitForSelector(tid('pm-popup-switch'), { timeout: 5000 });
    await popup2.bringToFront();
    await popup2.click(tid('pm-popup-switch'));
    const switched = await (async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.switchState === 'original') return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(switched.switchState === 'original', `popup 把开关关到原样态（${switched.switchState}）`);
    await popup2.close();
    await page.bringToFront();
    check(await panelOpen(page), '切换开关后编辑面板仍然开着');
    await clickInShadow(page, EDITOR, tid(`pm-ed-strategy-${newId}-blank`));
    const afterEdit = await (async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if (p?.hideRules[0]?.strategy === 'blank') return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(afterEdit.hideRules[0].strategy === 'blank', `面板改动写入成功（${afterEdit.hideRules[0].strategy}）`);
    check(afterEdit.switchState === 'original', `面板改动没有把开关改回清爽（${afterEdit.switchState}）`);
    // 复位到清爽态，后面的用例需要面板正常可写
    await setProfile(ext.control, ORIGIN, { ...afterEdit, switchState: 'disguised' });
    await waitFor(page, '回到清爽态', (h) => !!document.querySelector(h), ['pagemask-toggle'], { timeout: 8000 });

    // ===================== 高级后门逐行校验 =====================
    console.log('\n--- 高级后门：两行、第二行不命中 ---');
    if (!(await panelOpen(page))) {
      await sendToTab(ext.control, tabId, { t: 'openEditor' });
      await waitForShadow(page, EDITOR, tid('pm-editor-panel'));
    }
    await page.evaluate(
      (h, s) => {
        const d = document.querySelector(h).shadowRoot.querySelector(s)?.closest('details');
        if (d) d.open = true;
      },
      EDITOR,
      tid(`pm-ed-selector-${newId}`),
    );
    const beforeBad = (await getProfile(ext.control, ORIGIN)).hideRules[0].candidates;
    await setTextarea(page, tid(`pm-ed-selector-${newId}`), '#ad\n.definitely-not-here');
    await clickInShadow(page, EDITOR, `.pm-ed-adv button`);
    await waitForShadow(page, EDITOR, tid(`pm-ed-selector-error-${newId}`), { timeout: 3000 });
    const errText = await shadowText(page, EDITOR, tid(`pm-ed-selector-error-${newId}`));
    check(errText.includes('第 2 行'), `错误提示指出第 2 行（${errText}）`);
    const afterBad = await getProfile(ext.control, ORIGIN);
    check(
      JSON.stringify(afterBad.hideRules[0].candidates) === JSON.stringify(beforeBad),
      `被拒后存储里的候选没有变（${JSON.stringify(afterBad.hideRules[0].candidates)}）`,
    );

    // ===================== 删除 → 撤销 =====================
    console.log('\n--- 删除后约 5 秒可撤销 ---');
    await clickInShadow(page, EDITOR, tid(`pm-ed-delete-${newId}`));
    const afterDelete = await (async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if ((p?.hideRules.length ?? 0) === 0) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(afterDelete.hideRules.length === 0, `删除后规则数为 0（${afterDelete.hideRules.length}）`);
    const undoText = await shadowText(page, EDITOR, tid('pm-editor-undo'));
    check(undoText.includes('已删除'), `出现可撤销提示（${undoText.trim()}）`);
    await clickInShadow(page, EDITOR, tid('pm-editor-undo-btn'));
    const afterUndo = await (async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const p = await getProfile(ext.control, ORIGIN);
        if ((p?.hideRules.length ?? 0) === 1) return p;
        await new Promise((res) => setTimeout(res, 100));
      }
      return getProfile(ext.control, ORIGIN);
    })();
    check(afterUndo.hideRules.length === 1 && afterUndo.hideRules[0].id === newId, `撤销把规则放回原位置与 id（${afterUndo.hideRules[0]?.id}）`);

    // Esc 关闭面板（N31）
    await page.keyboard.press('Escape');
    await waitFor(page, 'Esc 关闭编辑面板', (h) => !document.querySelector(h), [EDITOR], { timeout: 3000 });
    check(true, '编辑面板可以用 Esc 关闭');

    check(!(await wizardOpen(page)), '用例结束时没有残留向导');
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
