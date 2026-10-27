import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentUiLanguage,
  DEFAULT_TITLE_EN,
  defaultTitleFor,
  effectiveTitle,
  QUICK_TITLES,
  quickTitleValue,
} from './titles';

describe('defaultTitleFor 按界面语言取默认标题', () => {
  it.each([
    ['zh-CN', '阅读'],
    ['zh-TW', '阅读'],
    ['zh-HK', '阅读'],
    ['zh', '阅读'],
    ['zh_CN', '阅读'],
    ['ZH-cn', '阅读'],
    ['en-US', 'Reading'],
    ['en', 'Reading'],
    ['ja', 'Reading'],
    ['', 'Reading'],
  ])('%s → %s', (lang, want) => {
    expect(defaultTitleFor(lang)).toBe(want);
  });
  it('非字符串按非中文处理', () => {
    expect(defaultTitleFor(undefined)).toBe('Reading');
    expect(defaultTitleFor(null)).toBe('Reading');
  });
});

describe('effectiveTitle 站点覆盖 > 全局设置 > 界面语言默认 > 常量', () => {
  it('站点覆盖优先', () => {
    expect(effectiveTitle({ disguisedTitle: '工作文档' }, { defaultTitle: '周报' }, 'zh-CN')).toBe('工作文档');
  });
  it('站点未覆盖用全局设置', () => {
    expect(effectiveTitle({ disguisedTitle: null }, { defaultTitle: '周报' }, 'en-US')).toBe('周报');
  });
  it('都没设置时按界面语言默认', () => {
    expect(effectiveTitle({ disguisedTitle: null }, { defaultTitle: null }, 'zh-CN')).toBe('阅读');
    expect(effectiveTitle({ disguisedTitle: null }, { defaultTitle: null }, 'en-US')).toBe('Reading');
  });
  it('空白 / 非字符串一律跳过，最终返回非空常量', () => {
    for (const bad of ['', '   ', '\t\n', 42, {}, [], undefined, null]) {
      const t = effectiveTitle({ disguisedTitle: bad }, { defaultTitle: bad }, undefined);
      expect(t).toBe(DEFAULT_TITLE_EN);
      expect(t.trim()).not.toBe('');
    }
    expect(effectiveTitle({ disguisedTitle: '  ' }, null, 'zh-TW')).toBe('阅读');
    expect(effectiveTitle({ disguisedTitle: '  ' }, undefined, 'xx')).toBe('Reading');
  });
});

describe('快捷标题', () => {
  it('至少包含 新建标签页/阅读/文档/笔记，中英各有填入值', () => {
    expect(QUICK_TITLES.map((q) => [q.zh, q.en])).toEqual(
      expect.arrayContaining([
        ['新建标签页', 'New Tab'],
        ['阅读', 'Reading'],
        ['文档', 'Document'],
        ['笔记', 'Notes'],
      ]),
    );
  });
  it('填入值按界面语言取', () => {
    const notes = QUICK_TITLES.find((q) => q.zh === '笔记')!;
    expect(quickTitleValue(notes, 'zh-CN')).toBe('笔记');
    expect(quickTitleValue(notes, 'zh-TW')).toBe('笔记');
    expect(quickTitleValue(notes, 'en-US')).toBe('Notes');
  });
});

describe('currentUiLanguage', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('优先用 chrome.i18n.getUILanguage()', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'zh-TW' } });
    expect(currentUiLanguage()).toBe('zh-TW');
  });
  it('拿不到时退回 navigator.language', () => {
    vi.stubGlobal('chrome', undefined);
    expect(currentUiLanguage()).toBe(navigator.language);
  });
});
