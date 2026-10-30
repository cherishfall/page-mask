<template>
  <div class="shell">
    <a class="back" href="management.html#/sites" data-testid="pm-settings-back">{{ t.settings.back }}</a>

    <header class="masthead">
      <h1>{{ t.settings.title }}</h1>
      <p class="sub">{{ t.settings.sub }}</p>
    </header>

    <main>
      <p v-if="!store.state.loaded" class="hint">{{ t.common.loading }}</p>

      <template v-else>
        <!-- 界面语言（#57）：三选一，切换即时生效 -->
        <section class="card" aria-labelledby="pm-settings-language-heading" data-testid="pm-settings-language">
          <h2 id="pm-settings-language-heading">{{ t.settings.languageHeading }}</h2>
          <p class="hint">{{ t.settings.languageIntro }}</p>
          <fieldset class="import-mode">
            <legend>{{ t.settings.languageHeading }}</legend>
            <div class="radio">
              <input
                id="pm-settings-lang-auto"
                v-model="langPref"
                type="radio"
                name="pm-settings-language"
                value="auto"
                data-testid="pm-settings-lang-auto"
              />
              <label for="pm-settings-lang-auto">{{ t.settings.languageAuto(autoDetectedName) }}</label>
            </div>
            <div class="radio">
              <input
                id="pm-settings-lang-zh"
                v-model="langPref"
                type="radio"
                name="pm-settings-language"
                value="zh"
                data-testid="pm-settings-lang-zh"
              />
              <label for="pm-settings-lang-zh">{{ t.settings.languageZh }}</label>
            </div>
            <div class="radio">
              <input
                id="pm-settings-lang-en"
                v-model="langPref"
                type="radio"
                name="pm-settings-language"
                value="en"
                data-testid="pm-settings-lang-en"
              />
              <label for="pm-settings-lang-en">{{ t.settings.languageEn }}</label>
            </div>
          </fieldset>
        </section>

        <!-- 默认标题 -->
        <section class="card" aria-labelledby="pm-settings-title-heading">
          <h2 id="pm-settings-title-heading">{{ t.settings.titleHeading }}</h2>
          <p class="hint">{{ t.settings.titleIntro }}</p>
          <div class="row">
            <label for="pm-settings-default-title">{{ t.settings.titleLabel }}</label>
            <input
              id="pm-settings-default-title"
              v-model="store.state.drafts[DEFAULT_KEY]"
              data-testid="pm-settings-default-title"
              :placeholder="store.languageDefaultTitle"
              aria-describedby="pm-settings-title-hint"
              @focus="store.focus(DEFAULT_KEY)"
              @blur="store.onBlur(DEFAULT_KEY)"
              @input="store.onInput(DEFAULT_KEY)"
              @change="store.saveDraft(DEFAULT_KEY)"
            />
          </div>
          <div class="row quick" role="group" aria-labelledby="pm-settings-title-quick">
            <span id="pm-settings-title-quick" class="hint">{{ t.common.quickFill }}</span>
            <button
              v-for="q in QUICK_TITLES"
              :key="q.id"
              type="button"
              class="chip"
              @click="store.pickTitle(DEFAULT_KEY, q)"
            >
              {{ quickTitleValue(q, locale) }}
            </button>
          </div>
          <p id="pm-settings-title-hint" class="hint">
            {{ t.settings.titleFootnote(store.languageDefaultTitle) }}
          </p>
        </section>

        <!-- 默认图标 -->
        <section class="card" aria-labelledby="pm-settings-icon-heading">
          <h2 id="pm-settings-icon-heading">{{ t.settings.iconHeading }}</h2>
          <p class="hint">{{ t.settings.iconIntro }}</p>
          <div class="row">
            <span class="row-label">{{ t.settings.currentIcon }}</span>
            <img
              v-if="store.state.defaultIcon"
              class="favicon"
              :src="store.state.defaultIcon"
              :alt="t.settings.currentIconAlt"
              data-testid="pm-settings-default-icon"
            />
            <span v-else class="hint" data-testid="pm-settings-default-icon-empty">{{ t.settings.iconUnset }}</span>
            <label class="button file-button">
              {{ iconBusy ? t.common.processing : store.state.defaultIcon ? t.common.replaceIcon : t.common.uploadIcon }}
              <input
                type="file"
                data-testid="pm-settings-icon-input"
                :accept="ICON_SOURCE_TYPES.join(',')"
                aria-describedby="pm-settings-icon-hint"
                :disabled="iconBusy"
                @change="onIconChange"
              />
            </label>
            <button
              v-if="store.state.defaultIcon"
              type="button"
              class="ghost danger"
              data-testid="pm-settings-icon-clear"
              @click="clearIcon"
            >
              {{ t.common.clearIcon }}
            </button>
          </div>
          <p id="pm-settings-icon-hint" class="hint">{{ t.settings.iconHint }}</p>
          <p v-if="iconError" class="hint error" role="alert" data-testid="pm-settings-icon-error">{{ iconError }}</p>
        </section>

        <!-- 导出 / 导入 -->
        <section class="card" aria-labelledby="pm-settings-transfer-heading">
          <h2 id="pm-settings-transfer-heading">{{ t.settings.transferHeading }}</h2>
          <p class="hint">{{ t.settings.transferIntro }}</p>
          <div class="row">
            <button type="button" class="primary" data-testid="pm-settings-export" @click="store.doExport">
              {{ t.settings.exportAll }}
            </button>
          </div>
          <!-- 先选导入方式，再选文件（审查 N20） -->
          <fieldset class="import-mode">
            <legend>{{ t.settings.importModeLegend }}</legend>
            <div class="radio">
              <input
                id="pm-settings-import-merge"
                v-model="store.state.importMode"
                type="radio"
                name="pm-settings-import-mode"
                value="merge"
                aria-describedby="pm-settings-import-merge-hint"
              />
              <label for="pm-settings-import-merge">{{ t.settings.merge }}</label>
              <span id="pm-settings-import-merge-hint" class="hint">{{ t.settings.mergeHint }}</span>
            </div>
            <div class="radio">
              <input
                id="pm-settings-import-replace"
                v-model="store.state.importMode"
                type="radio"
                name="pm-settings-import-mode"
                value="replace"
                aria-describedby="pm-settings-import-replace-hint"
              />
              <label for="pm-settings-import-replace">{{ t.settings.replace }}</label>
              <span id="pm-settings-import-replace-hint" class="hint">{{ t.settings.replaceHint }}</span>
            </div>
          </fieldset>
          <div class="row">
            <label class="button file-button">
              {{ t.settings.chooseFile }}
              <input type="file" accept="application/json" data-testid="pm-settings-import-input" @change="onImport" />
            </label>
          </div>
          <p class="hint" role="status" data-testid="pm-settings-import-result">{{ store.state.importResult }}</p>
        </section>

        <!-- 关于 -->
        <section class="card" aria-labelledby="pm-settings-about-heading">
          <h2 id="pm-settings-about-heading">{{ t.settings.aboutHeading }}</h2>
          <dl class="about">
            <div class="about-row">
              <dt>{{ t.settings.version }}</dt>
              <dd data-testid="pm-settings-version">{{ version }}</dd>
            </div>
            <div class="about-row">
              <dt>{{ t.settings.repo }}</dt>
              <dd><a :href="REPO_URL" target="_blank" rel="noopener noreferrer">github.com/cherishfall/page-mask</a></dd>
            </div>
            <div class="about-row">
              <dt>{{ t.settings.feedback }}</dt>
              <dd><a :href="ISSUES_URL" target="_blank" rel="noopener noreferrer">{{ t.settings.feedbackLink }}</a></dd>
            </div>
          </dl>
        </section>
      </template>
    </main>

    <!-- 整体替换导入确认：如实列出影响 -->
    <dialog
      ref="replaceDialog"
      aria-labelledby="pm-settings-replace-title"
      data-testid="pm-settings-replace-dialog"
      @close="onReplaceClose"
    >
      <template v-if="store.state.replaceImpact">
        <h2 id="pm-settings-replace-title">{{ t.settings.replaceDialog.title }}</h2>
        <ul data-testid="pm-settings-replace-impact">
          <li>
            {{ t.settings.replaceDialog.localSites(store.state.replaceImpact.localSites, store.state.replaceImpact.localRules) }}
          </li>
          <li v-if="store.state.replaceImpact.removedOrigins.length > 0">
            {{ t.settings.replaceDialog.removed(store.state.replaceImpact.removedOrigins.length, store.state.replaceImpact.removedRules, store.state.replaceImpact.removedOrigins.map(siteLabelOf).join(t.common.listSeparator)) }}
          </li>
          <li>
            {{ t.settings.replaceDialog.incoming(store.state.replaceImpact.incomingSites, store.state.replaceImpact.incomingRules) }}
          </li>
          <li v-if="store.state.replaceImpact.replacesSettings">{{ t.settings.replaceDialog.settings }}</li>
          <li>{{ t.settings.replaceDialog.irreversible }}</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>{{ t.common.cancel }}</button>
        <button value="confirm" class="primary danger">{{ t.settings.replaceDialog.confirm }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { ICON_SOURCE_TYPES } from '@/core/icon';
import { localeName } from '@/core/i18n';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import { locale, t } from '@/ui/i18n';
import { siteLabelOf } from '../management/site';
import { DEFAULT_KEY, managementStore as store } from '../management/store';
import { fileToIconDataUrl } from '../management/tab-icon';

/**
 * 界面语言（#57）：单选绑定的是存储里的偏好。切换即写入全局设置，
 * 所有打开的 PageMask 页面（包括本页）经 storage.onChanged 立即换语言。
 */
const langPref = computed({
  get: () => store.state.uiLanguage,
  set: (v) => void store.setUiLanguage(v),
});
/** 「自动」后面的当前探测结果：语言名各用本语言书写，不翻译 */
const autoDetectedName = computed(() => localeName(locale.value));

const REPO_URL = 'https://github.com/cherishfall/page-mask';
const ISSUES_URL = 'https://github.com/cherishfall/page-mask/issues';
const version = browser.runtime.getManifest().version;

const replaceDialog = ref<HTMLDialogElement | null>(null);
const iconBusy = ref(false);
const iconError = ref('');

onMounted(() => {
  void store.init();
});

async function onIconChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  if (!file) return;
  iconBusy.value = true;
  iconError.value = '';
  try {
    const res = await fileToIconDataUrl(file);
    if (!res.ok) {
      iconError.value = res.error;
      return;
    }
    await store.setDefaultIcon(res.dataUrl);
  } catch {
    iconError.value = t.value.errors.iconSave;
  } finally {
    iconBusy.value = false;
  }
}

async function clearIcon() {
  iconError.value = '';
  try {
    await store.setDefaultIcon(null);
  } catch {
    iconError.value = t.value.errors.iconClear;
  }
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  if (!file) return;
  const outcome = await store.importFile(file);
  if (outcome === 'confirm') {
    await nextTick();
    replaceDialog.value?.showModal();
  }
}

function onReplaceClose() {
  const dialog = replaceDialog.value;
  const confirmed = dialog?.returnValue === 'confirm';
  if (dialog) dialog.returnValue = '';
  void store.confirmReplace(confirmed);
}
</script>

<style scoped>
:global(body) {
  background: var(--pm-bg-subtle);
}

.shell {
  max-width: 720px;
  margin: var(--pm-space-6) auto;
  padding: 0 var(--pm-space-4) 60px;
}

.back {
  display: inline-block;
  margin-bottom: var(--pm-space-3);
  font-size: var(--pm-font-size-caption);
}

.masthead h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}

.sub {
  color: var(--pm-fg-muted);
  margin: var(--pm-space-1) 0 0;
}

.card {
  margin-top: var(--pm-space-3);
}

.card h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: var(--pm-space-2) 0;
  flex-wrap: wrap;
}

.row > label {
  color: var(--pm-fg);
  min-width: 96px;
}

.row-label {
  min-width: 96px;
  color: var(--pm-fg);
}

.row input:not([type]) {
  flex: 1;
  min-width: 180px;
}

.row.quick {
  gap: 6px;
  margin-top: -2px;
}

.favicon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--pm-border);
  border-radius: 4px;
  background: var(--pm-bg-subtle);
}

.import-mode {
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-control);
  margin: var(--pm-space-3) 0 var(--pm-space-2);
  padding: var(--pm-space-2) var(--pm-space-3);
}

.import-mode legend {
  padding: 0 var(--pm-space-1);
}

.radio {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: var(--pm-space-1) 0;
}

.radio input {
  margin: 0;
  align-self: center;
}

.radio .hint {
  margin: 0;
  flex-basis: 100%;
  padding-left: 22px;
}

.about {
  margin: 0;
}

.about-row {
  display: flex;
  gap: var(--pm-space-3);
  margin: var(--pm-space-1) 0;
}

.about-row dt {
  flex: none;
  min-width: 48px;
  color: var(--pm-fg-muted);
}

.about-row dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
