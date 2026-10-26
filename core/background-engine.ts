/**
 * PageMask 后台注入引擎（可注入 browser 的工厂，供后台入口与单测共用）。
 * 职责：站点名单的动态内容脚本注册/注销、权限配套、隐藏样式（方案A/B）按文档的
 * insertCSS/removeCSS、安装后拉起首次引导。
 * 方案 C（遮罩）由内容脚本的覆盖层承担；标题/图标由内容脚本直接改写。
 *
 * 无状态：注入记录由内容脚本按文档持有，随请求带来（见 core/messages.ts 顶部说明），
 * SW 随时被回收都不影响还原。
 *
 * 消息回复统一用 sendResponse + 监听器同步 return true（"返回 Promise 即回复"要 Chrome 148+ 且灰度放量）。
 *
 * 用法：
 *   后台入口：defineBackground(() => createBackground({ browser }))
 *   单测：    createBackground({ browser: fakeBrowser })，再 fakeBrowser.runtime.onMessage.trigger(msg, sender, sendResponse)
 */
import type { Browser, WxtBrowser } from 'wxt/browser';
import { createPageMaskStorage } from './storage';
import { buildDisguiseCss } from './css-builder';
import { registrationPlan } from './registration';
import type { Ack, BgRequest, CssAck, EnableSiteResponse } from './messages';

export interface BackgroundDeps {
  /** 扩展 API（生产传 wxt/browser 的 browser，单测传 fakeBrowser 并按需 stub scripting/permissions） */
  browser: WxtBrowser;
}

type Sender = Browser.runtime.MessageSender;
type CssTarget = Browser.scripting.InjectionTarget;

export function createBackground({ browser }: BackgroundDeps): void {
  const storage = createPageMaskStorage(browser.storage.local);

  async function registerSiteContentScript(origin: string): Promise<void> {
    const plan = registrationPlan(origin);
    const existing = await browser.scripting.getRegisteredContentScripts({
      ids: [plan.id],
    });
    if (existing.length === 0) {
      await browser.scripting.registerContentScripts([plan]);
    }
  }

  async function enableSite(origin: string, tabId: number): Promise<EnableSiteResponse> {
    try {
      await registerSiteContentScript(origin);
      // 已打开的标签页立即注入（registerContentScripts 只影响后续导航）。
      // 路径运行时动态确定，超出 WXT 静态 ScriptPublicPath 联合类型，此处断言。
      await browser.scripting.executeScript({
        target: { tabId },
        files: registrationPlan(origin).js as unknown as ScriptPublicPath[],
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async function resetSite(origin: string): Promise<Ack> {
    const plan = registrationPlan(origin);
    try {
      await browser.scripting.unregisterContentScripts({ ids: [plan.id] });
    } catch {
      // 未注册过时忽略
    }
    try {
      // 非法 origin（如旧版导入的脏数据）会让这里抛错；不能因此删不掉配置
      await browser.permissions.remove({ origins: plan.matches });
    } catch {
      // 忽略
    }
    await storage.deleteProfile(origin);
    return { ok: true };
  }

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

  async function handleCss(msg: BgRequest, sender: Sender): Promise<CssAck> {
    const prev = 'prev' in msg && typeof msg.prev === 'string' ? msg.prev : null;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return { ok: false, error: 'no sender tab', css: prev };
    const target = documentTarget(sender, tabId);
    switch (msg.t) {
      case 'applyDisguise': {
        if (!sender.url) return { ok: false, error: 'no sender url', css: prev };
        let next: string | null;
        try {
          next = await disguiseCssFor(sender.url);
        } catch (e) {
          return { ok: false, error: String(e), css: prev };
        }
        return swapCss(target, prev, next);
      }
      case 'restoreOriginal':
        return swapCss(target, prev, null);
      case 'draftCss':
        return swapCss(target, prev, typeof msg.next === 'string' && msg.next ? msg.next : null);
      default:
        return { ok: false, error: 'unknown message', css: prev };
    }
  }

  function handle(msg: BgRequest, sender: Sender): Promise<Ack | EnableSiteResponse | CssAck> | null {
    switch (msg?.t) {
      case 'enableSite':
        return enableSite(msg.origin, msg.tabId);
      case 'resetSite':
        return resetSite(msg.origin);
      case 'applyDisguise':
      case 'restoreOriginal':
      case 'draftCss':
        return handleCss(msg, sender);
      default:
        return null;
    }
  }

  browser.runtime.onMessage.addListener((msg: BgRequest, sender, sendResponse) => {
    const pending = handle(msg, sender);
    if (!pending) return false; // 不是给后台的消息（例如发往内容脚本的），不占用回复通道
    pending.then(sendResponse, (e: unknown) => sendResponse({ ok: false, error: String(e) }));
    return true; // 异步回复：保持通道直到 sendResponse
  });

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });
}
