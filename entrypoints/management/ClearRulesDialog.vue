<template>
  <!-- 「恢复网站原来的内容」的二次确认（#160）：照 DeleteSiteDialog 的外壳。
       原生模态 <dialog>：安全按钮「取消」默认聚焦；确认按钮是红字红边，不填实心红
       ——实心红只留给「删除这个网站的设置」。关闭后浏览器自动把焦点还给触发按钮。 -->
  <dialog ref="dlg" aria-labelledby="pm-mgmt-rules-reset-title" data-testid="pm-mgmt-rules-reset-dialog">
    <h2 id="pm-mgmt-rules-reset-title" data-testid="pm-mgmt-rules-reset-title">
      {{ t.common.resetSiteContentTitle }}
    </h2>
    <p data-testid="pm-mgmt-rules-reset-impact">{{ t.common.resetSiteContentImpact(count) }}</p>
    <form method="dialog" class="dialog-actions">
      <button value="cancel" autofocus data-testid="pm-mgmt-rules-reset-cancel">{{ t.common.cancel }}</button>
      <button value="confirm" class="danger" data-testid="pm-mgmt-rules-reset-confirm">
        {{ t.common.resetSiteContentConfirm }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '@/ui/i18n';

defineProps<{ count: number }>();
/** closed(confirmed)：确认框关了；confirmed = 点了「恢复内容」。写入归 SiteSettingsView */
const emit = defineEmits<{ closed: [confirmed: boolean] }>();

const dlg = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  const el = dlg.value;
  if (!el) return;
  // 与 DeleteSiteDialog 同一条路径：关闭只有一处，返回值就是按钮上的 value；Esc 视为取消
  el.addEventListener('close', () => {
    const confirmed = el.returnValue === 'confirm';
    el.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
    emit('closed', confirmed);
  });
  el.showModal();
});
</script>
