<template>
  <!-- 一根小胶囊：拖动把手 / 主按钮（切换）/ 「遮住」/ 「⋯」菜单。菜单项与主按钮是兄弟节点，
       不再包在会吃掉 pointerdown 的拖动容器里（N1：点菜单项会把开关切掉）。
       幕布期间整根胶囊由 content-runtime 卸掉，恢复按钮归幕布宿主所有（ui/curtain-restore.ts） -->
  <div
    ref="rootEl"
    class="pm-tg"
    :class="{ dragging, 'pm-tg-preview': preview }"
    :style="[rootStyle, { '--pm-tg-idle-opacity': opacity ?? 1 }]"
    data-testid="pm-toggle"
  >
    <!-- 拖动把手：六点 SVG 共享组件（#83，图形 10×16，命中区由 CSS 撑到 24×24）。
         0.8.6 起闲置隐藏、悬停 / 键盘聚焦 / 拖动时淡入（CSS），触屏常显——
         常驻视觉里少一颗钮，拖动能力不打折 -->
    <button
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

    <!-- 主按钮（0.8.6，#135）：面具图标取代「圆点 + 文字」——文字只为圆点不可读而存在。
         戴面具（填实）= 按你的设置显示，摘面具（描边）= 原样；状态用填实/描边 +
         aria-pressed 表达，不只靠颜色（WCAG 1.4.1）。悬停提示写全称。
         管的是「收起的内容 + 标题图标」这组定制（灰度独立，见媒体钮） -->
    <button
      type="button"
      class="pm-tg-main"
      :aria-pressed="state === 'disguised' ? 'true' : 'false'"
      :title="tipText"
      data-testid="pm-toggle-main"
      @click="emit('toggle')"
    >
      <MaskIcon class="pm-tg-main-icon" :data-state="state === 'disguised' ? 'on' : 'off'" />
    </button>

    <!-- 图片和视频变灰（0.8.0，#131）：「媒体」钮。
         0.8.3 起排在「遮住」前面：媒体是随看随切的状态开关（高频），遮住是应急动作（低频、
         最该离主按钮远）。一点就生效（按站点记忆，页面效果由 storage → applyAll 统一重应用）。
         按下状态用内容填实 / 全描边两态 + aria-pressed，不只靠颜色（WCAG 1.4.1）；
         点一下不弹任何面板，再点一下还原。图标与弹窗开关行共用一份（#132） -->
    <button
      type="button"
      class="pm-tg-cover pm-tg-media"
      :aria-pressed="mediaOn ? 'true' : 'false'"
      :title="t.media.mediaTitle"
      data-testid="pm-toggle-media"
      @click="emit('mediaChange', 'mediaGray', !mediaOn)"
    >
      <MediaIcon class="pm-tg-media-icon" :data-state="mediaOn ? 'on' : 'off'" />
    </button>

    <!-- 遮住整页（图标即可，读屏文案「遮住整页」）：闭眼图标与弹窗「遮住这一页」共用一份（#132）；
         应急动作，排在最后（0.8.3 顺序调整） -->
    <button
      type="button"
      class="pm-tg-cover"
      :aria-label="t.toggle.coverAria"
      :title="t.toggle.coverAria"
      data-testid="pm-toggle-cover"
      @click="emit('cover')"
    >
      <EyeOffIcon class="pm-tg-cover-icon" />
    </button>

    <!-- 展开式按钮组（0.8.6 起唯一形态，菜单常驻——原 mini 没有菜单，合并后人人都有）：
         不是 role=menu（那要求方向键导航契约），只给 aria-expanded；
         右圆头归它（原折叠钮的职责，#85 退场后移交） -->
    <button
      ref="moreEl"
      type="button"
      class="pm-tg-more pm-tg-end"
      :aria-label="t.toggle.moreAria"
      :aria-expanded="menuOpen ? 'true' : 'false'"
      data-testid="pm-toggle-more"
      @click="toggleMenu"
    >
      <span aria-hidden="true">⋯</span>
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
      <!-- 按钮自己那一组（#120）：先「调整不透明度」，再「放回右下角」。
           分隔线常驻——不透明度这一项一直在；「放回右下角」只在拖过之后才有意义，
           所以 v-if 只包它自己。媒体开关（0.8.0）搬到了胶囊本体上的「媒体」钮，菜单里不再重复。 -->
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
import { type MediaFlagKey, type MediaToggles } from '@/core/media';
import { BUTTON_EDGE, clampPos } from '@/core/button-pos';
import { t } from '@/ui/i18n';
import { adoptToggleStyles } from './toggle/toggle-styles';
import DeleteSiteDialog from './toggle/DeleteSiteDialog.vue';
import GripIcon from './GripIcon.vue';
import EyeOffIcon from './icons/EyeOffIcon.vue';
import MediaIcon from './icons/MediaIcon.vue';
import MaskIcon from './icons/MaskIcon.vue';

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER = { popover: 'auto' } as Record<string, string>;
/** 方向键每次移动的距离 */
const KEY_STEP = 15;

const props = defineProps<{
  state: SiteProfile['switchState'];
  position: { x: number; y: number } | null;
  /** 展示用的站点名（确认框标题里带着它） */
  siteLabel: string;
  /**
   * 闲置不透明度（#102）：1 / 0.85 / 0.7。悬停、键盘聚焦、拖动时由 CSS 回到 1，
   * 所以「淡」只在用户不碰它的时候存在。
   */
  opacity?: number;
  /** 「图片和视频变灰」的当前值（0.8.0）：媒体钮就地显示按下状态 */
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
  /** 媒体钮被点下（0.8.0）：方向由运行时按当前值算（按键 = 切换） */
  mediaChange: [key: MediaFlagKey, on: boolean];
  cover: [];
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
  // 首帧还没排版：按典型尺寸夹紧，避免算出负数（0.8.6 单形态五钮实测约 137×32）
  return { width: r && r.width > 0 ? r.width : 137, height: r && r.height > 0 ? r.height : 32 };
};

/** 夹进视口：指针拖动、方向键、挂载与窗口变化全部走这一个 helper（0.8.6 自由坐标） */
function clamp(left: number, top: number): { x: number; y: number } {
  const { width, height } = size();
  return clampPos(left, top, width, height, window.innerWidth, window.innerHeight);
}

const pos = computed(() => dragPos.value ?? viewPos.value ?? props.position);

const rootStyle = computed(() => {
  // 拖动中跟手（#94 回归修复）：拖动坐标是自由左上角坐标
  const d = dragPos.value;
  if (d) return { left: `${d.x}px`, top: `${d.y}px` };
  const p = pos.value;
  // 没拖过的默认位：右下角（right/bottom 表达，窗口变化时仍贴角）
  if (!p) return { right: `${BUTTON_EDGE + 8}px`, bottom: `${BUTTON_EDGE + 8}px` };
  // 0.8.6 自由定位（#135）：存什么坐标就渲染哪，不再贴边停靠——
  // 存储里的 x/y 由 reclamp 夹在视口内，宽度变化后由 onResize 重新夹紧
  const c = clamp(p.x, p.y);
  return { left: `${c.x}px`, top: `${c.y}px` };
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
  // 0.8.6 自由定位：不再贴边，viewPos 记夹紧后的自由坐标
  viewPos.value = next;
  commit(next);
}

/** 默认位置（还没存过坐标时）的像素值：右下角 */
function defaultPos(): { x: number; y: number } {
  const { width, height } = size();
  return { x: window.innerWidth - width - BUTTON_EDGE - 8, y: window.innerHeight - height - BUTTON_EDGE - 8 };
}

/** 松手 / 方向键后落库：0.8.6 起自由坐标原样落库（reclamp 负责视口夹紧），渲染写 left/top */
function commit(p: { x: number; y: number }) {
  emit('moved', { x: p.x, y: p.y });
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

/** 「图片和视频变灰」的按下状态（0.8.0）：媒体钮的实心 / 描边与 aria-pressed 跟着它走 */
const mediaOn = computed(() => props.media?.mediaGray === true);

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
