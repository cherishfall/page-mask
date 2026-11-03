<template>
  <div ref="rootEl">
    <!-- 页内覆盖层：捕获层 / 悬停框 / 序号牌 / 预览标记（代码命令式管理，跟随元素位置；本模板只提供容器） -->
    <div ref="overlayLayer" data-testid="pm-wizard-overlay"></div>

    <!-- 工具条：默认底部居中，可拖动（N15） -->
    <section
      ref="toolbarEl"
      class="pm-wiz-toolbar"
      :class="{ moved: !!tbPos }"
      :style="tbPos ? { left: `${tbPos.left}px`, top: `${tbPos.top}px` } : undefined"
      aria-labelledby="pm-wiz-title"
      data-testid="pm-wizard-toolbar"
    >
      <div class="pm-wiz-head">
        <button
          type="button"
          class="pm-wiz-handle"
          :class="{ dragging }"
          :aria-label="t.wizard.dragAria"
          :title="t.wizard.dragTitle"
          data-testid="pm-wiz-drag"
          @pointerdown="onHandleDown"
          @pointermove="onHandleMove"
          @lostpointercapture="dragging = false"
          @keydown="onHandleKey"
        >
          ⠿
        </button>
        <div class="pm-wiz-headtext">
          <h2 id="pm-wiz-title" class="pm-wiz-title" data-testid="pm-wiz-heading">{{ t.wizard.heading[phase] }}</h2>
          <p class="pm-wiz-progress" data-testid="pm-wiz-progress">{{ progressText }}</p>
        </div>
        <button
          type="button"
          class="pm-btn small"
          :aria-label="t.wizard.exit"
          data-testid="pm-wiz-exit"
          @click="requestExit"
        >
          {{ t.wizard.exit }}
        </button>
      </div>

      <!-- 第 1 步：标签页标题和图标（只在第一次给一个网站开启清爽时出现）。
           表单与页面 ⋯ 菜单里的小面板是同一个组件（ui/title-icon/TitleIconFields.vue），不写第二份 -->
      <template v-if="phase === 'title'">
        <div class="pm-wiz-step1">
          <TitleIconFields
            v-model:title="titleInput"
            v-model:icon="iconDataUrl"
            id-prefix="pm-wiz"
            :title-hint="t.wizard.titleHint(initialTitle)"
            :icon-hint="hasDefaultIcon ? t.wizard.iconHintWithDefault : t.wizard.iconHintNoDefault"
          />
        </div>
      </template>

      <template v-else-if="phase === 'pick'">
        <div class="pm-wiz-pick">
          <!-- 说明：一行一件事，不再堆成一整段 -->
          <ul class="pm-wiz-lead" data-testid="pm-wiz-pick-lead">
            <li v-for="line in t.wizard.pickLead" :key="line">{{ line }}</li>
          </ul>

          <!-- 分组一：调整选中项（浅底 + 小标题；组内标明现在调的是第几项） -->
          <div class="pm-wiz-group" role="group" aria-labelledby="pm-wiz-adjust-title" data-testid="pm-wiz-group-adjust">
            <p id="pm-wiz-adjust-title" class="pm-wiz-group-title">{{ t.wizard.adjustGroup }}</p>
            <p class="pm-wiz-group-note" data-testid="pm-wiz-adjust-target">
              <template v-if="lastSel">
                {{ t.wizard.adjustNow }}<strong>{{ t.wizard.adjustTarget(lastSelIndex + 1, lastSelName) }}</strong>
              </template>
              <template v-else>{{ t.wizard.adjustEmpty }}</template>
            </p>
            <div class="pm-wiz-group-row">
              <button
                type="button"
                class="pm-btn small"
                data-testid="pm-wiz-bigger"
                :disabled="!lastSel"
                @click="adjust('bigger')"
              >
                {{ t.wizard.bigger }}
              </button>
              <button
                type="button"
                class="pm-btn small"
                data-testid="pm-wiz-smaller"
                :disabled="!lastSel"
                @click="adjust('smaller')"
              >
                {{ t.wizard.smaller }}
              </button>
            </div>
          </div>

          <!-- 分组二：已选清单，一行一项、一行一个删除；右上角「全部删掉」只是文字链接 -->
          <section
            ref="listEl"
            class="pm-wiz-group"
            aria-labelledby="pm-wiz-list-title"
            tabindex="-1"
            data-testid="pm-wiz-group-list"
          >
            <div class="pm-wiz-group-head">
              <h3 id="pm-wiz-list-title" class="pm-wiz-group-title" data-testid="pm-wiz-list-title">
                {{ t.wizard.listTitle(selectionRows.length) }}
              </h3>
              <button
                v-if="selectionRows.length > 0"
                type="button"
                class="pm-wiz-link"
                data-testid="pm-wiz-clear-all"
                @click="clearSelection"
              >
                {{ t.wizard.clearAll }}
              </button>
            </div>
            <ol v-if="selectionRows.length > 0" class="pm-wiz-rows" data-testid="pm-wiz-selected">
              <li v-for="row in selectionRows" :key="rowKey(row.el)" :data-testid="`pm-sel-${row.seq}`">
                <span class="pm-wiz-num" aria-hidden="true">{{ row.seq }}</span>
                <span class="pm-wiz-row-name" :data-testid="`pm-sel-name-${row.seq}`">{{ row.name }}</span>
                <button
                  type="button"
                  class="pm-btn ghost pm-icon-btn"
                  :aria-label="t.wizard.deleteOne(row.seq, row.name)"
                  :data-testid="`pm-sel-${row.seq}-remove`"
                  @click="removeSelected(row)"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            </ol>
            <p v-else class="pm-wiz-group-note" data-testid="pm-wiz-list-empty">{{ t.wizard.listEmpty }}</p>
          </section>
        </div>
      </template>

      <template v-else>
        <p class="pm-wiz-sub">{{ t.wizard.previewHint }}</p>
        <ol v-if="drafts.length > 0" class="pm-wiz-drafts" :aria-label="t.wizard.draftsLabel" data-testid="pm-wiz-drafts">
          <li v-for="(d, i) in drafts" :key="d.key" :data-testid="`pm-draft-${i + 1}`">
            <!-- 默认行：序号、名称、调整、删除（审查第 8 条：收起方式等控件折进「调整」，不摊在行上） -->
            <div class="pm-wiz-draft-head" :data-testid="`pm-draft-${i + 1}-head`">
              <span class="pm-wiz-num" aria-hidden="true">{{ i + 1 }}</span>
              <input
                v-model="d.name"
                class="pm-wiz-name"
                type="text"
                :placeholder="d.autoName"
                :aria-label="t.wizard.nameLabel(i + 1)"
                :data-testid="`pm-draft-name-${i + 1}`"
              />
              <button
                type="button"
                class="pm-btn ghost small pm-wiz-adjust"
                :aria-expanded="!!d.expanded"
                :data-testid="`pm-draft-${i + 1}-adjust`"
                @click="d.expanded = !d.expanded"
              >
                {{ t.wizard.adjust }}
              </button>
              <button
                type="button"
                class="pm-btn ghost pm-icon-btn"
                :aria-label="t.wizard.deleteOne(i + 1, draftName(d))"
                :data-testid="`pm-draft-${i + 1}-remove`"
                @click="removeDraft(d)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <!-- 一句话摘要：收起方式 · 范围；失效项换成「可能失效 · 在页面上找不到了」 -->
            <p class="pm-wiz-draft-summary" :data-testid="`pm-draft-${i + 1}-summary`">{{ draftSummary(d) }}</p>

            <!-- 失效项：摘要下面给一句看得见的说明 + 修复入口（不能只靠角标） -->
            <p v-if="!d.el" class="pm-wiz-draft-stale" :data-testid="`pm-draft-${i + 1}-stale`">
              <span>{{ staleText(d) }}</span>
              <button type="button" class="pm-btn small" :data-testid="`pm-draft-${i + 1}-stale-fix`" @click="reselectDraft(d)">
                {{ t.editor.fix }}
              </button>
            </p>

            <!-- 展开「调整」之后才出现的控件：收起方式、范围、重新选、高级选择器、同类 -->
            <div v-if="d.expanded" class="pm-wiz-draft-body" :data-testid="`pm-draft-${i + 1}-body`">
              <fieldset class="pm-wiz-field">
                <legend class="pm-wiz-field-title">{{ t.editor.methodLegend }}</legend>
                <!-- 三个收起方式：底层是原生单选组（同一 name = 一组，方向键可切换，读屏报「3 选 1」），视觉上做成连体分段 -->
                <div class="pm-wiz-seg">
                  <label v-for="s in STRATEGY_ORDER" :key="s" class="pm-wiz-seg-opt">
                    <input
                      type="radio"
                      :name="`pm-strategy-${i + 1}`"
                      :value="s"
                      :checked="d.strategy === s"
                      :data-testid="`pm-draft-${i + 1}-strategy-${s}`"
                      @change="setStrategy(d, s)"
                    />
                    <span>{{ t.common.strategy[s] }}</span>
                  </label>
                </div>
                <p class="pm-wiz-draft-hint" :data-testid="`pm-draft-${i + 1}-hint`">{{ t.common.strategyHint[d.strategy] }}</p>
              </fieldset>

              <fieldset class="pm-wiz-field" :data-testid="`pm-draft-${i + 1}-scope`">
                <legend class="pm-wiz-field-title">{{ t.editor.scopeLegend }}</legend>
                <div class="pm-wiz-scope-row">
                  <button
                    type="button"
                    class="pm-btn small"
                    :aria-pressed="draftScopeType(d) === 'all'"
                    :data-testid="`pm-draft-${i + 1}-scope-all`"
                    @click="setDraftScope(d, 'all')"
                  >
                    {{ t.editor.scopeAll }}
                  </button>
                  <template v-if="sitePattern">
                    <button
                      type="button"
                      class="pm-btn small"
                      :aria-pressed="draftScopeType(d) === 'include'"
                      :data-testid="`pm-draft-${i + 1}-scope-include`"
                      @click="setDraftScope(d, 'include')"
                    >
                      {{ t.editor.scopeInclude }}
                    </button>
                    <button
                      type="button"
                      class="pm-btn small"
                      :aria-pressed="draftScopeType(d) === 'exclude'"
                      :data-testid="`pm-draft-${i + 1}-scope-exclude`"
                      @click="setDraftScope(d, 'exclude')"
                    >
                      {{ t.editor.scopeExclude }}
                    </button>
                  </template>
                </div>
                <p v-if="!sitePattern && scopeHint" class="pm-wiz-hint">{{ scopeHint }}</p>
                <p v-else-if="draftScopeType(d) !== 'all'" class="pm-wiz-hint" :data-testid="`pm-draft-${i + 1}-scope-value`">
                  {{ scopeHumanLabel(draftScope(d)) }}
                </p>
              </fieldset>

              <div class="pm-wiz-draft-actions">
                <button type="button" class="pm-btn small" :data-testid="`pm-draft-${i + 1}-reselect`" @click="reselectDraft(d)">
                  {{ t.editor.reselect }}
                </button>
              </div>

              <details class="pm-wiz-advanced" :data-testid="`pm-draft-${i + 1}-advanced`">
                <summary>{{ t.editor.advancedSummary }}</summary>
                <p class="pm-wiz-hint">{{ t.editor.advancedHint }}</p>
                <textarea
                  v-model="d.selectorText"
                  class="pm-wiz-textarea"
                  rows="2"
                  spellcheck="false"
                  :aria-label="t.editor.selectorAria(draftName(d))"
                  :data-testid="`pm-draft-${i + 1}-selector`"
                ></textarea>
                <p v-if="d.selectorError" class="pm-wiz-error" role="alert" :data-testid="`pm-draft-${i + 1}-selector-error`">
                  {{ d.selectorError }}
                </p>
                <button type="button" class="pm-btn small" :data-testid="`pm-draft-${i + 1}-selector-save`" @click="saveSelectors(d)">
                  {{ t.editor.saveSelectors }}
                </button>
              </details>

              <!-- 收起几个：一行勾选框，回答一个是非题（页面上一样的要不要一起收）。
                   没有第二个一样的就整块不出现；勾/取消都当场改预览，工具条上说一句发生了什么 -->
              <label v-if="d.el && d.sameHits > 1" class="pm-wiz-same-row" :data-testid="`pm-draft-${i + 1}-same-group`">
                <input
                  type="checkbox"
                  :checked="!onlyOneOf(d)"
                  :data-testid="`pm-draft-${i + 1}-same-toggle`"
                  @change="onSameToggle(d, $event)"
                />
                <span>{{ t.wizard.sameGroupToggle(d.sameHits - 1) }}</span>
              </label>
            </div>
          </li>
        </ol>
        <p v-else class="pm-wiz-group-note" data-testid="pm-wiz-drafts-empty">{{ t.editor.emptyPage }}</p>

        <!-- 在哪些页面收起：新加的这几项整批设置一次（取代原来点保存才弹出的框）。
             编辑已有规则时不出现——每一行在自己的「调整」里各有范围，两个控件管同一件事只会互相打架 -->
        <fieldset v-if="props.mode !== 'editRules'" class="pm-wiz-scope" data-testid="pm-wiz-scope">
          <legend class="pm-wiz-scope-legend">{{ t.wizard.scopeLegend }}</legend>
          <label class="pm-wiz-radio">
            <input v-model="scopeChoice" type="radio" value="all" data-testid="pm-wiz-scope-all" />
            {{ t.wizard.scopeAll }}
          </label>
          <template v-if="sitePattern">
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="include" data-testid="pm-wiz-scope-include" />
              {{ t.wizard.scopeInclude(sitePattern.label) }}
            </label>
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="exclude" data-testid="pm-wiz-scope-exclude" />
              {{ t.wizard.scopeExclude(sitePattern.label) }}
            </label>
          </template>
          <span v-else-if="scopeHint" class="pm-wiz-hint" data-testid="pm-wiz-scope-hint">{{ scopeHint }}</span>
        </fieldset>
      </template>

      <!-- 底栏：只放按钮（一行一件事，说明文字不塞进操作栏）。
           左边是退路（第 1 步换成「只改标题，完成」），右边是前进；只有一个按钮时靠右 -->
      <div class="pm-wiz-footer">
        <button
          v-if="phase === 'title'"
          type="button"
          class="pm-btn small"
          data-testid="pm-wiz-title-done"
          :disabled="saving"
          @click="saveTitleOnly"
        >
          {{ saving ? t.wizard.saving : t.wizard.titleDone }}
        </button>
        <button
          v-else-if="canGoBack"
          type="button"
          class="pm-btn small"
          data-testid="pm-wiz-back"
          @click="goBack"
        >
          {{ backLabel }}
        </button>
        <button
          v-if="phase === 'title'"
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-next"
          :disabled="saving"
          @click="goNext"
        >
          {{ t.wizard.nextToPick }}
        </button>
        <button
          v-else-if="phase === 'pick'"
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-preview"
          :disabled="previewCount === 0"
          @click="goNext"
        >
          {{ t.wizard.nextToPreview(previewCount) }}
        </button>
        <button
          v-else
          type="button"
          class="pm-btn small primary"
          data-testid="pm-wiz-save"
          :disabled="saving || drafts.length === 0"
          @click="doSave"
        >
          {{ saving ? t.wizard.saving : t.wizard.save }}
        </button>
      </div>
    </section>

    <!-- 提示（读屏按 polite 状态消息播报；容器常驻，内容出现时才播报） -->
    <div class="pm-wiz-status" role="status">
      <span v-if="warnText" class="pm-wiz-toast" data-testid="pm-wizard-warn">{{ warnText }}</span>
      <span v-if="infoText" class="pm-wiz-toast info" data-testid="pm-wizard-info">{{ infoText }}</span>
    </div>

    <!-- 退出确认：模态；Esc = 继续设置，焦点默认在「继续设置」。
         两个都是次按钮档：继续设置是默认档，退出只是红字红边（放弃本次未保存的改动，还没到不可撤销那一步） -->
    <dialog
      ref="exitDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-exit-title"
      data-testid="pm-wizard-exit-confirm"
      @close="onExitClose"
    >
      <form method="dialog">
        <h2 id="pm-exit-title">{{ t.wizard.exitTitle }}</h2>
        <p>{{ exitBody }}</p>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-btn" autofocus data-testid="pm-wiz-exit-no">{{ t.wizard.exitStay }}</button>
          <button value="exit" class="pm-btn danger" data-testid="pm-wiz-exit-yes">{{ t.wizard.exitConfirm }}</button>
        </div>
      </form>
    </dialog>

    <!-- 无法保存的说明（例如向导期间这个网站的设置被清空了，N22） -->
    <dialog
      ref="noticeDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-notice-title"
      data-testid="pm-wizard-notice"
      @close="finish(false)"
    >
      <form method="dialog">
        <h2 id="pm-notice-title">{{ t.wizard.notSavedTitle }}</h2>
        <p>{{ noticeText }}</p>
        <div class="pm-wiz-actions">
          <button value="ok" class="pm-btn primary" autofocus data-testid="pm-wiz-notice-ok">{{ t.wizard.noticeOk }}</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { browser } from 'wxt/browser';
import { describeElement } from '@/core/naming';
import { generateCandidates, selectorHitsElement } from '@/core/selectors';
import { deriveScopePattern, scopeUnavailableHint } from '@/core/origin';
import { scopeHumanLabel } from '@/core/scope';
import { isSafeSelector } from '@/core/validate';
import { newRuleId, type HideRule, type Scope, type StrategyId } from '@/core/types';
import { createPageMaskStorage } from '@/core/storage';
import { buildPreviewCss, STRATEGY_ORDER } from '@/core/css-builder';
import { isOwnUiNode } from '@/core/host-shield';
import { countCandidateHits } from '@/core/health';
import type { CssAck } from '@/core/messages';
import {
  badgePlacement,
  clampToViewport,
  draftHitCounts,
  mergeEditDrafts,
  mergeSavedRules,
  reconcileDrafts,
  scopeFromChoice,
  selectionRows as buildSelectionRows,
  titleFromInput,
  titleOnlyPatch,
  unsavableDraftWarning,
  wizardEscAction,
  wizardInitialPhase,
  wizardNextPhase,
  wizardPrevPhase,
  wizardStep,
  zeroRuleSavedNotice,
  type DraftItem,
  type DraftRuleInput,
  type MarkerRect,
  type ScopeChoice,
  type SelectionRow,
  type WizardMode,
  type WizardPhase,
} from '@/core/wizard-logic';
import { t } from '@/ui/i18n';
import { PickController } from './pick-controller';
import { adoptWizardStyles } from './wizard-styles';
import TitleIconFields from '../title-icon/TitleIconFields.vue';
import { ElementFollower } from '../follow';

/** 草稿：DraftItem + 当前候选选择器、自动命名、「只这一个 / 同类一起」的两个命中数 */
type Draft = DraftItem & {
  /** 行内稳定 key：el 可能为 null，不能再用元素当 key */
  key: number;
  candidates: string[];
  /** 自动命名结果，清空名称时作为输入框的占位提示，保存时也回落到它 */
  autoName: string;
  /** 当前这组候选在页面上命中的元素数（当前设置实际会收起几个） */
  hits: number;
  /** 「同类一起」那组候选的命中数（行内的 N，实时算）；也是「同类一起」能不能选的依据 */
  sameHits: number;
  /** 对应的旧规则 id：保存时原地更新它（保留 id 与体检记录），不是新增一条 */
  sourceRuleId?: string | null;
  /** 这条草稿自己的生效范围；从旧规则带进来的原样保留，新选的用底部三选一算 */
  scope?: Scope | null;
  /** 「调整」是否展开（只是界面状态，不落库） */
  expanded?: boolean;
  /** 高级：选择器原文的输入框内容与逐行校验的报错（本地草稿） */
  selectorText?: string;
  selectorError?: string;
};

/** 行内草稿的 key 计数器（元素可能为 null，不能用元素本身当 key） */
let draftKeySeq = 0;

/** 方向键每次移动工具条的距离 */
const KEY_STEP = 16;
const ARROW_DIRS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const props = defineProps<{
  mode: WizardMode;
  url: string;
  /** 重选元素：保存时用新规则替换这条旧规则（取消则旧规则原样保留，N5） */
  replaceRuleId?: string | null;
  /** 编辑收起的内容（#69）：这个页面上用得上的旧规则，按原顺序铺成草稿 */
  initialRules?: HideRule[];
  /** 第 1 步标题输入框的默认值（全局默认 > 界面语言默认，永不为空白） */
  initialTitle: string;
  /** 站点现有的图标（新站点为 null） */
  initialIcon: string | null;
  /** 站点没有自己的图标时实际会用的那张（插件默认图标或透明图标） */
  fallbackIcon: string;
  /** 插件设置里是否有默认图标，只影响第 1 步的说明文字 */
  hasDefaultIcon: boolean;
  /** 把标题 / 图标实时压到当前标签页上（退出时由内容脚本运行时还原） */
  previewDisguise: (title: string, icon: string | null) => void;
  /** 设置本文档的预览样式（null = 清除）；由内容脚本运行时按文档记录注入状态（core/doc-styles.ts） */
  setDraft: (css: string | null) => Promise<CssAck>;
}>();
const emit = defineEmits<{ done: [saved: boolean, notice?: string] }>();

/** 打开时停在哪一步：新站点从标题开始，编辑已有规则直接停在「看效果」（#69） */
const phase = ref<WizardPhase>(wizardInitialPhase(props.mode));
/** 打开这一刻属于这个页面的规则 id：保存时只有这些可以被删除（#69） */
const initialIds = (props.initialRules ?? []).map((r) => r.id);
/** 点了「重新选这一项」之后，下一次点页面就替换这一条（不新增） */
let pendingReplace: Draft | null = null;
const titleInput = ref(props.initialTitle);
const iconDataUrl = ref<string | null>(props.initialIcon);
/** 选择集（有序，顺序 = 序号）；元素本身不做响应式代理 */
const selEls = shallowRef<Element[]>([]);
const lastSel = shallowRef<Element | null>(null);
const warnText = ref('');
/** 中性的一句轻提示（例如「这一项已经在列表里」），2 秒后自己消失 */
const infoText = ref('');
const noticeText = ref('');
const drafts = ref<Draft[]>([]);
/** 这一步底部「在哪些页面收起」的选择；整批规则共用一份范围（默认整个网站） */
const scopeChoice = ref<ScopeChoice>('all');
const tbPos = ref<{ left: number; top: number } | null>(null);
const dragging = ref(false);

const rootEl = ref<HTMLElement | null>(null);
const overlayLayer = ref<HTMLElement | null>(null);
const toolbarEl = ref<HTMLElement | null>(null);
/** 已选清单本身（删到 0 项时把焦点放在这里，不丢回页面） */
const listEl = ref<HTMLElement | null>(null);
const exitDlg = ref<HTMLDialogElement | null>(null);
const noticeDlg = ref<HTMLDialogElement | null>(null);

const follower = new ElementFollower();
let pick: PickController;
let pickLayer: HTMLElement | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let infoTimer: ReturnType<typeof setTimeout> | null = null;
let hoverBox: HTMLElement | null = null;
/** 当前页内标记（序号牌 / 预览标记），每次重画全部换新 */
let markerBoxes: HTMLElement[] = [];
/**
 * 进入预览那一刻每项的页面坐标（视口矩形 + 当时的滚动位置）。彻底移除后元素没有矩形，
 * 它的标记一直用这份缓存，改别的项、删掉别的项都不会让它坍缩（N7）
 */
const baseRects = new WeakMap<Element, { left: number; top: number; width: number; height: number }>();
/** 正在保存：按钮当场变灰并把文字换成进行时（「正在保存…」），不另写原因 */
const saving = ref(false);
let finished = false;

const sitePattern = computed(() => deriveScopePattern(props.url));
const scopeHint = computed(() => scopeUnavailableHint(props.url));
const lastSelIndex = computed(() => (lastSel.value ? selEls.value.indexOf(lastSel.value) : -1));
const lastSelName = computed(() => (lastSel.value ? describeElement(lastSel.value) : ''));
/** 第 2 步的已选清单：序号与页面上的号码牌同源（core/wizard-logic.ts selectionRows） */
const selectionRows = computed<SelectionRow<Element>[]>(() => buildSelectionRows(selEls.value, describeElement));

/** 清单行的稳定 key：跟着元素走，删掉中间一行时不会把 DOM 内容挪到别的元素名下 */
const rowKeys = new WeakMap<Element, number>();
let rowKeySeq = 0;
function rowKey(el: Element): number {
  let key = rowKeys.get(el);
  if (key === undefined) rowKeys.set(el, (key = ++rowKeySeq));
  return key;
}

/** 「第 N 步 / 共 M 步」：新站 3 步、老站 2 步 */
const progressText = computed(() => {
  const { index, total } = wizardStep(props.mode, phase.value);
  return t.value.wizard.progress(index, total);
});
/** 第 1 步没有上一步（老站点进入就是选内容，左下角同样不出现「上一步」） */
const canGoBack = computed(() => wizardPrevPhase(props.mode, phase.value) !== null);
/** 「上一步」写清退回去做什么：从选内容退回第 1 步是改标题，从看效果退回是重新选内容 */
const backLabel = computed(() => (phase.value === 'pick' ? t.value.wizard.backToTitle : t.value.wizard.backToPick));
const exitBody = computed(() => {
  // 编辑已有规则时，草稿本身就是「这次要改的 N 项」；不管是看效果还是回到选内容，都按它计数
  const selected =
    props.mode === 'editRules' ? drafts.value.length : phase.value === 'preview' ? drafts.value.length : selEls.value.length;
  return selected > 0 ? t.value.wizard.exitBodySelected(selected) : t.value.wizard.exitBodyPlain;
});

/**
 * 「下一步：看效果（N）」里的 N：编辑已有规则时，旧规则带来的草稿本来就要进看效果，
 * 不能只数本次新点选的元素（否则一进来是 0，按钮还会被禁用）。
 */
const previewCount = computed(() => {
  if (props.mode !== 'editRules') return selEls.value.length;
  const picked = new Set(selEls.value);
  const covered = new Set<Element>();
  let n = 0;
  for (const d of drafts.value) {
    // 旧规则带来的草稿一定会进看效果；本次新选的只有在选择集里才留下（取消了的不算）
    if (!d.sourceRuleId && !(d.el && picked.has(d.el))) continue;
    n++;
    if (d.el) covered.add(d.el);
  }
  for (const el of selEls.value) if (!covered.has(el)) n++;
  return n;
});

// 第 1 步的实时预览：改标题 / 换图标时立刻压到标签页上（不点保存也能看到）
watch([titleInput, iconDataUrl], () => {
  if (phase.value === 'title') pushTitlePreview();
});

onMounted(() => {
  const root = rootEl.value?.getRootNode();
  if (root instanceof ShadowRoot) adoptWizardStyles(root);
  // 全屏透明捕获层：拾取期接管全部指针事件（见 pick-controller 注释）
  pickLayer = document.createElement('div');
  pickLayer.dataset.testid = 'pm-pick-layer';
  overlayLayer.value?.appendChild(pickLayer);
  pick = new PickController({
    // 插件自己的界面（向导宿主、以及别的宿主）都不算页面元素
    isOwnNode: (n) => isOwnUiNode(n),
    onHoverChange: updateHoverBox,
    // 编辑已有规则时点到一条已经收起的项：原地替换那条，不再新增一条重复规则（#69）
    onPickBefore: (el) => {
      if (props.mode !== 'editRules') return false;
      const target = pendingReplace ?? draftHitBy(el);
      if (!target) return false;
      pendingReplace = null;
      replaceDraftElement(target, el);
      pick.add(el); // 选择集变化会经 onSelectionChange 同步号码牌与清单
      showInfo(t.value.wizard.repicked);
      return true;
    },
    onSelectionChange: (els) => {
      selEls.value = els;
      lastSel.value = pick.last;
      renderMarkers();
    },
    onWarnTooBig: () => showWarn(t.value.wizard.warnTooBig),
  });
  pick.attach(pickLayer);
  // 打开时不是点选阶段（新站点先看标题与图标）：捕获层不接管指针，光标也不改
  if (phase.value !== 'pick') {
    pickLayer.style.display = 'none';
    pick.stop();
    document.documentElement.style.cursor = '';
  } else {
    document.documentElement.style.cursor = 'crosshair';
  }
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', reclampToolbar);
  // 第 1 步：一打开就把默认标题 / 图标压到当前标签页（之后每次改动即时更新，退出时运行时还原）
  if (phase.value === 'title') pushTitlePreview();
  // 编辑已有规则（#69）：一打开就在「看效果」，用这个页面上用得上的规则铺草稿
  else if (props.mode === 'editRules') void initEditRules();
});

onBeforeUnmount(() => {
  document.documentElement.style.cursor = '';
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', reclampToolbar);
  pick?.stop();
  follower.stop();
  // 兜底：任何退出路径都撤掉预览样式（不允许免保存临时隐藏）
  void props.setDraft(null);
  if (warnTimer) clearTimeout(warnTimer);
  if (infoTimer) clearTimeout(infoTimer);
});

function showWarn(text: string) {
  warnText.value = text;
  if (warnTimer) clearTimeout(warnTimer);
  warnTimer = setTimeout(() => (warnText.value = ''), 4000);
}

/** 中性轻提示（不是错误）：说一句刚发生了什么，2 秒后消失 */
function showInfo(text: string) {
  infoText.value = text;
  if (infoTimer) clearTimeout(infoTimer);
  infoTimer = setTimeout(() => (infoText.value = ''), 2000);
}

// ---------- 键盘：向导级 Esc（N9） ----------

/** 是否有浮层打开（确认框）：有就让浮层自己按原生行为处理 Esc */
function overlayOpen(): boolean {
  return !!exitDlg.value?.open || !!noticeDlg.value?.open;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
  // 向导打开期间 Esc 归向导：不让页面自己的 Esc 快捷键同时触发
  e.stopPropagation();
  if (wizardEscAction(e, { overlayOpen: overlayOpen() }) === 'requestExit') {
    e.preventDefault();
    requestExit();
  }
  // 有浮层时不 preventDefault：浏览器把这次 Esc 当作关闭请求，关掉最上面的浮层
}

// ---------- 退出 ----------

function requestExit() {
  if (!isDirty()) {
    void finish(false);
    return;
  }
  exitDlg.value?.showModal();
}

/** 编辑已有规则：打开那一刻的草稿快照，用来判断「有没有改过」（没改过就直接退出，不弹确认框） */
let baselineDrafts: string | null = null;

/** 草稿的可比较快照：名称、候选、方式、同类、范围、来源规则 id（不含界面展开状态） */
function draftSignature(): string {
  return JSON.stringify(
    drafts.value.map((d) => [
      d.sourceRuleId ?? null,
      draftName(d),
      d.candidates,
      d.strategy,
      d.onlyThis,
      d.scope ?? null,
    ]),
  );
}

/** 有没有还没保存的东西：第 1 步看标题 / 图标是否动过，编辑已有规则看草稿有没有变，其余看选了几项 */
function isDirty(): boolean {
  if (phase.value === 'title') {
    return titleInput.value.trim() !== props.initialTitle.trim() || iconDataUrl.value !== props.initialIcon;
  }
  if (props.mode === 'editRules') {
    return selEls.value.length > 0 || (baselineDrafts !== null && draftSignature() !== baselineDrafts);
  }
  return phase.value === 'pick' ? selEls.value.length > 0 : drafts.value.length > 0;
}

function onExitClose() {
  const dlg = exitDlg.value;
  if (!dlg) return;
  const choice = dlg.returnValue;
  dlg.returnValue = ''; // Esc 不设置返回值，必须清掉上一次的
  if (choice === 'exit') void finish(false);
}

/**
 * 结束向导：先等预览样式真正撤掉，再通知运行时（运行时随后恢复正式样式）。
 * `notice` 是保存后给用户的轻提示（例如 0 条规则时说明只有标签页名字变了），由运行时在关掉向导后显示。
 */
async function finish(saved: boolean, notice?: string) {
  if (finished) return;
  finished = true;
  if (!saved) {
    const res = await props.setDraft(null);
    if (!res.ok) console.warn('[PageMask] preview clear failed', res.error);
  }
  emit('done', saved, notice);
}

// ---------- 三步骨架（#51） ----------

/** 右下角前进：标题 → 选内容 → 看效果（看效果这一步的右下角直接是「保存」，不经过这里） */
function goNext() {
  const next = wizardNextPhase(props.mode, phase.value);
  if (next === 'pick') enterPick();
  else if (next === 'preview') void enterPreview();
}

/** 左下角回退：看效果 → 选内容 → 标题（第 1 步没有上一步，按钮不渲染） */
function goBack() {
  const prev = wizardPrevPhase(props.mode, phase.value);
  if (prev === 'title') enterTitle();
  else if (prev === 'pick') void backToPick();
}

/** 点选阶段的页内状态：十字光标 + 全屏捕获层 + 已有序号牌 */
function enterPickUI() {
  document.documentElement.style.cursor = 'crosshair';
  if (pickLayer) {
    pickLayer.style.display = '';
    pick.attach(pickLayer);
  }
  renderMarkers();
}

function enterPick() {
  phase.value = 'pick';
  enterPickUI();
}

/** 回到第 1 步：撤掉点选层与页内标记，选择集保留（再点「下一步」还能带走） */
function enterTitle() {
  phase.value = 'title';
  document.documentElement.style.cursor = '';
  pick.stop();
  if (pickLayer) pickLayer.style.display = 'none';
  updateHoverBox(null);
  clearMarkers();
  void setDraftCss(null);
  pushTitlePreview();
}

/** 把标题 / 图标实时压到当前标签页（第 1 步专用；退出时由内容脚本运行时还原） */
function pushTitlePreview() {
  props.previewDisguise(titleFromInput(titleInput.value, props.initialTitle), iconDataUrl.value || props.fallbackIcon);
}

// ---------- 编辑已有规则（#69） ----------

/** 依次用候选选择器找页面上第一个命中的元素（不算插件自己的界面） */
function firstElementFor(selectors: readonly string[]): Element | null {
  for (const sel of selectors) {
    let found: NodeListOf<Element>;
    try {
      found = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of found) if (!isOwnUiNode(el)) return el;
  }
  return null;
}

function sameSelectors(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/**
 * 打开这一刻用旧规则铺草稿：字段原样搬过来，候选选择器不重新生成（不悄悄改掉用户的选择）。
 * 「只这一个 / 同类一起」按候选与两种生成结果比对；都对不上时保留规则里存的那个值。
 */
function initialDrafts(): Draft[] {
  const out: Draft[] = [];
  for (const rule of props.initialRules ?? []) {
    const el = firstElementFor(rule.candidates);
    const candidates = [...rule.candidates];
    const autoName = rule.elementName;
    const hits = countCandidateHits(document, candidates);
    let sameHits = hits;
    let onlyThis = rule.onlyThis;
    if (el) {
      sameHits = countCandidateHits(document, generateCandidates(el, { onlyThis: false }));
      if (sameSelectors(candidates, generateCandidates(el, { onlyThis: true }))) onlyThis = true;
      else if (sameSelectors(candidates, generateCandidates(el, { onlyThis: false }))) onlyThis = false;
    }
    out.push({
      key: ++draftKeySeq,
      el: el ? markRaw(el) : null,
      name: rule.elementName,
      autoName,
      strategy: rule.strategy,
      onlyThis,
      candidates,
      hits,
      sameHits,
      sourceRuleId: rule.id,
      scope: rule.scope,
      expanded: false,
      selectorText: candidates.join('\n'),
    });
  }
  return out;
}

/** 进入看效果前量一遍每项在页面上的位置（彻底移除的元素之后没有矩形，靠这份缓存跟着页面滚） */
function captureBaseRects() {
  for (const d of drafts.value) {
    if (!d.el) continue;
    // 这一组里所有会被收起的元素都量一遍：彻底移除之后它们没有矩形，靠这份缓存标位置
    for (const el of matchedElements(d)) {
      const r = el.getBoundingClientRect();
      baseRects.set(el, { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height });
    }
  }
}

/** 一打开就在看效果：先把旧规则铺成草稿，再按同一套预览实现画出效果 */
async function initEditRules() {
  drafts.value = initialDrafts();
  baselineDrafts = draftSignature();
  await props.setDraft(null);
  captureBaseRects();
  await applyPreview();
}

/** 这个元素是不是已经被某条「从旧规则带进来」的草稿命中（点它就是重选那一条，不新增） */
function draftHitBy(el: Element): Draft | null {
  for (const d of drafts.value) {
    if (!d.sourceRuleId) continue;
    if (d.el === el) return d;
    const hit = d.candidates.some((sel) => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    });
    if (hit) return d;
  }
  return null;
}

/** 重算这一条的两个数（hits / sameHits） */
function refreshDraftCounts(d: Draft) {
  const [counts] = draftHitCounts(
    [d],
    (el) => generateCandidates(el, { onlyThis: false }),
    (selectors) => countCandidateHits(document, selectors),
  );
  if (!counts) return;
  d.hits = counts.hits;
  d.sameHits = counts.sameHits;
}

/**
 * 换掉一条草稿的元素之后：旧位置如果还在本次选择集里、又没有别的草稿用它，就先移出去。
 * 否则回到看效果时会被当成「新点选的元素」再补一条重复规则。
 */
function dropOldSelection(old: Element | null, d: Draft, next: Element) {
  if (!old || old === next) return;
  if (drafts.value.some((x) => x !== d && x.el === old)) return;
  pick.remove(old);
}

/** 用刚点到的地方原地替换这一条：旧规则 id 不变，保存时仍是更新同一条（不新增重复规则） */
function replaceDraftElement(d: Draft, el: Element) {
  const old = d.el;
  d.el = markRaw(el);
  d.candidates = generateCandidates(el, { onlyThis: d.onlyThis });
  d.selectorText = d.candidates.join('\n');
  d.selectorError = '';
  // 名字是自动起的就跟着换；用户改过的名字保留
  const autoName = describeElement(el);
  if (d.name.trim() === d.autoName.trim()) d.name = autoName;
  d.autoName = autoName;
  refreshDraftCounts(d);
  dropOldSelection(old, d, el);
}

/** 行内「重新选这一项」：下一处点到的就是这一条的新位置（失效项也走这里） */
function reselectDraft(d: Draft) {
  pendingReplace = d;
  if (phase.value !== 'pick') void backToPick();
  else renderMarkers();
}

/** 这一条要用的范围：旧规则带来的原样保留，没有才用底部三选一（#69） */
function draftScope(d: Draft): Scope {
  return d.scope ?? scopeFromChoice(scopeChoice.value, sitePattern.value);
}

function draftScopeType(d: Draft): ScopeChoice {
  return draftScope(d).type;
}

/** 默认行上的一句话摘要：收起方式 · 范围；失效项换一句（#69、审查第 8 条） */
function draftSummary(d: Draft): string {
  if (!d.el) return t.value.wizard.staleSummary;
  return `${t.value.common.strategy[d.strategy]} · ${scopeHumanLabel(draftScope(d))}`;
}

/** 失效说明：为什么这条可能没用了 + 它在哪些页面收起（复用编辑器里同一句） */
function staleText(d: Draft): string {
  return t.value.editor.health(draftName(d), scopeHumanLabel(draftScope(d)));
}

function setDraftScope(d: Draft, type: ScopeChoice) {
  const pattern = sitePattern.value;
  d.scope = type === 'all' || !pattern ? { type: 'all' } : { type, patterns: [{ ...pattern }] };
  void applyPreview();
}

/**
 * 高级：选择器原文（从旧编辑面板原样搬来）——每行一个合法选择器，且保存前每行都要在当前页面命中；
 * 逐行检查并指出第几行。成功后同步这条草稿的候选、元素与两个命中数。
 */
function saveSelectors(d: Draft) {
  const text = (d.selectorText ?? '').trim();
  if (!text) {
    d.selectorError = t.value.editor.errorEmpty;
    return;
  }
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    if (!isSafeSelector(line)) {
      d.selectorError = t.value.editor.errorInvalid(i + 1);
      return;
    }
    if (selectorHitsElement(line) < 1) {
      d.selectorError = t.value.editor.errorNoHit(i + 1);
      return;
    }
  }
  d.selectorError = '';
  d.candidates = lines;
  d.selectorText = lines.join('\n');
  const old = d.el;
  const found = firstElementFor(lines);
  d.el = found ? markRaw(found) : null;
  refreshDraftCounts(d);
  if (found) dropOldSelection(old, d, found);
  void recaptureAndPreview();
}

/**
 * 「只改标题，完成」：保存 0 条规则 + 标题 / 图标，站点进入清爽态，向导直接关闭，
 * 不弹保存对话框（#51）。新站点的第一份配置在这里才第一次写入。
 */
async function saveTitleOnly() {
  if (saving.value || finished) return;
  saving.value = true;
  try {
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      showWarn(t.value.wizard.warnNotCleared);
      return;
    }
    const storage = createPageMaskStorage(browser.storage.local);
    const origin = new URL(props.url).origin;
    const patch = titleOnlyPatch({
      title: titleInput.value,
      icon: iconDataUrl.value,
      fallbackTitle: props.initialTitle,
    });
    let saved;
    try {
      // 只改标题 / 图标 / 开关：不碰已有的收起规则（新站点本来就没有规则）
      saved = await storage.updateProfile(
        origin,
        (p) => {
          Object.assign(p, patch);
        },
        { create: props.mode === 'newSite' },
      );
    } catch (e) {
      showWarn(t.value.wizard.warnSaveFailedTitleOnly(e instanceof Error ? e.message : String(e)));
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGone;
      noticeDlg.value?.showModal();
      return;
    }
    // 0 条规则：关掉向导后给一句轻提示，说明生效的是标签页名字（#53）
    await finish(true, t.value.wizard.zeroRuleNotice(titleFromInput(titleInput.value, props.initialTitle)));
  } finally {
    saving.value = false;
  }
}

// ---------- 选择阶段 ----------

function adjust(dir: 'bigger' | 'smaller') {
  pick.adjust(dir);
}

/**
 * 清单里删掉这一项：只删这一项（选择集、号码牌、清单三处同步重排），焦点交给下一行。
 * 删到 0 项时焦点落在清单上——按钮都被移除了，不能让焦点掉回页面。
 */
async function removeSelected(row: SelectionRow<Element>) {
  pick.remove(row.el); // 选择集变化会经 onSelectionChange 同步号码牌与清单
  await nextTick();
  const left = selEls.value.length;
  if (left === 0) {
    listEl.value?.focus();
    return;
  }
  const nextSeq = Math.min(row.seq, left);
  toolbarEl.value?.querySelector<HTMLElement>(`[data-testid="pm-sel-${nextSeq}-remove"]`)?.focus();
}

/** 清单右上角「全部删掉」：去掉全部已选，仍留在点选模式（不想一个个点掉时的出口） */
async function clearSelection() {
  pick.clear(); // 选择集变化会经 onSelectionChange 同步序号牌与工具条
  await nextTick();
  listEl.value?.focus();
}

// ---------- 页内标记 ----------

function makeBox(...classes: string[]): HTMLElement {
  const el = document.createElement('div');
  el.className = ['pm-wiz-box', ...classes].join(' ');
  overlayLayer.value?.appendChild(el);
  return el;
}

function updateHoverBox(el: Element | null) {
  if (hoverBox && (!el || phase.value !== 'pick')) {
    follower.drop(hoverBox);
    hoverBox = null;
  }
  if (!el || phase.value !== 'pick') return;
  if (!hoverBox) hoverBox = makeBox('pm-wiz-hover');
  follower.trackLive(el, hoverBox);
}

function clearMarkers() {
  for (const box of markerBoxes) follower.drop(box);
  markerBoxes = [];
}

function addBadge(box: HTMLElement, seq: number, onClick?: () => void) {
  const tag = document.createElement(onClick ? 'button' : 'span');
  tag.className = 'pm-wiz-badge';
  tag.textContent = String(seq);
  if (onClick) {
    const btn = tag as HTMLButtonElement;
    btn.type = 'button';
    btn.tabIndex = -1; // 鼠标捷径：跳转到清单里对应的行；键盘入口是清单本身，不在这里
    btn.setAttribute('aria-label', t.value.wizard.badgeJump(seq));
    btn.dataset.testid = `pm-marker-${seq}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  } else {
    tag.setAttribute('aria-hidden', 'true');
    tag.dataset.testid = `pm-badge-${seq}`;
  }
  box.appendChild(tag);
}

/** 号码牌的固定尺寸：定位要先知道尺寸，才能算在元素外面放不放得下 */
const BADGE_SIZE = { width: 24, height: 24 };
/** 「之前收起了」角标的定位尺寸（比号码牌宽，给五个字留位置） */
const HIDDEN_BADGE_SIZE = { width: 76, height: 24 };
/** 选内容阶段最多标出多少个「之前收起了」的元素（多了反而看不清页面） */
const HIDDEN_MARK_LIMIT = 40;
/** 一条规则最多给多少个「一样的」画虚线框（页面上一两百个同类时不刷屏） */
const SAME_MARK_LIMIT = 30;

/**
 * 号码牌自己一个盒子（#52）：位置由 badgePlacement 算在元素边界外侧，不再压在元素自己的文字上。
 * 元素贴着视口顶边时号码牌翻到元素下方；实在没有空间才回到内侧，并改用半透明底。
 */
function badgePlace(box: HTMLElement, size = BADGE_SIZE) {
  return (rect: MarkerRect): MarkerRect => {
    const placed = badgePlacement(rect, size, { width: window.innerWidth, height: window.innerHeight });
    box.classList.toggle('inside', placed.side === 'inside');
    return { left: placed.left, top: placed.top, width: size.width, height: size.height };
  };
}

/**
 * 一个标记 = 元素上的框 + 框外面的号码牌。框跟元素严丝合缝（waitBoxOn 用它核对），
 * 号码牌单独跟同一个元素但位置外移。
 */
function addMarker(opts: {
  seq: number;
  kind: 'selected' | 'blank' | 'mask' | 'ghost' | 'same';
  el?: Element;
  /** 彻底移除的元素没有矩形，用它进入预览时缓存的页面坐标 */
  ghost?: MarkerRect;
  jump?: () => void;
  /** 只有这一项自己带号码牌；同组里的其它元素只画框（同一个数字重复出现反而更乱） */
  badge?: boolean;
  testid?: string;
}): HTMLElement {
  const box = makeBox(`pm-wiz-${opts.kind}`);
  box.dataset.testid = opts.testid ?? `pm-box-${opts.seq}`;
  if (opts.kind === 'mask') box.style.background = '#f4f4f4';
  markerBoxes.push(box);
  if (opts.badge === false) {
    if (opts.ghost) follower.trackGhost(opts.ghost, box);
    else if (opts.el) follower.trackLive(opts.el, box);
    return box;
  }
  const badgeBox = makeBox('pm-wiz-badge-box');
  addBadge(badgeBox, opts.seq, opts.jump);
  markerBoxes.push(badgeBox);
  const place = badgePlace(badgeBox);
  if (opts.ghost) {
    follower.trackGhost(opts.ghost, box);
    follower.trackGhost(opts.ghost, badgeBox, place);
  } else if (opts.el) {
    follower.trackLive(opts.el, box);
    follower.trackLive(opts.el, badgeBox, place);
  }
  return box;
}

/** 一条草稿实际会在页面上收起的元素（按候选逐个查、去重，这一项自己排最前）；只用于画标记，封顶防刷屏 */
function matchedElements(d: Draft): Element[] {
  if (!d.el) return [];
  const out: Element[] = [d.el];
  const seen = new Set<Element>([d.el]);
  for (const sel of d.candidates) {
    let list: NodeListOf<Element>;
    try {
      list = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of list) {
      if (seen.has(el) || isOwnUiNode(el)) continue;
      seen.add(el);
      out.push(el);
      if (out.length > SAME_MARK_LIMIT) return out;
    }
  }
  return out;
}

/** 同组里的其它元素：勾了「一起收起」时才标，虚线框说明「这些也会跟着一起没」 */
function markSameGroup(d: Draft, seq: number) {
  let drawn = 0;
  for (const el of matchedElements(d)) {
    if (el === d.el) continue;
    if (drawn >= SAME_MARK_LIMIT) return;
    // 彻底移除的元素在预览里已经没有矩形：用进预览前量下来的页面坐标跟着滚
    const base = d.strategy === 'remove' ? baseRects.get(el) : null;
    if (d.strategy === 'remove') {
      if (!base) continue;
      addMarker({
        seq,
        kind: 'same',
        badge: false,
        testid: 'pm-same-box',
        ghost: { left: base.left - window.scrollX, top: base.top - window.scrollY, width: base.width, height: base.height },
      });
    } else {
      addMarker({ seq, kind: 'same', badge: false, testid: 'pm-same-box', el });
    }
    drawn++;
  }
}

/** 按当前阶段整体重画标记：编号每次都按最新顺序重新计算（N6）；全部同步完成，没有延时登记（N21） */
function renderMarkers() {
  clearMarkers();
  if (phase.value === 'pick') {
    // 序号与清单同源：selectionRows 的第几行就是号码牌上的数字（删掉一项后一起重排）
    for (const row of selectionRows.value) {
      const box = addMarker({ seq: row.seq, kind: 'selected', el: row.el });
      if (row.el === lastSel.value) box.classList.add('current');
    }
    // 编辑已有规则：把页面上之前收起过的元素标出来（虚线框 +「之前收起了」，不吃指针）
    if (props.mode === 'editRules') renderHiddenMarkers();
    return;
  }
  drafts.value.forEach((d, i) => {
    if (!d.el) return; // 失效项不画标记：页面上没有它，行里另有说明与「重新选」
    const jump = () => flashRow(i);
    if (d.strategy === 'remove') {
      // 彻底移除：元素已没有矩形，用进入预览时缓存的页面坐标 + 滚动差值跟随，只显示号码牌（N7、N8）
      const base = baseRects.get(d.el);
      if (!base) return;
      addMarker({
        seq: i + 1,
        kind: 'ghost',
        jump,
        ghost: {
          left: base.left - window.scrollX,
          top: base.top - window.scrollY,
          width: base.width,
          height: base.height,
        },
      });
    } else if (d.strategy === 'blank') {
      addMarker({ seq: i + 1, kind: 'blank', el: d.el, jump });
    } else {
      // 方案 C 遮罩：覆盖盒本身就是预览。保存后遮的是这一组里的全部元素，预览也必须盖住全部，
      // 否则用户以为只盖了一个、保存后却多出好几个（#70）
      for (const el of matchedElements(d)) {
        addMarker(el === d.el ? { seq: i + 1, kind: 'mask', el, jump } : { seq: i + 1, kind: 'mask', el, badge: false });
      }
    }
    // 勾了「页面上另外 N 个一样的也一起收起」：把同组其它元素用虚线框标出来
    if (!onlyOneOf(d) && d.sameHits > 1) markSameGroup(d, i + 1);
  });
}

/**
 * 选内容阶段标出「这些已经收起了」（#69）：每条旧规则命中的元素（含同类）画虚线框 + 角标，
 * 总量封顶 HIDDEN_MARK_LIMIT。已经进入本次选择集的元素不重复标（它有自己的号码牌）。
 */
function renderHiddenMarkers() {
  const selected = new Set(selEls.value);
  const seen = new Set<Element>();
  let count = 0;
  for (const d of drafts.value) {
    // 只标「从旧规则带进来」的草稿：本次新选的还没保存，不算「之前收起了」
    if (!d.sourceRuleId || !d.el || selected.has(d.el)) continue;
    for (const sel of d.candidates) {
      let found: NodeListOf<Element>;
      try {
        found = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const el of found) {
        if (count >= HIDDEN_MARK_LIMIT) return;
        if (seen.has(el) || selected.has(el) || isOwnUiNode(el)) continue;
        seen.add(el);
        addHiddenMarker(el);
        count++;
      }
    }
  }
}

/** 一条「之前收起了」标记：虚线框跟元素，角标同样用 badgePlacement 贴到元素外面 */
function addHiddenMarker(el: Element) {
  const box = makeBox('pm-wiz-hidden');
  box.dataset.testid = 'pm-hidden-mark';
  const badgeBox = makeBox('pm-wiz-badge-box', 'hidden');
  const tag = document.createElement('span');
  tag.className = 'pm-wiz-badge pm-wiz-hidden-tag';
  tag.textContent = t.value.wizard.badgeHidden;
  tag.dataset.testid = 'pm-hidden-badge';
  badgeBox.appendChild(tag);
  markerBoxes.push(box, badgeBox);
  const place = badgePlace(badgeBox, HIDDEN_BADGE_SIZE);
  follower.trackLive(el, box);
  follower.trackLive(el, badgeBox, place);
}

/**
 * 点页面上的号码牌 = 滚到清单里对应的行并高亮一下（原来打开弹片，弹片已删）。
 * 动效只在用户没有要求减少动态时加；高亮由 animationend 撤掉，定时器兜底。
 */
function flashRow(index: number) {
  const row = toolbarEl.value?.querySelector<HTMLElement>(`[data-testid="pm-draft-${index + 1}"]`);
  if (!row) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  row.classList.add('flash');
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    row.classList.remove('flash');
    if (timer) clearTimeout(timer);
    timer = null;
  };
  row.addEventListener('animationend', clear, { once: true });
  timer = setTimeout(clear, reduced ? 1500 : 2000);
}

// ---------- 预览 ----------

function newDraft(el: Element): Draft {
  const candidates = generateCandidates(el, { onlyThis: false });
  const hits = countCandidateHits(document, candidates);
  const autoName = describeElement(el);
  return {
    key: ++draftKeySeq,
    el: markRaw(el),
    name: autoName,
    autoName,
    strategy: 'remove',
    onlyThis: false,
    candidates,
    hits,
    sameHits: hits,
    expanded: false,
    selectorText: candidates.join('\n'),
  };
}

async function enterPreview() {
  if (previewCount.value === 0) return;
  phase.value = 'preview';
  document.documentElement.style.cursor = '';
  pick.stop();
  if (pickLayer) pickLayer.style.display = 'none';
  updateHoverBox(null);
  pendingReplace = null;

  if (props.mode === 'editRules') {
    // 编辑已有规则：旧规则带来的草稿全部保留，本次新点选的追加在后面（#69）
    drafts.value = mergeEditDrafts(
      drafts.value,
      selEls.value,
      (d) => d.sourceRuleId,
      (d) => d.el,
      newDraft,
    );
    // 失效的草稿再看一眼页面（页面加载晚了 / 从别处改回来）：能找回元素就找回
    for (const d of drafts.value) {
      if (d.el) continue;
      const found = firstElementFor(d.candidates);
      if (found) d.el = markRaw(found);
    }
  } else {
    // 继续选择后回来：已有草稿（改过的名称、方案、同类设置）保留，只给新元素建草稿（N12）
    const existing = new Map(
      drafts.value.filter((d): d is Draft & { el: Element } => !!d.el).map((d) => [d.el, d] as const),
    );
    drafts.value = [...reconcileDrafts(selEls.value, existing, newDraft).values()];
  }
  // 页面可能变过（滚动加载、懒渲染）：两个数都按当前 DOM 重算——「同类一起（N）」的 N 与当前选项无关，
  // 所以切到「只这一个」的行也要重算同类那组（#53）
  const counts = draftHitCounts(
    drafts.value,
    (el) => generateCandidates(el, { onlyThis: false }),
    (selectors) => countCandidateHits(document, selectors),
  );
  drafts.value.forEach((d, i) => {
    d.hits = counts[i]!.hits;
    d.sameHits = counts[i]!.sameHits;
  });

  // 先确认没有预览样式（选择阶段本就没有），再量每项的位置，最后才应用预览
  await props.setDraft(null);
  captureBaseRects();
  await applyPreview();
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) showWarn(warn);
}

async function backToPick() {
  phase.value = 'pick';
  clearMarkers();
  // 草稿不清空：回到预览时沿用（N12）
  await setDraftCss(null);
  if (phase.value !== 'pick') return;
  enterPickUI();
}

/** 重画标记并应用预览样式（与正式样式同一个生成函数 core/css-builder，预览所见 = 保存所得） */
async function applyPreview() {
  renderMarkers();
  await setDraftCss(buildPreviewCss(drafts.value));
}

/** 改了选择器之后元素可能换了：先撤预览、重新量一遍位置，再应用预览（否则移除项没有矩形可跟） */
async function recaptureAndPreview() {
  await props.setDraft(null);
  captureBaseRects();
  await applyPreview();
}

async function setDraftCss(css: string | null): Promise<boolean> {
  const res = await props.setDraft(css);
  if (!res.ok) showWarn(css ? t.value.wizard.warnPreviewFailed : t.value.wizard.warnPreviewClearFailed);
  return res.ok;
}

// ---------- 行内编辑 ----------

function setStrategy(d: Draft, s: StrategyId) {
  if (d.strategy === s) return;
  d.strategy = s;
  void applyPreview();
}

/**
 * 行内那对选项当前选中的是哪个：切到「只这一个」，或者同类本来就只有 1 个（两边是同一件事）。
 * 只是显示口径——同类只有 1 个时不必改写已生效的候选选择器。
 */
function onlyOneOf(d: Draft): boolean {
  return d.onlyThis || d.sameHits <= 1;
}

/** 删除按钮的读屏名字：改名后跟着变，清空名称时用自动命名（与保存时落库的名字一致） */
function draftName(d: Draft): string {
  return d.name.trim() || d.autoName;
}

/**
 * 在「只这一个」与「同类一起（N）」之间换：换候选并立即刷新预览（N10）。
 * 同类只有 1 个时第二种不可选——切过去是同一件事，按钮本身是 disabled，这里再兜一次。
 */
function setOnlyOne(d: Draft, want: boolean) {
  if (!d.el) return; // 页面上找不到这一项：没有「一样的」可选
  if (onlyOneOf(d) === want) return;
  if (!want && d.sameHits <= 1) return;
  const next = generateCandidates(d.el, { onlyThis: want });
  if (next.length === 0) {
    // 切换后找不到可靠写法：保持原设置，不让这条变成保存不了的空规则
    showWarn(t.value.wizard.warnUnstable);
    return;
  }
  // 「另外几个」要在改 sameHits 之前算：勾上时 sameHits 就是这个数，取消后按 hits 重算
  const others = Math.max(0, (want ? d.hits : d.sameHits) - 1);
  d.onlyThis = want;
  d.candidates = next;
  d.selectorText = next.join('\n');
  d.hits = countCandidateHits(document, next);
  if (!want) d.sameHits = d.hits;
  void applyPreview();
  // 勾/取消都当场给一句话，免得用户只看到「页面变了」却不知道变的是哪一边
  showInfo(want ? t.value.wizard.sameGroupOff : t.value.wizard.sameGroupOn(others));
}

/** 勾选框：勾上 = 连页面上一样的也一起收（onlyThis = false） */
function onSameToggle(d: Draft, e: Event) {
  setOnlyOne(d, !(e.target as HTMLInputElement).checked);
}

/** 删除这一项：草稿和选择集一起移除；删到最后一项时回到点选阶段（N11） */
function removeDraft(d: Draft) {
  drafts.value = drafts.value.filter((x) => x.key !== d.key);
  if (d.el) pick.remove(d.el);
  if (pendingReplace === d) pendingReplace = null;
  if (drafts.value.length === 0) void backToPick();
  else void applyPreview();
}

// ---------- 工具条拖动（modern-web-guidance「drag」） ----------

let grabOffset = { x: 0, y: 0 };

function moveToolbar(left: number, top: number) {
  const tb = toolbarEl.value;
  if (!tb) return;
  tbPos.value = clampToViewport(
    { left, top },
    { width: tb.offsetWidth, height: tb.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
}

function onHandleDown(e: PointerEvent) {
  if (e.button !== 0 || !toolbarEl.value) return;
  const r = toolbarEl.value.getBoundingClientRect();
  grabOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHandleMove(e: PointerEvent) {
  if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
  dragging.value = true;
  moveToolbar(e.clientX - grabOffset.x, e.clientY - grabOffset.y);
}

function onHandleKey(e: KeyboardEvent) {
  const d = ARROW_DIRS[e.key];
  if (!d || !toolbarEl.value) return;
  e.preventDefault();
  const r = toolbarEl.value.getBoundingClientRect();
  moveToolbar(r.left + d[0] * KEY_STEP, r.top + d[1] * KEY_STEP);
}

function reclampToolbar() {
  if (tbPos.value) moveToolbar(tbPos.value.left, tbPos.value.top);
}

// ---------- 保存（#53：点保存就是最后一下，不再弹第二个确认框） ----------

async function doSave() {
  if (saving.value || finished) return;
  // 保存门槛：每条规则至少 1 个候选，空规则保存后什么也藏不掉
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) {
    showWarn(warn);
    return;
  }
  saving.value = true;
  try {
    // 范围：从旧规则带进来的按它自己的；新选的用这一步底部整批选的那一个（#69）
    const fallbackScope = scopeFromChoice(scopeChoice.value, sitePattern.value);
    const now = Date.now();
    const incoming: DraftRuleInput[] = drafts.value.map((d) => ({
      sourceRuleId: d.sourceRuleId ?? null,
      elementName: draftName(d),
      candidates: [...d.candidates],
      strategy: d.strategy,
      scope: d.scope ?? fallbackScope,
      onlyThis: d.onlyThis,
    }));

    // 先等预览样式真正撤掉，再落库；撤销失败时保留草稿，不能把“预览已关”当作既成事实（N22）
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      console.warn('[PageMask] 保存前预览样式没能撤掉', cleared.error);
      showWarn(t.value.wizard.warnNotCleared);
      return;
    }

    const storage = createPageMaskStorage(browser.storage.local);
    const origin = new URL(props.url).origin;
    let saved;
    try {
      // 原子写入：基于最新存储值改。
      saved = await storage.updateProfile(
        origin,
        (p) => {
          if (props.mode === 'editRules') {
            // 编辑已有规则（#69）：有来源的原地更新（保留 id 与体检记录），没有的追加；
            // 本次打开时属于这个页面、但草稿里已经删掉的规则移除——只碰 initialIds 里的，别的页面的一概不动
            p.hideRules = mergeSavedRules(p.hideRules, incoming, { editIds: initialIds, now, makeId: newRuleId });
          } else {
            // 添加内容：纯追加。重选元素：同一次写入里用新规则换掉旧规则（旧规则不在就只追加）
            if (props.replaceRuleId) {
              const i = p.hideRules.findIndex((r) => r.id === props.replaceRuleId);
              if (i >= 0) p.hideRules.splice(i, 1);
            }
            p.hideRules.push(
              ...incoming.map((d) => ({
                id: newRuleId(),
                elementName: d.elementName,
                candidates: [...d.candidates],
                strategy: d.strategy,
                scope: d.scope,
                onlyThis: d.onlyThis,
                createdAt: now,
              })),
            );
          }
          if (props.mode === 'newSite') {
            // 第 1 步填的标题 / 图标随这次保存一起落库（#51）；老站点不碰标题
            p.disguisedTitle = titleFromInput(titleInput.value, props.initialTitle);
            p.faviconDataUrl = iconDataUrl.value || null;
            p.switchState = 'disguised'; // 新站点保存后自动开启清爽模式
          }
        },
        { create: props.mode === 'newSite' },
      );
    } catch (e) {
      // 写入失败（例如存储空间不足）：恢复预览，留在向导里，可以再试
      showWarn(t.value.wizard.warnSaveFailed(e instanceof Error ? e.message : String(e)));
      await applyPreview();
      return;
    }
    if (!saved) {
      noticeText.value = t.value.wizard.noticeGoneRules;
      noticeDlg.value?.showModal();
      return;
    }
    // 保存即完成（#53）：不再弹第二个确认框；0 条规则时只给一句轻提示
    const notice =
      incoming.length === 0
        ? t.value.wizard.zeroRuleNotice(titleFromInput(titleInput.value, props.initialTitle))
        : undefined;
    await finish(true, notice);
  } finally {
    saving.value = false;
  }
}
</script>
