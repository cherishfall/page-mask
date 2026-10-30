<template>
  <section class="view" aria-labelledby="pm-site-title">
    <a class="back" href="#/sites" data-testid="pm-mgmt-back">{{ t.management.back }}</a>

    <p v-if="!store.state.loaded" class="hint">{{ t.common.loading }}</p>

    <div v-else-if="!profile" class="card empty" data-testid="pm-mgmt-site-missing">
      <h2 id="pm-site-title">{{ t.management.missingTitle }}</h2>
      <p class="hint">{{ t.management.missingHint }}</p>
      <a class="button" href="#/sites">{{ t.management.backShort }}</a>
    </div>

    <template v-else>
      <div class="site-head">
        <h2 id="pm-site-title" class="host">{{ siteLabelOf(profile.origin) }}</h2>
        <div class="switch-row">
          <label for="pm-mgmt-switch">{{ t.common.cleanMode }}</label>
          <input
            id="pm-mgmt-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-mgmt-switch"
            :checked="profile.switchState === 'disguised'"
            :disabled="!!store.state.toggling[profile.origin]"
            @change="onToggle"
          />
        </div>
      </div>

      <!-- 0 条规则时不写「已收起 0 项」：没有内容可收起是很正常的状态 -->
      <p class="state" data-testid="pm-mgmt-count">
        {{ profile.hideRules.length > 0 ? t.common.hiddenCount(profile.hideRules.length) : t.common.hiddenNone }}
        <template v-if="stale.length > 0">
          ·
          <span class="stale" data-testid="pm-mgmt-stale-count">
            <span aria-hidden="true">● </span>{{ t.common.staleCount(stale.length) }}
          </span>
        </template>
      </p>

      <p v-if="store.state.toggleError[profile.origin]" class="hint error" role="alert">
        {{ store.state.toggleError[profile.origin] }}
      </p>

      <div v-if="isPending" class="pending" data-testid="pm-mgmt-pending">
        <span class="badge">{{ t.management.pendingBadge }}</span>
        <span class="hint">{{ t.management.pendingHint }}</span>
        <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="store.authorize([profile.origin])">
          {{ t.management.authorize }}
        </button>
      </div>
      <p v-if="isPending && store.state.authError" class="hint error" role="alert">{{ store.state.authError }}</p>

      <!-- 标签页标题 -->
      <section class="card">
        <h3>{{ t.management.titleHeading }}</h3>
        <p class="hint">{{ t.management.titleIntro }}</p>
        <div class="row">
          <label class="visually-hidden" for="pm-site-title-input">{{ t.management.titleHeading }}</label>
          <input
            id="pm-site-title-input"
            v-model="store.state.drafts[profile.origin]"
            class="title-input"
            data-testid="pm-mgmt-title"
            :placeholder="titlePlaceholder"
            aria-describedby="pm-site-title-hint"
            @focus="store.focus(profile.origin)"
            @blur="store.onBlur(profile.origin)"
            @input="store.onInput(profile.origin)"
            @change="store.saveDraft(profile.origin)"
          />
        </div>
        <div class="row quick" role="group" aria-labelledby="pm-site-title-quick" data-testid="pm-mgmt-title-quick">
          <span id="pm-site-title-quick" class="hint">{{ t.common.quickFill }}</span>
          <button
            v-for="q in QUICK_TITLES"
            :key="q.id"
            type="button"
            class="chip"
            @click="store.pickTitle(profile.origin, q)"
          >
            {{ quickTitleValue(q, locale) }}
          </button>
        </div>
        <p id="pm-site-title-hint" class="hint">
          {{ t.management.titleFootnote(fallbackTitle) }}
        </p>
      </section>

      <!-- 标签页图标 -->
      <section class="card">
        <h3>{{ t.management.iconHeading }}</h3>
        <p class="hint">{{ t.management.iconIntro }}</p>
        <div class="row">
          <span class="row-label">{{ t.management.currentIcon }}</span>
          <img
            v-if="profile.faviconDataUrl"
            class="favicon"
            :src="profile.faviconDataUrl"
            :alt="t.management.currentIconAlt"
            data-testid="pm-mgmt-favicon"
          />
          <span v-else class="hint" data-testid="pm-mgmt-favicon-empty">
            {{ store.state.defaultIcon ? t.management.iconUnsetDefault : t.management.iconUnsetBlank }}
          </span>
          <label class="button file-button">
            {{ iconBusy ? t.common.processing : profile.faviconDataUrl ? t.common.replaceIcon : t.common.uploadIcon }}
            <input
              type="file"
              data-testid="pm-mgmt-icon-input"
              :accept="ICON_SOURCE_TYPES.join(',')"
              aria-describedby="pm-site-icon-hint"
              :disabled="iconBusy"
              @change="onIconChange"
            />
          </label>
          <button
            v-if="profile.faviconDataUrl"
            type="button"
            class="ghost danger"
            data-testid="pm-mgmt-icon-clear"
            @click="clearIcon"
          >
            {{ t.common.clearIcon }}
          </button>
        </div>
        <p id="pm-site-icon-hint" class="hint">
          {{ t.management.iconHint }}
        </p>
        <p v-if="iconError" class="hint error" role="alert" data-testid="pm-mgmt-icon-error">{{ iconError }}</p>
      </section>

      <!-- 收起的内容：只读清单，换方式与重选元素要到页面上做 -->
      <section class="card">
        <h3>{{ t.management.rulesHeading }}</h3>

        <p v-if="profile.hideRules.length === 0" class="hint" data-testid="pm-mgmt-no-rules">
          {{ t.management.rulesEmpty }}
        </p>
        <ul v-else class="rule-list" data-testid="pm-mgmt-rule-list">
          <li
            v-for="r in profile.hideRules"
            :key="r.id"
            class="rule-row"
            :data-rule-id="r.id"
            data-testid="pm-mgmt-rule-row"
          >
            <span class="rule-text">
              <span class="rule-name">{{ r.elementName }}</span>
              <span class="rule-meta">
                <span>{{ t.common.strategy[r.strategy] }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ scopeHumanLabel(r.scope) }}</span>
                <template v-if="r.lastHealth === 'stale'">
                  <span aria-hidden="true">·</span>
                  <span class="stale" data-testid="pm-mgmt-rule-stale"><span aria-hidden="true">● </span>{{ t.common.stale }}</span>
                </template>
              </span>
              <span v-if="r.lastHealth === 'stale'" class="rule-stale-note">
                {{ t.management.ruleStaleNote(r.elementName) }}
              </span>
            </span>
            <button
              type="button"
              class="ghost danger rule-del"
              :data-testid="`pm-mgmt-rule-delete-${r.id}`"
              :aria-label="t.common.deleteNamed(r.elementName)"
              @click="removeRule(r)"
            >
              {{ t.common.delete }}
            </button>
          </li>
        </ul>

        <!-- 删除后 5 秒内可撤销；容器常驻（live region 只有内容出现时才播报） -->
        <div class="undo" :class="{ 'undo-on': !!undo }" role="status" data-testid="pm-mgmt-undo">
          <template v-if="undo">
            <span>{{ t.common.deleted(undo.name) }}</span>
            <button type="button" data-testid="pm-mgmt-undo-btn" @click="undoDelete">{{ t.common.undo }}</button>
          </template>
        </div>

        <p v-if="store.state.ruleError[profile.origin]" class="hint error" role="alert">
          {{ store.state.ruleError[profile.origin] }}
        </p>

        <div class="row">
          <button
            type="button"
            class="primary"
            data-testid="pm-mgmt-edit-on-page"
            :disabled="isPending || editBusy"
            @click="editOnPage"
          >
            {{ editBusy ? t.common.opening : t.management.editOnPage }}
          </button>
        </div>
        <p class="hint" data-testid="pm-mgmt-edit-hint">{{ editHint || editHintDefault }}</p>
      </section>

      <!-- 页脚：删除这个网站的设置（与页面右下角 ⋯ 菜单里的那一项是同一件事、同一个叫法） -->
      <footer class="danger-zone">
        <h3>{{ deleteSiteHeading() }}</h3>
        <p class="hint">{{ deleteSiteImpact() }}</p>
        <button type="button" class="danger" data-testid="pm-mgmt-reset" @click="openReset">{{ deleteSiteAction() }}</button>
        <p v-if="store.state.resetError[profile.origin]" class="hint error" role="alert">
          {{ store.state.resetError[profile.origin] }}
        </p>
      </footer>
    </template>

    <!-- 删除二次确认（原生模态对话框：安全按钮「取消」默认聚焦，危险按钮实底红） -->
    <dialog
      ref="resetDialog"
      aria-labelledby="pm-mgmt-reset-title"
      data-testid="pm-mgmt-reset-dialog"
      @close="onResetClose"
    >
      <template v-if="store.state.resetTarget">
        <h2 id="pm-mgmt-reset-title">
          {{ deleteSiteTitle(siteLabelOf(store.state.resetTarget.origin)) }}
        </h2>
        <p data-testid="pm-mgmt-reset-impact">{{ deleteSiteImpact() }}</p>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus data-testid="pm-mgmt-reset-cancel">{{ t.common.cancel }}</button>
        <button value="confirm" class="primary danger" data-testid="pm-mgmt-reset-confirm">
          {{ deleteSiteAction() }}
        </button>
      </form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { ICON_SOURCE_TYPES } from '@/core/icon';
import { getLocale } from '@/core/i18n';
import { scopeHumanLabel } from '@/core/scope';
import {
  deleteSiteAction,
  deleteSiteHeading,
  deleteSiteImpact,
  deleteSiteTitle,
} from '@/core/site-delete';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import type { HideRule } from '@/core/types';
import { useRuleUndo } from '@/ui/rule-undo';
import { locale, t } from '@/ui/i18n';
import { SITES_HASH } from '../router';
import { normalizeSiteHost, siteHostOf, siteLabelOf, staleRulesOf } from '../site';
import { DEFAULT_KEY, managementStore as store } from '../store';
import { fileToIconDataUrl } from '../tab-icon';

/** 路由参数是网站的 host（`#/sites/<host>`），在名单里找不到就显示「没有这个网站的设置」 */
const props = defineProps<{ host?: string }>();

const profile = computed(() => {
  const host = normalizeSiteHost(props.host ?? '');
  return store.state.profiles.find((p) => siteHostOf(p.origin) === host) ?? null;
});

const stale = computed(() => (profile.value ? staleRulesOf(profile.value) : []));
const isPending = computed(() => (profile.value ? store.state.pendingOrigins.includes(profile.value.origin) : false));

/** 站点没单独设置时的实际标题（全局默认 > 界面语言默认），用作输入框占位与提示 */
const fallbackTitle = computed(() => (store.state.defaultTitle ?? '').trim() || store.languageDefaultTitle);
const titlePlaceholder = computed(() => (store.state.drafts[DEFAULT_KEY] ?? '').trim() || store.languageDefaultTitle);

const resetDialog = ref<HTMLDialogElement | null>(null);
const iconBusy = ref(false);
const iconError = ref('');
const editBusy = ref(false);
const editHint = ref('');

// 删除 / 撤销：与页面内编辑面板共用同一套逻辑（core/rule-undo.ts + ui/rule-undo.ts）
const { pending: undo, remove, undo: undoDelete } = useRuleUndo((update) => {
  const p = profile.value;
  if (p) void store.updateRules(p.origin, update);
});

function onToggle(e: Event) {
  if (profile.value) void store.toggleSite(profile.value, e);
}

function removeRule(rule: HideRule) {
  remove(profile.value?.hideRules ?? [], rule.id);
}

async function onIconChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  const p = profile.value;
  if (!file || !p) return;
  iconBusy.value = true;
  iconError.value = '';
  try {
    const res = await fileToIconDataUrl(file);
    if (!res.ok) {
      iconError.value = res.error;
      return;
    }
    await store.setIcon(p.origin, res.dataUrl);
  } catch {
    iconError.value = t.value.errors.iconSave;
  } finally {
    iconBusy.value = false;
  }
}

async function clearIcon() {
  if (!profile.value) return;
  iconError.value = '';
  try {
    await store.setIcon(profile.value.origin, null);
  } catch {
    iconError.value = t.value.errors.iconClear;
  }
}

/** 编辑入口的结果提示（初始为空：默认显示的是 editHintDefault） */
const editHintDefault = computed(() => t.value.management.editHint);
const EDIT_HINT_KEYS = { opened: 'editOpened', noTab: 'editNoTab', failed: 'editFailed' } as const;

async function editOnPage() {
  const p = profile.value;
  if (!p || editBusy.value) return;
  editBusy.value = true;
  editHint.value = '';
  try {
    const key = EDIT_HINT_KEYS[await store.openPageEditor(p.origin)];
    editHint.value = t.value.management[key];
  } finally {
    editBusy.value = false;
  }
}

async function openReset() {
  if (!profile.value) return;
  store.askReset(profile.value);
  await nextTick();
  resetDialog.value?.showModal();
}

async function onResetClose() {
  const dialog = resetDialog.value;
  const confirmed = dialog?.returnValue === 'confirm';
  if (dialog) dialog.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
  const target = store.state.resetTarget;
  await store.confirmReset(confirmed);
  // 删掉后这一页已经没有内容，回列表（失败时留在本页看提示）
  if (confirmed && target && !store.state.resetError[target.origin]) location.hash = SITES_HASH;
}
</script>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: var(--pm-space-3);
  font-size: var(--pm-font-size-caption);
}

.site-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
}

.site-head .host {
  margin: 0;
  overflow-wrap: anywhere;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--pm-space-2);
  flex: none;
}

.switch-row label {
  cursor: pointer;
}

.state {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: var(--pm-space-2) 0;
}

.stale {
  color: var(--pm-danger);
}

.pending {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--pm-space-2);
  margin: var(--pm-space-2) 0;
}

.pending .hint {
  margin: 0;
}

.card {
  margin-top: var(--pm-space-3);
}

.card h3 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

.row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: var(--pm-space-2) 0;
}

.row-label {
  min-width: 96px;
  color: var(--pm-fg);
}

.title-input {
  flex: 1;
  min-width: 180px;
  inline-size: 100%;
  box-sizing: border-box;
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

/* ── 收起项清单 ── */
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-1);
}

.rule-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pm-space-2);
  padding: var(--pm-space-2) 0;
  border-bottom: 1px solid var(--pm-border);
}

.rule-row:last-child {
  border-bottom: none;
}

.rule-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rule-name {
  font-weight: var(--pm-font-weight-strong);
  overflow-wrap: anywhere;
}

.rule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}

.rule-stale-note {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg);
}

.rule-del {
  flex: none;
  font-size: var(--pm-font-size-caption);
  padding: 2px 10px;
}

/* 撤销条：常驻的 live region，只有内容出现时才播报（空的时候高度为 0，不占位） */
.undo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
  margin-top: var(--pm-space-2);
  border-radius: var(--pm-radius-card);
  padding: 0 var(--pm-space-1);
  color: var(--pm-fg);
}

.undo-on {
  border: 1px solid var(--pm-border-control);
  padding: var(--pm-space-1) var(--pm-space-2);
  background: var(--pm-bg-subtle);
}

/* 页脚的危险操作区：与上面的设置用一条分隔线隔开 */
.danger-zone {
  margin-top: var(--pm-space-4);
  padding-top: var(--pm-space-3);
  border-top: 1px solid var(--pm-border);
}

.danger-zone h3 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

.empty h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

.empty .hint {
  margin-bottom: var(--pm-space-3);
}
</style>
