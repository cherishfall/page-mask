/**
 * 统一校验模块（纯函数）：存储层写入、导入、高级后门、CSS 生成共用。
 * 目标：任何进入存储或进入用户样式表的数据都是"已知形状 + 无法跳出规则块"的。
 *
 * - 候选选择器：必须是单个合法选择器；块外不得出现 { } ; @、注释、顶层逗号，
 *   括号与引号必须闭合，再交给浏览器解析器做语法检测（无 DOM 的上下文只做词法检查）
 * - 标签页图标：只收 data:image/（png/jpeg/gif/webp/ico）且限大小；不收 svg
 * - origin：必须等于 normalizeOrigin 的结果（因此只能是 http/https）
 * - 生效范围 / 收起方案：白名单
 * - 全局设置：按 schema 读取，类型不对用默认值
 */
import { normalizeOrigin } from './origin';
import {
  DEFAULT_SETTINGS,
  type GlobalSettings,
  type HideRule,
  type Scope,
  type ScopePattern,
  type SiteProfile,
  type StrategyId,
  type SwitchState,
} from './types';

export const MAX_SELECTOR_LENGTH = 1000;
/** 图标文件上限 256KB；base64 膨胀约 4/3，加上前缀约 35 万字符 */
export const MAX_FAVICON_BYTES = 256 * 1024;
export const MAX_FAVICON_DATA_URL_LENGTH = Math.ceil((MAX_FAVICON_BYTES * 4) / 3) + 64;

export const STRATEGY_IDS: readonly StrategyId[] = ['remove', 'blank', 'mask'];
const SWITCH_STATES: readonly SwitchState[] = ['disguised', 'original'];

/** 选择器语法检测：返回 true = 浏览器能解析 */
export type SelectorProbe = (selector: string) => boolean;

/**
 * 默认语法检测：有 DOM 时用 DocumentFragment.querySelector 试解析（非法选择器会抛错，
 * Chrome 与 jsdom 行为一致）；后台 service worker 没有 DOM，只能依赖词法检查。
 */
export const defaultSelectorProbe: SelectorProbe = (selector) => {
  if (typeof document === 'undefined' || typeof document.createDocumentFragment !== 'function') return true;
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

/**
 * 词法检查：保证选择器放进 `sel { ... }` 后无法提前结束规则块或开启新规则。
 * 引号内的 { } ; @ , 属于字符串内容（例如 [href^="mailto:a@b.com"]），不会跳出，予以放行；
 * 反斜杠转义的字符同理（CSS 把它当作标识符的一部分）。
 */
export function isLexicallySafeSelector(selector: string): boolean {
  const s = selector.trim();
  if (!s || s.length > MAX_SELECTOR_LENGTH) return false;
  // 换行等控制字符：字符串内的换行会让引号提前失效，一律不收
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return false;
  const closers: string[] = [];
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === '\\') {
      i++; // 跳过被转义的字符
      if (i >= s.length) return false;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') return false;
    if (c === '{' || c === '}' || c === ';' || c === '@') return false;
    if (c === '(') closers.push(')');
    else if (c === '[') closers.push(']');
    else if (c === ')' || c === ']') {
      if (closers.pop() !== c) return false;
    } else if (c === ',' && closers.length === 0) {
      return false; // 顶层逗号 = 选择器并集，不是"单个选择器"
    }
  }
  return quote === null && closers.length === 0;
}

/** 候选选择器是否安全可用：单个、合法、无法跳出规则块 */
export function isSafeSelector(selector: unknown, probe: SelectorProbe = defaultSelectorProbe): selector is string {
  if (typeof selector !== 'string') return false;
  if (!isLexicallySafeSelector(selector)) return false;
  return probe(selector.trim());
}

const FAVICON_DATA_URL_RE = /^data:image\/(?:png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/]+={0,2}$/;

/** 标签页图标只收本地图片的 data URL（不发起任何网络请求），且限大小 */
export function isSafeFaviconDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_FAVICON_DATA_URL_LENGTH && FAVICON_DATA_URL_RE.test(v);
}

/** origin 必须已是规范形式（只有 http/https，无路径、无默认端口） */
export function isValidOrigin(v: unknown): v is string {
  return typeof v === 'string' && normalizeOrigin(v) === v;
}

export function isValidStrategy(v: unknown): v is StrategyId {
  return typeof v === 'string' && (STRATEGY_IDS as readonly string[]).includes(v);
}

/** 校验并返回干净的生效范围副本；非法返回 null。给了 origin 时，前缀必须落在该站点内 */
export function sanitizeScope(v: unknown, origin?: string): Scope | null {
  if (!isObject(v)) return null;
  if (v.type === 'all') return { type: 'all' };
  if (v.type !== 'include' && v.type !== 'exclude') return null;
  if (!Array.isArray(v.patterns) || v.patterns.length === 0) return null;
  const patterns: ScopePattern[] = [];
  for (const p of v.patterns) {
    if (!isObject(p) || typeof p.label !== 'string' || typeof p.prefix !== 'string') return null;
    const okPrefix = origin ? p.prefix.startsWith(`${origin}/`) : normalizeOrigin(p.prefix) !== null;
    if (!okPrefix) return null;
    // 匹配方式白名单：缺省（前缀）或 'exact'（精确页面）
    if (p.match !== undefined && p.match !== 'exact') return null;
    patterns.push(p.match === 'exact' ? { label: p.label, prefix: p.prefix, match: 'exact' } : { label: p.label, prefix: p.prefix });
  }
  return { type: v.type, patterns };
}

export function isValidScope(v: unknown, origin?: string): v is Scope {
  return sanitizeScope(v, origin) !== null;
}

/**
 * 校验并返回干净的隐藏规则副本；非法返回 null。
 * 不安全的候选被剔除，剩下至少一条才保留该规则（避免一条怪候选让用户点选的元素整条丢失）。
 */
export function sanitizeRule(
  v: unknown,
  origin: string,
  probe: SelectorProbe = defaultSelectorProbe,
): HideRule | null {
  if (!isObject(v)) return null;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (!isValidStrategy(v.strategy)) return null;
  const scope = sanitizeScope(v.scope, origin);
  if (!scope) return null;
  if (!Array.isArray(v.candidates)) return null;
  const candidates = v.candidates.filter((c) => isSafeSelector(c, probe)).map((c) => (c as string).trim());
  if (candidates.length === 0) return null;
  const rule: HideRule = {
    id: v.id,
    elementName: typeof v.elementName === 'string' && v.elementName.trim() ? v.elementName : '未命名元素',
    candidates,
    strategy: v.strategy,
    scope,
    onlyThis: v.onlyThis === true,
    createdAt: finiteOr(v.createdAt, 0),
  };
  if (v.lastHealth === 'ok' || v.lastHealth === 'stale') rule.lastHealth = v.lastHealth;
  if (isFiniteNumber(v.lastHealthAt)) rule.lastHealthAt = v.lastHealthAt;
  return rule;
}

export interface SanitizedProfile {
  profile: SiteProfile;
  /** 因不合法被丢弃的规则条数 */
  droppedRules: number;
}

/**
 * 校验并返回干净的站点配置副本；身份字段（版本、origin、规则列表）不合法时返回 null。
 * 次要字段不合法时回落到安全默认值（例如远程图标 → 无图标）。
 */
export function sanitizeProfile(v: unknown, probe: SelectorProbe = defaultSelectorProbe): SanitizedProfile | null {
  if (!isObject(v)) return null;
  if (v.formatVersion !== 1) return null;
  if (!isValidOrigin(v.origin)) return null;
  if (!Array.isArray(v.hideRules)) return null;
  const origin = v.origin;
  const hideRules: HideRule[] = [];
  const seen = new Set<string>();
  let droppedRules = 0;
  for (const r of v.hideRules) {
    const rule = sanitizeRule(r, origin, probe);
    if (!rule || seen.has(rule.id)) {
      droppedRules++;
      continue;
    }
    seen.add(rule.id);
    hideRules.push(rule);
  }
  const pos = v.floatingBtnPos;
  const profile: SiteProfile = {
    formatVersion: 1,
    origin,
    switchState: (SWITCH_STATES as readonly unknown[]).includes(v.switchState) ? (v.switchState as SwitchState) : 'original',
    disguisedTitle: typeof v.disguisedTitle === 'string' ? v.disguisedTitle : null,
    faviconDataUrl: isSafeFaviconDataUrl(v.faviconDataUrl) ? v.faviconDataUrl : null,
    hideRules,
    floatingBtnPos: isObject(pos) && isFiniteNumber(pos.x) && isFiniteNumber(pos.y) ? { x: pos.x, y: pos.y } : null,
    createdAt: finiteOr(v.createdAt, 0),
    updatedAt: finiteOr(v.updatedAt, 0),
  };
  return { profile, droppedRules };
}

/**
 * 全局设置按 schema 读取：类型不对或空白一律视为"没设置"（null，跟随界面语言默认）。
 * 用于导入文件与写入前的规整；读本机存储请用 readStoredSettings（含旧版迁移）。
 */
export function readSettings(v: unknown): GlobalSettings {
  const o = isObject(v) ? v : {};
  const pos = o.curtainBtnPos;
  return {
    defaultTitle:
      typeof o.defaultTitle === 'string' && o.defaultTitle.trim() ? o.defaultTitle : DEFAULT_SETTINGS.defaultTitle,
    defaultIconDataUrl: isSafeFaviconDataUrl(o.defaultIconDataUrl) ? o.defaultIconDataUrl : null,
    curtainBtnPos: isObject(pos) && isFiniteNumber(pos.x) && isFiniteNumber(pos.y) ? { x: pos.x, y: pos.y } : null,
  };
}

/** 0.1.0 的全局默认标题。0.2.0 起默认改为跟随界面语言（「阅读」/ "Reading"，#35） */
export const LEGACY_DEFAULT_TITLE = '新建标签页';

/** 本机存储里全局设置的版本标记：0.2.0 起每次写入都带上 */
export const SETTINGS_VERSION = 2;

/**
 * 读本机存储里的全局设置，顺带做 0.1.0 → 0.2.0 的一次性迁移：
 * 0.1.0 的管理页把「新建标签页」当默认值填在输入框里，清空输入框保存也会写回它，
 * 用户分不清"自己设置的"和"默认的"。所以没有版本标记、且恰好等于旧默认值的记录视为"没设置"，
 * 改为跟随界面语言默认。0.2.0 写入时带版本标记，之后用户主动选「新建标签页」（快捷标题）不受影响。
 */
export function readStoredSettings(v: unknown): GlobalSettings {
  if (isObject(v) && v.settingsVersion !== SETTINGS_VERSION && v.defaultTitle === LEGACY_DEFAULT_TITLE) {
    return { ...DEFAULT_SETTINGS };
  }
  return readSettings(v);
}

/** 写入本机存储的全局设置：规整后带上版本标记（见 readStoredSettings） */
export function toStoredSettings(settings: unknown): GlobalSettings & { settingsVersion: number } {
  return { ...readSettings(settings), settingsVersion: SETTINGS_VERSION };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function finiteOr(v: unknown, fallback: number): number {
  return isFiniteNumber(v) ? v : fallback;
}
