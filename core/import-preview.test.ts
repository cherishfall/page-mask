import { describe, expect, it } from 'vitest';
import { importErrorText, previewReplace } from './import-preview';
import { INVALID_EXPORT_FILE } from './storage';
import { createEmptyProfile, type HideRule, type SiteProfile } from './types';

const rule = (id: string): HideRule => ({
  id,
  elementName: `元素${id}`,
  candidates: [`.${id}`],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: 1,
});
const profile = (origin: string, rules: number): SiteProfile => ({
  ...createEmptyProfile(origin, 1),
  hideRules: Array.from({ length: rules }, (_, i) => rule(`r${i}`)),
});
const bundleOf = (profiles: unknown[], extra: Record<string, unknown> = {}) => ({
  app: 'pagemask',
  formatVersion: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  profiles,
  ...extra,
});

describe('previewReplace', () => {
  const local = [profile('https://a.com', 2), profile('https://b.com', 3), profile('https://c.com', 1)];

  it('列出会被彻底移除的站点与规则数，以及文件里的站点与规则数', () => {
    const impact = previewReplace(local, bundleOf([profile('https://b.com', 1), profile('https://d.com', 4)]));
    expect(impact).toEqual({
      localSites: 3,
      localRules: 6,
      removedOrigins: ['https://a.com', 'https://c.com'],
      removedRules: 3,
      incomingSites: 2,
      incomingRules: 5,
      replacesSettings: false,
    });
  });

  it('文件带全局设置时提示默认标题也会被替换', () => {
    const impact = previewReplace(local, bundleOf([profile('https://a.com', 1)], { settings: { defaultTitle: 'x' } }));
    expect(impact?.replacesSettings).toBe(true);
  });

  it('跳过无效站点；文件无效或没有有效站点时返回 null', () => {
    expect(previewReplace(local, bundleOf([{ origin: 'nope' }, profile('https://a.com', 1)]))?.incomingSites).toBe(1);
    expect(previewReplace(local, bundleOf([{ origin: 'nope' }]))).toBeNull();
    expect(previewReplace(local, { app: 'other', formatVersion: 1, profiles: [] })).toBeNull();
    expect(previewReplace(local, bundleOf([profile('https://a.com', 1)], { formatVersion: 2 }))).toBeNull();
    expect(previewReplace(local, null)).toBeNull();
  });

  it('本机没有站点时影响为 0', () => {
    expect(previewReplace([], bundleOf([profile('https://a.com', 1)]))).toMatchObject({
      localSites: 0,
      localRules: 0,
      removedOrigins: [],
    });
  });
});

describe('importErrorText', () => {
  it('保留 storage 层关于文件内容的中文原因', () => {
    expect(importErrorText(new Error(INVALID_EXPORT_FILE))).toBe(`导入失败：${INVALID_EXPORT_FILE}`);
    expect(importErrorText(new Error('这个导出文件来自更新版本的 PageMask，请先升级后再导入'))).toContain('升级');
  });
  it('其它错误不暴露英文原文', () => {
    const text = importErrorText(new Error('QUOTA_BYTES quota exceeded'));
    expect(text).not.toMatch(/quota/i);
    expect(text).toMatch(/^导入失败：/);
    expect(importErrorText('x')).toMatch(/^导入失败：/);
  });
});
