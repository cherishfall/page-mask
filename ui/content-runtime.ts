/**
 * 内容脚本运行时：生命周期编排。
 * - 已配置站点伪装态：请求后台注入隐藏样式（方案A/B）+ 标题/图标伪装 + 体检 +
 *   方案C遮罩覆盖层 + 悬浮按钮
 * - 原样态：完全还原（样式、标题、图标、遮罩），悬浮按钮保留（切回入口）
 * - storage.onChanged 驱动同站多标签页联动；SPA 路由变化（WXT `wxt:locationchange`）立即重评估生效范围
 *
 * 时序（脚本以 document_start 启动，页面还没开始解析）：
 * 1. 首屏防闪：立即整页透明（first-paint-shield，ADR-0005）并请求正式隐藏样式；读到配置后立即压标题、
 *    遮挡换成精确规则；后台确认正式样式（用户样式表）已注入后撤掉遮挡
 * 2. 遮罩、体检、悬浮按钮等依赖 DOM 的部分等 DOMContentLoaded；预渲染页面还要等到被激活
 * 3. bfcache 恢复（pageshow.persisted）、预渲染激活（prerenderingchange）后按存储重新同步
 *
 * 用户样式表（正式隐藏样式、向导预览样式、宿主保护样式）的注入记录由本文档持有（core/doc-styles.ts），
 * 同一文档的所有状态刷新串行执行。
 *
 * 生命周期（#22，WXT ContentScriptContext）：
 * - 所有监听、定时器、空闲回调交给 ctx 托管；ctx 失效（扩展更新 / 重载后失联，或同一脚本被再次注入）
 *   时 teardown：断开标题守卫并还原标题图标、撤下全部页内界面、冻结样式记录交给接替的新实例
 *   （entrypoints/content.ts），不留僵尸按钮，也不会和新实例互相改标题
 * - 失联没有任何事件通知：标题守卫每次要补刀、页面重新可见、点悬浮按钮时读一次 ctx.isValid
 *   （WXT 在 runtime.id 消失时就地触发失效）；扩展更新后后台还会向已打开页面重新注入新脚本
 *
 * 入口核对（REVIEW B28）：注册的匹配模式不写端口时会命中该主机的所有端口，所以启动后先按
 * location.origin 读站点配置；没有配置（也不是新站点向导）就撤掉首屏遮挡、什么都不挂，保持休眠。
 * 一键清空前后台发 siteReset，本页立即移除样式、还原标题图标、卸载所有界面；
 * 新站点首次向导取消时通知后台收回授权（cancelNewSite）。
 */
import { createApp, h, reactive, type App } from 'vue';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPageMaskStorage, profileKey } from '@/core/storage';
import { TitleFaviconGuard, effectiveTitle } from '@/core/disguise';
import { countPageHits, probeRules, runHealthCheck } from '@/core/health';
import { buildDisguiseCss, maskRulesAt } from '@/core/css-builder';
import { createDocStyles, type StyleRecord } from '@/core/doc-styles';
import { applyKey } from '@/core/apply-key';
import { TAKEOVER_EVENT, hostShieldPresent } from '@/core/host-shield';
import type { Ack, BgRequest, CssAck, OpenIntent } from '@/core/messages';
import type { GlobalSettings, SiteProfile } from '@/core/types';
import FloatingToggle from './FloatingToggle.vue';
import WizardApp from './wizard/WizardApp.vue';
import EditorPanel from './editor/EditorPanel.vue';
import { MaskLayer } from './mask-layer';
import { createPageHost, type PageHost } from './page-host';
import { createFirstPaintShield } from './first-paint-shield';

/** DOM 解析完成（document_start 启动时 body 还不存在） */
function whenDomReady(ctx: ContentScriptContext): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) =>
    ctx.addEventListener(document, 'DOMContentLoaded', () => resolve(), { once: true }),
  );
}

/** 预渲染页面被激活（用户真正打开它）；非预渲染页面立即完成 */
function whenActivated(ctx: ContentScriptContext): { prerendering: boolean; activated: Promise<void> } {
  const doc = document as Document & { prerendering?: boolean };
  if (!doc.prerendering) return { prerendering: false, activated: Promise.resolve() };
  return {
    prerendering: true,
    activated: new Promise((resolve) =>
      ctx.addEventListener(document, 'prerenderingchange' as keyof DocumentEventMap, () => resolve(), { once: true }),
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
  /** 本运行时是否仍有效（扩展更新 / 重载后、被新注入的实例取代后为 false） */
  alive(): boolean;
  /**
   * 交出本文档的用户样式表记录（接替的新实例调用）：本实例随即收尾（若还没有），
   * 等进行中的样式请求结束后返回记录，之后本实例不再发出任何样式请求
   */
  handover(): Promise<StyleRecord>;
}

/** 体检时序（core/health.ts runHealthCheck）：首次宽限、确认前间隔、空闲回调最长等待 */
const HEALTH_FIRST_DELAY_MS = 3000;
const HEALTH_CONFIRM_DELAY_MS = 5000;
const HEALTH_IDLE_TIMEOUT_MS = 2000;

export function initContentRuntime(ctx: ContentScriptContext, takeover?: Promise<StyleRecord | undefined>): ContentRuntimeHandle {
  const origin = location.origin;
  // 扩展更新 / 重载后被重新注入：新旧实例不在同一个隔离环境（实测），旧实例交不出样式记录。
  // 先看本文档里有没有旧实例注入的宿主保护样式（有 = 之前有实例在这里工作过，样式要接手），
  // 再广播接管事件：失联的旧实例收到后读 isValid，随即收尾（撤下界面、还原标题图标）
  const inheritedOrphanCss = !takeover && document.readyState !== 'loading' && hostShieldPresent(document);
  document.dispatchEvent(new Event(TAKEOVER_EVENT));
  ctx.addEventListener(document, TAKEOVER_EVENT as keyof DocumentEventMap, () => void ctx.isValid);
  const storage = createPageMaskStorage(browser.storage.local);
  const guard = new TitleFaviconGuard(document, {
    // 读 isValid 本身就会在扩展失联时触发 ctx 失效 → teardown（标题还原为站点最新写入的值）
    isAlive: () => ctx.isValid,
    setTimer: (fn, ms) => {
      const id = ctx.setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  });
  // 方案C遮罩覆盖层：重扫定时器交给 ctx 托管（失效后不再触发）
  const masks = new MaskLayer({
    createHost: () => createPageHost(ctx, 'mask'),
    schedule: (fn, ms) => {
      const id = ctx.setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  });
  // 必须最先执行：在页面开始解析前挡住首帧
  const shield = createFirstPaintShield(document);
  const styles = createDocStyles((m: BgRequest) => browser.runtime.sendMessage(m), takeover);
  const { prerendering, activated } = whenActivated(ctx);
  /** 依赖 DOM / 需要页面已被用户打开的部分（遮罩、体检回写、悬浮按钮）在此之后进行 */
  const uiReady = Promise.all([whenDomReady(ctx), activated]).then(() => undefined);

  let profile: SiteProfile | null = null;
  let settings: GlobalSettings = { defaultTitle: null }; // null = 跟随界面语言默认（core/titles.ts）
  /** 悬浮按钮的显示状态：存储变化只改这里（响应式更新，不卸载重建，REVIEW N26） */
  const toggleState = reactive<{ state: SiteProfile['switchState']; position: SiteProfile['floatingBtnPos'] }>({
    state: 'original',
    position: null,
  });
  /**
   * 编辑面板看的「当前页面地址」：SPA 换页后跟着变，面板里「本页生效的规则」随之刷新（N4）。
   * 传一个响应式对象而不是字符串——手动 createApp 不会重渲染根组件，字符串快照永远停在打开那一刻
   */
  const pageState = reactive<{ url: string }>({ url: location.href });
  let toggleHost: PageHost | null = null;
  let toggleApp: App | null = null;
  let wizardHost: PageHost | null = null;
  let wizardApp: App | null = null;
  let editorHost: PageHost | null = null;
  let editorApp: App | null = null;
  let wizardActive = false;
  /** 入口核对通过（本页有站点配置或正在进行新站点向导），已挂上监听 */
  let active = false;
  /** 入口核对（读配置）是否已完成；完成前到来的打开请求先记下 */
  let gateDone = false;
  let pendingOpen: OpenIntent | null = null;
  /** 收到 siteReset 后、配置真正删除前：不再按存储重新应用（避免体检回写等把样式注回来） */
  let resetting = false;
  let disposed = false;
  /** 上次整页应用时的判据（core/apply-key.ts）；null = 下次必须重新应用 */
  let appliedKey: string | null = null;
  /** 体检代次：路由变化、切原样、进向导、收尾时加一，进行中的体检随之作废 */
  let healthGen = 0;
  let handoverRecord: Promise<StyleRecord> | null = null;

  // ---------- 宿主保护样式 ----------

  /** 页内界面出现前确保宿主保护样式在（幂等，串行在样式链上） */
  function ensureHostShield(): void {
    void styles.syncShield(true).then((r) => warnIfFailed('界面保护样式', r));
  }

  // ---------- 悬浮按钮 ----------

  function syncToggleState(): void {
    toggleState.state = profile?.switchState ?? 'original';
    toggleState.position = profile?.floatingBtnPos ?? null;
  }

  function mountToggle(): void {
    syncToggleState();
    if (toggleHost) return;
    ensureHostShield();
    toggleHost = createPageHost(ctx, 'toggle');
    // 根组件只是一层渲染函数：toggleState 变了按钮就地更新
    toggleApp = createApp({
      render: () =>
        h(FloatingToggle, {
          state: toggleState.state,
          position: toggleState.position,
          onToggle: handleToggle,
          onMoved: handleMoved,
          onEdit: handleEdit,
          onResetPos: handleResetPos,
        }),
    });
    toggleApp.mount(toggleHost.root);
  }

  function unmountToggle(): void {
    toggleApp?.unmount();
    toggleApp = null;
    toggleHost?.remove();
    toggleHost = null;
  }

  async function handleToggle() {
    if (!profile || !ctx.isValid) return; // 扩展已失联：读 isValid 即触发收尾，按钮随之消失
    // 目标态取自按钮当前显示的状态的反面；只改开关字段（按站点记忆 + onChanged 联动所有标签页）
    const target = profile.switchState === 'disguised' ? 'original' : 'disguised';
    profile.switchState = target;
    syncToggleState();
    await storage.updateProfile(origin, (p) => {
      p.switchState = target;
    });
  }

  async function handleMoved(pos: { x: number; y: number }) {
    if (!profile || !ctx.isValid) return;
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
    if (!profile || !ctx.isValid) return;
    profile.floatingBtnPos = null;
    syncToggleState();
    await storage.updateProfile(
      origin,
      (p) => {
        p.floatingBtnPos = null;
      },
      { touch: false },
    );
  }

  function handleEdit() {
    if (ctx.isValid) openEditorPanel();
  }

  // ---------- 方案C 遮罩覆盖层 ----------

  function clearMasks(): void {
    masks.clear();
  }

  /**
   * 方案C遮罩：对当前页面生效的每条 mask 规则，给命中元素盖上与背后底色一致的不透明贴纸
   * （ui/mask-layer.ts：后加载元素自动补上、滚动跟手、静止停帧、遮罩下不可点）。只在清爽态调用
   */
  function rebuildMasks(): void {
    clearMasks();
    if (!profile || profile.switchState !== 'disguised') return;
    const selectors = maskRulesAt(profile.hideRules, location.href).flatMap((r) => r.candidates);
    if (selectors.length === 0) return;
    ensureHostShield();
    masks.show(selectors);
  }

  // ---------- 编辑面板 / 向导 ----------

  function closeEditorPanel(): void {
    editorApp?.unmount();
    editorApp = null;
    editorHost?.remove();
    editorHost = null;
  }

  /** 悬浮按钮菜单 → 编辑规则。改动直接写库，storage 变化即时重应用＝即时预览 */
  function openEditorPanel(): void {
    if (!profile || wizardActive || editorHost || disposed) return;
    ensureHostShield();
    pageState.url = location.href;
    editorHost = createPageHost(ctx, 'editor');
    editorApp = createApp(EditorPanel, {
      origin,
      page: pageState,
      onClose: closeEditorPanel,
      onAddElement: () => {
        closeEditorPanel();
        void openWizard('addElement');
      },
      onReselect: (ruleId: string) => {
        // 重选元素：旧规则留到向导保存成功时再替换，取消向导不影响它（N5）
        closeEditorPanel();
        void openWizard('addElement', ruleId);
      },
    });
    editorApp.mount(editorHost.root);
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
   * replaceRuleId：重选元素时要在保存时替换掉的旧规则 id。
   */
  async function openWizard(mode: OpenIntent, replaceRuleId?: string) {
    if (wizardActive || disposed) return;
    // 排在进行中的状态刷新之后再判断（刚激活时配置可能还在读）
    await exclusive(async () => undefined);
    if (wizardActive || resetting || disposed || (!profile && mode !== 'newSite')) return;
    wizardActive = true;
    healthGen++;
    closeEditorPanel();

    // 排在进行中的状态刷新之后，避免刷新在向导打开后又把正式样式注回去
    await exclusive(async () => {
      warnIfFailed('临时还原', await styles.clearFormal());
      guard.restore();
      clearMasks();
      appliedKey = null; // 退出向导后必须重新应用
    });
    if (disposed || !wizardActive) return;
    unmountToggle();

    ensureHostShield();
    wizardHost = createPageHost(ctx, 'wizard');
    wizardApp = createApp(WizardApp, {
      mode,
      url: location.href,
      replaceRuleId: replaceRuleId ?? null,
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
    wizardApp.mount(wizardHost.root);
  }

  // ---------- 伪装应用 / 还原 ----------

  /** 正式样式以存储为准：后台按配置与本页地址计算（原样态 / 范围外即移除） */
  async function syncFormalStyles(): Promise<boolean> {
    const res = await styles.syncFormal(location.href);
    warnIfFailed('隐藏样式', res);
    return res.ok;
  }

  async function applyAll(): Promise<boolean> {
    if (!profile) return false;
    // 先压标题、首屏遮挡换成精确规则（都不等后台往返），再同步正式样式
    guard.apply(effectiveTitle(profile, settings), profile.faviconDataUrl);
    shield.narrow(buildDisguiseCss(profile.hideRules, location.href));
    const ok = await syncFormalStyles();
    shield.release();
    await uiReady;
    if (disposed || !profile || profile.switchState !== 'disguised' || wizardActive) return ok;
    rebuildMasks();
    mountToggle();
    scheduleHealthCheck();
    return ok;
  }

  async function restoreAll(): Promise<boolean> {
    healthGen++;
    shield.release();
    guard.restore();
    clearMasks();
    const ok = await syncFormalStyles();
    await uiReady;
    if (disposed || !profile || wizardActive) return ok;
    mountToggle();
    return ok;
  }

  // ---------- 体检 ----------

  /** 页面安定后体检（宽限 + 空闲回调，两次确认才判失效，core/health.ts）；仅伪装态 */
  function scheduleHealthCheck(): void {
    const gen = ++healthGen;
    const current = () => gen === healthGen && !disposed && !wizardActive && profile?.switchState === 'disguised';
    const settle = (ms: number) =>
      new Promise<boolean>((resolve) => {
        // ctx 托管：失效后定时器 / 空闲回调被取消，这个 promise 永远不会完成（体检随之作废）
        ctx.setTimeout(() => {
          if (!current()) return resolve(false);
          ctx.requestIdleCallback(() => resolve(current()), { timeout: HEALTH_IDLE_TIMEOUT_MS });
        }, ms);
      });
    void runHealthCheck(
      {
        settle,
        probe: () => (profile ? probeRules(profile.hideRules, location.href, (sel) => countPageHits(document, sel)) : []),
        // 只回写健康字段：不会覆盖期间在 popup/管理页改过的开关、规则；结论没变时不写
        report: async (results) => {
          if (current()) await storage.updateRuleHealth(origin, results);
        },
      },
      { firstDelayMs: HEALTH_FIRST_DELAY_MS, confirmDelayMs: HEALTH_CONFIRM_DELAY_MS },
    ).catch((e: unknown) => console.warn('[PageMask] 体检出错', e));
  }

  // ---------- 状态刷新 ----------

  /** 同一文档的状态刷新与向导入口串行执行（一条 promise 链） */
  let exclusiveChain: Promise<unknown> = Promise.resolve();
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = exclusiveChain.then(fn);
    exclusiveChain = run.catch((e: unknown) => console.warn('[PageMask] 状态刷新出错', e));
    return run;
  }

  /** force：即使判据没变也重新应用（bfcache 恢复、预渲染激活、退出向导） */
  function scheduleRefresh({ force = false } = {}): Promise<void> {
    if (force) appliedKey = null;
    return exclusive(refreshState);
  }

  /** 撤掉页面上的一切痕迹（不含向导；样式另行移除） */
  function clearPageUi(): void {
    healthGen++;
    shield.release();
    unmountToggle();
    closeEditorPanel();
    guard.restore();
    clearMasks();
    appliedKey = null;
  }

  async function refreshState(): Promise<void> {
    if (wizardActive || disposed) return; // 向导期间不动样式，退出时会再刷新
    const [p, s] = await Promise.all([storage.getProfile(origin), storage.getSettings()]);
    settings = s;
    if (wizardActive || disposed) return;
    if (!p) {
      // 站点被一键清空（或新站点向导取消）：撤掉一切痕迹
      resetting = false;
      profile = null;
      clearPageUi();
      await syncFormalStyles();
      warnIfFailed('界面保护样式', await styles.syncShield(false));
      return;
    }
    if (resetting) return;
    profile = p;
    syncToggleState();
    // 只有体检回写、按钮坐标变化时页面效果不变：只更新按钮，不整页重应用（原样态与地址无关）
    const key = applyKey(p, s, p.switchState === 'disguised' ? location.href : '');
    if (key === appliedKey) return;
    appliedKey = key;
    const ok = p.switchState === 'disguised' ? await applyAll() : await restoreAll();
    if (!ok) appliedKey = null; // 后台没接住：下次存储变化 / 路由变化时重试
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
      const hostShield = await styles.syncShield(false);
      warnIfFailed('还原', !formal.ok ? formal : !draft.ok ? draft : hostShield);
    });
    return { ok: true };
  }

  // ---------- 激活：入口核对通过后才挂监听 ----------

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  function onStorageChanged(changes: Record<string, unknown>, area: string): void {
    // storage 变化驱动：开关切换、规则增删改、标题/图标修改、健康状态回写（回写只更新按钮，见 refreshState）。
    // 向导打开期间屏蔽（避免向导内的临时状态被真样式覆盖），退出时统一 refreshState
    if (area !== 'local' || wizardActive || disposed) return;
    const keys = Object.keys(changes);
    if (!keys.some((k) => k === profileKey(origin) || k === 'settings')) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = ctx.setTimeout(() => void scheduleRefresh(), 150);
  }

  function onRuntimeMessage(
    msg: { t?: string; mode?: OpenIntent },
    _sender: unknown,
    sendResponse: (r: Ack) => void,
  ): boolean {
    if (disposed) return false;
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
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    ctx.onInvalidated(() => {
      try {
        browser.storage.onChanged.removeListener(onStorageChanged);
        browser.runtime.onMessage.removeListener(onRuntimeMessage);
      } catch {
        // 扩展上下文已失效
      }
    });
    // SPA 路由变化（WXT 用 Navigation API 的 navigate 事件，没有轮询）：立即重评估生效范围、遮罩、体检；
    // 向导期间屏蔽（向导按打开时的地址工作，退出时会再刷新）
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      pageState.url = location.href; // 编辑面板里「本页生效的规则」跟着换页更新（N4）
      if (!wizardActive) void scheduleRefresh();
    });
    // bfcache 恢复：样式随文档一起被保存，但期间存储可能变了（另一个页面切了开关、改了规则），按新状态增删
    ctx.addEventListener(window, 'pageshow', (e) => {
      if (ctx.isValid && (e as PageTransitionEvent).persisted) void scheduleRefresh({ force: true });
    });
    // 页面重新可见时核对一次扩展是否已失联（失联本身没有事件；读 isValid 即触发收尾）
    ctx.addEventListener(document, 'visibilitychange', () => void ctx.isValid);
    // 预渲染激活：预渲染期间已注入样式、压过标题（激活瞬间不闪），激活后再按最新状态同步一次并挂界面
    if (prerendering) void activated.then(() => scheduleRefresh({ force: true }));
    void scheduleRefresh().then(() => {
      // 自己的一份已经插上（样式链串行），再请后台撤掉旧实例留下的那份：同文本插几次要删几次，中间不闪
      if (inheritedOrphanCss) void styles.releaseOrphans(location.href);
    });
  }

  // ---------- 收尾（ctx 失效） ----------

  function teardown(): void {
    if (disposed) return;
    disposed = true;
    // 先冻结样式记录：此后排队的样式请求（例如向导卸载时撤预览）都不再发出，由接替的新实例按记录处理
    handoverRecord = styles.handover();
    healthGen++;
    if (refreshTimer) clearTimeout(refreshTimer);
    closeWizard();
    clearPageUi();
  }
  ctx.onInvalidated(teardown);

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
      if (disposed || !ctx.isValid) return false;
      if (!gateDone) {
        pendingOpen = mode;
        return true;
      }
      activate();
      void openWizard(mode);
      return true;
    },
    alive() {
      return !disposed && ctx.isValid;
    },
    handover() {
      teardown();
      return handoverRecord ?? styles.handover();
    },
  };
}
