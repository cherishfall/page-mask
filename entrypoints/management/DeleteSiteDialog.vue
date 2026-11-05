<template>
  <!-- 「删除这个网站的设置」的二次确认（#113：从站点设置页抽出，两个视图共用一个实例）。
       原生模态 <dialog>：安全按钮「取消」默认聚焦，危险按钮实底红、要用户自己去点。
       文案与弹窗 / 胶囊菜单同一套（core/site-delete.ts）。关闭后焦点由浏览器还给触发按钮。 -->
  <dialog ref="dlg" aria-labelledby="pm-mgmt-reset-title" data-testid="pm-mgmt-reset-dialog">
    <h2 id="pm-mgmt-reset-title" data-testid="pm-mgmt-reset-title">{{ deleteSiteTitle(label) }}</h2>
    <p data-testid="pm-mgmt-reset-impact">{{ deleteSiteImpact() }}</p>
    <form method="dialog" class="dialog-actions">
      <button value="cancel" autofocus data-testid="pm-mgmt-reset-cancel">{{ t.common.cancel }}</button>
      <button value="confirm" class="primary danger" data-testid="pm-mgmt-reset-confirm">
        {{ deleteSiteAction() }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { deleteSiteAction, deleteSiteImpact, deleteSiteTitle } from '@/core/site-delete';
import { t } from '@/ui/i18n';

defineProps<{ label: string }>();
/** deleted(confirmed)：确认框关了；confirmed = 点了「删除设置」。收尾（删除、跳转）归 App.vue */
const emit = defineEmits<{ deleted: [confirmed: boolean] }>();

const dlg = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  const el = dlg.value;
  if (!el) return;
  // 直接挂在元素上（不靠模板事件转发）：关闭只有一条路径，返回值就是按钮上的 value
  el.addEventListener('close', () => {
    const confirmed = el.returnValue === 'confirm';
    el.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
    emit('deleted', confirmed);
  });
  el.showModal();
});
</script>
