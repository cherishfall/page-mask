/**
 * 清爽态标签页标题的默认值与快捷标题（#35，REVIEW 决策 1 方案 B）。
 *
 * 默认标题用中性文字「阅读」/ "Reading"，按浏览器界面语言取值；不默认模仿浏览器自己的
 * 「新建标签页」——想要这个效果的用户可在管理页用快捷标题一键填入（用户自选）。
 * 本文件只放纯函数，内容脚本与管理页共用。
 */

/** 英文界面（及一切非中文界面）的默认标题；同时是最终兜底常量 */
export const DEFAULT_TITLE_EN = 'Reading';
export const DEFAULT_TITLE_ZH = '阅读';

/** 界面语言是否为中文：zh、zh-CN、zh-TW、zh-HK、zh_Hans… 一律算中文 */
export function isChineseUi(uiLanguage: string | null | undefined): boolean {
  return typeof uiLanguage === 'string' && /^zh(?:[-_]|$)/i.test(uiLanguage.trim());
}

/** 用户没自定义时的默认标题：中文界面「阅读」，其余 "Reading" */
export function defaultTitleFor(uiLanguage: string | null | undefined): string {
  return isChineseUi(uiLanguage) ? DEFAULT_TITLE_ZH : DEFAULT_TITLE_EN;
}

/**
 * 浏览器界面语言。扩展页面与内容脚本里优先用 chrome.i18n.getUILanguage()（浏览器界面语言，
 * 与网页声明的语言无关）；拿不到时（单测等环境）退回 navigator.language。
 */
export function currentUiLanguage(): string {
  try {
    const g = globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } } };
    const lang = g.chrome?.i18n?.getUILanguage?.();
    if (typeof lang === 'string' && lang) return lang;
  } catch {
    // 上下文失效等情况下 chrome.* 访问可能抛错，退回 navigator
  }
  return typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : '';
}

/** 一个快捷标题：按钮上显示的文字（管理页界面是中文），以及中/英两种填入值 */
export interface QuickTitle {
  label: string;
  zh: string;
  en: string;
}

/** 管理页的快捷标题。「新建标签页」由用户自己选，不作为默认值 */
export const QUICK_TITLES: readonly QuickTitle[] = [
  { label: '新建标签页', zh: '新建标签页', en: 'New Tab' },
  { label: '阅读', zh: '阅读', en: 'Reading' },
  { label: '文档', zh: '文档', en: 'Document' },
  { label: '笔记', zh: '笔记', en: 'Notes' },
];

/**
 * 快捷标题实际填入的值：按浏览器界面语言取。标签页标题是给浏览器标签栏看的，
 * 英文浏览器的标签栏里出现中文反而显眼，所以中文浏览器填中文、其它填英文。
 */
export function quickTitleValue(q: QuickTitle, uiLanguage: string | null | undefined): string {
  return isChineseUi(uiLanguage) ? q.zh : q.en;
}

function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * 站点配置的生效标题：站点覆盖 > 全局设置 > 界面语言默认 > 常量 "Reading"。
 * 永不返回空白——标题为空时 Chrome 会在标签页上显示网址。
 * 参数做运行时类型检查：存储里的旧数据/坏数据可能不是字符串。
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
