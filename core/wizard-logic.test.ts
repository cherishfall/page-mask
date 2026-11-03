import { beforeEach, describe, expect, it } from 'vitest';
import {
  badgePlacement,
  clampToViewport,
  draftHitCounts,
  isTooBigForPick,
  mergeEditDrafts,
  mergeSavedRules,
  navigateLevel,
  reconcileDrafts,
  removeFromSelection,
  replaceInSelection,
  scopeFromChoice,
  selectionRows,
  titleFromInput,
  titleOnlyPatch,
  toggleSelection,
  unsavableDraftWarning,
  wizardEscAction,
  wizardInitialPhase,
  wizardNextPhase,
  wizardPhases,
  wizardPrevPhase,
  wizardStep,
  zeroRuleSavedNotice,
} from './wizard-logic';
import { createEmptyProfile, type HideRule, type ScopePattern } from './types';

describe('isTooBigForPick 防呆', () => {
  const vp = { width: 1000, height: 800 };
  it('覆盖视口六成以上算太大', () => {
    expect(isTooBigForPick({ width: 900, height: 700 }, vp)).toBe(true);
  });
  it('正常元素不触发', () => {
    expect(isTooBigForPick({ width: 400, height: 200 }, vp)).toBe(false);
  });
});

describe('navigateLevel 层级导航', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="outer"><div id="mid"><span id="inner">文字</span></div></div>';
  });
  it('选大一点到父级，body 为顶', () => {
    const span = document.getElementById('inner')!;
    expect(navigateLevel(span, 'bigger')!.id).toBe('mid');
    expect(navigateLevel(document.body, 'bigger')).toBeNull();
  });
  it('选小一点到首个元素后代，无子级为 null', () => {
    const outer = document.getElementById('outer')!;
    expect(navigateLevel(outer, 'smaller')!.id).toBe('mid');
    expect(navigateLevel(document.getElementById('inner')!, 'smaller')).toBeNull();
  });
});

describe('unsavableDraftWarning 保存门槛：每条规则至少 1 个候选', () => {
  it('全部有候选时放行', () => {
    expect(unsavableDraftWarning([{ candidates: ['.a'] }, { candidates: ['#b', '.c'] }])).toBeNull();
  });
  it('有元素没有候选时拦下，并指出第几个', () => {
    const msg = unsavableDraftWarning([{ candidates: ['.a'] }, { candidates: [] }]);
    expect(msg).toContain('第 2 个');
    expect(msg).toContain('选大一点');
  });
});

describe('选择集：顺序即序号（N6、N11、N13）', () => {
  it('点一下选中、再点取消；取消后后面的项序号前移', () => {
    let sel: string[] = [];
    sel = toggleSelection(sel, 'A');
    sel = toggleSelection(sel, 'B');
    sel = toggleSelection(sel, 'C');
    sel = toggleSelection(sel, 'A');
    expect(sel).toEqual(['B', 'C']);
  });
  it('选大/选小换元素时留在原来的位置，不挪到末尾', () => {
    expect(replaceInSelection(['A', 'B', 'C'], 'A', 'P')).toEqual(['P', 'B', 'C']);
  });
  it('换上的元素已经在选择里：去掉被换的那个，不出现两次', () => {
    expect(replaceInSelection(['A', 'B', 'C'], 'C', 'A')).toEqual(['A', 'B']);
  });
  it('被换的元素不在选择里时不变', () => {
    expect(replaceInSelection(['A'], 'X', 'Y')).toEqual(['A']);
  });
  it('移出本次选择：从选择集删除', () => {
    expect(removeFromSelection(['A', 'B', 'C'], 'B')).toEqual(['A', 'C']);
  });
});

describe('reconcileDrafts 继续选择后回到预览（N12）', () => {
  const make = (el: string) => ({ el, strategy: 'remove' });
  it('已有草稿原样保留（含改过的方案），只为新元素建草稿，顺序跟选择集一致', () => {
    const old = new Map([
      ['A', { el: 'A', strategy: 'blank' }],
      ['B', { el: 'B', strategy: 'mask' }],
    ]);
    const next = reconcileDrafts(['B', 'C', 'A'], old, make);
    expect([...next.keys()]).toEqual(['B', 'C', 'A']);
    expect(next.get('A')).toBe(old.get('A'));
    expect(next.get('B')!.strategy).toBe('mask');
    expect(next.get('C')).toEqual({ el: 'C', strategy: 'remove' });
  });
  it('已取消选中的元素，草稿随之丢弃', () => {
    const old = new Map([['A', { el: 'A', strategy: 'blank' }]]);
    expect([...reconcileDrafts(['B'], old, make).keys()]).toEqual(['B']);
  });
});

describe('mergeEditDrafts 编辑已有规则时回到看效果（#69）', () => {
  type D = { el: string | null; sourceRuleId?: string | null };
  const make = (el: string): D => ({ el, sourceRuleId: null });

  it('旧规则带来的草稿（含找不到元素的）全部保留；取消了的新草稿丢弃；新点选的追加在后面', () => {
    const drafts: D[] = [
      { el: 'A', sourceRuleId: 'r1' },
      { el: null, sourceRuleId: 'r2' }, // 失效项也在列表里，不能丢
      { el: 'B', sourceRuleId: null }, // 上一次新选的，这次取消了
    ];
    const out = mergeEditDrafts(drafts, ['C'], (d) => d.sourceRuleId, (d) => d.el, make);
    expect(out.map((d) => d.el)).toEqual(['A', null, 'C']);
    expect(out[1]!.sourceRuleId).toBe('r2');
  });

  it('重选过的旧草稿留在原位置，不因为元素进了选择集而重复', () => {
    const drafts: D[] = [
      { el: 'A', sourceRuleId: 'r1' },
      { el: 'X', sourceRuleId: null },
    ];
    const out = mergeEditDrafts(drafts, ['A', 'X', 'Y'], (d) => d.sourceRuleId, (d) => d.el, make);
    expect(out.map((d) => d.el)).toEqual(['A', 'X', 'Y']);
    expect(out[0]).toBe(drafts[0]);
    expect(out[1]).toBe(drafts[1]);
  });
});

describe('wizardEscAction 向导级 Esc（N9）', () => {
  const esc = { key: 'Escape', isComposing: false, keyCode: 27 };
  it('没有浮层时 Esc = 请求退出（选择阶段、预览阶段都一样）', () => {
    expect(wizardEscAction(esc, { overlayOpen: false })).toBe('requestExit');
  });
  it('有浮层（弹片 / 确认框）时交给浮层自己关，向导不动', () => {
    expect(wizardEscAction(esc, { overlayOpen: true })).toBe('none');
  });
  it('输入法组字时的 Esc（取消候选词）不响应', () => {
    expect(wizardEscAction({ ...esc, isComposing: true }, { overlayOpen: false })).toBe('none');
    expect(wizardEscAction({ ...esc, keyCode: 229 }, { overlayOpen: false })).toBe('none');
  });
  it('其他按键不响应', () => {
    expect(wizardEscAction({ ...esc, key: 'Enter', keyCode: 13 }, { overlayOpen: false })).toBe('none');
  });
});

describe('三步骨架（#51）：步骤顺序、推进与回退', () => {
  it('新站点三步：标题与图标 → 选内容 → 看效果', () => {
    expect(wizardPhases('newSite')).toEqual(['title', 'pick', 'preview']);
    expect(wizardStep('newSite', 'title')).toEqual({ index: 1, total: 3 });
    expect(wizardStep('newSite', 'pick')).toEqual({ index: 2, total: 3 });
    expect(wizardStep('newSite', 'preview')).toEqual({ index: 3, total: 3 });
  });
  it('已添加的网站只有两步：选内容 → 看效果，进度也按 2 算', () => {
    expect(wizardPhases('addElement')).toEqual(['pick', 'preview']);
    expect(wizardStep('addElement', 'pick')).toEqual({ index: 1, total: 2 });
    expect(wizardStep('addElement', 'preview')).toEqual({ index: 2, total: 2 });
  });
  it('编辑已有规则（#69）：同样两步，但一打开就停在第 2 步「看效果」', () => {
    expect(wizardPhases('editRules')).toEqual(['pick', 'preview']);
    expect(wizardInitialPhase('editRules')).toBe('preview');
    expect(wizardInitialPhase('addElement')).toBe('pick');
    expect(wizardInitialPhase('newSite')).toBe('title');
    // 步骤计数是准确的 2/2，不为了好看压成 1/1
    expect(wizardStep('editRules', 'preview')).toEqual({ index: 2, total: 2 });
    expect(wizardStep('editRules', 'pick')).toEqual({ index: 1, total: 2 });
    expect(wizardPrevPhase('editRules', 'preview')).toBe('pick');
    expect(wizardPrevPhase('editRules', 'pick')).toBeNull();
    expect(wizardNextPhase('editRules', 'pick')).toBe('preview');
    expect(wizardNextPhase('editRules', 'preview')).toBeNull();
  });
  it('推进：标题 → 选内容 → 看效果；看效果没有下一步', () => {
    expect(wizardNextPhase('newSite', 'title')).toBe('pick');
    expect(wizardNextPhase('newSite', 'pick')).toBe('preview');
    expect(wizardNextPhase('newSite', 'preview')).toBeNull();
    expect(wizardNextPhase('addElement', 'pick')).toBe('preview');
    expect(wizardNextPhase('addElement', 'preview')).toBeNull();
  });
  it('回退：第 1 步没有上一步；看效果退回选内容', () => {
    expect(wizardPrevPhase('newSite', 'title')).toBeNull();
    expect(wizardPrevPhase('newSite', 'pick')).toBe('title');
    expect(wizardPrevPhase('newSite', 'preview')).toBe('pick');
    // 老站点进入就是第 1 步（选内容）：左下角没有「上一步」
    expect(wizardPrevPhase('addElement', 'pick')).toBeNull();
    expect(wizardPrevPhase('addElement', 'preview')).toBe('pick');
  });
});

describe('标题空值兜底（design.md：标题永不为空白）', () => {
  it('去掉首尾空白后使用输入值', () => {
    expect(titleFromInput('  工作笔记  ', '阅读')).toBe('工作笔记');
  });
  it('空字符串 / 只有空白 / 非字符串都用兜底标题', () => {
    expect(titleFromInput('', '阅读')).toBe('阅读');
    expect(titleFromInput('   ', ' 阅读 ')).toBe('阅读');
    expect(titleFromInput(null, 'Read')).toBe('Read');
    expect(titleFromInput(undefined, undefined)).toBe('Reading');
  });
  it('兜底也是空白时退回常量 "Reading"，不会把标题留空', () => {
    expect(titleFromInput('  ', '   ')).toBe('Reading');
  });
});

describe('「只改标题，完成」保存 0 条规则（#51）', () => {
  it('写入标题、图标与清爽态，不产生任何收起规则', () => {
    const profile = createEmptyProfile('https://example.test');
    Object.assign(profile, titleOnlyPatch({ title: '工作笔记', icon: null, fallbackTitle: '阅读' }));
    expect(profile.hideRules).toEqual([]);
    expect(profile.disguisedTitle).toBe('工作笔记');
    expect(profile.faviconDataUrl).toBeNull();
    expect(profile.switchState).toBe('disguised');
  });
  it('标题留空用兜底值；上传的图标原样保留', () => {
    const patch = titleOnlyPatch({ title: '   ', icon: 'data:image/png;base64,AAA', fallbackTitle: '阅读' });
    expect(patch).toEqual({
      disguisedTitle: '阅读',
      faviconDataUrl: 'data:image/png;base64,AAA',
      switchState: 'disguised',
    });
  });
});

describe('已选清单的序号（#52）：删掉某一项后重排，且与号码牌同源', () => {
  const name = (el: string) => `名字-${el}`;
  it('序号按选择集顺序从 1 开始，名字跟着元素走', () => {
    expect(selectionRows(['A', 'B', 'C'], name)).toEqual([
      { seq: 1, el: 'A', name: '名字-A' },
      { seq: 2, el: 'B', name: '名字-B' },
      { seq: 3, el: 'C', name: '名字-C' },
    ]);
  });
  it('删掉中间一项后，后面的项序号整体前移（清单与号码牌一起重排）', () => {
    const rows = selectionRows(removeFromSelection(['A', 'B', 'C'], 'B'), name);
    expect(rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(rows.map((r) => r.el)).toEqual(['A', 'C']);
    expect(rows.map((r) => r.name)).toEqual(['名字-A', '名字-C']);
  });
  it('删除后号码牌编号 = 清单行号（同一个数组下标）', () => {
    const left = removeFromSelection(['A', 'B', 'C'], 'A');
    // 页面上的号码牌按 selectionRows 的 seq 画，清单行也用它，二者不可能对不上
    const badgeSeqs = selectionRows(left, name).map((r) => r.seq);
    expect(badgeSeqs).toEqual([1, 2]);
  });
  it('全删掉是空清单', () => {
    expect(selectionRows([], name)).toEqual([]);
  });
});

describe('badgePlacement 号码牌不压在元素自己的文字上（#52）', () => {
  const badge = { width: 24, height: 24 };
  const vp = { width: 1000, height: 800 };
  it('元素上方有地方：号码牌完全在元素上面', () => {
    const p = badgePlacement({ left: 100, top: 300, width: 200, height: 80 }, badge, vp);
    expect(p.side).toBe('above');
    expect(p.left).toBe(100);
    expect(p.top + badge.height).toBeLessThanOrEqual(300);
  });
  it('元素贴着视口顶边：翻到元素下方，仍不压住内容', () => {
    const p = badgePlacement({ left: 0, top: 0, width: 600, height: 48 }, badge, vp);
    expect(p.side).toBe('below');
    expect(p.top).toBeGreaterThanOrEqual(48);
  });
  it('元素几乎占满一屏：上下都没地方，才回到左上角内侧（半透明兜底）', () => {
    const p = badgePlacement({ left: 0, top: 0, width: 1000, height: 800 }, badge, vp);
    expect(p.side).toBe('inside');
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeLessThan(24);
  });
  it('元素左侧在视口外时号码牌贴左边，不跑出屏幕', () => {
    expect(badgePlacement({ left: -120, top: 300, width: 300, height: 80 }, badge, vp).left).toBe(0);
  });
  it('元素贴右边时号码牌往左收，不超出视口', () => {
    expect(badgePlacement({ left: 980, top: 300, width: 20, height: 20 }, badge, vp).left).toBe(1000 - 24);
  });
});

describe('clampToViewport 工具条拖动 / 方向键移动后仍在可视区（N15）', () => {
  const vp = { width: 1000, height: 800 };
  const size = { width: 400, height: 100 };
  it('区域内的位置不变', () => {
    expect(clampToViewport({ left: 100, top: 200 }, size, vp)).toEqual({ left: 100, top: 200 });
  });
  it('拖出右下角时贴边', () => {
    expect(clampToViewport({ left: 900, top: 790 }, size, vp)).toEqual({ left: 600, top: 700 });
  });
  it('拖出左上角时贴边', () => {
    expect(clampToViewport({ left: -50, top: -10 }, size, vp)).toEqual({ left: 0, top: 0 });
  });
  it('窗口比工具条还小时贴左上，不出现负数', () => {
    expect(clampToViewport({ left: 10, top: 10 }, size, { width: 300, height: 50 })).toEqual({ left: 0, top: 0 });
  });
});

describe('预览这一步的「同类一起（N）」：数量实时算（#53）', () => {
  /** 每个元素在页面上命中几个，用一张表冒充 DOM */
  const page = new Map<Element, number>();
  const count = (selectors: readonly string[]) => Number(selectors[0] ?? 0);
  const sameCandidates = (el: Element) => [String(page.get(el) ?? 1)];

  beforeEach(() => {
    page.clear();
    page.set(document.body, 3);
    page.set(document.createElement('div'), 1);
  });

  it('「同类一起」的 N 取同类那组候选的命中数，与当前选项无关', () => {
    const body = document.body;
    const one = document.createElement('div');
    const hits = draftHitCounts(
      [
        { el: body, onlyThis: false, candidates: ['3'] },
        { el: body, onlyThis: true, candidates: ['1'] },
        { el: one, onlyThis: false, candidates: ['1'] },
      ],
      sameCandidates,
      count,
    );
    // 第 2 行切到了「只这一个」：实际收 1 个，但「同类一起」的 N 仍是 3
    expect(hits).toEqual([
      { hits: 3, sameHits: 3 },
      { hits: 1, sameHits: 3 },
      { hits: 1, sameHits: 1 },
    ]);
  });

  it('页面变了（懒加载 / 滚动加载）后再算，N 跟着变', () => {
    const el = document.createElement('p');
    page.set(el, 3);
    expect(draftHitCounts([{ el, onlyThis: false, candidates: ['3'] }], sameCandidates, count)[0]).toEqual({ hits: 3, sameHits: 3 });
    page.set(el, 5);
    expect(draftHitCounts([{ el, onlyThis: false, candidates: ['5'] }], sameCandidates, count)[0]).toEqual({ hits: 5, sameHits: 5 });
  });

  it('页面上找不到元素（el === null）的草稿没有同类：两个数都按它自己的候选命中数算', () => {
    const hits = draftHitCounts(
      [
        { el: null, onlyThis: false, candidates: ['2'] },
        { el: null, onlyThis: true, candidates: ['1'] },
        { el: null, onlyThis: false, candidates: [] },
      ],
      () => {
        throw new Error('失效项不该去生成「同类」候选');
      },
      count,
    );
    expect(hits).toEqual([
      { hits: 2, sameHits: 2 },
      { hits: 1, sameHits: 1 },
      { hits: 0, sameHits: 0 },
    ]);
  });
});

describe('mergeSavedRules 保存时原地更新 / 追加 / 删除（#69）', () => {
  const rule = (id: string, name: string, sel: string, createdAt = 100): HideRule => ({
    id,
    elementName: name,
    candidates: [sel],
    strategy: 'remove',
    scope: { type: 'all' },
    onlyThis: false,
    createdAt,
    lastHealth: 'ok',
    lastHealthAt: 9,
  });
  let seq = 0;
  const opts = (editIds: readonly string[] | null) => ({ editIds, now: 500, makeId: () => `new-${++seq}` });

  beforeEach(() => {
    seq = 0;
  });

  it('有来源的原地更新：id、位置、createdAt 与体检记录都保留', () => {
    const existing = [rule('r1', '旧名字', '#a'), rule('r2', '中间的', '#b'), rule('r3', '要删的', '#c')];
    const out = mergeSavedRules(
      existing,
      [
        { sourceRuleId: 'r1', elementName: '新名字', candidates: ['#a2'], strategy: 'blank', scope: { type: 'all' }, onlyThis: true },
        { sourceRuleId: null, elementName: '新加的', candidates: ['#d'], strategy: 'mask', scope: { type: 'all' }, onlyThis: false },
      ],
      opts(['r1', 'r3']),
    );
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'new-1']);
    expect(out[0]).toMatchObject({
      id: 'r1',
      elementName: '新名字',
      candidates: ['#a2'],
      strategy: 'blank',
      onlyThis: true,
      createdAt: 100,
      lastHealth: 'ok',
      lastHealthAt: 9,
    });
    expect(out[1]).toEqual(existing[1]); // 页面上不适用、没进草稿的规则原样不动
    expect(out[2]).toMatchObject({ elementName: '新加的', createdAt: 500 });
  });

  it('只删「本次打开时属于这个页面」的规则：不在 editIds 里的一条都不碰', () => {
    const existing = [rule('here', '这页的', '#a'), rule('elsewhere', '别的页面的', '#b')];
    const out = mergeSavedRules(existing, [], opts(['here']));
    expect(out.map((r) => r.id)).toEqual(['elsewhere']);
  });

  it('没有 editIds（添加内容）时不删任何规则', () => {
    const existing = [rule('r1', '甲', '#a'), rule('r2', '乙', '#b')];
    const out = mergeSavedRules(existing, [], opts(null));
    expect(out).toEqual(existing);
  });

  it('来源规则已被别处删掉：照样追加一条新规则，不会静默丢掉这次修改', () => {
    const out = mergeSavedRules(
      [rule('r1', '甲', '#a')],
      [{ sourceRuleId: 'gone', elementName: '乙', candidates: ['#b'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false }],
      opts(null),
    );
    expect(out.map((r) => r.id)).toEqual(['r1', 'new-1']);
    expect(out[1]!.elementName).toBe('乙');
  });
});

describe('「在哪些页面收起」三选一 → 落库的范围（#53）', () => {
  const pattern: ScopePattern = { label: '/book/ 下的页面', prefix: 'https://example.test/book' };

  it('整个网站：不带任何页面条件', () => {
    expect(scopeFromChoice('all', pattern)).toEqual({ type: 'all' });
  });

  it('只在这类页面：规则范围是 include + 这一个「这类页面」', () => {
    expect(scopeFromChoice('include', pattern)).toEqual({ type: 'include', patterns: [pattern] });
  });

  it('除了这类页面：规则范围是 exclude + 这一个「这类页面」', () => {
    expect(scopeFromChoice('exclude', pattern)).toEqual({ type: 'exclude', patterns: [pattern] });
  });

  it('推不出「这类页面」时只能整站，不会写出一条空 pattern 的范围', () => {
    expect(scopeFromChoice('include', null)).toEqual({ type: 'all' });
    expect(scopeFromChoice('exclude', null)).toEqual({ type: 'all' });
  });
});

describe('0 条规则保存后的轻提示（#53）', () => {
  it('说清楚生效的是标签页名字，并带上真正生效的标题', () => {
    expect(zeroRuleSavedNotice('工作笔记')).toBe('已保存，标签页名字换成「工作笔记」了');
  });
  it('标题取的是兜底后的值（输入留空时也一样）', () => {
    const patch = titleOnlyPatch({ title: '  ', icon: null, fallbackTitle: '阅读' });
    expect(zeroRuleSavedNotice(patch.disguisedTitle)).toBe('已保存，标签页名字换成「阅读」了');
  });
});
