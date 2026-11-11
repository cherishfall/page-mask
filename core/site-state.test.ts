/**
 * 空设置判据（#158）：三处主开关共用的「打开后页面不变」条件。
 *
 * 四种必须分清的情形（票里点名要覆盖）：
 * - 只有灰度 → 主开关管不到灰度，仍算空（说明要显示）
 * - 四项全空 → 空
 * - 只改过标题 / 只改过图标 → 不空（`titleIconSet` 在两种情况下都会置位）
 * - 有收起规则 → 不空
 */
import { describe, expect, it } from 'vitest';
import { hasSwitchEffect } from './site-state';
import type { HideRule, SiteProfile } from './types';

const rule: HideRule = {
  id: 'r1',
  elementName: '页头',
  candidates: ['#site-header'],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: 1,
  lastHealth: 'ok',
};

/** 一份「四项全空」的站点配置（字段与 sanitizeProfile 的产物一致） */
const empty = (over: Partial<SiteProfile> = {}): SiteProfile => ({
  formatVersion: 1,
  origin: 'https://example.com',
  switchState: 'original',
  disguisedTitle: null,
  icon: { kind: 'site' },
  hideRules: [],
  floatingBtnPos: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('hasSwitchEffect：主开关打开后页面会不会有变化（#158）', () => {
  it('四项全空 → false（打开开关零可见变化）', () => {
    expect(hasSwitchEffect(empty())).toBe(false);
  });

  it('只有整页变灰 → 仍是 false（灰度独立于主开关，ADR-0014）', () => {
    expect(hasSwitchEffect(empty({ mediaGray: true }))).toBe(false);
    // 反向说明这不是笔误：同一份配置加上一条收起规则就不再是「空设置」
    expect(hasSwitchEffect(empty({ mediaGray: true, hideRules: [rule] }))).toBe(true);
  });

  it('只改过标签页标题 → true', () => {
    expect(hasSwitchEffect(empty({ disguisedTitle: '阅读', titleIconSet: true }))).toBe(true);
    // 防御性口径：只有标题没有标记（历史数据）也算有
    expect(hasSwitchEffect(empty({ disguisedTitle: '阅读' }))).toBe(true);
  });

  it('只改过标签页图标 → true（只动图标时 titleIconSet 也置位）', () => {
    expect(hasSwitchEffect(empty({ icon: { kind: 'preset', id: 'doc' }, titleIconSet: true }))).toBe(true);
  });

  it('有收起规则 → true', () => {
    expect(hasSwitchEffect(empty({ hideRules: [rule] }))).toBe(true);
  });

  it('胶囊被关掉（capsuleHidden）不算设置：不影响判据', () => {
    expect(hasSwitchEffect(empty({ capsuleHidden: true }))).toBe(false);
  });
});
