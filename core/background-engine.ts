/**
 * PageMask 后台引擎（可注入 browser 的工厂，供后台入口与单测共用）。
 * 职责：
 * - 站点生命周期对账（core/reconcile.ts）：让站点配置、站点授权、动态注册三者一致
 * - 启用站点、一键清空、新站点向导取消
 * - 隐藏样式（方案A/B）与宿主保护样式（core/host-shield.ts）按文档的 insertCSS/removeCSS
 * - 扩展更新 / 重载后向已配置站点的已打开标签页重新注入内容脚本（#22，新实例接管失联的旧实例）
 * - 安装后拉起首次引导
 * 方案 C（遮罩）由内容脚本的覆盖层承担；标题/图标由内容脚本直接改写。
 *
 * 无状态：注入记录由内容脚本按文档持有，随请求带来（见 core/messages.ts 顶部说明），
 * SW 随时被回收都不影响还原；对账每次都从存储、权限、注册表重新读取。
 *
 * 对账触发点（任何一个都可能在 SW 刚被唤醒时到来，都是幂等的）：
 * - runtime.onInstalled（install / update / chrome_update）：扩展更新或重载会清空动态注册（REVIEW B1）
 * - runtime.onStartup
 * - permissions.onAdded / onRemoved（用户在扩展详情里收回或授予站点权限）
 * - storage.onChanged 里站点配置被创建或删除（新站点向导保存、整体替换导入、一键清空）
 * - 扩展页面发来的 reconcile 消息（管理页导入、授权之后，等结果再刷新界面）
 *
 * 消息回复统一用 sendResponse + 监听器同步 return true（"返回 Promise 即回复"要 Chrome 148+ 且灰度放量）。
 *
 * 用法：
 *   后台入口：defineBackground(() => createBackground({ browser }))
 *   单测：    createBackground({ browser: fakeBrowser })，再 fakeBrowser.runtime.onMessage.trigger(msg, sender, sendResponse)
 */
import type { Browser, WxtBrowser } from 'wxt/browser';
import { PROFILE_PREFIX, createPageMaskStorage } from './storage';
import { buildDisguiseCss } from './css-builder';
import { CONTENT_SCRIPT_FILE, CURTAIN_ONESHOT_FILE, registrationPlan } from './registration';
import { HOST_SHIELD_CSS } from './host-shield';
import { grantedPatternsFor, planReconcile, type RegisteredScript } from './reconcile';
import { allGrantedPatterns, grantedPatternsOfSite } from './site-grant';
import { siteKey, sitePatterns } from './site-key';
import type {
  Ack,
  BgRequest,
  CssAck,
  CurtainStateReply,
  EnableSiteRequest,
  EnableSiteResponse,
  OpenIntent,
  ReconcileResponse,
} from './messages';
import { fromExtensionPage as isExtensionPageSender } from './messages';
import { resolveLocale, setLocale, t } from './i18n';
import { isSupportedPage } from './origin';

export interface BackgroundDeps {
  /** 扩展 API（生产传 wxt/browser 的 browser，单测传 fakeBrowser 并按需 stub scripting/permissions） */
  browser: WxtBrowser;
}

type Sender = Browser.runtime.MessageSender;
type CssTarget = Browser.scripting.InjectionTarget;
type Reply = Ack | EnableSiteResponse | CssAck | ReconcileResponse;

/** 一键清空时等待每个标签页还原的上限：页面卡住或内容脚本不在时不能让清空一直挂着 */
export const SITE_RESET_TIMEOUT_MS = 1500;

const FORBIDDEN = { ok: false, error: 'forbidden', code: 'forbidden' } as const;

/** 页面 URL → 站点 key（后台各处「这个标签页属于哪个网站」的唯一入口） */
function siteKeyOfUrl(url: string | undefined): string | null {
  return url ? siteKey(url) : null;
}

export function createBackground({ browser }: BackgroundDeps): void {
  const storage = createPageMaskStorage(browser.storage.local);
  const extensionBase = browser.runtime.getURL('/');

  /** 后台也出文案（快捷键被挡的角标悬停说明，#202）：跟随全局设置里的界面语言。
   *  SW 每次唤醒重跑一遍；运行中 settings 变化由 onChanged 里的再同步跟上 */
  function syncBackgroundLocale(): void {
    void storage
      .getSettings()
      .then((s) => setLocale(resolveLocale(s.uiLanguage)))
      .catch(() => undefined);
  }
  syncBackgroundLocale();

  /** 特权消息只接受本扩展自己的页面（popup / 管理页 / 引导页），网页里的内容脚本一律拒绝（REVIEW B26） */
  function fromExtensionPage(sender: Sender): boolean {
    return isExtensionPageSender(sender, browser.runtime.id, extensionBase);
  }

  /**
   * 一个站点当前有效的授权模式（为空 = 待授权）。判断逻辑在 core/site-grant.ts：
   * 先按站点归并已授权的模式（迁移前只有旧的精确模式时，它们就是有效模式），
   * 再处理「用户授了所有网站」的通配模式。
   */
  function grantedPatternsOf(key: string, all?: readonly string[]): Promise<string[]> {
    return grantedPatternsOfSite(browser, key, all);
  }

  // ---------- 对账 ----------

  async function registerOne(plan: ReturnType<typeof registrationPlan>): Promise<void> {
    try {
      await browser.scripting.registerContentScripts([plan]);
    } catch (e) {
      // 别的触发点刚注册过同一 id：改为按当前计划更新（重复注册幂等，REVIEW B27）
      if (!/duplicate/i.test(String(e))) throw e;
      await browser.scripting.updateContentScripts([plan]);
    }
  }

  async function reconcileOnce(): Promise<string[]> {
    const profiles = await storage.listProfiles();
    const configured = profiles.map((p) => p.origin);
    const granted = await allGrantedPatterns(browser);
    // getAll 瞬时异常（#186）：跳过这一轮。往下算 grantedPatterns 会是空清单，
    // planReconcile 会把所有已注册站点注销一轮，权限恢复后才能补回来——不能冒这个险
    if (!granted) {
      console.warn('[PageMask] 对账跳过：读不到当前授权（permissions.getAll 失败）');
      return [];
    }
    const grantedPatterns: string[] = [];
    for (const key of configured) grantedPatterns.push(...(await grantedPatternsOf(key, granted)));
    const registered = (await browser.scripting.getRegisteredContentScripts()) as RegisteredScript[];
    const plan = planReconcile({ configured, grantedPatterns, registered });

    // 每一项独立处理：一项失败不影响其余站点
    const errors: unknown[] = [];
    const attempt = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        errors.push(e);
      }
    };
    for (const id of plan.unregister) {
      await attempt(() => browser.scripting.unregisterContentScripts({ ids: [id] }));
    }
    for (const p of plan.update) await attempt(() => browser.scripting.updateContentScripts([p]));
    for (const p of plan.register) await attempt(() => registerOne(p));
    if (errors.length) console.warn('[PageMask] 对账时部分站点未能注册/注销', errors);
    return plan.pending;
  }

  /** 同一 SW 实例内的对账串行执行（多个触发点同时到来时不会交错注册） */
  let reconcileChain: Promise<unknown> = Promise.resolve();
  function reconcile(): Promise<string[]> {
    const run = reconcileChain.then(reconcileOnce);
    reconcileChain = run.catch(() => undefined);
    return run;
  }

  function reconcileInBackground(reason: string): void {
    reconcile().catch((e: unknown) => console.warn(`[PageMask] 对账失败（${reason}）`, e));
  }

  // ---------- 启用站点 ----------

  /**
   * 先请求站点权限再启用。
   * **这一行 permissions.request 必须同步执行**：用户手势从 popup / 管理页跨 runtime.sendMessage
   * 传到后台时只在同一个同步回合内有效，之前任何 await 都会让请求以「no user gesture」失败。
   * 权限框弹出会销毁 popup，所以「拿到权限之后」的一切都必须在这里跑完，不能指望 popup 继续。
   *
   * 申请的是 sitePatterns(key)：普通域名「裸域 + 子域」两条。只追加、不收回——
   * 迁移前只持有旧精确模式的站点在申请失败时保持原样，什么都不写。
   */
  function requestPermissionThenEnable(msg: EnableSiteRequest): Promise<Reply> {
    const key = siteKey(msg.origin);
    if (!key) return Promise.resolve({ ok: false, code: 'notGranted', error: 'invalid site key' } satisfies EnableSiteResponse);
    let requested: Promise<boolean>;
    try {
      requested = browser.permissions.request({ origins: sitePatterns(key) });
    } catch (e) {
      if (/gesture/i.test(String(e))) {
        return Promise.resolve({ ok: false, code: 'gestureLost', error: String(e) } satisfies EnableSiteResponse);
      }
      return Promise.resolve({ ok: false, code: 'notGranted', error: String(e) } satisfies EnableSiteResponse);
    }
    return requested.then(
      (granted) =>
        granted
          ? enableSite({ ...msg, origin: key })
          : ({ ok: false, code: 'denied', error: 'user denied site access' } satisfies EnableSiteResponse),
      // 手势丢失可能是同步抛出，也可能是 promise 拒绝；两者都要让 popup 知道可以「再点一次」
      (e: unknown) =>
        ({
          ok: false,
          code: /gesture/i.test(String(e)) ? 'gestureLost' : 'notGranted',
          error: String(e),
        }) satisfies EnableSiteResponse,
    );
  }

  async function enableSite(msg: EnableSiteRequest): Promise<EnableSiteResponse> {
    const key = siteKey(msg.origin);
    if (!key) return { ok: false, code: 'notGranted', error: 'invalid site key' };
    const { tabId } = msg;
    const open: OpenIntent | undefined = msg.open === 'editTitle' || msg.open === 'editContent' ? msg.open : undefined;
    // 核对标签页当前确实停在这个站点：popup 打开后页面可能已跳走，授权不能落到别的站点（REVIEW B27）。
    // 按站点 key 比较：弹窗停在 weibo.com、标签页跳到 s.weibo.com 仍是同一个网站
    let tabKey: string | null = null;
    try {
      tabKey = siteKeyOfUrl((await browser.tabs.get(tabId))?.url);
    } catch {
      // 标签页已关闭
    }
    if (tabKey !== key) return { ok: false, code: 'tabMismatch', error: 'tab is not on this site' };
    if ((await grantedPatternsOf(key)).length === 0) {
      return { ok: false, code: 'notGranted', error: 'site access not granted' };
    }
    try {
      // 已配置的站点在这里补注册；新站点没有配置，不注册（保存向导时写入配置，再由对账注册）
      await reconcile();
      // 已打开的标签页立即注入（registerContentScripts 只影响后续导航）。
      // 路径运行时动态确定，超出 WXT 静态 ScriptPublicPath 联合类型，此处断言。
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CONTENT_SCRIPT_FILE] as unknown as ScriptPublicPath[],
      });
      // 灰-only 建站（0.8.5，#134）：popup 直接开灰度——授权并注入后补一份只带 mediaGray 的配置。
      // 必须由后台做：权限框已销毁 popup，没人能在 popup 里继续写配置。内容脚本靠休眠唤醒
      // （配置创建的 storage 事件）感知这份新配置并生效。
      if (msg.initialMedia === true && !(await storage.getProfile(key))) {
        await storage.updateProfile(key, (p) => {
          p.mediaGray = true;
        }, { create: true });
      }
      if (open) {
        // 内容脚本在同一隔离环境里登记了 window.__pagemask，注入完成后直接让它打开向导（不靠轮询重试）
        const [res] = await browser.scripting.executeScript({
          target: { tabId },
          func: (mode: OpenIntent) =>
            (window as unknown as { __pagemask?: { open(m: OpenIntent): boolean } }).__pagemask?.open(mode) ?? false,
          args: [open],
        });
        if (res && res.result === false) return { ok: false, code: 'injectFailed', error: 'wizard did not open' };
      }
      return { ok: true };
    } catch (e) {
      // 灰-only 建站遇到「还没加载好的页面」（0.8.16，#154）：Chrome 网络错误页上 executeScript
      // 一律抛 "Frame with ID 0 is showing error page"（中国代理环境下访问外站时常见）。
      // 此时权限已经到手，用户「打开这个网站的灰度」的意图已经表达——照常建档，
      // 等页面真正打开时注册表 + 配置双全，灰度自动生效；弹窗给一句说明而不是报错。
      // 其余流程（开向导、重新授权）没有可延迟的配置，维持 injectFailed 原样。
      if (msg.initialMedia === true) {
        try {
          if (!(await storage.getProfile(key))) {
            await storage.updateProfile(key, (p) => {
              p.mediaGray = true;
            }, { create: true });
          }
          return { ok: false, code: 'pageNotReady', error: String(e) } satisfies EnableSiteResponse;
        } catch {
          // 建档也失败（存储异常等）：按原样报注入失败
        }
      }
      return { ok: false, code: 'injectFailed', error: String(e) };
    }
  }

  // ---------- 未添加网站的幕布（#46） ----------

  /**
   * 内容脚本的「调整不透明度」（#120）：打开插件设置并停在不透明度那一栏。
   * 内容脚本调不到 runtime.openOptionsPage，也不该自己拼扩展页地址；section 只认白名单，
   * 免得将来有人从这里塞任意 hash 进扩展页。tabs.create 不需要 "tabs" 权限。
   */
  async function openSettings(section: unknown): Promise<Ack> {
    const hash = section === 'opacity' ? '#opacity' : '';
    await browser.tabs.create({ url: browser.runtime.getURL(`/settings.html${hash}`), active: true });
    return { ok: true };
  }

  /**
   * popup 的「遮住本页」：让页面控制器遮，实在没有接收方才注入一次性幕布脚本。
   * 已添加的网站只要内容脚本在线（弹窗的兜底路径会先注入），curtainCover 就有应答，不重复注入（#107）；
   * 未添加的网站里没有任何脚本（ADR-0001：未配置零注入），只能走注入——activeTab 在用户点
   * 工具栏图标时授予，注入不需要站点授权，也不注册、不写配置；脚本随文档消失。
   */
  async function coverPage(tabId: number): Promise<Ack> {
    const reply = (await browser.tabs.sendMessage(tabId, { t: 'curtainCover' }).catch(() => undefined)) as
      | CurtainStateReply
      | undefined;
    if (reply?.covered) return { ok: true };
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CURTAIN_ONESHOT_FILE] as unknown as ScriptPublicPath[],
      });
      // 注入成功 ≠ 遮上了（页面控制器可能拒遮，比如向导开着）：回查确认，不假报成功（#107 复查修）。
      // 一次性脚本的监听要等动态导入完成才注册：没人应答时短间隔再查两次（慢机器上导入不止
      // 200ms，#186），只有「有应答且没遮上」才算失败；总等待压在几百毫秒内，不让用户等太久
      const askState = async (): Promise<CurtainStateReply | undefined> =>
        (await browser.tabs.sendMessage(tabId, { t: 'curtainState' }).catch(() => undefined)) as
          | CurtainStateReply
          | undefined;
      let after = await askState();
      for (const waitMs of [100, 200]) {
        if (after) break;
        await new Promise((r) => setTimeout(r, waitMs));
        after = await askState();
      }
      return { ok: after?.covered === true, error: after?.covered ? undefined : 'curtain did not cover' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // ---------- 幕布快捷键（#101） ----------

  /** 快捷键失败时图标角标亮多久；SW 的空闲回收在 30 秒量级，3 秒内不会被收走 */
  const SHORTCUT_BADGE_MS = 3000;

  /**
   * 快捷键在当前标签页切换幕布（#107）。
   * 按快捷键算一次用户手势，Chrome 会临时授予 activeTab——没添加过的网站也能遮。
   * 分支：只发一条 curtainToggle，方向由页面控制器决定（遮着就撤、没遮就遮）——
   * 不再「先问状态、再发动作」两步，两步之间状态不会变化；
   * 没有接收方 → 判断页面是否可注入 → 注入一次性脚本（脚本自己会遮住）；
   * 注入不了（chrome:// / 商店 / PDF / file://）→ 图标角标 + title 说明，不许静默失败。
   */
  async function toggleCurtainByShortcut(): Promise<void> {
    let tab: Browser.tabs.Tab | undefined;
    try {
      [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    } catch {
      return;
    }
    const tabId = tab?.id;
    if (tabId === undefined) return;

    const reply = (await browser.tabs.sendMessage(tabId, { t: 'curtainToggle' }).catch(() => undefined)) as
      | CurtainStateReply
      | undefined;
    if (reply?.ok) return;

    const supported = tab?.url ? isSupportedPage(tab.url) : { ok: true };
    if (!supported.ok) {
      await flagShortcutBlocked(tabId, supported.reason);
      return;
    }
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CURTAIN_ONESHOT_FILE] as unknown as ScriptPublicPath[],
      });
    } catch {
      await flagShortcutBlocked(tabId);
    }
  }

  /**
   * 整页变灰快捷键（0.9.2，用户提案，ADR-0020 修订 ADR-0010）。
   *
   * **permissions.request 必须在 onCommand 的同一同步回合发起**（与 requestPermissionThenEnable
   * 同一条铁律）：命令按键本身就是用户手势。已授权的站点 request 直接返回 true、不弹任何窗；
   * 没授权过的正好弹出 Chrome 的「允许」提示——授权与变灰一次按键完成，这就是「第一次就自动调起授权」。
   * 用户拒绝 → 安静返回；拒绝但站点已有配置（旧精确授权用户）→ 仍允许就地切换，
   * 不逼人先扩权。
   */
  async function toggleGrayByShortcut(tab?: Browser.tabs.Tab): Promise<void> {
    const tabId = tab?.id;
    const url = tab?.url;
    if (tabId === undefined) return;
    const supported = url ? isSupportedPage(url) : { ok: true };
    if (!supported.ok) {
      await flagShortcutBlocked(tabId, supported.reason);
      return;
    }
    const site = url ? siteKeyOfUrl(url) : null;
    if (!site) {
      // 连网址都读不到（activeTab 没给到的罕见情况）：无从知道要灰哪个站点
      await flagShortcutBlocked(tabId, t().common.shortcutBlockedGray);
      return;
    }
    let granted = false;
    try {
      granted = await browser.permissions.request({ origins: sitePatterns(site) });
    } catch {
      granted = false; // 手势丢失 / 平台限制：按「未授权」处理，走下面的回退
    }
    if (await storage.getProfile(site)) {
      // 已有配置：就地切换灰度（popup 同一字段、同一写入通道）
      await storage.updateProfile(site, (p) => {
        // 关掉写 undefined（字段从存储里消失）：与 core/media.ts 的 mediaFlagPatch、
        // sanitizeProfile「显式 true 才落字段」同口径，不留一个要额外解释的 false。
        // 与弹窗开关同一字段、同一写入通道，两条路径落库形状一致。
        p.mediaGray = p.mediaGray === true ? undefined : true;
      });
      return;
    }
    if (!granted) return; // 没配置 + 没授权（用户拒绝了弹窗）：什么都不做
    // 没配置过的网站：与 popup 开灰度同一条路——授权并注入后补一份只带灰度的配置。
    // 页面还在错误页时配置照常建档（#154 语义），页面真正打开后灰度自动生效。
    await enableSite({ t: 'enableSite', origin: site, tabId, initialMedia: true } satisfies EnableSiteRequest);
  }

  /** 快捷键在这个页面用不了：给一次短暂、可见的反馈（角标 + 悬停说明），不弹窗、不打扰 */
  async function flagShortcutBlocked(tabId: number, reason?: string): Promise<void> {
    try {
      await browser.action.setBadgeBackgroundColor({ tabId, color: '#b91c1c' });
      await browser.action.setBadgeText({ tabId, text: '!' });
      await browser.action.setTitle({ tabId, title: reason || t().common.shortcutBlocked });
    } catch {
      return;
    }
    setTimeout(() => {
      void browser.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
      void browser.action.setTitle({ tabId, title: '' }).catch(() => undefined);
    }, SHORTCUT_BADGE_MS);
  }

  // ---------- 扩展更新后重新注入（#22） ----------

  /**
   * 向已配置且已授权站点的已打开标签页注入内容脚本（Dark Reader 同类做法：更新后不必刷新页面）。
   * 只注入顶层框架，与动态注册一致；某个标签页失败（休眠、正在跳走）不影响其余。
   */
  async function reinjectOpenTabs(): Promise<void> {
    const profiles = await storage.listProfiles();
    const granted = await allGrantedPatterns(browser);
    if (!granted) return; // getAll 瞬时异常：这轮重新注入跳过（#186，与对账同一口径）
    const keys = new Set<string>();
    for (const p of profiles) {
      if ((await grantedPatternsOf(p.origin, granted)).length > 0) keys.add(p.origin);
    }
    if (keys.size === 0) return;
    let tabs: Browser.tabs.Tab[] = [];
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }
    // 子域页面也属于同一个站点：按站点 key 比较，别漏掉 s.weibo.com 这类标签页
    const targets = tabs.filter((t) => t.id !== undefined && !t.discarded && keys.has(siteKeyOfUrl(t.url) ?? ''));
    await Promise.allSettled(
      targets.map((t) =>
        browser.scripting.executeScript({
          target: { tabId: t.id! },
          files: [CONTENT_SCRIPT_FILE] as unknown as ScriptPublicPath[],
        }),
      ),
    );
  }

  // ---------- 一键清空 ----------

  /** 通知某站点（含其子域）所有已打开的标签页立即还原（内容脚本按自己记录的样式文本移除）。
   *  慢页面给两轮超时（#202）：授权收回去之后它的 removeCSS 必败，会留一份删不掉的
   *  隐藏样式直到下次导航，所以多等一轮再走 REVIEW B7 的收回步骤 */
  async function restoreOpenTabs(key: string): Promise<void> {
    let tabs: Browser.tabs.Tab[] = [];
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }
    const targets = tabs
      .filter((t) => t.id !== undefined && siteKeyOfUrl(t.url) === key)
      .map((t) => t.id!);
    await Promise.all(
      targets.map(async (tabId) => {
        // 应答或送达失败（内容脚本不在）都算「有了结果」；只有干等超时才需要第二轮
        const ack = browser.tabs.sendMessage(tabId, { t: 'siteReset' }).then(
          () => true,
          () => true,
        );
        const timeout = () => new Promise<false>((resolve) => setTimeout(() => resolve(false), SITE_RESET_TIMEOUT_MS));
        if (await Promise.race([ack, timeout()])) return;
        await Promise.race([ack, timeout()]);
      }),
    );
  }

  /** 顺序：先还原已打开页面（此时仍有站点授权，样式才删得掉），再收回授权、注销、删配置（REVIEW B7） */
  async function resetSite(input: string): Promise<Ack> {
    const key = siteKey(input);
    if (!key) return { ok: false, error: 'invalid site key' };
    const granted = await allGrantedPatterns(browser);
    // permissions.remove 是原子的：批次里任何一条当前未被授予，整批拒绝、一条都不收回（#202）。
    // 批次只能装「实际持有」的模式（含迁移前用户的旧精确模式）；getAll 瞬时异常（#186）拿不到
    // 实况时，才回退规范两条尽力而为——删除动作照常完成，不能整个中断。
    // 全站通配（*://*/*）归不进任何站点，同样跳过：删一个站不该动全局授权
    const held = granted ? grantedPatternsFor(key, granted) : null;
    const patterns = held ?? sitePatterns(key);
    await restoreOpenTabs(key);
    if (held === null || held.length > 0) {
      try {
        await browser.permissions.remove({ origins: patterns });
      } catch {
        // 忽略
      }
    }
    try {
      await browser.scripting.unregisterContentScripts({ ids: [registrationPlan(key, patterns).id] });
    } catch {
      // 未注册过时忽略
    }
    await storage.deleteProfile(key);
    return { ok: true };
  }

  /**
   * 页面 ⋯ 菜单里的「删除这个网站的设置」（#56）：与 resetSite 同一套收尾，只是由内容脚本发起。
   * 只认网页标签页发来的消息，且只删它自己所在的站点（不信消息里的任何来源字段）。
   */
  async function resetSiteHere(sender: Sender): Promise<Ack> {
    const key = sender.tab ? siteKeyOfUrl(sender.url) : null;
    if (!key) return { ok: false, error: 'no sender tab' };
    return resetSite(key);
  }

  /** 向导取消且站点仍没有配置：收回刚给的授权与注册（有配置说明别处已保存，不动） */
  async function cancelNewSite(sender: Sender): Promise<Ack> {
    const key = sender.tab ? siteKeyOfUrl(sender.url) : null;
    if (!key) return { ok: false, error: 'no sender tab' };
    if (await storage.getProfile(key)) return { ok: true };
    const granted = await allGrantedPatterns(browser);
    // 批次口径同 resetSite（#202）：只装实际持有的模式；getAll 瞬时异常（#186）才回退规范两条
    const held = granted ? grantedPatternsFor(key, granted) : null;
    const patterns = held ?? sitePatterns(key);
    try {
      await browser.scripting.unregisterContentScripts({ ids: [registrationPlan(key, patterns).id] });
    } catch {
      // 新站点本来就没注册
    }
    if (held === null || held.length > 0) {
      try {
        await browser.permissions.remove({ origins: patterns });
      } catch {
        // 忽略
      }
    }
    return { ok: true };
  }

  // ---------- 幕布静音（0.8.0，#131，ADR-0013） ----------

  /** 每个标签页一条静音写入队列：遮 / 撤两条消息的 check-then-act 不许交错（审查轮 #2），
   *  后进队的后写，最终状态 = 最后一条消息的方向。链落定即清掉条目（#186）：
   *  SW 生命周期里不 accumulate 已完成链条目 */
  const muteChains = new Map<number, Promise<unknown>>();

  /** 挂到该标签页静音队列的尾部。链落定后清掉 Map 条目：只有这条链还是队尾时才删——
   *  并发的新消息此刻已经 set 进了更新的链，误删会丢掉它的排队标记（#186） */
  function enqueueMuteStep<R>(tabId: number, run: () => Promise<R>): Promise<R> {
    const prev = muteChains.get(tabId) ?? Promise.resolve();
    const next = prev.then(run, run);
    const tail = next.catch(() => undefined);
    muteChains.set(tabId, tail);
    void tail.finally(() => {
      if (muteChains.get(tabId) === tail) muteChains.delete(tabId);
    });
    return next;
  }

  /**
   * 只解除「确实是本扩展静音的」标签页：Chrome 46+ 的 MutedInfo 提供 reason 与 extensionId
   * （官方 tabs API）。用户手动静音、Chrome 自带的「静音网站」、别的扩展设的静音一律不碰。
   */
  function mutedByUs(info: { muted: boolean; reason?: string; extensionId?: string } | undefined): boolean {
    return !!info?.muted && info.reason === 'extension' && info.extensionId === browser.runtime.id;
  }

  /**
   * 幕布的标签页静音：遮住即静音 sender 所在的标签页，恢复（或刷新 / 离开页面）即还原。
   * 方向由消息带，tabId 只认 sender——内容脚本 / 一次性脚本只能动自己所在的标签页。
   * 幂等：已静音就不再写；解除只认 mutedByUs，不碰用户手动静音的那份。
   * 同一标签页的操作按消息到达顺序串行执行：遮 → 撤连发时各自都要 tabs.get 再决定写不写，
   * 并发交错会让解除读到静音落地前的旧快照而空过，留下哑标签页（审查轮 #2）。
   */
  function setCurtainMute(tabId: number, muted: boolean): Promise<Ack> {
    const run = async (): Promise<Ack> => {
      try {
        let tab: Browser.tabs.Tab | undefined;
        try {
          tab = await browser.tabs.get(tabId);
        } catch {
          return { ok: false, error: 'tab gone' }; // 标签页刚被关掉
        }
        const info = tab?.mutedInfo;
        if (muted) {
          // 已被任何人静音（含用户手动 / Chrome「静音网站」）就不重复写：解除时只解自己的那份
          if (!info?.muted) await browser.tabs.update(tabId, { muted: true });
        } else if (mutedByUs(info)) {
          await browser.tabs.update(tabId, { muted: false });
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    };
    return enqueueMuteStep(tabId, run);
  }

  /**
   * 兜底：幕布开着时整页跳转 / 刷新，若内容脚本没来得及（或没能）发解除消息，
   * 导航开始时把本扩展设的那份静音解掉——静音跟幕布生灭，不能跟着 URL 走进下一个页面。
   * 只在文档真正开始加载时触发（status === 'loading'）：SPA 站内换址不发 loading，
   * 幕布还开着、静音保持。任何导航都会到这里，先回查再动手，绝大多数标签页是无操作。
   * 与遮 / 撤消息共用同一条每标签页队列，避免兜底解除与用户刚发的遮住交错。
   */
  function releaseCurtainMuteOnNavigation(tabId: number): Promise<void> {
    const run = async (): Promise<void> => {
      try {
        const tab = await browser.tabs.get(tabId);
        if (mutedByUs(tab?.mutedInfo)) await browser.tabs.update(tabId, { muted: false });
      } catch {
        // 标签页刚被关掉：没有需要收尾的状态
      }
    };
    return enqueueMuteStep(tabId, run);
  }

  /** 扩展更新 / 重载后的静音清扫：所有标签页逐个走解除（只动 mutedByUs 的那份） */
  async function releaseAllCurtainMutes(): Promise<void> {
    let tabs: Browser.tabs.Tab[];
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }
    for (const t of tabs) {
      if (t.id !== undefined) void releaseCurtainMuteOnNavigation(t.id);
    }
  }

  // ---------- 隐藏样式（按文档） ----------

  /**
   * 发送方文档：documentId 精确定位（bfcache / 预渲染 / 跨页时序都不会错位）；
   * 旧版浏览器没有 documentId 时退回 frameId（两者不能同时给）。
   */
  function documentTarget(sender: Sender, tabId: number): CssTarget {
    return sender.documentId
      ? { tabId, documentIds: [sender.documentId] }
      : { tabId, frameIds: [sender.frameId ?? 0] };
  }

  /**
   * 把文档里的一份样式从 prev 换成 next：相同跳过；不同先插新、后删旧（中间没有无样式的空档，不闪）。
   * origin 必须与插入时完全一致（'USER'，ADR-0002 用户样式表通道），否则删不掉。
   */
  async function swapCss(target: CssTarget, prev: string | null, next: string | null): Promise<CssAck> {
    if (prev === next) return { ok: true, css: next };
    if (next) {
      try {
        await browser.scripting.insertCSS({ target, css: next, origin: 'USER' });
      } catch (e) {
        return { ok: false, error: String(e), css: prev };
      }
    }
    if (prev) {
      try {
        await browser.scripting.removeCSS({ target, css: prev, origin: 'USER' });
      } catch (e) {
        return { ok: false, error: String(e), css: next };
      }
    }
    return { ok: true, css: next };
  }

  /** 正式样式的目标文本：按存储里的站点配置与发送方文档的真实地址（sender.url）计算。
   *  0.8.3 起规则与灰度的生效条件在 buildDisguiseCss 内部分开：规则跟主开关，灰度独立于两态 */
  async function disguiseCssFor(url: string): Promise<string | null> {
    const key = siteKey(url);
    if (!key) return null;
    const profile = await storage.getProfile(key);
    return profile ? buildDisguiseCss(profile, url) : null;
  }

  /**
   * 判断生效范围用的地址：内容脚本报上来的本页地址（SPA 路由刚变化时 sender.url 可能还是旧的），
   * 但只在与 sender.url 同站点时采用——来源一律以浏览器给的 sender.url 为准。
   * 站点身份按 key 比较（#162）：同一网站内的子域不会再被当成"换了个站点"。
   */
  function scopeUrl(sender: Sender, claimed: unknown): string | undefined {
    const claimedKey = typeof claimed === 'string' ? siteKey(claimed) : null;
    const senderKey = sender.url ? siteKey(sender.url) : null;
    if (claimedKey && senderKey && claimedKey === senderKey) return claimed as string;
    return sender.url;
  }

  async function handleCss(msg: BgRequest, sender: Sender): Promise<CssAck> {
    const prev = 'prev' in msg && typeof msg.prev === 'string' ? msg.prev : null;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return { ok: false, error: 'no sender tab', css: prev };
    const target = documentTarget(sender, tabId);
    switch (msg.t) {
      case 'applyDisguise': {
        const url = scopeUrl(sender, msg.url);
        if (!url) return { ok: false, error: 'no sender url', css: prev };
        let next: string | null;
        try {
          next = await disguiseCssFor(url);
        } catch (e) {
          return { ok: false, error: String(e), css: prev };
        }
        return swapCss(target, prev, next);
      }
      case 'restoreOriginal':
        return swapCss(target, prev, null);
      case 'draftCss':
        return swapCss(target, prev, typeof msg.next === 'string' && msg.next ? msg.next : null);
      case 'hostShield':
        // 文本固定由后台决定（core/host-shield.ts）；交接来的旧版本文本在这里换成当前版本
        return swapCss(target, prev, msg.on === true ? HOST_SHIELD_CSS : null);
      case 'releaseOrphanCss': {
        // 失联旧实例留下的样式各撤一份（文本按当前版本与配置重算；对不上时 removeCSS 是空操作）
        const url = scopeUrl(sender, msg.url);
        let formal: string | null = null;
        try {
          formal = url ? await disguiseCssFor(url) : null;
        } catch {
          // 地址异常：只撤保护样式
        }
        for (const css of [HOST_SHIELD_CSS, formal]) {
          if (!css) continue;
          try {
            await browser.scripting.removeCSS({ target, css, origin: 'USER' });
          } catch {
            // 文档已不在 / 没有这份样式
          }
        }
        return { ok: true, css: null };
      }
      default:
        return { ok: false, error: 'unknown message', css: prev };
    }
  }

  async function handleReconcile(): Promise<ReconcileResponse> {
    try {
      return { ok: true, pending: await reconcile() };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function handle(msg: BgRequest, sender: Sender): Promise<Reply> | null {
    switch (msg?.t) {
      case 'enableSite':
        return fromExtensionPage(sender) ? enableSite(msg) : Promise.resolve(FORBIDDEN);
      case 'coverPage':
        return fromExtensionPage(sender) ? coverPage(msg.tabId) : Promise.resolve(FORBIDDEN);
      case 'resetSite':
        return fromExtensionPage(sender) ? resetSite(msg.origin) : Promise.resolve(FORBIDDEN);
      case 'resetSiteHere':
        return resetSiteHere(sender);
      case 'openSettings':
        // 只接受来自标签页的内容脚本（sender.tab 存在）：这是页面上的胶囊发起的
        return sender.tab ? openSettings(msg.section) : Promise.resolve(FORBIDDEN);
      case 'curtainMute':
        // 幕布静音（0.8.0）：只接受来自标签页的脚本（内容脚本 / 一次性脚本），tabId 只认 sender
        return sender.tab?.id === undefined
          ? Promise.resolve({ ok: false, error: 'no sender tab' } satisfies Ack)
          : setCurtainMute(sender.tab.id, msg.muted === true);
      case 'reconcile':
        return fromExtensionPage(sender) ? handleReconcile() : Promise.resolve(FORBIDDEN);
      case 'cancelNewSite':
        return cancelNewSite(sender);
      case 'applyDisguise':
      case 'restoreOriginal':
      case 'draftCss':
      case 'hostShield':
      case 'releaseOrphanCss':
        return handleCss(msg, sender);
      default:
        return null;
    }
  }

  browser.runtime.onMessage.addListener((msg: BgRequest, sender, sendResponse) => {
    // 需要请求权限的启用站点：必须在这里直接发起请求，不能先走 handle()（async 函数里的第一个 await
    // 就会让用户手势失效）。fromExtensionPage 是同步的，可以先判来源。
    const pending =
      msg?.t === 'enableSite' && msg.requestPermission
        ? fromExtensionPage(sender)
          ? requestPermissionThenEnable(msg)
          : Promise.resolve(FORBIDDEN)
        : handle(msg, sender);
    if (!pending) return false; // 不是给后台的消息（例如发往内容脚本的），不占用回复通道
    pending.then(sendResponse, (e: unknown) => sendResponse({ ok: false, error: String(e) }));
    return true; // 异步回复：保持通道直到 sendResponse
  });

  // ---------- 生命周期事件 → 对账 ----------

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update') {
      // 扩展更新 / 重载：已打开页面里的旧内容脚本失联了（界面还在、标题守卫还在压标题，却连不上扩展）。
      // 对账补注册后，向这些标签页注入新脚本：新实例接管（旧实例收尾、交出样式记录，见 entrypoints/content.ts）
      reconcile()
        .then(reinjectOpenTabs)
        .catch((e: unknown) => console.warn('[PageMask] 更新后对账 / 重新注入失败', e));
      // 幕布静音清扫（审查轮二）：重注入只覆盖已配置站点，未配置站点的一次性幕布页不在其中，
      // 旧实例的解除消息又发不出去。扩展重载后幕布本身已死，任何本扩展设的静音都是残留——
      // 全部标签页过一遍，只解除 mutedByUs 的那份（走每标签页队列，避免与迟到的消息交错）
      void releaseAllCurtainMutes();
    } else {
      reconcileInBackground(`onInstalled:${details.reason}`);
    }
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });
  browser.runtime.onStartup.addListener(() => reconcileInBackground('onStartup'));
  browser.permissions.onAdded.addListener(() => reconcileInBackground('permissions.onAdded'));
  browser.permissions.onRemoved.addListener(() => reconcileInBackground('permissions.onRemoved'));

  // 快捷键：遮住（#101）与整页变灰（0.9.2，ADR-0020 修订 ADR-0010 的「全产品只此一条」）。
  // 变灰路径的权限请求必须在这里同一同步回合发起——监听器把 tab 事件参数直接传下去，不再查询。
  browser.commands?.onCommand?.addListener((command, tab) => {
    if (command === 'toggle-media-gray') return toggleGrayByShortcut(tab);
    if (command !== 'toggle-curtain') return;
    // 返回 Promise 只为了单测能等它跑完；Chrome 不关心 onCommand 的返回值
    return toggleCurtainByShortcut();
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // 界面语言变化（#202）：角标悬停说明跟着设置走
    if ('settings' in changes) syncBackgroundLocale();
    // 只关心站点配置的创建与删除；规则、开关、体检回写等修改不影响注册
    const lifecycle = Object.entries(changes).some(
      // Chrome 省略不存在的一侧；按 == null 判断，兼容给 null 的实现
      ([k, c]) => k.startsWith(PROFILE_PREFIX) && (c.oldValue == null) !== (c.newValue == null),
    );
    if (!lifecycle) return;
    void reconcileInBackground('storage');
  });

  /**
   * 幕布静音的兜底（0.8.0，ADR-0013）：正常路径由内容脚本的 pagehide 发解除消息；
   * 内容脚本被杀 / 失联时，文档重新开始加载（status === 'loading'）在这里补一次单向解除。
   * 刻意不监听 mutedInfo 变化：那会追着用户手动取消静音按回去（想临时听一下应该能听）。
   */
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'loading') return;
    void releaseCurtainMuteOnNavigation(tabId);
  });

  // 标签页关闭（#186）：静音队列的记录随之清掉——标签页都没了，队列不可能再有后继。
  // 进行中的一步落定后走 enqueueMuteStep 自己的清理；这里只是不让已关闭标签页的条目留在 Map 里
  browser.tabs.onRemoved.addListener((tabId) => {
    muteChains.delete(tabId);
  });
}
