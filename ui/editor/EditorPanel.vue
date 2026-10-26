<template>
  <div :style="drawerStyle" data-testid="pm-editor-panel">
    <div :style="headStyle">
      <span :style="{ fontSize: '14px', fontWeight: 600 }">编辑规则</span>
      <button :style="closeBtnStyle" data-testid="pm-editor-close" @click="emit('close')">✕</button>
    </div>
    <div :style="{ fontSize: '11px', color: '#999', marginBottom: '8px' }">
      只列当前页面生效的规则（{{ rules.length }} 条）；改动即时生效
    </div>

    <div v-if="rules.length === 0" :style="{ fontSize: '13px', color: '#777', padding: '12px 0' }">
      这个页面还没有生效的隐藏规则
    </div>

    <div v-for="rule in rules" :key="rule.id" :style="cardStyle">
      <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }">
        <span :style="{ fontSize: '13px', fontWeight: 500 }">{{ rule.elementName }}</span>
        <span v-if="rule.lastHealth === 'stale'" :style="staleStyle" :title="healthMsg(rule)">● 可能失效</span>
      </div>

      <div :style="rowStyle">
        <span :style="labelStyle">收起方案</span>
        <div :style="{ display: 'flex', gap: '4px' }">
          <button
            v-for="s in STRATEGY_LIST"
            :key="s"
            :style="rule.strategy === s ? segOnStyle : segStyle"
            :data-testid="`pm-ed-strategy-${rule.id}-${s}`"
            @click="setStrategy(rule, s)"
          >
            {{ STRATEGY_LABEL[s] }}
          </button>
        </div>
      </div>

      <div :style="rowStyle">
        <span :style="labelStyle">生效范围</span>
        <div :style="{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const }">
          <button :style="rule.scope.type === 'all' ? segOnStyle : segStyle" @click="setScope(rule, 'all')">整站</button>
          <template v-if="pattern">
            <button :style="rule.scope.type === 'include' ? segOnStyle : segStyle" @click="setScope(rule, 'include')">
              仅这类页面
            </button>
            <button :style="rule.scope.type === 'exclude' ? segOnStyle : segStyle" @click="setScope(rule, 'exclude')">
              排除这类页面
            </button>
          </template>
        </div>
      </div>
      <div v-if="pattern && rule.scope.type !== 'all'" :style="{ fontSize: '11px', color: '#999', marginTop: '2px' }">
        {{ rule.scope.type === 'include' ? '仅' : '除' }}：{{ rule.scope.patterns[0]?.label ?? pattern.label }}
      </div>

      <div :style="{ display: 'flex', gap: '6px', marginTop: '8px' }">
        <button :style="smallBtnStyle" @click="emit('reselect', rule.id)">重选元素</button>
        <button :style="smallDangerStyle" :data-testid="`pm-ed-delete-${rule.id}`" @click="removeRule(rule)">删除</button>
      </div>

      <details style="margin-top: 8px">
        <summary :style="{ fontSize: '11px', color: '#999', cursor: 'pointer', userSelect: 'none' }">高级：选择器原文</summary>
        <textarea
          v-model="advanced[rule.id]"
          :style="textareaStyle"
          rows="2"
          :data-testid="`pm-ed-selector-${rule.id}`"
        ></textarea>
        <div v-if="advError[rule.id]" :style="{ fontSize: '11px', color: '#c33', marginTop: '2px' }">{{ advError[rule.id] }}</div>
        <button :style="smallBtnStyle" style="margin-top: 4px" @click="saveAdvanced(rule)">保存选择器</button>
      </details>
    </div>

    <button :style="addBtnStyle" data-testid="pm-editor-add" @click="emit('addElement')">＋ 添加元素</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, type CSSProperties } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import { rulesApplicableAt } from '@/core/scope';
import { deriveScopePattern } from '@/core/origin';
import { scopeLabel } from '@/core/scope';
import { healthMessage } from '@/core/health';
import { selectorHitsElement } from '@/core/selectors';
import { STRATEGY_LABEL, type HideRule, type SiteProfile, type StrategyId } from '@/core/types';

const props = defineProps<{ origin: string; url: string }>();
const emit = defineEmits<{
  close: [];
  addElement: [];
  reselect: [ruleId: string];
}>();

const STRATEGY_LIST: StrategyId[] = ['remove', 'blank', 'mask'];
const storage = createPageMaskStorage(browser.storage.local);
const profile = ref<SiteProfile | null>(null);
const advanced = reactive<Record<string, string>>({});
const advError = reactive<Record<string, string>>({});
const pattern = computed(() => deriveScopePattern(props.url));

const rules = computed(() => {
  const p = profile.value;
  if (!p) return [] as HideRule[];
  return rulesApplicableAt(p.hideRules, props.url);
});

onMounted(async () => {
  profile.value = await storage.getProfile(props.origin);
  for (const r of rules.value) advanced[r.id] = r.candidates.join('\n');
});

async function persist() {
  if (!profile.value) return;
  await storage.putProfile(profile.value); // onChanged → 运行时即时重应用（即时预览）
}

function setStrategy(rule: HideRule, s: StrategyId) {
  rule.strategy = s;
  void persist();
}

function setScope(rule: HideRule, type: 'all' | 'include' | 'exclude') {
  if (type === 'all' || !pattern.value) {
    rule.scope = { type: 'all' };
  } else {
    rule.scope = { type, patterns: [pattern.value] };
  }
  void persist();
}

function removeRule(rule: HideRule) {
  if (!profile.value) return;
  profile.value.hideRules = profile.value.hideRules.filter((r) => r.id !== rule.id);
  void persist();
}

/** 高级后门（uBlock 同款门槛）：保存前必须现场命中至少一个元素 */
function saveAdvanced(rule: HideRule) {
  const text = (advanced[rule.id] ?? '').trim();
  if (!text) {
    advError[rule.id] = '选择器不能为空';
    return;
  }
  const hits = selectorHitsElement(text);
  if (hits < 1) {
    advError[rule.id] = '这个选择器在当前页面没有命中任何元素，不能保存';
    return;
  }
  advError[rule.id] = '';
  rule.candidates = text.split('\n').map((s) => s.trim()).filter(Boolean);
  void persist();
}

function healthMsg(rule: HideRule): string {
  return healthMessage(rule, scopeLabel(rule.scope));
}

const drawerStyle: CSSProperties = {
  position: 'fixed',
  top: '0',
  right: '0',
  bottom: '0',
  width: '300px',
  zIndex: '2147483646',
  background: '#fff',
  color: '#222',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
  padding: '14px',
  overflowY: 'auto',
  fontFamily: 'system-ui, sans-serif',
  pointerEvents: 'auto',
};
const headStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '6px',
};
const cardStyle: CSSProperties = {
  border: '1px solid #e8e8e8',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '10px',
};
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' };
const labelStyle: CSSProperties = { fontSize: '12px', color: '#666' };
const segStyle: CSSProperties = {
  border: '1px solid #ccc',
  background: '#f5f5f5',
  color: '#333',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
};
const segOnStyle: CSSProperties = { ...segStyle, background: '#3575e0', borderColor: '#3575e0', color: '#fff' };
const smallBtnStyle: CSSProperties = {
  border: '1px solid #ccc',
  background: '#fafafa',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
  color: '#333',
};
const smallDangerStyle: CSSProperties = { ...smallBtnStyle, color: '#c33', borderColor: '#e5b4b4' };
const closeBtnStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '14px',
  cursor: 'pointer',
  color: '#888',
};
const addBtnStyle: CSSProperties = {
  width: '100%',
  border: '1px dashed #bbb',
  background: '#fafafa',
  borderRadius: '8px',
  padding: '9px',
  fontSize: '13px',
  cursor: 'pointer',
  color: '#555',
};
const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '6px',
  fontSize: '11px',
  fontFamily: 'ui-monospace, monospace',
  marginTop: '6px',
};
const staleStyle: CSSProperties = { fontSize: '11px', color: '#e5484d', cursor: 'help' };
</script>
