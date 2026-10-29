<template>
  <div class="shell">
    <header class="masthead">
      <h1>PageMask</h1>
      <p class="sub">管理你添加的网站：清爽模式开关、标签页标题和图标，以及收起项的状态。</p>
    </header>

    <main id="pm-main" ref="mainEl" tabindex="-1">
      <SitesView v-if="route.name === 'sites'" />
      <SiteSettingsView v-else-if="route.name === 'site'" :key="route.host" :host="route.host" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import SiteSettingsView from './views/SiteSettingsView.vue';
import SitesView from './views/SitesView.vue';
import { useHashRoute } from './router';
import { managementStore } from './store';

const route = useHashRoute();
const mainEl = ref<HTMLElement | null>(null);

onMounted(() => {
  void managementStore.init();
});

// 切换视图后把焦点交给主区域：点的那一行 / 那个链接可能已经不在页面上，
// 键盘与读屏用户需要知道内容换了地方（容器不是可交互元素，不画焦点环）。
watch(route, async () => {
  await nextTick();
  mainEl.value?.focus();
});
</script>

<style scoped>
:global(body) {
  background: var(--pm-bg-subtle);
}

.shell {
  max-width: 720px;
  margin: var(--pm-space-6) auto;
  padding: 0 var(--pm-space-4) 60px;
}

.masthead h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}

.sub {
  color: var(--pm-fg-muted);
  margin: var(--pm-space-1) 0 0;
}

main {
  padding-top: var(--pm-space-4);
}

/* 主区域只是程序化接收焦点的容器，不需要焦点环 */
main:focus {
  outline: none;
}
</style>
