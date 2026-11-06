<template>
  <!-- 标签页图标三态（#121）：网站原来的 / 不显示 / 换成内置的某个。
       向导与站点设置页共用这一个组件，选项与网格不许各写一份。
       样式在 ui/title-icon/fields.css（向导注入 shadow，管理页在 main.ts 引入）。 -->
  <fieldset class="pm-icon-picker" :data-testid="`${idPrefix}-icon-picker`">
    <legend class="pm-icon-picker-legend" :class="{ 'pm-icon-picker-legend-sr': hideLegend }">
      {{ t.management.iconHeading }}
    </legend>

    <div class="pm-icon-choice">
      <input
        :id="`${idPrefix}-icon-kind-site`"
        type="radio"
        :name="`${idPrefix}-icon-kind`"
        value="site"
        :checked="kind === 'site'"
        :data-testid="`${idPrefix}-icon-kind-site`"
        @change="pickKind('site')"
      />
      <label :for="`${idPrefix}-icon-kind-site`">{{ t.management.iconSite }}</label>
    </div>
    <div class="pm-icon-choice">
      <input
        :id="`${idPrefix}-icon-kind-none`"
        type="radio"
        :name="`${idPrefix}-icon-kind`"
        value="none"
        :checked="kind === 'none'"
        :data-testid="`${idPrefix}-icon-kind-none`"
        @change="pickKind('none')"
      />
      <label :for="`${idPrefix}-icon-kind-none`">{{ t.management.iconNone }}</label>
    </div>
    <div class="pm-icon-choice">
      <input
        :id="`${idPrefix}-icon-kind-preset`"
        type="radio"
        :name="`${idPrefix}-icon-kind`"
        value="preset"
        :checked="kind === 'preset'"
        :data-testid="`${idPrefix}-icon-kind-preset`"
        @change="pickKind('preset')"
      />
      <label :for="`${idPrefix}-icon-kind-preset`">{{ t.management.iconPreset }}</label>
    </div>

    <!-- 只有选了「换成别的图标」才展开：10 个题材各一格，窄处换行、不横向滚动 -->
    <div v-if="kind === 'preset'" class="pm-icon-grid" role="radiogroup" :aria-label="t.management.iconPickLabel">
      <label
        v-for="id in ICON_PRESET_IDS"
        :key="id"
        class="pm-icon-tile"
        :class="{ on: selectedPreset === id }"
        :data-testid="`${idPrefix}-icon-preset-${id}`"
      >
        <input
          type="radio"
          :name="`${idPrefix}-icon-preset`"
          :value="id"
          :checked="selectedPreset === id"
          :aria-label="t.management.iconPresets[id]"
          :title="t.management.iconPresets[id]"
          @change="pickPreset(id)"
        />
        <img :src="PRESET_ICONS[id]" alt="" aria-hidden="true" />
        <!-- 选中态不只靠颜色（WCAG 1.4.1）：右上角一枚勾选角标 -->
        <span v-if="selectedPreset === id" class="pm-icon-check" aria-hidden="true"></span>
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PRESET_ICONS } from '@/core/icon-presets';
import { ICON_PRESET_IDS, type IconPresetId, type TabIcon } from '@/core/types';
import { t } from '@/ui/i18n';

const props = withDefaults(
  defineProps<{
    modelValue: TabIcon;
    /**
     * 表单里 id / data-testid 的前缀。两处各自唯一即可（它们是两个 shadow root），
     * 同时也是 E2E 的稳定锚点：向导用 `pm-wiz`，站点设置页用 `pm-mgmt`。
     */
    idPrefix: string;
    /** 外面已有「标签页图标」标题时不重复显示（图例仍保留给读屏） */
    hideLegend?: boolean;
  }>(),
  { hideLegend: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: TabIcon] }>();

const kind = computed(() => props.modelValue.kind);
/** 选中「换成别的图标」时的具体编号；从另外两态切过来默认第一个 */
const selectedPreset = computed<IconPresetId | null>(() =>
  props.modelValue.kind === 'preset' ? props.modelValue.id : null,
);

function pickKind(next: 'site' | 'none' | 'preset') {
  if (next === 'preset') {
    emit('update:modelValue', { kind: 'preset', id: selectedPreset.value ?? ICON_PRESET_IDS[0] });
    return;
  }
  emit('update:modelValue', { kind: next });
}

function pickPreset(id: IconPresetId) {
  emit('update:modelValue', { kind: 'preset', id });
}
</script>
