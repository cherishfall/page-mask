/**
 * 界面语言的判定（#57）。纯函数，无框架依赖：扩展页面、内容脚本都能用。
 *
 * 三档偏好存在全局设置的 `uiLanguage` 里：
 * - 'auto'（默认）：跟随浏览器界面语言
 * - 'zh' / 'en'：用户锁定的界面语言
 *
 * 「中文」的判定口径（自动模式）：**只认简体中文**——`zh`、`zh-CN`、`zh-SG`、`zh-Hans-*`；
 * 繁体中文（`zh-TW`、`zh-HK`、`zh-Hant-*`）没有对应的语言包，按英文处理。这与「兜底标题」无关：
 * 标签页上显示的「阅读」/ "Reading" 永远按**浏览器语言**取（core/titles.ts 的 isChineseLanguage，
 * `zh-TW` 在那里算中文），不受这个偏好影响。
 */

/** 用户可选的三档界面语言偏好 */
export type UiLanguage = 'auto' | 'zh' | 'en';

/** 实际渲染用的语言：只有这两种 */
export type Locale = 'zh' | 'en';

/** 三档偏好的白名单（校验与界面单选都用它） */
export const UI_LANGUAGES: readonly UiLanguage[] = ['auto', 'zh', 'en'];

export function isUiLanguage(v: unknown): v is UiLanguage {
  return typeof v === 'string' && (UI_LANGUAGES as readonly string[]).includes(v);
}

/**
 * 浏览器界面语言。扩展页面与内容脚本里优先用 chrome.i18n.getUILanguage()（浏览器界面语言，
 * 与网页声明的语言无关）；拿不到时（单测等环境）退回 navigator.language。
 */
export function browserUiLanguage(): string {
  try {
    const g = globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } } };
    const lang = g.chrome?.i18n?.getUILanguage?.();
    if (typeof lang === 'string' && lang) return lang;
  } catch {
    // 上下文失效等情况下 chrome.* 访问可能抛错，退回 navigator
  }
  return typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : '';
}

/** 界面语言是不是中文（任何中文，含繁体）：只用于标签页标题的默认值 */
export function isChineseLanguage(uiLanguage: string | null | undefined): boolean {
  return typeof uiLanguage === 'string' && /^zh(?:[-_]|$)/i.test(uiLanguage.trim());
}

/** 有没有对应的中文语言包：简体的 zh / zh-CN / zh-SG / zh-Hans 算，繁体（TW / HK / MO / Hant）不算 */
export function hasChinesePack(uiLanguage: string | null | undefined): boolean {
  if (!isChineseLanguage(uiLanguage)) return false;
  return !/(?:^|[-_])(?:hant|tw|hk|mo)(?:[-_]|$)/i.test(String(uiLanguage).trim());
}

/** 一种浏览器语言 → 实际渲染用的语言：简体中文看中文，其余（含 fr、zh-TW）看英文 */
export function detectLocale(browserLanguage: string | null | undefined): Locale {
  return hasChinesePack(browserLanguage) ? 'zh' : 'en';
}

/**
 * 三档偏好 → 实际渲染用的语言。auto 用浏览器界面语言判定（默认取当前环境），锁定值直接用。
 */
export function resolveLocale(
  pref: UiLanguage | null | undefined,
  browserLanguage: string | null | undefined = browserUiLanguage(),
): Locale {
  if (pref === 'zh' || pref === 'en') return pref;
  return detectLocale(browserLanguage);
}

/** 渲染语言 → <html lang> / shadow 根容器的 lang 值（读屏与断词都靠它） */
export function htmlLangOf(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}
