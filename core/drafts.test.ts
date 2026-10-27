import { describe, expect, it } from 'vitest';
import { syncDrafts } from './drafts';

describe('syncDrafts', () => {
  const drafts = { a: '我正在输入', b: '旧值 b' };
  const stored = { a: '存储里的 a', b: '新值 b', c: '新站点 c' };

  it('正在编辑的字段保留草稿，其余换成存储值', () => {
    expect(syncDrafts(drafts, stored, (k) => k === 'a')).toEqual({ a: '我正在输入', b: '新值 b', c: '新站点 c' });
  });

  it('没有在编辑时全部跟随存储', () => {
    expect(syncDrafts(drafts, stored, () => false)).toEqual(stored);
  });

  it('站点被删除后丢弃其草稿，即使正在编辑', () => {
    expect(syncDrafts(drafts, { b: 'x' }, () => true)).toEqual({ b: '旧值 b' });
  });

  it('正在编辑但还没有草稿的新字段取存储值', () => {
    expect(syncDrafts({}, { c: 'c' }, () => true)).toEqual({ c: 'c' });
  });

  it('不修改传入对象', () => {
    const d = { a: '1' };
    syncDrafts(d, { a: '2' }, () => false);
    expect(d).toEqual({ a: '1' });
  });
});
