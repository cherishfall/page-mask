<template>
  <div class="shell">
    <a class="back" href="management.html#/sites" data-testid="pm-settings-back">← 你添加的网站</a>

    <header class="masthead">
      <h1>插件设置</h1>
      <p class="sub">这里的设置对所有网站生效。</p>
    </header>

    <main>
      <p v-if="!store.state.loaded" class="hint">正在读取…</p>

      <template v-else>
        <!-- 默认标题 -->
        <section class="card" aria-labelledby="pm-settings-title-heading">
          <h2 id="pm-settings-title-heading">默认标题</h2>
          <p class="hint">网站没有单独设置标题时，清爽模式的标签页显示这段文字。</p>
          <div class="row">
            <label for="pm-settings-default-title">默认标签页标题</label>
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
            <span id="pm-settings-title-quick" class="hint">快捷填入</span>
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
          <p id="pm-settings-title-hint" class="hint">
            留空则用「{{ store.languageDefaultTitle }}」（跟随浏览器语言）。标签页标题不会留成空白：空白时 Chrome 会改为显示网址。
          </p>
        </section>

        <!-- 默认图标 -->
        <section class="card" aria-labelledby="pm-settings-icon-heading">
          <h2 id="pm-settings-icon-heading">默认图标</h2>
          <p class="hint">
            网站自己没有设置图标时，清爽模式的标签页用这张图。改这里，没单独设过图标的网站会一起变。
          </p>
          <div class="row">
            <span class="row-label">当前默认图标</span>
            <img
              v-if="store.state.defaultIcon"
              class="favicon"
              :src="store.state.defaultIcon"
              alt="当前的默认图标"
              data-testid="pm-settings-default-icon"
            />
            <span v-else class="hint" data-testid="pm-settings-default-icon-empty">未设置：标签页上不显示图标</span>
            <label class="button file-button">
              {{ iconBusy ? '正在处理…' : store.state.defaultIcon ? '换一张图标' : '上传图标' }}
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
              清除图标
            </button>
          </div>
          <p id="pm-settings-icon-hint" class="hint">
            PNG、JPG、GIF、WebP 或 ICO，不超过 5MB，会自动缩小成 32×32。网站自己的图标优先，这里和网站都没设时标签页上不显示图标。
          </p>
          <p v-if="iconError" class="hint error" role="alert" data-testid="pm-settings-icon-error">{{ iconError }}</p>
        </section>

        <!-- 导出 / 导入 -->
        <section class="card" aria-labelledby="pm-settings-transfer-heading">
          <h2 id="pm-settings-transfer-heading">导出 / 导入</h2>
          <p class="hint">把全部网站的设置和这里的插件设置存成一个文件；换电脑或重装浏览器后导入，就能恢复。</p>
          <div class="row">
            <button type="button" class="primary" data-testid="pm-settings-export" @click="store.doExport">
              导出配置
            </button>
          </div>
          <!-- 先选导入方式，再选文件（审查 N20） -->
          <fieldset class="import-mode">
            <legend>导入方式</legend>
            <div class="radio">
              <input
                id="pm-settings-import-merge"
                v-model="store.state.importMode"
                type="radio"
                name="pm-settings-import-mode"
                value="merge"
                aria-describedby="pm-settings-import-merge-hint"
              />
              <label for="pm-settings-import-merge">合并（推荐）</label>
              <span id="pm-settings-import-merge-hint" class="hint">同一网站的收起项会合在一起，本机已有的设置不会丢</span>
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
              <label for="pm-settings-import-replace">整体替换</label>
              <span id="pm-settings-import-replace-hint" class="hint">先删掉本机现有的全部设置，再换成文件里的（导入前会再确认一次）</span>
            </div>
          </fieldset>
          <div class="row">
            <label class="button file-button">
              选择导出文件并导入
              <input type="file" accept="application/json" data-testid="pm-settings-import-input" @change="onImport" />
            </label>
          </div>
          <p class="hint" role="status" data-testid="pm-settings-import-result">{{ store.state.importResult }}</p>
        </section>

        <!-- 关于 -->
        <section class="card" aria-labelledby="pm-settings-about-heading">
          <h2 id="pm-settings-about-heading">关于</h2>
          <dl class="about">
            <div class="about-row">
              <dt>版本</dt>
              <dd data-testid="pm-settings-version">{{ version }}</dd>
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
        <h2 id="pm-settings-replace-title">用这个文件整体替换现有设置？</h2>
        <ul data-testid="pm-settings-replace-impact">
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
          <li v-if="store.state.replaceImpact.replacesSettings">插件设置（默认标题、默认图标）也会换成文件里的</li>
          <li>这一步不能撤销；不放心的话，先取消并「导出配置」留一份</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>取消</button>
        <button value="confirm" class="primary danger">确认替换</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { ICON_SOURCE_TYPES } from '@/core/icon';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import { siteLabelOf } from '../management/site';
import { DEFAULT_KEY, managementStore as store } from '../management/store';
import { fileToIconDataUrl } from '../management/tab-icon';

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
    iconError.value = '没能保存图标，请再试一次';
  } finally {
    iconBusy.value = false;
  }
}

async function clearIcon() {
  iconError.value = '';
  try {
    await store.setDefaultIcon(null);
  } catch {
    iconError.value = '没能清除图标，请再试一次';
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
