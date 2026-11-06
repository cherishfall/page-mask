/**
 * #116 三个开关的数据口径：显式 true 才落字段、参与 updatedAt 与合并、导入导出不丢。
 * 少了任何一处（类型 / 校验白名单 / applyKey / 存储）都会表现为「拨了开关没反应」或「重开就没了」。
 */
import { describe, expect, it, vi } from 'vitest';
import { applyKey } from './apply-key';
import { createPageMaskStorage, mergeProfiles, type KVArea } from './storage';
import { createEmptyProfile, type SiteProfile } from './types';
import { sanitizeProfile } from './validate';

const ORIGIN = 'https://media.example';

function profile(patch: Partial<SiteProfile> = {}): SiteProfile {
  return { ...createEmptyProfile(ORIGIN, 1), ...patch };
}

function memoryArea(): KVArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys: string[] | null) {
      if (keys === null) return { ...data };
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items);
    },
    async remove(keys: string[]) {
      for (const k of keys) delete data[k];
    },
  };
}

const ALL_ON = { hideImages: true, hideVideos: true, mutePage: true };

describe('sanitizeProfile：三个字段的白名单', () => {
  it('显式 true 才落字段，缺省 = 不收起（旧数据兼容）', () => {
    const clean = sanitizeProfile(profile(ALL_ON))!.profile;
    expect(clean.hideImages).toBe(true);
    expect(clean.hideVideos).toBe(true);
    expect(clean.mutePage).toBe(true);
    expect(sanitizeProfile(profile())!.profile.hideImages).toBeUndefined();
  });

  it('坏值 / false / 字符串一律丢掉，不落库也不进样式表', () => {
    const raw = profile({ hideImages: false, hideVideos: 1, mutePage: 'true' } as unknown as Partial<SiteProfile>);
    const clean = sanitizeProfile(raw)!.profile;
    expect(clean.hideImages).toBeUndefined();
    expect(clean.hideVideos).toBeUndefined();
    expect(clean.mutePage).toBeUndefined();
  });

  it('三个开关都参与 applyKey：任一变化都要整页重新应用（含静音重新对账）', () => {
    const base = applyKey(profile(), { defaultTitle: null }, `${ORIGIN}/a`);
    for (const key of ['hideImages', 'hideVideos', 'mutePage'] as const) {
      expect(applyKey(profile({ [key]: true }), { defaultTitle: null }, `${ORIGIN}/a`)).not.toBe(base);
    }
    expect(applyKey(profile(), { defaultTitle: null }, `${ORIGIN}/a`)).toBe(base);
  });
});

describe('存储与导入（#116）', () => {
  it('能写入、读回；关掉时字段消失而不是留一个 false', async () => {
    const storage = createPageMaskStorage(memoryArea());
    await storage.updateProfile(ORIGIN, (p) => { Object.assign(p, ALL_ON); }, { create: true });
    const on = (await storage.getProfile(ORIGIN))!;
    expect(on.hideImages).toBe(true);
    expect(on.hideVideos).toBe(true);
    expect(on.mutePage).toBe(true);

    await storage.updateProfile(ORIGIN, (p) => {
      p.hideImages = false;
    });
    const off = (await storage.getProfile(ORIGIN))!;
    expect(off.hideImages).toBeUndefined();
    expect(off.hideVideos).toBe(true); // 只动了一个开关，另外两个不受影响
    expect(off.mutePage).toBe(true);
  });

  it('是真实用户设置：改动会刷新 updatedAt（不像胶囊本机状态那样 touch:false）', async () => {
    const storage = createPageMaskStorage(memoryArea());
    await storage.updateProfile(ORIGIN, (p) => { Object.assign(p, ALL_ON); }, { create: true });
    const before = (await storage.getProfile(ORIGIN))!.updatedAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(before + 60_000);
    try {
      await storage.updateProfile(ORIGIN, (p) => {
        p.mutePage = false;
      });
    } finally {
      clock.mockRestore();
    }
    expect((await storage.getProfile(ORIGIN))!.updatedAt).toBe(before + 60_000);
  });

  it('合并导入：站点级字段取较新一方，三个开关跟着走', () => {
    const local = profile({ hideImages: true, updatedAt: 100 });
    const incoming = profile({ hideVideos: true, mutePage: true, updatedAt: 200 });
    const merged = mergeProfiles(local, incoming);
    expect(merged.hideImages).toBeUndefined();
    expect(merged.hideVideos).toBe(true);
    expect(merged.mutePage).toBe(true);

    const localNewer = profile({ hideImages: true, updatedAt: 200 });
    const incomingOlder = profile({ hideVideos: true, mutePage: true, updatedAt: 100 });
    expect(mergeProfiles(localNewer, incomingOlder).hideImages).toBe(true); // 本机较新时保留本机
    expect(mergeProfiles(localNewer, incomingOlder).hideVideos).toBeUndefined();
  });

  it('导出文件里的三个开关能完整导入', async () => {
    const storage = createPageMaskStorage(memoryArea());
    const result = await storage.importBundle({
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: '2026-11-06T00:00:00.000Z',
      profiles: [profile(ALL_ON)],
    });
    expect(result.added).toBe(1);
    const saved = (await storage.getProfile(ORIGIN))!;
    expect(saved.hideImages).toBe(true);
    expect(saved.hideVideos).toBe(true);
    expect(saved.mutePage).toBe(true);
  });
});
