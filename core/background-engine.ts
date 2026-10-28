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
import { CONTENT_SCRIPT_FILE, CURTAIN_ONESHOT_FILE, originPattern, registrationPlan } from './registration';
import { HOST_SHIELD_CSS } from './host-shield';
import { planReconcile, type RegisteredScript } from './reconcile';
import type {
  Ack,
  BgRequest,
  CssAck,
  EnableSiteRequest,
  EnableSiteResponse,
  OpenIntent,
  ReconcileResponse,
} from './messages';

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

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createBackground({ browser }: BackgroundDeps): void {
  const storage = createPageMaskStorage(browser.storage.local);
  const extensionBase = browser.runtime.getURL('/');

  /** 特权消息只接受本扩展自己的页面（popup / 管理页 / 引导页），网页里的内容脚本一律拒绝（REVIEW B26） */
  function fromExtensionPage(sender: Sender): boolean {
    return sender.id === browser.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(extensionBase);
  }

  async function isGranted(origin: string): Promise<boolean> {
    try {
      return await browser.permissions.contains({ origins: [originPattern(origin)] });
    } catch {
      return false; // 非法来源（旧版导入的脏数据）当作没授权
    }
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
    const granted = (await Promise.all(configured.map(async (o) => ((await isGranted(o)) ? o : null)))).filter(
      (o): o is string => o !== null,
    );
    const registered = (await browser.scripting.getRegisteredContentScripts()) as RegisteredScript[];
    const plan = planReconcile({ configured, granted, registered });

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
   */
  function requestPermissionThenEnable(msg: EnableSiteRequest): Promise<Reply> {
    let requested: Promise<boolean>;
    try {
      requested = browser.permissions.request({ origins: [originPattern(msg.origin)] });
    } catch (e) {
      if (/gesture/i.test(String(e))) {
        return Promise.resolve({ ok: false, code: 'gestureLost', error: String(e) } satisfies EnableSiteResponse);
      }
      return Promise.resolve({ ok: false, code: 'notGranted', error: String(e) } satisfies EnableSiteResponse);
    }
    return requested.then(
      (granted) =>
        granted ? enableSite(msg) : ({ ok: false, code: 'denied', error: 'user denied site access' } satisfies EnableSiteResponse),
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
    const { origin, tabId } = msg;
    const open: OpenIntent | undefined = msg.open === 'newSite' || msg.open === 'addElement' ? msg.open : undefined;
    // 核对标签页当前确实停在这个站点：popup 打开后页面可能已跳走，授权不能落到别的站点（REVIEW B27）
    let tabOrigin: string | null = null;
    try {
      tabOrigin = originOf((await browser.tabs.get(tabId))?.url);
    } catch {
      // 标签页已关闭
    }
    if (tabOrigin !== origin) return { ok: false, code: 'tabMismatch', error: 'tab is not on this site' };
    if (!(await isGranted(origin))) return { ok: false, code: 'notGranted', error: 'site access not granted' };
    try {
      // 已配置的站点在这里补注册；新站点没有配置，不注册（保存向导时写入配置，再由对账注册）
      await reconcile();
      // 已打开的标签页立即注入（registerContentScripts 只影响后续导航）。
      // 路径运行时动态确定，超出 WXT 静态 ScriptPublicPath 联合类型，此处断言。
      await browser.scripting.executeScript({
        target: { tabId },
        files: registrationPlan(origin).js as unknown as ScriptPublicPath[],
      });
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
      return { ok: false, code: 'injectFailed', error: String(e) };
    }
  }

  // ---------- 未添加网站的幕布（#46） ----------

  /**
   * popup 的「遮住本页」：把一次性幕布脚本注入当前标签页。
   * 未添加的网站里没有内容脚本（ADR-0001：未配置零注入），只能走这条——activeTab 在用户点
   * 工具栏图标时授予，注入不需要站点授权，也不注册、不写配置；脚本随文档消失。
   * 幂等由脚本自己保证：已遮住时再注入一次什么都不做。
   */
  async function coverPage(tabId: number): Promise<Ack> {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CURTAIN_ONESHOT_FILE] as unknown as ScriptPublicPath[],
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // ---------- 扩展更新后重新注入（#22） ----------

  /**
   * 向已配置且已授权站点的已打开标签页注入内容脚本（Dark Reader 同类做法：更新后不必刷新页面）。
   * 只注入顶层框架，与动态注册一致；某个标签页失败（休眠、正在跳走）不影响其余。
   */
  async function reinjectOpenTabs(): Promise<void> {
    const profiles = await storage.listProfiles();
    const origins = new Set<string>();
    for (const p of profiles) if (await isGranted(p.origin)) origins.add(p.origin);
    if (origins.size === 0) return;
    let tabs: Browser.tabs.Tab[] = [];
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }
    const targets = tabs.filter((t) => t.id !== undefined && !t.discarded && origins.has(originOf(t.url) ?? ''));
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

  /** 通知某站点所有已打开的标签页立即还原（内容脚本按自己记录的样式文本移除），带超时 */
  async function restoreOpenTabs(origin: string): Promise<void> {
    let tabs: Browser.tabs.Tab[] = [];
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }
    const targets = tabs.filter((t) => t.id !== undefined && originOf(t.url) === origin);
    await Promise.allSettled(
      targets.map((t) =>
        Promise.race([
          browser.tabs.sendMessage(t.id!, { t: 'siteReset' }),
          new Promise((resolve) => setTimeout(resolve, SITE_RESET_TIMEOUT_MS)),
        ]),
      ),
    );
  }

  /** 顺序：先还原已打开页面（此时仍有站点授权，样式才删得掉），再收回授权、注销、删配置（REVIEW B7） */
  async function resetSite(origin: string): Promise<Ack> {
    await restoreOpenTabs(origin);
    try {
      // 非法 origin（如旧版导入的脏数据）会让这里抛错；不能因此删不掉配置
      await browser.permissions.remove({ origins: [originPattern(origin)] });
    } catch {
      // 忽略
    }
    try {
      await browser.scripting.unregisterContentScripts({ ids: [registrationPlan(origin).id] });
    } catch {
      // 未注册过时忽略
    }
    await storage.deleteProfile(origin);
    return { ok: true };
  }

  /** 新站点首次向导被取消：站点仍没有配置时，收回刚给的授权与注册（有配置说明别处已保存，不动） */
  async function cancelNewSite(sender: Sender): Promise<Ack> {
    const origin = sender.tab ? originOf(sender.url) : null;
    if (!origin) return { ok: false, error: 'no sender tab' };
    if (await storage.getProfile(origin)) return { ok: true };
    try {
      await browser.scripting.unregisterContentScripts({ ids: [registrationPlan(origin).id] });
    } catch {
      // 新站点本来就没注册
    }
    try {
      await browser.permissions.remove({ origins: [originPattern(origin)] });
    } catch {
      // 忽略
    }
    return { ok: true };
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

  /** 正式样式的目标文本：按存储里的站点配置与发送方文档的真实地址（sender.url）计算 */
  async function disguiseCssFor(url: string): Promise<string | null> {
    const profile = await storage.getProfile(new URL(url).origin);
    return profile && profile.switchState === 'disguised' ? buildDisguiseCss(profile.hideRules, url) : null;
  }

  /**
   * 判断生效范围用的地址：内容脚本报上来的本页地址（SPA 路由刚变化时 sender.url 可能还是旧的），
   * 但只在与 sender.url 同源时采用——来源一律以浏览器给的 sender.url 为准
   */
  function scopeUrl(sender: Sender, claimed: unknown): string | undefined {
    if (typeof claimed === 'string' && sender.url && originOf(claimed) === originOf(sender.url)) return claimed;
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
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // 只关心站点配置的创建与删除；规则、开关、体检回写等修改不影响注册
    const lifecycle = Object.entries(changes).some(
      // Chrome 省略不存在的一侧；按 == null 判断，兼容给 null 的实现
      ([k, c]) => k.startsWith(PROFILE_PREFIX) && (c.oldValue == null) !== (c.newValue == null),
    );
    if (lifecycle) reconcileInBackground('storage');
  });
}
