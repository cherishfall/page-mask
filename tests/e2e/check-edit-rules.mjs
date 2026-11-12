/**
 * 「收起内容」验收（#77 三口归一、#81 旧项全互动）：popup 主按钮 → 停在选内容、已收起的项直接进选择集
 * （与新选的统一编号）；点它 = 从清单里去掉（等同 ✕），再点 = 按默认值加回；下一步逐行改、保存不翻倍、
 * 删掉的规则随保存移除。
 *
 * 运行：npm run build && node tests/e2e/check-edit-rules.mjs     （约 20 秒；HEADFUL=1 有界面运行）
 *
 * 覆盖：
 * - 打开即停在点选（第 1 步 / 共 2 步）；两条能命中的旧规则元素已在选择集里（号码牌 + 已选清单），
 *   失效的那条不进选择集但仍在草稿里
 * - 不做任何改动直接保存：规则数、id、体检记录都不变（不是新增一遍）
 * - 点已收起的元素 = 取消：从已选清单与号码牌里消失，看效果的草稿也少一行（等同清单 ✕）
 * - 再点回来 = 按默认值当新的一项加回（默认收起方式、同类默认只收一个）
 * - 「调整」展开：收起方式、范围、高级选择器；改动在「上一步 → 下一步」后还在
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
  patchProfile,
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
  icon: { kind: 'none' },
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

/** 打开「收起内容」：走真实的 popup 主按钮入口（#77） */
async function openEditRules(ext, page) {
  const popup = await openPopup(ext, page);
  await popup.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
  await popup.bringToFront();
  await popup.click(tid('pm-popup-setup'));
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

/** 已选清单的行名（旧项与新选统一编号，#81） */
const pickedNames = (page) =>
  page.evaluate(
    (h) => [...(document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-testid="pm-wiz-selected"] .pm-wiz-row-name') ?? [])].map((e) => e.textContent.trim()),
    HOST,
  );

/** 等第 seq 个号码牌的框与页面元素重合（标记跟随是逐帧的） */
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

    // ===================== 入口：停在选内容，旧项直接进选择集（#77 / #81） =====================
    console.log('\n--- popup「收起内容」→ 停在点选，旧规则元素统一编号进清单 ---');
    await openEditRules(ext, page);
    check((await progressOf(page)) === '第 1 步 / 共 2 步', `停在选内容，第 1 步 / 共 2 步（${await progressOf(page)}）`);
    check((await headingOf(page)) === '点选要收起的内容', `标题说明这一步做什么（${await headingOf(page)}）`);
    check(!(await shadowExists(page, HOST, tid('pm-wiz-back'))), '选内容这一步没有「上一步」（#81 两步流程）');
    await waitPickReady(page, '拾取层接管指针');
    await waitFor(page, '已收起的两项进了已选清单', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 2, [HOST]);
    const picked = await pickedNames(page);
    check(
      picked.length === 2 && picked[0].includes('广告位') && picked[1].includes('横幅'),
      `已收起的项与新选的统一编号、进同一份清单（${picked.join(' / ')}）`,
    );
    // 号码牌跟着旧项：1 = 广告位、2 = 横幅
    await waitBoxOn(page, '号码牌 1 在广告位上', 1, '#ad');
    await waitBoxOn(page, '号码牌 2 在横幅上', 2, '#banner');
    check((await shadowTexts(page, '[data-testid^="pm-badge-"]')).join('|') === '1|2', '页面上只有号码牌一种标记（1、2）');
    check(
      !(await shadowExists(page, HOST, tid('pm-hidden-mark'))) && !(await shadowExists(page, HOST, tid('pm-hidden-badge'))),
      '「之前收起了」虚线角标已经退场（#81）',
    );

    // #189：同一会话内同一对象必须同名——选内容清单的行名直接用草稿名（保存名优先），
    // 不再对旧规则元素现场重算自动命名（否则同一行在两步里一个叫「广告位」一个叫「广告位（示例）」）
    check(
      picked.join('|') === '广告位|横幅',
      `选内容清单行名 = 保存名，与看效果清单同名（${picked.join(' / ')}）`,
    );

    // 下一步：三条旧规则都进了看效果
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '看效果：页面按现有设置显示（广告位收起）', '#ad', false);
    check((await progressOf(page)) === '第 2 步 / 共 2 步', `看效果是第 2 步（${await progressOf(page)}）`);
    check((await draftCount(page)) === 3, `三条旧规则都铺成了草稿（实际 ${await draftCount(page)} 行）`);
    const names = await draftNames(page);
    check(
      names.join('|') === '广告位|横幅|已经不在的项',
      `草稿按规则原顺序排列、名称原样带过来（${names.join(' / ')}）`,
    );
    // #189：两步清单对同一对象同名（行名来自同一条草稿，不是两条取名路径）
    check(
      picked[0] === names[0] && picked[1] === names[1],
      `选内容与看效果对同一对象同名（${picked.join(' / ')} vs ${names.slice(0, 2).join(' / ')}）`,
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

    // ===================== 看效果「上一步」回点选：旧项还在选择集里 =====================
    console.log('\n--- 看效果「上一步」回点选：页面还原、旧项还在清单里 ---');
    await openEditRules(ext, page);
    await clickInShadow(page, HOST, tid('pm-wiz-preview')); // 先到看效果，再走「上一步」回来
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回到选内容：页面先还原', '#ad');
    await waitPickReady(page, '拾取层接管指针');
    await waitFor(page, '上一步回来旧项还在清单里', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 2, [HOST]);
    check(true, '上一步回来：已收起的两项照旧在选择集里');

    // ===================== 点已收起的元素 = 取消；再点 = 按默认值加回（#81） =====================
    console.log('\n--- 点已收起的元素：取消等同 ✕；再点回来当新的一项加回 ---');
    await clickEl(page, '#ad');
    await waitFor(page, '已选清单少了一行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 1, [HOST]);
    await waitFor(page, '广告位的号码牌跟着消失', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid^="pm-badge-"]').length === 1, [HOST]);
    check(true, '点已收起的项 = 取消：清单与号码牌同步少一行（一个手势只许一个意思）');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '取消后广告位恢复可见', '#ad');
    check((await draftCount(page)) === 2, `取消旧项等同清单里点它的 ✕（草稿 3 → ${await draftCount(page)} 行）`);
    check(
      (await draftNames(page)).join('|') === '横幅|已经不在的项',
      `剩下的是横幅与失效项（${(await draftNames(page)).join(' / ')}）`,
    );
    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitPickReady(page, '加回：拾取层接管指针');
    await clickEl(page, '#ad');
    await waitFor(page, '加回后清单又两行', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 2, [HOST]);
    check(true, '再点回来 = 当新的一项加回');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '加回的广告位又被收起', '#ad', false);
    check((await draftCount(page)) === 3, '加回的项在草稿末尾（3 行）');
    const backNames = await draftNames(page);
    check(
      backNames.length === 3 && backNames[0].includes('横幅') && backNames[1].includes('已经不在的项') && backNames[2].includes('广告位'),
      `加回的一项排在最后（${backNames.join(' / ')}）`,
    );

    // ===================== 调整：收起方式、范围、高级 =====================
    console.log('\n--- 展开「调整」：改收起方式；上一步再回来改动还在 ---');
    check(!(await shadowExists(page, HOST, tid('pm-draft-3-body'))), '默认收起调整区');
    await openAdjust(page, 3);
    check((await checkedStrategy(page, 3)) === 'remove', '加回的广告位那行是默认「消失」');
    check(!(await shadowExists(page, HOST, tid('pm-draft-3-reselect'))), '展开区不再有「重新选」（换位置走上一步，#76）');
    check(await shadowExists(page, HOST, tid('pm-draft-3-advanced')), '展开区有「高级：选择器原文」');
    check(!(await shadowExists(page, HOST, tid('pm-draft-3-summary'))), '展开时摘要藏起来（控件本身就是信息，#76）');
    // #142 起范围是原生单选分段：三档文字在 .pm-wiz-seg-opt 里
    const rowScope = await shadowTexts(page, `${tid('pm-draft-3-scope')} .pm-wiz-seg-opt`);
    check(rowScope.join('|') === '整个网站|只在这类页面|除了这类页面', `展开区有行内范围三档（${rowScope.join(' / ')}）`);
    await clickInShadow(page, HOST, tid('pm-draft-3-strategy-mask'));
    await waitFor(page, '改成盖住后元素可见、出现遮盖板', (h) => {
      const sr = document.querySelector(h)?.shadowRoot;
      return !!sr?.querySelector('.pm-wiz-mask') && getComputedStyle(document.querySelector('#ad')).display !== 'none';
    }, [HOST]);
    // 行内范围：展开状态下改，摘要跟着记住；收起后摘要回来并反映两处改动（#76）
    await clickInShadow(page, HOST, tid('pm-draft-3-scope-include'));
    await clickInShadow(page, HOST, tid('pm-draft-3-adjust')); // openAdjust 只会展开，这里要收起
    check(await shadowExists(page, HOST, tid('pm-draft-3-summary')), '收起后摘要回来');
    check(
      ((await shadowTexts(page, tid('pm-draft-3-summary')))[0] ?? '').startsWith('盖住 · 只在这类页面：'),
      `摘要反映收起方式与行内范围两处改动（${(await shadowTexts(page, tid('pm-draft-3-summary')))[0]}）`,
    );
    await openAdjust(page, 3); // 重新展开，换回整个网站（不改这次要保存的范围）
    await clickInShadow(page, HOST, tid('pm-draft-3-scope-all'));
    await clickInShadow(page, HOST, tid('pm-draft-3-adjust'));
    check((await shadowTexts(page, tid('pm-draft-3-summary')))[0] === '盖住 · 整个网站', '换回「整个网站」');
    await openAdjust(page, 3); // 重新展开，后面的高级选择器用例继续在这行上做

    // 高级：选择器原文逐行校验（第 2 行不命中 → 指出第 2 行）
    await clickInShadow(page, HOST, `${tid('pm-draft-3-advanced')} summary`);
    await setTextarea(page, tid('pm-draft-3-selector'), '#ad\n.definitely-not-here');
    await clickInShadow(page, HOST, tid('pm-draft-3-selector-save'));
    await waitForShadow(page, HOST, tid('pm-draft-3-selector-error'), { timeout: 3000 });
    const advErr = await shadowText(page, HOST, tid('pm-draft-3-selector-error'));
    check(advErr.includes('第 2 行'), `高级选择器逐行校验指出第 2 行（${advErr.trim()}）`);

    await clickInShadow(page, HOST, tid('pm-wiz-back'));
    await waitVisible(page, '回选内容：广告位恢复可见', '#ad');
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitFor(page, '再回看效果：遮盖板还在', (h) => !!document.querySelector(h)?.shadowRoot?.querySelector('.pm-wiz-mask'), [HOST]);
    check(
      (await draftCount(page)) === 3 && (await checkedStrategy(page, 3)) === 'mask',
      '上一步再回来，改动还在（3 行、广告位那行仍是盖住）',
    );

    // ===================== 失效行：重新选 =====================
    console.log('\n--- 失效行的「重新选」：换成页面上新的位置 ---');
    await openAdjust(page, 2);
    check(await shadowExists(page, HOST, tid('pm-draft-2-stale')), '失效行仍然有可见说明');
    await clickInShadow(page, HOST, tid('pm-draft-2-stale-fix'));
    await waitForShadow(page, HOST, tid('pm-wiz-preview'));
    await waitPickReady(page, '重选：拾取层接管指针');
    await clickEl(page, '#promo');
    await waitFor(page, '重选的元素进了选择集', (h) => document.querySelector(h).shadowRoot.querySelectorAll('[data-testid="pm-wiz-selected"] > li').length === 3, [HOST]);
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitVisible(page, '重选后活动栏被收起', '#promo', false);
    check((await draftCount(page)) === 3, '重选不新增行（仍是 3 行）');
    check(!(await shadowExists(page, HOST, tid('pm-draft-2-stale'))), '失效说明消失');
    // 这行之前被展开过：展开时摘要隐藏（#76），收起后再断言
    await page.evaluate((h) => {
      const btn = document.querySelector(h)?.shadowRoot?.querySelector('[data-testid="pm-draft-2-adjust"]');
      if (btn?.getAttribute('aria-expanded') === 'true') btn.click();
    }, HOST);
    check((await shadowTexts(page, tid('pm-draft-2-summary')))[0] === '消失 · 整个网站', '摘要恢复正常');
    const fixedName = await nameValue(page, 2);
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
    await clickInShadow(page, HOST, tid('pm-draft-1-remove'));
    await waitVisible(page, '删掉横幅那一行：横幅恢复可见', '#banner');
    check((await draftCount(page)) === 3, '删掉后剩 3 行');

    // ===================== 保存：原地更新 + 追加 + 删除 =====================
    console.log('\n--- 保存：更新保留 id、新选的追加、取消与删除的移除，别的页面不动 ---');
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(page, '保存后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const saved = await getProfile(ext.control, ORIGIN);
    const ids = saved.hideRules.map((x) => x.id);
    check(saved.hideRules.length === 4, `共 4 条：失效重选的 + 广告位 + 卡片 + 1 条别的页面的（实际 ${saved.hideRules.length}）`);
    check(new Set(ids).size === ids.length, `没有重复 id（${ids.join(' / ')}）`);
    check(!ids.includes('r_banner'), '删掉的那行从规则里移除');
    check(!ids.includes('r_ad'), '取消掉的那条也随保存移除（点已收起的项等同 ✕，#81）');
    check(ids.includes('r_other'), '别的页面的规则没被碰');
    check(
      canonical(saved.hideRules.find((x) => x.id === 'r_other')) === canonical(R_OTHER),
      '别的页面的规则内容也原样不动',
    );
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
    const added = saved.hideRules.filter((x) => x.id !== 'r_stale' && x.id !== 'r_other');
    check(added.length === 2, `广告位（取消又加回）与卡片一都是新规则（${added.length} 条）`);
    const hitsAd = await page.evaluate(
      (sels) => sels.some((s) => {
        try {
          return document.querySelector(s) === document.querySelector('#ad');
        } catch {
          return false;
        }
      }),
      added[0]?.candidates ?? [],
    );
    check(hitsAd && added[0]?.strategy === 'mask', `取消又加回的广告位按新规则落库（盖住，${added[0]?.id}）`);
    const hitsCard = await page.evaluate(
      (sels) => sels.some((s) => {
        try {
          return document.querySelector(s) === document.querySelector('.card:nth-child(1)');
        } catch {
          return false;
        }
      }),
      added[1]?.candidates ?? [],
    );
    check(hitsCard, `新规则指向卡片一（${JSON.stringify(added[1]?.candidates)}）`);

    // 保存后的页面效果：盖住 / 删除 / 重选 / 新增都生效
    await page.waitForSelector(TOGGLE, { timeout: 8000 });
    check((await visible(page, '#ad')) === true, '盖住：广告位元素本身还在');
    await waitFor(page, '盖住的遮罩出现', (h) => (document.querySelector(h)?.shadowRoot?.querySelectorAll('[data-pm-mask]').length ?? 0) >= 1, ['pagemask-mask']);
    check(true, '盖住：遮罩覆盖层出现');
    check((await visible(page, '#banner')) === true, '删掉的那项恢复可见（横幅）');
    check((await visible(page, '#promo')) === false, '重选后活动栏被收起');
    check((await visible(page, '.card:nth-child(1)')) === false, '新选的卡片一被收起');

    // ===================== 原样态保存先问一次（#159）：弹窗两条入口 =====================
    console.log('\n--- 原样态：弹窗「收起内容」先问「现在打开」，弹窗「标题和图标」也能打开开关 ---');
    await patchProfile(ext.control, ORIGIN, { switchState: 'original' });
    await waitVisible(page, '切到原样：活动栏恢复可见', '#promo');

    // 入口一：弹窗「收起内容」→ 看效果 → 保存 → 先保持原样
    const popupRules = await openPopup(ext, page);
    await popupRules.waitForSelector(tid('pm-popup-setup'), { timeout: 5000 });
    await popupRules.bringToFront();
    await popupRules.click(tid('pm-popup-setup'));
    await waitForShadow(page, HOST, tid('pm-wizard-toolbar'), { timeout: 8000 });
    await clickInShadow(page, HOST, tid('pm-wiz-preview'));
    await waitForShadow(page, HOST, tid('pm-wiz-save'));
    const rulesBefore = await getProfile(ext.control, ORIGIN);
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '原样态点保存弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    const dlgText = await shadowText(page, HOST, tid('pm-wizard-open-confirm'));
    check(
      dlgText.includes('保存后看不到效果') && dlgText.includes('「按你的设置显示」还关着，现在打开吗？'),
      `弹窗「收起内容」入口同样先问一次（${dlgText.split('\n').join(' / ')}）`,
    );
    const dlgFocus = await page.evaluate((h) => document.querySelector(h).shadowRoot.activeElement?.dataset.testid ?? null, HOST);
    check(dlgFocus === 'pm-wiz-open-stay', `默认焦点在「先保持原样」（${dlgFocus}）`);
    await clickInShadow(page, HOST, tid('pm-wiz-open-stay'));
    await waitFor(page, '选「先保持原样」后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const rulesAfter = await getProfile(ext.control, ORIGIN);
    check(
      rulesAfter.switchState === 'original' && rulesAfter.hideRules.length === rulesBefore.hideRules.length,
      `「先保持原样」也完成保存，开关与规则都按预期（${rulesAfter.switchState}，${rulesAfter.hideRules.length} 条）`,
    );

    // 入口二：弹窗「标题和图标」→ 保存 → 现在打开
    const OPEN_TITLE = '弹窗里改的标题';
    const popupTitle = await openPopup(ext, page);
    await popupTitle.waitForSelector(tid('pm-popup-title'), { timeout: 5000 });
    await popupTitle.bringToFront();
    await popupTitle.click(tid('pm-popup-title'));
    await waitForShadow(page, HOST, tid('pm-wizard-toolbar'), { timeout: 8000 });
    await page.evaluate(
      (h, v) => {
        const input = document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wiz-title-input"]');
        input.focus();
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      HOST,
      OPEN_TITLE,
    );
    await clickInShadow(page, HOST, tid('pm-wiz-save'));
    await waitFor(
      page,
      '标题流程也弹出确认框',
      (h) => document.querySelector(h).shadowRoot.querySelector('[data-testid="pm-wizard-open-confirm"]')?.open === true,
      [HOST],
      { timeout: 3000 },
    );
    await clickInShadow(page, HOST, tid('pm-wiz-open-yes'));
    await waitFor(page, '「现在打开」后向导关闭', (h) => !document.querySelector(h), [HOST]);
    const titleOpen = await getProfile(ext.control, ORIGIN);
    check(
      titleOpen.switchState === 'disguised' && titleOpen.disguisedTitle === OPEN_TITLE,
      `弹窗「标题和图标」入口：保存标题并切到按设置显示（${titleOpen.disguisedTitle} / ${titleOpen.switchState}）`,
    );
    await waitFor(page, '标签页当场换成新标题', (t) => document.title === t, [OPEN_TITLE], { timeout: 5000 });
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
