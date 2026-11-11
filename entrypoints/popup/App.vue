<template>
  <!-- 界面在 ui/popup/PopupBody.vue（#103）：欢迎页复用同一份，手抄的示意图不会再有 -->
  <PopupBody
    :phase="phase"
    :unsupported-reason="supported.reason || ''"
    :host="host"
    :has-profile="!!profile"
    :switch-on="profile?.switchState === 'disguised'"
    :empty-settings="!!profile && !hasSwitchEffect(profile)"
    :rule-summary="ruleSummary"
    :stale-count="staleCount"
    :message="message"
    :busy="busy"
    :covered="covered"
    :cover-shortcut="coverShortcut"
    :show-toggle="profile?.capsuleHidden !== true"
    :media="mediaToggles"
    :media-error="mediaError"
    :media-notice="mediaNotice"
    :delete-error="deleteError"
    @toggle-switch="toggleSwitch"
    @setup="setup"
    @edit-title="editTitle"
    @reauthorize="reauthorize"
    @toggle-curtain="toggleCurtain"
    @toggle-capsule="toggleCapsule"
    @toggle-media="toggleMedia"
    @delete-site="askDeleteSite"
  />

  <!-- 删除二次确认（#112）：与站点设置页 / 胶囊菜单同一套文案与焦点规则——
       「取消」默认聚焦，最终确认才是实心红；确认后弹窗关闭，失败留在原页给一行错误 -->
  <dialog
    ref="deleteDialog"
    class="popup-delete-dialog"
    aria-labelledby="pm-popup-delete-title"
    data-testid="pm-popup-delete-dialog"
    @close="onDeleteClose"
  >
    <h2 id="pm-popup-delete-title" data-testid="pm-popup-delete-title">{{ deleteTitle }}</h2>
    <p data-testid="pm-popup-delete-impact">{{ deleteImpact }}</p>
    <form method="dialog" class="dialog-actions">
      <button value="cancel" autofocus data-testid="pm-popup-delete-cancel">{{ t.common.cancel }}</button>
      <button value="confirm" class="primary danger" data-testid="pm-popup-delete-confirm" :disabled="deleteBusy">
        {{ deleteBusy ? t.popup.deleting : deleteAction }}
      </button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { t } from '@/ui/i18n';
import PopupBody from '@/ui/popup/PopupBody.vue';
import { createPageMaskStorage } from '@/core/storage';
import { mediaFlagPatch, type MediaFlagKey } from '@/core/media';
import { deleteSiteAction, deleteSiteImpact, deleteSiteTitle } from '@/core/site-delete';
import { formatShortcut, isMacPlatform } from '@/core/shortcut';
import { isSupportedPage } from '@/core/origin';
import { siteKey } from '@/core/site-key';
import { grantedPatternsOfSite } from '@/core/site-grant';
// 空设置判据（#158）：三处主开关共用一份，别在这里另算一遍
import { hasSwitchEffect } from '@/core/site-state';
import { siteLabelOf } from '@/entrypoints/management/site';
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
const busy = ref<'' | 'setup' | 'reauth' | 'toggle' | 'edit' | 'curtain' | 'delete'>('');
/** 失败时给用户看的话（不暴露内部错误）：存 code，文案从 t 里取（语言切换后跟着变） */
const errorCode = ref<string>('');
const message = computed(() => {
  const code = errorCode.value;
  if (!code) return '';
  const errors = t.value.popup.error as Record<string, string | undefined>;
  return errors[code] ?? errors.injectFailed ?? '';
});
/** 媒体开关写入失败时的一句话（显示在这一组下面，不占用顶部的通用错误位） */
const mediaError = ref('');
/** 页面没加载好但配置已建档（0.8.16，#154）：说明而非错误——下次打开页面灰度自动生效 */
const mediaNotice = ref('');
/** 开关当前值直接由配置投影，不在弹窗里另存一份状态 */
const mediaToggles = computed(() => ({
  mediaGray: profile.value?.mediaGray === true,
}));

const supported = computed(() => (tab.value?.url ? isSupportedPage(tab.value.url) : { ok: false, reason: '' }));
// 站点身份 = 可注册域名（#162）：weibo.com / s.weibo.com 是同一个网站
const site = computed(() => (tab.value?.url ? siteKey(tab.value.url) : null));
// 站点展示名与「全部网站设置」列表、悬浮按钮同一套规则（siteLabelOf：去 www、中文域名转回
// Unicode、非默认端口带上）——0.8.16 发版审查：弹窗只显 hostname 时，本地端口站点在列表里对不上号
const host = computed(() => (site.value ? siteLabelOf(site.value) : ''));
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
  if (!supported.value.ok || !site.value) return 'unsupported';
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
  const o = site.value;
  if (!o || !supported.value.ok) return;
  const storage = createPageMaskStorage(browser.storage.local);
  const [p, ok] = await Promise.all([
    storage.getProfile(o),
    grantedPatternsOfSite(browser, o)
      .then((list) => list.length > 0)
      .catch(() => false),
  ]);
  profile.value = p;
  granted.value = ok;
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
  if (!profile.value || !site.value) return;
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
    profile.value = await storage.updateProfile(site.value, (p) => {
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
  opts: { open?: OpenIntent; requestPermission?: boolean; initialMedia?: boolean } = {},
): Promise<EnableSiteResponse | undefined> {
  return browser.runtime
    .sendMessage({
      t: 'enableSite',
      origin: o,
      tabId,
      open: opts.open,
      requestPermission: opts.requestPermission,
      initialMedia: opts.initialMedia,
    })
    .catch(() => undefined);
}

/**
 * 主按钮「收起内容」（#81）：进点选流程。站点还没有配置时先请权限——权限框弹出会销毁 popup，
 * 请求由后台在用户手势的同一个回合里发起（见 core/background-engine.ts）
 */
function setup() {
  const o = site.value;
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
  const o = site.value;
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
  const o = site.value;
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
    // 撤的方向信页面：切换已发生，弹窗打开期间页面状态可能已被别处改过
    //（幕布不进存储，covered 是打开时的快照，拿旧意图比对会误报失败）
    if (wantRestore) {
      window.close();
      return;
    }
    if (covered.value) {
      window.close();
      return;
    }
    // 遮的方向没遮上（例如站点刚被删除，内容脚本遮不了）：走一次性注入兜底
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
  const first = await sendCurtain(tabId, { t: 'curtainCover' });
  if (first?.covered) return true;
  // 有应答但拒遮（比如向导开着）：到此为止——重新注入会让旧实例收尾、把用户正开着的向导关掉
  if (first) return false;
  const o = site.value;
  if (profile.value && granted.value && o) {
    if ((await enableSite(tabId, o))?.ok && (await sendCurtain(tabId, { t: 'curtainCover' }))?.covered) return true;
  }
  const res: { ok?: boolean } | undefined = await browser.runtime
    .sendMessage({ t: 'coverPage', tabId })
    .catch(() => undefined);
  return res?.ok === true;
}

/**
 * 右下角的小按钮开关（#112）：按站点记。
 * 关 = 这个网站不显示胶囊；开 = 显示，并重置为右下角 + 全功能——旧位置与形态是「藏起来之前」
 * 的残留，找回来时没有保留价值。一次 updateProfile 写完，touch:false（本机界面状态）。
 */
async function toggleCapsule(input: HTMLInputElement) {
  if (!profile.value || !site.value) {
    input.checked = true;
    return;
  }
  const show = input.checked;
  try {
    const updated = await createPageMaskStorage(browser.storage.local).updateProfile(
      site.value,
      (p) => {
        p.capsuleHidden = show ? undefined : true;
        if (show) {
          p.floatingBtnPos = null;
        }
      },
      { touch: false },
    );
    if (updated) profile.value = updated; // 开关立即反映；页面上的胶囊由内容脚本的存储监听卸下 / 挂上
    else input.checked = !show; // 配置刚好被删（updateProfile 返回 null）：拨回原位
  } catch {
    input.checked = !show; // 写入失败：开关拨回实际状态
  }
}

/**
 * 整页变灰开关：按站点记。
 * 还没配置过的网站（0.8.5，#134）：开 = 走第一次设置的授权流程，后台授权并注入后补一份
 * 只带灰度的配置——权限框会销毁 popup，所以流程整体交给后台，这里只负责发消息与善后；
 * 已配置的网站：一次只改拨动的那一个字段，写入失败就把开关拨回实际状态并给一句话。
 */
async function toggleMedia(key: MediaFlagKey, input: HTMLInputElement) {
  const o = site.value;
  const tabId = tab.value?.id;
  if (!o) {
    input.checked = false;
    return;
  }
  const on = input.checked;
  mediaError.value = '';
  mediaNotice.value = '';
  // 没配置过的网站：只有「打开」有意义（关一个不存在的设置是空操作）
  if (!profile.value) {
    if (!on || tabId === undefined || busy.value) {
      input.checked = false;
      return;
    }
    busy.value = 'toggle';
    try {
      const res = await enableSite(tabId, o, { requestPermission: true, initialMedia: true });
      if (!res?.ok) {
        if (res?.code === 'pageNotReady') {
          // 页面还在错误页等未加载好的状态（0.8.16，#154）：配置已照常建档，
          // 刷新后进入 ready 态（开关保持开），给一句说明而不是报错——
          // 等页面真正打开，灰度会自动生效（推特的失败场景：代理抖动下错误页很常见）
          await refresh();
          mediaNotice.value = t.value.popup.mediaNotReady;
          return;
        }
        input.checked = false;
        const errors = t.value.popup.error as Record<string, string | undefined>;
        mediaError.value = (res?.code && errors[res.code]) || errors.injectFailed || '';
        return;
      }
      await refresh(); // 配置已由后台补写：刷新后进入 ready 态（开关保持开、胶囊行出现）
    } finally {
      busy.value = '';
    }
    return;
  }
  try {
    const updated = await createPageMaskStorage(browser.storage.local).updateProfile(o, (p) => {
      Object.assign(p, mediaFlagPatch(key, on));
    });
    if (updated) profile.value = updated;
    else {
      input.checked = !on; // 配置刚好被删：拨回原位
      mediaError.value = t.value.media.saveFailed;
    }
  } catch {
    input.checked = !on; // 写入失败：拨回实际状态
    mediaError.value = t.value.media.saveFailed;
  }
}

// ---------- 删除这个网站的设置（#112） ----------

const deleteDialog = ref<HTMLDialogElement | null>(null);
const deleteBusy = ref(false);
const deleteError = ref('');
/** 文案与站点设置页 / 胶囊菜单同一份（core/site-delete.ts），不另写一套 */
const deleteTitle = computed(() => deleteSiteTitle(host.value || ''));
const deleteImpact = deleteSiteImpact();
const deleteAction = deleteSiteAction();

function askDeleteSite() {
  if (busy.value) return;
  deleteError.value = '';
  deleteDialog.value?.showModal();
}

/** 确认后发 resetSite：后台先让打开页面还原，再收回权限、删配置。成功关闭弹窗，失败留在原页 */
async function onDeleteClose() {
  const dialog = deleteDialog.value;
  const confirmed = dialog?.returnValue === 'confirm';
  if (dialog) dialog.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次（与管理页确认框同口径）
  if (!confirmed) return;
  const o = site.value;
  if (!o) return;
  busy.value = 'delete';
  deleteBusy.value = true;
  deleteError.value = '';
  try {
    const res = (await browser.runtime.sendMessage({ t: 'resetSite', origin: o }).catch(() => undefined)) as
      | { ok?: boolean }
      | undefined;
    if (res?.ok) {
      window.close();
      return;
    }
    deleteError.value = t.value.common.deleteSiteFailed; // 失败：弹窗留着，删除按钮上方一行错误
  } finally {
    deleteBusy.value = false;
    busy.value = '';
  }
}

</script>

<style>
/* 删除确认框在 320 宽的弹窗里（#112）：比全局对话框窄一档，不溢出弹窗 */
dialog.popup-delete-dialog {
  width: min(288px, calc(100vw - 24px));
  /* 内容超高时滚动只发生在框内，不连动到弹窗页面（0.8.17 WIG 审查） */
  overscroll-behavior: contain;
}
</style>
