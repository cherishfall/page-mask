/**
 * PageMask 领域模型（docs/design.md「数据模型」节的代码化）。
 * 术语见 GLOSSARY.md：站点配置 / 隐藏规则 / 收起方案 / 生效范围。
 */

/** 收起方案：A 彻底移除 / B 原地留白 / C 遮罩覆盖（界面用词见下方 STRATEGY_LABEL） */
export type StrategyId = 'remove' | 'blank' | 'mask';

/** 站点开关两态：伪装态 / 原样态 */
export type SwitchState = 'disguised' | 'original';

/** 界面用词（GLOSSARY「收起方式」）：全项目唯一的三个名字，界面上一律用这三个 */
export const STRATEGY_LABEL: Record<StrategyId, string> = {
  remove: '消失',
  blank: '留空',
  mask: '盖住',
};

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

/** 视口坐标（像素，锚点是按钮左上角） */
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
  /** 伪装标题；null = 用全局设置，全局也没设置时按界面语言取默认（core/titles.ts：「阅读」/ "Reading"） */
  disguisedTitle: string | null;
  /** 伪装图标 data URL；null = 默认全透明图标（标签页上图标位显示为空白） */
  faviconDataUrl: string | null;
  hideRules: HideRule[];
  /** 悬浮按钮记住的位置（视口坐标）；null = 默认右下角 */
  floatingBtnPos: ButtonPos | null;
  createdAt: number;
  /** 用户修改时间：只在用户改动设置时刷新（体检回写、按钮坐标不刷新），合并导入据此取较新一方 */
  updatedAt: number;
}

/** 全局设置（独立于各站点配置） */
export interface GlobalSettings {
  /**
   * 全局默认伪装标题，站点未覆盖时使用。
   * null = 用户没设置，跟随浏览器界面语言取默认（「阅读」/ "Reading"，见 core/titles.ts）。
   * 不存空白：标题为空时 Chrome 会在标签页上显示网址。
   */
  defaultTitle: string | null;
  /**
   * 全局默认标签页图标（data URL）；null = 用内置的 1×1 全透明图标。
   * 生效顺序：站点自己的图标 > 这一项 > 内置透明图标（core/icon.ts 的 effectiveIcon）。
   */
  defaultIconDataUrl: string | null;
  /**
   * 没添加过的网站（一次性脚本）上「遮住」按钮记住的位置（视口坐标）；null = 默认右下角。
   * 这是本机界面状态（屏幕相关），与站点配置的 floatingBtnPos 同一口径：
   * 导入时保留本机的值，不被导入文件覆盖。
   */
  curtainBtnPos: ButtonPos | null;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  defaultTitle: null,
  defaultIconDataUrl: null,
  curtainBtnPos: null,
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
    faviconDataUrl: null,
    hideRules: [],
    floatingBtnPos: null,
    createdAt: now,
    updatedAt: now,
  };
}
