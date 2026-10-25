import { describe, expect, it } from 'vitest';
import { rulesApplicableAt, scopeLabel, scopeMatches } from './scope';
import type { HideRule } from './types';

const rule = (scope: HideRule['scope']): HideRule => ({
  id: 'r1',
  elementName: '测试元素',
  candidates: ['.x'],
  strategy: 'remove',
  scope,
  onlyThis: false,
  createdAt: 0,
});

describe('scopeMatches', () => {
  const url = 'https://weread.qq.com/web/reader/abc';
  it('整站默认命中', () => {
    expect(scopeMatches({ type: 'all' }, url)).toBe(true);
  });
  it('include：任一模式命中即可', () => {
    const scope: HideRule['scope'] = {
      type: 'include',
      patterns: [
        { label: 'a', prefix: 'https://weread.qq.com/web/reader/' },
        { label: 'b', prefix: 'https://weread.qq.com/web/note/' },
      ],
    };
    expect(scopeMatches(scope, url)).toBe(true);
    expect(scopeMatches(scope, 'https://weread.qq.com/web/shelf')).toBe(false);
  });
  it('exclude：命中任一则不生效', () => {
    const scope: HideRule['scope'] = {
      type: 'exclude',
      patterns: [{ label: 'a', prefix: 'https://weread.qq.com/web/reader/' }],
    };
    expect(scopeMatches(scope, url)).toBe(false);
    expect(scopeMatches(scope, 'https://weread.qq.com/web/shelf')).toBe(true);
  });
});

describe('rulesApplicableAt 只取范围内规则', () => {
  it('过滤范围外的规则', () => {
    const rules = [
      rule({ type: 'all' }),
      rule({ type: 'include', patterns: [{ label: '读者页', prefix: 'https://weread.qq.com/web/reader/' }] }),
      rule({ type: 'include', patterns: [{ label: '书架', prefix: 'https://weread.qq.com/web/shelf/' }] }),
    ];
    const at = rulesApplicableAt(rules, 'https://weread.qq.com/web/reader/abc');
    expect(at).toHaveLength(2);
  });
});

describe('scopeLabel', () => {
  it('人话展示', () => {
    expect(scopeLabel({ type: 'all' })).toBe('整站');
    expect(scopeLabel({ type: 'include', patterns: [{ label: '读者页', prefix: 'x' }] })).toBe('仅 读者页');
    expect(scopeLabel({ type: 'exclude', patterns: [{ label: '书架', prefix: 'x' }] })).toBe('除 书架 外');
  });
});
