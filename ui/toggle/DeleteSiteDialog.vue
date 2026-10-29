<template>
  <!-- 「删除这个网站的设置」的二次确认（#56）。原生模态 <dialog>：进 top layer，压得住页面里
       z-index 再高的浮层；安全按钮「取消」默认聚焦，危险按钮实底红、要用户自己去点。
       与站点设置页的确认框用同一套文案（core/site-delete.ts）。 -->
  <dialog ref="dlg" class="pm-tg-del" aria-labelledby="pm-tg-del-title" data-testid="pm-tg-delete-dialog">
    <h2 id="pm-tg-del-title" class="pm-tg-del-title" data-testid="pm-tg-delete-title">{{ deleteSiteTitle(label) }}</h2>
    <p class="pm-tg-del-text" data-testid="pm-tg-delete-impact">{{ DELETE_SITE_IMPACT }}</p>
    <form method="dialog" class="pm-tg-del-actions">
      <button type="submit" value="cancel" autofocus data-testid="pm-tg-delete-cancel">取消</button>
      <button type="submit" value="confirm" class="primary danger" data-testid="pm-tg-delete-confirm">
        {{ DELETE_SITE_ACTION }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { DELETE_SITE_ACTION, DELETE_SITE_IMPACT, deleteSiteTitle } from '@/core/site-delete';

defineProps<{ label: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const dlg = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  const el = dlg.value;
  if (!el) return;
  // 直接挂在元素上（不靠模板事件转发）：关闭只有一条路径，返回值就是按钮上的 value
  el.addEventListener('close', () => {
    const confirmed = el.returnValue === 'confirm';
    el.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
    if (confirmed) emit('confirm');
    else emit('cancel');
  });
  el.showModal();
});
</script>
