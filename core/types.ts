/**
 * PageMask 领域模型（docs/design.md「数据模型」节的代码化）。
 * 术语见 GLOSSARY.md：站点配置 / 隐藏规则 / 收起方案 / 生效范围。
 */

/** 收起方案：A 彻底移除 / B 原地留白 / C 遮罩覆盖 */
export type StrategyId = 'remove' | 'blank' | 'mask';

/** 站点开关两态：伪装态 / 原样态 */
export type SwitchState = 'disguised' | 'original';

export const STRATEGY_LABEL: Record<StrategyId, string> = {
  remove: '彻底移除',
  blank: '原地留白',
  mask: '遮罩覆盖',
};

/** 默认伪装标题：不能为空——空白会让 Chrome 显示网址反而泄露（design.md） */
export const DEFAULT_DISGUISED_TITLE = '新建标签页';

/** 一条生效范围模式：零专业输入，用 URL 前缀表达"这类页面" */
export interface ScopePattern {
  /** 人类可读说明，如 "weread.qq.com 上 /web/reader/ 开头的页面" */
  label: string;
  /** 匹配前缀（origin + 路径前缀），如 https://weread.qq.com/web/reader/ */
  prefix: string;
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

/** 站点配置（按域名，一个网站一份） */
export interface SiteProfile {
  formatVersion: 1;
  /** 形如 https://weread.qq.com（含端口，如非默认） */
  origin: string;
  switchState: SwitchState;
  /** 伪装标题；null = 用全局默认（DEFAULT_DISGUISED_TITLE，全局默认可改） */
  disguisedTitle: string | null;
  /** 伪装图标 data URL；null = 中性默认（透明图标，Chrome 显示通用地球） */
  faviconDataUrl: string | null;
  hideRules: HideRule[];
  /** 悬浮按钮记住的位置（视口坐标）；null = 默认右下角 */
  floatingBtnPos: { x: number; y: number } | null;
  createdAt: number;
  /** 用户修改时间：只在用户改动设置时刷新（体检回写、按钮坐标不刷新），合并导入据此取较新一方 */
  updatedAt: number;
}

/** 全局设置（独立于各站点配置） */
export interface GlobalSettings {
  /** 全局默认伪装标题，站点未覆盖时使用 */
  defaultTitle: string;
}

export const DEFAULT_SETTINGS: GlobalSettings = { defaultTitle: DEFAULT_DISGUISED_TITLE };

/** 导出文件结构：带版本号字段供未来迁移（ADR-0004） */
export interface ExportBundle {
  app: 'pagemask';
  formatVersion: 1;
  exportedAt: string;
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
