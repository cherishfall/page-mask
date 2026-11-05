<template>
  <!-- 界面在 ui/popup/PopupBody.vue（#103）：欢迎页复用同一份，手抄的示意图不会再有 -->
  <PopupBody
    :phase="phase"
    :unsupported-reason="supported.reason || ''"
    :host="host"
    :has-profile="!!profile"
    :switch-on="profile?.switchState === 'disguised'"
    :rule-summary="ruleSummary"
    :stale-count="staleCount"
    :message="message"
    :busy="busy"
    :covered="covered"
    :cover-shortcut="coverShortcut"
    @toggle-switch="toggleSwitch"
    @setup="setup"
    @edit-title="editTitle"
    @reauthorize="reauthorize"
    @toggle-curtain="toggleCurtain"
    @manage="manage"
    @open-settings="openSettings"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { t } from '@/ui/i18n';
import PopupBody from '@/ui/popup/PopupBody.vue';
import { createPageMaskStorage } from '@/core/storage';
import { formatShortcut, isMacPlatform } from '@/core/shortcut';
import { isSupportedPage, normalizeOrigin } from '@/core/origin';
import { originPattern } from '@/core/registration';
import type { SiteProfile } from '@/core/types';
import type {
  CurtainCoverMsg,
  CurtainDismissMsg,
  CurtainStateMsg,
  CurtainStateReply,
  CurtainToggleMsg,
  EnableSiteResponse,
  OpenIntent,
  OpenWizardMsg,
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
  void refreshShortcut();
});

/** 幕布快捷键（#101）：显示当前平台的实际绑定，没绑定就不显示 */
const coverShortcut = ref('');

async function refreshShortcut() {
  try {
    const commands = await browser.commands.getAll();
    const shortcut = commands.find((c) => c.name === 'toggle-curtain')?.shortcut ?? '';
    coverShortcut.value = formatShortcut(shortcut, isMacPlatform());
  } catch {
    coverShortcut.value = '';
  }
}

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
  msg: CurtainStateMsg | CurtainCoverMsg | CurtainDismissMsg | CurtainToggleMsg,
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

async function toggleSwitch(input: HTMLInputElement) {
  if (!profile.value || !origin.value) return;
  // 上一个动作还没回来：忽略这一次拨动并拨回实际状态（不禁用开关，避免出现没有原因的禁用态）
  if (busy.value) {
    input.checked = profile.value.switchState === 'disguised';
    return;
  }
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

/**
 * 主按钮「收起内容」（#81）：进点选流程。站点还没有配置时先请权限——权限框弹出会销毁 popup，
 * 请求由后台在用户手势的同一个回合里发起（见 core/background-engine.ts）
 */
function setup() {
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined || busy.value) return;
  errorCode.value = '';
  busy.value = 'setup';
  void (async () => {
    try {
      const res = await enableSite(tabId, o, {
        open: 'editContent',
        requestPermission: !profile.value,
      });
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
 * 「标题和图标」入口（#81）：进单步小表单。站点还没有配置时先请权限再注入（同「收起内容」）；
 * 已配置的站点内容脚本可能还没在（页面刚打开、扩展刚更新）：发送失败时先让后台对账注入，再发一次
 */
async function editTitle() {
  const o = origin.value;
  const tabId = tab.value?.id;
  if (!o || tabId === undefined || busy.value) return;
  errorCode.value = '';
  busy.value = 'edit';
  try {
    if (!profile.value) {
      const res = await enableSite(tabId, o, { open: 'editTitle', requestPermission: true });
      if (!res?.ok) {
        errorCode.value = res?.code ?? 'injectFailed';
        return;
      }
    } else {
      const send = () => browser.tabs.sendMessage(tabId, { t: 'openWizard', mode: 'editTitle' } satisfies OpenWizardMsg);
      try {
        await send();
      } catch {
        if (!(await enableSite(tabId, o))?.ok) return;
        await send();
      }
    }
    window.close();
  } catch {
    errorCode.value = 'editFailed';
  } finally {
    busy.value = '';
  }
}

/**
 * 遮住 / 恢复开关（#54、#107）：一条 curtainToggle 交给页面控制器，方向由页面决定，
 * 回复的是动作执行后的状态——不再「先读状态、再发动作」两步，两步之间状态不会变化。
 * 成功后面板关闭——拖走视线的那一步不该再留一个窗口在屏幕上。
 */
async function toggleCurtain() {
  const tabId = tab.value?.id;
  if (tabId === undefined || busy.value) return;
  const wantRestore = covered.value;
  errorCode.value = '';
  busy.value = 'curtain';
  try {
    const reply = await sendCurtain(tabId, { t: 'curtainToggle' });
    if (!reply) {
      // 没有接收方：页面里没有任何还活着的脚本。要恢复——幕布只活在页面里，文档一换就没了，算已恢复；
      // 要遮住——走兜底注入（未添加过的网站没有内容脚本）。
      if (wantRestore) {
        window.close();
        return;
      }
      if (!(await coverCurtain(tabId))) errorCode.value = 'coverFailed';
      else window.close();
      return;
    }
    covered.value = reply.covered === true;
    // 方向达成才算成功：遮的方向要真遮上，撤的方向要真撤掉
    if (reply.ok && (wantRestore ? !covered.value : covered.value)) {
      window.close();
      return;
    }
    if (wantRestore) {
      // 接收方还在却没撤掉：报错，面板留着让用户重试
      errorCode.value = 'restoreFailed';
      return;
    }
    // 页面控制器没遮上（例如站点刚被删除，内容脚本遮不了）：走一次性注入兜底
    if (!(await coverCurtain(tabId))) errorCode.value = 'coverFailed';
    else window.close();
  } finally {
    busy.value = '';
  }
}

/**
 * 遮住当前标签页，两条路径按站点状态分流（curtainToggle 没有接收方时的兜底）：
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

