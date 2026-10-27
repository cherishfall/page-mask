/**
 * 管理页 store（#40）：存储态、编辑态（防覆盖）、自动保存、开关、授权与导入流程。
 * 用 fakeBrowser 顶替 chrome API；permissions / sendMessage 用替身（fakeBrowser 未实现）。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AUTOSAVE_MS, createManagementStore, DEFAULT_KEY } from '@/entrypoints/management/store';
import { createEmptyProfile, type SiteProfile } from '@/core/types';

const A = 'https://reader.example';
const B = 'https://other.example';
const pattern = (origin: string) => `${origin}/*`;

let granted: Set<string>;
let request: ReturnType<typeof vi.fn>;

function fakeEvent() {
  return { addListener: () => undefined, removeListener: () => undefined, hasListener: () => false };
}

function stubBrowser() {
  granted = new Set();
  request = vi.fn(async ({ origins }: { origins: string[] }) => {
    for (const o of origins) granted.add(o);
    return true;
  });
  Object.assign(fakeBrowser.permissions, {
    contains: vi.fn(async ({ origins }: { origins: string[] }) => origins.every((o) => granted.has(o))),
    request,
    onAdded: fakeEvent(),
    onRemoved: fakeEvent(),
  });
  Object.assign(fakeBrowser.runtime, { sendMessage: vi.fn(async () => ({ ok: true, pending: [] })) });
}

function profileOf(origin: string, over: Partial<SiteProfile> = {}): SiteProfile {
  const p = createEmptyProfile(origin, 1000);
  p.hideRules = [
    { id: 'r1', elementName: '页头', candidates: ['#site-header'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
    { id: 'r2', elementName: '侧栏', candidates: ['#side'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 2 },
  ];
  return { ...p, ...over };
}

const settingsOf = (defaultTitle: string | null) => ({ defaultTitle, settingsVersion: 2 });

async function seed(origins: string[], defaultTitle: string | null = null) {
  const data: Record<string, unknown> = { settings: settingsOf(defaultTitle) };
  for (const o of origins) data[`profile:${o}`] = profileOf(o);
  await fakeBrowser.storage.local.set(data);
}

describe('管理页 store', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    stubBrowser();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('读取存储：站点列表、默认标题草稿与待授权站点', async () => {
    await seed([A, B], '我的标题');
    granted.add(pattern(A));

    const store = createManagementStore();
    await store.reload();

    expect(store.state.loaded).toBe(true);
    expect(store.state.profiles.map((p) => p.origin)).toEqual([B, A]);
    expect(store.state.pendingOrigins).toEqual([B]);
    expect(store.state.defaultTitle).toBe('我的标题');
    expect(store.state.drafts[DEFAULT_KEY]).toBe('我的标题');
    expect(store.state.drafts[A]).toBe('');
  });

  it('输入停顿 800ms 后自动保存，保存前不写存储', async () => {
    vi.useFakeTimers();
    await seed([], null);
    const store = createManagementStore();
    await store.reload();

    store.focus(DEFAULT_KEY);
    store.state.drafts[DEFAULT_KEY] = '  新标题  ';
    store.onInput(DEFAULT_KEY);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS - 1);
    expect((await fakeBrowser.storage.local.get('settings')).settings).toEqual(settingsOf(null));

    await vi.advanceTimersByTimeAsync(1);
    expect((await fakeBrowser.storage.local.get('settings')).settings).toEqual(settingsOf('新标题'));
    expect(store.state.defaultTitle).toBe('新标题');
  });

  it('正在编辑的字段不被存储变化冲掉，其余字段照常刷新；失焦后跟随存储', async () => {
    vi.useFakeTimers();
    await seed([A], '原来的标题');
    const store = createManagementStore();
    await store.reload();

    store.focus(DEFAULT_KEY);
    store.state.drafts[DEFAULT_KEY] = '正在输入';
    store.onInput(DEFAULT_KEY);
    await fakeBrowser.storage.local.set({ settings: settingsOf('别处改的') });
    await store.reload();

    expect(store.state.drafts[DEFAULT_KEY]).toBe('正在输入');
    expect(store.state.defaultTitle).toBe('别处改的');

    // 有未保存改动时失焦也不覆盖输入
    store.onBlur(DEFAULT_KEY);
    expect(store.state.drafts[DEFAULT_KEY]).toBe('正在输入');

    // 没有未保存改动时跟随存储（新字段的草稿从存储重建）
    const fresh = createManagementStore();
    await fakeBrowser.storage.local.set({ settings: settingsOf('别处又改的') });
    await fresh.reload();
    expect(fresh.state.drafts[DEFAULT_KEY]).toBe('别处又改的');
    vi.clearAllTimers();
  });

  it('切换开关只改 switchState，不动收起项', async () => {
    await seed([A]);
    const store = createManagementStore();
    await store.reload();
    const p = store.state.profiles[0]!;

    await store.toggleSite(p, { target: { checked: true } } as unknown as Event);

    const saved = (await fakeBrowser.storage.local.get(`profile:${A}`))[`profile:${A}`] as SiteProfile;
    expect(saved.switchState).toBe('disguised');
    expect(saved.hideRules.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(store.state.toggling[A]).toBe(false);
  });

  it('授权并启用：一次请求全部来源，成功后待授权列表清空', async () => {
    await seed([A, B]);
    const store = createManagementStore();
    await store.reload();
    expect(store.state.pendingOrigins).toEqual([B, A]); // 列表按 origin 排序

    store.authorize([A, B]);

    await vi.waitFor(() => expect(store.state.pendingOrigins).toEqual([]), { timeout: 1000, interval: 5 });
    expect(request).toHaveBeenCalledWith({ origins: [pattern(A), pattern(B)] });
  });

  it('授权被拒：保留设置并给出人话提示', async () => {
    await seed([A]);
    const store = createManagementStore();
    await store.reload();
    request.mockResolvedValueOnce(false);

    store.authorize([A]);

    await vi.waitFor(() => expect(store.state.authError).toContain('允许'), { timeout: 1000, interval: 5 });
    expect(store.state.pendingOrigins).toEqual([A]);
  });

  it('导入：坏文件用人话报错；整体替换先给影响预览，取消不改数据', async () => {
    await seed([A]);
    const store = createManagementStore();
    await store.reload();

    expect(await store.importFile(new File(['{ not json'], 'broken.json'))).toBe('failed');
    expect(store.state.importResult).toBe('导入失败：不是有效的 PageMask 导出文件');

    store.state.importMode = 'replace';
    const bundle = {
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: [profileOf(B)],
    };
    expect(await store.importFile(new File([JSON.stringify(bundle)], 'bundle.json'))).toBe('confirm');
    expect(store.state.replaceImpact?.localSites).toBe(1);
    expect(store.state.replaceImpact?.removedOrigins).toEqual([A]);

    await store.confirmReplace(false);
    expect(store.state.importResult).toBe('已取消导入，本机设置没有改动');
    expect(await fakeBrowser.storage.local.get(`profile:${A}`)).toHaveProperty(`profile:${A}`);
  });
});
