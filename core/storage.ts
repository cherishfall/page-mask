/**
 * 存储层：chrome.storage.local 封装（ADR-0004：仅本地存储，导出/导入代替自动同步）。
 * 通过注入 KVArea 接口解耦浏览器 API，纯逻辑可单测。
 *
 * 写入纪律（审查 S2）：站点配置只能经 updateProfile(origin, 改动函数) 修改——
 * 写前重读最新值、只改调用方关心的字段、写入前统一校验（core/validate.ts）。
 * 同一上下文内的所有写入按存储区串行执行，交错的修改不会互相覆盖。
 * 注意：chrome.storage 本身没有事务，跨上下文（popup 与页面）仍可能在"读→写"的极短窗口内交错；
 * 重读最新值已把这个窗口缩到一次异步往返。
 */
import type { ButtonPos, ExportBundle, GlobalSettings, HideRule, SiteProfile } from './types';
import { createEmptyProfile } from './types';
import { isValidOrigin, readSettings, readStoredSettings, sanitizeProfile, toStoredSettings } from './validate';
import { t } from './i18n';

export interface KVArea {
  get(keys: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export const PROFILE_PREFIX = 'profile:';
export const SETTINGS_KEY = 'settings';

/** 用户可见的导入报错（GLOSSARY：说"导出文件"，不说"配置文件"）。按当前界面语言取 */
export function invalidExportFile(): string {
  return t().errors.invalidExportFile;
}

export const profileKey = (origin: string) => PROFILE_PREFIX + origin;

export interface ImportResult {
  /** 本地原来没有、新加入的站点数 */
  added: number;
  /** 本地已有、被合并或替换的站点数 */
  updated: number;
  /** 整体替换时，本地有但导入文件里没有、因而被移除的站点数（合并模式恒为 0） */
  removed: number;
  /** 文件里不合法、被跳过的站点条目数 */
  skipped: number;
  /** 合法站点里因不合法被忽略的规则条数 */
  skippedRules: number;
  /** 'merge'（默认，规则并集）或 'replace'（整体替换） */
  mode: 'merge' | 'replace';
}

export interface UpdateOptions {
  /** 站点配置不存在时是否新建空配置。默认 false：站点已被一键清空就不再"复活" */
  create?: boolean;
  /**
   * 是否刷新"用户修改时间"（updatedAt，合并导入时据此判断哪边较新）。
   * 默认 true；体检回写、悬浮按钮坐标这类非用户设置的写入传 false。
   */
  touch?: boolean;
}

/** 改动函数：直接修改传入的最新副本；返回 false 表示无需写入 */
export type ProfileMutator = (draft: SiteProfile) => void | false;

export interface HealthResult {
  id: string;
  status: 'ok' | 'stale';
}

/** 全局设置的局部改动：没提供的字段保留本机现值 */
export type SettingsPatch = Partial<GlobalSettings>;

/** 每个存储区一条写入队列（模块级，同一上下文里多个 storage 实例共享） */
const writeChains = new WeakMap<object, Promise<unknown>>();

function serialize<T>(area: KVArea, task: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(area) ?? Promise.resolve();
  const next = prev.then(task);
  writeChains.set(
    area,
    next.catch(() => undefined),
  );
  return next;
}

function clone<T>(v: T): T {
  // JSON 规范化：调用方（如 Vue 组件）可能传入响应式代理，直接进 chrome.storage 会被序列化走样
  return JSON.parse(JSON.stringify(v)) as T;
}

export function createPageMaskStorage(area: KVArea) {
  async function readProfile(origin: string): Promise<SiteProfile | null> {
    const key = profileKey(origin);
    const obj = await area.get([key]);
    const s = sanitizeProfile(obj[key]);
    return s && s.profile.origin === origin ? s.profile : null;
  }

  async function getProfile(origin: string): Promise<SiteProfile | null> {
    return readProfile(origin);
  }

  /**
   * 原子更新：排队 → 重读最新值 → 交给改动函数 → 校验 → 写回。
   * 返回写入后的最新配置；站点不存在且未要求新建时返回 null（不写入）。
   */
  function updateProfile(origin: string, mutate: ProfileMutator, opts: UpdateOptions = {}): Promise<SiteProfile | null> {
    if (!isValidOrigin(origin)) return Promise.reject(new Error(t().errors.invalidOrigin(origin)));
    return serialize(area, async () => {
      const current = await readProfile(origin);
      if (!current && !opts.create) return null;
      const draft = clone(current ?? createEmptyProfile(origin));
      // 返回 false = 无需改动；但"不存在且要求新建"时仍要落库空配置
      if (mutate(draft) === false && current) return current;
      draft.formatVersion = 1;
      draft.origin = origin;
      if (opts.touch !== false || !current) draft.updatedAt = Date.now();
      const clean = sanitizeProfile(clone(draft));
      if (!clean) throw new Error(t().errors.invalidProfile);
      await area.set({ [profileKey(origin)]: clean.profile });
      return clean.profile;
    });
  }

  /** 体检回写：只改各规则的健康字段，不碰开关等其他字段，也不刷新用户修改时间 */
  function updateRuleHealth(origin: string, results: HealthResult[], now = Date.now()): Promise<SiteProfile | null> {
    const byId = new Map(results.map((r) => [r.id, r.status]));
    return updateProfile(
      origin,
      (p) => {
        let changed = false;
        for (const r of p.hideRules) {
          const status = byId.get(r.id);
          if (status && r.lastHealth !== status) {
            r.lastHealth = status;
            r.lastHealthAt = now;
            changed = true;
          }
        }
        return changed ? undefined : false;
      },
      { touch: false },
    );
  }

  function deleteProfile(origin: string): Promise<void> {
    return serialize(area, () => area.remove([profileKey(origin)]));
  }

  async function listProfiles(): Promise<SiteProfile[]> {
    const all = await area.get(null);
    const out: SiteProfile[] = [];
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(PROFILE_PREFIX)) continue;
      const s = sanitizeProfile(v);
      if (s && profileKey(s.profile.origin) === k) out.push(s.profile);
    }
    return out.sort((a, b) => a.origin.localeCompare(b.origin));
  }

  async function getSettings(): Promise<GlobalSettings> {
    const obj = await area.get([SETTINGS_KEY]);
    return readStoredSettings(obj[SETTINGS_KEY]);
  }

  /**
   * 写全局设置（局部改动）：先读本机现值再合并，没提到的字段保持不变。
   * 「遮住」按钮位置（curtainBtnPos）是本机界面状态——在管理页改默认标题时不该把它冲掉。
   */
  function putSettings(patch: SettingsPatch): Promise<void> {
    return serialize(area, async () => {
      const obj = await area.get([SETTINGS_KEY]);
      const next: GlobalSettings = { ...readStoredSettings(obj[SETTINGS_KEY]), ...patch };
      await area.set({ [SETTINGS_KEY]: toStoredSettings(clone(next)) });
    });
  }

  /**
   * 记住没添加过的网站上「遮住」按钮的位置（全局一份）；null = 回到右下角。
   * 与站点配置的 floatingBtnPos 同口径：本机界面状态，不刷新用户修改时间，导入时保留本机值。
   */
  function setCurtainBtnPos(pos: ButtonPos | null): Promise<void> {
    return putSettings({ curtainBtnPos: pos });
  }

  /**
   * 导出网站配置与插件设置（#55）。appVersion 由调用方传运行时 manifest 的版本，
   * 写进文件的 appVersion 字段（formatVersion 保持不变，仍是 1）。
   */
  async function exportBundle(appVersion?: string): Promise<ExportBundle> {
    return {
      app: 'pagemask',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      ...(appVersion ? { appVersion } : {}),
      settings: await getSettings(),
      profiles: await listProfiles(),
    };
  }

  /**
   * 导入：先完整校验并构建新数据集，再一次性写入；任何校验失败都不改动本地数据。
   * - 合并（默认）：同源配置做规则并集（冲突规则以导入方为准），站点级字段取用户修改时间较新的一方；
   *   本地已设置过的全局设置保留
   * - 整体替换：以导入文件为准（含全局设置），本地多出的站点移除
   * 旧导出文件（没有 settings 字段）只导网站，插件设置保持本机不变，不报错（#55）。
   * 两种模式下悬浮按钮坐标都保留本机的值（坐标与屏幕相关，不跨电脑），「遮住」按钮的全局位置同理；
   * 界面语言偏好（#57）也是本机偏好，导入不改它。
   */
  async function importBundle(bundle: unknown, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> {
    if (!isObject(bundle) || bundle.app !== 'pagemask' || !Array.isArray(bundle.profiles)) {
      throw new Error(invalidExportFile());
    }
    if (bundle.formatVersion !== 1) {
      throw new Error(
        typeof bundle.formatVersion === 'number' && bundle.formatVersion > 1
          ? t().errors.newerImport
          : invalidExportFile(),
      );
    }

    // 1) 校验导入方，同一站点出现多次则先在文件内部合并
    const incoming = new Map<string, SiteProfile>();
    let skipped = 0;
    let skippedRules = 0;
    for (const raw of bundle.profiles) {
      const s = sanitizeProfile(raw);
      if (!s) {
        skipped++;
        continue;
      }
      skippedRules += s.droppedRules;
      const prev = incoming.get(s.profile.origin);
      incoming.set(s.profile.origin, prev ? mergeProfiles(prev, s.profile) : s.profile);
    }
    if (incoming.size === 0) {
      throw new Error(t().errors.noSitesInFile(invalidExportFile()));
    }
    // 导出文件从 0.2.0 起才带全局设置，不存在 0.1.0 旧值的问题，按 schema 读取即可（不做旧版迁移）
    const importedSettings = isObject(bundle.settings) ? readSettings(bundle.settings) : null;

    // 2) 基于本地最新值构建新数据集，一次性写入
    return serialize(area, async () => {
      const all = await area.get(null);
      const localKeys = Object.keys(all).filter((k) => k.startsWith(PROFILE_PREFIX));
      const local = new Map<string, SiteProfile>();
      for (const k of localKeys) {
        const s = sanitizeProfile(all[k]);
        if (s && profileKey(s.profile.origin) === k) local.set(s.profile.origin, s.profile);
      }

      const writes: Record<string, unknown> = {};
      let added = 0;
      let updated = 0;
      for (const [origin, inc] of incoming) {
        const mine = local.get(origin);
        let next: SiteProfile;
        if (!mine) {
          next = { ...inc, floatingBtnPos: null };
          added++;
        } else {
          next = mode === 'merge' ? mergeProfiles(mine, inc) : { ...inc, floatingBtnPos: mine.floatingBtnPos };
          updated++;
        }
        writes[profileKey(origin)] = next;
      }
      if (importedSettings && (mode === 'replace' || !(SETTINGS_KEY in all))) {
        // 本机界面状态（屏幕相关 / 本机偏好）：只换标题与图标，保留本机的坐标与界面语言
        const local = readStoredSettings(all[SETTINGS_KEY]);
        writes[SETTINGS_KEY] = toStoredSettings({
          ...importedSettings,
          curtainBtnPos: local.curtainBtnPos,
          uiLanguage: local.uiLanguage,
        });
      }

      await area.set(writes);
      // 先写后删：即使删除失败，也只是多留旧数据，不会丢数据
      const obsolete = mode === 'replace' ? localKeys.filter((k) => !(k in writes)) : [];
      if (obsolete.length) await area.remove(obsolete);
      const removed = obsolete.filter((k) => local.has(k.slice(PROFILE_PREFIX.length))).length;
      return { added, updated, removed, skipped, skippedRules, mode };
    });
  }

  return {
    getProfile,
    updateProfile,
    updateRuleHealth,
    deleteProfile,
    listProfiles,
    getSettings,
    putSettings,
    setCurtainBtnPos,
    exportBundle,
    importBundle,
  };
}

export type PageMaskStorage = ReturnType<typeof createPageMaskStorage>;

/**
 * 合并两个同源站点配置：规则按 id 并集（冲突取导入方）；
 * 站点级字段取用户修改时间（updatedAt）较新的一方；悬浮按钮坐标保留本地。
 */
export function mergeProfiles(local: SiteProfile, incoming: SiteProfile): SiteProfile {
  const newer = incoming.updatedAt >= local.updatedAt ? incoming : local;
  const byId = new Map<string, HideRule>();
  for (const r of local.hideRules) byId.set(r.id, r);
  for (const r of incoming.hideRules) byId.set(r.id, r); // 导入方优先
  return {
    ...newer,
    formatVersion: 1,
    origin: local.origin,
    floatingBtnPos: local.floatingBtnPos,
    createdAt: Math.min(local.createdAt, incoming.createdAt),
    updatedAt: Math.max(local.updatedAt, incoming.updatedAt),
    hideRules: Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
