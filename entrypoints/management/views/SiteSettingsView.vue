<template>
  <section class="view" aria-labelledby="pm-site-title">
    <a class="back" href="#/sites" data-testid="pm-mgmt-back">← 返回网站列表</a>

    <p v-if="!store.state.loaded" class="hint">正在读取…</p>

    <div v-else-if="!profile" class="card empty" data-testid="pm-mgmt-site-missing">
      <h2 id="pm-site-title">没有这个网站的设置</h2>
      <p class="hint">打开这个网站，点浏览器工具栏上的 PageMask 图标，就能为它开启清爽模式。</p>
      <a class="button" href="#/sites">回到网站列表</a>
    </div>

    <template v-else>
      <div class="site-head">
        <h2 id="pm-site-title" class="host">{{ siteLabelOf(profile.origin) }}</h2>
        <div class="switch-row">
          <label for="pm-mgmt-switch">清爽模式</label>
          <input
            id="pm-mgmt-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-mgmt-switch"
            :checked="profile.switchState === 'disguised'"
            :disabled="!!store.state.toggling[profile.origin]"
            @change="onToggle"
          />
        </div>
      </div>

      <p class="state">
        已收起 {{ profile.hideRules.length }} 项<template v-if="stale.length > 0">
          ·
          <span class="stale" data-testid="pm-mgmt-stale-count">
            <span aria-hidden="true">● </span>{{ stale.length }} 项可能失效
          </span>
        </template>
      </p>

      <p v-if="store.state.toggleError[profile.origin]" class="hint error" role="alert">
        {{ store.state.toggleError[profile.origin] }}
      </p>

      <div v-if="isPending" class="pending" data-testid="pm-mgmt-pending">
        <span class="badge">待授权</span>
        <span class="hint">浏览器没有这个网站的访问权限，设置都还在，授权后立即生效。</span>
        <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="store.authorize([profile.origin])">
          授权并启用
        </button>
      </div>

      <!-- 失效清单直接写出来（title 提示键盘和触屏都看不到，审查 N39） -->
      <ul v-if="stale.length > 0" class="stale-list" data-testid="pm-mgmt-stale-list">
        <li v-for="r in stale" :key="r.id">「{{ r.elementName }}」最近没找到，可能网站改版了，可以打开这个网站重新选一次</li>
      </ul>

      <!-- #41 补齐：标题、图标、收起项清单与一键清空的入口还没搬到这里 -->
      <p class="hint placeholder" data-testid="pm-mgmt-placeholder">
        标签页标题、标签页图标和收起项清单的修改还在做，目前这里可以先切换清爽模式和查看状态。
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { managementStore as store } from '../store';
import { normalizeSiteHost, siteHostOf, siteLabelOf, staleRulesOf } from '../site';

const props = defineProps<{ host: string }>();

const profile = computed(() => {
  const host = normalizeSiteHost(props.host);
  return store.state.profiles.find((p) => siteHostOf(p.origin) === host) ?? null;
});

const stale = computed(() => (profile.value ? staleRulesOf(profile.value) : []));
const isPending = computed(() => (profile.value ? store.state.pendingOrigins.includes(profile.value.origin) : false));

function onToggle(e: Event) {
  if (profile.value) void store.toggleSite(profile.value, e);
}
</script>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: var(--pm-space-3);
  font-size: var(--pm-font-size-caption);
}

.site-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
}

.site-head .host {
  margin: 0;
  overflow-wrap: anywhere;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--pm-space-2);
  flex: none;
}

.switch-row label {
  cursor: pointer;
}

.state {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: var(--pm-space-2) 0;
}

.stale {
  color: var(--pm-danger);
}

.stale-list {
  margin: 0 0 var(--pm-space-2);
  padding-left: 18px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg);
}

.pending {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--pm-space-2);
  margin: var(--pm-space-2) 0;
}

.pending .hint {
  margin: 0;
}

.empty h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}

.empty .hint {
  margin-bottom: var(--pm-space-3);
}

.placeholder {
  margin-top: var(--pm-space-4);
}
</style>
