import { describe, expect, it } from 'vitest';
import { createPageMaskStorage, mergeProfiles, profileKey, SETTINGS_KEY, type KVArea } from './storage';
import { createEmptyProfile, type ExportBundle, type HideRule, type SiteProfile } from './types';
import { t } from './i18n';

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

describe('站点 key 与懒迁移（#162）', () => {
  it('旧 key（含 ://）按站点归并成一条、删旧 key，幂等', async () => {
    const area = memoryArea();
    area.data.set(
      'profile:https://weibo.com',
      { ...createEmptyProfile('https://weibo.com', 100), hideRules: [rule('r1')], updatedAt: 100 },
    );
    area.data.set(
      'profile:https://s.weibo.com',
      {
        ...createEmptyProfile('https://s.weibo.com', 50),
        hideRules: [rule('r2')],
        disguisedTitle: '微博',
        updatedAt: 200,
      },
    );
    let writes = 0;
    const counting: KVArea = {
      ...area,
      set: async (items) => (writes++, area.set(items)),
      remove: async (keys) => (writes++, area.remove(keys)),
    };
    const store = createPageMaskStorage(counting);
    const list = await store.listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0]!.origin).toBe('weibo.com');
    expect(list[0]!.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    expect(list[0]!.disguisedTitle).toBe('微博'); // 站点级字段取较新一方
    expect([...area.data.keys()]).toEqual(['profile:weibo.com']);
    expect(writes).toBe(2); // 一次 set + 一次 remove

    // 幂等：再读不再写
    await store.listProfiles();
    await store.getProfile('weibo.com');
    expect(writes).toBe(2);
  });

  it('迁移后旧配置可读可写；updateProfile 接受旧 origin 作兜底', async () => {
    const area = memoryArea();
    area.data.set('profile:https://x.com', createEmptyProfile('https://x.com', 100));
    const store = createPageMaskStorage(area);
    expect((await store.getProfile('x.com'))!.origin).toBe('x.com');
    await store.updateProfile('https://x.com', (p) => void (p.disguisedTitle = '阅读'));
    expect((await store.getProfile('x.com'))!.disguisedTitle).toBe('阅读');
    expect(area.data.has('profile:https://x.com')).toBe(false);
  });

  it('导入：同一份文件里裸域与子域归并成一条', async () => {
    const store = createPageMaskStorage(memoryArea());
    const bundle = bundleOf([
      { ...createEmptyProfile('https://weibo.com'), hideRules: [rule('r1')], updatedAt: 100 },
      { ...createEmptyProfile('https://s.weibo.com'), hideRules: [rule('r2')], updatedAt: 200 },
    ]);
    const res = await store.importBundle(bundle, 'merge');
    expect(res.added).toBe(1);
    expect(res.updated).toBe(0);
    const list = await store.listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0]!.origin).toBe('weibo.com');
    expect(list[0]!.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('导入：旧 v1 导出文件（origin 是 https://…）照常可读', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.importBundle(bundleOf([{ ...createEmptyProfile('https://reader.example'), hideRules: [rule('r1')] }]));
    const p = await store.getProfile('reader.example');
    expect(p).not.toBeNull();
    expect(p!.origin).toBe('reader.example');
    expect(p!.hideRules).toHaveLength(1);
  });
});

describe('站点配置 CRUD', () => {
  it('增查改删与列表', async () => {
    const store = createPageMaskStorage(memoryArea());
    expect(await store.getProfile('x.com')).toBeNull();
    await store.updateProfile('x.com', (p) => void p.hideRules.push(rule('r1')), { create: true });
    const got = await store.getProfile('x.com');
    expect(got!.origin).toBe('x.com');
    expect(got!.hideRules).toHaveLength(1);
    await store.updateProfile('y.com', () => false, { create: true });
    const list = await store.listProfiles();
    expect(list.map((x) => x.origin)).toEqual(['x.com', 'y.com']);
    await store.deleteProfile('x.com');
    expect(await store.getProfile('x.com')).toBeNull();
    expect((await store.listProfiles()).length).toBe(1);
  });

  it('站点不存在且未要求新建时不写入（一键清空后不复活）', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    const res = await store.updateProfile('x.com', (p) => void (p.switchState = 'disguised'));
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
    expect(area.data.get(SETTINGS_KEY)).toEqual({
      defaultTitle: '新建标签页',
      curtainBtnPos: null,
      uiLanguage: 'auto',
      toggleOpacity: 1,
      settingsVersion: 2,
    });
    expect((await store.getSettings()).defaultTitle).toBe('新建标签页');
    expect((await store.exportBundle()).settings).toEqual({
      defaultTitle: '新建标签页',
      curtainBtnPos: null,
      uiLanguage: 'auto',
      toggleOpacity: 1,
    }); // 版本标记不进导出文件
  });

  it('导入文件里的「新建标签页」按用户设置保留（导出文件 0.2.0 起才带设置，无旧值问题）', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    await store.importBundle(
      bundleOf([createEmptyProfile('a.com')], { settings: { defaultTitle: '新建标签页' } }),
      'replace',
    );
    expect((await store.getSettings()).defaultTitle).toBe('新建标签页');
  });

  it('读取时丢弃畸形规则，不让下游崩溃', async () => {
    const area = memoryArea();
    const p = createEmptyProfile('x.com');
    seed(area, { ...p, hideRules: [rule('ok'), { ...rule('bad'), scope: { type: 'include' } }] });
    const got = await createPageMaskStorage(area).getProfile('x.com');
    expect(got!.hideRules.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('原子更新（S2：不丢更新）', () => {
  it('并发交错修改开关与规则，两者都保留', async () => {
    const area = memoryArea(2);
    seed(area, createEmptyProfile('x.com'));
    // 两个独立实例（模拟同一上下文里 popup 逻辑与编辑面板各自 new 的 storage）
    const a = createPageMaskStorage(area);
    const b = createPageMaskStorage(area);
    await Promise.all([
      a.updateProfile('x.com', (p) => void (p.switchState = 'disguised')),
      b.updateProfile('x.com', (p) => void p.hideRules.push(rule('r1'))),
      a.updateProfile('x.com', (p) => void p.hideRules.push(rule('r2'))),
      b.updateProfile('x.com', (p) => void (p.disguisedTitle = '文档')),
    ]);
    const got = (await a.getProfile('x.com'))!;
    expect(got.switchState).toBe('disguised');
    expect(got.disguisedTitle).toBe('文档');
    expect(got.hideRules.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('体检回写不覆盖开关，也不刷新用户修改时间', async () => {
    const area = memoryArea(1);
    seed(area, { ...createEmptyProfile('x.com', 100), switchState: 'disguised', hideRules: [rule('r1')] });
    const page = createPageMaskStorage(area);
    const popup = createPageMaskStorage(area);
    // 页面拿着旧副本（伪装态）做体检；与此同时 popup 把开关切回原样
    const stale = (await page.getProfile('x.com'))!;
    await Promise.all([
      popup.updateProfile('x.com', (p) => void (p.switchState = 'original')),
      page.updateRuleHealth('x.com', stale.hideRules.map((r) => ({ id: r.id, status: 'stale' as const })), 500),
    ]);
    const got = (await page.getProfile('x.com'))!;
    expect(got.switchState).toBe('original');
    expect(got.hideRules[0]!.lastHealth).toBe('stale');
    expect(got.hideRules[0]!.lastHealthAt).toBe(500);

    const before = got.updatedAt;
    await page.updateRuleHealth('x.com', [{ id: 'r1', status: 'ok' }], 600);
    expect((await page.getProfile('x.com'))!.updatedAt).toBe(before);
  });

  it('体检结果没变化时不写入', async () => {
    const area = memoryArea();
    seed(area, { ...createEmptyProfile('x.com'), hideRules: [rule('r1', { lastHealth: 'ok' })] });
    let writes = 0;
    const counting: KVArea = { ...area, set: async (items) => (writes++, area.set(items)) };
    await createPageMaskStorage(counting).updateRuleHealth('x.com', [{ id: 'r1', status: 'ok' }]);
    expect(writes).toBe(0);
  });

  it('悬浮按钮坐标写入不刷新用户修改时间', async () => {
    const area = memoryArea();
    seed(area, createEmptyProfile('x.com', 100));
    const store = createPageMaskStorage(area);
    await store.updateProfile('x.com', (p) => void (p.floatingBtnPos = { x: 1, y: 2 }), { touch: false });
    const got = (await store.getProfile('x.com'))!;
    expect(got.floatingBtnPos).toEqual({ x: 1, y: 2 });
    expect(got.updatedAt).toBe(100);
  });

  it('capsuleHidden 写入不刷新用户修改时间（#111，本机界面状态，不参与较新一方合并）', async () => {
    const area = memoryArea();
    seed(area, createEmptyProfile('x.com', 100));
    const store = createPageMaskStorage(area);
    await store.updateProfile('x.com', (p) => void (p.capsuleHidden = true), { touch: false });
    const got = (await store.getProfile('x.com'))!;
    expect(got.capsuleHidden).toBe(true);
    expect(got.updatedAt).toBe(100);
  });

  it('写入前统一校验：危险候选与不认识的图标编号不会落库', async () => {
    const store = createPageMaskStorage(memoryArea());
    const got = await store.updateProfile(
      'x.com',
      (p) => {
        p.hideRules.push(rule('r1', { candidates: ['x{} body{background:url(https://a)}', '#ok'] }));
        p.icon = { kind: 'preset', id: 'unknown' } as unknown as typeof p.icon;
      },
      { create: true },
    );
    expect(got!.hideRules[0]!.candidates).toEqual(['#ok']);
    expect(got!.icon).toEqual({ kind: 'none' });
  });
});

describe('导出/导入', () => {
  it('导出结构带 app 标识、版本号与全局设置（ADR-0004）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.updateProfile('x.com', () => false, { create: true });
    await store.putSettings({ defaultTitle: '周报' });
    const bundle = await store.exportBundle();
    expect(bundle.app).toBe('pagemask');
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.profiles).toHaveLength(1);
    expect(bundle.settings).toEqual({ defaultTitle: '周报', curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });
  });

  it('非法文件报人话错误（用"导出文件"一词）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await expect(store.importBundle({})).rejects.toThrow(t().errors.invalidExportFile);
    await expect(store.importBundle(null)).rejects.toThrow(t().errors.invalidExportFile);
    await expect(store.importBundle(bundleOf([createEmptyProfile('a.com')], { app: 'other' }))).rejects.toThrow(
      t().errors.invalidExportFile,
    );
  });

  it('拒绝未知 formatVersion', async () => {
    const store = createPageMaskStorage(memoryArea());
    const p = createEmptyProfile('a.com');
    await expect(store.importBundle(bundleOf([p], { formatVersion: 2 }))).rejects.toThrow('更新版本');
    await expect(store.importBundle(bundleOf([p], { formatVersion: '1' }))).rejects.toThrow(t().errors.invalidExportFile);
  });

  it('全无效的文件做「整体替换」后本地数据原样保留', async () => {
    const area = memoryArea();
    const local = { ...createEmptyProfile('old.com', 100), hideRules: [rule('r1')] };
    seed(area, local);
    area.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const snapshot = JSON.stringify([...area.data]);
    const store = createPageMaskStorage(area);
    const bundle = bundleOf([
      { ...createEmptyProfile('new.com'), origin: 'javascript:alert(1)' },
      { ...createEmptyProfile('new.com'), formatVersion: 9 },
      { ...createEmptyProfile('new.com'), hideRules: 'nope' },
      'garbage',
    ]);
    await expect(store.importBundle(bundle, 'replace')).rejects.toThrow('没有改动');
    expect(JSON.stringify([...area.data])).toBe(snapshot);
  });

  it('整体替换：只留导入内容，导入的全局设置生效，结果如实报告', async () => {
    const area = memoryArea();
    seed(area, createEmptyProfile('old.com'));
    seed(area, { ...createEmptyProfile('keep.com'), floatingBtnPos: { x: 5, y: 6 } });
    area.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const store = createPageMaskStorage(area);
    const res = await store.importBundle(
      bundleOf(
        [
          createEmptyProfile('new.com'),
          { ...createEmptyProfile('keep.com'), floatingBtnPos: { x: 900, y: 900 } },
          { ...createEmptyProfile('bad.com'), origin: 'bad.com/path' },
        ],
        { settings: { defaultTitle: '导入标题' } },
      ),
      'replace',
    );
    expect(res).toMatchObject({ added: 1, updated: 1, removed: 1, skipped: 1, mode: 'replace' });
    const list = await store.listProfiles();
    expect(list.map((p) => p.origin)).toEqual(['keep.com', 'new.com']);
    expect(list[0]!.floatingBtnPos).toEqual({ x: 5, y: 6 }); // 坐标保留本机
    expect((await store.getSettings()).defaultTitle).toBe('导入标题');
  });

  it('默认合并：同源规则并集，冲突取导入方；新站点不带外来坐标；跳过计数', async () => {
    const area = memoryArea();
    seed(area, {
      ...createEmptyProfile('x.com'),
      hideRules: [rule('r1'), rule('r2', { elementName: '本地版' })],
      updatedAt: 100,
      floatingBtnPos: { x: 1, y: 1 },
    });
    const store = createPageMaskStorage(area);
    const bundle = bundleOf([
      {
        ...createEmptyProfile('x.com'),
        hideRules: [rule('r2', { elementName: '导入版' }), rule('r3'), { ...rule('r4'), strategy: 'explode' }],
        updatedAt: 50,
        floatingBtnPos: { x: 999, y: 999 },
      },
      { ...createEmptyProfile('new.com'), floatingBtnPos: { x: 7, y: 7 } },
      { formatVersion: 1, origin: 'ftp://x.com', hideRules: [] },
    ]);
    const res = await store.importBundle(bundle as unknown as ExportBundle, 'merge');
    expect(res).toMatchObject({ added: 1, updated: 1, removed: 0, skipped: 1, skippedRules: 1 });
    const merged = (await store.getProfile('x.com'))!;
    expect(merged.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
    expect(merged.hideRules.find((r) => r.id === 'r2')!.elementName).toBe('导入版');
    expect(merged.floatingBtnPos).toEqual({ x: 1, y: 1 });
    expect((await store.getProfile('new.com'))!.floatingBtnPos).toBeNull();
  });

  it('capsuleHidden 随 profile 管线走（#111）：导入带隐藏标记的文件保留，旧文件导入 = 显示', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    const bundle = bundleOf([
      { ...createEmptyProfile('hidden.com'), capsuleHidden: true },
      createEmptyProfile('shown.com'),
    ]);
    await store.importBundle(bundle as unknown as ExportBundle, 'merge');
    expect((await store.getProfile('hidden.com'))?.capsuleHidden).toBe(true);
    expect('capsuleHidden' in ((await store.getProfile('shown.com')) ?? {})).toBe(false);
    // 坏值不落字段
    await store.importBundle(bundleOf([{ ...createEmptyProfile('bad.com'), capsuleHidden: 'yes' }]) as unknown as ExportBundle, 'merge');
    expect('capsuleHidden' in ((await store.getProfile('bad.com')) ?? {})).toBe(false);
  });

  it('合并：本地已设置的全局设置保留；本地未设置时采用导入值', async () => {
    const p = createEmptyProfile('a.com');
    const withLocal = memoryArea();
    withLocal.data.set(SETTINGS_KEY, { defaultTitle: '本地标题' });
    const s1 = createPageMaskStorage(withLocal);
    await s1.importBundle(bundleOf([p], { settings: { defaultTitle: '导入标题' } }));
    expect((await s1.getSettings()).defaultTitle).toBe('本地标题');

    const s2 = createPageMaskStorage(memoryArea());
    await s2.importBundle(bundleOf([p], { settings: { defaultTitle: '导入标题' } }));
    expect((await s2.getSettings()).defaultTitle).toBe('导入标题');
  });

  it('导入时剔除危险候选与不认识的图标', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.importBundle(
      bundleOf([
        {
          ...createEmptyProfile('a.com'),
          icon: { kind: 'preset', id: 'unknown' },
          hideRules: [rule('r1', { candidates: ['a;b', '@import url(x)', '.ok'] }), rule('r2', { candidates: ['a{'] })],
        },
      ]),
    );
    const got = (await store.getProfile('a.com'))!;
    expect(got.icon).toEqual({ kind: 'none' });
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
    expect(await store.getSettings()).toEqual({
      defaultTitle: '周报',
      curtainBtnPos: { x: 24, y: 560 },
      uiLanguage: 'auto',
      toggleOpacity: 1,
    });
  });

  it('导入保留本机位置：合并与整体替换都不会被导出文件里的坐标覆盖', async () => {
    const area = memoryArea();
    const store = createPageMaskStorage(area);
    await store.setCurtainBtnPos({ x: 10, y: 20 });
    const file = bundleOf([createEmptyProfile('a.com')], {
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
      bundleOf([createEmptyProfile('a.com')], {
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
    const older = { ...createEmptyProfile('x.com', 100), disguisedTitle: '旧标题', floatingBtnPos: { x: 1, y: 2 } };
    const newer = { ...createEmptyProfile('x.com', 200), disguisedTitle: '新标题', floatingBtnPos: { x: 9, y: 9 } };
    const merged = mergeProfiles(older, newer);
    expect(merged.disguisedTitle).toBe('新标题');
    expect(merged.floatingBtnPos).toEqual({ x: 1, y: 2 });
    expect(merged.updatedAt).toBe(200);
  });
});

describe('插件设置随导出 / 导入（#55）', () => {
  it('导出带插件设置与"导出时的插件版本号"，格式版本仍是 1', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.updateProfile('x.com', () => false, { create: true });
    await store.putSettings({ defaultTitle: '周报' });

    const bundle = await store.exportBundle('0.4.0');

    expect(bundle.app).toBe('pagemask');
    expect(bundle.formatVersion).toBe(1); // 老字段不变
    expect(bundle.appVersion).toBe('0.4.0');
    expect(bundle.settings).toEqual({ defaultTitle: '周报', curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });
    expect(bundle.profiles).toHaveLength(1);
  });

  it('老文件（没有插件设置字段）仍能导入：只导网站，本机插件设置原样保留，两种模式都不报错', async () => {
    const area = memoryArea();
    area.data.set(SETTINGS_KEY, { defaultTitle: '本机标题', settingsVersion: 2 });
    const store = createPageMaskStorage(area);
    const oldFile = bundleOf([createEmptyProfile('a.com')]); // 0.1.0 / 0.2.0 之前的形状，没有 settings

    const merged = await store.importBundle(oldFile, 'merge');
    expect(merged.added).toBe(1);
    expect(await store.getSettings()).toEqual({ defaultTitle: '本机标题', curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });

    const replaced = await store.importBundle(bundleOf([createEmptyProfile('b.com')]), 'replace');
    expect(replaced.removed).toBe(1);
    expect(await store.getSettings()).toEqual({ defaultTitle: '本机标题', curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });
  });

  it('整体替换采用文件里的默认标题；合并时本地已设置过的保留', async () => {
    const file = bundleOf([createEmptyProfile('a.com')], {
      settings: { defaultTitle: '导入标题', curtainBtnPos: null },
    });

    const replaced = createPageMaskStorage(memoryArea());
    await replaced.importBundle(file, 'replace');
    expect((await replaced.getSettings()).defaultTitle).toBe('导入标题');

    const withLocal = memoryArea();
    withLocal.data.set(SETTINGS_KEY, { defaultTitle: '本机标题', settingsVersion: 2 });
    const merged = createPageMaskStorage(withLocal);
    await merged.importBundle(file, 'merge');
    expect(await merged.getSettings()).toEqual({ defaultTitle: '本机标题', curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });
  });

  it('文件里的插件设置缺字段时按默认值处理（不报错）', async () => {
    const store = createPageMaskStorage(memoryArea());
    await store.importBundle(
      bundleOf([createEmptyProfile('a.com')], { settings: {} }),
      'replace',
    );
    expect(await store.getSettings()).toEqual({ defaultTitle: null, curtainBtnPos: null, uiLanguage: 'auto', toggleOpacity: 1 });
  });

  it('导入不覆盖本机的按钮坐标（网站级 floatingBtnPos 与全局 curtainBtnPos）', async () => {
    const area = memoryArea();
    seed(area, { ...createEmptyProfile('keep.com'), floatingBtnPos: { x: 5, y: 6 } });
    area.data.set(SETTINGS_KEY, { defaultTitle: '本机标题', curtainBtnPos: { x: 10, y: 20 }, settingsVersion: 2 });
    const store = createPageMaskStorage(area);

    for (const mode of ['merge', 'replace'] as const) {
      await store.importBundle(
        bundleOf(
          [{ ...createEmptyProfile('keep.com'), floatingBtnPos: { x: 900, y: 900 } }],
          { settings: { defaultTitle: '导入标题', curtainBtnPos: { x: 800, y: 700 } } },
        ),
        mode,
      );
      expect((await store.getProfile('keep.com'))!.floatingBtnPos).toEqual({ x: 5, y: 6 });
      expect((await store.getSettings()).curtainBtnPos).toEqual({ x: 10, y: 20 });
    }
  });
});

describe('迁移与导入的坏数据边界（#177）', () => {
  it('懒迁移：净化失败的旧 key 跳过删除，留着不碍事', async () => {
    const area = memoryArea();
    area.data.set('profile:https://good.com', { ...createEmptyProfile('https://good.com'), hideRules: [rule('r1')] });
    // JSON 完整但字段畸形（origin 不是合法 key）：此前这类 key 会被无条件删掉
    area.data.set('profile:https://broken.com', { formatVersion: 1, origin: 'not a key!!', hideRules: [] });
    const store = createPageMaskStorage(area);
    const list = await store.listProfiles();
    expect(list.map((p) => p.origin)).toEqual(['good.com']);
    // 坏 key 仍在（读路径忽略它）：将来修好校验逻辑还能恢复
    expect(area.data.has('profile:https://broken.com')).toBe(true);
    // 幂等：再读不再尝试迁移
    await store.listProfiles();
    expect(area.data.has('profile:https://broken.com')).toBe(true);
  });

  it('replace 导入的 removed 计数包含本地无效的 profile key（不再少报）', async () => {
    const area = memoryArea();
    seed(area, { ...createEmptyProfile('local.com') });
    // 本地一条净化失败的坏 key：obsolete 应把它也算进 removed
    area.data.set('profile:broken.local', { formatVersion: 1, origin: '!!!', hideRules: [] });
    const store = createPageMaskStorage(area);
    const res = await store.importBundle(bundleOf([createEmptyProfile('new.com')]), 'replace');
    expect(res.removed).toBe(2);
    expect(res.added).toBe(1);
  });

  it('sanitizeProfile：超长标题截断到 60（输入框同上限，导入不再无界）', async () => {
    const store = createPageMaskStorage(memoryArea());
    const p = { ...createEmptyProfile('long.com'), disguisedTitle: '长'.repeat(500), titleIconSet: true };
    await store.importBundle(bundleOf([p]));
    const saved = await store.getProfile('long.com');
    expect(saved!.disguisedTitle).toHaveLength(60);
  });
});

describe('懒迁移混存回归（0.9.1 二轮审查）', () => {
  it('旧 key 与新 key 混存时：迁移只删旧 key，绝不删新 key（上次迁移写到一半被杀 / 并发首读的场景）', async () => {
    const area = memoryArea();
    // 混存：旧 key（上次迁移没来得及删）+ 新 key（归并结果已写入）
    area.data.set('profile:https://weibo.com', { ...createEmptyProfile('https://weibo.com'), hideRules: [rule('r1')], updatedAt: 100 });
    area.data.set('profile:weibo.com', { ...createEmptyProfile('weibo.com'), hideRules: [rule('r2')], updatedAt: 200 });
    const store = createPageMaskStorage(area);
    const list = await store.listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0]!.origin).toBe('weibo.com');
    // 归并应取两边并集（新 key 是最新事实，不能被先写后删洗掉）
    expect(list[0]!.hideRules.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    // 旧 key 已删、新 key 必须还在
    expect(area.data.has('profile:https://weibo.com')).toBe(false);
    expect(area.data.has('profile:weibo.com')).toBe(true);
  });

  it('只有新 key 时迁移整体不写不删（幂等空转）', async () => {
    const area = memoryArea();
    seed(area, { ...createEmptyProfile('weibo.com'), hideRules: [rule('r1')] });
    let writes = 0;
    const counting: KVArea = {
      ...area,
      set: async (items) => (writes++, area.set(items)),
      remove: async (keys) => (writes++, area.remove(keys)),
    };
    const store = createPageMaskStorage(counting);
    await store.listProfiles();
    await store.getProfile('weibo.com');
    expect(writes).toBe(0);
  });
});
