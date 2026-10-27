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
          <button
            v-if="granted !== false"
            class="switch"
            :class="{ on: profile.switchState === 'disguised' }"
            @click="toggleSwitch"
          >
            {{ profile.switchState === 'disguised' ? '清爽中' : '原样' }}
          </button>
        </div>
        <div class="meta">
          {{ profile.hideRules.length }} 条隐藏规则
          <span v-if="staleCount > 0" class="stale">● {{ staleCount }} 条可能失效</span>
        </div>
      </div>

      <p v-if="setupError" class="hint error" role="alert">{{ setupError }}</p>
      <template v-if="profile && granted === false">
        <!-- 有配置、没授权：配置还在，只是浏览器收回了这个网站的访问权限 -->
        <p class="hint" data-testid="pm-popup-pending">这个网站的授权已被收回，设置都还在。重新授权后立即恢复。</p>
        <button class="primary" data-testid="pm-popup-reauth" @click="reauthorize">重新授权</button>
      </template>
      <button v-else class="primary" data-testid="pm-popup-setup" @click="setup">
        {{ profile ? '＋ 添加要去掉的元素' : '为当前网站开启清爽模式' }}
      </button>
    </template>

    <button class="ghost" @click="manage">管理全部站点</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import { isSupportedPage, normalizeOrigin } from '@/core/origin';
import { originPattern } from '@/core/registration';
import type { SiteProfile } from '@/core/types';
import type { EnableSiteResponse, OpenIntent } from '@/core/messages';

const tab = ref<{ id?: number; url?: string } | null>(null);
const profile = ref<SiteProfile | null>(null);
/** 当前网站的站点授权；null = 还没查 */
const granted = ref<boolean | null>(null);
const setupError = ref('');

/** 失败时给用户看的话（不暴露内部错误） */
const ERROR_TEXT: Record<string, string> = {
  tabMismatch: '页面已经换了，请回到要设置的网站再点一次 PageMask',
  notGranted: '还没有拿到这个网站的授权，请再点一次并选择「允许」',
  injectFailed: '没能在这个页面启动，刷新页面后再试一次',
};

const supported = computed(() => (tab.value?.url ? isSupportedPage(tab.value.url) : { ok: false, reason: '' }));
const origin = computed(() => (tab.value?.url ? normalizeOrigin(tab.value.url) : null));
const host = computed(() => (origin.value ? new URL(origin.value).hostname.replace(/^www\./, '') : ''));
const staleCount = computed(() => profile.value?.hideRules.filter((r) => r.lastHealth === 'stale').length ?? 0);

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  tab.value = tabs[0] ?? null;
  await refresh();
  browser.storage.onChanged.addListener((_, area) => {
    if (area === 'local') void refresh();
  });
  // 用户可能在扩展详情里改了站点访问权限
  browser.permissions.onAdded.addListener(() => void refresh());
  browser.permissions.onRemoved.addListener(() => void refresh());
});

async function refresh() {
  const o = origin.value;
  if (!o) return;
  const storage = createPageMaskStorage(browser.storage.local);
  const [p, g] = await Promise.all([
    storage.getProfile(o),
    browser.permissions.contains({ origins: [originPattern(o)] }).catch(() => false),
  ]);
  profile.value = p;
  granted.value = g;
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

/**
 * 让后台核对标签页、对账注册并向当前标签页注入内容脚本，可选随即打开向导（后台注入完成后直接通知，无需等待重试）。
 * 返回是否成功；失败时设置提示文字。
 */
async function enableSite(tabId: number, o: string, open?: OpenIntent): Promise<boolean> {
  const res: EnableSiteResponse | undefined = await browser.runtime
    .sendMessage({ t: 'enableSite', origin: o, tabId, open })
    .catch(() => undefined);
  if (res?.ok) return true;
  setupError.value = ERROR_TEXT[res?.code ?? ''] ?? ERROR_TEXT.injectFailed!;
  return false;
}

/** 主按钮：新站点授权并打开设置向导；已配置站点打开「添加元素」向导 */
function setup() {
  setupError.value = '';
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined) return;

  if (!profile.value) {
    // 权限请求必须直接处于点击手势的同步上下文中：这里之前不能有任何 await
    const request = browser.permissions.request({ origins: [originPattern(o)] });
    void (async () => {
      if (!(await request.catch(() => false))) return;
      // 新站点：保存向导前不写配置；取消向导时后台会收回这次授权
      if (await enableSite(tabId, o, 'newSite')) window.close();
    })();
    return;
  }
  void (async () => {
    if (await enableSite(tabId, o, 'addElement')) window.close();
  })();
}

/** 有配置、没授权：重新请求本站授权，拿到后让后台对账并注入当前页 */
function reauthorize() {
  setupError.value = '';
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined) return;
  // 同上：第一条语句就请求权限，保留用户手势
  const request = browser.permissions.request({ origins: [originPattern(o)] });
  void (async () => {
    if (!(await request.catch(() => false))) return;
    if (await enableSite(tabId, o)) granted.value = true;
    await refresh();
  })();
}

function manage() {
  browser.tabs.create({ url: browser.runtime.getURL('/management.html') });
  window.close();
}
</script>

<style>
/* body 的字体、前景、背景来自 @/styles/base.css（tokens 示例接入，#33）；其余尺寸 / 结构的整改见 #26 */
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
  color: var(--pm-danger);
  cursor: help;
}
.hint {
  font-size: 13px;
  color: var(--pm-fg-muted);
  margin: 4px 0;
}
.hint.error {
  color: var(--pm-danger);
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
  border: 1px solid var(--pm-border-control);
  background: var(--pm-bg-subtle);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--pm-fg);
}
.switch.on {
  background: var(--pm-accent);
  border-color: var(--pm-accent);
  color: var(--pm-on-accent);
}
.meta {
  font-size: 12px;
  color: var(--pm-fg-muted);
  margin-top: 4px;
}
.stale {
  color: var(--pm-danger);
}
.primary {
  border: none;
  background: var(--pm-accent);
  color: var(--pm-on-accent);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  cursor: pointer;
}
.primary:hover {
  background: var(--pm-accent-hover);
}
.ghost {
  border: none;
  background: transparent;
  color: var(--pm-fg-muted);
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
}
.ghost:hover {
  color: var(--pm-fg);
}
</style>
