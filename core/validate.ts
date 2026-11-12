/**
 * 统一校验模块（纯函数）：存储层写入、导入、高级后门、CSS 生成共用。
 * 目标：任何进入存储或进入用户样式表的数据都是"已知形状 + 无法跳出规则块"的。
 *
 * - 候选选择器：必须是单个合法选择器；块外不得出现 { } ; @、注释、顶层逗号，
 *   括号与引号必须闭合，再交给浏览器解析器做语法检测（无 DOM 的上下文只做词法检查）
 * - 标签页图标：三态白名单（site / none / preset + 已知编号），旧的上传字段一律丢掉
 * - origin（站点 key）：站点配置的身份字段是 eTLD+1（#162），旧版 origin 形态在这里归一
 * - 生效范围 / 收起方案：白名单；范围前缀必须落在同一个站点内（仍按页面实际 URL 匹配）
 * - 全局设置：按 schema 读取，类型不对用默认值
 */
import { normalizeOrigin } from './origin';
import { isValidSiteKey, siteKey } from './site-key';
import { isUiLanguage } from './i18n/locale';
import { normalizeToggleOpacity } from './toggle-opacity';
import { t } from './i18n';
import {
  DEFAULT_SETTINGS,
  isIconPresetId,
  type GlobalSettings,
  type HideRule,
  type Scope,
  type ScopePattern,
  type SiteProfile,
  type StrategyId,
  type SwitchState,
  type TabIcon,
} from './types';

export const MAX_SELECTOR_LENGTH = 1000;

/**
 * 生效范围行 label 的长度上限（#192）：与标签页标题同一口径（60 码点，#177）。
 * label 随导入 / 坏数据进来时此前无界——一份带 1MB label 的文件会原样落库，
 * 并整段渲染在向导「在哪些页面收起」与站点设置页里。超长按码点截断而不是拒绝：
 * 范围本身合法，丢几个字不丢整条规则。
 */
export const MAX_SCOPE_LABEL_LENGTH = 60;

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

/**
 * 标签页图标三态（#121）：只认白名单。
 * 不做旧数据兼容：缺失 / 畸形 → none（保持「不显示图标」的观感，不突然露出网站图标）；
 * preset 的编号不认识 → none。旧字段 faviconDataUrl 作为未知字段丢掉。
 */
export function sanitizeTabIcon(v: unknown): TabIcon {
  if (!isObject(v)) return { kind: 'none' };
  if (v.kind === 'site') return { kind: 'site' };
  if (v.kind === 'preset' && isIconPresetId(v.id)) return { kind: 'preset', id: v.id };
  return { kind: 'none' };
}

export function isValidStrategy(v: unknown): v is StrategyId {
  return typeof v === 'string' && (STRATEGY_IDS as readonly string[]).includes(v);
}

/**
 * 校验并返回干净的生效范围副本；非法返回 null。
 * 给了 site（站点 key）时，前缀必须属于同一个站点——合并后的站点配置里，
 * weibo.com 与 s.weibo.com 的规则都算本站的；范围本身仍按页面实际 URL 匹配（core/origin.ts）。
 */
export function sanitizeScope(v: unknown, site?: string): Scope | null {
  if (!isObject(v)) return null;
  if (v.type === 'all') return { type: 'all' };
  if (v.type !== 'include' && v.type !== 'exclude') return null;
  if (!Array.isArray(v.patterns) || v.patterns.length === 0) return null;
  const patterns: ScopePattern[] = [];
  for (const p of v.patterns) {
    if (!isObject(p) || typeof p.label !== 'string' || typeof p.prefix !== 'string') return null;
    const okPrefix = site ? siteKey(p.prefix) === site : normalizeOrigin(p.prefix) !== null;
    if (!okPrefix) return null;
    // 匹配方式白名单：缺省（前缀）或 'exact'（精确页面）
    if (p.match !== undefined && p.match !== 'exact') return null;
    // label 截到与标题同一上限（#192）：slice 按 UTF-16 码元切会劈开代理对，按码点切（#177 同款）
    const label = [...p.label].slice(0, MAX_SCOPE_LABEL_LENGTH).join('');
    patterns.push(p.match === 'exact' ? { label, prefix: p.prefix, match: 'exact' } : { label, prefix: p.prefix });
  }
  return { type: v.type, patterns };
}

export function isValidScope(v: unknown, site?: string): v is Scope {
  return sanitizeScope(v, site) !== null;
}

/**
 * 校验并返回干净的隐藏规则副本；非法返回 null。
 * 不安全的候选被剔除，剩下至少一条才保留该规则（避免一条怪候选让用户点选的元素整条丢失）。
 */
export function sanitizeRule(
  v: unknown,
  site: string,
  probe: SelectorProbe = defaultSelectorProbe,
): HideRule | null {
  if (!isObject(v)) return null;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (!isValidStrategy(v.strategy)) return null;
  const scope = sanitizeScope(v.scope, site);
  if (!scope) return null;
  if (!Array.isArray(v.candidates)) return null;
  const candidates = v.candidates.filter((c) => isSafeSelector(c, probe)).map((c) => (c as string).trim());
  if (candidates.length === 0) return null;
  const rule: HideRule = {
    id: v.id,
    elementName: typeof v.elementName === 'string' && v.elementName.trim() ? v.elementName : t().common.unnamedElement,
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
 * 校验并返回干净的站点配置副本；身份字段（版本、站点 key、规则列表）不合法时返回 null。
 * 次要字段不合法时回落到安全默认值（例如图标三态缺失 → 不显示图标）。
 *
 * 身份归一（#162）：`origin` 字段名保留，值改成站点 key。旧 v1 导出文件 / 旧存储里的
 * `https://weibo.com` 在这里经 siteKey 归一，因此旧数据天然可读；同一份文件里的裸域与子域
 * 会在导入路径按归一后的 key 合并成一条。
 */
export function sanitizeProfile(v: unknown, probe: SelectorProbe = defaultSelectorProbe): SanitizedProfile | null {
  if (!isObject(v)) return null;
  if (v.formatVersion !== 1) return null;
  if (typeof v.origin !== 'string') return null;
  // 旧版 origin 形如 https://weibo.com：先归一到站点 key；已经是 key 的必须本身就是合法 key
  const key = v.origin.includes('://') ? siteKey(v.origin) : v.origin;
  if (!key || !isValidSiteKey(key)) return null;
  if (!Array.isArray(v.hideRules)) return null;
  const hideRules: HideRule[] = [];
  const seen = new Set<string>();
  let droppedRules = 0;
  for (const r of v.hideRules) {
    const rule = sanitizeRule(r, key, probe);
    if (!rule || seen.has(rule.id)) {
      droppedRules++;
      continue;
    }
    seen.add(rule.id);
    hideRules.push(rule);
  }
  const pos = v.floatingBtnPos;
  // 标题长度上限（#177）：输入框 maxlength=60，但导入/坏数据路径此前没有上限——
  // 一份带 1MB 标题的文件会原样落库并写进 document.title。超长按码点截断到同一上限
  // （0.9.1 二轮审查：slice 按 UTF-16 码元切会劈开代理对）
  const disguisedTitle = typeof v.disguisedTitle === 'string' ? [...v.disguisedTitle].slice(0, 60).join('') : null;
  const icon = sanitizeTabIcon(v.icon);
  // 「保存过标题和图标」(#98)：显式值优先；旧数据按「有标题」推导——
  // 只有「标题和图标」那条流程会写这个字段，所以这个推断对 0.5.x 的存量是准确的
  const titleIconSet = v.titleIconSet === true ? true : v.titleIconSet === false ? false : !!disguisedTitle;
  const profile: SiteProfile = {
    formatVersion: 1,
    origin: key,
    switchState: (SWITCH_STATES as readonly unknown[]).includes(v.switchState) ? (v.switchState as SwitchState) : 'original',
    titleIconSet,
    disguisedTitle,
    icon,
    hideRules,
    floatingBtnPos: isObject(pos) && isFiniteNumber(pos.x) && isFiniteNumber(pos.y) ? { x: pos.x, y: pos.y } : null,
    // 不显示胶囊（#111）同口径：只有显式 true 才落字段，缺省 = 显示。
    // 0.7.x/0.8.x 的 capsuleMini（双形态记忆）随 0.8.6 单形态退场，旧字段在整体写回时自然消失
    ...(v.capsuleHidden === true ? { capsuleHidden: true as const } : {}),
    // 整页变灰（0.8.0，#131）：同口径，只有显式 true 才落字段，坏值一律当作没开。
    // 旧数据迁移（0.7.x 的 hideImages / hideVideos）：任一为 true 就沿用；mutePage 随功能删除丢弃。
    // updateProfile 读到的是净化后的草稿，旧字段在第一次写回时自然消失，不会复活
    ...(v.mediaGray === true || v.hideImages === true || v.hideVideos === true
      ? { mediaGray: true as const }
      : {}),
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
    curtainBtnPos: isObject(pos) && isFiniteNumber(pos.x) && isFiniteNumber(pos.y) ? { x: pos.x, y: pos.y } : null,
    // 界面语言偏好（#57）：坏值 / 旧数据一律回到 auto
    uiLanguage: isUiLanguage(o.uiLanguage) ? o.uiLanguage : DEFAULT_SETTINGS.uiLanguage,
    // 胶囊不透明度（#110）：数值夹到 0.1–1；旧三档字符串迁移（full→1 / soft→0.9 / faint→0.7）；坏值回 1
    toggleOpacity: normalizeToggleOpacity(o.toggleOpacity),
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
