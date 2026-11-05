import { describe, expect, it } from 'vitest';
import source from '../entrypoints/onboarding/App.vue?raw';

/**
 * 欢迎页的示意图必须是真实组件（#103）。
 * 0.5.5 之前是照着弹窗手搭的假图，弹窗改版后它立刻过期；这条测试守住「不再手抄」。
 */
describe('欢迎页复用真实界面（#103）', () => {
  it('弹窗与胶囊都来自真实组件', () => {
    expect(source).toContain("import PopupBody from '@/ui/popup/PopupBody.vue'");
    expect(source).toContain("import FloatingToggle from '@/ui/FloatingToggle.vue'");
    expect(source).toContain('<PopupBody');
    expect(source).toContain('<FloatingToggle');
  });

  it('不再自搭弹窗结构（旧假图的类名一个都不许回来）', () => {
    for (const legacy of ['ap-btn', 'ap-switch', 'ap-foot', 'ap-row']) {
      expect(source, `不该再出现手搭弹窗的 ${legacy}`).not.toContain(legacy);
    }
  });
});
