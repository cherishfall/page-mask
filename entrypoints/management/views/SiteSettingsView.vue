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
          <!-- 切换期间不禁用：再拨一次由 store 忽略并拨回实际状态，失败原因写在这一块下面那行提示里 -->
          <input
            id="pm-mgmt-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-mgmt-switch"
            :checked="profile.switchState === 'disguised'"
            :aria-describedby="switchEmpty ? 'pm-mgmt-switch-empty' : undefined"
            @change="onToggle"
          />
        </div>
      </div>

      <!-- 空设置的事前说明（#158）：页头开关下面一句短句，与弹窗 / 胶囊同一句话、同一个判断。
           只有灰度时仍然显示（灰度不受这个开关管）；有了收起内容或改过标题图标就自动消失 -->
      <p v-if="switchEmpty" id="pm-mgmt-switch-empty" class="hint switch-empty-hint" data-testid="pm-mgmt-switch-empty">
        {{ t.common.switchNoEffectHint }}
      </p>

      <!-- 0 条规则时不写「已收起 0 项」：没有内容可收起是很正常的状态 -->
      <p class="state" data-testid="pm-mgmt-count">
        {{ profile.hideRules.length > 0 ? t.common.hiddenCount(profile.hideRules.length) : t.common.hiddenNone }}
        <template v-if="stale.length > 0">
          ·
          <span class="pm-mark pm-mark-danger" data-testid="pm-mgmt-stale-count">
            <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.common.staleCount(stale.length) }}
          </span>
        </template>
      </p>

      <p v-if="store.state.toggleError[profile.origin]" class="hint error" role="alert">
        {{ store.state.toggleError[profile.origin] }}
      </p>

      <div v-if="isPending" class="pending" data-testid="pm-mgmt-pending">
        <span class="pm-mark pm-mark-warning">
          <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.management.pendingBadge }}
        </span>
        <span class="hint">{{ t.management.pendingHint }}</span>
        <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="store.authorize([profile.origin])">
          {{ t.management.authorize }}
        </button>
      </div>
      <p v-if="isPending && store.state.authError" class="hint error" role="alert">{{ store.state.authError }}</p>

      <!-- 标签页标题 -->
      <section class="card" data-testid="pm-mgmt-card-title">
        <h3>{{ t.management.titleHeading }}</h3>
        <p class="hint">{{ t.management.titleIntro }}</p>
        <div class="row">
          <label class="visually-hidden" for="pm-site-title-input">{{ t.management.titleHeading }}</label>
          <input
            id="pm-site-title-input"
            name="site-title"
            autocomplete="off"
            maxlength="60"
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
          <span id="pm-site-title-quick" class="hint">{{ t.common.quickTitle }}</span>
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
          {{ profile.titleIconSet ? t.management.titleFootnote(fallbackTitle) : t.management.titleFootnoteUnset }}
        </p>
      </section>

      <!-- 标签页图标（#121）：三态选择器，与向导共用同一个组件 -->
      <section class="card" data-testid="pm-mgmt-card-icon">
        <h3>{{ t.management.iconHeading }}</h3>
        <p class="hint">{{ t.management.iconIntro }}</p>
        <IconPicker
          :model-value="profile.icon"
          id-prefix="pm-mgmt"
          hide-legend
          @update:model-value="onIconPick"
        />
        <p v-if="iconError" class="hint error" role="alert" data-testid="pm-mgmt-icon-error">{{ iconError }}</p>
      </section>

      <!-- 回退出口（#99）：保存过标题和图标才出现；只撤销这两项，不动收起的内容 -->
      <div v-if="profile.titleIconSet" class="row reset-row" data-testid="pm-mgmt-title-reset-row">
        <button type="button" class="ghost" data-testid="pm-mgmt-title-reset" @click="resetTitleIcon">
          {{ t.common.resetTitleIcon }}
        </button>
        <span class="hint">{{ t.common.resetTitleIconHint }}</span>
      </div>

      <!-- 收起的内容：只读清单，换方式与重选元素要到页面上做 -->
      <section class="card" data-testid="pm-mgmt-card-rules">
        <h3 ref="rulesHeading" tabindex="-1" data-testid="pm-mgmt-rules-heading">{{ t.management.rulesHeading }}</h3>

        <p v-if="profile.hideRules.length === 0" class="hint" data-testid="pm-mgmt-no-rules">
          {{ t.management.rulesEmpty }}
        </p>
        <ul v-else class="rule-list" data-testid="pm-mgmt-rule-list">
          <li
            v-for="(r, i) in profile.hideRules"
            :key="r.id"
            class="rule-row"
            :data-rule-id="r.id"
            data-testid="pm-mgmt-rule-row"
          >
            <span class="rule-text">
              <!-- 序号（#175 视觉审查）：自动命名的同名条目（如三行「推荐卡片」）靠序号分辨，
                   删除时不会张冠李戴——与向导清单 1. 2. 3. 同一惯例；aria-hidden，行内的
                   名称与摘要已足够读屏理解，不把「1.」念出来 -->
              <span class="rule-name"><span class="rule-num" aria-hidden="true">{{ i + 1 }}. </span>{{ r.elementName }}</span>
              <span class="rule-meta">
                <span>{{ t.common.strategy[r.strategy] }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ scopeHumanLabel(r.scope) }}</span>
                <template v-if="r.lastHealth === 'stale'">
                  <span aria-hidden="true">·</span>
                  <span class="pm-mark pm-mark-danger" data-testid="pm-mgmt-rule-stale">
                    <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.common.stale }}
                  </span>
                </template>
              </span>
              <span v-if="r.lastHealth === 'stale'" class="rule-stale-note">
                {{ t.management.ruleStaleNote(r.elementName) }}
              </span>
            </span>
            <button
              type="button"
              class="ghost pm-icon-btn"
              :data-testid="`pm-mgmt-rule-delete-${r.id}`"
              :aria-label="t.common.deleteNamed(r.elementName)"
              @click="removeRule(r)"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        </ul>

        <!-- 删除后 5 秒内可撤销；容器常驻（live region 只有内容出现时才播报） -->
        <div class="undo" :class="{ 'undo-on': !!undo }" role="status" data-testid="pm-mgmt-undo">
          <template v-if="undo">
            <span>{{ t.common.deleted(undo.name) }}</span>
            <button type="button" class="ghost small" data-testid="pm-mgmt-undo-btn" @click="undoDelete">
              {{ t.common.undo }}
            </button>
          </template>
        </div>

        <p v-if="store.state.ruleError[profile.origin]" class="hint error" role="alert">
          {{ store.state.ruleError[profile.origin] }}
        </p>

        <!-- 回退出口（#160）：与 #99 那颗对称，只在确实有已保存的收起项时出现；
             确认后整份列表清空，所以触发按钮自己也会随之消失 -->
        <div v-if="profile.hideRules.length > 0" class="row reset-row" data-testid="pm-mgmt-rules-reset-row">
          <button type="button" class="ghost" data-testid="pm-mgmt-rules-reset" @click="rulesResetOpen = true">
            {{ t.common.resetSiteContent }}
          </button>
          <span class="hint">{{ t.common.resetSiteContentHint }}</span>
        </div>
        <ClearRulesDialog
          v-if="rulesResetOpen"
          :count="profile.hideRules.length"
          @closed="onRulesResetClosed"
        />

        <!-- 这一页只读清单：换成怎么收、重选元素都要页面上下文，所以指回页面（#71）。
             #161：这是「完成操作必需」的边界坑（a 类），常驻但压成一句短句；
             Carbon 明确 pertinent 信息不进 tooltip，别收进 ⓘ。 -->
        <p class="hint" data-testid="pm-mgmt-edit-hint">{{ t.management.rulesEditHint }}</p>
      </section>

      <!-- 整页变灰（0.8.0 #131；0.8.18 #156 升级为整页灰）：一个开关按站点记，与弹窗 / 胶囊媒体钮
           共用同一份键与文案。#157 起排在「收起的内容」之后、危险区之前——三处相对顺序统一，
           权威对照表见 docs/design-surfaces.md；卡片标题与开关同叫法（t.media.heading）。 -->
      <section class="card" aria-labelledby="pm-site-media-heading" data-testid="pm-mgmt-card-media">
        <h3 id="pm-site-media-heading">{{ t.media.heading }}</h3>
        <div class="media-rows" role="group" :aria-label="t.media.heading">
          <div v-for="key in MEDIA_FLAG_KEYS" :key="key" class="media-row">
            <!-- ⓘ 的宿主行（#183）：pm-info-anchor 让气泡锚定整行（漏了它气泡贴到页面头上、
                 视口外，用户只见问号光标）；label margin-inline-end:auto 把 ⓘ + 开关推到行尾——
                 与弹窗 #181 同款写法。守门：tests/info-tip-anchor.test.ts（静态）+
                 tests/e2e/check-info-tips.mjs（真机 hover）。 -->
            <div class="switch-row media-switch pm-info-anchor">
              <label :for="`pm-mgmt-media-${key}`">{{ t.media[key] }}</label>
              <!-- ⓘ（#174 / #175 视觉审查）：卡底那条「独立于主开关 + 不是不加载」的注脚改成行内 ⓘ，
                   与弹窗同构——0.8.18 后卡里只有一个开关，「组级注脚」的定位已失，两段常驻说明叠加
                   违反 design-copy「先删零风险重复」。media.hint 键与其内容保留（design-copy 必须留下清单） -->
              <InfoTip :text="t.media.hint" :label="t.common.infoLabel" />
              <input
                :id="`pm-mgmt-media-${key}`"
                type="checkbox"
                switch
                role="switch"
                :data-testid="`pm-mgmt-media-${key}`"
                :checked="profile[key] === true"
                @change="onMediaChange(key, $event)"
              />
            </div>
            <p class="hint">{{ t.media[MEDIA_HINT_KEYS[key]] }}</p>
          </div>
        </div>
        <p v-if="mediaError" class="hint error" role="alert" data-testid="pm-mgmt-media-error">{{ mediaError }}</p>
      </section>

      <!-- 页脚：删除这个网站的设置（与页面右下角 ⋯ 菜单里的那一项是同一件事、同一个叫法） -->
      <footer class="danger-zone" data-testid="pm-mgmt-card-delete">
        <h3>{{ deleteSiteHeading() }}</h3>
        <p class="hint">{{ deleteSiteImpact() }}</p>
        <!-- 确认框在 App.vue（#113：列表页与详情页共用一个实例），这里只发起 -->
        <button type="button" class="danger" data-testid="pm-mgmt-reset" @click="store.askReset(profile)">{{ deleteSiteAction() }}</button>
        <p v-if="store.state.resetError[profile.origin]" class="hint error" role="alert">
          {{ store.state.resetError[profile.origin] }}
        </p>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { getLocale } from '@/core/i18n';
import { scopeHumanLabel } from '@/core/scope';
import { deleteSiteAction, deleteSiteHeading, deleteSiteImpact } from '@/core/site-delete';
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
// 空设置判据（#158）：三处主开关共用一份（弹窗 / 胶囊 / 这里）
import { hasSwitchEffect } from '@/core/site-state';
import { MEDIA_FLAG_KEYS, MEDIA_HINT_KEYS, type MediaFlagKey } from '@/core/media';
import InfoTip from '@/ui/info-tip/InfoTip';
import type { HideRule, TabIcon } from '@/core/types';
import { useRuleUndo } from '@/ui/rule-undo';
import { locale, t } from '@/ui/i18n';
import IconPicker from '@/ui/title-icon/IconPicker.vue';
import ClearRulesDialog from '../ClearRulesDialog.vue';
import { normalizeSiteHost, siteHostOf, siteLabelOf, staleRulesOf } from '../site';
import { DEFAULT_KEY, managementStore as store } from '../store';

/** 路由参数是网站的 host（`#/sites/<host>`），在名单里找不到就显示「没有这个网站的设置」 */
const props = defineProps<{ host?: string }>();

const profile = computed(() => {
  const host = normalizeSiteHost(props.host ?? '');
  return store.state.profiles.find((p) => siteHostOf(p.origin) === host) ?? null;
});

const stale = computed(() => (profile.value ? staleRulesOf(profile.value) : []));
const isPending = computed(() => (profile.value ? store.state.pendingOrigins.includes(profile.value.origin) : false));
/** 开关管不到任何东西（#158）：收起的内容、标签页标题和图标都空。只有灰度仍算空（灰度独立于主开关） */
const switchEmpty = computed(() => (profile.value ? !hasSwitchEffect(profile.value) : false));

/** 站点没单独设置时的实际标题（全局默认 > 界面语言默认），用作输入框占位与提示 */
const fallbackTitle = computed(() => (store.state.defaultTitle ?? '').trim() || store.languageDefaultTitle);
const titlePlaceholder = computed(() => {
  // 从没保存过「标题和图标」的网站：输入框空着，标签页保持网站原样（#98）。
  // 这时不能拿默认标题当占位——会让人以为这个网站已经被改名了。
  if (profile.value && profile.value.titleIconSet !== true) return t.value.management.titleUnsetPlaceholder;
  return (store.state.drafts[DEFAULT_KEY] ?? '').trim() || store.languageDefaultTitle;
});

const iconError = ref('');
/** 三个媒体开关写入失败时的一句话，显示在这张卡里 */
const mediaError = ref('');
// 删除 / 撤销：与页面上共用同一套逻辑（core/rule-undo.ts + ui/rule-undo.ts）
const { pending: undo, remove, undo: undoDelete, cancel: cancelUndo } = useRuleUndo((update) => {
  const p = profile.value;
  if (p) void store.updateRules(p.origin, update);
});

/** 「收起的内容」卡标题：确认框关了之后焦点落在这里（触发按钮会随列表清空消失） */
const rulesHeading = ref<HTMLElement | null>(null);
/** 「恢复网站原来的内容」确认框是否打开（只在本视图挂一个实例） */
const rulesResetOpen = ref(false);

function onToggle(e: Event) {
  if (profile.value) void store.toggleSite(profile.value, e);
}

function removeRule(rule: HideRule) {
  remove(profile.value?.hideRules ?? [], rule.id);
}

/** 换标签页图标三态（#121）：网站原来的 / 不显示 / 内置某个 */
async function onIconPick(icon: TabIcon) {
  const p = profile.value;
  if (!p) return;
  iconError.value = '';
  try {
    await store.setIcon(p.origin, icon);
  } catch {
    iconError.value = t.value.management.error.icon;
  }
}

/**
 * 三个媒体开关（#116）：走 store 的原子更新，一次只改拨动的那一个字段。
 * 写入失败把开关拨回实际状态，并在卡片里给一句话（说明跟着这一组走，不弹窗）。
 */
async function onMediaChange(key: MediaFlagKey, e: Event) {
  const p = profile.value;
  const input = e.target as HTMLInputElement;
  if (!p) {
    input.checked = false;
    return;
  }
  const on = input.checked;
  mediaError.value = '';
  try {
    await store.setMedia(p.origin, key, on);
  } catch {
    input.checked = !on;
    mediaError.value = t.value.media.saveFailed;
  }
}

/** 恢复网站原来的标题和图标（#99）：只撤销标题 / 图标，收起的内容不动 */
async function resetTitleIcon() {
  if (!profile.value) return;
  await store.resetTitleIcon(profile.value.origin);
}

/**
 * 恢复网站原来的内容（#160）：确认框关了之后收尾。
 * 确认时先作废未到期的单条撤销——否则清空后再点撤销，会把刚删掉的那条插回空列表。
 * 触发按钮会随列表一起消失，焦点交给卡片标题，不能掉回 body。
 */
async function onRulesResetClosed(confirmed: boolean) {
  rulesResetOpen.value = false;
  const p = profile.value;
  // 取消：焦点由浏览器还给触发按钮，这里不要抢
  if (!confirmed || !p) return;
  cancelUndo();
  await store.resetHideRules(p.origin);
  await nextTick();
  rulesHeading.value?.focus();
}
</script>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: var(--pm-space-3);
  font-size: var(--pm-font-size-caption);
}

.back:hover {
  text-decoration: underline;
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
  /* 命中区补偿（WCAG 2.5.8）：开关本体 20px 高，把标签的点击区垫到 ≥24（负 margin 抵消，视觉不变） */
  padding: 3px 0;
  margin: -3px 0;
}

.state {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: var(--pm-space-2) 0;
}

/* 空设置说明（#158）：跟着它解释的那个开关走，直接贴在页头下面；12px 由 .hint 给 */
.switch-empty-hint {
  margin: var(--pm-space-1) 0 0;
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

/* 回退出口（#99 / #160）：不是卡片标题下的字段，单独一行，和上下内容都留出距离。
   0.8.16 发版审查：.ghost 无底无边、颜色与旁边说明同档，扫一眼分不清哪半句能点——
   补下划线（与向导里同一个入口同款，看得出能点）。两处共用这一份样式，不复制。 */
.reset-row {
  margin: var(--pm-space-2) 0 var(--pm-space-3);
}
.reset-row .ghost {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.reset-row .hint {
  margin: 0;
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

/* 图片、视频和声音（#116）：三行开关，每行的说明紧跟它解释的那一个；
   开关本体仍是全局 input[switch]，这里只调排布，不另写一套外观 */
.media-rows {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-3);
}
.media-switch {
  justify-content: space-between;
}
/* #183：label 吃掉行内多余空间，把 ⓘ + 开关推到行尾——与弹窗辅助行 #181 同款思路
   （.popup .aux-row .switch-row .popup-row-label）。auto margin 先吸收全部剩余空间，
   space-between 无空间可分，保留无害 */
.media-switch label {
  margin-inline-end: auto;
}
.media-row .hint {
  margin: var(--pm-space-1) 0 0;
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
.rule-num {
  color: var(--pm-fg-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
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
