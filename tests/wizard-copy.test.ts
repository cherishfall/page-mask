/**
 * 流程专属文案守门（1.0.10，docs/design-copy.md 二、e/f；ADR-0021）。
 *
 * 事故：向导退出确认两条流程共用一句话，导致「收起内容」说标签页会变回原来的标题、
 * 「标题和图标」说页面会变回设置前的样子。本测试按流程分别断言：每条提示只能提到
 * 这条流程真的会动的东西，不能串到另一条流程。
 *
 * 同时守「同一张卡的条件句同构」：标题与图标两个字段的常驻说明都写开关关着时。
 */
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';

const zh = MESSAGES.zh;
const en = MESSAGES.en;

describe('向导退出提示按流程分开写（design-copy 二、e）', () => {
  it('中文：收起内容的退出提示只说页面与收起设置，不提标题/图标/标签页', () => {
    for (const n of [0, 1, 3]) {
      const text = zh.wizard.exitBodyRules(n);
      expect(text, `exitBodyRules(${n}) 应说页面回到上次保存的收起设置`).toContain('收起设置');
      expect(text, `exitBodyRules(${n}) 不应提标签页`).not.toContain('标签页');
      expect(text, `exitBodyRules(${n}) 不应提标题`).not.toContain('标题');
      expect(text, `exitBodyRules(${n}) 不应提图标`).not.toContain('图标');
    }
  });

  it('中文：标题和图标流程的退出提示只说标签页，不提页面/收起设置', () => {
    const text = zh.wizard.exitBodyTitle;
    expect(text).toContain('标题和图标');
    expect(text).toContain('标签页');
    expect(text, '标题和图标流程没有动页面，不能提页面').not.toContain('页面');
    expect(text, '标题和图标流程没有动收起设置').not.toContain('收起设置');
  });

  it('英文：两条流程同样不串场', () => {
    for (const n of [0, 1, 3]) {
      const text = en.wizard.exitBodyRules(n);
      expect(text).toContain('hidden items');
      expect(text).not.toContain('title');
      expect(text).not.toContain('icon');
      expect(text).not.toContain('tab');
    }
    const title = en.wizard.exitBodyTitle;
    expect(title).toContain('title and icon');
    expect(title).toContain('tab');
    expect(title, '标题和图标流程没有动页面').not.toContain('page');
    expect(title, '标题和图标流程没有动收起设置').not.toContain('hidden items');
  });

  it('没有改动时仍用「这次还没有改过」的说明，不落进任何一条流程句', () => {
    expect(zh.wizard.exitBodyNoChanges).not.toMatch(/标签页|页面回到|收起设置/);
    expect(en.wizard.exitBodyNoChanges).not.toMatch(/tab|page|hidden items/i);
  });
});

describe('同一张卡的条件句同构（design-copy 二、f）', () => {
  it('中文：标题与图标字段都写「开关关着时」，不写「打开时」', () => {
    for (const key of ['titleIntro', 'iconIntro'] as const) {
      expect(zh.management[key], `${key} 应写开关关着时`).toContain('关着时');
      expect(zh.management[key], `${key} 不应写开关打开时`).not.toContain('打开时');
    }
  });

  it('英文：标题与图标字段都写 is off，不写 is on', () => {
    for (const key of ['titleIntro', 'iconIntro'] as const) {
      expect(en.management[key], `${key} 应写 is off`).toMatch(/is off/);
      expect(en.management[key], `${key} 不应写 is on`).not.toMatch(/is on/);
    }
  });
});

describe('弹窗面具卡的配置摘要（1.0.10）', () => {
  it('中文：标题和图标与收起项一起报，不再只报收起项', () => {
    expect(zh.common.switchSummary(true, 0)).toBe('已设置标题和图标 · 还没有收起设置');
    expect(zh.common.switchSummary(true, 2)).toBe('已设置标题和图标 · 2 项收起设置');
    expect(zh.common.switchSummary(false, 2)).toBe('还没有设置标题和图标 · 2 项收起设置');
  });

  it('英文：同样把两件事一起报，单复数正确', () => {
    expect(en.common.switchSummary(true, 0)).toBe('Title & icon set · Nothing set to hide');
    expect(en.common.switchSummary(true, 2)).toBe('Title & icon set · 2 items set to hide');
    expect(en.common.switchSummary(false, 1)).toBe('No title or icon set · 1 item set to hide');
  });

  it('三样全空时，说明同时给出原因与结果（胶囊说明框只有这一句）', () => {
    expect(zh.common.switchNoEffectHint).toContain('还没有设置标题、图标和收起内容');
    expect(zh.common.switchNoEffectHint).toContain('打开后页面不变');
    expect(en.common.switchNoEffectHint).toContain('No title, icon, or hidden content');
    expect(en.common.switchNoEffectHint).toContain('won’t change');
  });
});

describe('同一件事只用一个叫法（1.0.10 文案收口）', () => {
  it('入门页说「标签页标题」，不说「名字 / 样子」', () => {
    const text = zh.onboarding.steps[1]!.features[0]!;
    expect(text).toContain('标题');
    expect(text, '标题是文字，不是「样子」').not.toContain('样子');
    expect(text, '统一叫「标签页标题」，不叫「名字」').not.toContain('名字');
  });

  it('弹窗开关标签写会发生什么（显示悬浮按钮），不是东西的名字', () => {
    expect(zh.popup.showToggle).toBe('显示悬浮按钮');
    expect(en.popup.showToggle).toBe('Show the floating button');
  });

  it('站点设置页的「现在打开」提示中英都在，且点明开关名', () => {
    expect(zh.management.savedOffNotice).toContain('按你的设置显示');
    expect(zh.management.savedOffStay).not.toBe('');
    expect(zh.management.savedOffOpen).toBe('现在打开');
    expect(en.management.savedOffNotice).toContain('Show this site your way');
    expect(en.management.savedOffStay).not.toBe('');
    expect(en.management.savedOffOpen).not.toBe('');
  });
});
