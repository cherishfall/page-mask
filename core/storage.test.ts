import { describe, expect, it } from 'vitest';
import { createPageMaskStorage, mergeProfiles, type KVArea } from './storage';
import { createEmptyProfile, type ExportBundle, type HideRule } from './types';

function memoryArea(): KVArea & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(keys) {
      const out: Record<string, unknown> = {};
      if (keys === null) {
        for (const [k, v] of data) out[k] = v;
      } else {
        for (const k of keys) if (data.has(k)) out[k] = data.get(k);
      }
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    async remove(keys) {
      for (const k of keys) data.delete(k);
    },
  };
}

const rule = (id: string, over: Partial<HideRule> = {}): HideRule => ({
  id,
  elementName: `元素${id}`,
  candidates: [`.${id}`],
  strategy: 'remove',
  scope: { type: 'all' },
  onlyThis: false,
  createdAt: 1,
  ...over,
});

describe('站点配置 CRUD', () => {
  it('增查改删与列表', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    expect(await store.getProfile('https://x.com')).toBeNull();

    const p = createEmptyProfile('https://x.com');
    p.hideRules.push(rule('r1'));
    await store.putProfile(p);

    const got = await store.getProfile('https://x.com')!;
    expect(got!.origin).toBe('https://x.com');
    expect(got!.hideRules).toHaveLength(1);

    const p2 = createEmptyProfile('https://y.com');
    await store.putProfile(p2);
    const list = await store.listProfiles();
    expect(list.map((x) => x.origin)).toEqual(['https://x.com', 'https://y.com']);

    await store.deleteProfile('https://x.com');
    expect(await store.getProfile('https://x.com')).toBeNull();
    expect((await store.listProfiles()).length).toBe(1);
  });

  it('设置读写带默认值合并', async () => {
    const store = createPageMaskStorage(memoryArea());
    expect((await store.getSettings()).defaultTitle).toBe('新建标签页');
    await store.putSettings({ defaultTitle: '工作文档' });
    expect((await store.getSettings()).defaultTitle).toBe('工作文档');
  });
});

describe('导出/导入', () => {
  it('导出结构带 app 标识与版本号（ADR-0004）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.putProfile(createEmptyProfile('https://x.com'));
    const bundle = await store.exportBundle();
    expect(bundle.app).toBe('pagemask');
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.profiles).toHaveLength(1);
  });

  it('非法文件报人话错误', async () => {
    const store = createPageMaskStorage(memoryArea());
    await expect(store.importBundle({} as ExportBundle)).rejects.toThrow('不是有效的');
  });

  it('默认合并：同源规则并集，冲突取导入方', async () => {
    const areaA = memoryArea();
    const local = createPageMaskStorage(areaA);
    const pLocal = createEmptyProfile('https://x.com');
    pLocal.hideRules = [rule('r1'), rule('r2', { elementName: '本地版' })];
    pLocal.updatedAt = 100;
    await local.putProfile(pLocal);

    const bundle: ExportBundle = {
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: [
        {
          ...createEmptyProfile('https://x.com'),
          hideRules: [rule('r2', { elementName: '导入版' }), rule('r3')],
          updatedAt: 50,
        },
        createEmptyProfile('https://new.com'),
      ],
    };
    const res = await local.importBundle(bundle, 'merge');
    expect(res.added).toBe(1);
    expect(res.updated).toBe(1);

    const merged = (await local.getProfile('https://x.com'))!;
    expect(merged.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
    expect(merged.hideRules.find((r) => r.id === 'r2')!.elementName).toBe('导入版');
  });

  it('整体替换：本地清空后只留导入内容', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.putProfile(createEmptyProfile('https://old.com'));
    const bundle: ExportBundle = {
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: [createEmptyProfile('https://new.com')],
    };
    await store.importBundle(bundle, 'replace');
    const list = await store.listProfiles();
    expect(list.map((p) => p.origin)).toEqual(['https://new.com']);
  });
});

describe('mergeProfiles 字段级取舍', () => {
  it('站点级字段取较新一方', () => {
    const older = { ...createEmptyProfile('https://x.com', 100), disguisedTitle: '旧标题' };
    const newer = { ...createEmptyProfile('https://x.com', 200), disguisedTitle: '新标题' };
    const merged = mergeProfiles(older, newer);
    expect(merged.disguisedTitle).toBe('新标题');
  });
});
