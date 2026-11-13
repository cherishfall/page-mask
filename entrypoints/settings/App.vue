<template>
  <div class="shell">
    <header class="masthead">
      <!-- 与「全部网站设置」同一个控件、同一个位置（#124）：两页互为兄弟，
           入口都放在页面标题行的右侧，用同一种次要按钮 -->
      <div class="masthead-row">
        <h1>{{ t.settings.title }}</h1>
        <a class="button small" href="management.html#/sites" data-testid="pm-settings-sites-link">
          {{ t.settings.back }}
        </a>
      </div>
    </header>

    <main>
      <p v-if="!store.state.loaded" class="hint">{{ t.common.loading }}</p>

      <template v-else>
        <!-- 界面语言（#57）：三选一，切换即时生效。
             #188 说明位置：intro 讲的是「切换后会发生什么」，跟着它解释的控件走——挪到三个选项下面
             （整屏审查 1：字段的提示写在字段下面） -->
        <section class="card" aria-labelledby="pm-settings-language-heading" data-testid="pm-settings-language">
          <h2 id="pm-settings-language-heading">{{ t.settings.languageHeading }}</h2>
          <!-- 图例保留给读屏（fieldset 的可及名称），视觉上与卡片标题只留一份 -->
          <fieldset class="import-mode">
            <legend class="visually-hidden">{{ t.settings.languageHeading }}</legend>
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
          <p class="hint">{{ t.settings.languageIntro }}</p>
        </section>

        <!-- 默认标题（#188 同词卡头）：卡头「默认标题」与字段标签逐字同名相叠，
             去掉可见字段标签，输入框的可及名指向卡头（aria-labelledby）——
             「默认标题」这个词在卡内只出现一次；t.settings.titleLabel 键与值原样保留 -->
        <section class="card" aria-labelledby="pm-settings-title-heading">
          <div class="card-head pm-info-head pm-info-anchor">
            <h2 id="pm-settings-title-heading">{{ t.settings.titleHeading }}</h2>
            <InfoTip :text="t.settings.titleIntro" :label="t.common.infoLabel" />
          </div>
          <div class="row">
            <input
              id="pm-settings-default-title"
              v-model="store.state.drafts[DEFAULT_KEY]"
              data-testid="pm-settings-default-title"
              :placeholder="store.languageDefaultTitle"
              aria-labelledby="pm-settings-title-heading"
              aria-describedby="pm-settings-title-hint"
              @focus="store.focus(DEFAULT_KEY)"
              @blur="store.onBlur(DEFAULT_KEY)"
              @input="store.onInput(DEFAULT_KEY)"
              @change="store.saveDraft(DEFAULT_KEY)"
              name="default-title"
              autocomplete="off"
            />
          </div>
          <div class="row quick" role="group" aria-labelledby="pm-settings-title-quick">
            <span id="pm-settings-title-quick" class="hint">{{ t.common.quickTitle }}</span>
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

        <!-- 右下角那颗小按钮（#110）：不透明度滑杆 + 真实胶囊预览。
             id="opacity" 是深链锚点（#120）：页面胶囊的「调整不透明度」跳到这一张 -->
        <section id="opacity" class="card" aria-labelledby="pm-settings-toggle-heading" data-testid="pm-settings-toggle">
          <div class="card-head pm-info-head pm-info-anchor">
            <h2 id="pm-settings-toggle-heading">{{ t.settings.toggleHeading }}</h2>
            <InfoTip :text="t.settings.toggleHint" :label="t.common.infoLabel" />
          </div>
          <div class="toggle-preview" aria-hidden="true" inert>
            <FloatingToggle
              state="disguised"
              :position="null"
              site-label="example.com"
              :opacity="previewOpacity"
              preview
            />
          </div>
          <div class="opacity-row">
            <label for="pm-settings-opacity">{{ t.settings.toggleOpacityLabel }}</label>
            <input
              id="pm-settings-opacity"
              v-model.number="opacityDraft"
              type="range"
              min="10"
              max="100"
              step="10"
              data-testid="pm-settings-opacity"
              :aria-valuetext="`${opacityDraft}%`"
              @input="onOpacityInput"
              @change="onOpacityChange"
            />
            <!-- 数值单独成一项：读屏读「百分之三十」，看的人不用猜数字在哪 -->
            <output for="pm-settings-opacity" data-testid="pm-settings-opacity-value">{{ opacityDraft }}%</output>
          </div>
          <!-- 拖动即时改预览；存储在松手（change）时写一次，拖动过程不刷存储 -->
          <p v-if="opacityDraft <= 30" class="hint warn" role="status" data-testid="pm-settings-opacity-low">
            {{ t.settings.toggleOpacityLowHint }}
          </p>
          <p v-if="opacityError" class="hint error" role="alert" data-testid="pm-settings-opacity-error">{{ opacityError }}</p>
        </section>

        <!-- 快捷键（#101）：幕布与整页变灰两条命令（ADR-0020）；改键只能去 Chrome 自己的页面。
             #188 说明位置：intro 解释两行快捷键的行为（哪个临时、哪个按网站记），挪到两行控件下面
             （整屏审查 1：字段的提示写在字段下面），改键入口仍在其后。 -->
        <section class="card" aria-labelledby="pm-settings-shortcut-heading" data-testid="pm-settings-shortcut">
          <h2 id="pm-settings-shortcut-heading">{{ t.settings.shortcutHeading }}</h2>
          <div class="row">
            <span class="row-label">{{ t.settings.shortcutLabel }}</span>
            <kbd v-if="shortcutLabel" class="pm-kbd" data-testid="pm-settings-shortcut-value">{{ shortcutLabel }}</kbd>
            <span v-else-if="shortcutLoaded" class="pm-mark pm-mark-warning" data-testid="pm-settings-shortcut-unbound">
              <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.settings.shortcutUnbound }}
            </span>
          </div>
          <!-- 整页变灰快捷键（0.9.2）：与遮住同一张卡、同一套展示口径（当前实际绑定 / 未绑定警告） -->
          <div class="row">
            <span class="row-label">{{ t.settings.shortcutGrayLabel }}</span>
            <kbd v-if="grayShortcut" class="pm-kbd" data-testid="pm-settings-shortcut-gray-value">{{ grayShortcut }}</kbd>
            <span v-else-if="shortcutLoaded" class="pm-mark pm-mark-warning" data-testid="pm-settings-shortcut-gray-unbound">
              <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.settings.shortcutUnbound }}
            </span>
          </div>
          <p class="hint">{{ t.settings.shortcutIntro }}</p>
          <!-- 改键入口归整张卡、不挂在第一行：Chrome 不允许扩展自己改绑定，只能把用户送到它自己的页面。
               放在两行之后，任一行没绑上时都看得见下一步（Nielsen 9：说清发生了什么、怎么办）。
               #188 文字入口规则：单独一行的文字按钮（按钮档，Ant 文字按钮口径），不带下划线，
               「能点」由悬停出浅灰底表达。 -->
          <div class="row">
            <button type="button" class="ghost" data-testid="pm-settings-shortcut-change" @click="openShortcutSettings">
              {{ t.settings.shortcutChange }}
            </button>
          </div>
          <p v-if="shortcutOpenFailed" class="hint error" role="alert" data-testid="pm-settings-shortcut-error">
            {{ t.settings.shortcutOpenFailed }}
          </p>
        </section>

        <!-- 导出 / 导入 -->
        <section class="card" aria-labelledby="pm-settings-transfer-heading">
          <div class="card-head pm-info-head pm-info-anchor">
            <h2 id="pm-settings-transfer-heading">{{ t.settings.transferHeading }}</h2>
            <InfoTip :text="t.settings.transferIntro" :label="t.common.infoLabel" />
          </div>
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
            <div class="about-row">
              <dt>{{ t.settings.privacyPolicy }}</dt>
              <dd><a :href="PRIVACY_URL" target="_blank" rel="noopener noreferrer">cherishfall.github.io/privacy.html</a></dd>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { localeName } from '@/core/i18n';
import { formatShortcut, isMacPlatform } from '@/core/shortcut';
import FloatingToggle from '@/ui/FloatingToggle.vue';
import InfoTip from '@/ui/info-tip/InfoTip';
import { ensureTogglePreviewStyles } from '@/ui/toggle/preview-style';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import { locale, t } from '@/ui/i18n';
import { siteLabelOf } from '../management/site';
import { DEFAULT_KEY, managementStore as store } from '../management/store';

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
/**
 * 隐私政策（#193）：指向 GitHub Pages 上的在线版，不用仓库 blob 链接——
 * 商店审核员没有登录态，仓库是否公开由作者决定，页面托管与仓库公开与否解耦。
 */
const PRIVACY_URL = 'https://cherishfall.github.io/privacy.html';
const version = browser.runtime.getManifest().version;

const replaceDialog = ref<HTMLDialogElement | null>(null);

/**
 * 快捷键（#101）：显示 Chrome 里**当前实际绑定**的值（用户改过就显示改后的），
 * 未绑定时给出警告；改键只能去 chrome://extensions/shortcuts，这里只提供入口。
 */
const shortcut = ref('');
const grayShortcutRaw = ref('');
const shortcutLoaded = ref(false);
const shortcutOpenFailed = ref(false);
const shortcutLabel = computed(() => formatShortcut(shortcut.value, isMacPlatform()));
const grayShortcut = computed(() => formatShortcut(grayShortcutRaw.value, isMacPlatform()));

async function refreshShortcut() {
  try {
    const commands = await browser.commands.getAll();
    const find = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? '';
    shortcut.value = find('toggle-curtain');
    grayShortcutRaw.value = find('toggle-media-gray');
  } catch {
    shortcut.value = '';
    grayShortcutRaw.value = '';
  }
  shortcutLoaded.value = true;
}

/**
 * 胶囊闲置不透明度（#110）：一根 10%–100% 的滑杆。
 * input（拖动中 / 键盘调整中）即时改预览；change（松手）才写存储，避免拖动过程每 10ms 刷一次存储。
 */
const opacityDraft = ref(Math.round(store.state.toggleOpacity * 100));
/** 预览跟随拖动即时变；存储被别处改动（导入 / 另一标签页）时也跟着回真实值 */
const previewOpacity = ref(store.state.toggleOpacity);
const opacityError = ref('');
watch(
  () => store.state.toggleOpacity,
  (v) => {
    opacityDraft.value = Math.round(v * 100);
    previewOpacity.value = v;
  },
);

function onOpacityInput(e: Event) {
  // 从事件目标取值：v-model 与本监听都挂在 input 上，不依赖两者的触发顺序
  const v = Number((e.target as HTMLInputElement).value);
  opacityDraft.value = v;
  previewOpacity.value = v / 100;
}

async function onOpacityChange() {
  try {
    await store.setToggleOpacity(opacityDraft.value / 100);
    opacityError.value = '';
  } catch {
    // 写入失败：控件与预览回滚到存储里的实际值（不禁用滑杆，错误说明白就行）
    opacityDraft.value = Math.round(store.state.toggleOpacity * 100);
    previewOpacity.value = store.state.toggleOpacity;
    opacityError.value = t.value.settings.toggleOpacityError;
  }
}

async function openShortcutSettings() {
  shortcutOpenFailed.value = false;
  try {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch {
    // 某些浏览器版本不允许扩展打开这个内部页面：退化成一句可以照着输入的地址
    shortcutOpenFailed.value = true;
  }
}

/**
 * 深链（#120）：页面胶囊的「调整不透明度」打开 settings.html#opacity ——
 * 滚到那张卡、焦点落在滑杆上、短暂描边高亮。
 * 高亮用 outline（形状线索）而不是只改颜色，WCAG 1.4.1；reduced-motion 下不做平滑滚动。
 */
const HASH_TARGETS: Record<string, string> = { '#opacity': 'opacity' };
let highlightTimer = 0;

function jumpToHashTarget(): void {
  const id = HASH_TARGETS[location.hash];
  if (!id) return;
  const card = document.getElementById(id);
  if (!card) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  card.querySelector<HTMLInputElement>('[data-testid="pm-settings-opacity"]')?.focus({ preventScroll: true });
  card.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  card.classList.add('target');
  window.clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => card.classList.remove('target'), 1600);
}

// 卡片在 store 载入后才渲染（v-else）：等 loaded 再跳
watch(
  () => store.state.loaded,
  (ok) => {
    if (ok) void nextTick(jumpToHashTarget);
  },
  { immediate: true },
);

/** 快捷键在 Chrome 自己的页面里改，扩展收不到「绑定变了」的通知：
 *  focus 覆盖「切到别的窗口再回来」，visibilitychange 覆盖「同一窗口里切走再切回标签页」。
 *  后者是改完键回来的常见路径——Chrome 快捷键页是新标签页，窗口焦点根本没变，只听 focus 会漏。 */
function onShortcutSurfaceVisible(): void {
  if (document.visibilityState === 'visible') void refreshShortcut();
}

onMounted(() => {
  void store.init();
  void refreshShortcut();
  // 预览用的是真实胶囊组件：把同一份 toggle.css 注入本页一次（shadow 版走 adoptedStyleSheets）
  ensureTogglePreviewStyles();
  window.addEventListener('focus', refreshShortcut);
  document.addEventListener('visibilitychange', onShortcutSurfaceVisible);
  // 设置页已经开着时再点一次菜单项，也要能跳过去（只改 hash 不重新加载文档）
  window.addEventListener('hashchange', jumpToHashTarget);
});
onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshShortcut);
  document.removeEventListener('visibilitychange', onShortcutSurfaceVisible);
  window.removeEventListener('hashchange', jumpToHashTarget);
  window.clearTimeout(highlightTimer);
});


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

/* 标题行右侧给「全部网站设置」入口：与「插件设置」按钮同一套次要按钮（#124） */
.masthead-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
}

.masthead h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}

.card {
  margin-top: var(--pm-space-3);
  /* 深链跳过来时别贴着视口边缘（#120） */
  scroll-margin-block: 24px;
}

/* 深链落点：描边是形状线索，不是只靠颜色（WCAG 1.4.1）；1.6 秒后由脚本撤掉 */
.card.target {
  outline: 2px solid var(--pm-accent);
  outline-offset: 4px;
}

.card h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

/* #161：卡片级说明收进 ⓘ 时，图标跟标题同一行（与弹窗「标签 + ⓘ」同一形态）；
   标题的下边距移到这一行上，避免图标独占一行还多出一段空白 */
.card-head {
  margin-bottom: var(--pm-space-2);
}
.card-head h2 {
  margin: 0;
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

/* 胶囊预览（#102）：一块浅底示意区，里面是真实组件（position: static 由 .pm-tg-preview 负责） */
.toggle-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: 72px;
  margin: var(--pm-space-2) 0;
  padding: var(--pm-space-3);
  border: 1px dashed var(--pm-border);
  border-radius: var(--pm-radius-control);
  background: var(--pm-bg-subtle);
}

/* 不透明度滑杆（#110）：标签、滑杆、数值一行排开。
 * 滑杆本体用 Chromium 原生渲染（原生即 4px 轨道 / 16px 滑块，accent-color 已全局指向主色，
 * forced-colors 下自动用系统色）；这里只定尺寸与可点区。 */
.opacity-row {
  display: flex;
  align-items: center;
  gap: var(--pm-space-3);
  margin: var(--pm-space-2) 0;
}
.opacity-row label {
  flex: none;
}
.opacity-row input[type='range'] {
  flex: 1;
  min-inline-size: 160px;
  min-block-size: 24px; /* 触屏可点区下限（WCAG 2.5.8）；原生滑块本体 16px */
  margin: 0;
}
.opacity-row output {
  flex: none;
  min-inline-size: 44px; /* 「100%」不换行 */
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 键帽样式走 styles/controls.css 的 .pm-kbd（#171 统一），这里不再各写一份 */

.row input:not([type]) {
  flex: 1;
  min-width: 180px;
}

.row.quick {
  gap: 6px;
  margin-top: -2px;
}

/* radio 组裸排（#191）：不再套一层带边内盒——全项目只有这里的单选组外多画了一圈框，
   与其他卡的裸排不一致；边框盒去掉后，语言卡（图例留给读屏）与导入方式（可见图例）
   两处共用这条规则一起变。字段组的分组感由行距与图例承担，不靠框 */
.import-mode {
  border: 0;
  margin: var(--pm-space-3) 0 var(--pm-space-2);
  padding: 0;
}

.import-mode legend {
  padding: 0;
}

.radio {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  /* 不留 gap（间距收进 label 的 padding，都是命中区，单选行没有点不着的死区） */
  gap: 0;
  margin: var(--pm-space-1) 0;
}
.radio label {
  padding: 3px 8px 3px 6px; /* 与圆点的间距 + 上下命中区补偿（负 margin 抵消，视觉不变） */
  margin: -3px 0;
  cursor: pointer;
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

/* 「关于」两列：标签一列、值一列，各行值起点对齐（#193 加了「隐私政策」一行后，
   标签宽度不齐会让值一列参差——英文的 Repository / Feedback / Privacy policy 本来就参差）。
   grid + display:contents 让 dl 保持 dl 语义（读屏仍认 term/definition）；
   row-gap 取 --pm-space-1，与旧布局行间 4px 的间距一致 */
.about {
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: var(--pm-space-3);
  row-gap: var(--pm-space-1);
}

.about-row {
  display: contents;
}

.about-row dt {
  color: var(--pm-fg-muted);
}

.about-row dd {
  margin: 0;
  overflow-wrap: anywhere;
}

/* 「关于」两条外链（#188 文字入口规则：导航链接，下划线来自 base.css 默认）。
   命中区补偿（WCAG 2.5.8）：13px 文字链接垫到 ≥24，负 margin 抵消，视觉不变 */
.about-row dd a {
  display: inline-block;
  padding: 3px 0;
  margin: -3px 0;
}
</style>
