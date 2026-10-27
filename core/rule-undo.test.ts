import { describe, expect, it } from 'vitest';
import { detachRule, reattachRule, UNDO_MS } from './rule-undo';
import type { HideRule } from './types';

const rule = (id: string, name = `元素${id}`, strategy: HideRule['strategy'] = 'remove'): HideRule => ({
  id,
  elementName: name,
  candidates: [`#${id}`],
  strategy,
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: 1,
});

const ids = (rules: readonly HideRule[]) => rules.map((r) => r.id);

describe('detachRule', () => {
  it('删掉指定的那条，其余顺序不变，并记下原下标与名称', () => {
    const hit = detachRule([rule('a'), rule('b'), rule('c')], 'b');
    expect(hit).not.toBeNull();
    expect(ids(hit!.rules)).toEqual(['a', 'c']);
    expect(hit!.undo.index).toBe(1);
    expect(hit!.undo.name).toBe('元素b');
    expect(hit!.undo.rule.id).toBe('b');
  });

  it('找不到的 id 返回 null（别处已经删掉了）', () => {
    expect(detachRule([rule('a')], 'zzz')).toBeNull();
    expect(detachRule([], 'a')).toBeNull();
  });

  it('快照与被删对象不共享引用：改快照不影响存储里的数据，也不改原列表', () => {
    const rules = [rule('a', '页头'), rule('b')];
    const hit = detachRule(rules, 'a')!;
    hit.undo.rule.elementName = '改过的名字';
    hit.undo.rule.candidates.push('.x');
    expect(rules[0]!.elementName).toBe('页头');
    expect(rules[0]!.candidates).toEqual(['#a']);
  });

  it('不修改传入的列表', () => {
    const rules = [rule('a'), rule('b')];
    detachRule(rules, 'a');
    expect(ids(rules)).toEqual(['a', 'b']);
  });
});

describe('reattachRule', () => {
  it('按原下标插回，id 与内容不变', () => {
    const original = [rule('a'), rule('b', '侧栏', 'mask'), rule('c')];
    const hit = detachRule(original, 'b')!;
    const restored = reattachRule(hit.rules, hit.undo);
    expect(ids(restored)).toEqual(['a', 'b', 'c']);
    expect(restored[1]).toEqual(original[1]);
  });

  it('中间又删了几条：下标超出长度时放到末尾，不丢这条', () => {
    const hit = detachRule([rule('a'), rule('b'), rule('c')], 'c')!;
    const afterMoreDeletes = [rule('a')];
    expect(ids(reattachRule(afterMoreDeletes, hit.undo))).toEqual(['a', 'c']);
  });

  it('空列表也能插回', () => {
    const hit = detachRule([rule('only')], 'only')!;
    expect(ids(reattachRule([], hit.undo))).toEqual(['only']);
  });

  it('插回的是副本：之后改撤销快照不会影响已插回的列表', () => {
    const hit = detachRule([rule('a')], 'a')!;
    const restored = reattachRule([], hit.undo);
    hit.undo.rule.elementName = '后来改的';
    expect(restored[0]!.elementName).toBe('元素a');
  });
});

describe('UNDO_MS', () => {
  it('是 5 秒（票面与编辑面板的行为约定）', () => {
    expect(UNDO_MS).toBe(5000);
  });
});
