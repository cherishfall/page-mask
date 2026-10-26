<template>
  <div class="popup">
    <header class="head">
      <span class="logo">PageMask</span>
      <span v-if="staleCount > 0" class="dot" :title="`${staleCount} 条规则可能失效`">●</span>
    </header>

    <p v-if="!tab" class="hint">正在读取当前标签页…</p>
    <p v-else-if="!supported.ok" class="hint">{{ supported.reason }}</p>
    <template v-else>
      <div v-if="profile" class="site">
        <div class="row">
          <span class="host">{{ host }}</span>
          <button class="switch" :class="{ on: profile.switchState === 'disguised' }" @click="toggleSwitch">
            {{ profile.switchState === 'disguised' ? '清爽中' : '原样' }}
          </button>
        </div>
        <div class="meta">
          {{ profile.hideRules.length }} 条隐藏规则
          <span v-if="staleCount > 0" class="stale">● {{ staleCount }} 条可能失效</span>
        </div>
      </div>

      <button class="primary" @click="setup">{{ profile ? '＋ 添加要去掉的元素' : '为当前网站开启清爽模式' }}</button>
    </template>

    <button class="ghost" @click="manage">管理全部站点</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import { isSupportedPage, normalizeOrigin } from '@/core/origin';
import type { SiteProfile } from '@/core/types';

const tab = ref<{ id?: number; url?: string } | null>(null);
const profile = ref<SiteProfile | null>(null);

const supported = computed(() => (tab.value?.url ? isSupportedPage(tab.value.url) : { ok: false, reason: '' }));
const origin = computed(() => (tab.value?.url ? normalizeOrigin(tab.value.url) : null));
const host = computed(() => (origin.value ? new URL(origin.value).hostname.replace(/^www\./, '') : ''));
const staleCount = computed(() => profile.value?.hideRules.filter((r) => r.lastHealth === 'stale').length ?? 0);

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  tab.value = tabs[0] ?? null;
  await refreshProfile();
  browser.storage.onChanged.addListener((_, area) => {
    if (area === 'local') void refreshProfile();
  });
});

async function refreshProfile() {
  if (!origin.value) return;
  const storage = createPageMaskStorage(browser.storage.local);
  profile.value = await storage.getProfile(origin.value);
}

async function toggleSwitch() {
  if (!profile.value || !origin.value) return;
  // 目标态 = 当前显示状态的反面；只改开关字段，不覆盖页面里刚写入的体检结果等
  const target = profile.value.switchState === 'disguised' ? 'original' : 'disguised';
  const storage = createPageMaskStorage(browser.storage.local);
  const fresh = await storage.updateProfile(origin.value, (p) => {
    p.switchState = target;
  });
  profile.value = fresh;
}

/** 唯一入口：新站点授权并注入，随后打开设置向导 */
async function setup() {
  const url = tab.value?.url;
  const tabId = tab.value?.id;
  if (!url || !origin.value || tabId === undefined) return;

  if (!profile.value) {
    // 权限请求必须直接处于点击手势上下文中（先于任何 await）
    const granted = await browser.permissions.request({ origins: [`${origin.value}/*`] });
    if (!granted) return;

    const storage = createPageMaskStorage(browser.storage.local);
    // 已有则原样保留，没有则新建空配置
    profile.value = await storage.updateProfile(origin.value, () => false, { create: true });
    await browser.runtime.sendMessage({ t: 'enableSite', origin: origin.value, tabId });
    // 内容脚本刚被注入，稍等后通知其打开向导（注入竞态重试）
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      try {
        await browser.tabs.sendMessage(tabId, { t: 'openWizard', mode: 'newSite' });
        break;
      } catch {
        // 内容脚本尚未就绪，继续重试
      }
    }
  } else {
    try {
      await browser.tabs.sendMessage(tabId, { t: 'openWizard', mode: 'addElement' });
    } catch {
      // 页面脚本不在（如扩展刚重载），重新拉起后重试一次
      await browser.runtime.sendMessage({ t: 'enableSite', origin: origin.value, tabId });
      await sleep(400);
      await browser.tabs.sendMessage(tabId, { t: 'openWizard', mode: 'addElement' }).catch(() => undefined);
    }
  }
  window.close();
}

function manage() {
  browser.tabs.create({ url: browser.runtime.getURL('/management.html') });
  window.close();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
</script>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
}
.popup {
  width: 280px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 14px;
}
.logo {
  letter-spacing: 0.2px;
}
.dot {
  color: #e5484d;
  cursor: help;
}
.hint {
  font-size: 13px;
  color: #666;
  margin: 4px 0;
}
.site .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.host {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.switch {
  border: 1px solid #d0d0d0;
  background: #f5f5f5;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #555;
}
.switch.on {
  background: #3575e0;
  border-color: #3575e0;
  color: #fff;
}
.meta {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.stale {
  color: #e5484d;
}
.primary {
  border: none;
  background: #3575e0;
  color: #fff;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  cursor: pointer;
}
.primary:hover {
  background: #2b66c9;
}
.ghost {
  border: none;
  background: transparent;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
}
.ghost:hover {
  color: #333;
}
</style>
