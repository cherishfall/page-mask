import { describe, expect, it } from 'vitest';
import { applyKey } from './apply-key';
import { createEmptyProfile, type SiteProfile } from './types';

const URL_A = 'https://site.test/a';

function profile(): SiteProfile {
  const p = createEmptyProfile('https://site.test', 1);
  p.switchState = 'disguised';
  p.hideRules = [
    { id: 'r1', elementName: '横幅', candidates: ['#b'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
  ];
  return p;
}
const settings = { defaultTitle: null };

describe('applyKey：判断存储变化是否需要整页重新应用', () => {
  it('只是体检回写（lastHealth / lastHealthAt）：不需要', () => {
    const before = profile();
    const after = profile();
    after.hideRules[0]!.lastHealth = 'stale';
    after.hideRules[0]!.lastHealthAt = 123;
    expect(applyKey(after, settings, URL_A)).toBe(applyKey(before, settings, URL_A));
  });

  it('只是悬浮按钮挪了位置、修改时间变了：不需要', () => {
    const after = profile();
    after.floatingBtnPos = { x: 10, y: 20 };
    after.updatedAt = 999;
    expect(applyKey(after, settings, URL_A)).toBe(applyKey(profile(), settings, URL_A));
  });

  it('开关、规则、伪装标题、全局默认标题、图标三态、页面地址变化：需要', () => {
    const base = applyKey(profile(), settings, URL_A);
    const switched = profile();
    switched.switchState = 'original';
    const ruleChanged = profile();
    ruleChanged.hideRules[0]!.strategy = 'blank';
    const titled = profile();
    titled.disguisedTitle = '笔记';
    // 图标三态（#121）：kind 与 preset 的 id 都要计入；对象引用不同但值相同则不算变
    const iconNone = profile();
    iconNone.icon = { kind: 'none' };
    const presetDoc = profile();
    presetDoc.icon = { kind: 'preset', id: 'doc' };
    const presetSheet = profile();
    presetSheet.icon = { kind: 'preset', id: 'sheet' };
    for (const key of [
      applyKey(switched, settings, URL_A),
      applyKey(ruleChanged, settings, URL_A),
      applyKey(titled, settings, URL_A),
      applyKey(iconNone, settings, URL_A),
      applyKey(presetDoc, settings, URL_A),
      applyKey(presetSheet, settings, URL_A),
      applyKey(profile(), { defaultTitle: '文档' }, URL_A),
      applyKey(profile(), settings, 'https://site.test/b'),
    ]) {
      expect(key).not.toBe(base);
    }
    // 同一种图标（新建两个对象）不改变键
    expect(applyKey(profile(), settings, URL_A)).toBe(base);
  });

  it('「保存过标题和图标」翻转：需要重应用（标题会突然生效或消失，#98）', () => {
    const base = profile();
    const on = profile();
    on.titleIconSet = true;
    expect(applyKey(on, settings, URL_A)).not.toBe(applyKey(base, settings, URL_A));
  });
});
