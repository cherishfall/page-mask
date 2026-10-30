/**
 * Vue 侧的界面语言（#57）：把 core/i18n 的极简观察者包成响应式，供组件与入口使用。
 *
 * 用法：
 * - 扩展页面入口（main.ts）先 `await initUiLanguage({ title })` 再挂载应用 —— 挂载前就读到设置，
 *   不会先闪一下中文；之后 storage.onChanged 里改语言立即生效，无需刷新
 * - 组件里 `import { t } from '@/ui/i18n'`，模板写 `{{ t.popup.loading }}`（computed 在模板里自动取值）。
 *   组件只要在模板里用到 `t`，语言一变整块就重渲染 —— 同一块里由 core 函数拼出来的文案也跟着换
 * - 页内非 Vue 的 DOM（幕布恢复按钮）用 core 的 onLocaleChange 自行换字
 */
import { computed, ref } from 'vue';
import { browser } from 'wxt/browser';
import {
  getLocale,
  htmlLangOf,
  isUiLanguage,
  MESSAGES,
  onLocaleChange,
  resolveLocale,
  setLocale,
  type Locale,
  type Messages,
  type UiLanguage,
} from '@/core/i18n';
import { createPageMaskStorage } from '@/core/storage';

/** 语言变化的版本号：computed 依赖它，语言一变就重算 */
const version = ref(0);
onLocaleChange(() => {
  version.value++;
});

/** 当前界面语言（zh / en） */
export const locale = computed<Locale>(() => {
  void version.value;
  return getLocale();
});

/** 当前界面语言的那套文案 */
export const t = computed<Messages>(() => {
  void version.value;
  return MESSAGES[getLocale()];
});

/** 从设置里取语言并应用；设置缺失 / 坏值时按 auto 处理 */
export function applySettingsLanguage(settings: { uiLanguage?: unknown } | null | undefined): void {
  setLocale(resolveLocale(isUiLanguage(settings?.uiLanguage) ? settings.uiLanguage : 'auto'));
}

export interface UiLanguageInit {
  /** 扩展页面自己的 <title>（随语言变） */
  title?: (messages: Messages) => string;
}

/**
 * 扩展页面入口调用一次：读设置 → 应用语言 → 跟随变化。
 * 返回时界面语言已经定下来，可以立即挂载应用。
 */
export async function initUiLanguage(opts: UiLanguageInit = {}): Promise<void> {
  const syncDocument = () => {
    document.documentElement.lang = htmlLangOf(getLocale());
    if (opts.title) document.title = opts.title(MESSAGES[getLocale()]);
  };
  syncDocument();
  onLocaleChange(syncDocument);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('settings' in changes)) return;
    const next = (changes.settings as { newValue?: { uiLanguage?: unknown } } | undefined)?.newValue;
    setLocale(resolveLocale(isUiLanguage(next?.uiLanguage) ? next.uiLanguage : 'auto'));
  });

  try {
    const settings = await createPageMaskStorage(browser.storage.local).getSettings();
    applySettingsLanguage(settings);
  } catch {
    // 读不到设置（极少见）：保持 auto 的判定结果
    applySettingsLanguage(null);
  }
}

/** 界面语言偏好的展示名（「自动」后面的括号里用） */
export function languageLabel(pref: UiLanguage): string {
  if (pref === 'zh') return MESSAGES[getLocale()].settings.languageZh;
  if (pref === 'en') return MESSAGES[getLocale()].settings.languageEn;
  return MESSAGES[getLocale()].common.languageNameZh;
}
