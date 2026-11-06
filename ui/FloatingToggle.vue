<template>
  <!-- 一根小胶囊：拖动把手 / 主按钮（切换）/ 「遮住」/ 「⋯」菜单。菜单项与主按钮是兄弟节点，
       不再包在会吃掉 pointerdown 的拖动容器里（N1：点菜单项会把开关切掉）。
       幕布期间整根胶囊由 content-runtime 卸掉，恢复按钮归幕布宿主所有（ui/curtain-restore.ts） -->
  <div
    ref="rootEl"
    class="pm-tg"
    :class="{ 'pm-tg-mini': mini, dragging, 'pm-tg-preview': preview }"
    :style="[rootStyle, { '--pm-tg-idle-opacity': opacity ?? 1 }]"
    data-testid="pm-toggle"
  >
    <!-- 拖动把手：六点 SVG 共享组件（#83，图形 10×16，命中区由 CSS 撑到 24×24）
         不用点阵字符：各平台字形大小不一，还会把字号压到 12px 以下 -->
    <button
      v-if="!mini"
      type="button"
      class="pm-tg-grip"
      :class="{ dragging }"
      :aria-label="t.toggle.gripAria"
      :title="t.toggle.gripTitle"
      data-testid="pm-toggle-grip"
      @pointerdown="onGripDown"
      @pointermove="onGripMove"
      @lostpointercapture="onGripUp"
      @keydown="onGripKey"
    >
      <GripIcon />
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
      <!-- mini：只留圆点，状态靠颜色与悬停提示（#78） -->
      <span v-if="!mini" class="pm-tg-label">{{ state === 'disguised' ? t.common.clean : t.common.original }}</span>
    </button>

    <!-- 遮住整页（图标即可，读屏文案「遮住整页」） -->
    <button
      type="button"
      class="pm-tg-cover"
      :aria-label="t.toggle.coverAria"
      :title="t.toggle.coverAria"
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

    <!-- 展开式按钮组（只有全功能有）：不是 role=menu（那要求方向键导航契约），只给 aria-expanded -->
    <button
      v-if="!mini"
      ref="moreEl"
      type="button"
      class="pm-tg-more"
      :aria-label="t.toggle.moreAria"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      data-testid="pm-toggle-more"
      @click="toggleMenu"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <!-- 收成小按钮 / 展开成完整（#79）：单箭头指明点击后的变化——mini「›」展开变大、
         全功能「‹」收起变小；永远排在最末（mini 的「展开」本来就在最末，两态位置连续）。
         图标与「遮住」同规格（pm-tg-fold-icon 13 盒），笔画实测同粗。
         两态它都是胶囊的右端点：右圆头归它（.pm-tg-fold，#85） -->
    <button
      type="button"
      class="pm-tg-cover pm-tg-fold"
      :aria-label="mini ? t.toggle.expandAria : t.toggle.shrinkAria"
      :title="mini ? t.toggle.expandAria : t.toggle.shrinkAria"
      :data-testid="mini ? 'pm-toggle-expand' : 'pm-toggle-shrink'"
      @click="emit('setMini', !mini)"
    >
      <svg class="pm-tg-fold-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline v-if="mini" points="7 3 17 12 7 21" />
        <polyline v-else points="17 3 7 12 17 21" />
      </svg>
    </button>

    <!-- 菜单：popover 自带「点外面关闭」与 Esc 关闭，并进 top layer 不可能被页面浮层压住。
         按用途分三组（#77）：改内容的 / 按钮位置 / 删除这个网站的设置——最后一项与上面用
         分隔线隔开、写成红字，免得顺手点错。两项都进同一个三步向导，只是停的步不同；
         组内顺序与弹窗一致，收起内容在前（主功能，#80） -->
    <div ref="menuEl" v-bind="POPOVER" class="pm-tg-menu" data-testid="pm-toggle-menu" @toggle="onMenuToggle">
      <button type="button" class="pm-tg-item" data-testid="pm-toggle-more-items" @click="onMenu('moreItems')">
        {{ t.toggle.menuContent }}
      </button>
      <button type="button" class="pm-tg-item" data-testid="pm-toggle-title" @click="onMenu('edit')">
        {{ t.toggle.menuTitle }}
      </button>
      <!-- 图片、视频和声音（#116）：三个带勾选标记的开关，放在「改内容」与「按钮自己」两组之间。
           菜单刻意不是 role=menu，所以这里用 role="switch" + aria-checked（读屏能报出开关与开关状态），
           而不是没有父菜单的 menuitemcheckbox。点一下不关菜单：常要连着拨几个，勾选就地看得见。 -->
      <hr class="pm-tg-sep" />
      <div class="pm-tg-media" role="group" :aria-label="t.media.menuGroup" data-testid="pm-toggle-media-group">
        <button
          v-for="key in MEDIA_FLAG_KEYS"
          :key="key"
          type="button"
          class="pm-tg-item pm-tg-switch"
          role="switch"
          :aria-checked="props.media?.[key] === true ? 'true' : 'false'"
          :data-testid="`pm-toggle-media-${key}`"
          @click="onMediaToggle(key)"
        >
          <!-- 勾选标记固定占位：拨动时文字不位移。用 SVG 而不是字形，跨平台笔画一致（同 GripIcon 的理由）。
               未选中也画一个淡的空框（#127）：菜单里同时有「收起内容」这类普通动作，空占位会让人分不清
               这一行到底是不是开关；两态共用同一个 12px 槽位，不另造一种开关外观 -->
          <span class="pm-tg-check" :data-state="props.media?.[key] === true ? 'on' : 'off'" aria-hidden="true">
            <svg
              v-if="props.media?.[key] === true"
              class="pm-tg-tick"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="2 6.4 4.8 9.2 10 3" />
            </svg>
            <svg v-else class="pm-tg-box" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
              <rect x="1.1" y="1.1" width="9.8" height="9.8" rx="2" />
            </svg>
          </span>
          <span class="pm-tg-switch-label">{{ t.media[key] }}</span>
        </button>
      </div>
      <!-- 按钮自己那一组（#120）：先「调整不透明度」，再「放回右下角」。
           分隔线常驻——不透明度这一项一直在；「放回右下角」只在拖过之后才有意义，
           所以 v-if 只包它自己。 -->
      <hr class="pm-tg-sep" />
      <button type="button" class="pm-tg-item" data-testid="pm-toggle-opacity" @click="onMenu('opacity')">
        {{ t.toggle.menuOpacity }}
      </button>
      <button v-if="props.position" type="button" class="pm-tg-item" data-testid="pm-toggle-reset" @click="onMenu('reset')">
        {{ t.toggle.menuResetPos }}
      </button>
      <hr class="pm-tg-sep" />
      <button type="button" class="pm-tg-item danger" data-testid="pm-toggle-delete" @click="onDelete">
        {{ t.toggle.menuDelete }}
      </button>
    </div>

    <!-- 删除前的确认（标题带域名：同一个菜单可能同时开在几个标签页上） -->
    <DeleteSiteDialog
      v-if="deleteOpen"
      :label="siteLabel"
      @confirm="onConfirmDelete"
      @cancel="deleteOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SiteProfile } from '@/core/types';
import { MEDIA_FLAG_KEYS, type MediaFlagKey, type MediaToggles } from '@/core/media';
import { BUTTON_EDGE, clampEdgeY, isLeftDock, snapXToEdge } from '@/core/button-pos';
import { t } from '@/ui/i18n';
import { adoptToggleStyles } from './toggle/toggle-styles';
import DeleteSiteDialog from './toggle/DeleteSiteDialog.vue';
import GripIcon from './GripIcon.vue';

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER = { popover: 'auto' } as Record<string, string>;
/** 方向键每次移动的距离 */
const KEY_STEP = 15;

const props = defineProps<{
  state: SiteProfile['switchState'];
  position: { x: number; y: number } | null;
  /** mini 形态（#78）：状态圆点 + 遮住 + 展开，没有文字、菜单与把手；按站点记忆 */
  mini: boolean;
  /** 展示用的站点名（确认框标题里带着它） */
  siteLabel: string;
  /**
   * 闲置不透明度（#102）：1 / 0.85 / 0.7。悬停、键盘聚焦、拖动时由 CSS 回到 1，
   * 所以「淡」只在用户不碰它的时候存在。
   */
  opacity?: number;
  /** 图片、视频、声音三个开关的当前值（#116）：菜单里就地显示勾中状态 */
  media?: MediaToggles;
  /**
   * 预览模式（#102 / 欢迎页）：静态展示用——不跟随页面定位（position: static）、不响应拖动。
   * 调用方再套一层 inert + aria-hidden，让示意图能看不能点。
   */
  preview?: boolean;
}>();
const emit = defineEmits<{
  toggle: [];
  moved: [pos: { x: number; y: number }];
  /** 菜单里的「标题和图标」：进向导第 1 步（#77） */
  edit: [];
  /** 菜单里的「收起内容」：进向导选内容（添加与编辑同一扇门，#77） */
  moreItems: [];
  resetPos: [];
  /** 菜单里的「调整不透明度」：打开插件设置并停在不透明度那一栏（#120） */
  settings: [];
  /** 菜单里拨动图片 / 视频 / 声音里的某一个（#116）：方向由运行时按当前值算，菜单不关 */
  mediaChange: [key: MediaFlagKey, on: boolean];
  cover: [];
  /** mini ↔ 全功能互切（#78） */
  setMini: [mini: boolean];
  /** 菜单里的「删除这个网站的设置」被点下：运行时先撤幕布，确认框随后弹出 */
  delete: [];
  deleteSite: [];
}>();

const rootEl = ref<HTMLElement | null>(null);
const moreEl = ref<HTMLElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const dragging = ref(false);
/** 删除确认框开着 */
const deleteOpen = ref(false);
/** 拖动中的实时位置（松手后交给存储） */
const dragPos = ref<{ x: number; y: number } | null>(null);
/** 窗口尺寸变化后重新夹紧的显示位置（不回写存储，只保证够得着） */
const viewPos = ref<{ x: number; y: number } | null>(null);

const size = () => {
  const root = rootEl.value;
  const r = root?.getBoundingClientRect();
  // 首帧还没排版：按典型尺寸夹紧，避免算出负数（三个图标按钮各 24 之后实测约 145×32）
  return { width: r && r.width > 0 ? r.width : 145, height: r && r.height > 0 ? r.height : 32 };
};

/** 夹进视口：指针拖动、方向键、挂载与窗口变化全部走这一个helper */
function clamp(left: number, top: number): { x: number; y: number } {
  const { width, height } = size();
  return {
    x: Math.min(Math.max(BUTTON_EDGE, left), Math.max(BUTTON_EDGE, window.innerWidth - width - BUTTON_EDGE)),
    y: clampEdgeY(top, height, window.innerHeight),
  };
}

const pos = computed(() => dragPos.value ?? viewPos.value ?? props.position);

const rootStyle = computed(() => {
  // 拖动中跟手（#94 回归修复）：拖动坐标是自由左上角坐标，不走停靠解释——
  // 否则右半视口里拖动会被钉死在右缘（#84 引入的回归，用户实测「只能沿右缘拖」）
  const d = dragPos.value;
  if (d) return { left: `${d.x}px`, top: `${d.y}px` };
  const p = pos.value;
  if (!p) return { right: `${BUTTON_EDGE + 8}px`, bottom: `${BUTTON_EDGE + 8}px` };
  // 停靠边为锚（#84）：x ≤ BUTTON_EDGE 是左停靠，其余是右停靠——右停靠渲染 right，
  // 全功能 ↔ mini 换宽时贴边不动（右停靠往右收，用户要的「以右侧位置为准」）
  const top = `${clampEdgeY(p.y, size().height, window.innerHeight)}px`;
  return isLeftDock(p.x) ? { left: `${p.x}px`, top } : { right: `${BUTTON_EDGE}px`, top };
});

const tipText = computed(() => (props.state === 'disguised' ? t.value.toggle.tipOn : t.value.toggle.tipOff));

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
  if (props.preview) return;
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
  // viewPos 记贴边后的值（#84）：渲染按停靠边锚定，记中途回造成一帧跳到另一侧
  const snapped = { x: snapXToEdge(next.x, size().width, window.innerWidth), y: next.y };
  viewPos.value = snapped;
  commit(snapped);
}

/** 默认位置（还没存过坐标时）的像素值：右下角 */
function defaultPos(): { x: number; y: number } {
  const { width, height } = size();
  return { x: window.innerWidth - width - BUTTON_EDGE - 8, y: window.innerHeight - height - BUTTON_EDGE - 8 };
}

/** 松手 / 方向键后落库：贴最近边（#84，与幕布恢复按钮同一规则），渲染按停靠边锚定 */
function commit(p: { x: number; y: number }) {
  const { width } = size();
  emit('moved', { x: snapXToEdge(p.x, width, window.innerWidth), y: p.y });
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

/**
 * 三个媒体开关（#116）：不关菜单。一次连着拨几个是常态，菜单留着才能看见勾选就地变化；
 * popover="auto" 只在点外面 / Esc 时关，菜单内点击本来就不会自动关。
 */
function onMediaToggle(key: MediaFlagKey) {
  emit('mediaChange', key, props.media?.[key] !== true);
}

/** 点菜单项：先关菜单再执行，焦点回到「⋯」 */
function onMenu(action: 'edit' | 'moreItems' | 'reset' | 'opacity') {
  menuEl.value?.hidePopover();
  if (action === 'edit') emit('edit');
  else if (action === 'moreItems') emit('moreItems');
  else if (action === 'opacity') emit('settings');
  else {
    dragPos.value = null;
    viewPos.value = null;
    emit('resetPos');
  }
}

/**
 * 「删除这个网站的设置」：先关菜单，再让运行时撤掉幕布（撤幕布是运行时的事），最后弹确认框。
 * emit 是同步的，所以确认框出现在幕布撤掉之后，不会压在幕布上。
 */
function onDelete() {
  menuEl.value?.hidePopover();
  emit('delete');
  deleteOpen.value = true;
}

function onConfirmDelete() {
  deleteOpen.value = false;
  emit('deleteSite');
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
  if (top < BUTTON_EDGE) top = t.bottom + gap; // 上方放不下 → 翻到下方
  let left = t.right - m.width; // 默认右对齐触发按钮
  if (left < BUTTON_EDGE) left = BUTTON_EDGE;
  if (left + m.width > window.innerWidth - BUTTON_EDGE) left = window.innerWidth - BUTTON_EDGE - m.width;
  const maxTop = window.innerHeight - BUTTON_EDGE - m.height;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(BUTTON_EDGE, Math.min(top, maxTop)))}px`;
}
</script>
