<template>
  <section class="view" aria-labelledby="pm-settings-title">
    <h2 id="pm-settings-title" class="view-title">设置</h2>
    <p class="hint">这里的设置对所有网站生效。</p>

    <!-- 全局默认标题 -->
    <section class="card">
      <h3>标签页显示</h3>
      <p class="hint">让标签栏更简洁，减少分心。</p>
      <div class="row">
        <label for="default-title">默认标签页标题</label>
        <input
          id="default-title"
          v-model="store.state.drafts[DEFAULT_KEY]"
          data-testid="pm-mgmt-default-title"
          :placeholder="store.languageDefaultTitle"
          aria-describedby="default-title-hint"
          @focus="store.focus(DEFAULT_KEY)"
          @blur="store.onBlur(DEFAULT_KEY)"
          @input="store.onInput(DEFAULT_KEY)"
          @change="store.saveDraft(DEFAULT_KEY)"
        />
      </div>
      <div class="row quick" role="group" aria-labelledby="default-title-quick">
        <span id="default-title-quick" class="hint">快捷填入</span>
        <button
          v-for="q in QUICK_TITLES"
          :key="q.label"
          type="button"
          class="chip"
          @click="store.pickTitle(DEFAULT_KEY, q)"
        >
          {{ quickTitleValue(q, store.uiLanguage) }}
        </button>
      </div>
      <p id="default-title-hint" class="hint">
        网站没有单独设置标题时使用；留空则用「{{ store.languageDefaultTitle }}」（跟随浏览器语言）。标签页标题不会留成空白：空白时 Chrome 会改为显示网址。
      </p>
    </section>

    <!-- 导出 / 导入 -->
    <section class="card">
      <h3>导出 / 导入</h3>
      <p class="hint">把全部网站的设置存成一个文件；换电脑或重装浏览器后导入，就能恢复。</p>
      <div class="row">
        <button type="button" class="primary" @click="store.doExport">导出配置</button>
      </div>
      <!-- 先选导入方式，再选文件（审查 N20） -->
      <fieldset class="import-mode">
        <legend>导入方式</legend>
        <div class="radio">
          <input
            id="import-merge"
            v-model="store.state.importMode"
            type="radio"
            name="import-mode"
            value="merge"
            aria-describedby="import-merge-hint"
          />
          <label for="import-merge">合并（推荐）</label>
          <span id="import-merge-hint" class="hint">同一网站的收起项会合在一起，本机已有的设置不会丢</span>
        </div>
        <div class="radio">
          <input
            id="import-replace"
            v-model="store.state.importMode"
            type="radio"
            name="import-mode"
            value="replace"
            aria-describedby="import-replace-hint"
          />
          <label for="import-replace">整体替换</label>
          <span id="import-replace-hint" class="hint">先删掉本机现有的全部设置，再换成文件里的（导入前会再确认一次）</span>
        </div>
      </fieldset>
      <div class="row">
        <label class="button file-button">
          选择导出文件并导入
          <input type="file" accept="application/json" data-testid="pm-mgmt-import-input" @change="onImport" />
        </label>
      </div>
      <p class="hint" role="status" data-testid="pm-mgmt-import-result">{{ store.state.importResult }}</p>
    </section>

    <!-- 关于 -->
    <section class="card">
      <h3>关于</h3>
      <dl class="about">
        <div class="about-row">
          <dt>版本</dt>
          <dd data-testid="pm-mgmt-version">{{ version }}</dd>
        </div>
        <div class="about-row">
          <dt>仓库</dt>
          <dd><a :href="REPO_URL" target="_blank" rel="noopener noreferrer">github.com/cherishfall/page-mask</a></dd>
        </div>
        <div class="about-row">
          <dt>反馈</dt>
          <dd><a :href="ISSUES_URL" target="_blank" rel="noopener noreferrer">在 GitHub 上反馈问题</a></dd>
        </div>
      </dl>
    </section>

    <!-- 整体替换导入确认：如实列出影响 -->
    <dialog
      ref="replaceDialog"
      aria-labelledby="pm-mgmt-replace-title"
      data-testid="pm-mgmt-replace-dialog"
      @close="onReplaceClose"
    >
      <template v-if="store.state.replaceImpact">
        <h2 id="pm-mgmt-replace-title">用这个文件整体替换现有设置？</h2>
        <ul data-testid="pm-mgmt-replace-impact">
          <li>
            本机现有的 {{ store.state.replaceImpact.localSites }} 个网站、{{ store.state.replaceImpact.localRules }} 个收起项会全部被替换
          </li>
          <li v-if="store.state.replaceImpact.removedOrigins.length > 0">
            其中 {{ store.state.replaceImpact.removedOrigins.length }} 个网站在文件里没有，本机不再保留（共
            {{ store.state.replaceImpact.removedRules }} 个收起项）：{{ store.state.replaceImpact.removedOrigins.map(siteLabelOf).join('、') }}
          </li>
          <li>
            换成文件里的 {{ store.state.replaceImpact.incomingSites }} 个网站、{{ store.state.replaceImpact.incomingRules }} 个收起项
          </li>
          <li v-if="store.state.replaceImpact.replacesSettings">默认标签页标题也会换成文件里的</li>
          <li>这一步不能撤销；不放心的话，先取消并「导出配置」留一份</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>取消</button>
        <button value="confirm" class="primary danger">确认替换</button>
      </form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { browser } from 'wxt/browser';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import { siteLabelOf } from '../site';
import { DEFAULT_KEY, managementStore as store } from '../store';

const REPO_URL = 'https://github.com/cherishfall/page-mask';
const ISSUES_URL = 'https://github.com/cherishfall/page-mask/issues';
const version = browser.runtime.getManifest().version;

const replaceDialog = ref<HTMLDialogElement | null>(null);

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
.view-title {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-1);
}

.card + .card {
  margin-top: var(--pm-space-3);
}

.card h3 {
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

.row input:not([type]) {
  flex: 1;
  min-width: 180px;
}

.row.quick {
  gap: 6px;
  margin-top: -2px;
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
