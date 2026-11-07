/**
 * #131 媒体开关的数据口径（0.8.0）：mediaGray 显式 true 才落字段、参与 updatedAt 与合并、
 * 0.7.x 旧字段（hideImages / hideVideos / mutePage）自动迁移、导入导出不丢。
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

describe('sanitizeProfile：mediaGray 的白名单与旧数据迁移', () => {
  it('显式 true 才落字段，缺省 = 不变灰（旧数据兼容）', () => {
    const clean = sanitizeProfile(profile({ mediaGray: true }))!.profile;
    expect(clean.mediaGray).toBe(true);
    expect(sanitizeProfile(profile())!.profile.mediaGray).toBeUndefined();
  });

  it('坏值 / false / 字符串一律丢掉，不落库也不进样式表', () => {
    const raw = { ...profile(), mediaGray: 'true' } as unknown as Record<string, unknown>;
    const clean = sanitizeProfile(raw)!.profile;
    expect(clean.mediaGray).toBeUndefined();
  });

  it('0.7.x 旧字段迁移：hideImages 或 hideVideos 任一 true → mediaGray true', () => {
    // 旧字段已从类型里删除，这里故意以裸对象传入模拟 0.7.x 存量
    const withImages = { ...profile(), hideImages: true } as unknown as Record<string, unknown>;
    const withVideos = { ...profile(), hideVideos: true } as unknown as Record<string, unknown>;
    expect(sanitizeProfile(withImages)!.profile.mediaGray).toBe(true);
    expect(sanitizeProfile(withVideos)!.profile.mediaGray).toBe(true);
  });

  it('旧字段全关 / 没有：mediaGray 不出现，不把「没开过」当成「开过」', () => {
    const allOff = { ...profile(), hideImages: false, hideVideos: false, mutePage: true } as unknown as Record<string, unknown>;
    expect(sanitizeProfile(allOff)!.profile.mediaGray).toBeUndefined();
  });

  it('mutePage 随功能删除丢弃，不迁移成任何字段', () => {
    const withMute = { ...profile(), mutePage: true } as unknown as Record<string, unknown>;
    const clean = sanitizeProfile(withMute)!.profile as unknown as Record<string, unknown>;
    expect(clean.mediaGray).toBeUndefined();
    expect(clean.mutePage).toBeUndefined();
    expect(clean.hideImages).toBeUndefined();
  });
});

describe('applyKey（#131）', () => {
  it('mediaGray 参与 applyKey：变化要整页重新应用', () => {
    const base = applyKey(profile(), { defaultTitle: null }, `${ORIGIN}/a`);
    expect(applyKey(profile({ mediaGray: true }), { defaultTitle: null }, `${ORIGIN}/a`)).not.toBe(base);
    expect(applyKey(profile(), { defaultTitle: null }, `${ORIGIN}/a`)).toBe(base);
  });
});

describe('存储与导入（#131）', () => {
  it('能写入、读回；关掉时字段消失而不是留一个 false', async () => {
    const storage = createPageMaskStorage(memoryArea());
    await storage.updateProfile(ORIGIN, (p) => { p.mediaGray = true; }, { create: true });
    const on = (await storage.getProfile(ORIGIN))!;
    expect(on.mediaGray).toBe(true);

    await storage.updateProfile(ORIGIN, (p) => {
      p.mediaGray = undefined;
    });
    const off = (await storage.getProfile(ORIGIN))!;
    expect(off.mediaGray).toBeUndefined();
  });

  it('升级路径：0.7.x 存量（hideImages）第一次读就是灰的，第一次写入把旧字段一并清掉', async () => {
    const area = memoryArea();
    // 0.7.x 存量：旧字段已从类型删除，用裸对象模拟原始存储内容
    const legacy = { ...profile(), hideImages: true, hideVideos: true, mutePage: true, updatedAt: 5 };
    area.data[`profile:${ORIGIN}`] = legacy;
    const storage = createPageMaskStorage(area);
    expect((await storage.getProfile(ORIGIN))!.mediaGray).toBe(true);

    await storage.updateProfile(ORIGIN, (p) => {
      p.mediaGray = undefined; // 升级后第一次关
    });
    const after = (await storage.getProfile(ORIGIN))! as unknown as Record<string, unknown>;
    expect(after.mediaGray).toBeUndefined();
    // 旧字段随整体写回消失：不会再把 mediaGray 复活成 true
    expect(after.hideImages).toBeUndefined();
    expect(after.hideVideos).toBeUndefined();
    expect(after.mutePage).toBeUndefined();
  });

  it('是真实用户设置：改动会刷新 updatedAt（不像胶囊本机状态那样 touch:false）', async () => {
    const storage = createPageMaskStorage(memoryArea());
    await storage.updateProfile(ORIGIN, (p) => { p.mediaGray = true; }, { create: true });
    const before = (await storage.getProfile(ORIGIN))!.updatedAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(before + 60_000);
    try {
      await storage.updateProfile(ORIGIN, (p) => {
        p.mediaGray = undefined;
      });
    } finally {
      clock.mockRestore();
    }
    expect((await storage.getProfile(ORIGIN))!.updatedAt).toBe(before + 60_000);
  });

  it('合并导入：mediaGray 是站点级字段，取较新一方', () => {
    const old = profile({ updatedAt: 100 });
    const freshOn = profile({ mediaGray: true, updatedAt: 200 });
    expect(mergeProfiles(old, freshOn).mediaGray).toBe(true); // 导入方较新且开着
    expect(mergeProfiles(freshOn, old).mediaGray).toBe(true); // 本机较新且开着 → 保留本机

    const freshOff = profile({ updatedAt: 200 });
    expect(mergeProfiles(old, freshOff).mediaGray).toBeUndefined(); // 较新一方没开就是没开
  });

  it('0.7.x 导出文件能导入：旧字段映射成 mediaGray，mutePage 丢弃', async () => {
    const storage = createPageMaskStorage(memoryArea());
    const legacy = { ...profile(), hideImages: true, mutePage: true } as unknown as SiteProfile;
    const result = await storage.importBundle({
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: '2026-11-06T00:00:00.000Z',
      profiles: [legacy],
    });
    expect(result.added).toBe(1);
    const saved = (await storage.getProfile(ORIGIN))! as unknown as Record<string, unknown>;
    expect(saved.mediaGray).toBe(true);
    expect(saved.mutePage).toBeUndefined();
  });
});
