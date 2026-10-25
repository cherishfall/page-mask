<template>
  <div>
    <!-- 覆盖层：悬停框 / 序号牌 / 预览标记（代码命令式管理，本模板只提供容器） -->
    <div ref="overlayLayer" data-testid="pm-wizard-overlay"></div>

    <!-- 顶部工具条 -->
    <div :style="toolbarStyle" data-testid="pm-wizard-toolbar">
      <div :style="titleStyle">{{ phase === 'pick' ? '点选要藏起来的东西' : '预览效果' }}</div>
      <div :style="subStyle">
        <template v-if="phase === 'pick'">
          悬停高亮 → 点击选中（可连选，再点取消）；选到内层文字时用下方按钮调整；Esc 退出
        </template>
        <template v-else>
          点虚线框可调整方案；<b>请滚动页面确认效果</b>（遮罩类问题只在滚动时暴露）
        </template>
      </div>
      <div :style="toolbarBtnsStyle">
        <template v-if="phase === 'pick'">
          <button :style="btnStyle" data-testid="pm-wiz-bigger" :disabled="!hoverEl" @click="bigger">选大一点</button>
          <button :style="btnStyle" data-testid="pm-wiz-smaller" :disabled="!hoverEl" @click="smaller">选小一点</button>
          <button :style="primaryBtnStyle" data-testid="pm-wiz-preview" :disabled="selEls.length === 0" @click="enterPreview">
            预览（{{ selEls.length }}）
          </button>
          <button :style="btnStyle" data-testid="pm-wiz-cancel" @click="requestExit">取消</button>
        </template>
        <template v-else>
          <button :style="btnStyle" data-testid="pm-wiz-continue" @click="backToPick">继续选择</button>
          <button :style="primaryBtnStyle" data-testid="pm-wiz-save" @click="openSave">保存</button>
          <button :style="btnStyle" data-testid="pm-wiz-giveup" @click="requestExit">放弃</button>
        </template>
      </div>
    </div>

    <!-- 防呆提示 toast -->
    <div v-if="warnText" :style="toastStyle" data-testid="pm-wizard-warn">{{ warnText }}</div>

    <!-- 退出二次确认 -->
    <div v-if="confirmExit" :style="dialogMaskStyle" data-testid="pm-wizard-exit-confirm">
      <div :style="dialogStyle">
        <div :style="{ marginBottom: '14px', fontSize: '14px' }">
          {{ phase === 'pick' ? `已选 ${selEls.length} 个元素，退出将不保存。` : '退出将不保存本次选择。' }}
        </div>
        <div :style="{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }">
          <button :style="primaryBtnStyle" @click="confirmExit = false">继续编辑</button>
          <button :style="btnStyle" data-testid="pm-wiz-exit-yes" @click="emit('done', false)">退出</button>
        </div>
      </div>
    </div>

    <!-- 单条草稿编辑弹片（预览阶段点标记弹出） -->
    <div v-if="openIdx !== null && drafts[openIdx]" :style="popoverStyle" data-testid="pm-wizard-popover">
      <div :style="popRowStyle">
        <label :style="labelStyle">元素名</label>
        <input v-model="drafts[openIdx]!.name" :style="inputStyle" data-testid="pm-pop-name" />
      </div>
      <div :style="popRowStyle">
        <label :style="labelStyle">收起方案</label>
        <div :style="{ display: 'flex', gap: '4px' }">
          <button
            v-for="s in (['remove', 'blank', 'mask'] as DraftStrategy[])"
            :key="s"
            :style="drafts[openIdx]!.strategy === s ? segOnStyle : segStyle"
            :data-testid="`pm-pop-strategy-${s}`"
            @click="setStrategy(openIdx!, s as DraftStrategy)"
          >
            {{ STRATEGY_LABEL[s] }}
          </button>
        </div>
      </div>
      <div :style="popRowStyle">
        <label :style="labelStyle">同类元素</label>
        <label :style="{ ...labelStyle, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }">
          <input type="checkbox" v-model="drafts[openIdx]!.onlyThis" @change="regenCandidates(openIdx!)" />
          只藏点选的这个（默认：同类一起藏）
        </label>
      </div>
      <div :style="{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }">
        <button :style="dangerBtnStyle" data-testid="pm-pop-remove" @click="removeDraft(openIdx!)">移出本次选择</button>
        <button :style="primaryBtnStyle" @click="openIdx = null">完成</button>
      </div>
    </div>

    <!-- 保存确认弹片：生效范围 + 确认 -->
    <div v-if="saveOpen" :style="dialogMaskStyle" data-testid="pm-wizard-save-pop">
      <div :style="dialogStyle">
        <div :style="{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }">保存 {{ drafts.length }} 条隐藏规则</div>
        <div :style="popRowStyle">
          <label :style="labelStyle">生效范围</label>
          <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px' }">
            <label :style="radioStyle"><input type="radio" value="all" v-model="scopeChoice" /> 整站（默认）</label>
            <label v-if="sitePattern" :style="radioStyle">
              <input type="radio" value="include" v-model="scopeChoice" /> 仅限：{{ sitePattern.label }}
            </label>
            <label v-if="sitePattern" :style="radioStyle">
              <input type="radio" value="exclude" v-model="scopeChoice" /> 排除：{{ sitePattern.label }}
            </label>
          </div>
        </div>
        <div :style="{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }">
          <button :style="primaryBtnStyle" data-testid="pm-wiz-save-yes" @click="doSave">保存</button>
          <button :style="btnStyle" @click="saveOpen = false">再看看</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue';
import { browser } from 'wxt/browser';
import { describeElement } from '@/core/naming';
import { generateCandidates } from '@/core/selectors';
import { deriveScopePattern } from '@/core/origin';
import { STRATEGY_LABEL, type StrategyId } from '@/core/types';
import { newRuleId, type HideRule, type Scope, type SiteProfile } from '@/core/types';
import { createPageMaskStorage } from '@/core/storage';
import type { DraftItem } from '@/core/wizard-logic';
import { PickController } from './pick-controller';
import { ElementFollower } from '../follow';

type DraftStrategy = StrategyId;

const props = defineProps<{ mode: 'newSite' | 'addElement'; url: string }>();
const emit = defineEmits<{ done: [saved: boolean] }>();

const phase = ref<'pick' | 'preview'>('pick');
const selEls = ref<Element[]>([]);
const hoverEl = ref<Element | null>(null);
const warnText = ref('');
const confirmExit = ref(false);
const drafts = ref<(DraftItem & { candidates: string[] })[]>([]);
const openIdx = ref<number | null>(null);
const saveOpen = ref(false);
const scopeChoice = ref<'all' | 'include' | 'exclude'>('all');

const overlayLayer = ref<HTMLElement | null>(null);
const follower = new ElementFollower();
let pick: PickController;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let hoverBox: HTMLElement | null = null;
const badgeBoxes = new Map<Element, HTMLElement>();
const markerBoxes = new Map<number, HTMLElement>();

const sitePattern = computed(() => deriveScopePattern(props.url));

onMounted(() => {
  document.documentElement.style.cursor = 'crosshair';
  pick = new PickController({
    isOwnUi: (t) => {
      if (!(t instanceof Node) || !overlayLayer.value) return false;
      const root = overlayLayer.value.getRootNode();
      if (!(root instanceof ShadowRoot)) return false;
      // 事件传到 window 时，shadow 内的目标会被重定向成 host —— host 及其后代都算自家 UI
      const host = root.host;
      return t === host || host.contains(t) || root.contains(t);
    },
    onHoverChange: (el) => {
      hoverEl.value = el;
      updateHoverBox(el);
    },
    onSelectionChange: (els) => {
      selEls.value = els;
      renderBadges();
    },
    onWarnTooBig: () => showWarn('选到接近整页的元素了，可能不是你想要的；试试「选小一点」'),
    onEsc: () => {
      if (openIdx.value !== null) {
        openIdx.value = null;
        return;
      }
      if (saveOpen.value) {
        saveOpen.value = false;
        return;
      }
      if (confirmExit.value) {
        emit('done', false);
        return;
      }
      requestExit();
    },
  });
  pick.start();
});

onBeforeUnmount(() => {
  document.documentElement.style.cursor = '';
  pick?.stop();
  follower.stop();
  clearDraftCss();
  if (warnTimer) clearTimeout(warnTimer);
});

function showWarn(text: string) {
  warnText.value = text;
  if (warnTimer) clearTimeout(warnTimer);
  warnTimer = setTimeout(() => (warnText.value = ''), 3000);
}

function requestExit() {
  if (phase.value === 'pick' && selEls.value.length > 0) {
    confirmExit.value = true;
  } else if (phase.value === 'preview' && drafts.value.length > 0) {
    confirmExit.value = true;
  } else {
    emit('done', false);
  }
}

function bigger() {
  pick.adjust('bigger');
}
function smaller() {
  pick.adjust('smaller');
}

// ---------- 覆盖盒子 ----------

function boxBase(display: 'block' | ''): Partial<CSSStyleDeclaration> {
  return {
    position: 'fixed',
    display,
    pointerEvents: 'none',
    zIndex: '2147483645',
  } as Partial<CSSStyleDeclaration>;
}

function makeBox(extra: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement('div');
  Object.assign(el.style, boxBase('block'), extra);
  overlayLayer.value?.appendChild(el);
  return el;
}

function updateHoverBox(el: Element | null) {
  if (hoverBox && (!el || phase.value !== 'pick')) {
    follower.drop(hoverBox);
    hoverBox = null;
  }
  if (!el || phase.value !== 'pick') return;
  if (!hoverBox) {
    hoverBox = makeBox({
      outline: '2px solid #3575e0',
      background: 'rgba(53,117,224,0.08)',
      borderRadius: '2px',
    });
  }
  follower.trackLive(el, hoverBox);
}

function renderBadges() {
  // 清掉已取消的
  for (const [el, box] of badgeBoxes) {
    if (!selEls.value.includes(el)) {
      follower.drop(box);
      badgeBoxes.delete(el);
    }
  }
  selEls.value.forEach((el, i) => {
    let box = badgeBoxes.get(el);
    if (!box) {
      box = makeBox({
        outline: '2px solid #e07b2d',
        background: 'rgba(224,123,45,0.06)',
      });
      const tag = document.createElement('div');
      tag.textContent = String(i + 1);
      Object.assign(tag.style, {
        position: 'absolute',
        top: '-10px',
        left: '-10px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#e07b2d',
        color: '#fff',
        fontSize: '12px',
        lineHeight: '20px',
        textAlign: 'center',
        fontWeight: 600,
      } as unknown as Partial<CSSStyleDeclaration>);
      box.appendChild(tag);
      badgeBoxes.set(el, box);
    }
    follower.trackLive(el, box);
  });
}

// ---------- 预览 ----------

function enterPreview() {
  phase.value = 'preview';
  document.documentElement.style.cursor = '';
  pick.stop();
  // 悬停框、序号牌退场
  updateHoverBox(null);
  for (const [, box] of badgeBoxes) follower.drop(box);
  badgeBoxes.clear();

  drafts.value = selEls.value.map((el) => ({
    el,
    name: describeElement(el),
    strategy: 'remove' as DraftStrategy,
    onlyThis: false,
    candidates: generateCandidates(el, { onlyThis: false }),
  }));
  applyPreview();
}

function backToPick() {
  phase.value = 'pick';
  document.documentElement.style.cursor = 'crosshair';
  clearMarkers();
  drafts.value = [];
  clearDraftCss();
  renderBadges();
  pick.start();
}

function clearMarkers() {
  for (const [, box] of markerBoxes) follower.drop(box);
  markerBoxes.clear();
}

function applyPreview() {
  clearMarkers();
  const cssParts: string[] = [];
  drafts.value.forEach((d, i) => {
    const sel = d.candidates.join(', ');
    if (!sel) return;
    if (d.strategy === 'remove') {
      cssParts.push(`${sel} { display: none !important; }`);
      // 幽灵标记：捕获当前矩形，滚动跟随
      const r = d.el.getBoundingClientRect();
      const box = makeBox({
        border: '2px dashed #888',
        background: 'rgba(136,136,136,0.05)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        boxSizing: 'border-box',
      } as unknown as Partial<CSSStyleDeclaration>);
      box.dataset.testid = `pm-marker-${i + 1}`;
      addMarkerTag(box, i + 1, '#888');
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        openIdx.value = i;
      });
      markerBoxes.set(i, box);
      // remove 生效后元素矩形归零，改用幽灵跟随（初始矩形+滚动差）
      setTimeout(() => follower.trackGhost({ left: r.left, top: r.top, width: r.width, height: r.height }, box), 0);
    } else if (d.strategy === 'blank') {
      cssParts.push(`${sel} { visibility: hidden !important; pointer-events: none !important; }`);
      const box = makeBox({
        border: '2px dashed #888',
        pointerEvents: 'auto',
        cursor: 'pointer',
        boxSizing: 'border-box',
      } as unknown as Partial<CSSStyleDeclaration>);
      box.dataset.testid = `pm-marker-${i + 1}`;
      addMarkerTag(box, i + 1, '#888');
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        openIdx.value = i;
      });
      markerBoxes.set(i, box);
      follower.trackLive(d.el, box);
    } else {
      // 方案C 遮罩：实体覆盖盒就是预览本体
      const box = makeBox({
        background: '#f2f2f2',
        pointerEvents: 'auto',
        cursor: 'pointer',
        boxSizing: 'border-box',
      } as unknown as Partial<CSSStyleDeclaration>);
      box.dataset.testid = `pm-marker-${i + 1}`;
      addMarkerTag(box, i + 1, '#555');
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        openIdx.value = i;
      });
      markerBoxes.set(i, box);
      follower.trackLive(d.el, box);
    }
  });
  const draftText = cssParts.length ? cssParts.join('\n') : null;
  void browser.runtime.sendMessage({ t: 'draftCss', css: draftText }).catch(() => undefined);
}

function addMarkerTag(box: HTMLElement, seq: number, color: string) {
  const tag = document.createElement('div');
  tag.textContent = String(seq);
  Object.assign(tag.style, {
    position: 'absolute',
    top: '-10px',
    left: '-10px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: color,
    color: '#fff',
    fontSize: '12px',
    lineHeight: '20px',
    textAlign: 'center',
    fontWeight: 600,
  } as unknown as Partial<CSSStyleDeclaration>);
  box.appendChild(tag);
}

function setStrategy(idx: number, s: DraftStrategy) {
  const d = drafts.value[idx];
  if (!d) return;
  d.strategy = s;
  applyPreview();
}

function regenCandidates(idx: number) {
  const d = drafts.value[idx];
  if (!d) return;
  d.candidates = generateCandidates(d.el, { onlyThis: d.onlyThis });
}

function removeDraft(idx: number) {
  drafts.value.splice(idx, 1);
  openIdx.value = null;
  if (drafts.value.length === 0) {
    backToPick();
  } else {
    applyPreview();
  }
}

function clearDraftCss() {
  void browser.runtime.sendMessage({ t: 'draftCss', css: null }).catch(() => undefined);
}

// ---------- 保存 ----------

function openSave() {
  scopeChoice.value = 'all';
  saveOpen.value = true;
}

async function doSave() {
  saveOpen.value = false;
  const pattern = sitePattern.value;
  let scope: Scope = { type: 'all' };
  if (scopeChoice.value !== 'all' && pattern) {
    scope = { type: scopeChoice.value, patterns: [pattern] } as Scope;
  }
  const now = Date.now();
  const rules: HideRule[] = drafts.value.map((d) => ({
    id: newRuleId(),
    elementName: d.name || describeElement(d.el),
    candidates: d.candidates,
    strategy: d.strategy,
    scope,
    onlyThis: d.onlyThis,
    createdAt: now,
  }));

  // 先撤预览样式，再落库（storage 变化会触发运行时重新应用正式样式）
  await clearDraftCss();
  const storage = createPageMaskStorage(browser.storage.local);
  const origin = new URL(props.url).origin;
  const profile = (await storage.getProfile(origin))!;
  profile.hideRules.push(...rules);
  if (props.mode === 'newSite') profile.switchState = 'disguised'; // 新站点保存后自动进入伪装态
  await storage.putProfile(profile);
  emit('done', true);
}

// ---------- 样式 ----------

const toolbarStyle: CSSProperties = {
  position: 'fixed' as const,
  top: '12px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: '2147483647',
  pointerEvents: 'auto',
  background: 'rgba(28,28,30,0.95)',
  color: '#eee',
  borderRadius: '12px',
  padding: '10px 14px',
  maxWidth: '560px',
  boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center' as const,
};
const titleStyle: CSSProperties = { fontSize: '14px', fontWeight: 600, marginBottom: '2px' };
const subStyle: CSSProperties = { fontSize: '11px', color: '#aaa', marginBottom: '8px' };
const toolbarBtnsStyle: CSSProperties = { display: 'flex', gap: '8px', justifyContent: 'center' };
const btnStyle: CSSProperties = {
  border: '1px solid #555',
  background: '#3a3a3c',
  color: '#ddd',
  borderRadius: '8px',
  padding: '6px 12px',
  fontSize: '12px',
  cursor: 'pointer',
};
const primaryBtnStyle = {
  ...btnStyle,
  background: '#3575e0',
  borderColor: '#3575e0',
  color: '#fff',
};
const dangerBtnStyle = {
  ...btnStyle,
  background: '#8f2d2d',
  borderColor: '#8f2d2d',
  color: '#fff',
};
const toastStyle: CSSProperties = {
  position: 'fixed' as const,
  top: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: '2147483647',
  pointerEvents: 'none',
  background: 'rgba(143,45,45,0.95)',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: '8px',
  fontSize: '12px',
  fontFamily: 'system-ui, sans-serif',
};
const dialogMaskStyle: CSSProperties = {
  position: 'fixed' as const,
  inset: '0',
  zIndex: '2147483647',
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
};
const dialogStyle: CSSProperties = {
  background: '#fff',
  color: '#222',
  borderRadius: '12px',
  padding: '18px',
  minWidth: '280px',
  maxWidth: '360px',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
};
const popoverStyle: CSSProperties = {
  position: 'fixed' as const,
  top: '90px',
  right: '16px',
  zIndex: '2147483647',
  pointerEvents: 'auto',
  background: '#fff',
  color: '#222',
  borderRadius: '12px',
  padding: '14px',
  width: '264px',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
};
const popRowStyle: CSSProperties = { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '10px' };
const labelStyle: CSSProperties = { fontSize: '12px', color: '#666' };
const inputStyle: CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '6px 8px',
  fontSize: '13px',
};
const segStyle: CSSProperties = {
  border: '1px solid #ccc',
  background: '#f5f5f5',
  color: '#333',
  borderRadius: '6px',
  padding: '5px 8px',
  fontSize: '12px',
  cursor: 'pointer',
};
const segOnStyle = { ...segStyle, background: '#3575e0', borderColor: '#3575e0', color: '#fff' };
const radioStyle: CSSProperties = { fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' };
</script>
