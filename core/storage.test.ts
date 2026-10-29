import { describe, expect, it } from 'vitest';
import { createPageMaskStorage, mergeProfiles, profileKey, SETTINGS_KEY, type KVArea } from './storage';
import { createEmptyProfile, type ExportBundle, type HideRule, type SiteProfile } from './types';

/** 假存储；delayMs > 0 时每次读写都让出事件循环，用来制造交错 */
function memoryArea(delayMs = 0): KVArea & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const tick = () => (delayMs > 0 ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve());
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T; // chrome.storage 读写都是结构化拷贝
  return {
    data,
    async get(keys) {
      await tick();
      const out: Record<string, unknown> = {};
      if (keys === null) {
        for (const [k, v] of data) out[k] = copy(v);
      } else {
        for (const k of keys) if (data.has(k)) out[k] = copy(data.get(k));
      }
      return out;
    },
    async set(items) {
      await tick();
      for (const [k, v] of Object.entries(items)) data.set(k, copy(v));
    },
    async remove(keys) {
      await tick();
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

/** 直接写入假存储（绕过校验，模拟已有数据或旧版脏数据） */
function seed(area: ReturnType<typeof memoryArea>, p: SiteProfile | Record<string, unknown>) {
  area.data.set(profileKey(String(p.origin)), JSON.parse(JSON.stringify(p)));
}

const bundleOf = (profiles: unknown[], extra: Record<string, unknown> = {}) => ({
  app: 'pagemask',
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  profiles,
  ...extra,
});

describe('站点配置 CRUD', () => {
  it('增查改删与列表', async () => {
    const store = createPageMaskStorage(memoryArea());
    expect(await store.getProfile('https://x.com')).toBeNull();
    await store.updateProfile('https://x.com', (p) => void p.hideRules.push(rule('r1')), { create: true });
    const got = await store.getProfile('https://x.com');
    expect(got!.origin).toBe('https://x.com');
    expect(got!.hideRules).toHaveLength(1);
    await store.updateProfile('https://y.com', () => false, { create: true });
    const list = await store.listProfiles();
    expect(list.map((x) => x.origin)).toEqual(['https://x.com', 'https://y.com']);
    await store.deleteProfile('https://x.com');
    expect(await store.getProfile('https://x.com')).toBeNull();
    expect((await store.listProfiles()).length).toBe(1);
  });

  it('站点不存在且未要求新建时不写入（一键清空后不复活）', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    const res = await store.updateProfile('https://x.com', (p) => void (p.switchState = 'disguised'));
    expect(res).toBeNull();
    expect(area.data.size).toBe(0);
  });

  it('非法 origin 拒绝写入', async () => {
    const store = createPageMaskStorage(memoryArea());
    await expect(store.updateProfile('javascript:alert(1)', () => undefined, { create: true })).rejects.toThrow();
  });

  it('设置读写：没设置 / 类型不对 / 空白一律为 null（跟随界面语言默认），按 schema 读取', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    expect((await store.getSettings()).defaultTitle).toBeNull();
    await store.putSettings({ defaultTitle: '工作文档' });
    expect((await store.getSettings()).defaultTitle).toBe('工作文档');
    await store.putSettings({ defaultTitle: '   ' });
    expect((await store.getSettings()).defaultTitle).toBeNull();
    area.data.set(SETTINGS_KEY, { defaultTitle: 42 });
    expect((await store.getSettings()).defaultTitle).toBeNull();
    area.data.set(SETTINGS_KEY, { defaultTitle: '   ' });
    expect((await store.getSettings()).defaultTitle).toBeNull();
    area.data.set(SETTINGS_KEY, 'garbage');
    expect((await store.getSettings()).defaultTitle).toBeNull();
  });

  it('0.1.0 旧数据迁移：无版本标记且等于旧默认「新建标签页」视为没设置；0.2.0 写入的不受影响', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    area.data.set(SETTINGS_KEY, { defaultTitle: '新建标签页' }); // 0.1.0 写入的形状
    expect((await store.getSettings()).defaultTitle).toBeNull();
    area.data.set(SETTINGS_KEY, { defaultTitle: '周报' }); // 0.1.0 用户自定义的值保留
    expect((await store.getSettings()).defaultTitle).toBe('周报');
    await store.putSettings({ defaultTitle: '新建标签页' }); // 0.2.0 用户主动选的快捷标题
    expect(area.data.get(SETTINGS_KEY)).toEqual({ defaultTitle: '新建标签页', curtainBtnPos: null, settingsVersion: 2 });
    expect((await store.getSettings()).defaultTitle).toBe('新建标签页');
    expect((await store.exportBundle()).settings).toEqual({ defaultTitle: '新建标签页', curtainBtnPos: null }); // 版本标记不进导出文件
  });

  it('导入文件里的「新建标签页」按用户设置保留（导出文件 0.2.0 起才带设置，无旧值问题）', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    await store.importBundle(
      bundleOf([createEmptyProfile('https://a.com')], { settings: { defaultTitle: '新建标签页' } }),
      'replace',
    );
    expect((await store.getSettings()).defaultTitle).toBe('新建标签页');
  });

  it('读取时丢弃畸形规则，不让下游崩溃', async () => {
    const area = memoryArea();
    const p = createEmptyProfile('https://x.com');
    seed(area, { ...p, hideRules: [rule('ok'), { ...rule('bad'), scope: { type: 'include' } }] });
    const got = await createPageMaskStorage(area).getProfile('https://x.com');
    expect(got!.hideRules.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('原子更新（S2：不丢更新）', () => {
  it('并发交错修改开关与规则，两者都保留', async () => {
    const area = memoryArea(2);
    seed(area, createEmptyProfile('https://x.com'));
    // 两个独立实例（模拟同一上下文里 popup 逻辑与编辑面板各自 new 的 storage）
    const a = createPageMaskStorage(area);
    const b = createPageMaskStorage(area);
    await Promise.all([
      a.updateProfile('https://x.com', (p) => void (p.switchState = 'disguised')),
      b.updateProfile('https://x.com', (p) => void p.hideRules.push(rule('r1'))),
      a.updateProfile('https://x.com', (p) => void p.hideRules.push(rule('r2'))),
      b.updateProfile('https://x.com', (p) => void (p.disguisedTitle = '文档')),
    ]);
    const got = (await a.getProfile('https://x.com'))!;
    expect(got.switchState).toBe('disguised');
    expect(got.disguisedTitle).toBe('文档');
    expect(got.hideRules.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('体检回写不覆盖开关，也不刷新用户修改时间', async () => {
    const area = memoryArea(1);
    seed(area, { ...createEmptyProfile('https://x.com', 100), switchState: 'disguised', hideRules: [rule('r1')] });
    const page = createPageMaskStorage(area);
    const popup = createPageMaskStorage(area);
    // 页面拿着旧副本（伪装态）做体检；与此同时 popup 把开关切回原样
    const stale = (await page.getProfile('https://x.com'))!;
    await Promise.all([
      popup.updateProfile('https://x.com', (p) => void (p.switchState = 'original')),
      page.updateRuleHealth('https://x.com', stale.hideRules.map((r) => ({ id: r.id, status: 'stale' as const })), 500),
    ]);
    const got = (await page.getProfile('https://x.com'))!;
    expect(got.switchState).toBe('original');
    expect(got.hideRules[0]!.lastHealth).toBe('stale');
    expect(got.hideRules[0]!.lastHealthAt).toBe(500);

    const before = got.updatedAt;
    await page.updateRuleHealth('https://x.com', [{ id: 'r1', status: 'ok' }], 600);
    expect((await page.getProfile('https://x.com'))!.updatedAt).toBe(before);
  });

  it('体检结果没变化时不写入', async () => {
    const area = memoryArea();
    seed(area, { ...createEmptyProfile('https://x.com'), hideRules: [rule('r1', { lastHealth: 'ok' })] });
    let writes = 0;
    const counting: KVArea = { ...area, set: async (items) => (writes++, area.set(items)) };
    await createPageMaskStorage(counting).updateRuleHealth('https://x.com', [{ id: 'r1', status: 'ok' }]);
    expect(writes).toBe(0);
  });

  it('悬浮按钮坐标写入不刷新用户修改时间', async () => {
    const area = memoryArea();
    seed(area, createEmptyProfile('https://x.com', 100));
    const store = createPageMaskStorage(area);
    await store.updateProfile('https://x.com', (p) => void (p.floatingBtnPos = { x: 1, y: 2 }), { touch: false });
    const got = (await store.getProfile('https://x.com'))!;
    expect(got.floatingBtnPos).toEqual({ x: 1, y: 2 });
    expect(got.updatedAt).toBe(100);
  });

  it('写入前统一校验：危险候选与远程图标不会落库', async () => {
    const store = createPageMaskStorage(memoryArea());
    const got = await store.updateProfile(
      'https://x.com',
      (p) => {
        p.hideRules.push(rule('r1', { candidates: ['x{} body{background:url(https://a)}', '#ok'] }));
        p.faviconDataUrl = 'https://evil.example/icon.png';
      },
      { create: true },
    );
    expect(got!.hideRules[0]!.candidates).toEqual(['#ok']);
    expect(got!.faviconDataUrl).toBeNull();
  });
});

describe('导出/导入', () => {
  it('导出结构带 app 标识、版本号与全局设置（ADR-0004）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.updateProfile('https://x.com', () => false, { create: true });
    await store.putSettings({ defaultTitle: '周报' });
    const bundle = await store.exportBundle();
    expect(bundle.app).toBe('pagemask');
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.profiles).toHaveLength(1);
    expect(bundle.settings).toEqual({ defaultTitle: '周报', curtainBtnPos: null });
  });

  it('非法文件报人话错误（用"导出文件"一词）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await expect(store.importBundle({})).rejects.toThrow('不是有效的 PageMask 导出文件');
    await expect(store.importBundle(null)).rejects.toThrow('不是有效的 PageMask 导出文件');
    await expect(store.importBundle(bundleOf([createEmptyProfile('https://a.com')], { app: 'other' }))).rejects.toThrow(
      '不是有效的 PageMask 导出文件',
    );
  });

  it('拒绝未知 formatVersion', async () => {
    const store = createPageMaskStorage(memoryArea());
    const p = createEmptyProfile('https://a.com');
    await expect(store.importBundle(bundleOf([p], { formatVersion: 2 }))).rejects.toThrow('更新版本');
    await expect(store.importBundle(bundleOf([p], { formatVersion: '1' }))).rejects.toThrow('不是有效的');
  });

  it('全无效的文件做「整体替换」后本地数据原样保留', async () => {
    const area = memoryArea();
    const local = { ...createEmptyProfile('https://old.com', 100), hideRules: [rule('r1')] };
    seed(area, local);
    area.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const snapshot = JSON.stringify([...area.data]);
    const store = createPageMaskStorage(area);
    const bundle = bundleOf([
      { ...createEmptyProfile('https://new.com'), origin: 'javascript:alert(1)' },
      { ...createEmptyProfile('https://new.com'), formatVersion: 9 },
      { ...createEmptyProfile('https://new.com'), hideRules: 'nope' },
      'garbage',
    ]);
    await expect(store.importBundle(bundle, 'replace')).rejects.toThrow('本地数据没有改动');
    expect(JSON.stringify([...area.data])).toBe(snapshot);
  });

  it('整体替换：只留导入内容，导入的全局设置生效，结果如实报告', async () => {
    const area = memoryArea();
    seed(area, createEmptyProfile('https://old.com'));
    seed(area, { ...createEmptyProfile('https://keep.com'), floatingBtnPos: { x: 5, y: 6 } });
    area.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const store = createPageMaskStorage(area);
    const res = await store.importBundle(
      bundleOf(
        [
          createEmptyProfile('https://new.com'),
          { ...createEmptyProfile('https://keep.com'), floatingBtnPos: { x: 900, y: 900 } },
          { ...createEmptyProfile('https://bad.com'), origin: 'https://bad.com/path' },
        ],
        { settings: { defaultTitle: '导入标题' } },
      ),
      'replace',
    );
    expect(res).toMatchObject({ added: 1, updated: 1, removed: 1, skipped: 1, mode: 'replace' });
    const list = await store.listProfiles();
    expect(list.map((p) => p.origin)).toEqual(['https://keep.com', 'https://new.com']);
    expect(list[0]!.floatingBtnPos).toEqual({ x: 5, y: 6 }); // 坐标保留本机
    expect((await store.getSettings()).defaultTitle).toBe('导入标题');
  });

  it('默认合并：同源规则并集，冲突取导入方；新站点不带外来坐标；跳过计数', async () => {
    const area = memoryArea();
    seed(area, {
      ...createEmptyProfile('https://x.com'),
      hideRules: [rule('r1'), rule('r2', { elementName: '本地版' })],
      updatedAt: 100,
      floatingBtnPos: { x: 1, y: 1 },
    });
    const store = createPageMaskStorage(area);
    const bundle = bundleOf([
      {
        ...createEmptyProfile('https://x.com'),
        hideRules: [rule('r2', { elementName: '导入版' }), rule('r3'), { ...rule('r4'), strategy: 'explode' }],
        updatedAt: 50,
        floatingBtnPos: { x: 999, y: 999 },
      },
      { ...createEmptyProfile('https://new.com'), floatingBtnPos: { x: 7, y: 7 } },
      { formatVersion: 1, origin: 'ftp://x.com', hideRules: [] },
    ]);
    const res = await store.importBundle(bundle as unknown as ExportBundle, 'merge');
    expect(res).toMatchObject({ added: 1, updated: 1, removed: 0, skipped: 1, skippedRules: 1 });
    const merged = (await store.getProfile('https://x.com'))!;
    expect(merged.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
    expect(merged.hideRules.find((r) => r.id === 'r2')!.elementName).toBe('导入版');
    expect(merged.floatingBtnPos).toEqual({ x: 1, y: 1 });
    expect((await store.getProfile('https://new.com'))!.floatingBtnPos).toBeNull();
  });

  it('合并：本地已设置的全局设置保留；本地未设置时采用导入值', async () => {
    const p = createEmptyProfile('https://a.com');
    const withLocal = memoryArea();
    withLocal.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const s1 = createPageMaskStorage(withLocal);
    await s1.importBundle(bundleOf([p], { settings: { defaultTitle: '导入标题' } }));
    expect((await s1.getSettings()).defaultTitle).toBe('本地标题');

    const s2 = createPageMaskStorage(memoryArea());
    await s2.importBundle(bundleOf([p], { settings: { defaultTitle: '导入标题' } }));
    expect((await s2.getSettings()).defaultTitle).toBe('导入标题');
  });

  it('导入时剔除危险候选与远程图标', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.importBundle(
      bundleOf([
        {
          ...createEmptyProfile('https://a.com'),
          faviconDataUrl: 'https://evil.example/x.png',
          hideRules: [rule('r1', { candidates: ['a;b', '@import url(x)', '.ok'] }), rule('r2', { candidates: ['a{'] })],
        },
      ]),
    );
    const got = (await store.getProfile('https://a.com'))!;
    expect(got.faviconDataUrl).toBeNull();
    expect(got.hideRules.map((r) => [r.id, r.candidates])).toEqual([['r1', ['.ok']]]);
  });
});

describe('「遮住」按钮的全局位置（#50，本机界面状态）', () => {
  it('读写：默认 null（右下角），写回后能读回，清空回到 null', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    expect((await store.getSettings()).curtainBtnPos).toBeNull();
    await store.setCurtainBtnPos({ x: 120, y: 340 });
    expect((await store.getSettings()).curtainBtnPos).toEqual({ x: 120, y: 340 });
    await store.setCurtainBtnPos(null);
    expect((await store.getSettings()).curtainBtnPos).toBeNull();
  });

  it('改全局默认标题不会把「遮住」按钮的位置冲掉（putSettings 只改传进来的字段）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.setCurtainBtnPos({ x: 24, y: 560 });
    await store.putSettings({ defaultTitle: '周报' });
    expect(await store.getSettings()).toEqual({ defaultTitle: '周报', curtainBtnPos: { x: 24, y: 560 } });
  });

  it('导入保留本机位置：合并与整体替换都不会被导出文件里的坐标覆盖', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    await store.setCurtainBtnPos({ x: 10, y: 20 });
    const file = bundleOf([createEmptyProfile('https://a.com')], {
      settings: { defaultTitle: '导入标题', curtainBtnPos: { x: 900, y: 800 } },
    });
    await store.importBundle(file, 'merge');
    expect((await store.getSettings()).curtainBtnPos).toEqual({ x: 10, y: 20 });
    await store.importBundle(file, 'replace');
    expect((await store.getSettings()).curtainBtnPos).toEqual({ x: 10, y: 20 });
    expect((await store.getSettings()).defaultTitle).toBe('导入标题');
  });

  it('本机还没有位置时导入也不会写入外来坐标（屏幕相关，不跨电脑）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.importBundle(
      bundleOf([createEmptyProfile('https://a.com')], {
        settings: { defaultTitle: '导入标题', curtainBtnPos: { x: 900, y: 800 } },
      }),
      'replace',
    );
    expect((await store.getSettings()).curtainBtnPos).toBeNull();
  });

  it('坏数据：奇形怪状的坐标一律视为没记录', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    for (const bad of [{ x: 'a', y: 1 }, { x: 1 }, 'garbage', [1, 2]]) {
      area.data.set(SETTINGS_KEY, { curtainBtnPos: bad });
      expect((await store.getSettings()).curtainBtnPos).toBeNull();
    }
  });
});

describe('mergeProfiles 字段级取舍', () => {
  it('站点级字段取用户修改时间较新一方，坐标保留本地', () => {
    const older = { ...createEmptyProfile('https://x.com', 100), disguisedTitle: '旧标题', floatingBtnPos: { x: 1, y: 2 } };
    const newer = { ...createEmptyProfile('https://x.com', 200), disguisedTitle: '新标题', floatingBtnPos: { x: 9, y: 9 } };
    const merged = mergeProfiles(older, newer);
    expect(merged.disguisedTitle).toBe('新标题');
    expect(merged.floatingBtnPos).toEqual({ x: 1, y: 2 });
    expect(merged.updatedAt).toBe(200);
  });
});
