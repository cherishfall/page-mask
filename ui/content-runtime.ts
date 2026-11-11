/**
 * 内容脚本运行时：生命周期编排。
 * - 已配置站点伪装态：请求后台注入隐藏样式（方案A/B）+ 标题/图标伪装 + 体检 +
 *   方案C遮罩覆盖层 + 幕布（#45，临时整页遮蔽）+ 悬浮按钮
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
 * location.origin 读站点配置；没有配置（也不是正开着向导）就撤掉首屏遮挡、什么都不挂，保持休眠。
 * 一键清空前后台发 siteReset，本页立即移除样式、还原标题图标、卸载所有界面；
 * 站点还没有配置时取消向导会通知后台收回授权（cancelNewSite）。
 */
import { createApp, h, reactive, type App } from 'vue';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPageMaskStorage, profileKey } from '@/core/storage';
import { TitleFaviconGuard, effectiveTitle } from '@/core/disguise';
import { iconHref, TRANSPARENT_PNG } from '@/core/icon';
import { curtainRestoreAction, curtainTitle } from '@/core/curtain';
import { countPageHits, probeRules, runHealthCheck } from '@/core/health';
import { rulesApplicableAt } from '@/core/scope';
import { buildDisguiseCss, maskRulesAt } from '@/core/css-builder';
import { createDocStyles, type StyleRecord } from '@/core/doc-styles';
import { applyKey } from '@/core/apply-key';
import { hasSwitchEffect } from '@/core/site-state';
import { TAKEOVER_EVENT, hostShieldPresent } from '@/core/host-shield';
import { fromExtensionPage } from '@/core/messages';
import type { Ack, BgRequest, ContentReply, CssAck, OpenIntent } from '@/core/messages';
import { DEFAULT_SETTINGS } from '@/core/types';
import type { GlobalSettings, SiteProfile, TabIcon } from '@/core/types';
import FloatingToggle from './FloatingToggle.vue';
import WizardApp from './wizard/WizardApp.vue';
// 站点的展示名：与管理页列表 / 站点设置页同一个规则（去 www.、中文域名转回 Unicode）
import { siteLabelOf } from '@/entrypoints/management/site';
import { t } from '@/core/i18n';
import { applySettingsLanguage } from '@/ui/i18n';
import { MaskLayer } from './mask-layer';
import { CurtainLayer } from './curtain';
import { currentCurtainController, registerCurtainController, type CurtainControllerSlot, type PageCurtainController } from './curtain-controller';
import { createCurtainRestoreButton, type CurtainRestoreButton } from './curtain-restore';
import { createPageHost, type PageHost } from './page-host';
import { showPageNotice } from './page-notice';
import { createFirstPaintShield } from './first-paint-shield';
import { createMediaController } from './media-controller';
import { mediaFlagPatch, type MediaFlagKey } from '@/core/media';

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

/**
 * 幕布静音（0.8.0，#131，ADR-0013）：遮住即静音本标签页，恢复 / 页面卸载即还原。
 * 后台只认 sender.tab.id 并核对静音归属（只解本扩展设的那份）；消息发不出去
 * （扩展失联 / 标签页正关闭）就静默忽略，后台的 onUpdated 兜底会收尾。
 */
function sendCurtainMute(muted: boolean): void {
  try {
    void browser.runtime.sendMessage({ t: 'curtainMute', muted } satisfies BgRequest).catch(() => undefined);
  } catch {
    // 更新 / 重载瞬间上下文已失效：后台兜底会按导航状态收尾
  }
}

/** 登记在隔离环境 window.__pagemask 上的句柄（entrypoints/content.ts、后台 enableSite 使用） */
export interface ContentRuntimeHandle {
  /** 打开设置向导；站点还没有配置时也能打开（保存时才写配置）。返回是否受理 */
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
  /** 本扩展的页面根地址：判断消息是不是自己人发来的（core/messages.ts 的 fromExtensionPage） */
  const extensionBase = browser.runtime.getURL('/');
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
  // 幕布（#45）：页面内的临时状态，只活在本实例里——不写存储、刷新 / 整页跳转即消失
  const curtain = new CurtainLayer({ createHost: () => createPageHost(ctx, 'curtain') });
  // 扩展更新 / 重载的静音收尾兜底（审查轮 #3）：上一个实例若在幕布静音中失效，它的解除消息
  // 随上下文一起死、发不出去，标签页会带着本扩展的静音进入新文档。本文档刚开始，
  // 自己还没有任何幕布，此时标签页上若有本扩展的静音就是残留——补一次单向解除
  // （后台核对归属，只解本扩展那份）。接管一次性脚本的遮住时会再重新静音，
  // 顺序由后台的每标签页队列保证（后进队的后写）。
  sendCurtainMute(false);
  // 必须最先执行：在页面开始解析前挡住首帧
  const shield = createFirstPaintShield(document);
  const media = createMediaController(document);
  const styles = createDocStyles((m: BgRequest) => browser.runtime.sendMessage(m), takeover);
  const { prerendering, activated } = whenActivated(ctx);
  /** 依赖 DOM / 需要页面已被用户打开的部分（遮罩、体检回写、悬浮按钮）在此之后进行 */
  const uiReady = Promise.all([whenDomReady(ctx), activated]).then(() => undefined);

  let profile: SiteProfile | null = null;
  let settings: GlobalSettings = { ...DEFAULT_SETTINGS }; // null = 跟随界面语言默认（core/titles.ts）
  /** 悬浮按钮的显示状态：存储变化只改这里（响应式更新，不卸载重建，REVIEW N26） */
  const toggleState = reactive<{
    state: SiteProfile['switchState'];
    position: SiteProfile['floatingBtnPos'];
    /** 整颗胶囊的不透明度（#102）：闲置值，悬停 / 聚焦 / 拖动时由 CSS 回到 1 */
    opacity: number;
    /** 整页变灰（0.8.0）：胶囊媒体钮的按下状态跟着存储走，别的入口拨了也会即时更新 */
    mediaGray: boolean;
    /** 空设置（#158）：主按钮点了也翻不动页面上的东西——点它时照常切换，同时用说明框讲一句 */
    emptyNote: boolean;
  }>({
    state: 'original',
    position: null,
    opacity: 1,
    mediaGray: false,
    emptyNote: false,
  });
  /**
   * 编辑面板看的「当前页面地址」：SPA 换页后跟着变，面板里「本页生效的规则」随之刷新（N4）。
   * 传一个响应式对象而不是字符串——手动 createApp 不会重渲染根组件，字符串快照永远停在打开那一刻
   */
  const pageState = reactive<{ url: string }>({ url: location.href });
  let toggleHost: PageHost | null = null;
  let toggleApp: App | null = null;
  /** 幕布上的「恢复」按钮（#50）：归幕布宿主所有，两条代码路径共用 ui/curtain-restore.ts */
  let curtainButton: CurtainRestoreButton | null = null;
  let wizardHost: PageHost | null = null;
  let wizardApp: App | null = null;
  let wizardActive = false;
  /** 入口核对通过（本页有站点配置或正有打开向导的请求），已挂上监听 */
  let active = false;
  /** 入口核对（读配置）是否已完成；完成前到来的打开请求先记下 */
  let gateDone = false;
  let pendingOpen: OpenIntent | null = null;
  /** 收到 siteReset 后、配置真正删除前：不再按存储重新应用（避免体检回写等把样式注回来） */
  let resetting = false;
  let disposed = false;
  /** 上次整页应用时的判据（core/apply-key.ts）；null = 下次必须重新应用 */
  let appliedKey: string | null = null;
  /** 幕布开启前的开关态（恢复分支的判据）；null = 幕布没开（#45，不写存储） */
  let curtainEntryState: SiteProfile['switchState'] | null = null;
  /** 本文档幕布控制器的登记（ui/curtain-controller.ts）；null = 还没登记（或已被 clearPageUi 摘掉） */
  let curtainSlot: CurtainControllerSlot | null = null;
  /** 接管旧控制器时它正遮着、而 profile 还没读到：等 refreshState 就绪后由自己重新遮住（#107） */
  let adoptCoverPending = false;
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
    toggleState.opacity = settings.toggleOpacity; // 闲置不透明度（#110）：数值由 readSettings 归一化
    toggleState.mediaGray = profile?.mediaGray === true;
    // 空设置（#158）：三处同一个判断（core/site-state.ts，不含灰度）
    toggleState.emptyNote = !!profile && !hasSwitchEffect(profile);
  }

  /**
   * 这个网站有没有任何设置（#67）：保存过的标题和图标、收起项任一非空，或者开了灰度。
   * 只改过标题的网站也要看得见按钮——否则页面上一点痕迹都没有，用户下次想改只能靠记住工具栏图标。
   * 开关管得到的那三样交给 core/site-state.ts（#158，三处共用）；灰度独立于主开关（ADR-0014），
   * 但灰-only 的网站同样要有页面上的入口（#116 起），所以在这里补一项。
   */
  function hasSiteSettings(p: SiteProfile): boolean {
    return hasSwitchEffect(p) || p.mediaGray === true;
  }

  /** 这页的胶囊挂出过没有（0.8.13，#143）：页面生命周期的标记，挂载成功即置位。
   *  会话保留（#135）看它而不是看 toggleHost——遮住整页（#50）与进向导都会**合法地**
   *  卸掉胶囊，若只看在场与否，返回时配置全空就把胶囊拒之门外（真机反馈：关灰度 →
   *  遮住 → 恢复后胶囊消失） */
  let toggleShownThisPage = false;

  /** 上次看到的「悬浮按钮」被关掉的状态（0.8.14，#144）：用来识别「由关变开」这次显式要求 */
  let lastCapsuleHidden = false;

  function mountToggle(): void {
    // 幕布期间整根胶囊不渲染（#50）：恢复按钮在幕布宿主里，撤幕布时再由 hideCurtain 挂回来
    if (curtain.active) return;
    // 这个网站选择了「不显示胶囊」（#111）：直接卸掉，其余功能（收起规则、标题图标、快捷键）不受影响。
    // 显式的隐藏 / 重新显示视为重新要求：再打开时即使配置全空也挂（本页挂出过）
    if (profile?.capsuleHidden === true) {
      unmountToggle();
      return;
    }
    // 按「有没有设置」决定出不出（#67）：四项全空才不挂。
    // 但判据只在页面加载时决定胶囊生死（#135）：这页挂出过就保留 / 恢复——
    // 会话中间在胶囊/弹窗上关掉最后一项设置（比如灰-only 站点关灰度），
    // 或从幕布 / 向导返回（它们会临时卸掉胶囊），都不能让页面失去唯一入口；
    // 刷新后按判据该藏就藏（标记随文档生命周期走）。
    if ((!profile || !hasSiteSettings(profile)) && !toggleShownThisPage) {
      return;
    }
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
          opacity: toggleState.opacity,
          media: {
            mediaGray: toggleState.mediaGray,
          },
          // 空设置（#158）：点主按钮仍照常切换，同时用说明框讲一句「打开后页面不变」
          emptyNote: toggleState.emptyNote,
          siteLabel: siteLabelOf(origin),
          onToggle: handleToggle,
          onMoved: handleMoved,
          onEdit: handleEdit,
          onMoreItems: handleMoreItems,
          onResetPos: handleResetPos,
          onSettings: handleOpenSettings,
          onCover: handleCover,
          onMediaChange: handleMediaChange,
          onDelete: handleDeleteRequest,
          onDeleteSite: handleDeleteSite,
        }),
    });
    toggleApp.mount(toggleHost.root);
    toggleShownThisPage = true;
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
    toggleState.position = pos; // 菜单的「放回右下角」跟随实时位置（#90）
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

  /**
   * 胶囊媒体钮 / 各处开关拨动「整页变灰」：与悬浮按钮开关同一套写法——先就地反映，
   * 再按最新存储只改这一个字段；写入失败拨回并给一句页内提示。页面效果不在这里做：
   * storage.onChanged → applyKey 变化 → applyAll / restoreAll 统一重应用，
   * 弹窗与站点设置页的拨动走的是同一条路。
   */
  async function handleMediaChange(key: MediaFlagKey, on: boolean): Promise<void> {
    if (!profile || !ctx.isValid) return;
    const before = profile[key] === true;
    Object.assign(profile, mediaFlagPatch(key, on));
    syncToggleState();
    try {
      await storage.updateProfile(origin, (p) => {
        Object.assign(p, mediaFlagPatch(key, on));
      });
    } catch {
      if (profile) {
        Object.assign(profile, mediaFlagPatch(key, before));
        syncToggleState();
      }
      showPageNotice(ctx, t().media.saveFailed);
    }
  }

  /** 菜单「标题和图标」（#77）：进单步小表单，填完点「保存」 */
  function handleEdit() {
    if (ctx.isValid) void openWizard('editTitle');
  }

  /** 菜单「收起内容」（#77）：进向导选内容，添加与编辑同一扇门 */
  function handleMoreItems() {
    if (ctx.isValid) void openWizard('editContent');
  }

  /** 点了「删除这个网站的设置」：弹确认框之前先把幕布撤掉，删完页面上不留旧覆盖层 */
  function handleDeleteRequest(): void {
    if (ctx.isValid) hideCurtain();
  }

  /** 确认删除：后台先让本页还原（此时还删得掉样式），再收回授权、删配置（REVIEW B7） */
  async function handleDeleteSite(): Promise<void> {
    if (!profile || !ctx.isValid) return;
    hideCurtain({ remount: false });
    // resetSiteHere：内容脚本发起的删除，后台只认发送方自己所在的站点（#56）
    const res: Ack | undefined = await browser.runtime
      .sendMessage({ t: 'resetSiteHere' } satisfies BgRequest)
      .catch(() => undefined);
    if (!res?.ok) showPageNotice(ctx, t().common.deleteSiteFailed);
  }

  /** 点了「调整不透明度」（#120）：后台开插件设置并停在那张卡；开不起来就在页面上说一句 */
  async function handleOpenSettings(): Promise<void> {
    if (!ctx.isValid) return;
    const res: Ack | undefined = await browser.runtime
      .sendMessage({ t: 'openSettings', section: 'opacity' } satisfies BgRequest)
      .catch(() => undefined);
    if (!res?.ok) showPageNotice(ctx, t().notice.settingsFailed);
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

  function closeWizard(): void {
    wizardApp?.unmount();
    wizardApp = null;
    wizardHost?.remove();
    wizardHost = null;
    wizardActive = false;
  }

  /**
   * 打开设置向导：伪装态先临时还原全部规则再进入，退出后恢复（design.md 核心流程）。
   * 站点还没有配置时同样打开（#81 无首次模式）：保存时才写配置；取消则通知后台收回授权。
   */
  const initialRulesFor = (url: string) => rulesApplicableAt(profile?.hideRules ?? [], url);

  async function openWizard(mode: OpenIntent) {
    if (wizardActive || disposed) return;
    // 排在进行中的状态刷新之后再判断（刚激活时配置可能还在读）
    await exclusive(async () => undefined);
    if (wizardActive || resetting || disposed) return;
    // 打开前重读一次配置（#81）：缓存要等 150ms 防抖刷新才跟上存储的变化，
    // 而 hasProfile / 草稿起点必须按当下事实算——配置刚在别处被删时，缓存还当它存在，
    // 保存就会走错「已存在的配置」分支（E2E 模拟新站点正是这个时序）
    profile = (await storage.getProfile(origin)) ?? null;
    wizardActive = true;
    healthGen++;
    hideCurtain(); // 进向导前先撤幕布（#45）
    // 向导按打开这一刻的地址工作（页面地址在 SPA 换页后跟着变，先对齐，打开后不再改）
    const pageUrl = location.href;
    pageState.url = pageUrl;

    // 排在进行中的状态刷新之后，避免刷新在向导打开后又把正式样式注回去
    await exclusive(async () => {
      warnIfFailed('临时还原', await styles.clearFormal());
      // 向导里要先看清页面才能选元素：媒体灰度一并临时还原，退出后由 refreshState 恢复
      media.sync({ mediaGray: false });
      guard.restore();
      clearMasks();
      appliedKey = null; // 退出向导后必须重新应用
    });
    if (disposed || !wizardActive) return;
    unmountToggle();

    ensureHostShield();
    wizardHost = createPageHost(ctx, 'wizard');
    // 标题输入框的默认值按「站点 > 全局 > 界面语言」取
    const fallbackTitle = effectiveTitle(profile ?? { disguisedTitle: null }, settings);
    wizardApp = createApp(WizardApp, {
      mode,
      url: pageUrl,
      // 这个页面上用得上的旧规则，按打开这一刻的地址算：编辑时铺成草稿起点（#69）。
      // 站点还没有配置时是空清单——同一条路，只是还没有已收起的项
      initialRules: initialRulesFor(pageUrl),
      hasProfile: !!profile,
      titleIconSet: profile?.titleIconSet === true,
      // 「恢复网站原来的内容」的入口判据（#160）：用这个网站已保存的总数，不是本页用得上的条数——
      // 规则都作用于别的页面时，入口也该在（否则用户在这个页面上就没有出口了）
      savedRuleCount: profile?.hideRules.length ?? 0,
      initialTitle: fallbackTitle,
      initialIcon: profile?.icon ?? { kind: 'site' },
      initialState: profile?.switchState ?? 'disguised',
      // 实时预览标题 / 图标：直接压到当前标签页（guard 在标题表单第一次调用时快照真实标题），
      // 退出向导后由 refreshState → applyAll / restoreAll / clearPageUi 还原
      previewDisguise: (title: string, icon: TabIcon) => {
        if (!ctx.isValid) return;
        guard.apply(title, iconHref(icon));
      },
      // 预览样式同样按本文档记录（SW 回收后点「放弃」也能撤掉）
      setDraft: (css: string | null) => styles.setDraft(css),
      onDone: (saved?: boolean, notice?: string) => {
        closeWizard();
        // 保存后的一句话（例如 0 条规则时说明只有标签页名字变了）：向导已关，提示自己一个宿主，几秒后消失
        if (saved && notice) showPageNotice(ctx, notice);
        if (!saved && !profile) {
          // 向导被取消且站点还没有配置：还没写过配置，请后台收回刚给的授权（后台会再核对一次确实没有配置）
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
    // 媒体变灰的 JS 部分尽早生效（document 已存在，新增元素由 observer 补），不依赖 DOMContentLoaded
    media.sync(profile);
    // 先压标题、首屏遮挡换成精确规则（都不等后台往返），再同步正式样式
    // 标题与图标只在「保存过」时生效（#98）：只收起内容的网站不该被改掉标签页。
    // 没保存过时要显式还原——之前可能压过（用户刚在别处清掉了那项设置）
    if (profile.titleIconSet === true) {
      guard.apply(effectiveTitle(profile, settings), iconHref(profile.icon));
    } else {
      guard.restore();
    }
    // 首屏遮挡用的是同一份正式样式文本：媒体灰度也要在首帧前生效，不能露一帧真图
    shield.narrow(buildDisguiseCss(profile, location.href));
    const ok = await syncFormalStyles();
    shield.release();
    await uiReady;
    if (disposed || wizardActive) return ok;
    // 幕布开着时重新压住标题与覆盖层（#45）
    reassertCurtain();
    if (!profile || profile.switchState !== 'disguised') return ok;
    rebuildMasks();
    mountToggle();
    scheduleHealthCheck();
    return ok;
  }

  async function restoreAll(): Promise<boolean> {
    healthGen++;
    if (!profile) return false;
    // 原样态 = 定制（收起的内容 + 标签页标题图标）还原；灰度独立于两态（0.8.3）：
    // mediaGray 开着就继续生效，媒体控制器按配置同步而不是关掉
    media.sync(profile);
    // 原样态的正式样式里可能仍有灰度块：首帧防闪同样要压住，等正式样式落地后再撤
    shield.narrow(buildDisguiseCss(profile, location.href));
    guard.restore();
    clearMasks();
    const ok = await syncFormalStyles();
    shield.release(); // 与 applyAll 对称：正式样式落地即撤首帧遮挡，别靠 1.5s 兜底超时（#133）
    await uiReady;
    if (disposed || wizardActive) return ok;
    // 幕布开着时 guard.restore() 刚把真实标题放了出来：重新压住标题与覆盖层（#45）
    reassertCurtain();
    mountToggle();
    return ok;
  }

  // ---------- 幕布（#45，临时状态：不进配置、不改 switchState、只作用于当前标签页） ----------

  /** 幕布开着时重新压住标题与覆盖层（applyAll / restoreAll 里的 guard 调用会把幕布的标题盖掉） */
  function reassertCurtain(): void {
    if (!curtain.active || !profile) return;
    // 幕布一律固定空白图标（#121）：profile.icon 可能是「网站原来的图标」或预置图标，
    // 走到 iconHref 就会在遮住时露出真图标 / 自定义图标，等于自己拆自己的台
    guard.apply(curtainTitle(profile, settings), TRANSPARENT_PNG);
    curtain.reassert();
  }

  /** 在幕布宿主里放「恢复」按钮（#50）：位置与该站胶囊共用 floatingBtnPos，遮住前后不跳位 */
  function mountCurtainButton(): void {
    if (curtainButton || !profile || !curtain.active) return;
    const root = curtain.root;
    if (!root) return;
    curtainButton = createCurtainRestoreButton({
      root,
      position: profile.floatingBtnPos,
      // 坐标是本机界面状态：写回胶囊用的同一个字段，不刷新用户修改时间
      onMove: (pos) => void handleMoved(pos),
      onRestore: handleRestore,
    });
  }

  function unmountCurtainButton(): void {
    curtainButton?.destroy();
    curtainButton = null;
  }

  /**
   * 遮住整页：铺覆盖层 + 压住标题与图标（与清爽态同一套规则）+ 幕布上的「恢复」按钮；
   * 记录进入前的开关态供恢复分支。幕布期间整根胶囊卸掉（#50：一个页面上只有一套恢复入口）
   */
  function showCurtain(): void {
    if (!profile || curtain.active) return;
    // 向导开着时不再铺幕布（#107）：进向导前刚撤过，弹窗/快捷键此时的切换请求不应把幕布盖回向导上
    if (wizardActive) return;
    curtainEntryState = profile.switchState;
    ensureHostShield();
    curtain.show();
    // 遮住即静音本标签页（0.8.0，ADR-0013）：应急遮蔽眼耳一起按住；恢复时由 hideCurtain 还原
    sendCurtainMute(true);
    mountCurtainButton();
    unmountToggle();
    // 遮住时固定空白图标（#121）：任何站点配置里的真图标都不能露出来
    guard.apply(curtainTitle(profile, settings), TRANSPARENT_PNG);
  }

  /**
   * 撤幕布并按进入前的开关态恢复标题与图标（#45，最容易写错的地方）：
   * 进入前是清爽态 → 回到清爽标题与图标；进入前是原样态 → 才还原真实标题与图标。
   * 一律 guard.restore() 会让清爽态当场露馅（真实标题放出来）。
   *
   * remount：撤幕布后把小胶囊按当前状态挂回来（#50）。随后就要清场的调用方（一键清空、
   * 扩展失效收尾）传 false——否则会先挂上再卸掉。
   */
  function hideCurtain({ remount = true } = {}): void {
    if (!curtain.active) return;
    const entry = curtainEntryState;
    curtainEntryState = null;
    // 幕布撤掉，本标签页的声音一并还原（0.8.0）：只解除本扩展设的那份（后台核对归属）；
    // 用户自己静音的标签页这里写了也不会被解除
    sendCurtainMute(false);
    unmountCurtainButton();
    curtain.hide();
    if (entry && curtainRestoreAction(entry) === 'disguise' && profile) {
      // 回到清爽态：标题与图标都换回该站自己选的那一态（「网站原来的图标」= 不接管，
      // iconHref 返回 null，guard 会把站点自己的 link 放回来；#121）
      guard.apply(curtainTitle(profile, settings), iconHref(profile.icon));
    } else {
      guard.restore();
    }
    syncToggleState();
    if (remount && profile) mountToggle();
  }

  /** 悬浮按钮「遮住」 */
  function handleCover(): void {
    if (!profile || !ctx.isValid) return;
    showCurtain();
  }

  /** 悬浮按钮「恢复」：回到点击「遮住」之前的状态 */
  function handleRestore(): void {
    if (!ctx.isValid) return;
    const entry = curtainEntryState;
    hideCurtain();
    // 幕布期间开关被其他标签页 / popup 改过时，进入前的状态已不等于当前：按最新配置重应用对齐
    // （正常情形二者相同，不会走到这；点「恢复」回到的仍是点击「遮住」之前的样子）
    if (profile && entry !== profile.switchState) void scheduleRefresh({ force: true });
  }

  // ---------- 幕布控制器（#107，ADR-0011：每个文档一个，三处入口与跨脚本委托共用） ----------

  /** 页面级控制器：胶囊、弹窗、快捷键与一次性脚本的委托都通过它 */
  const curtainController: PageCurtainController = {
    state: () => curtain.active,
    cover: () => {
      showCurtain();
    },
    dismiss: () => {
      handleRestore();
    },
    toggle: () => {
      if (curtain.active) handleRestore();
      else showCurtain();
    },
  };

  /**
   * 确保本运行时的控制器已登记（幂等）。已有登记时：
   * - 是自己的（adopt 已完成）——不动；
   * - 是一次性脚本的——让它让位（adoptExistingCurtain），撤掉它的层、换成自己的登记，
   *   之前遮着的话由自己重新遮住（遮住状态不因接管丢失）。
   */
  function ensureCurtainSlotClaimed(): void {
    if (curtainSlot || disposed) return;
    const existing = currentCurtainController();
    if (existing && existing.controller === curtainController) return;
    if (!existing) {
      curtainSlot = registerCurtainController('content', curtainController);
      return;
    }
    void adoptExistingCurtain(existing);
  }

  /**
   * 旧控制器（一次性脚本先到）让位：先登记自己占住槽位（登记后一次性脚本的监听自然静默，
   * 消息不会落在旧控制器上），再撤旧层，最后按需补遮——顺序反了的话，撤层与登记之间
   * 到来的消息会让两边各说各话（#107 复查修）。
   */
  async function adoptExistingCurtain(existing: CurtainControllerSlot): Promise<void> {
    // 「遮着」包括遮住流程进行中（一次性脚本正在读存储、还没铺上）：
    // 只看 state() 会把进行中的遮住请求当没遮，配合旧控制器的让位就没人遮了（#114 二轮复查）
    const wasCovered = existing.controller.state() === true || existing.controller.covering?.() === true;
    if (curtainSlot || disposed) return;
    const slot = registerCurtainController('content', curtainController);
    curtainSlot = slot;
    try {
      await Promise.resolve(existing.controller.dismiss());
    } catch {
      // 旧控制器已失联（扩展重载前的旧一次性脚本）：撤不掉就算了，层随文档消失
    }
    // await 之后接口契约允许真异步的 dismiss：失效（disposed）或登记已易主就到此为止
    if (disposed || curtainSlot !== slot) return;
    if (!wasCovered || curtain.active) return;
    if (profile && !wizardActive) showCurtain();
    else adoptCoverPending = true; // profile 还没读到 / 向导开着：等 refreshState 就绪后再遮
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
    hideCurtain({ remount: false }); // 先撤幕布再继续（#45；teardown 也走这里）
    // 站点配置没了（一键清空 / 向导取消）：页面上的媒体效果不能留
    media.sync({ mediaGray: false });
    // 控制器登记一并摘掉：profile 都没了就遮不了页，留着登记会让一次性脚本委托到一个遮不了的控制器（#107）
    curtainSlot?.unregister();
    curtainSlot = null;
    adoptCoverPending = false;
    healthGen++;
    shield.release();
    unmountToggle();
    // 会话保留的标记一并归零（0.8.14，#144）：配置没了 = 这个网站在这一页的会话结束。
    // 不清的话，之后该站以「四项全空」形态再出现（导入合并写回）时，挂载门会因标记为真
    // 而放行——胶囊挂到一个没有任何设置的网站上（违反 #67「四项全空才不显示」）
    toggleShownThisPage = false;
    guard.restore();
    clearMasks();
    appliedKey = null;
  }

  async function refreshState(): Promise<void> {
    if (wizardActive || disposed) return; // 向导期间不动样式，退出时会再刷新
    const [p, s] = await Promise.all([storage.getProfile(origin), storage.getSettings()]);
    settings = s;
    applySettingsLanguage(s); // 界面语言（#57）：设置变了所有页内界面立刻跟着换
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
    // 「悬浮按钮」由关变开 = 用户明确要求这一页要有胶囊（0.8.14，#144）：弹窗里说「开」
    // 却页面上没有按钮是自相矛盾——即使配置四项全空、刷新后标记已归零，也视为要求。
    // 首次读到（没有上次值）不算转变，不会误触发。
    if (lastCapsuleHidden && !p.capsuleHidden) {
      toggleShownThisPage = true;
    }
    lastCapsuleHidden = p.capsuleHidden === true;
    syncToggleState();
    ensureCurtainSlotClaimed();
    // 接管旧控制器时它正遮着而 profile 还没就绪：现在补上（#107，遮住状态不因接管丢失）
    if (adoptCoverPending && !wizardActive && !curtain.active) {
      adoptCoverPending = false;
      showCurtain();
    }
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
      hideCurtain({ remount: false }); // 先撤幕布再继续（#45）
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
    // 向导打开期间屏蔽（避免向导内的临时状态被真样式覆盖），退出时统一 refreshState；
    // 但界面语言（#57）不屏蔽——向导 / 编辑面板 / 胶囊正开着也要立刻换语言
    if (area !== 'local' || disposed) return;
    // storage.onChanged 的 changes 值是 { oldValue, newValue } 包装，取 newValue
    if ('settings' in changes) {
      const wrapped = changes.settings as { newValue?: { uiLanguage?: unknown } } | undefined;
      applySettingsLanguage(wrapped?.newValue);
    }
    if (wizardActive) return;
    const keys = Object.keys(changes);
    if (!keys.some((k) => k === profileKey(origin) || k === 'settings')) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = ctx.setTimeout(() => void scheduleRefresh(), 150);
  }

  function onRuntimeMessage(
    msg: { t?: string; mode?: OpenIntent },
    sender: unknown,
    sendResponse: (r: ContentReply) => void,
  ): boolean {
    if (disposed) return false;
    // 幕布的四条消息（#50、#54、#107）：只作用于本文档，且只接受扩展自己的页面发来的——
    // 网页里的内容脚本 / 网页脚本不能让别的站点遮住 / 撤幕布（core/messages.ts 的 fromExtensionPage）。
    // 回复的都是动作执行后的状态；cover / dismiss / toggle 在这里是同步的，直接回复。
    if (
      msg?.t === 'curtainState' ||
      msg?.t === 'curtainDismiss' ||
      msg?.t === 'curtainCover' ||
      msg?.t === 'curtainToggle'
    ) {
      if (!fromExtensionPage(sender as { id?: string; url?: string } | undefined, browser.runtime.id, extensionBase)) {
        return false;
      }
      // 没有配置就遮不了页（站点刚被一键清空等）：不占回复通道——后台会按「没有接收方」注入
      // 一次性脚本兜底，它的应答才是页面的真实状态（#107：避免两个监听器报告互相矛盾的状态）
      if (!profile) return false;
      // 登记处已换人（一次性脚本还在、接管尚未完成的窗口期）：由登记者应答，自己静默（#107）
      if (currentCurtainController()?.controller !== curtainController) return false;
      if (msg.t === 'curtainDismiss') handleRestore();
      else if (msg.t === 'curtainCover') handleCover();
      else if (msg.t === 'curtainToggle') curtainController.toggle();
      sendResponse({ ok: true, covered: curtain.active });
      return false;
    }
    // popup / 后台触发的入口消息
    if (msg?.t === 'openWizard') void openWizard(msg.mode ?? 'editContent');
    else if (msg?.t === 'siteReset') {
      void handleSiteReset().then(sendResponse, () => sendResponse({ ok: false }));
      return true; // 异步回复：后台等本页还原完再收回授权
    }
    return false;
  }

  function activate(): void {
    if (active || disposed) return;
    active = true;
    // 控制器登记先行（#107）：此时 profile 可能还没读到，接管旧控制器的「接着遮」由 refreshState 补上
    ensureCurtainSlotClaimed();
    browser.storage.onChanged.addListener(onStorageChanged);
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    // 门栅已过，休眠唤醒退役（0.8.5，#134：popup 先注入后写配置，休眠期靠它感知配置创建）
    browser.storage.onChanged.removeListener(onDormantStorageChanged);
    ctx.onInvalidated(() => {
      try {
        browser.storage.onChanged.removeListener(onStorageChanged);
        browser.storage.onChanged.removeListener(onDormantStorageChanged);
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
      if (!ctx.isValid || !(e as PageTransitionEvent).persisted) return;
      // 幕布随文档一起被冻进缓存、pagehide 时声音已还原：恢复后重新按住（幕布还开着就该哑着）
      if (curtain.active) sendCurtainMute(true);
      void scheduleRefresh({ force: true });
    });
    // 整页跳转 / 刷新 / 关标签页：幕布随之消失，声音跟着还原（0.8.0）。后台 onUpdated 兜底
    // 覆盖内容脚本没机会发消息的路径（被杀、失联）
    ctx.addEventListener(window, 'pagehide', () => {
      if (curtain.active) sendCurtainMute(false);
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
    media.dispose(); // 断 observer 与监听、清掉小图标记（媒体层不写任何声音状态）
  }
  ctx.onInvalidated(teardown);

  // 首屏防闪：不等读配置，立即请求正式样式（未配置 / 原样态 / 端口不符时后台什么也不插）
  void syncFormalStyles();

  // 门栅唤醒（0.8.5，#134）：popup 直接开灰度是「先注入、后写配置」——门栅读配置时它还不存在，
  // 没有这个监听，灰-only 站点注入后会一直休眠（灰度永不生效、胶囊不挂）。休眠期挂 storage
  // 监听，本站配置创建即激活；激活（或收尾）时摘掉，不与 activate 里正式的那份重复。
  const onDormantStorageChanged = (changes: Record<string, unknown>, area: string): void => {
    if (area !== 'local' || disposed || active) return;
    const c = changes as Record<string, { newValue?: unknown } | undefined>;
    if (c[profileKey(origin)]?.newValue) activate();
  };
  browser.storage.onChanged.addListener(onDormantStorageChanged);
  ctx.onInvalidated(() => {
    try {
      browser.storage.onChanged.removeListener(onDormantStorageChanged);
    } catch {
      // 扩展上下文已失效
    }
  });

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
