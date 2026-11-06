/**
 * PageMask 领域模型（docs/design.md「数据模型」节的代码化）。
 * 术语见 GLOSSARY.md：站点配置 / 隐藏规则 / 收起方案 / 生效范围。
 *
 * 界面文案不在这里：全部集中在 core/i18n（收起方式的三个名字也从 `t().common.strategy` 取）。
 */
import type { UiLanguage } from './i18n/locale';
import { DEFAULT_TOGGLE_OPACITY } from './toggle-opacity';

/** 收起方案：A 彻底移除 / B 原地留白 / C 遮罩覆盖（界面用词见 core/i18n 的 common.strategy） */
export type StrategyId = 'remove' | 'blank' | 'mask';

/**
 * 内置图标（#121）：只存编号，图片本体在 core/icon-presets.ts（构建前由 scripts/gen-icons.mjs 生成）。
 * 顺序就是界面网格里的顺序。
 */
export const ICON_PRESET_IDS = [
  'doc',
  'sheet',
  'mail',
  'cal',
  'code',
  'meet',
  'chat',
  'drive',
  'book',
  'chart',
] as const;
export type IconPresetId = (typeof ICON_PRESET_IDS)[number];

export function isIconPresetId(v: unknown): v is IconPresetId {
  return typeof v === 'string' && (ICON_PRESET_IDS as readonly string[]).includes(v);
}

/**
 * 标签页图标三态（#121）：
 * - site：网站原来的图标——完全不接管 `<link rel="icon">`；
 * - none：不显示——写一张全透明图，标签页图标位留空；
 * - preset：换成内置的某个图标，只存编号。
 */
export type TabIcon = { kind: 'site' } | { kind: 'none' } | { kind: 'preset'; id: IconPresetId };

/** 站点开关两态：伪装态 / 原样态 */
export type SwitchState = 'disguised' | 'original';

/**
 * 一条生效范围模式：零专业输入，用 URL 前缀表达"这类页面"。
 * 匹配方式（match）：
 * - 缺省 = 带边界的前缀匹配：prefix 后面必须是结尾、/、? 或 #（/web 命中 /web/a，不命中 /website）
 * - 'exact' = 只匹配这一个页面：比较 站点+路径，忽略 ?查询 与 #锚点。用于首页——根路径的前缀等于整站
 */
export interface ScopePattern {
  /** 人类可读说明，如 "weread.qq.com 上 /web/reader 下的页面"、"weread.qq.com 的首页" */
  label: string;
  /** 匹配前缀（origin + 路径，编码形式），如 https://weread.qq.com/web/reader；exact 时是完整页面地址 */
  prefix: string;
  match?: 'exact';
}

/** 生效范围：整站（默认）/ 仅某类页面 / 排除某类页面。范围属于规则，不属于站点配置 */
export type Scope =
  | { type: 'all' }
  | { type: 'include'; patterns: ScopePattern[] }
  | { type: 'exclude'; patterns: ScopePattern[] };

/** 一条隐藏规则 = 藏什么 + 怎么藏 + 在哪藏（ADR-0002） */
export interface HideRule {
  id: string;
  /** 人话元素名，如"顶部导航栏"（自动命名，可改） */
  elementName: string;
  /** 候选选择器，由稳到险排序；任一命中即算找到，全部失配才判失效 */
  candidates: string[];
  strategy: StrategyId;
  scope: Scope;
  /** true = 只藏点选的那一个；false = 命中的同类元素一起藏 */
  onlyThis: boolean;
  createdAt: number;
  /** 最近一次失效体检结果，仅伪装态下更新 */
  lastHealth?: 'ok' | 'stale';
  lastHealthAt?: number;
}

/**
 * 停靠类悬浮控件的位置（#84）：x 只表达「贴哪一边」（≤ 8 视为左停靠，否则右停靠），
 * y 是顶边纵坐标。渲染按停靠边锚定（core/button-pos.ts），宽度变化时贴边不动；
 * 落库前由 snapXToEdge 取最近边贴靠（胶囊与幕布恢复按钮同一规则）。
 */
export interface ButtonPos {
  x: number;
  y: number;
}

/** 站点配置（按域名，一个网站一份） */
export interface SiteProfile {
  formatVersion: 1;
  /** 形如 https://weread.qq.com（含端口，如非默认） */
  origin: string;
  switchState: SwitchState;
  /**
   * 这个网站保存过「标题和图标」（#98）：清爽态只有它为 true 时才改标题与图标。
   * 没保存过的网站一律保持原样——只收起内容不等于要改标签页。
   * 缺省（旧数据）按 `!!disguisedTitle` 推导：只有那条流程会写这个字段。
   */
  titleIconSet?: boolean;
  /** 伪装标题；null = 用全局设置，全局也没设置时按界面语言取默认（core/titles.ts：「阅读」/ "Reading"） */
  disguisedTitle: string | null;
  /** 标签页图标：网站原来的 / 不显示 / 内置某个（#121） */
  icon: TabIcon;
  hideRules: HideRule[];
  /** 悬浮按钮记住的位置（#84：x 表贴边侧、y 为顶边）；null = 默认右下角 */
  floatingBtnPos: ButtonPos | null;
  /** 胶囊用 mini 形态（只有状态圆点、遮住、展开三个小钮）；缺省 = 全功能（#78，按站点各自记） */
  capsuleMini?: boolean;
  /**
   * 这个网站不显示胶囊（#111）：缺省 = 显示；只有显式 true 才落字段。
   * 只影响胶囊本身，不影响收起规则、标题和图标、快捷键与幕布上的「恢复」按钮。
   * 本机界面状态：写入不刷新 updatedAt（与 floatingBtnPos 同口径）。
   */
  capsuleHidden?: boolean;
  /**
   * 收起图片（#116）：清爽态把网页上的图片变成灰块（布局不动、链接可点穿）。
   * 只有显式 true 才落字段，缺省 = 不收起；真实用户设置，参与 updatedAt 与导入合并。
   */
  hideImages?: boolean;
  /** 收起视频（#116）：灰块 + 暂停 + 静音——画面收起来了就不能再响声音 */
  hideVideos?: boolean;
  /** 静音网页（#116）：借浏览器原生的标签页静音，按住整页所有声音；不收起任何画面 */
  mutePage?: boolean;
  createdAt: number;
  /** 用户修改时间：只在用户改动设置时刷新（体检回写、按钮坐标不刷新），合并导入据此取较新一方 */
  updatedAt: number;
}

/** 全局设置（独立于各站点配置） */
export interface GlobalSettings {
  /**
   * 全局默认伪装标题（#98 起不再自动套到所有网站）。
   * 两个用途：打开某个网站的「标题和图标」时作为预填值；遮住整页时作为没单独设过标题的网站的标题。
   * null = 用户没设置，跟随浏览器界面语言取默认（「阅读」/ "Reading"，见 core/titles.ts）。
   * 不存空白：标题为空时 Chrome 会在标签页上显示网址。
   */
  defaultTitle: string | null;
  /**
   * 没添加过的网站（一次性脚本）上「遮住」按钮记住的位置（视口坐标）；null = 默认右下角。
   * 这是本机界面状态（屏幕相关），与站点配置的 floatingBtnPos 同一口径：
   * 导入时保留本机的值，不被导入文件覆盖。
   */
  curtainBtnPos: ButtonPos | null;
  /**
   * 界面语言偏好（#57）：'auto'（默认，跟随浏览器界面语言）/ 'zh' / 'en'。
   * 只影响界面文字；标签页的兜底标题永远按浏览器界面语言取（core/titles.ts）。
   */
  uiLanguage: UiLanguage;
  /**
   * 右下角小胶囊的闲置不透明度（#110）：0.1–1，步长 0.1。
   * 全局偏好，只作用于胶囊；幕布上的「恢复」按钮不跟随（固定 100%，是遮住后唯一的回家路）。
   */
  toggleOpacity: number;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  defaultTitle: null,
  curtainBtnPos: null,
  uiLanguage: 'auto',
  toggleOpacity: DEFAULT_TOGGLE_OPACITY,
};

/** 导出文件结构：带版本号字段供未来迁移（ADR-0004） */
export interface ExportBundle {
  app: 'pagemask';
  formatVersion: 1;
  exportedAt: string;
  /** 导出时的插件版本（运行时 manifest 的 version）；旧文件没有这个字段 */
  appVersion?: string;
  /** 全局设置（0.2.0 起导出；旧文件没有此字段） */
  settings?: GlobalSettings;
  profiles: SiteProfile[];
}

export function newRuleId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyProfile(origin: string, now = Date.now()): SiteProfile {
  return {
    formatVersion: 1,
    origin,
    switchState: 'original',
    disguisedTitle: null,
    icon: { kind: 'site' },
    hideRules: [],
    floatingBtnPos: null,
    createdAt: now,
    updatedAt: now,
  };
}
