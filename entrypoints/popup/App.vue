<template>
  <!-- aria-busy：读取中、处理中时告诉读屏这里的内容还会变（modern-web-guidance「accessibility」） -->
  <main class="popup" :aria-busy="phase === 'loading' || busy !== '' ? 'true' : 'false'">
    <header class="head">
      <h1 class="logo">PageMask</h1>
    </header>

    <p v-if="phase === 'loading'" class="hint" data-testid="pm-popup-loading">正在读取当前网页…</p>
    <p v-else-if="phase === 'unsupported'" class="hint" data-testid="pm-popup-unsupported">
      {{ supported.reason || '这个页面无法使用清爽模式' }}
    </p>

    <template v-else>
      <div class="site">
        <div class="site-head">
          <h2 class="host">{{ host }}</h2>
          <span v-if="phase === 'pending'" class="badge" data-testid="pm-popup-pending-badge">待授权</span>
        </div>

        <!-- 开关：<input type="checkbox" switch>，Chrome 不支持 switch 属性，显式 role="switch"（modern-web-guidance「switch」） -->
        <div v-if="phase === 'ready' && profile" class="switch-row">
          <label for="pm-popup-switch">清爽模式</label>
          <input
            id="pm-popup-switch"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-popup-switch"
            :checked="profile.switchState === 'disguised'"
            :disabled="busy !== ''"
            @change="toggleSwitch"
          />
        </div>

        <p v-if="profile" class="meta">
          {{ ruleSummary }}<template v-if="staleCount > 0">
            ·
            <span class="stale" data-testid="pm-popup-stale"><span aria-hidden="true">● </span>{{ staleCount }} 项可能失效</span>
          </template>
        </p>
        <p v-else class="hint">这个网站还没有设置过，开启后 PageMask 才会处理它。</p>
      </div>

      <p v-if="message" class="hint error" role="alert" data-testid="pm-popup-error">{{ message }}</p>

      <template v-if="phase === 'pending'">
        <!-- 有配置、没授权：配置还在，只是浏览器收回了这个网站的访问权限 -->
        <p class="hint" data-testid="pm-popup-pending">浏览器收回了这个网站的访问权限，设置都还在，重新授权后立即恢复。</p>
        <button class="primary" data-testid="pm-popup-reauth" :disabled="busy !== ''" @click="reauthorize">
          {{ busy === 'reauth' ? '正在授权…' : '重新授权' }}
        </button>
      </template>
      <button v-else class="primary" data-testid="pm-popup-setup" :disabled="busy !== ''" @click="setup">
        <template v-if="busy === 'setup'">正在打开…</template>
        <template v-else-if="profile"><span aria-hidden="true">＋</span> 收起更多内容</template>
        <template v-else>为当前网站开启清爽模式</template>
      </button>

      <!-- 页面内编辑面板的第二个入口（普通按钮，不是右键菜单） -->
      <button
        v-if="phase === 'ready'"
        class="ghost"
        data-testid="pm-popup-edit"
        :disabled="busy !== ''"
        @click="editSite"
      >
        {{ busy === 'edit' ? '正在打开…' : '编辑当前网站' }}
      </button>
      <!-- 还没添加的网站：只想改标签页标题和图标的路（不进向导），见 #42 -->
      <button
        v-else-if="phase === 'new'"
        class="ghost"
        data-testid="pm-popup-title-settings"
        :disabled="busy !== ''"
        @click="openTitleSettings"
      >
        {{ busy === 'title' ? '正在打开…' : '设置标题和图标' }}
      </button>
    </template>

    <button class="ghost manage" @click="manage">管理全部网站</button>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import { isSupportedPage, normalizeOrigin } from '@/core/origin';
import { originPattern } from '@/core/registration';
import { addHash } from '@/entrypoints/management/router';
import type { SiteProfile } from '@/core/types';
import type { EnableSiteResponse, OpenEditorMsg, OpenIntent } from '@/core/messages';

const tab = ref<{ id?: number; url?: string } | null>(null);
/** tabs.query 已返回（tab 可能仍为 null：没有活动标签页） */
const tabLoaded = ref(false);
const profile = ref<SiteProfile | null>(null);
/** 当前网站的站点授权；null = 还没查 */
const granted = ref<boolean | null>(null);
/** 正在处理的操作：''=空闲；处理期间按钮禁用，防止重复点击 */
const busy = ref<'' | 'setup' | 'reauth' | 'toggle' | 'edit' | 'title'>('');
/** 失败 / 授权被拒时给用户看的话 */
const message = ref('');

/** 失败时给用户看的话（不暴露内部错误） */
const ERROR_TEXT: Record<string, string> = {
  tabMismatch: '页面已经换了，请回到要设置的网站再点一次 PageMask',
  notGranted: '还没有拿到这个网站的访问权限，请再点一次并选择「允许」',
  injectFailed: '没能在这个页面启动，刷新页面后再试一次',
  // denied / gestureLost 都用这句：能做的只有再点一次
  denied: '需要允许访问这个网站，才能开启清爽模式。可以再点一次并选择「允许」',
  gestureLost: '没能打开权限弹窗，请再点一次 PageMask',
};
const TOGGLE_FAILED_TEXT = '没能切换清爽模式，请稍后再试一次';
const EDIT_FAILED_TEXT = '没能打开编辑面板，刷新这个页面后再试一次';

const supported = computed(() => (tab.value?.url ? isSupportedPage(tab.value.url) : { ok: false, reason: '' }));
const origin = computed(() => (tab.value?.url ? normalizeOrigin(tab.value.url) : null));
const host = computed(() => (origin.value ? new URL(origin.value).hostname.replace(/^www\./, '') : ''));
const staleCount = computed(() => profile.value?.hideRules.filter((r) => r.lastHealth === 'stale').length ?? 0);
/** 0 条规则不写「已收起 0 项」：没有内容可收起是「只想改标题」站点的正常形态 */
const ruleSummary = computed(() => {
  const n = profile.value?.hideRules.length ?? 0;
  return n > 0 ? `已收起 ${n} 项` : '没有收起任何内容';
});

/**
 * 界面状态：
 * loading 读取中 / unsupported 不支持的页面 / new 没有配置 / pending 有配置、没授权（待授权）/ ready 有配置、已授权
 */
const phase = computed<'loading' | 'unsupported' | 'new' | 'pending' | 'ready'>(() => {
  if (!tabLoaded.value) return 'loading';
  if (!supported.value.ok || !origin.value) return 'unsupported';
  if (granted.value === null) return 'loading';
  if (!profile.value) return 'new';
  return granted.value ? 'ready' : 'pending';
});

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  tab.value = tabs[0] ?? null;
  tabLoaded.value = true;
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
  if (!o || !supported.value.ok) return;
  const storage = createPageMaskStorage(browser.storage.local);
  const [p, g] = await Promise.all([
    storage.getProfile(o),
    browser.permissions.contains({ origins: [originPattern(o)] }).catch(() => false),
  ]);
  profile.value = p;
  granted.value = g;
}

async function toggleSwitch(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!profile.value || !origin.value || busy.value) return;
  // 目标态 = 用户刚拨到的位置；只改开关字段，不覆盖页面里刚写入的体检结果等
  const target = input.checked ? 'disguised' : 'original';
  busy.value = 'toggle';
  message.value = '';
  try {
    const storage = createPageMaskStorage(browser.storage.local);
    profile.value = await storage.updateProfile(origin.value, (p) => {
      p.switchState = target;
    });
  } catch {
    input.checked = profile.value?.switchState === 'disguised'; // 写入失败：开关拨回实际状态
    message.value = TOGGLE_FAILED_TEXT;
  } finally {
    busy.value = '';
  }
}

/**
 * 让后台核对标签页、对账注册并向当前标签页注入内容脚本，可选随即打开向导（后台注入完成后直接通知，无需等待重试）。
 * 传 requestPermission 时由后台在用户手势的同一个回合里请求站点权限：权限框弹出会销毁 popup，
 * 只有后台能跨过这一步继续把向导打开（见 core/background-engine.ts）。
 */
async function enableSite(
  tabId: number,
  o: string,
  opts: { open?: OpenIntent; requestPermission?: boolean } = {},
): Promise<EnableSiteResponse | undefined> {
  return browser.runtime
    .sendMessage({ t: 'enableSite', origin: o, tabId, open: opts.open, requestPermission: opts.requestPermission })
    .catch(() => undefined);
}

/** 主按钮：新站点授权并打开设置向导；已配置站点打开「添加元素」向导 */
function setup() {
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined || busy.value) return;
  message.value = '';
  busy.value = 'setup';
  void (async () => {
    try {
      const res = await enableSite(
        tabId,
        o,
        profile.value ? { open: 'addElement' } : { open: 'newSite', requestPermission: true },
      );
      if (res?.ok) {
        window.close();
        return;
      }
      message.value = ERROR_TEXT[res?.code ?? ''] ?? ERROR_TEXT.injectFailed!;
    } finally {
      busy.value = '';
    }
  })();
}

/** 有配置、没授权：重新请求本站授权，拿到后让后台对账并注入当前页 */
function reauthorize() {
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined || busy.value) return;
  message.value = '';
  busy.value = 'reauth';
  void (async () => {
    try {
      const res = await enableSite(tabId, o, { requestPermission: true });
      if (!res?.ok) {
        message.value = ERROR_TEXT[res?.code ?? ''] ?? ERROR_TEXT.injectFailed!;
        return;
      }
      granted.value = true;
      await refresh();
    } finally {
      busy.value = '';
    }
  })();
}

/**
 * 打开页面内的编辑面板。内容脚本可能还没注入（页面是刚打开、或扩展刚更新）：
 * 发送失败时先让后台对账注入，再发一次
 */
async function editSite() {
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined || busy.value) return;
  message.value = '';
  busy.value = 'edit';
  try {
    const send = () => browser.tabs.sendMessage(tabId, { t: 'openEditor' } satisfies OpenEditorMsg);
    try {
      await send();
    } catch {
      if (!(await enableSite(tabId, o))?.ok) return;
      await send();
    }
    window.close();
  } catch {
    message.value = EDIT_FAILED_TEXT;
  } finally {
    busy.value = '';
  }
}

/**
 * 未配置站点的次按钮：打开管理页的「待添加」页（`#/add/<来源>`），在那里授权、填标题，
 * 写下一份 0 条规则的配置。不能把授权放进 popup——权限框弹出会销毁 popup。
 */
async function openTitleSettings() {
  const o = origin.value;
  if (!o || busy.value) return;
  message.value = '';
  busy.value = 'title';
  try {
    await browser.tabs.create({ url: browser.runtime.getURL('/management.html') + addHash(o) });
    window.close();
  } catch {
    message.value = '没能打开管理页，请再点一次 PageMask';
    busy.value = '';
  }
}

async function manage() {
  await browser.tabs.create({ url: browser.runtime.getURL('/management.html') });
  window.close();
}</script>

<style>
/* 共享样式（字体、颜色、按钮、开关、徽标）来自 @/styles/base.css；这里只写 popup 布局 */
.popup {
  width: 320px;
  box-sizing: border-box;
  padding: var(--pm-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-3);
}
.head {
  display: flex;
  align-items: center;
}
.logo {
  font-size: var(--pm-font-size-title);
  margin: 0;
  letter-spacing: 0.2px;
}
.popup > .hint {
  font-size: var(--pm-font-size-body);
  margin: 0;
}
.site {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}
.site-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.host {
  font-size: var(--pm-font-size-body);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-2);
}
.switch-row label {
  cursor: pointer;
}
.meta {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: 0;
}
.stale {
  color: var(--pm-danger);
}
.site .hint {
  margin: 0;
}
.popup > button.primary {
  padding: 8px 12px;
}
.manage {
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
}
button.manage:hover:not(:disabled) {
  color: var(--pm-fg);
}
</style>
