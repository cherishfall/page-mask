import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampToViewport,
  isTooBigForPick,
  navigateLevel,
  reconcileDrafts,
  removeFromSelection,
  replaceInSelection,
  titleFromInput,
  titleOnlyPatch,
  toggleSelection,
  unsavableDraftWarning,
  wizardEscAction,
  wizardNextPhase,
  wizardPhases,
  wizardPrevPhase,
  wizardStep,
} from './wizard-logic';
import { createEmptyProfile } from './types';

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
