/**
 * 内容脚本运行时：生命周期编排。
 * - 已配置站点伪装态：请求后台注入隐藏样式（方案A/B）+ 标题/图标伪装 + 体检 +
 *   方案C遮罩覆盖层 + 悬浮按钮
 * - 原样态：完全还原（样式、标题、图标、遮罩），悬浮按钮保留（切回入口）
 * - storage.onChanged 驱动同站多标签页联动；SPA 路由变化重评估生效范围
 *
 * 时序（脚本以 document_start 启动，页面还没开始解析）：
 * 1. 首屏防闪：立即整页透明（first-paint-shield，ADR-0005）并请求正式隐藏样式；读到配置后立即压标题、
 *    遮挡换成精确规则；后台确认正式样式（用户样式表）已注入后撤掉遮挡
 * 2. 遮罩、体检、悬浮按钮等依赖 DOM 的部分等 DOMContentLoaded；预渲染页面还要等到被激活
 * 3. bfcache 恢复（pageshow.persisted）、预渲染激活（prerenderingchange）后按存储重新同步
 *
 * 隐藏样式的注入记录由本文档持有（core/doc-styles.ts），同一文档的所有状态刷新串行执行。
 *
 * 入口核对（REVIEW B28）：注册的匹配模式不写端口时会命中该主机的所有端口，所以启动后先按
 * location.origin 读站点配置；没有配置（也不是新站点向导）就撤掉首屏遮挡、什么都不挂，保持休眠。
 * 生命周期：一键清空前后台发 siteReset，本页立即移除样式、还原标题图标、卸载所有界面；
 * 新站点首次向导取消时通知后台收回授权（cancelNewSite）。
 */
import { createApp, type App } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage, profileKey } from '@/core/storage';
import { TitleFaviconGuard, effectiveTitle } from '@/core/disguise';
import { probeRules } from '@/core/health';
import { buildDisguiseCss, maskRulesAt } from '@/core/css-builder';
import { createDocStyles } from '@/core/doc-styles';
import type { Ack, BgRequest, CssAck, OpenIntent } from '@/core/messages';
import type { GlobalSettings, SiteProfile } from '@/core/types';
import FloatingToggle from './FloatingToggle.vue';
import WizardApp from './wizard/WizardApp.vue';
import EditorPanel from './editor/EditorPanel.vue';
import { ElementFollower } from './follow';
import { adoptPageMaskStyles } from './shadow-styles';
import { createFirstPaintShield } from './first-paint-shield';

const TOGGLE_HOST_ID = 'pagemask-floating-host';
const WIZARD_HOST_ID = 'pagemask-wizard-host';
const EDITOR_HOST_ID = 'pagemask-editor-host';
const MASK_HOST_ID = 'pagemask-mask-host';

/** DOM 解析完成（document_start 启动时 body 还不存在） */
function whenDomReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
}

/** 预渲染页面被激活（用户真正打开它）；非预渲染页面立即完成 */
function whenActivated(): { prerendering: boolean; activated: Promise<void> } {
  const doc = document as Document & { prerendering?: boolean };
  if (!doc.prerendering) return { prerendering: false, activated: Promise.resolve() };
  return {
    prerendering: true,
    activated: new Promise((resolve) =>
      document.addEventListener('prerenderingchange', () => resolve(), { once: true }),
    ),
  };
}

function warnIfFailed(what: string, res: CssAck): void {
  // 页内没有统一的提示位置；至少不静默吞掉，便于排查（向导预览失败另有可见提示）
  if (!res.ok) console.warn(`[PageMask] ${what}未生效：${res.error ?? '未知原因'}`);
}

/** 登记在隔离环境 window.__pagemask 上的句柄（entrypoints/content.ts、后台 enableSite 使用） */
export interface ContentRuntimeHandle {
  /** 打开设置向导；新站点（还没有配置）只能用 newSite。返回是否受理 */
  open(mode: OpenIntent): boolean;
  /** 本运行时所属的扩展上下文是否仍有效（扩展更新 / 重载后为 false） */
  alive(): boolean;
  /** 撤掉本运行时留在页面上的一切（只动 DOM，失联后也能调用） */
  dispose(): void;
}

export function initContentRuntime(): ContentRuntimeHandle {
  const origin = location.origin;
  const storage = createPageMaskStorage(browser.storage.local);
  const guard = new TitleFaviconGuard(document);
  const follower = new ElementFollower();
  // 必须最先执行：在页面开始解析前挡住首帧
  const shield = createFirstPaintShield(document);
  const styles = createDocStyles((m: BgRequest) => browser.runtime.sendMessage(m));
  const { prerendering, activated } = whenActivated();
  /** 依赖 DOM / 需要页面已被用户打开的部分（遮罩、体检回写、悬浮按钮）在此之后进行 */
  const uiReady = Promise.all([whenDomReady(), activated]).then(() => undefined);

  let profile: SiteProfile | null = null;
  let settings: GlobalSettings = { defaultTitle: null }; // null = 跟随界面语言默认（core/titles.ts）
  let host: HTMLDivElement | null = null;
  let app: App | null = null;
  let wizardHost: HTMLDivElement | null = null;
  let wizardApp: App | null = null;
  let editorHost: HTMLDivElement | null = null;
  let editorApp: App | null = null;
  let maskHost: HTMLDivElement | null = null;
  let wizardActive = false;
  /** 入口核对通过（本页有站点配置或正在进行新站点向导），已挂上监听 */
  let active = false;
  /** 入口核对（读配置）是否已完成；完成前到来的打开请求先记下 */
  let gateDone = false;
  let pendingOpen: OpenIntent | null = null;
  /** 收到 siteReset 后、配置真正删除前：不再按存储重新应用（避免体检回写等把样式注回来） */
  let resetting = false;
  let disposed = false;
  let spaTimer: ReturnType<typeof setInterval> | null = null;
  let lastHref = location.href;
  let lastHealthFingerprint = '';

  // ---------- 悬浮按钮 ----------

  function mountToggle() {
    if (host) {
      syncToggleProps();
      return;
    }
    host = document.createElement('div');
    host.id = TOGGLE_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    // 共享 tokens 样式（示例接入；向导 / 编辑面板的接入与硬编码颜色替换见 #25）
    adoptPageMaskStyles(shadow);
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(host);
    app = createApp(FloatingToggle, {
      state: profile?.switchState ?? 'original',
      position: profile?.floatingBtnPos ?? null,
      onToggle: handleToggle,
      onMoved: handleMoved,
      onEdit: handleEdit,
      onResetPos: handleResetPos,
    });
    app.mount(mountPoint);
  }

  function syncToggleProps() {
    // 简单可靠：卸载重建（按钮极小，无感知）
    unmountToggle();
    mountToggle();
  }

  function unmountToggle() {
    app?.unmount();
    app = null;
    host?.remove();
    host = null;
  }

  async function handleToggle() {
    if (!profile) return;
    // 目标态取自按钮当前显示的状态的反面；只改开关字段（按站点记忆 + onChanged 联动所有标签页）
    const target = profile.switchState === 'disguised' ? 'original' : 'disguised';
    profile.switchState = target;
    await storage.updateProfile(origin, (p) => {
      p.switchState = target;
    });
  }

  async function handleMoved(pos: { x: number; y: number }) {
    if (!profile) return;
    profile.floatingBtnPos = pos;
    // 坐标是本机界面状态，不算用户修改设置
    await storage.updateProfile(
      origin,
      (p) => {
        p.floatingBtnPos = pos;
      },
      { touch: false },
    );
  }

  async function handleResetPos() {
    if (!profile) return;
    profile.floatingBtnPos = null;
    await storage.updateProfile(
      origin,
      (p) => {
        p.floatingBtnPos = null;
      },
      { touch: false },
    );
    syncToggleProps();
  }

  function handleEdit() {
    openEditorPanel();
  }

  // ---------- 方案C 遮罩覆盖层 ----------

  function ensureMaskHost(): HTMLDivElement {
    if (maskHost) return maskHost;
    maskHost = document.createElement('div');
    maskHost.id = MASK_HOST_ID;
    Object.assign(maskHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483644',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.documentElement.appendChild(maskHost);
    return maskHost;
  }

  function clearMasks(): void {
    follower.stop();
    maskHost?.remove();
    maskHost = null;
  }

  /** 方案C遮罩：对当前页面生效的每条 mask 规则，给命中元素盖上不透明贴纸（滚动跟手） */
  function rebuildMasks(): void {
    clearMasks();
    if (!profile || profile.switchState !== 'disguised') return;
    const rules = maskRulesAt(profile.hideRules, location.href);
    if (rules.length === 0) return;
    const mh = ensureMaskHost();
    const seen = new Set<Element>();
    for (const rule of rules) {
      for (const sel of rule.candidates) {
        let els: NodeListOf<Element>;
        try {
          els = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        for (const el of Array.from(els)) {
          if (seen.has(el)) continue;
          seen.add(el);
          const box = document.createElement('div');
          Object.assign(box.style, {
            position: 'fixed',
            background: '#f4f4f4',
            boxSizing: 'border-box',
          } as Partial<CSSStyleDeclaration>);
          mh.appendChild(box);
          follower.trackLive(el, box);
        }
      }
    }
  }

  // ---------- 编辑面板 / 向导 ----------

  function closeEditorPanel(): void {
    editorApp?.unmount();
    editorApp = null;
    editorHost?.remove();
    editorHost = null;
  }

  /** 悬浮按钮右键 → 编辑伪装。改动直接写库，storage 变化即时重应用＝即时预览 */
  function openEditorPanel(): void {
    if (!profile || wizardActive || editorHost) return;
    editorHost = document.createElement('div');
    editorHost.id = EDITOR_HOST_ID;
    Object.assign(editorHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    const shadow = editorHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(editorHost);
    editorApp = createApp(EditorPanel, {
      origin,
      url: location.href,
      onClose: closeEditorPanel,
      onAddElement: () => {
        closeEditorPanel();
        void openWizard('addElement');
      },
      onReselect: (ruleId: string) => {
        // 重选元素 = 删除旧规则 + 进向导重新点选（v1 简化，记 DEVLOG）
        if (!profile) return;
        profile.hideRules = profile.hideRules.filter((r) => r.id !== ruleId);
        void storage.updateProfile(origin, (p) => {
          p.hideRules = p.hideRules.filter((r) => r.id !== ruleId);
        });
        closeEditorPanel();
        void openWizard('addElement');
      },
    });
    editorApp.mount(mountPoint);
  }

  function closeWizard(): void {
    wizardApp?.unmount();
    wizardApp = null;
    wizardHost?.remove();
    wizardHost = null;
    wizardActive = false;
  }

  /**
   * 打开设置向导：伪装态先临时还原全部规则再进入，退出后恢复（design.md 核心流程）。
   * 新站点（还没有配置）只能以 newSite 打开：保存时才写入配置；取消则通知后台收回授权。
   */
  async function openWizard(mode: OpenIntent) {
    if (wizardActive) return;
    // 排在进行中的状态刷新之后再判断（刚激活时配置可能还在读）
    await exclusive(async () => undefined);
    if (wizardActive || resetting || (!profile && mode !== 'newSite')) return;
    wizardActive = true;
    closeEditorPanel();

    // 排在进行中的状态刷新之后，避免刷新在向导打开后又把正式样式注回去
    await exclusive(async () => {
      warnIfFailed('临时还原', await styles.clearFormal());
      guard.restore();
      clearMasks();
    });
    unmountToggle();

    wizardHost = document.createElement('div');
    wizardHost.id = WIZARD_HOST_ID;
    Object.assign(wizardHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none', // 覆盖层自身穿透，页面照常交互；交互元素自行恢复 pointer-events
    } as Partial<CSSStyleDeclaration>);
    const shadow = wizardHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(wizardHost);

    wizardApp = createApp(WizardApp, {
      mode,
      url: location.href,
      // 预览样式同样按本文档记录（SW 回收后点「放弃」也能撤掉）
      setDraft: (css: string | null) => styles.setDraft(css),
      onDone: (saved?: boolean) => {
        closeWizard();
        if (!saved && mode === 'newSite' && !profile) {
          // 新站点首次向导被取消：还没写过配置，请后台收回刚给的授权（后台会再核对一次确实没有配置）
          void browser.runtime.sendMessage({ t: 'cancelNewSite' } satisfies BgRequest).catch(() => undefined);
        }
        // 保存路径已写入 storage；这里统一按当前配置恢复（保存触发 onChanged 但被向导屏蔽）
        void scheduleRefresh();
      },
    });
    wizardApp.mount(mountPoint);
  }

  // ---------- 伪装应用 / 还原 ----------

  /** 正式样式以存储为准：后台按配置与本页地址计算（原样态 / 范围外即移除） */
  async function syncFormalStyles(): Promise<void> {
    warnIfFailed('隐藏样式', await styles.syncFormal());
  }

  async function applyAll(): Promise<void> {
    if (!profile) return;
    // 先压标题、首屏遮挡换成精确规则（都不等后台往返），再同步正式样式
    guard.apply(effectiveTitle(profile, settings), profile.faviconDataUrl);
    shield.narrow(buildDisguiseCss(profile.hideRules, location.href));
    await syncFormalStyles();
    shield.release();
    await uiReady;
    if (!profile || profile.switchState !== 'disguised' || wizardActive) return;
    rebuildMasks();
    await runHealthCheck();
    mountToggle();
  }

  async function restoreAll(): Promise<void> {
    shield.release();
    guard.restore();
    clearMasks();
    await syncFormalStyles();
    await uiReady;
    if (!profile || wizardActive) return;
    mountToggle();
  }

  /** 体检：仅伪装态下采集（原样态规则本就不应用，只会假警报） */
  async function runHealthCheck(): Promise<void> {
    if (!profile || profile.switchState !== 'disguised') return;
    const results = probeRules(profile.hideRules, location.href, (sel) => {
      try {
        return document.querySelectorAll(sel).length;
      } catch {
        return 0;
      }
    });
    let changed = false;
    const now = Date.now();
    for (const { rule, status } of results) {
      if (rule.lastHealth !== status) {
        rule.lastHealth = status;
        rule.lastHealthAt = now;
        changed = true;
      }
    }
    const fp = JSON.stringify(profile.hideRules.map((r) => [r.id, r.lastHealth]));
    if (changed && fp !== lastHealthFingerprint) {
      lastHealthFingerprint = fp;
      // 只回写健康字段：不会覆盖期间在 popup/管理页改过的开关、规则
      await storage.updateRuleHealth(
        origin,
        results.map(({ rule, status }) => ({ id: rule.id, status })),
        now,
      );
    }
  }

  // ---------- 状态刷新 ----------

  /** 同一文档的状态刷新与向导入口串行执行（一条 promise 链） */
  let exclusiveChain: Promise<unknown> = Promise.resolve();
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = exclusiveChain.then(fn);
    exclusiveChain = run.catch((e: unknown) => console.warn('[PageMask] 状态刷新出错', e));
    return run;
  }

  function scheduleRefresh(): Promise<void> {
    return exclusive(refreshState);
  }

  /** 撤掉页面上的一切痕迹（不含向导；样式另行移除） */
  function clearPageUi(): void {
    shield.release();
    unmountToggle();
    closeEditorPanel();
    guard.restore();
    clearMasks();
  }

  async function refreshState(): Promise<void> {
    if (wizardActive) return; // 向导期间不动样式，退出时会再刷新
    const [p, s] = await Promise.all([storage.getProfile(origin), storage.getSettings()]);
    settings = s;
    if (wizardActive) return;
    if (!p) {
      // 站点被一键清空（或新站点向导取消）：撤掉一切痕迹
      resetting = false;
      profile = null;
      clearPageUi();
      await syncFormalStyles();
      return;
    }
    if (resetting) return;
    profile = p;
    if (profile.switchState === 'disguised') {
      await applyAll();
    } else {
      await restoreAll();
    }
  }

  /** 一键清空：后台收回授权前先让本页还原（此时样式还删得掉），完成后回复 */
  async function handleSiteReset(): Promise<Ack> {
    resetting = true;
    await exclusive(async () => {
      closeWizard();
      profile = null;
      clearPageUi();
      const draft = await styles.setDraft(null);
      const formal = await styles.clearFormal();
      warnIfFailed('还原', formal.ok ? draft : formal);
    });
    return { ok: true };
  }

  // ---------- 激活：入口核对通过后才挂监听 ----------

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  function onStorageChanged(changes: Record<string, unknown>, area: string): void {
    // storage 变化驱动：开关切换、规则增删改、标题/图标修改、健康状态回写。
    // 向导打开期间屏蔽（避免向导内的临时状态被真样式覆盖），退出时统一 refreshState
    if (area !== 'local' || wizardActive) return;
    const keys = Object.keys(changes);
    if (!keys.some((k) => k === profileKey(origin) || k === 'settings')) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void scheduleRefresh(), 150);
  }

  function onPageShow(e: PageTransitionEvent): void {
    // bfcache 恢复：样式随文档一起被保存，但期间存储可能变了（另一个页面切了开关、改了规则），按新状态增删
    if (e.persisted) void scheduleRefresh();
  }

  function onRuntimeMessage(
    msg: { t?: string; mode?: OpenIntent },
    _sender: unknown,
    sendResponse: (r: Ack) => void,
  ): boolean {
    // popup / 后台触发的入口消息
    if (msg?.t === 'openWizard') void openWizard(msg.mode ?? 'addElement');
    else if (msg?.t === 'openEditor') openEditorPanel();
    else if (msg?.t === 'siteReset') {
      void handleSiteReset().then(sendResponse, () => sendResponse({ ok: false }));
      return true; // 异步回复：后台等本页还原完再收回授权
    }
    return false;
  }

  function activate(): void {
    if (active || disposed) return;
    active = true;
    browser.storage.onChanged.addListener(onStorageChanged);
    // SPA 路由变化：重评估每条规则的生效范围（微信读书翻页等场景）；向导期间屏蔽
    spaTimer = setInterval(() => {
      if (wizardActive) return;
      if (location.href !== lastHref && profile?.switchState === 'disguised') {
        lastHref = location.href;
        void scheduleRefresh();
      } else {
        lastHref = location.href;
      }
    }, 1000);
    window.addEventListener('pageshow', onPageShow);
    // 预渲染激活：预渲染期间已注入样式、压过标题（激活瞬间不闪），激活后再按最新状态同步一次并挂界面
    if (prerendering) void activated.then(() => scheduleRefresh());
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    void scheduleRefresh();
  }

  // 首屏防闪：不等读配置，立即请求正式样式（未配置 / 原样态 / 端口不符时后台什么也不插）
  void syncFormalStyles();

  // 入口核对：本页来源有站点配置才激活；否则撤掉首屏遮挡，保持休眠（不挂任何界面和监听）
  void (async () => {
    let configured = false;
    try {
      configured = !!(await storage.getProfile(origin));
    } catch {
      // 读不到存储（扩展上下文已失效）按未配置处理
    }
    gateDone = true;
    if (disposed) return;
    if (configured || pendingOpen) activate();
    else shield.release();
    if (pendingOpen) {
      const mode = pendingOpen;
      pendingOpen = null;
      void openWizard(mode);
    }
  })();

  return {
    open(mode) {
      if (disposed) return false;
      if (!gateDone) {
        pendingOpen = mode;
        return true;
      }
      activate();
      void openWizard(mode);
      return true;
    },
    alive() {
      try {
        return !disposed && !!browser.runtime?.id;
      } catch {
        return false;
      }
    },
    dispose() {
      disposed = true;
      if (spaTimer) clearInterval(spaTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('pageshow', onPageShow);
      try {
        browser.storage.onChanged.removeListener(onStorageChanged);
        browser.runtime.onMessage.removeListener(onRuntimeMessage);
      } catch {
        // 扩展上下文已失效
      }
      closeWizard();
      clearPageUi();
    },
  };
}
