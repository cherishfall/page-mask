<template>
  <section class="view" aria-labelledby="pm-site-title">
    <a class="back" href="#/sites" data-testid="pm-mgmt-back">← 返回网站列表</a>

    <p v-if="!store.state.loaded" class="hint">正在读取…</p>

    <div v-else-if="!profile" class="card empty" data-testid="pm-mgmt-site-missing">
      <h2 id="pm-site-title">没有这个网站的设置</h2>
      <p class="hint">打开这个网站，点浏览器工具栏上的 PageMask 图标，就能为它开启清爽模式。</p>
      <a class="button" href="#/sites">回到网站列表</a>
    </div>

    <template v-else>
      <div class="site-head">
        <h2 id="pm-site-title" class="host">{{ siteLabelOf(profile.origin) }}</h2>
        <div class="switch-row">
          <label for="pm-mgmt-switch">清爽模式</label>
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
        {{ profile.hideRules.length > 0 ? `已收起 ${profile.hideRules.length} 项` : '没有收起任何内容' }}
        <template v-if="stale.length > 0">
          ·
          <span class="stale" data-testid="pm-mgmt-stale-count">
            <span aria-hidden="true">● </span>{{ stale.length }} 项可能失效
          </span>
        </template>
      </p>

      <p v-if="store.state.toggleError[profile.origin]" class="hint error" role="alert">
        {{ store.state.toggleError[profile.origin] }}
      </p>

      <div v-if="isPending" class="pending" data-testid="pm-mgmt-pending">
        <span class="badge">待授权</span>
        <span class="hint">浏览器没有这个网站的访问权限，设置都还在，授权后立即生效。</span>
        <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="store.authorize([profile.origin])">
          授权并启用
        </button>
      </div>
      <p v-if="isPending && store.state.authError" class="hint error" role="alert">{{ store.state.authError }}</p>

      <!-- 标签页标题 -->
      <section class="card">
        <h3>标签页标题</h3>
        <p class="hint">清爽模式下，这个网站的标签页显示这段文字。</p>
        <div class="row">
          <label class="visually-hidden" for="pm-site-title-input">标签页标题</label>
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
          <span id="pm-site-title-quick" class="hint">快捷填入</span>
          <button
            v-for="q in QUICK_TITLES"
            :key="q.label"
            type="button"
            class="chip"
            @click="store.pickTitle(profile.origin, q)"
          >
            {{ quickTitleValue(q, store.uiLanguage) }}
          </button>
        </div>
        <p id="pm-site-title-hint" class="hint">
          停止输入后自动保存。留空则用「{{ fallbackTitle }}」；标题不会留成空白——空白时 Chrome 会改为显示网址。
        </p>
      </section>

      <!-- 标签页图标 -->
      <section class="card">
        <h3>标签页图标</h3>
        <p class="hint">清爽模式下替换这个网站的标签页图标。</p>
        <div class="row">
          <span class="row-label">当前图标</span>
          <img
            v-if="profile.faviconDataUrl"
            class="favicon"
            :src="profile.faviconDataUrl"
            alt="当前的标签页图标"
            data-testid="pm-mgmt-favicon"
          />
          <span v-else class="hint" data-testid="pm-mgmt-favicon-empty">未设置：标签页上不显示图标</span>
          <label class="button file-button">
            {{ iconBusy ? '正在处理…' : profile.faviconDataUrl ? '换一张图标' : '上传图标' }}
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
            清除图标
          </button>
        </div>
        <p id="pm-site-icon-hint" class="hint">PNG、JPG、GIF、WebP 或 ICO，不超过 5MB，会自动缩小成 32×32。</p>
        <p v-if="iconError" class="hint error" role="alert" data-testid="pm-mgmt-icon-error">{{ iconError }}</p>
      </section>

      <!-- 已收起的项：只读清单，换方式与重选元素要到页面上做 -->
      <section class="card">
        <h3>已收起的项</h3>

        <p v-if="profile.hideRules.length === 0" class="hint" data-testid="pm-mgmt-no-rules">
          没有收起任何内容。点下面的「在页面上编辑」到网站上挑要收起的东西。
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
                <span>{{ STRATEGY_LABEL[r.strategy] }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ scopeHumanLabel(r.scope) }}</span>
                <template v-if="r.lastHealth === 'stale'">
                  <span aria-hidden="true">·</span>
                  <span class="stale" data-testid="pm-mgmt-rule-stale"><span aria-hidden="true">● </span>可能失效</span>
                </template>
              </span>
              <span v-if="r.lastHealth === 'stale'" class="rule-stale-note">
                「{{ r.elementName }}」最近没找到，可能网站改版了；打开这个网站重新选一次。
              </span>
            </span>
            <button
              type="button"
              class="ghost danger rule-del"
              :data-testid="`pm-mgmt-rule-delete-${r.id}`"
              :aria-label="`删除「${r.elementName}」`"
              @click="removeRule(r)"
            >
              删除
            </button>
          </li>
        </ul>

        <!-- 删除后 5 秒内可撤销；容器常驻（live region 只有内容出现时才播报） -->
        <div class="undo" :class="{ 'undo-on': !!undo }" role="status" data-testid="pm-mgmt-undo">
          <template v-if="undo">
            <span>已删除「{{ undo.name }}」</span>
            <button type="button" data-testid="pm-mgmt-undo-btn" @click="undoDelete">撤销</button>
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
            {{ editBusy ? '正在打开…' : '在页面上编辑' }}
          </button>
        </div>
        <p class="hint" data-testid="pm-mgmt-edit-hint">{{ editHint }}</p>
      </section>

      <!-- 页脚：一键清空（入口只在这里，列表行上不再有） -->
      <footer class="danger-zone">
        <h3>清空这个网站</h3>
        <p class="hint">删掉这个网站的全部设置，收回浏览器的访问权限，网站回到从未添加过的状态。</p>
        <button type="button" class="danger" data-testid="pm-mgmt-reset" @click="openReset">一键清空</button>
        <p v-if="store.state.resetError[profile.origin]" class="hint error" role="alert">
          {{ store.state.resetError[profile.origin] }}
        </p>
      </footer>
    </template>

    <!-- 一键清空二次确认（原生模态对话框，安全按钮「取消」默认聚焦） -->
    <dialog
      ref="resetDialog"
      aria-labelledby="pm-mgmt-reset-title"
      data-testid="pm-mgmt-reset-dialog"
      @close="onResetClose"
    >
      <template v-if="store.state.resetTarget">
        <h2 id="pm-mgmt-reset-title">清空 {{ siteLabelOf(store.state.resetTarget.origin) }} 的全部设置？</h2>
        <ul data-testid="pm-mgmt-reset-impact">
          <!-- 0 条时不出现「0 个收起项会被删除」这种说法：整行不出现 -->
          <li v-if="store.state.resetTarget.hideRules.length > 0">
            {{ store.state.resetTarget.hideRules.length }} 个收起项会被删除
          </li>
          <li>这个网站设置的标签页标题与图标会被删除</li>
          <li>这个网站回到从未设置过的状态，页面上的悬浮按钮随之消失</li>
          <li>浏览器对这个网站的访问权限会被收回（下次设置需要重新允许）</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>取消</button>
        <button value="confirm" class="primary danger">确认清空</button>
      </form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { ICON_SOURCE_TYPES } from '@/core/icon';
import { scopeHumanLabel } from '@/core/scope';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import { STRATEGY_LABEL, type HideRule } from '@/core/types';
import { useRuleUndo } from '@/ui/rule-undo';
import { SITES_HASH } from '../router';
import { normalizeSiteHost, siteHostOf, siteLabelOf, staleRulesOf } from '../site';
import { DEFAULT_KEY, managementStore as store } from '../store';
import { fileToIconDataUrl } from '../tab-icon';

const props = defineProps<{ host: string }>();

const profile = computed(() => {
  const host = normalizeSiteHost(props.host);
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
const editHint = ref('换收起方式、重新选元素都要页面上下文，在网站的页面上改，改动即时生效。');

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
    iconError.value = '没能保存图标，请再试一次';
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
    iconError.value = '没能清除图标，请再试一次';
  }
}

const EDIT_HINT: Record<'opened' | 'noTab' | 'failed', string> = {
  opened: '已在那个网站的标签页里打开编辑面板。',
  noTab: '这个网站没有打开的标签页：先打开它，再回来点「在页面上编辑」。',
  failed: '没能打开编辑面板，刷新那个网站的页面后再试一次。',
};

async function editOnPage() {
  const p = profile.value;
  if (!p || editBusy.value) return;
  editBusy.value = true;
  editHint.value = '';
  try {
    editHint.value = EDIT_HINT[await store.openPageEditor(p.origin)];
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
  // 清空后这一页已经没有内容，回列表（失败时留在本页看提示）
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
