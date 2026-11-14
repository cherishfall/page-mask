<template>
  <!-- 「恢复网站原来的标题和图标」的二次确认（#204；GLOSSARY：破坏性动作先确认，默认焦点「取消」）。
       照 ClearRulesDialog 的外壳。原生模态 <dialog>：关闭后浏览器自动把焦点还给触发按钮
       （按钮不随恢复消失，不用手动接焦点）。 -->
  <dialog ref="dlg" aria-labelledby="pm-mgmt-titleicon-reset-title" data-testid="pm-mgmt-titleicon-reset-dialog">
    <h2 id="pm-mgmt-titleicon-reset-title" data-testid="pm-mgmt-titleicon-reset-title">
      {{ t.common.resetTitleIconTitle }}
    </h2>
    <p data-testid="pm-mgmt-titleicon-reset-impact">{{ t.common.resetTitleIconImpact }}</p>
    <form method="dialog" class="dialog-actions">
      <button value="cancel" autofocus data-testid="pm-mgmt-titleicon-reset-cancel">{{ t.common.cancel }}</button>
      <button value="confirm" class="danger" data-testid="pm-mgmt-titleicon-reset-confirm">
        {{ t.common.resetTitleIconConfirm }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '@/ui/i18n';

/** closed(confirmed)：确认框关了；confirmed = 点了「恢复标题和图标」。写入归 SiteSettingsView */
const emit = defineEmits<{ closed: [confirmed: boolean] }>();

const dlg = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  const el = dlg.value;
  if (!el) return;
  // 与 ClearRulesDialog 同一条路径：关闭只有一处，返回值就是按钮上的 value；Esc 视为取消
  el.addEventListener('close', () => {
    const confirmed = el.returnValue === 'confirm';
    el.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
    emit('closed', confirmed);
  });
  el.showModal();
});
</script>
