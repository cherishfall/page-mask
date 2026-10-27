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
        <h2 id="pm-wiz-title" class="pm-wiz-title">{{ phase === 'pick' ? '点选要收起的内容' : '预览效果' }}</h2>
      </div>

      <template v-if="phase === 'pick'">
        <p class="pm-wiz-sub">点一下选中，再点一下取消，可以连续选多个。按 Esc 或「取消」离开。</p>
        <p class="pm-wiz-sub" data-testid="pm-wiz-adjust-target">
          <template v-if="lastSel">
            选中的是里面的文字？用「选大一点」调整
            <strong>第 {{ lastSelIndex + 1 }} 项（{{ lastSelName }}）</strong>
          </template>
          <template v-else>选中的是里面的文字时，可以用「选大一点」调整</template>
        </p>
        <div class="pm-wiz-btns">
          <button type="button" class="pm-wiz-btn" data-testid="pm-wiz-bigger" :disabled="!lastSel" @click="adjust('bigger')">
            选大一点
          </button>
          <button type="button" class="pm-wiz-btn" data-testid="pm-wiz-smaller" :disabled="!lastSel" @click="adjust('smaller')">
            选小一点
          </button>
          <button
            v-if="selEls.length > 0"
            type="button"
            class="pm-wiz-btn"
            data-testid="pm-wiz-clear"
            @click="clearSelection"
          >
            清空（{{ selEls.length }}）
          </button>
          <button
            type="button"
            class="pm-wiz-btn primary"
            data-testid="pm-wiz-preview"
            :disabled="selEls.length === 0"
            @click="enterPreview"
          >
            预览（{{ selEls.length }}）
          </button>
          <button type="button" class="pm-wiz-btn" data-testid="pm-wiz-exit" @click="requestExit">取消</button>
        </div>
      </template>

      <template v-else>
        <p class="pm-wiz-sub">滚动页面确认效果（盖住要能跟住元素）。每一行可以直接改名称、换收起方式、改范围。</p>
        <ol class="pm-wiz-drafts" aria-label="本次要收起的内容" data-testid="pm-wiz-drafts">
          <li v-for="(d, i) in drafts" :key="i" :data-testid="`pm-draft-${i + 1}`">
            <div class="pm-wiz-draft-main">
              <span class="pm-wiz-num" aria-hidden="true">{{ i + 1 }}</span>
              <input
                v-model="d.name"
                class="pm-wiz-name"
                type="text"
                :placeholder="d.autoName"
                :aria-label="`第 ${i + 1} 项的名称，留空则自动命名`"
                :data-testid="`pm-draft-name-${i + 1}`"
              />
              <!-- 三个收起方式：底层是原生单选组（同一 name = 一组，方向键可切换，读屏报「3 选 1」），视觉上做成连体分段 -->
              <fieldset class="pm-wiz-method">
                <legend class="pm-wiz-sr">收起方式</legend>
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
              <button
                type="button"
                class="pm-wiz-range"
                :disabled="!rangeClickable(d)"
                :data-testid="`pm-draft-${i + 1}-range`"
                @click="toggleOnlyThis(d)"
              >
                {{ rangeLabel(d) }}
              </button>
              <button
                type="button"
                class="pm-wiz-del"
                aria-label="不收起这一项"
                :data-testid="`pm-draft-${i + 1}-remove`"
                @click="removeDraft(d)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p class="pm-wiz-draft-hint" :data-testid="`pm-draft-${i + 1}-hint`">{{ STRATEGY_HINT[d.strategy] }}</p>
          </li>
        </ol>
        <div class="pm-wiz-btns">
          <button type="button" class="pm-wiz-btn" data-testid="pm-wiz-continue" @click="backToPick">继续选择</button>
          <button type="button" class="pm-wiz-btn primary" data-testid="pm-wiz-save" @click="openSave">保存</button>
          <button type="button" class="pm-wiz-btn" data-testid="pm-wiz-exit" @click="requestExit">取消</button>
        </div>
      </template>
    </section>

    <!-- 提示（读屏按 polite 状态消息播报；容器常驻，内容出现时才播报） -->
    <div class="pm-wiz-status" role="status">
      <span v-if="warnText" class="pm-wiz-toast" data-testid="pm-wizard-warn">{{ warnText }}</span>
    </div>

    <!-- 放弃确认：模态；Esc = 继续编辑，焦点默认在「继续编辑」（危险动作实底红，N9） -->
    <dialog
      ref="exitDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-exit-title"
      data-testid="pm-wizard-exit-confirm"
      @close="onExitClose"
    >
      <form method="dialog">
        <h2 id="pm-exit-title">放弃这些设置？</h2>
        <p>
          {{ phase === 'pick' ? `已经选了 ${selEls.length} 项，` : `${drafts.length} 项还没保存，` }}放弃后不会保存，页面恢复原样。
        </p>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-wiz-btn" autofocus data-testid="pm-wiz-exit-no">继续编辑</button>
          <button value="exit" class="pm-wiz-btn primary danger" data-testid="pm-wiz-exit-yes">放弃</button>
        </div>
      </form>
    </dialog>

    <!-- 保存：选生效范围 + 确认；Esc = 再看看 -->
    <dialog
      ref="saveDlg"
      class="pm-wiz-dialog"
      aria-labelledby="pm-save-title"
      data-testid="pm-wizard-save-pop"
      @close="onSaveClose"
    >
      <form method="dialog">
        <h2 id="pm-save-title">保存这 {{ drafts.length }} 项</h2>
        <fieldset class="pm-wiz-field">
          <legend>在哪些页面收起</legend>
          <label class="pm-wiz-radio"><input v-model="scopeChoice" type="radio" value="all" /> 整个网站（默认）</label>
          <template v-if="sitePattern">
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="include" /> 只在这类页面：{{ sitePattern.label }}
            </label>
            <label class="pm-wiz-radio">
              <input v-model="scopeChoice" type="radio" value="exclude" /> 除了这类页面：{{ sitePattern.label }}
            </label>
          </template>
          <span v-else-if="scopeHint" class="pm-wiz-hint" data-testid="pm-wiz-scope-hint">{{ scopeHint }}</span>
        </fieldset>
        <div class="pm-wiz-actions">
          <button value="cancel" class="pm-wiz-btn">再看看</button>
          <button value="save" class="pm-wiz-btn primary" autofocus data-testid="pm-wiz-save-yes">保存</button>
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
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { browser } from 'wxt/browser';
import { describeElement } from '@/core/naming';
import { generateCandidates } from '@/core/selectors';
import { deriveScopePattern, scopeUnavailableHint } from '@/core/origin';
import { STRATEGY_LABEL, newRuleId, type HideRule, type Scope, type StrategyId } from '@/core/types';
import { createPageMaskStorage } from '@/core/storage';
import { buildPreviewCss, STRATEGY_ORDER } from '@/core/css-builder';
import { isOwnUiNode } from '@/core/host-shield';
import { countCandidateHits } from '@/core/health';
import type { CssAck } from '@/core/messages';
import {
  clampToViewport,
  reconcileDrafts,
  unsavableDraftWarning,
  wizardEscAction,
  type DraftItem,
} from '@/core/wizard-logic';
import { PickController } from './pick-controller';
import { adoptWizardStyles } from './wizard-styles';
import { ElementFollower } from '../follow';

/** 草稿：DraftItem + 当前候选选择器、自动命名、两种范围的实时命中数 */
type Draft = DraftItem & {
  candidates: string[];
  /** 自动命名结果，清空名称时作为输入框的占位提示，保存时也回落到它 */
  autoName: string;
  /** 当前这组候选在页面上命中的元素数（范围标签的 N） */
  hits: number;
  /** 「同类一起收起」那组候选的命中数：切到「仅这一处」后据此判断还能不能切回去 */
  sameHits: number;
};

/** 每种收起方式下面的一行白话解释（只显示当前选中的那一条） */
const STRATEGY_HINT: Record<StrategyId, string> = {
  remove: '下面的内容往上补',
  blank: '位置留着不动',
  mask: '盖一块和背景同色的板',
};

/** 方向键每次移动工具条的距离 */
const KEY_STEP = 16;
const ARROW_DIRS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const props = defineProps<{
  mode: 'newSite' | 'addElement';
  url: string;
  /** 重选元素：保存时用新规则替换这条旧规则（取消则旧规则原样保留，N5） */
  replaceRuleId?: string | null;
  /** 设置本文档的预览样式（null = 清除）；由内容脚本运行时按文档记录注入状态（core/doc-styles.ts） */
  setDraft: (css: string | null) => Promise<CssAck>;
}>();
const emit = defineEmits<{ done: [saved: boolean] }>();

const phase = ref<'pick' | 'preview'>('pick');
/** 选择集（有序，顺序 = 序号）；元素本身不做响应式代理 */
const selEls = shallowRef<Element[]>([]);
const lastSel = shallowRef<Element | null>(null);
const warnText = ref('');
const noticeText = ref('');
const drafts = ref<Draft[]>([]);
const scopeChoice = ref<'all' | 'include' | 'exclude'>('all');
const tbPos = ref<{ left: number; top: number } | null>(null);
const dragging = ref(false);

const rootEl = ref<HTMLElement | null>(null);
const overlayLayer = ref<HTMLElement | null>(null);
const toolbarEl = ref<HTMLElement | null>(null);
const exitDlg = ref<HTMLDialogElement | null>(null);
const saveDlg = ref<HTMLDialogElement | null>(null);
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
  document.documentElement.style.cursor = 'crosshair';
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', reclampToolbar);
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
  return !!exitDlg.value?.open || !!saveDlg.value?.open || !!noticeDlg.value?.open;
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
  const dirty = phase.value === 'pick' ? selEls.value.length > 0 : drafts.value.length > 0;
  if (!dirty) {
    void finish(false);
    return;
  }
  exitDlg.value?.showModal();
}

function onExitClose() {
  const dlg = exitDlg.value;
  if (!dlg) return;
  const choice = dlg.returnValue;
  dlg.returnValue = ''; // Esc 不设置返回值，必须清掉上一次的
  if (choice === 'exit') void finish(false);
}

/** 结束向导：先等预览样式真正撤掉，再通知运行时（运行时随后恢复正式样式） */
async function finish(saved: boolean) {
  if (finished) return;
  finished = true;
  if (!saved) {
    const res = await props.setDraft(null);
    if (!res.ok) console.warn('[PageMask] 预览样式没能撤掉', res.error);
  }
  emit('done', saved);
}

// ---------- 选择阶段 ----------

function adjust(dir: 'bigger' | 'smaller') {
  pick.adjust(dir);
}

/** 工具条「清空」：去掉全部已选，仍留在点选模式（不想一个个点掉时的出口） */
function clearSelection() {
  pick.clear(); // 选择集变化会经 onSelectionChange 同步序号牌与工具条
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

/** 按当前阶段整体重画标记：编号每次都按最新顺序重新计算（N6）；全部同步完成，没有延时登记（N21） */
function renderMarkers() {
  clearMarkers();
  if (phase.value === 'pick') {
    selEls.value.forEach((el, i) => {
      const box = makeBox('pm-wiz-selected');
      if (el === lastSel.value) box.classList.add('current');
      addBadge(box, i + 1);
      markerBoxes.push(box);
      follower.trackLive(el, box);
    });
    return;
  }
  drafts.value.forEach((d, i) => {
    const jump = () => flashRow(i);
    if (d.strategy === 'remove') {
      // 彻底移除：元素已没有矩形，用进入预览时缓存的页面坐标 + 滚动差值跟随，只显示号码牌（N7、N8）
      const box = makeBox('pm-wiz-ghost');
      addBadge(box, i + 1, jump);
      markerBoxes.push(box);
      const base = baseRects.get(d.el);
      if (base) {
        follower.trackGhost(
          { left: base.left - window.scrollX, top: base.top - window.scrollY, width: base.width, height: base.height },
          box,
        );
      }
    } else if (d.strategy === 'blank') {
      const box = makeBox('pm-wiz-blank');
      addBadge(box, i + 1, jump);
      markerBoxes.push(box);
      follower.trackLive(d.el, box);
    } else {
      // 方案 C 遮罩：覆盖盒本身就是预览（不拦截指针，跳转入口在号码牌上）
      const box = makeBox('pm-wiz-mask');
      box.style.background = '#f4f4f4';
      addBadge(box, i + 1, jump);
      markerBoxes.push(box);
      follower.trackLive(d.el, box);
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
  // 页面可能变过（滚动加载、懒渲染）：范围标签的数字按当前 DOM 重算
  for (const d of drafts.value) {
    d.hits = countCandidateHits(document, d.candidates);
    if (!d.onlyThis) d.sameHits = d.hits;
  }

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
  document.documentElement.style.cursor = 'crosshair';
  renderMarkers();
  if (pickLayer) {
    pickLayer.style.display = '';
    pick.attach(pickLayer);
  }
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

/** 范围标签：显示当前状态（「仅这一处」或「同类 N 处」） */
function rangeLabel(d: Draft): string {
  return d.onlyThis || d.hits <= 1 ? '仅这一处' : `同类 ${d.hits} 处`;
}

/**
 * 只有「切过去确实不一样」时才可点：同类只有一处时两边是同一件事，标签不可点；
 * 切到「仅这一处」后仍要能切回来，所以这时看同类那组的命中数。
 */
function rangeClickable(d: Draft): boolean {
  return d.onlyThis ? d.sameHits > 1 : d.hits > 1;
}

/** 范围标签：在「仅这一处」与「同类 N 处」之间切换，换候选并立即刷新预览（N10） */
function toggleOnlyThis(d: Draft) {
  if (!rangeClickable(d)) return;
  const want = !d.onlyThis;
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

// ---------- 保存 ----------

function openSave() {
  // 保存门槛：每条规则至少 1 个候选，空规则保存后什么也藏不掉
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) {
    showWarn(warn);
    return;
  }
  scopeChoice.value = 'all';
  saveDlg.value?.showModal();
}

function onSaveClose() {
  const dlg = saveDlg.value;
  if (!dlg) return;
  const choice = dlg.returnValue;
  dlg.returnValue = '';
  if (choice === 'save') void doSave();
}

async function doSave() {
  if (saving || finished) return;
  const warn = unsavableDraftWarning(drafts.value);
  if (warn) {
    showWarn(warn);
    return;
  }
  saving = true;
  try {
    const pattern = sitePattern.value;
    let scope: Scope = { type: 'all' };
    if (scopeChoice.value !== 'all' && pattern) {
      scope = { type: scopeChoice.value, patterns: [pattern] } as Scope;
    }
    const now = Date.now();
    const rules: HideRule[] = drafts.value.map((d) => ({
      id: newRuleId(),
      elementName: d.name.trim() || d.autoName,
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
          if (props.mode === 'newSite') p.switchState = 'disguised'; // 新站点保存后自动开启清爽模式
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
    await finish(true);
  } finally {
    saving = false;
  }
}
</script>
