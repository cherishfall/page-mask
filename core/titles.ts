/**
 * 清爽态标签页标题的默认值与快捷标题（#35，REVIEW 决策 1 方案 B）。
 *
 * 默认标题用中性文字「阅读」/ "Reading"，按**浏览器界面语言**取值；不默认模仿浏览器自己的
 * 「新建标签页」——想要这个效果的用户可在管理页用快捷标题一键填入（用户自选）。
 * 本文件只放纯函数，内容脚本与管理页共用。
 *
 * 与界面语言开关（设置里的「界面语言」，#57）的关系：
 * - 兜底标题**不跟**这个开关走，永远按浏览器界面语言（语言是标签栏里的一张脸，不该被界面偏好顺手改掉）
 * - 快捷标题是用户自己点的「填入什么」，按钮上显示什么就填什么，所以按**当前界面语言**取：
 *   英文界面上不会出现一排中文按钮，点下去得到的也正是按钮上的字
 */
import { browserUiLanguage, isChineseLanguage, type Locale } from './i18n/locale';

/** 英文界面（及一切非中文界面）的默认标题；同时是最终兜底常量 */
export const DEFAULT_TITLE_EN = 'Reading';
export const DEFAULT_TITLE_ZH = '阅读';

/** 界面语言是否为中文：zh、zh-CN、zh-TW、zh-HK、zh_Hans… 一律算中文 */
export function isChineseUi(uiLanguage: string | null | undefined): boolean {
  return isChineseLanguage(uiLanguage);
}

/** 用户没自定义时的默认标题：中文界面「阅读」，其余 "Reading"（zh-TW 也是中文） */
export function defaultTitleFor(uiLanguage: string | null | undefined): string {
  return isChineseUi(uiLanguage) ? DEFAULT_TITLE_ZH : DEFAULT_TITLE_EN;
}

/**
 * 浏览器界面语言。扩展页面与内容脚本里优先用 chrome.i18n.getUILanguage()（浏览器界面语言，
 * 与网页声明的语言无关）；拿不到时（单测等环境）退回 navigator.language。
 */
export const currentUiLanguage = browserUiLanguage;

/** 一个快捷标题：中英两种写法，界面上显示与填进去的都是当前界面语言的那一个 */
export interface QuickTitle {
  id: 'newTab' | 'reading' | 'document' | 'notes';
  zh: string;
  en: string;
}

/** 管理页的快捷标题。「新建标签页」由用户自己选，不作为默认值 */
export const QUICK_TITLES: readonly QuickTitle[] = [
  { id: 'newTab', zh: '新建标签页', en: 'New Tab' },
  { id: 'reading', zh: '阅读', en: 'Reading' },
  { id: 'document', zh: '文档', en: 'Document' },
  { id: 'notes', zh: '笔记', en: 'Notes' },
];

/** 快捷标题实际显示 / 填入的值：按当前界面语言取（按钮上写什么就填什么） */
export function quickTitleValue(q: QuickTitle, locale: Locale): string {
  return locale === 'zh' ? q.zh : q.en;
}

function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * 站点配置的生效标题：站点覆盖 > 全局设置 > 界面语言默认 > 常量 "Reading"。
 * 永不返回空白——标题为空时 Chrome 会在标签页上显示网址。
 * 参数做运行时类型检查：存储里的旧数据/坏数据可能不是字符串。
 *
 * 注意：这里读的是**浏览器界面语言**（第三个参数），不读全局设置里的 uiLanguage ——
 * 那是插件的界面偏好（#57），切换它不该让标签栏里的字跟着变。
 */
export function effectiveTitle(
  profile: { disguisedTitle: unknown },
  settings: { defaultTitle: unknown } | null | undefined,
  uiLanguage: string | null | undefined = currentUiLanguage(),
): string {
  if (nonBlank(profile.disguisedTitle)) return profile.disguisedTitle;
  if (nonBlank(settings?.defaultTitle)) return settings.defaultTitle;
  const lang = defaultTitleFor(uiLanguage);
  return nonBlank(lang) ? lang : DEFAULT_TITLE_EN;
}
