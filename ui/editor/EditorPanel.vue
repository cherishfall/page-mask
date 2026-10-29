<template>
  <!-- 非模态浮层：页面仍可操作（<dialog popover="manual">，进 top layer 但不让页面 inert）。
       Esc 关闭；打开时焦点放进面板，关闭后由内容脚本卸载宿主（N31） -->
  <dialog
    ref="dlg"
    v-bind="POPOVER_MANUAL"
    class="pm-ed"
    tabindex="-1"
    aria-labelledby="pm-ed-title"
    data-testid="pm-editor-panel"
  >
    <div class="pm-ed-head">
      <h2 id="pm-ed-title" class="pm-ed-title">编辑收起的内容</h2>
      <button type="button" class="pm-ed-close" aria-label="关闭编辑面板" data-testid="pm-editor-close" @click="emit('close')">
        <span aria-hidden="true">✕</span>
      </button>
    </div>
    <p class="pm-ed-hint">只列当前页面生效的规则（{{ rules.length }} 条）；改动即时生效</p>

    <!-- 没有规则：说清楚这是正常的「只改标题」形态，并给出开始点选的入口（#51） -->
    <div v-if="rules.length === 0" class="pm-ed-empty-box" data-testid="pm-ed-empty">
      <p class="pm-ed-empty">{{ emptyText }}</p>
      <button type="button" class="pm-ed-btn primary" data-testid="pm-editor-start" @click="emit('addElement')">
        开始选要收起的内容
      </button>
    </div>

    <ul v-else class="pm-ed-list">
      <li v-for="rule in rules" :key="rule.id" class="pm-ed-card">
        <div class="pm-ed-cardhead">
          <span class="pm-ed-name">{{ rule.elementName }}</span>
          <span v-if="rule.lastHealth === 'stale'" class="pm-ed-stale" data-testid="pm-ed-stale">
            <span aria-hidden="true">● </span>可能失效
          </span>
        </div>

        <!-- 失效说明用可见文字（不是 title），并给出「去处理」入口（N39、design.md） -->
        <p v-if="rule.lastHealth === 'stale'" class="pm-ed-stale-msg">
          <span>{{ healthMsg(rule) }}</span>
          <button type="button" class="pm-ed-btn" :data-testid="`pm-ed-fix-${rule.id}`" @click="emit('reselect', rule.id)">
            去处理
          </button>
        </p>

        <fieldset class="pm-ed-field">
          <legend>收起方式</legend>
          <!-- 原生单选组（同一 name = 一组）：方向键可切换，读屏报「3 选 1」；视觉上仍是一排分段 -->
          <div class="pm-ed-seg">
            <label v-for="s in STRATEGY_LIST" :key="s" class="pm-ed-seg-opt">
              <input
                type="radio"
                :name="`pm-ed-strategy-${rule.id}`"
                :value="s"
                :checked="rule.strategy === s"
                :data-testid="`pm-ed-strategy-${rule.id}-${s}`"
                @change="setStrategy(rule, s)"
              />
              <span>{{ STRATEGY_LABEL[s] }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset class="pm-ed-field">
          <legend>生效范围</legend>
          <div class="pm-ed-seg">
            <button type="button" class="pm-ed-btn" :aria-pressed="rule.scope.type === 'all'" @click="setScope(rule, 'all')">
              整站
            </button>
            <template v-if="pattern">
              <button
                type="button"
                class="pm-ed-btn"
                :aria-pressed="rule.scope.type === 'include'"
                @click="setScope(rule, 'include')"
              >
                仅这类页面
              </button>
              <button
                type="button"
                class="pm-ed-btn"
                :aria-pressed="rule.scope.type === 'exclude'"
                @click="setScope(rule, 'exclude')"
              >
                排除这类页面
              </button>
            </template>
          </div>
          <p v-if="!pattern && scopeHint" class="pm-ed-hint" style="margin: 4px 0 0">{{ scopeHint }}</p>
          <p v-else-if="pattern && rule.scope.type !== 'all'" class="pm-ed-hint" style="margin: 4px 0 0">
            {{ rule.scope.type === 'include' ? '仅' : '除' }}：{{ rule.scope.patterns[0]?.label ?? pattern.label }}
          </p>
        </fieldset>

        <div class="pm-ed-actions">
          <button type="button" class="pm-ed-btn" :data-testid="`pm-ed-reselect-${rule.id}`" @click="emit('reselect', rule.id)">
            重选元素
          </button>
          <button type="button" class="pm-ed-btn danger" :data-testid="`pm-ed-delete-${rule.id}`" @click="removeRule(rule)">
            删除
          </button>
        </div>

        <details class="pm-ed-adv">
          <summary>高级：选择器原文</summary>
          <p class="pm-ed-hint" style="margin: 4px 0 0">每行一个，保存前会在当前页面检查</p>
          <textarea
            v-model="advanced[rule.id]"
            class="pm-ed-textarea"
            rows="2"
            spellcheck="false"
            :aria-label="`「${rule.elementName}」的选择器，每行一个`"
            :data-testid="`pm-ed-selector-${rule.id}`"
          ></textarea>
          <p v-if="advError[rule.id]" class="pm-ed-error" role="alert" :data-testid="`pm-ed-selector-error-${rule.id}`">
            {{ advError[rule.id] }}
          </p>
          <button type="button" class="pm-ed-btn" style="margin-top: 4px" @click="saveAdvanced(rule)">保存选择器</button>
        </details>
      </li>
    </ul>

    <button
      v-if="rules.length > 0"
      type="button"
      class="pm-ed-add"
      data-testid="pm-editor-add"
      @click="emit('addElement')"
    >
      ＋ 收起更多内容
    </button>

    <!-- 删除后约 5 秒可撤销。容器常驻（live region 只有内容出现时才播报） -->
    <div class="pm-ed-undo" role="status" data-testid="pm-editor-undo">
      <template v-if="undo">
        <span>已删除「{{ undo.name }}」</span>
        <button type="button" class="pm-ed-btn" data-testid="pm-editor-undo-btn" @click="undoDelete">撤销</button>
      </template>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import { rulesApplicableAt, scopeLabel } from '@/core/scope';
import { deriveScopePattern, scopeUnavailableHint } from '@/core/origin';
import { healthMessage } from '@/core/health';
import { selectorHitsElement } from '@/core/selectors';
import { isSafeSelector } from '@/core/validate';
import { STRATEGY_LABEL, type HideRule, type Scope, type SiteProfile, type StrategyId } from '@/core/types';
import { useRuleUndo } from '../rule-undo';
import { adoptEditorStyles } from './editor-styles';

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER_MANUAL = { popover: 'manual' } as Record<string, string>;

const props = defineProps<{
  origin: string;
  /** 响应式对象而不是字符串：SPA 换页后「当前页面生效的规则」要跟着换（N4） */
  page: { url: string };
}>();
const emit = defineEmits<{
  close: [];
  addElement: [];
  reselect: [ruleId: string];
}>();

const STRATEGY_LIST: StrategyId[] = ['remove', 'blank', 'mask'];
const storage = createPageMaskStorage(browser.storage.local);
const dlg = ref<HTMLDialogElement | null>(null);
const profile = ref<SiteProfile | null>(null);
const advanced = reactive<Record<string, string>>({});
const advError = reactive<Record<string, string>>({});

const pattern = computed(() => deriveScopePattern(props.page.url));
const scopeHint = computed(() => scopeUnavailableHint(props.page.url));

const rules = computed(() => {
  const p = profile.value;
  if (!p) return [] as HideRule[];
  return rulesApplicableAt(p.hideRules, props.page.url);
});

/** 空状态文案：整站没有规则（只改标题的站点）与「这一页没有生效规则」分开说 */
const emptyText = computed(() => {
  const total = profile.value?.hideRules.length ?? 0;
  return total === 0
    ? '这个网站还没有收起任何内容。先到页面上点选你想收起来的东西。'
    : '这个页面还没有生效的收起项。可以在页面上再选一些内容。';
});

/** 删除与撤销（与管理页的站点设置共用同一套逻辑与 5 秒计时，core/rule-undo.ts） */
const { pending: undo, remove: removeRuleById, undo: undoDelete } = useRuleUndo((update) => {
  void persist((draft) => {
    draft.hideRules = update(draft.hideRules);
  });
});

onMounted(async () => {
  const root = dlg.value?.getRootNode();
  if (root instanceof ShadowRoot) adoptEditorStyles(root);
  dlg.value?.showPopover();
  await nextTick();
  dlg.value?.focus();
  await load();
  // 别处（popup、管理页、本页体检回写）改了存储：按最新值刷新，不用本地副本覆盖别人（N4）
  browser.storage.onChanged.addListener(onChanged);
  // Esc 关闭面板（N31）。面板是非模态的，焦点可能已经被用户点到页面上：
  // 在捕获阶段统一处理，键盘焦点在哪都能关；面板开着时这一次 Esc 不再传给页面
  document.addEventListener('keydown', onDocKeyDown, true);
});

onBeforeUnmount(() => {
  browser.storage.onChanged.removeListener(onChanged);
  document.removeEventListener('keydown', onDocKeyDown, true);
});

function onDocKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  e.stopPropagation();
  emit('close');
}

function onChanged(_changes: Record<string, unknown>, area: string) {
  if (area === 'local') void load();
}

async function load() {
  profile.value = await storage.getProfile(props.origin);
  for (const r of rules.value) if (advanced[r.id] === undefined) advanced[r.id] = r.candidates.join('\n');
}

/**
 * 原子写入：对最新存储值只改这一条规则（或规则列表），写完用最新值刷新面板。
 * onChanged → 运行时即时重应用＝即时预览。绝不整体写回本地副本，否则会把开关等改动覆盖回去
 */
async function persist(mutate: (p: SiteProfile) => void | false) {
  const fresh = await storage.updateProfile(props.origin, mutate);
  if (fresh) profile.value = fresh;
}

function updateRule(ruleId: string, change: (r: HideRule) => void) {
  void persist((p) => {
    const r = p.hideRules.find((x) => x.id === ruleId);
    if (!r) return false;
    change(r);
  });
}

function setStrategy(rule: HideRule, s: StrategyId) {
  rule.strategy = s;
  updateRule(rule.id, (r) => {
    r.strategy = s;
  });
}

function setScope(rule: HideRule, type: 'all' | 'include' | 'exclude') {
  const scope: Scope = type === 'all' || !pattern.value ? { type: 'all' } : { type, patterns: [{ ...pattern.value }] };
  rule.scope = scope;
  updateRule(rule.id, (r) => {
    r.scope = scope;
  });
}

/** 删除：立即从存储移除，约 5 秒内可撤销（撤销放回原位置） */
function removeRule(rule: HideRule) {
  removeRuleById(profile.value?.hideRules ?? [], rule.id);
}

/**
 * 高级后门（uBlock 同款门槛）：每行必须是单个合法选择器，且保存前每行都要在当前页面命中元素。
 * 逐行检查并指出第几行——整段当成一个选择器检查会把「第 2 行不命中」误报成整体命中（N5 相关）
 */
function saveAdvanced(rule: HideRule) {
  const text = (advanced[rule.id] ?? '').trim();
  if (!text) {
    advError[rule.id] = '选择器不能为空';
    return;
  }
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    if (!isSafeSelector(line)) {
      advError[rule.id] = `第 ${i + 1} 行不是有效的选择器：每行只能写一个，不能包含 { } ; @ 或逗号`;
      return;
    }
    if (selectorHitsElement(line) < 1) {
      advError[rule.id] = `第 ${i + 1} 行在当前页面没有找到目标，不能保存`;
      return;
    }
  }
  advError[rule.id] = '';
  rule.candidates = lines;
  updateRule(rule.id, (r) => {
    r.candidates = lines;
  });
}

function healthMsg(rule: HideRule): string {
  return healthMessage(rule, scopeLabel(rule.scope));
}
</script>
