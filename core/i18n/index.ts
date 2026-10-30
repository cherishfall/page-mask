/**
 * 界面文案的唯一入口（#57）。
 *
 * - `MESSAGES`：两套文案表（core/i18n/messages.{zh,en}.ts）
 * - `t()`：当前界面语言的那一套。core 里的提示（导入报错、图标校验、体检结论…）也走它，
 *   组件与 core 用的是同一份字，不各写一套
 * - `setLocale()` / `onLocaleChange()`：极小的观察者。core 不引 Vue（后台也用 core），
 *   Vue 侧在 ui/i18n 里包一层响应式；页内非 Vue 的 DOM（幕布恢复按钮）直接订阅这里
 *
 * 每个 JS 上下文（popup、管理页、内容脚本的隔离环境）各有一份状态：各自的入口读到设置后
 * 调一次 setLocale，之后 storage.onChanged 再调。
 */
import { en } from './messages.en';
import { zh, type Messages } from './messages.zh';
import type { Locale } from './locale';

export { en, zh, type Messages };
export {
  browserUiLanguage,
  detectLocale,
  hasChinesePack,
  htmlLangOf,
  isChineseLanguage,
  isUiLanguage,
  resolveLocale,
  UI_LANGUAGES,
  type Locale,
  type UiLanguage,
} from './locale';

export const MESSAGES: Record<Locale, Messages> = { zh, en };

/** 还没读设置之前先按中文渲染：各入口都在挂载界面之前读一次设置，用户看不到这一档 */
let active: Locale = 'zh';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return active;
}

export function setLocale(next: Locale): void {
  if (next === active) return;
  active = next;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.warn('[PageMask] 语言变化回调出错', e);
    }
  }
}

/** 订阅语言变化；返回取消订阅。页内非 Vue 的 DOM 用它就地换字 */
export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 当前语言的那套文案 */
export function t(): Messages {
  return MESSAGES[active];
}

/** 语言名各用本语言书写、不翻译（设置页的「自动（当前：…）」与单选项都用它） */
export function localeName(locale: Locale): string {
  return locale === 'zh' ? MESSAGES.zh.common.languageNameZh : MESSAGES.zh.common.languageNameEn;
}
