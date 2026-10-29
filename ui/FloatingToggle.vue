<template>
  <!-- 一根小胶囊：拖动把手 / 主按钮（切换）/ 「遮住」/ 「⋯」菜单。菜单项与主按钮是兄弟节点，
       不再包在会吃掉 pointerdown 的拖动容器里（N1：点菜单项会把开关切掉）。
       幕布期间整根胶囊由 content-runtime 卸掉，恢复按钮归幕布宿主所有（ui/curtain-restore.ts） -->
  <div ref="rootEl" class="pm-tg" :style="rootStyle" data-testid="pm-toggle">
    <button
      type="button"
      class="pm-tg-grip"
      :class="{ dragging }"
      aria-label="移动按钮（也可以用方向键）"
      title="拖动可移动按钮"
      data-testid="pm-toggle-grip"
      @pointerdown="onGripDown"
      @pointermove="onGripMove"
      @lostpointercapture="onGripUp"
      @keydown="onGripKey"
    >
      <span aria-hidden="true">⠿</span>
    </button>

    <button
      type="button"
      class="pm-tg-main"
      :aria-pressed="state === 'disguised' ? 'true' : 'false'"
      :title="tipText"
      data-testid="pm-toggle-main"
      @click="emit('toggle')"
    >
      <span class="pm-tg-dot" aria-hidden="true"></span>
      <span class="pm-tg-label">{{ state === 'disguised' ? '清爽' : '原样' }}</span>
    </button>

    <!-- 遮住整页（图标即可，读屏文案「遮住整页」） -->
    <button
      type="button"
      class="pm-tg-cover"
      aria-label="遮住整页"
      title="遮住整页"
      data-testid="pm-toggle-cover"
      @click="emit('cover')"
    >
      <svg
        class="pm-tg-cover-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
        <line x1="3" y1="3" x2="21" y2="21" />
      </svg>
    </button>

    <!-- 展开式按钮组：不是 role=menu（那要求方向键导航契约），只给 aria-expanded -->
    <button
      ref="moreEl"
      type="button"
      class="pm-tg-more"
      aria-label="更多操作"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      data-testid="pm-toggle-more"
      @click="toggleMenu"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <!-- 菜单：popover 自带「点外面关闭」与 Esc 关闭，并进 top layer 不可能被页面浮层压住 -->
    <div ref="menuEl" v-bind="POPOVER" class="pm-tg-menu" data-testid="pm-toggle-menu" @toggle="onMenuToggle">
      <button type="button" class="pm-tg-item" data-testid="pm-toggle-edit" @click="onMenu('edit')">编辑规则</button>
      <button type="button" class="pm-tg-item" data-testid="pm-toggle-reset" @click="onMenu('reset')">按钮归位</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SiteProfile } from '@/core/types';
import { adoptToggleStyles } from './toggle/toggle-styles';

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER = { popover: 'auto' } as Record<string, string>;
/** 离视口边缘至少留这么多 */
const EDGE = 8;
/** 方向键每次移动的距离 */
const KEY_STEP = 15;

const props = defineProps<{
  state: SiteProfile['switchState'];
  position: { x: number; y: number } | null;
}>();
const emit = defineEmits<{
  toggle: [];
  moved: [pos: { x: number; y: number }];
  edit: [];
  resetPos: [];
  cover: [];
}>();

const rootEl = ref<HTMLElement | null>(null);
const moreEl = ref<HTMLElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const dragging = ref(false);
/** 拖动中的实时位置（松手后交给存储） */
const dragPos = ref<{ x: number; y: number } | null>(null);
/** 窗口尺寸变化后重新夹紧的显示位置（不回写存储，只保证够得着） */
const viewPos = ref<{ x: number; y: number } | null>(null);

const size = () => {
  const root = rootEl.value;
  const r = root?.getBoundingClientRect();
  // 首帧还没排版：按典型尺寸夹紧，避免算出负数
  return { width: r && r.width > 0 ? r.width : 118, height: r && r.height > 0 ? r.height : 26 };
};

/** 夹进视口：指针拖动、方向键、挂载与窗口变化全部走这一个helper */
function clamp(left: number, top: number): { x: number; y: number } {
  const { width, height } = size();
  return {
    x: Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - width - EDGE)),
    y: Math.min(Math.max(EDGE, top), Math.max(EDGE, window.innerHeight - height - EDGE)),
  };
}

const pos = computed(() => dragPos.value ?? viewPos.value ?? props.position);

const rootStyle = computed(() => {
  const p = pos.value;
  if (!p) return { right: `${EDGE + 8}px`, bottom: `${EDGE + 8}px` };
  return { left: `${p.x}px`, top: `${p.y}px` };
});

const tipText = computed(() => (props.state === 'disguised' ? 'PageMask：清爽中，点击还原' : 'PageMask：点击开启清爽模式'));

/** 存下来的坐标可能来自更宽的窗口：挂载与窗口变化时夹紧 */
function reclamp() {
  if (!props.position || dragPos.value) return;
  const next = clamp(props.position.x, props.position.y);
  viewPos.value = next.x === props.position.x && next.y === props.position.y ? null : next;
}

function onResize() {
  reclamp();
  if (menuOpen.value) positionMenu();
}

/** 页面滚动时胶囊是 position:fixed 不用动，只有菜单需要重新贴住「⋯」 */
function onScroll() {
  if (menuOpen.value) positionMenu();
}

onMounted(() => {
  const root = rootEl.value?.getRootNode();
  if (root instanceof ShadowRoot) adoptToggleStyles(root);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  void nextTick(reclamp);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', onScroll, { capture: true });
});

// 从别处改了位置（例如「按钮归位」）：显示位置跟着走
watch(
  () => props.position,
  () => {
    dragPos.value = null;
    viewPos.value = null;
    void nextTick(reclamp);
  },
);

// ---------- 拖动（modern-web-guidance「drag」：专用把手 + setPointerCapture） ----------

let grab = { x: 0, y: 0 };

function onGripDown(e: PointerEvent) {
  if (e.button !== 0 || !rootEl.value) return;
  const r = rootEl.value.getBoundingClientRect();
  grab = { x: e.clientX - r.left, y: e.clientY - r.top };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onGripMove(e: PointerEvent) {
  const handle = e.currentTarget as HTMLElement;
  if (!handle.hasPointerCapture(e.pointerId)) return;
  dragging.value = true;
  dragPos.value = clamp(e.clientX - grab.x, e.clientY - grab.y);
}

/** 松手 / 指针被系统取消（触屏滑动、来电等）都会走到这里：统一收尾并落库 */
function onGripUp() {
  dragging.value = false;
  if (dragPos.value) commit(dragPos.value);
}

function onGripKey(e: KeyboardEvent) {
  const dir: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const d = dir[e.key];
  if (!d) return;
  e.preventDefault();
  const current = dragPos.value ?? viewPos.value ?? props.position ?? defaultPos();
  const next = clamp(current.x + d[0] * KEY_STEP, current.y + d[1] * KEY_STEP);
  dragPos.value = null;
  viewPos.value = next;
  commit(next);
}

/** 默认位置（还没存过坐标时）的像素值：右下角 */
function defaultPos(): { x: number; y: number } {
  const { width, height } = size();
  return { x: window.innerWidth - width - EDGE - 8, y: window.innerHeight - height - EDGE - 8 };
}

/** 松手 / 方向键后落库：按「贴边 + 纵向位置」记，贴边后换窗口宽度也不会跑到中间去 */
function commit(p: { x: number; y: number }) {
  const { width } = size();
  const onLeft = p.x + width / 2 <= window.innerWidth / 2;
  emit('moved', {
    x: onLeft ? EDGE : Math.max(EDGE, window.innerWidth - width - EDGE),
    y: p.y,
  });
}

// ---------- 菜单 ----------

function toggleMenu() {
  const menu = menuEl.value;
  if (!menu) return;
  if (menu.matches(':popover-open')) menu.hidePopover();
  else {
    menu.showPopover();
    positionMenu();
  }
}

function onMenuToggle() {
  menuOpen.value = !!menuEl.value?.matches(':popover-open');
}

/** 点菜单项：先关菜单再执行，焦点回到「⋯」 */
function onMenu(action: 'edit' | 'reset') {
  menuEl.value?.hidePopover();
  if (action === 'edit') emit('edit');
  else {
    dragPos.value = null;
    viewPos.value = null;
    emit('resetPos');
  }
}

/**
 * 按视口算菜单位置：默认贴在「⋯」上方并右对齐；上面放不下就翻到下方，左右越界就贴边。
 * （Chrome 116 没有 position-area / anchor positioning，按 viewport-aware-dropdowns 的
 * 无 polyfill 退路用 getBoundingClientRect 计算，并做同样的翻转与夹紧）
 */
function positionMenu() {
  const menu = menuEl.value;
  const more = moreEl.value;
  if (!menu || !more) return;
  const m = menu.getBoundingClientRect();
  const t = more.getBoundingClientRect();
  const gap = 6;
  let top = t.top - m.height - gap;
  if (top < EDGE) top = t.bottom + gap; // 上方放不下 → 翻到下方
  let left = t.right - m.width; // 默认右对齐触发按钮
  if (left < EDGE) left = EDGE;
  if (left + m.width > window.innerWidth - EDGE) left = window.innerWidth - EDGE - m.width;
  const maxTop = window.innerHeight - EDGE - m.height;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(EDGE, Math.min(top, maxTop)))}px`;
}
</script>
