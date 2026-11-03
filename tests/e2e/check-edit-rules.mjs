/**
 * 向导接管「编辑收起的内容」验收（#69）：popup 入口 → 直接停在「看效果」、草稿来自这个页面上适用的旧规则；
 * 上一步回选内容、之前收起过的元素带「之前收起了」标记、点它原地替换、保存不翻倍、删掉的规则随保存移除。
 *
 * 运行：npm run build && node tests/e2e/check-edit-rules.mjs     （约 20 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 三条草稿按旧规则顺序排在前，名称、收起方式、范围、失效状态都对
 * - 不做任何改动直接保存：规则数、id、体检记录都不变（不是新增一遍）
 * - 上一步回选内容：之前收起过的元素（含候选命中的同类，封顶 40）画虚线框 +「之前收起了」角标；
 *   标记不吃 pointerdown（层在捕获层之下、pointer-events: none）
 * - 点之前收起过的元素：原地更新那一条（不新增重复规则），工具条上是中性提示
 * - 「调整」展开：收起方式、范围、重选、高级选择器；改动在「上一步 → 下一步」后还在
 * - 失效行有可见说明与「重新选」，重选后摘要恢复正常
 * - 删除一行后保存：只删本次打开时属于这个页面的规则，别的页面的规则一律不动
 * - 保存后规则数不翻倍：更新的规则保留 id 与体检记录，新选的才追加
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
  tabIdOf,
  setProfile,
} from './lib/extension.mjs';
import { clickInShadow, shadowExists, shadowText, waitForShadow } from './lib/shadow.mjs';

const r = createReporter();
const { check } = r;
const WIZARD = 'pagemask-wizard';
const TOGGLE = 'pagemask-toggle';
const HOST = WIZARD;
const tid = (id) => `[data-testid="${id}"]`;

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Acme 商店 · 编辑收起的内容</title>
<style>body{margin:0;font:14px system-ui,sans-serif}nav{height:48px;background:#eef;line-height:48px;padding:0 16px}
#ad{height:60px;background:#fee;margin:12px 16px}#banner{height:60px;background:#efe;margin:12px 16px}
#promo{display:block;height:60px;background:#ffe;margin:12px 16px}
.cards{display:flex;gap:12px;padding:12px 16px;margin:0;list-style:none}.card{flex:1;height:70px;background:#eef}
#content{min-height:900px;padding:16px}</style></head><body>
<nav id="top-nav">首页 分类</nav>
<div id="ad">广告位（示例）</div>
<div id="banner">横幅（示例）</div>
<aside id="promo">活动栏（示例）</aside>
<ul class="cards"><li class="card">卡片一</li><li class="card">卡片二</li><li class="card">卡片三</li></ul>
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
const rule = (id, name, sel, extra = {}) => ({
  id,
  elementName: name,
  candidates: [sel],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: true,
  createdAt: now,
  ...extra,
});

const R_AD = rule('r_ad', '广告位', '#ad', { lastHealth: 'ok', lastHealthAt: 111 });
const R_BANNER = rule('r_banner', '横幅', '#banner', { strategy: 'blank', lastHealth: 'ok', lastHealthAt: 111 });
const R_STALE = rule('r_stale', '已经不在的项', '#gone', { lastHealth: 'stale', lastHealthAt: 222 });
/** 别的页面的规则：本次打开时不属于这个页面，任何情况下都不许被删 */
const R_OTHER = rule('r_other', '别的页面的项', '#never', {
  scope: { type: 'include', patterns: [{ label: '别的页面', prefix: `${ORIGIN}/other` }] },
});

const profileOf = (rules) => ({
  formatVersion: 1,
  origin: ORIGIN,
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

const draftCount = (page) =>
  page.evaluate((h) => document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid="pm-wiz-drafts"] > li').length ?? 0, HOST);
const draftNames = (page) =>
  page.evaluate(
    (h) => [...(document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid^="pm-draft-name-"]') ?? [])].map((i) => i.value),
    HOST,
  );
const shadowTexts = (page, sel) =>
  page.evaluate((h, s) => [...(document.querySelector(h)?.shadowRoot?.querySelectorAll(s) ?? [])].map((e) => e.textContent.trim()), HOST, sel);
const progressOf = async (page) => (await shadowTexts(page, tid('pm-wiz-progress')))[0] ?? '';
const headingOf = async (page) => (await shadowTexts(page, tid('pm-wiz-heading')))[0] ?? '';
const checkedStrategy = (page, n) =>
  page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`input[name="pm-strategy-${i}"]:checked`)?.value ?? null,
    HOST,
    n,
  );
const nameValue = (page, n) =>
  page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-name-${i}"]`)?.value ?? null,
    HOST,
    n,
  );

async function openAdjust(page, n) {
  const open = await page.evaluate(
    (h, i) => document.querySelector(h)?.shadowRoot?.querySelector(`[data-testid="pm-draft-${i}-adjust"]`)?.getAttribute('aria-expanded') === 'true',
    HOST,
    n,
  );
  if (!open) await clickInShadow(page, HOST, tid(`pm-draft-${n}-adjust`));
}

async function clickEl(page, sel) {
  const rc = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, sel);
  if (!rc) throw new Error(`页面上没有 ${sel}`);
  await page.mouse.click(rc.x + rc.w / 2, rc.y + rc.h / 2);
}

/** 打开「编辑收起的内容」：走真实的 popup 入口 */
async function openEditRules(ext, page) {
  const popup = await openPopup(ext, page);
  await popup.waitForSelector(tid('pm-popup-edit'), { timeout: 5000 });
  await popup.bringToFront();
  await popup.click(tid('pm-popup-edit'));
  await waitForShadow(page, HOST, tid('pm-wizard-toolbar'), { timeout: 8000 });
}

/** 等选择阶段真正接管指针（拾取层挂上、光标变十字），避免抢在 setDraft 往返之前点页面 */
const waitPickReady = (page, label) =>
  waitFor(page, label, () => document.documentElement.style.cursor === 'crosshair', [], { timeout: 5000 });

/** 键顺序无关的 JSON 比较（存储层规范化后键顺序会变） */
const canonical = (v) =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().map((key) => [key, val[key]]))
      : val,
  );

/** 给 shadow 里的 textarea 赋值并触发 v-model 的 input 事件 */
const setTextarea = (page, sel, value) =>
  page.evaluate(
    (h, s, v) => {
      const ta = document.querySelector(h)?.shadowRoot?.querySelector(s);
      if (!ta) return false;
      ta.value = v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    HOST,
    sel,
    value,
  );

const hiddenMarks = (page) =>
  page.evaluate((h) => {
    const sr = document.querySelector(h)?.shadowRoot;
    return [...(sr?.querySelectorAll('[data-testid="pm-hidden-mark"]') ?? [])].map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return { x: r.x, y: r.y, w: r.width, h: r.height, pointer: cs.pointerEvents, z: cs.zIndex };
    });
  }, HOST);

async function main() {
  const ext = await launchExtension({ hostOrigins: [ORIGIN], extraPermissions: ['tabs'] });
  try {
    const page = await ext.browser.newPage();
    page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`${ORIGIN}/shop`, { waitUntil: 'load' });
    const initial = [R_AD, R_BANNER, R_STALE, R_OTHER];
    await setProfile(ext.control, ORIGIN, profileOf(initial));
    const tabId = await tabIdOf(ext.control, `${ORIGIN}/*`);
    const enabled = await sendToBackground(ext.control, { t: 'enableSite', origin: ORIGIN, tabId });
    check(enabled?.ok === true, '测试站点已启用');
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    await waitVisible(page, '规则生效：广告位被收起', '#ad', false);
    check((await page.evaluate(() => getComputedStyle(document.querySelector('#banner')).visibility)) === 'hidden', '规则生效：横幅留空');

    // ===================== 入口与草稿 =====================
    console.log('\n--- popup「编辑收起的内容」→ 直接停在看效果，草稿来自旧规则 ---');
    await openEditRules(ext, page);
    check((await progressOf(page)) === '第 2 步 / 共 2 步', `一进来就在看效果，步骤是 2/2（${await progressOf(page)}）`);
    check((await headingOf(page)) === '看效果', `标题是「看效果」（${await headingOf(page)}）`);
    check((await draftCount(page)) === 3, `三条旧规则都铺成了草稿（实际 ${await draftCount(page)} 行）`);
    const names = await draftNames(page);
    check(
      names.join('|') === '广告位|横幅|已经不在的项',
      `草稿按规则原顺序排列、名称原样带过来（${names.join(' / ')}）`,
    );
    const summaries = await shadowTexts(page, '[data-testid$="-summary"]');
    check(
      summaries[0] === '消失 · 整个网站' && summaries[1] === '留空 · 整个网站',
      `摘要写成「收起方式 · 范围」（${summaries.slice(0, 2).join(' / ')}）`,
    );
    check(summaries[2] === '可能失效 · 在页面上找不到了', `失效行的摘要单独一句（${summaries[2]}）`);
    check(await shadowExists(page, HOST, tid('pm-draft-3-stale')), '失效行在摘要下面有可见说明');
    check(await shadowExists(page, HOST, tid('pm-draft-3-stale-fix')), '失效行有「重新选」入口');
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-save"]').disabled, HOST)) === false,
      '失效但有候选的规则可以保存（不是新错误）',
    );
    check((await visible(page, '#ad')) === false, '一进来页面就按现有设置显示（广告位仍然收起）');
    check(
      (await page.evaluate(() => getComputedStyle(document.querySelector('#banner')).visibility)) === 'hidden',
      '横幅仍然留空',
    );

    // ===================== 不做改动直接保存：不翻倍 =====================
    console.log('\n--- 不做改动直接保存：规则数、id、体检记录都不变 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const afterNoop = await getProfile(ext.control, ORIGIN);
    check(afterNoop.hideRules.length === initial.length, `规则数不变（${initial.length} → ${afterNoop.hideRules.length}）`);
    check(
      afterNoop.hideRules.map((x) => x.id).join('|') === initial.map((x) => x.id).join('|'),
      `顺序与 id 都不变，不是新增一遍（${afterNoop.hideRules.map((x) => x.id).join(' / ')}）`,
    );
    const adAfterNoop = afterNoop.hideRules.find((x) => x.id === 'r_ad');
    check(adAfterNoop?.lastHealth === 'ok' && adAfterNoop?.lastHealthAt === 111, '原地更新保留了体检记录');
    check(
      canonical(afterNoop.hideRules.find((x) => x.id === 'r_other')) === canonical(R_OTHER),
      '别的页面的规则原样不动',
    );
    await waitVisible(page, '保存后广告位仍收起', '#ad', false);

    // ===================== 上一步：之前收起过的元素被标出来 =====================
    console.log('\n--- 上一步回选内容：之前收起过的元素带虚线框和「之前收起了」角标 ---');
    await openEditRules(ext, page);
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回到选内容：页面先还原', '#ad');
    await waitPickReady(page, '拾取层接管指针');
    await waitFor(page, '出现两个「之前收起了」标记', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-hidden-mark"]').length === 2, [HOST]);
    const marks = await hiddenMarks(page);
    check(marks.length === 2, `两条能命中的旧规则各标出一处（${marks.length}）`);
    const adRect = await page.evaluate(() => {
      const b = document.querySelector('#ad').getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    check(
      marks.some((m) => Math.abs(m.x - adRect.x) < 1.5 && Math.abs(m.y - adRect.y) < 1.5 && Math.abs(m.w - adRect.w) < 1.5),
      '广告位上的标记与元素严丝合缝',
    );
    const badgeTexts = await shadowTexts(page, tid('pm-hidden-badge'));
    check(
      badgeTexts.length === 2 && badgeTexts.every((x) => x === '之前收起了'),
      `角标写的是「之前收起了」（${badgeTexts.join(' / ')}）`,
    );
    const pickZ = await page.evaluate((h) => getComputedStyle(document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-pick-layer"]')).zIndex, HOST);
    check(
      marks.every((m) => m.pointer === 'none' && Number(m.z) < Number(pickZ)),
      `标记在点选捕获层之下且不吃指针（z=${marks[0]?.z} < ${pickZ}，pointer-events=${marks[0]?.pointer}）`,
    );

    // ===================== 点之前收起过的元素：原地替换 =====================
    console.log('\n--- 点已经收起的元素：原地更新那一条，不新增重复规则 ---');
    await clickEl(page, '#ad');
    await waitForShadow(page, HOST, tid('pm-wizard-info'), { timeout: 3000 });
    const info = (await shadowTexts(page, tid('pm-wizard-info')))[0] ?? '';
    check(info === '这一项已经在列表里，已按你刚点的地方更新', `工具条上说明是原地更新（${info}）`);
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length, HOST)) === 1,
      '它作为本次点选的项列进了清单（有号码牌）',
    );
    const nextLabel = (await shadowTexts(page, tid('pm-wiz-preview')))[0] ?? '';
    check(nextLabel === '下一步：看效果（3）', `计数仍是 3 条，不是 4（${nextLabel}）`);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '回到看效果：广告位又收起', '#ad', false);
    check((await draftCount(page)) === 3, `还是 3 行，没有多出一条重复规则（${await draftCount(page)}）`);

    // ===================== 调整：收起方式、范围、重选、高级 =====================
    console.log('\n--- 展开「调整」：改收起方式；上一步再回来改动还在 ---');
    check(!(await shadowExists(page, HOST, tid('pm-draft-1-body'))), '默认收起调整区');
    await openAdjust(page, 1);
    check((await checkedStrategy(page, 1)) === 'remove', '第 1 行的收起方式原样带过来（消失）');
    check(await shadowExists(page, HOST, tid('pm-draft-1-reselect')), '展开区有「重新选」');
    check(await shadowExists(page, HOST, tid('pm-draft-1-advanced')), '展开区有「高级：选择器原文」');
    const rowScope = await shadowTexts(page, `${tid('pm-draft-1-scope')} button`);
    check(rowScope.join('|') === '整个网站|只在这类页面|除了这类页面', `展开区有行内范围三档（${rowScope.join(' / ')}）`);
    await clickInShadow(page, HOST, tid('pm-draft-1-strategy-mask'));
    await waitFor(page, '改成盖住后元素可见、出现遮盖板', (h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      return !!sr?.querySelector('.pm-wiz-mask') && getComputedStyle(document.querySelector('#ad')).display !== 'none';
    }, [HOST]);
    check((await shadowTexts(page, tid('pm-draft-1-summary')))[0] === '盖住 · 整个网站', '摘要跟着换成「盖住 · 整个网站」');

    // 行内范围：三个按钮切换，摘要跟着变；再换回整个网站（不改这次要保存的范围）
    await clickInShadow(page, HOST, tid('pm-draft-1-scope-include'));
    check(
      ((await shadowTexts(page, tid('pm-draft-1-summary')))[0] ?? '').startsWith('盖住 · 只在这类页面：'),
      `行内换成「只在这类页面」后摘要跟着变（${(await shadowTexts(page, tid('pm-draft-1-summary')))[0]}）`,
    );
    await clickInShadow(page, HOST, tid('pm-draft-1-scope-all'));
    check((await shadowTexts(page, tid('pm-draft-1-summary')))[0] === '盖住 · 整个网站', '换回「整个网站」');

    // 高级：选择器原文逐行校验（第 2 行不命中 → 指出第 2 行）
    await clickInShadow(page, HOST, `${tid('pm-draft-1-advanced')} summary`);
    await setTextarea(page, tid('pm-draft-1-selector'), '#ad\n.definitely-not-here');
    await clickInShadow(page, HOST, tid('pm-draft-1-selector-save'));
    await waitForShadow(page, HOST, tid('pm-draft-1-selector-error'), { timeout: 3000 });
    const advErr = await shadowText(page, HOST, tid('pm-draft-1-selector-error'));
    check(advErr.includes('第 2 行'), `高级选择器逐行校验指出第 2 行（${advErr.trim()}）`);

    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回选内容：广告位恢复可见', '#ad');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitFor(page, '再回看效果：遮盖板还在', (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('.pm-wiz-mask'), [HOST]);
    check(
      (await draftCount(page)) === 3 && (await checkedStrategy(page, 1)) === 'mask',
      '上一步再回来，改动还在（3 行、第 1 行仍是盖住）',
    );

    // ===================== 失效行：重新选 =====================
    console.log('\n--- 失效行的「重新选」：换成页面上新的位置 ---');
    await openAdjust(page, 3);
    check(await shadowExists(page, HOST, tid('pm-draft-3-stale')), '失效行仍然有可见说明');
    await clickInShadow(page, HOST, tid('pm-draft-3-reselect'));
    await waitForShadow(page, HOST, tid('pm-wiz-preview'));
    await waitPickReady(page, '重选：拾取层接管指针');
    await clickEl(page, '#promo');
    await waitForShadow(page, HOST, tid('pm-wizard-info'), { timeout: 3000 });
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '重选后活动栏被收起', '#promo', false);
    check((await draftCount(page)) === 3, '重选不新增行（仍是 3 行）');
    check(!(await shadowExists(page, HOST, tid('pm-draft-3-stale'))), '失效说明消失');
    check((await shadowTexts(page, tid('pm-draft-3-summary')))[0] === '消失 · 整个网站', '摘要恢复正常');
    const fixedName = await nameValue(page, 3);
    check(fixedName === '侧栏', `自动名字跟着新元素换（${fixedName}）`);

    // ===================== 新选一项 + 删一行 =====================
    console.log('\n--- 新选一项、删掉一行，再保存 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回选内容：预告栏恢复', '#promo');
    await waitPickReady(page, '新选一项：拾取层接管指针');
    await clickEl(page, '.card:nth-child(1)');
    await waitFor(page, '已选 1 个新元素', (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-preview"]').textContent.includes('（4）'), [HOST]);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitFor(page, '草稿变成 4 行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-drafts"] > li').length === 4, [HOST]);
    check(
      (await shadowTexts(page, tid('pm-draft-4-summary')))[0] === '消失 · 整个网站',
      '新选的一项默认「消失 · 整个网站」',
    );
    await clickInShadow(page, HOST, tid('pm-draft-2-remove'));
    await waitVisible(page, '删掉横幅那一行：横幅恢复可见', '#banner');
    check((await draftCount(page)) === 3, '删掉后剩 3 行');

    // ===================== 保存：原地更新 + 追加 + 删除 =====================
    console.log('\n--- 保存：更新保留 id、新选的追加、删掉的移除，别的页面不动 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const saved = await getProfile(ext.control, ORIGIN);
    const ids = saved.hideRules.map((x) => x.id);
    check(saved.hideRules.length === 4, `共 4 条：3 条这个页面的 + 1 条别的页面的（实际 ${saved.hideRules.length}）`);
    check(new Set(ids).size === ids.length, `没有重复 id（${ids.join(' / ')}）`);
    check(!ids.includes('r_banner'), '删掉的那行从规则里移除');
    check(ids.includes('r_other'), '别的页面的规则没被碰');
    check(
      canonical(saved.hideRules.find((x) => x.id === 'r_other')) === canonical(R_OTHER),
      '别的页面的规则内容也原样不动',
    );
    const savedAd = saved.hideRules.find((x) => x.id === 'r_ad');
    check(savedAd?.strategy === 'mask', `改过的收起方式落库（${savedAd?.strategy}）`);
    check(savedAd?.lastHealth === 'ok' && savedAd?.lastHealthAt === 111, '原地更新保留体检记录');
    const savedStale = saved.hideRules.find((x) => x.id === 'r_stale');
    check(savedStale?.elementName === '侧栏', `重选的那条仍是同一个 id（${savedStale?.elementName}）`);
    check(savedStale?.lastHealth === 'stale', '体检记录保留（等下次体检再更新）');
    const hitsPromo = await page.evaluate(
      (sels) => sels.some((s) => {
        try {
          return document.querySelector(s) === document.querySelector('#promo');
        } catch {
          return false;
        }
      }),
      savedStale?.candidates ?? [],
    );
    check(hitsPromo, `重选后的选择器指向活动栏（${JSON.stringify(savedStale?.candidates)}）`);
    const added = saved.hideRules.filter((x) => !['r_ad', 'r_banner', 'r_stale', 'r_other'].includes(x.id));
    check(added.length === 1, `新选的只追加了 1 条（${added.length}）`);
    const hitsCard = await page.evaluate(
      (sels) => sels.some((s) => {
        try {
          return document.querySelector(s) === document.querySelector('.card:nth-child(1)');
        } catch {
          return false;
        }
      }),
      added[0]?.candidates ?? [],
    );
    check(hitsCard, `新规则指向卡片一（${JSON.stringify(added[0]?.candidates)}）`);

    // ===================== 「收起更多内容」也标出已收起的（#74） =====================
    console.log('\n--- 「收起更多内容」：页面上已经收起的也标出来，再点它不会重复添加 ---');
    await sendToTab(ext.control, tabId, { t: 'openWizard', mode: 'addElement' });
    await waitForShadow(page, HOST, tid('pm-wizard-toolbar'));
    check((await progressOf(page)) === '第 1 步 / 共 2 步', `从点选开始（${await progressOf(page)}）`);
    await waitPickReady(page, '拾取层接管指针');
    await waitFor(
      page,
      '已收起的元素被标出来',
      (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-hidden-mark"]').length >= 3,
      [HOST],
    );
    // 三条规则在这个页面上命中：广告位、活动栏，以及「卡片」那条规则命中的每一张卡片
    const addMarks = await hiddenMarks(page);
    const adNow = await page.evaluate(() => {
      const b = document.querySelector('#ad').getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    check(
      addMarks.some((m) => Math.abs(m.x - adNow.x) < 1.5 && Math.abs(m.y - adNow.y) < 1.5 && Math.abs(m.w - adNow.w) < 1.5),
      `已收起的广告位上带标记（共 ${addMarks.length} 处）——不是一片空白让人重选`,
    );
    const addBadges = await shadowTexts(page, tid('pm-hidden-badge'));
    check(
      addBadges.length === addMarks.length && addBadges.every((x) => x === '之前收起了'),
      `每处标记各一个角标，文案与编辑入口一致（${addMarks.length} 处 / ${addBadges.length} 个角标）`,
    );
    await clickEl(page, '#ad');
    await waitForShadow(page, HOST, tid('pm-wizard-info'), { timeout: 3000 });
    const dupInfo = (await shadowTexts(page, tid('pm-wizard-info')))[0] ?? '';
    check(dupInfo.includes('这一项已经收起了'), `点已收起的项：说清不用再选（${dupInfo}）`);
    check(
      (await page.evaluate((h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length, HOST)) === 0,
      '没有把它加进这次的选择清单（不产生重复规则）',
    );
    const addNext = (await shadowTexts(page, tid('pm-wiz-preview')))[0] ?? '';
    check(addNext === '下一步：看效果（0）', `计数仍是 0（${addNext}）`);
    await clickInShadow(page, HOST, tid('pm-wiz-exit'));
    await waitFor(page, '退出向导', (h) => !document.querySelector(h), [HOST]);

    // 保存后的页面效果：盖住 / 删除 / 重选 / 新增都生效
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    check((await visible(page, '#ad')) === true, '盖住：广告位元素本身还在');
    await waitFor(page, '盖住的遮罩出现', (h) => (document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0) >= 1, ['pagemask-mask']);
    check(true, '盖住：遮罩覆盖层出现');
    check((await visible(page, '#banner')) === true, '删掉的那项恢复可见（横幅）');
    check((await visible(page, '#promo')) === false, '重选后活动栏被收起');
    check((await visible(page, '.card:nth-child(1)')) === false, '新选的卡片一被收起');
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
