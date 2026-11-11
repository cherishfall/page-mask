<template>
  <!-- 空设置时点胶囊主按钮的说明框（#158）。胶囊本体只有图标、写不下字，所以用对话框外壳讲一句；
       文案与弹窗 / 站点设置页同一句（t.common.switchNoEffectHint），只有一个「知道了」。
       原生模态 <dialog>：进 top layer、Esc 可关、按钮 autofocus 后回车即可关；
       点框外（::backdrop）也关——它是纯说明，不是要用户做选择。 -->
  <dialog
    ref="dlg"
    class="pm-tg-dialog"
    aria-labelledby="pm-tg-note-text"
    data-testid="pm-tg-empty-dialog"
  >
    <p id="pm-tg-note-text" class="pm-tg-dialog-text" data-testid="pm-tg-empty-text">
      {{ t.common.switchNoEffectHint }}
    </p>
    <form method="dialog" class="pm-tg-dialog-actions">
      <button type="submit" value="ok" class="pm-btn primary" autofocus data-testid="pm-tg-empty-ok">
        {{ t.common.gotIt }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '@/ui/i18n';

const emit = defineEmits<{ dismiss: [] }>();

const dlg = ref<HTMLDialogElement | null>(null);

onMounted(() => {
  const el = dlg.value;
  if (!el) return;
  // 关闭只有一条路径：任何关闭方式都通知调用方把节点卸掉（Esc / 回车 / 点外面）
  el.addEventListener('close', () => emit('dismiss'));
  // 点框外关闭：<dialog> 的 padding 也命中 dialog 本身，所以按坐标判断是否落在框内，
  // 只有真正点在框外（::backdrop 区域）才关（Material 3 / Ant Design 的浮层惯例）
  el.addEventListener('click', (e) => {
    if (e.target !== el) return;
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) el.close();
  });
  el.showModal();
});
</script>
