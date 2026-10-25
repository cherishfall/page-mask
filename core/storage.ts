/**
 * 存储层：chrome.storage.local 封装（ADR-0004：仅本地存储，导出/导入代替自动同步）。
 * 通过注入 KVArea 接口解耦浏览器 API，纯逻辑可单测。
 */
import type { ExportBundle, GlobalSettings, HideRule, SiteProfile } from './types';
import { DEFAULT_SETTINGS } from './types';

export interface KVArea {
  get(keys: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const PROFILE_PREFIX = 'profile:';
export const SETTINGS_KEY = 'settings';

export const profileKey = (origin: string) => PROFILE_PREFIX + origin;

export interface ImportResult {
  added: number;
  updated: number;
  /** 'merge'（默认，规则并集）或 'replace'（整体替换） */
  mode: 'merge' | 'replace';
}

export function createPageMaskStorage(area: KVArea) {
  async function getProfile(origin: string): Promise<SiteProfile | null> {
    const obj = await area.get([profileKey(origin)]);
    const v = obj[profileKey(origin)];
    return isProfile(v) ? v : null;
  }

  async function putProfile(profile: SiteProfile): Promise<void> {
    // JSON 规范化：调用方（如 Vue 组件）可能传入响应式代理对象，
    // 直接进 chrome.storage 会被序列化成数字键对象而非数组
    const plain = JSON.parse(JSON.stringify(profile)) as SiteProfile;
    await area.set({ [profileKey(plain.origin)]: { ...plain, updatedAt: Date.now() } });
  }

  async function deleteProfile(origin: string): Promise<void> {
    await area.remove([profileKey(origin)]);
  }

  async function listProfiles(): Promise<SiteProfile[]> {
    const all = await area.get(null);
    return Object.entries(all)
      .filter(([k, v]) => k.startsWith(PROFILE_PREFIX) && isProfile(v))
      .map(([, v]) => v as SiteProfile)
      .sort((a, b) => a.origin.localeCompare(b.origin));
  }

  async function getSettings(): Promise<GlobalSettings> {
    const obj = await area.get([SETTINGS_KEY]);
    return { ...DEFAULT_SETTINGS, ...(obj[SETTINGS_KEY] as Partial<GlobalSettings> | undefined) };
  }

  async function putSettings(settings: GlobalSettings): Promise<void> {
    await area.set({ [SETTINGS_KEY]: settings });
  }

  async function exportBundle(): Promise<ExportBundle> {
    return {
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      profiles: await listProfiles(),
    };
  }

  /**
   * 导入：默认合并（同源配置做规则并集，冲突规则以导入方为准；站点级字段以较新的一方为准），
   * 可选整体替换（清掉本地全部站点配置后写入导入内容）。
   */
  async function importBundle(bundle: ExportBundle, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> {
    if (bundle.app !== 'pagemask' || !Array.isArray(bundle.profiles)) {
      throw new Error('不是有效的 PageMask 配置文件');
    }
    if (mode === 'replace') {
      const all = await area.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(PROFILE_PREFIX));
      if (keys.length) await area.remove(keys);
      for (const p of bundle.profiles) {
        if (isProfile(p)) await area.set({ [profileKey(p.origin)]: p });
      }
      return { added: bundle.profiles.length, updated: 0, mode };
    }

    let added = 0;
    let updated = 0;
    for (const incoming of bundle.profiles) {
      if (!isProfile(incoming)) continue;
      const local = await getProfile(incoming.origin);
      if (!local) {
        await area.set({ [profileKey(incoming.origin)]: incoming });
        added++;
        continue;
      }
      const merged = mergeProfiles(local, incoming);
      await area.set({ [profileKey(merged.origin)]: merged });
      updated++;
    }
    return { added, updated, mode };
  }

  return {
    getProfile,
    putProfile,
    deleteProfile,
    listProfiles,
    getSettings,
    putSettings,
    exportBundle,
    importBundle,
  };
}

/** 合并两个同源站点配置：规则按 id 并集（冲突取导入方）；站点级字段取 updatedAt 较新者 */
export function mergeProfiles(local: SiteProfile, incoming: SiteProfile): SiteProfile {
  const newer = incoming.updatedAt >= local.updatedAt ? incoming : local;
  const byId = new Map<string, HideRule>();
  for (const r of local.hideRules) byId.set(r.id, r);
  for (const r of incoming.hideRules) byId.set(r.id, r); // 导入方优先
  return {
    ...newer,
    formatVersion: 1,
    hideRules: Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt),
  };
}

function isProfile(v: unknown): v is SiteProfile {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as SiteProfile).formatVersion === 1 &&
    typeof (v as SiteProfile).origin === 'string' &&
    Array.isArray((v as SiteProfile).hideRules)
  );
}
