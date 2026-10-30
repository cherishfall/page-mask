<template>
  <!-- aria-busy：读取中、处理中时告诉读屏这里的内容还会变（modern-web-guidance「accessibility」） -->
  <main class="popup" :aria-busy="phase === 'loading' || busy !== '' ? 'true' : 'false'">
    <header class="head">
      <h1 class="logo">PageMask</h1>
    </header>

    <p v-if="phase === 'loading'" class="hint" data-testid="pm-popup-loading">{{ t.popup.loading }}</p>
    <p v-else-if="phase === 'unsupported'" class="hint" data-testid="pm-popup-unsupported">
      {{ supported.reason || t.popup.unsupportedFallback }}
    </p>

    <template v-else>
      <div class="site">
        <div class="site-head">
          <h2 class="host">{{ host }}</h2>
          <span v-if="phase === 'pending'" class="badge" data-testid="pm-popup-pending-badge">{{ t.popup.pendingBadge }}</span>
        </div>

        <!-- 开关：<input type="checkbox" switch>，Chrome 不支持 switch 属性，显式 role="switch"（modern-web-guidance「switch」） -->
        <div v-if="phase === 'ready' && profile" class="switch-row">
          <label for="pm-popup-switch">{{ t.common.cleanMode }}</label>
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
            <span class="stale" data-testid="pm-popup-stale"><span aria-hidden="true">● </span>{{ t.common.staleCount(staleCount) }}</span>
          </template>
        </p>
        <p v-else class="hint">{{ t.popup.newSiteHint }}</p>
      </div>

      <p v-if="message" class="hint error" role="alert" data-testid="pm-popup-error">{{ message }}</p>

      <template v-if="phase === 'pending'">
        <!-- 有配置、没授权：配置还在，只是浏览器收回了这个网站的访问权限 -->
        <p class="hint" data-testid="pm-popup-pending">{{ t.popup.pendingHint }}</p>
        <button class="primary" data-testid="pm-popup-reauth" :disabled="busy !== ''" @click="reauthorize">
          {{ busy === 'reauth' ? t.popup.reauthorizing : t.popup.reauthorize }}
        </button>
      </template>
      <button v-else class="primary" data-testid="pm-popup-setup" :disabled="busy !== ''" @click="setup">
        <template v-if="busy === 'setup'">{{ t.common.opening }}</template>
        <template v-else-if="profile"><span aria-hidden="true">＋</span> {{ t.popup.setupMore }}</template>
        <template v-else>{{ t.popup.setupNew }}</template>
      </button>

      <!-- 页面内编辑面板的第二个入口（普通按钮，不是右键菜单） -->
      <button
        v-if="phase === 'ready'"
        data-testid="pm-popup-edit"
        :disabled="busy !== ''"
        @click="editSite"
      >
        {{ busy === 'edit' ? t.common.opening : t.popup.editSite }}
      </button>

      <!-- 遮住开关（#54）：遮住后按钮自己写着「恢复本页」。没添加过 / 已添加 / 待授权三种站点都能用 -->
      <button data-testid="pm-popup-cover" :disabled="busy !== ''" @click="toggleCurtain">
        <template v-if="busy === 'curtain'">{{ covered ? t.popup.restoring : t.popup.covering }}</template>
        <template v-else>{{ covered ? t.popup.restorePage : t.popup.coverPage }}</template>
      </button>
    </template>

    <div class="links">
      <button class="ghost link" data-testid="pm-popup-manage" @click="manage">{{ t.popup.manageAll }}</button>
      <button class="ghost link" data-testid="pm-popup-settings" @click="openSettings">{{ t.popup.settings }}</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { t } from '@/ui/i18n';
import { createPageMaskStorage } from '@/core/storage';
import { isSupportedPage, normalizeOrigin } from '@/core/origin';
import { originPattern } from '@/core/registration';
import type { SiteProfile } from '@/core/types';
import type {
  CurtainCoverMsg,
  CurtainDismissMsg,
  CurtainStateMsg,
  CurtainStateReply,
  EnableSiteResponse,
  OpenEditorMsg,
  OpenIntent,
} from '@/core/messages';

const tab = ref<{ id?: number; url?: string } | null>(null);
/** tabs.query 已返回（tab 可能仍为 null：没有活动标签页） */
const tabLoaded = ref(false);
const profile = ref<SiteProfile | null>(null);
/** 当前网站的站点授权；null = 还没查 */
const granted = ref<boolean | null>(null);
/** 当前标签页是否遮着（#54）：面板打开时问页面，问不到就当未遮住 */
const covered = ref(false);
/** 正在处理的操作：''=空闲；处理期间按钮禁用，防止重复点击 */
const busy = ref<'' | 'setup' | 'reauth' | 'toggle' | 'edit' | 'curtain'>('');
/** 失败时给用户看的话（不暴露内部错误）：存 code，文案从 t 里取（语言切换后跟着变） */
const errorCode = ref<string>('');
const message = computed(() => {
  const code = errorCode.value;
  if (!code) return '';
  const errors = t.value.popup.error as Record<string, string | undefined>;
  return errors[code] ?? errors.injectFailed ?? '';
});

const supported = computed(() => (tab.value?.url ? isSupportedPage(tab.value.url) : { ok: false, reason: '' }));
const origin = computed(() => (tab.value?.url ? normalizeOrigin(tab.value.url) : null));
const host = computed(() => (origin.value ? new URL(origin.value).hostname.replace(/^www\./, '') : ''));
const staleCount = computed(() => profile.value?.hideRules.filter((r) => r.lastHealth === 'stale').length ?? 0);
/** 0 条规则不写「已收起 0 项」：没有内容可收起是「只想改标题」站点的正常形态 */
const ruleSummary = computed(() => {
  const n = profile.value?.hideRules.length ?? 0;
  return n > 0 ? t.value.common.hiddenCount(n) : t.value.common.hiddenNone;
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
  await refreshCurtain();
}

/**
 * 给当前标签页发一条幕布消息。没有接收方时（没添加过的网站没有内容脚本、一次性脚本还没注入过）
 * 返回 undefined——调用方按「没遮住」处理，不当成错误。
 */
async function sendCurtain(
  tabId: number,
  msg: CurtainStateMsg | CurtainCoverMsg | CurtainDismissMsg,
): Promise<CurtainStateReply | undefined> {
  return (await browser.tabs.sendMessage(tabId, msg).catch(() => undefined)) as CurtainStateReply | undefined;
}

/** 问当前标签页遮着没有：内容脚本与一次性脚本都认这三条消息，两条路径的状态一致 */
async function refreshCurtain() {
  const tabId = tab.value?.id;
  if (tabId === undefined) return;
  const reply = await sendCurtain(tabId, { t: 'curtainState' });
  covered.value = reply?.covered === true;
}

async function toggleSwitch(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!profile.value || !origin.value || busy.value) return;
  // 目标态 = 用户刚拨到的位置；只改开关字段，不覆盖页面里刚写入的体检结果等
  const target = input.checked ? 'disguised' : 'original';
  busy.value = 'toggle';
  errorCode.value = '';
  try {
    const storage = createPageMaskStorage(browser.storage.local);
    profile.value = await storage.updateProfile(origin.value, (p) => {
      p.switchState = target;
    });
  } catch {
    input.checked = profile.value?.switchState === 'disguised'; // 写入失败：开关拨回实际状态
    errorCode.value = 'toggleFailed';
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
  errorCode.value = '';
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
      errorCode.value = res?.code ?? 'injectFailed';
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
  errorCode.value = '';
  busy.value = 'reauth';
  void (async () => {
    try {
      const res = await enableSite(tabId, o, { requestPermission: true });
      if (!res?.ok) {
        errorCode.value = res?.code ?? 'injectFailed';
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
  errorCode.value = '';
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
    errorCode.value = 'editFailed';
  } finally {
    busy.value = '';
  }
}

/**
 * 遮住开关（#54）：一个按钮两个方向，处理期间禁用防连点。
 * 成功后面板关闭——拖走视线的那一步不该再留一个窗口在屏幕上。
 */
async function toggleCurtain() {
  const tabId = tab.value?.id;
  if (tabId === undefined || busy.value) return;
  const wantRestore = covered.value;
  errorCode.value = '';
  busy.value = 'curtain';
  try {
    const ok = wantRestore ? await dismissCurtain(tabId) : await coverCurtain(tabId);
    if (!ok) {
      errorCode.value = wantRestore ? 'restoreFailed' : 'coverFailed';
      return;
    }
    window.close();
  } finally {
    busy.value = '';
  }
}

/**
 * 遮住当前标签页，两条路径按站点状态分流：
 * - 内容脚本在（已添加的网站，页面开过）：让它遮——与悬浮胶囊上的「遮住」同一颗按钮、同一位置、
 *   同一标题来源。不看授权状态：待授权站点只要页面开在撤销授权之前，内容脚本仍然活着；
 * - 已添加且已授权、内容脚本却还没在（页面开在授权之前）：先让后台对账注入一次再发；
 * - 剩下没添加过 / 待授权且没有内容脚本的：页面里没有任何可用的脚本，由后台用 activeTab
 *   注入一次性脚本（#46），它与内容脚本共用同一套覆盖层、恢复按钮与标题来源。
 */
async function coverCurtain(tabId: number): Promise<boolean> {
  if ((await sendCurtain(tabId, { t: 'curtainCover' }))?.covered) return true;
  const o = origin.value;
  if (profile.value && granted.value && o) {
    if ((await enableSite(tabId, o))?.ok && (await sendCurtain(tabId, { t: 'curtainCover' }))?.covered) return true;
  }
  const res: { ok?: boolean } | undefined = await browser.runtime
    .sendMessage({ t: 'coverPage', tabId })
    .catch(() => undefined);
  return res?.ok === true;
}

/** 撤掉当前标签页的幕布；接收方已经不在了（刷新 / 跳走，幕布本来也随文档消失）就算已恢复 */
async function dismissCurtain(tabId: number): Promise<boolean> {
  const reply = await sendCurtain(tabId, { t: 'curtainDismiss' });
  return reply ? reply.covered === false : true;
}

/** 底部两个入口：都关掉面板再开新标签页 */
async function openPage(path: `/management.html${string}` | `/settings.html${string}`) {
  await browser.tabs.create({ url: browser.runtime.getURL(path) });
  window.close();
}

function manage() {
  void openPage('/management.html#/sites');
}

function openSettings() {
  void openPage('/settings.html');
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
/* 底部一行两个入口：视觉上明显弱于主按钮，但仍要够点（高度不小于 24px） */
.links {
  display: flex;
  gap: var(--pm-space-2);
}
.links > .link {
  flex: 1;
  min-height: 24px;
  padding: 2px 6px;
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
}
.links > .link:hover:not(:disabled) {
  color: var(--pm-fg);
}
</style>
