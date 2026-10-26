import { beforeEach, describe, expect, it } from 'vitest';
import { isTooBigForPick, navigateLevel, unsavableDraftWarning } from './wizard-logic';

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
