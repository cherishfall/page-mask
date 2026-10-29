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
          aria-label="移动工具条（也可以用方向键）"
          title="拖动可移动工具条"
          data-testid="pm-wiz-drag"
          @pointerdown="onHandleDown"
          @pointermove="onHandleMove"
          @lostpointercapture="dragging = false"
          @keydown="onHandleKey"
        >
          ⠿
        </button>
        <div class="pm-wiz-headtext">
          <h2 id="pm-wiz-title" class="pm-wiz-title" data-testid="pm-wiz-heading">{{ TEXT.heading[phase] }}</h2>
          <p class="pm-wiz-progress" data-testid="pm-wiz-progress">{{ progressText }}</p>
        </div>
        <button
          type="button"
          class="pm-wiz-close"
          :aria-label="TEXT.exit"
          :title="TEXT.exit"
          data-testid="pm-wiz-exit"
          @click="requestExit"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <!-- 第 1 步：标签页标题和图标（只在第一次给一个网站开启清爽时出现） -->
      <template v-if="phase === 'title'">
        <div class="pm-wiz-step1">
          <label class="pm-wiz-label" for="pm-wiz-title-input">{{ TEXT.titleLabel }}</label>
          <input
            id="pm-wiz-title-input"
            v-model="titleInput"
            class="pm-wiz-input"
            type="text"
            maxlength="60"
            data-testid="pm-wiz-title-input"
            aria-describedby="pm-wiz-title-hint"
          />
          <div class="pm-wiz-chips" role="group" :aria-label="TEXT.quickLabel" data-testid="pm-wiz-quick">
            <span class="pm-wiz-label">{{ TEXT.quickLabel }}</span>
            <button
              v-for="(q, i) in QUICK_TITLES"
              :key="q.label"
              type="button"
              class="pm-wiz-chip"
              :data-testid="`pm-wiz-quick-${i}`"
              @click="titleInput = quickTitleValue(q, uiLanguage)"
            >
              {{ quickTitleValue(q, uiLanguage) }}
            </button>
          </div>
          <p id="pm-wiz-title-hint" class="pm-wiz-sub">{{ TEXT.titleHint(initialTitle) }}</p>

          <div class="pm-wiz-icon-row">
            <span class="pm-wiz-label">{{ TEXT.iconLabel }}</span>
            <img
              v-if="iconDataUrl"
              class="pm-wiz-icon-preview"
              :src="iconDataUrl"
              :alt="TEXT.iconPreviewAlt"
              data-testid="pm-wiz-icon-preview"
            />
            <span v-else class="pm-wiz-icon-empty" aria-hidden="true" data-testid="pm-wiz-icon-empty"></span>
            <label class="pm-wiz-btn pm-wiz-file">
              {{ iconBusy ? TEXT.iconBusy : iconDataUrl ? TEXT.iconReplace : TEXT.iconUpload }}
              <input
                type="file"
                :accept="ICON_SOURCE_TYPES.join(',')"
                :disabled="iconBusy"
                data-testid="pm-wiz-icon-input"
                @change="onIconChange"
              />
            </label>
            <button
              v-if="iconDataUrl"
              type="button"
              class="pm-wiz-btn"
              data-testid="pm-wiz-icon-clear"
              @click="clearIcon"
            >
              {{ TEXT.iconClear }}
            </button>
          </div>
          <p class="pm-wiz-sub">{{ TEXT.iconHint(hasDefaultIcon) }}</p>
          <p v-if="iconError" class="pm-wiz-error" role="alert" data-testid="pm-wiz-icon-error">{{ iconError }}</p>
        </div>
      </template>

      <template v-else-if="phase === 'pick'">
        <div class="pm-wiz-pick">
          <!-- 说明：一行一件事，不再堆成一整段 -->
          <ul class="pm-wiz-lead" data-testid="pm-wiz-pick-lead">
            <li v-for="line in TEXT.pickLead" :key="line">{{ line }}</li>
          </ul>

          <!-- 分组一：调整选中项（浅底 + 小标题；组内标明现在调的是第几项） -->
          <div class="pm-wiz-group" role="group" aria-labelledby="pm-wiz-adjust-title" data-testid="pm-wiz-group-adjust">
            <p id="pm-wiz-adjust-title" class="pm-wiz-group-title">{{ TEXT.adjustGroup }}</p>
            <p class="pm-wiz-group-note" data-testid="pm-wiz-adjust-target">
              <template v-if="lastSel">
                {{ TEXT.adjustNow }}<strong>第 {{ lastSelIndex + 1 }} 项（{{ lastSelName }}）</strong>
              </template>
              <template v-else>{{ TEXT.adjustEmpty }}</template>
            </p>
            <div class="pm-wiz-group-row">
              <button
                type="button"
                class="pm-wiz-btn"
                data-testid="pm-wiz-bigger"
                :disabled="!lastSel"
                @click="adjust('bigger')"
              >
                {{ TEXT.bigger }}
              </button>
              <button
                type="button"
                class="pm-wiz-btn"
                data-testid="pm-wiz-smaller"
                :disabled="!lastSel"
                @click="adjust('smaller')"
              >
                {{ TEXT.smaller }}
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
                {{ TEXT.listTitle(selectionRows.length) }}
              </h3>
              <button
                v-if="selectionRows.length > 0"
                type="button"
                class="pm-wiz-link"
                data-testid="pm-wiz-clear-all"
                @click="clearSelection"
              >
                {{ TEXT.clearAll }}
              </button>
            </div>
            <ol v-if="selectionRows.length > 0" class="pm-wiz-rows" data-testid="pm-wiz-selected">
              <li v-for="row in selectionRows" :key="rowKey(row.el)" :data-testid="`pm-sel-${row.seq}`">
                <span class="pm-wiz-num" aria-hidden="true">{{ row.seq }}</span>
                <span class="pm-wiz-row-name" :data-testid="`pm-sel-name-${row.seq}`">{{ row.name }}</span>
                <button
                  type="button"
                  class="pm-wiz-del"
                  :aria-label="TEXT.deleteOne(row.seq, row.name)"
                  :data-testid="`pm-sel-${row.seq}-remove`"
                  @click="removeSelected(row)"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            </ol>
            <p v-else class="pm-wiz-group-note" data-testid="pm-wiz-list-empty">{{ TEXT.listEmpty }}</p>
          </section>
        </div>
      </template>

      <template v-else>
        <p class="pm-wiz-sub">{{ TEXT.previewHint }}</p>
        <ol class="pm-wiz-drafts" :aria-label="TEXT.draftsLabel" data-testid="pm-wiz-drafts">
          <li v-for="(d, i) in drafts" :key="rowKey(d.el)" :data-testid="`pm-draft-${i + 1}`">
            <!-- 第一行：序号、名字、删除（#53：每行拆成两行，控件不再互相挤压） -->
            <div class="pm-wiz-draft-head" :data-testid="`pm-draft-${i + 1}-head`">
              <span class="pm-wiz-num" aria-hidden="true">{{ i + 1 }}</span>
              <input
                v-model="d.name"
                class="pm-wiz-name"
                type="text"
                :placeholder="d.autoName"
                :aria-label="TEXT.nameLabel(i + 1)"
                :data-testid="`pm-draft-name-${i + 1}`"
              />
              <button
                type="button"
                class="pm-wiz-del"
                :aria-label="TEXT.deleteOne(i + 1, draftName(d))"
                :data-testid="`pm-draft-${i + 1}-remove`"
                @click="removeDraft(d)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <!-- 第二行：收起方式 +「只这一个 / 同类一起（N）」 -->
            <div class="pm-wiz-draft-opts" :data-testid="`pm-draft-${i + 1}-opts`">
              <!-- 三个收起方式：底层是原生单选组（同一 name = 一组，方向键可切换，读屏报「3 选 1」），视觉上做成连体分段 -->
              <fieldset class="pm-wiz-method">
                <legend class="pm-wiz-sr">{{ TEXT.methodLegend }}</legend>
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
                    <span>{{ STRATEGY_LABEL[s] }}</span>
                  </label>
                </div>
              </fieldset>
              <!-- 收起几个：这一项自己，还是页面上同类的全部（N 实时算） -->
              <fieldset class="pm-wiz-only">
                <legend class="pm-wiz-sr">{{ TEXT.onlyLegend(i + 1) }}</legend>
                <div class="pm-wiz-seg">
                  <label class="pm-wiz-seg-opt">
                    <input
                      type="radio"
                      :name="`pm-only-${i + 1}`"
                      :checked="onlyOneOf(d)"
                      :data-testid="`pm-draft-${i + 1}-only`"
                      @change="setOnlyOne(d, true)"
                    />
                    <span>{{ TEXT.onlyThis }}</span>
                  </label>
                  <label class="pm-wiz-seg-opt">
                    <input
                      type="radio"
                      :name="`pm-only-${i + 1}`"
                      :checked="!onlyOneOf(d)"
                      :disabled="d.sameHits <= 1"
                      :data-testid="`pm-draft-${i + 1}-same`"
                      @change="setOnlyOne(d, false)"
                    />
                    <span>{{ TEXT.sameGroup(d.sameHits) }}</span>
                  </label>
                </div>
              </fieldset>
              <span
                v-if="d.sameHits <= 1"
                class="pm-wiz-only-note"
                :data-testid="`pm-draft-${i + 1}-same-note`"
              >
                {{ TEXT.sameNone }}
              </span>
            </div>
            <p class="pm-wiz-draft-hint" :data-testid="`pm-draft-${i + 1}-hint`">{{ STRATEGY_HINT[d.strategy] }}</p>
          </li>
        </ol>

        <!-- 在哪些页面收起：整批设置一次，就在这一步底部（取代原来点保存才弹出的框） -->
        <fieldset class="pm-wiz-scope" data-testid="pm-wiz-scope">
          <legend class="pm-wiz-scope-legend">{{ TEXT.scopeLegend }}</legend>
          <label class="pm-wiz-radio">
            <input v-model="scopeChoice" type="radio" value="all" data-testid="pm-wiz-scope-all" />
            {{ TEXT.scopeAll }}
          </label>
          <template v-if="sitePattern">
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="include" data-testid="pm-wiz-scope-include" />
              {{ TEXT.scopeInclude(sitePattern.label) }}
            </label>
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="exclude" data-testid="pm-wiz-scope-exclude" />
              {{ TEXT.scopeExclude(sitePattern.label) }}
            </label>
          </template>
          <span v-else-if="scopeHint" class="pm-wiz-hint" data-testid="pm-wiz-scope-hint">{{ scopeHint }}</span>
        </fieldset>
      </template>

      <!-- 底栏：左下角回退（第 1 步换成「只改标题，完成」），右下角前进 -->
      <div class="pm-wiz-footer">
        <div class="pm-wiz-footer-left">
          <button
            v-if="phase === 'title'"
            type="button"
            class="pm-wiz-btn"
            data-testid="pm-wiz-title-done"
            :disabled="saving"
            @click="saveTitleOnly"
          >
            {{ TEXT.titleDone }}
          </button>
          <button
            v-else-if="canGoBack"
            type="button"
            class="pm-wiz-btn"
            data-testid="pm-wiz-back"
            @click="goBack"
          >
            {{ TEXT.back }}
          </button>
        </div>
        <div class="pm-wiz-footer-right">
          <!-- 0 项时前进按钮是灰的，旁边的这一行说明为什么 -->
          <span
            v-if="phase === 'pick' && selectionRows.length === 0"
            class="pm-wiz-foot-hint"
            data-testid="pm-wiz-next-hint"
          >
            {{ TEXT.nextBlocked }}
          </span>
          <button
            v-if="phase === 'title'"
            type="button"
            class="pm-wiz-btn primary"
            data-testid="pm-wiz-next"
            :disabled="saving"
            @click="goNext"
          >
            {{ TEXT.nextToPick }}
          </button>
          <button
            v-else-if="phase === 'pick'"
            type="button"
            class="pm-wiz-btn primary"
            data-testid="pm-wiz-preview"
            :disabled="selEls.length === 0"
            @click="goNext"
          >
            {{ TEXT.nextToPreview(selEls.length) }}
          </button>
          <button
            v-else
            type="button"
            class="pm-wiz-btn primary"
            data-testid="pm-wiz-save"
            :disabled="saving"
            @click="doSave"
          >
            {{ TEXT.save }}
          </button>
        </div>
      </div>
    </section>

    <!-- 提示（读屏按 polite 状态消息播报；容器常驻，内容出现时才播报） -->
    <div class="pm-wiz-status" role="status">
      <span v-if="warnText" class="pm-wiz-toast" data-testid="pm-wizard-warn">{{ warnText }}</span>
    </div>

    <!-- 退出确认：模态；Esc = 继续设置，焦点默认在「继续设置」（危险动作实底红，N9） -->
    <dialog
      ref="exitDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-exit-title"
      data-testid="pm-wizard-exit-confirm"
      @close="onExitClose"
    >
      <form method="dialog">
        <h2 id="pm-exit-title">{{ TEXT.exitTitle }}</h2>
        <p>{{ exitBody }}</p>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-wiz-btn" autofocus data-testid="pm-wiz-exit-no">{{ TEXT.exitStay }}</button>
          <button value="exit" class="pm-wiz-btn primary danger" data-testid="pm-wiz-exit-yes">{{ TEXT.exitConfirm }}</button>
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
        <h2 id="pm-notice-title">没有保存</h2>
        <p>{{ noticeText }}</p>
        <div class="pm-wiz-actions">
          <button value="ok" class="pm-wiz-btn primary" autofocus data-testid="pm-wiz-notice-ok">知道了</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { browser } from 'wxt/browser';
import { describeElement } from '@/core/naming';
import { generateCandidates } from '@/core/selectors';
import { deriveScopePattern, scopeUnavailableHint } from '@/core/origin';
import { STRATEGY_LABEL, newRuleId, type HideRule, type StrategyId } from '@/core/types';
import { createPageMaskStorage } from '@/core/storage';
import { buildPreviewCss, STRATEGY_ORDER } from '@/core/css-builder';
import { isOwnUiNode } from '@/core/host-shield';
import { countCandidateHits } from '@/core/health';
import type { CssAck } from '@/core/messages';
import { QUICK_TITLES, quickTitleValue, currentUiLanguage } from '@/core/titles';
import { ICON_SOURCE_TYPES } from '@/core/icon';
// 与管理页的站点设置页共用同一套图标压缩与校验管线（#26）：只跑在扩展页面 / 内容脚本里
import { fileToIconDataUrl } from '@/entrypoints/management/tab-icon';
import {
  badgePlacement,
  clampToViewport,
  draftHitCounts,
  reconcileDrafts,
  scopeFromChoice,
  selectionRows as buildSelectionRows,
  titleFromInput,
  titleOnlyPatch,
  unsavableDraftWarning,
  wizardEscAction,
  wizardNextPhase,
  wizardPrevPhase,
  wizardStep,
  zeroRuleSavedNotice,
  type DraftItem,
  type MarkerRect,
  type ScopeChoice,
  type SelectionRow,
  type WizardMode,
  type WizardPhase,
} from '@/core/wizard-logic';
import { PickController } from './pick-controller';
import { adoptWizardStyles } from './wizard-styles';
import { ElementFollower } from '../follow';

/** 草稿：DraftItem + 当前候选选择器、自动命名、「只这一个 / 同类一起」的两个命中数 */
type Draft = DraftItem & {
  candidates: string[];
  /** 自动命名结果，清空名称时作为输入框的占位提示，保存时也回落到它 */
  autoName: string;
  /** 当前这组候选在页面上命中的元素数（当前设置实际会收起几个） */
  hits: number;
  /** 「同类一起」那组候选的命中数（行内的 N，实时算）；也是「同类一起」能不能选的依据 */
  sameHits: number;
};

/** 每种收起方式下面的一行白话解释（只显示当前选中的那一条） */
const STRATEGY_HINT: Record<StrategyId, string> = {
  remove: '下面的内容往上补',
  blank: '位置留着不动',
  mask: '盖一块和背景同色的板',
};

/**
 * 向导的界面文案（#51 新增的外壳与第 1 步）。集中放在这里，方便 #57 抽成中英双语表；
 * 还没改到的第 2 / 3 步文案暂时留在各自的模板里。
 */
const TEXT = {
  heading: {
    title: '标签页标题和图标',
    pick: '点选要收起的内容',
    preview: '看效果',
  },
  progress: (index: number, total: number) => `第 ${index} 步 / 共 ${total} 步`,
  titleLabel: '标签页标题',
  titleHint: (fallback: string) =>
    `上面写什么，标签页就显示什么，现在就能看到。留空会用「${fallback}」——标题不会留成空白，空白时 Chrome 会改为显示网址。`,
  quickLabel: '快捷标题',
  iconLabel: '标签页图标',
  iconUpload: '上传图标',
  iconReplace: '换一张图标',
  iconBusy: '正在处理…',
  iconClear: '清除图标',
  iconPreviewAlt: '将显示在标签页上的图标',
  iconHint: (hasDefault: boolean) =>
    hasDefault
      ? '图标可以不传；不传时用插件设置里的默认图标。'
      : '图标可以不传；不传时标签页上的图标位留空。',
  iconFailed: '没能处理这张图标，请再试一次',
  pickLead: ['点一下页面上的东西，就选中它。', '再点一下取消，可以连着选好几个。', '选中的都列在下面，随时能删。'],
  /** 调整组（#52）：自成一组，组内标明现在调的是第几项 */
  adjustGroup: '调整选中的那一项',
  adjustNow: '现在调的是',
  adjustEmpty: '还没选中东西。先在页面上点一下要调整的那一项。',
  bigger: '选大一点',
  smaller: '选小一点',
  /** 已选清单（#52）：一行一项，逐项删除；「全部删掉」是文字链接 */
  listTitle: (n: number) => (n > 0 ? `已选的 ${n} 项` : '已选的内容'),
  listEmpty: '还没有选任何东西。',
  clearAll: '全部删掉',
  deleteOne: (seq: number, name: string) => `删掉第 ${seq} 项：${name}`,
  /** 0 项时前进按钮是灰的，旁边的说明告诉用户去哪儿选 */
  nextBlocked: '先在页面上点一下要收起的内容',
  /** 第 3 步（#53）：每行两行排版——第一行序号 / 名字 / 删除，第二行收起方式与「只这一个 / 同类一起」 */
  previewHint: '滚动页面确认效果（盖住要能跟住元素）。每一行可以直接改名称、换收起方式、决定收它一个还是同类一起。',
  draftsLabel: '本次要收起的内容',
  nameLabel: (seq: number) => `第 ${seq} 项的名称，留空则自动命名`,
  methodLegend: '收起方式',
  /** 行内那对选项说的是「收起几个」，与底部的「在哪些页面收起」不是一件事，两边用词不能撞 */
  onlyLegend: (seq: number) => `第 ${seq} 项收起几个`,
  onlyThis: '只这一个',
  sameGroup: (n: number) => `同类一起（${n}）`,
  /** 同类只有 1 个时第二项不可选，这句话解释为什么 */
  sameNone: '页面上没有第二个同类',
  /** 页面级的那件事：三选一放在这一步底部，不再点保存才问 */
  scopeLegend: '在哪些页面收起',
  scopeAll: '整个网站（默认）',
  scopeInclude: (label: string) => `只在这类页面：${label}`,
  scopeExclude: (label: string) => `除了这类页面：${label}`,
  back: '上一步',
  nextToPick: '下一步：选内容',
  nextToPreview: (n: number) => `下一步：看效果（${n}）`,
  save: '保存',
  /** 保存后 0 条规则时的轻提示（不拦人，说明生效的是标签页名字） */
  zeroRuleNotice: zeroRuleSavedNotice,
  titleDone: '只改标题，完成',
  exit: '退出设置',
  exitTitle: '退出设置？',
  /** 退出确认：说清楚已选内容不保存、标签页会变回原来的名字（#51） */
  exitBody: (selected: number) =>
    selected > 0
      ? `已经选的 ${selected} 项不会保存；退出后标签页会变回原来的名字，页面恢复原样。`
      : '改过的标题和图标不会保存；退出后标签页会变回原来的名字，页面恢复原样。',
  exitStay: '继续设置',
  exitConfirm: '退出',
} as const;

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

/** 新站点第一次设置从「标题与图标」开始；已添加的网站直接进选内容 */
const phase = ref<WizardPhase>(props.mode === 'newSite' ? 'title' : 'pick');
const uiLanguage = currentUiLanguage();
const titleInput = ref(props.initialTitle);
const iconDataUrl = ref<string | null>(props.initialIcon);
const iconBusy = ref(false);
const iconError = ref('');
/** 选择集（有序，顺序 = 序号）；元素本身不做响应式代理 */
const selEls = shallowRef<Element[]>([]);
const lastSel = shallowRef<Element | null>(null);
const warnText = ref('');
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
let hoverBox: HTMLElement | null = null;
/** 当前页内标记（序号牌 / 预览标记），每次重画全部换新 */
let markerBoxes: HTMLElement[] = [];
/**
 * 进入预览那一刻每项的页面坐标（视口矩形 + 当时的滚动位置）。彻底移除后元素没有矩形，
 * 它的标记一直用这份缓存，改别的项、删掉别的项都不会让它坍缩（N7）
 */
const baseRects = new WeakMap<Element, { left: number; top: number; width: number; height: number }>();
let saving = false;
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
  return TEXT.progress(index, total);
});
/** 第 1 步没有上一步（老站点进入就是选内容，左下角同样不出现「上一步」） */
const canGoBack = computed(() => wizardPrevPhase(props.mode, phase.value) !== null);
const exitBody = computed(() => TEXT.exitBody(phase.value === 'preview' ? drafts.value.length : selEls.value.length));

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
    onSelectionChange: (els) => {
      selEls.value = els;
      lastSel.value = pick.last;
      renderMarkers();
    },
    onWarnTooBig: () => showWarn('选到接近整页的内容了，可能不是你想要的；试试「选小一点」'),
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
});

function showWarn(text: string) {
  warnText.value = text;
  if (warnTimer) clearTimeout(warnTimer);
  warnTimer = setTimeout(() => (warnText.value = ''), 4000);
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

/** 有没有还没保存的东西：第 1 步看标题 / 图标是否动过，后两步看选了几项 */
function isDirty(): boolean {
  if (phase.value === 'title') {
    return titleInput.value.trim() !== props.initialTitle.trim() || iconDataUrl.value !== props.initialIcon;
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
    if (!res.ok) console.warn('[PageMask] 预览样式没能撤掉', res.error);
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

async function onIconChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  if (!file || iconBusy.value) return;
  iconBusy.value = true;
  iconError.value = '';
  try {
    const res = await fileToIconDataUrl(file);
    if (!res.ok) {
      iconError.value = res.error;
      return;
    }
    iconDataUrl.value = res.dataUrl; // watch 会立即更新标签页图标
  } catch {
    iconError.value = TEXT.iconFailed;
  } finally {
    iconBusy.value = false;
  }
}

function clearIcon() {
  iconError.value = '';
  iconDataUrl.value = null;
}

/**
 * 「只改标题，完成」：保存 0 条规则 + 标题 / 图标，站点进入清爽态，向导直接关闭，
 * 不弹保存对话框（#51）。新站点的第一份配置在这里才第一次写入。
 */
async function saveTitleOnly() {
  if (saving || finished) return;
  saving = true;
  try {
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      showWarn('预览效果没能撤掉，本次没有保存。请刷新页面后重试');
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
      showWarn(`保存没有成功（${e instanceof Error ? e.message : String(e)}），可以再点一次`);
      return;
    }
    if (!saved) {
      noticeText.value = '这个网站的设置在别处被清空了，本次修改没有保存。可以从扩展图标重新开始设置。';
      noticeDlg.value?.showModal();
      return;
    }
    // 0 条规则：关掉向导后给一句轻提示，说明生效的是标签页名字（#53）
    await finish(true, TEXT.zeroRuleNotice(titleFromInput(titleInput.value, props.initialTitle)));
  } finally {
    saving = false;
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
    btn.setAttribute('aria-label', `跳转到清单里的第 ${seq} 项`);
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

/**
 * 号码牌自己一个盒子（#52）：位置由 badgePlacement 算在元素边界外侧，不再压在元素自己的文字上。
 * 元素贴着视口顶边时号码牌翻到元素下方；实在没有空间才回到内侧，并改用半透明底。
 */
function badgePlace(box: HTMLElement) {
  return (rect: MarkerRect): MarkerRect => {
    const placed = badgePlacement(rect, BADGE_SIZE, { width: window.innerWidth, height: window.innerHeight });
    box.classList.toggle('inside', placed.side === 'inside');
    return { left: placed.left, top: placed.top, width: BADGE_SIZE.width, height: BADGE_SIZE.height };
  };
}

/**
 * 一个标记 = 元素上的框 + 框外面的号码牌。框跟元素严丝合缝（waitBoxOn 用它核对），
 * 号码牌单独跟同一个元素但位置外移。
 */
function addMarker(opts: {
  seq: number;
  kind: 'selected' | 'blank' | 'mask' | 'ghost';
  el?: Element;
  /** 彻底移除的元素没有矩形，用它进入预览时缓存的页面坐标 */
  ghost?: MarkerRect;
  jump?: () => void;
}): HTMLElement {
  const box = makeBox(`pm-wiz-${opts.kind}`);
  box.dataset.testid = `pm-box-${opts.seq}`;
  if (opts.kind === 'mask') box.style.background = '#f4f4f4';
  const badgeBox = makeBox('pm-wiz-badge-box');
  addBadge(badgeBox, opts.seq, opts.jump);
  markerBoxes.push(box, badgeBox);
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

/** 按当前阶段整体重画标记：编号每次都按最新顺序重新计算（N6）；全部同步完成，没有延时登记（N21） */
function renderMarkers() {
  clearMarkers();
  if (phase.value === 'pick') {
    // 序号与清单同源：selectionRows 的第几行就是号码牌上的数字（删掉一项后一起重排）
    for (const row of selectionRows.value) {
      const box = addMarker({ seq: row.seq, kind: 'selected', el: row.el });
      if (row.el === lastSel.value) box.classList.add('current');
    }
    return;
  }
  drafts.value.forEach((d, i) => {
    const jump = () => flashRow(i);
    if (d.strategy === 'remove') {
      // 彻底移除：元素已没有矩形，用进入预览时缓存的页面坐标 + 滚动差值跟随，只显示号码牌（N7、N8）
      const base = baseRects.get(d.el);
      addMarker({
        seq: i + 1,
        kind: 'ghost',
        jump,
        ghost: base && {
          left: base.left - window.scrollX,
          top: base.top - window.scrollY,
          width: base.width,
          height: base.height,
        },
      });
    } else if (d.strategy === 'blank') {
      addMarker({ seq: i + 1, kind: 'blank', el: d.el, jump });
    } else {
      // 方案 C 遮罩：覆盖盒本身就是预览（不拦截指针，跳转入口在号码牌上）
      addMarker({ seq: i + 1, kind: 'mask', el: d.el, jump });
    }
  });
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
    el: markRaw(el),
    name: autoName,
    autoName,
    strategy: 'remove',
    onlyThis: false,
    candidates,
    hits,
    sameHits: hits,
  };
}

async function enterPreview() {
  if (selEls.value.length === 0) return;
  phase.value = 'preview';
  document.documentElement.style.cursor = '';
  pick.stop();
  if (pickLayer) pickLayer.style.display = 'none';
  updateHoverBox(null);

  // 继续选择后回来：已有草稿（改过的名称、方案、同类设置）保留，只给新元素建草稿（N12）
  const existing = new Map(drafts.value.map((d) => [d.el, d] as const));
  drafts.value = [...reconcileDrafts(selEls.value, existing, newDraft).values()];
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
  for (const d of drafts.value) {
    const r = d.el.getBoundingClientRect();
    baseRects.set(d.el, { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height });
  }
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

async function setDraftCss(css: string | null): Promise<boolean> {
  const res = await props.setDraft(css);
  if (!res.ok) showWarn(css ? '预览没能生效，请再点一次预览试试' : '预览效果没能撤掉，刷新页面即可恢复');
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
  if (onlyOneOf(d) === want) return;
  if (!want && d.sameHits <= 1) return;
  const next = generateCandidates(d.el, { onlyThis: want });
  if (next.length === 0) {
    // 切换后找不到可靠写法：保持原设置，不让这条变成保存不了的空规则
    showWarn('切换后没法稳定识别这个元素，已保持原来的设置');
    return;
  }
  d.onlyThis = want;
  d.candidates = next;
  d.hits = countCandidateHits(document, next);
  if (!want) d.sameHits = d.hits;
  void applyPreview();
}

/** 删除这一项：草稿和选择集一起移除；删到最后一项时回到点选阶段（N11） */
function removeDraft(d: Draft) {
  drafts.value = drafts.value.filter((x) => x.el !== d.el);
  pick.remove(d.el);
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
  if (saving || finished) return;
  // 保存门槛：每条规则至少 1 个候选，空规则保存后什么也藏不掉
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) {
    showWarn(warn);
    return;
  }
  saving = true;
  try {
    // 范围在这一步底部整批选一次（推不出「这类页面」时只能整站）
    const scope = scopeFromChoice(scopeChoice.value, sitePattern.value);
    const now = Date.now();
    const rules: HideRule[] = drafts.value.map((d) => ({
      id: newRuleId(),
      elementName: draftName(d),
      candidates: [...d.candidates],
      strategy: d.strategy,
      scope,
      onlyThis: d.onlyThis,
      createdAt: now,
    }));

    // 先等预览样式真正撤掉，再落库；撤销失败时保留草稿，不能把“预览已关”当作既成事实（N22）
    const cleared = await props.setDraft(null);
    if (!cleared.ok) {
      console.warn('[PageMask] 保存前预览样式没能撤掉', cleared.error);
      showWarn('预览效果没能撤掉，本次没有保存。请刷新页面后重试');
      return;
    }

    const storage = createPageMaskStorage(browser.storage.local);
    const origin = new URL(props.url).origin;
    let saved;
    try {
      // 原子追加：基于最新存储值只加规则。新站点的配置在这里才第一次写入（保存前不写，退出即不留痕迹）；
      // 添加内容时站点若已被清空则不写入。重选元素：同一次写入里用新规则换掉旧规则（旧规则不在就只追加）
      saved = await storage.updateProfile(
        origin,
        (p) => {
          if (props.replaceRuleId) {
            const i = p.hideRules.findIndex((r) => r.id === props.replaceRuleId);
            if (i >= 0) p.hideRules.splice(i, 1);
          }
          p.hideRules.push(...rules);
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
      showWarn(`保存没有成功（${e instanceof Error ? e.message : String(e)}），可以再点一次保存`);
      await applyPreview();
      return;
    }
    if (!saved) {
      noticeText.value = '这个网站的设置在别处被清空了，本次选择没有保存。可以从扩展图标重新开始设置。';
      noticeDlg.value?.showModal();
      return;
    }
    // 保存即完成（#53）：不再弹第二个确认框；0 条规则时只给一句轻提示
    const notice = rules.length === 0 ? TEXT.zeroRuleNotice(titleFromInput(titleInput.value, props.initialTitle)) : undefined;
    await finish(true, notice);
  } finally {
    saving = false;
  }
}
</script>
