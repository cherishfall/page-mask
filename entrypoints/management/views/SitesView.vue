<template>
  <section class="view" aria-labelledby="pm-sites-title">
    <h2 id="pm-sites-title" class="view-title">你添加的网站</h2>
    <p class="hint">点一个网站进入它的设置页；没有添加的网站，PageMask 完全不碰。</p>

    <p v-if="!store.state.loaded" class="hint">正在读取…</p>

    <p v-else-if="store.state.profiles.length === 0" class="card empty" data-testid="pm-mgmt-empty">
      还没有添加任何网站。打开想变清爽的网站，点浏览器工具栏上的 PageMask 图标，就能开始设置。
    </p>

    <template v-else>
      <!-- 有配置、没授权的站点不少于 2 个（典型：刚导入）：一次请求全部授权 -->
      <div v-if="store.state.pendingOrigins.length >= 2" class="card pending-all" data-testid="pm-mgmt-pending-all">
        <span>{{ store.state.pendingOrigins.length }} 个网站待授权，授权前这些网站的设置不会生效。</span>
        <button
          type="button"
          class="primary"
          data-testid="pm-mgmt-authorize-all"
          @click="store.authorize(store.state.pendingOrigins)"
        >
          一次授权全部
        </button>
      </div>
      <p v-if="store.state.authError" class="hint error" role="alert">{{ store.state.authError }}</p>

      <ul class="site-list">
        <li v-for="p in store.state.profiles" :key="p.origin" class="site-row" :data-origin="p.origin">
          <a class="site-link" :href="siteHash(siteHostOf(p.origin))" data-testid="pm-mgmt-site-link">
            <img v-if="p.faviconDataUrl" class="favicon" :src="p.faviconDataUrl" alt="" />
            <span v-else class="favicon initial" aria-hidden="true">{{ initialOf(p.origin) }}</span>
            <span class="site-text">
              <span class="site-host">{{ siteLabelOf(p.origin) }}</span>
              <span class="site-meta">
                <span>{{ p.switchState === 'disguised' ? '清爽' : '原样' }}</span>
                <span aria-hidden="true">·</span>
                <!-- 0 条规则不写「已收起 0 项」 -->
                <span>{{ p.hideRules.length > 0 ? `已收起 ${p.hideRules.length} 项` : '没有收起任何内容' }}</span>
                <template v-if="staleCount(p) > 0">
                  <span aria-hidden="true">·</span>
                  <span class="stale" data-testid="pm-mgmt-row-stale">
                    <span aria-hidden="true">● </span>{{ staleCount(p) }} 项可能失效
                  </span>
                </template>
              </span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>

          <div v-if="isPending(p)" class="site-pending" data-testid="pm-mgmt-pending">
            <span class="badge">待授权</span>
            <span class="hint">浏览器没有这个网站的访问权限，设置都还在，授权后立即生效。</span>
            <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="store.authorize([p.origin])">
              授权并启用
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { SiteProfile } from '@/core/types';
import { siteHash } from '../router';
import { siteHostOf, siteLabelOf, staleRulesOf } from '../site';
import { managementStore as store } from '../store';

const isPending = (p: SiteProfile) => store.state.pendingOrigins.includes(p.origin);
const staleCount = (p: SiteProfile) => staleRulesOf(p).length;
const initialOf = (origin: string) => siteLabelOf(origin).slice(0, 1).toUpperCase();
</script>

<style scoped>
.view-title {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-1);
}

.empty {
  color: var(--pm-fg-muted);
}

.pending-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
  margin-bottom: var(--pm-space-3);
}

.site-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}

.site-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
}

.site-link {
  display: flex;
  align-items: center;
  gap: var(--pm-space-3);
  min-width: 0;
  padding: var(--pm-space-3) var(--pm-space-4);
  border-radius: var(--pm-radius-card);
  color: var(--pm-fg);
  text-decoration: none;
}

.site-link:hover {
  background: var(--pm-bg-subtle);
}

.favicon {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.favicon.initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--pm-bg-subtle);
  border: 1px solid var(--pm-border);
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
  font-weight: var(--pm-font-weight-strong);
  text-transform: uppercase;
}

.site-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.site-host {
  font-weight: var(--pm-font-weight-strong);
  overflow-wrap: anywhere;
}

.site-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}

.stale {
  color: var(--pm-danger);
}

.chevron {
  margin-left: auto;
  padding-left: var(--pm-space-2);
  color: var(--pm-fg-muted);
}

.site-pending {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--pm-space-2);
  margin: 0 var(--pm-space-4);
  padding: var(--pm-space-2) 0 var(--pm-space-3);
  border-top: 1px solid var(--pm-border);
}

.site-pending .hint {
  margin: 0;
}
</style>
