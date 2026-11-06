<template>
  <!-- 标签页标题 + 快捷标题 + 标签页图标：向导第 1 步与页面 ⋯ 菜单的小面板共用这一份（#56）。
       这里只有「编辑」：读写值走 v-model，保存由外面决定（向导在最后一步保存，小面板点「保存」）。
       两处文案相同，所以标签与按钮文案写在这里；随场景变化的提示由 titleHint 传入。 -->
  <div class="pm-tif">
    <label class="pm-tif-label" :for="`${idPrefix}-title-input`">{{ t.management.titleHeading }}</label>
    <input
      :id="`${idPrefix}-title-input`"
      class="pm-tif-input"
      type="text"
      name="site-title"
      autocomplete="off"
      maxlength="60"
      :value="title"
      :placeholder="placeholder"
      :data-testid="`${idPrefix}-title-input`"
      :aria-describedby="titleHint ? `${idPrefix}-title-hint` : undefined"
      @input="onTitleInput"
    />
    <div class="pm-tif-chips" role="group" :aria-label="t.common.quickTitle" :data-testid="`${idPrefix}-quick`">
      <span class="pm-tif-label">{{ t.common.quickTitle }}</span>
      <button
        v-for="(q, i) in QUICK_TITLES"
        :key="q.id"
        type="button"
        class="pm-tif-chip"
        :data-testid="`${idPrefix}-quick-${i}`"
        @click="emit('update:title', quickTitleValue(q, locale))"
      >
        {{ quickTitleValue(q, locale) }}
      </button>
    </div>
    <p v-if="titleHint" :id="`${idPrefix}-title-hint`" class="pm-tif-hint">{{ titleHint }}</p>

    <!-- 图标三态：与站点设置页共用同一个组件（#121） -->
    <div class="pm-tif-icon-row">
      <IconPicker :model-value="icon" :id-prefix="idPrefix" @update:model-value="emit('update:icon', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { QUICK_TITLES, quickTitleValue } from '@/core/titles';
import type { TabIcon } from '@/core/types';
import { locale, t } from '@/ui/i18n';
import IconPicker from './IconPicker.vue';

defineProps<{
  title: string;
  icon: TabIcon;
  /**
   * 表单里 id / data-testid 的前缀。两处各自唯一即可（它们是两个 shadow root），
   * 同时也是 E2E 的稳定锚点：向导用 `pm-wiz`，页面小面板用 `pm-tp`。
   */
  idPrefix: string;
  /** 标题下面那行提示（各处说明不同：向导是「现在就能看到」，小面板是「保存后才生效」） */
  titleHint?: string;
  /** 站点没有自己的标题时显示的占位（实际会用的那个默认值） */
  placeholder?: string;
}>();

const emit = defineEmits<{ 'update:title': [value: string]; 'update:icon': [value: TabIcon] }>();

function onTitleInput(e: Event) {
  emit('update:title', (e.target as HTMLInputElement).value);
}
</script>
