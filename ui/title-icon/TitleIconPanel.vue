<template>
  <!-- 页面里的「标签页标题和图标」小面板（#56）：就地改，不跳到别的标签页。
       弹出的方式与 ⋯ 菜单一致（popover：点外面 / Esc 自动关闭，进 top layer 不会被页面浮层压住）；
       表单本身是向导第 1 步用的同一个组件，这里只加标题栏与两个按钮。 -->
  <div
    ref="panelEl"
    v-bind="POPOVER"
    class="pm-tp"
    :style="{ right: `${anchor.right}px`, bottom: `${anchor.bottom}px` }"
    role="dialog"
    aria-labelledby="pm-tp-heading"
    data-testid="pm-tp-panel"
    @toggle="onToggle"
  >
    <div class="pm-tp-head">
      <h2 id="pm-tp-heading" class="pm-tp-heading">{{ t.toggle.panelTitle }}</h2>
      <button type="button" class="pm-tp-close" :aria-label="t.toggle.panelClose" data-testid="pm-tp-close" @click="close">
        <span aria-hidden="true">✕</span>
      </button>
    </div>

    <!-- 原样态下保存完的那一句：改了但看不到，给一个当场切过去的入口 -->
    <template v-if="savedOriginal">
      <p class="pm-tp-note" data-testid="pm-tp-original-note">
        {{ t.toggle.panelOriginalNote }}
      </p>
      <div class="pm-tp-actions">
        <button type="button" class="pm-tif-btn" data-testid="pm-tp-done" @click="close">{{ t.common.gotIt }}</button>
        <button type="button" class="pm-tif-btn primary" data-testid="pm-tp-switch-clean" @click="emit('switchClean')">
          {{ t.toggle.panelSwitchClean }}
        </button>
      </div>
    </template>

    <template v-else>
      <TitleIconFields
        v-model:title="titleValue"
        v-model:icon="iconValue"
        id-prefix="pm-tp"
        :placeholder="placeholder"
        :title-hint="t.toggle.panelTitleHint(placeholder)"
        :icon-hint="hasDefaultIcon ? t.toggle.panelIconHintWithDefault : t.toggle.panelIconHintNoDefault"
      />
      <div class="pm-tp-actions">
        <button type="button" class="pm-tif-btn" data-testid="pm-tp-cancel" @click="close">{{ t.common.cancel }}</button>
        <button type="button" class="pm-tif-btn primary" data-testid="pm-tp-save" @click="onSave">{{ t.common.save }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { SiteProfile } from '@/core/types';
import { t } from '@/ui/i18n';
import TitleIconFields from './TitleIconFields.vue';

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER = { popover: 'auto' } as Record<string, string>;

const props = defineProps<{
  /** 站点自己的标题；没设置过时是空串（输入框用占位显示实际会用的默认值） */
  title: string;
  icon: string | null;
  /** 站点没有自己的标题时实际会用的那个（全局默认 > 界面语言默认） */
  placeholder: string;
  hasDefaultIcon: boolean;
  /** 打开时的开关状态：决定保存后要不要提示「现在是原样态」 */
  state: SiteProfile['switchState'];
  /** 贴着「⋯」上方弹出：到视口右边与下边的距离（由 FloatingToggle 按按钮位置算好） */
  anchor: { right: number; bottom: number };
}>();
const emit = defineEmits<{
  save: [value: { title: string; icon: string | null }];
  close: [];
  switchClean: [];
}>();

const panelEl = ref<HTMLElement | null>(null);
const titleValue = ref(props.title);
const iconValue = ref<string | null>(props.icon);
/** 原样态下保存完：表单换成一句提示 + 切换入口 */
const savedOriginal = ref(false);
let saving = false;

onMounted(() => {
  // 打开即弹出（Esc / 点外面由 popover 自己处理，关闭后通知父级卸载）
  panelEl.value?.showPopover();
});

function onToggle(e: Event) {
  // popover 自己是关不掉的（只有 Esc / 点外面会让它进入 closed）：这时通知父级卸载
  if ((e as Event & { newState?: string }).newState === 'closed') emit('close');
}

function close() {
  if (panelEl.value?.matches(':popover-open')) panelEl.value.hidePopover();
  else emit('close');
}

function onSave() {
  if (saving) return;
  saving = true;
  emit('save', { title: titleValue.value, icon: iconValue.value });
  // 清爽态：标签页当场就变了，面板没有别的话要说，直接收起
  if (props.state === 'disguised') close();
  else savedOriginal.value = true;
}
</script>
