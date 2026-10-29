<template>
  <!-- 标签页标题 + 快捷标题 + 标签页图标：向导第 1 步与页面 ⋯ 菜单的小面板共用这一份（#56）。
       这里只有「编辑」：读写值走 v-model，保存由外面决定（向导在最后一步保存，小面板点「保存」）。
       两处文案相同，所以标签与按钮文案写在这里；随场景变化的提示由 titleHint / iconHint 传入。 -->
  <div class="pm-tif">
    <label class="pm-tif-label" :for="`${idPrefix}-title-input`">标签页标题</label>
    <input
      :id="`${idPrefix}-title-input`"
      class="pm-tif-input"
      type="text"
      maxlength="60"
      :value="title"
      :placeholder="placeholder"
      :data-testid="`${idPrefix}-title-input`"
      :aria-describedby="titleHint ? `${idPrefix}-title-hint` : undefined"
      @input="onTitleInput"
    />
    <div class="pm-tif-chips" role="group" aria-label="快捷标题" :data-testid="`${idPrefix}-quick`">
      <span class="pm-tif-label">快捷标题</span>
      <button
        v-for="(q, i) in QUICK_TITLES"
        :key="q.label"
        type="button"
        class="pm-tif-chip"
        :data-testid="`${idPrefix}-quick-${i}`"
        @click="emit('update:title', quickTitleValue(q, uiLanguage))"
      >
        {{ quickTitleValue(q, uiLanguage) }}
      </button>
    </div>
    <p v-if="titleHint" :id="`${idPrefix}-title-hint`" class="pm-tif-hint">{{ titleHint }}</p>

    <div class="pm-tif-icon-row">
      <span class="pm-tif-label">标签页图标</span>
      <img
        v-if="icon"
        class="pm-tif-icon-preview"
        :src="icon"
        alt="将显示在标签页上的图标"
        :data-testid="`${idPrefix}-icon-preview`"
      />
      <span v-else class="pm-tif-icon-empty" aria-hidden="true" :data-testid="`${idPrefix}-icon-empty`"></span>
      <label class="pm-tif-btn pm-tif-file">
        {{ busy ? '正在处理…' : icon ? '换一张图标' : '上传图标' }}
        <input
          type="file"
          :accept="ICON_SOURCE_TYPES.join(',')"
          :disabled="busy"
          :data-testid="`${idPrefix}-icon-input`"
          @change="onIconChange"
        />
      </label>
      <button
        v-if="icon"
        type="button"
        class="pm-tif-btn"
        :data-testid="`${idPrefix}-icon-clear`"
        @click="emit('update:icon', null)"
      >
        清除图标
      </button>
    </div>
    <p v-if="iconHint" class="pm-tif-hint">{{ iconHint }}</p>
    <p v-if="error" class="pm-tif-error" role="alert" :data-testid="`${idPrefix}-icon-error`">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ICON_SOURCE_TYPES } from '@/core/icon';
import { QUICK_TITLES, currentUiLanguage, quickTitleValue } from '@/core/titles';
// 与管理页的站点设置页共用同一套图标压缩与校验管线（#26）
import { fileToIconDataUrl } from '@/entrypoints/management/tab-icon';

defineProps<{
  title: string;
  icon: string | null;
  /**
   * 表单里 id / data-testid 的前缀。两处各自唯一即可（它们是两个 shadow root），
   * 同时也是 E2E 的稳定锚点：向导用 `pm-wiz`，页面小面板用 `pm-tp`。
   */
  idPrefix: string;
  /** 标题下面那行提示（各处说明不同：向导是「现在就能看到」，小面板是「保存后才生效」） */
  titleHint?: string;
  iconHint?: string;
  /** 站点没有自己的标题时显示的占位（实际会用的那个默认值） */
  placeholder?: string;
}>();

const emit = defineEmits<{ 'update:title': [value: string]; 'update:icon': [value: string | null] }>();

const uiLanguage = currentUiLanguage();
const busy = ref(false);
const error = ref('');

function onTitleInput(e: Event) {
  emit('update:title', (e.target as HTMLInputElement).value);
}

async function onIconChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  if (!file || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const res = await fileToIconDataUrl(file);
    if (!res.ok) {
      error.value = res.error;
      return;
    }
    emit('update:icon', res.dataUrl);
  } catch {
    error.value = '没能处理这张图标，请再试一次';
  } finally {
    busy.value = false;
  }
}
</script>
