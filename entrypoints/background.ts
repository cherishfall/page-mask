/**
 * PageMask 后台注入引擎。
 * 职责：站点名单的动态内容脚本注册/注销、权限配套、隐藏样式（方案A/B）的
 * insertCSS/removeCSS 幂等注入、安装后拉起首次引导。
 * 方案 C（遮罩）由内容脚本的覆盖层承担；标题/图标由内容脚本直接改写。
 */
import { createPageMaskStorage } from '@/core/storage';
import { buildDisguiseCss } from '@/core/css-builder';
import { registrationPlan } from '@/core/registration';
import type { Ack, BgRequest, EnableSiteResponse } from '@/core/messages';

export default defineBackground(() => {
  const storage = createPageMaskStorage(browser.storage.local);
  /** 每个 tab 最近一次注入的 CSS 文本，用于幂等移除（SPA 软导航换范围时先移旧再注新） */
  const lastCssByTab = new Map<number, string>();

  browser.tabs.onRemoved.addListener((tabId) => {
    lastCssByTab.delete(tabId);
  });

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

  async function resetSite(origin: string): Promise<void> {
    const plan = registrationPlan(origin);
    try {
      await browser.scripting.unregisterContentScripts({ ids: [plan.id] });
    } catch {
      // 未注册过时忽略
    }
    await browser.permissions.remove({ origins: plan.matches });
    await storage.deleteProfile(origin);
  }

  async function applyDisguise(tabId: number, url: string): Promise<Ack> {
    const origin = new URL(url).origin;
    const profile = await storage.getProfile(origin);
    const prev = lastCssByTab.get(tabId);
    const css =
      profile && profile.switchState === 'disguised' ? buildDisguiseCss(profile.hideRules, url) : null;

    if (prev) {
      try {
        await browser.scripting.removeCSS({ target: { tabId }, css: prev });
      } catch {
        // 标签页已导航/关闭时忽略
      }
      lastCssByTab.delete(tabId);
    }
    if (css) {
      await browser.scripting.insertCSS({ target: { tabId }, css });
      lastCssByTab.set(tabId, css);
    }
    return { ok: true };
  }

  async function restoreOriginal(tabId: number): Promise<Ack> {
    const prev = lastCssByTab.get(tabId);
    if (prev) {
      try {
        await browser.scripting.removeCSS({ target: { tabId }, css: prev });
      } catch {
        // 忽略
      }
      lastCssByTab.delete(tabId);
    }
    return { ok: true };
  }

  browser.runtime.onMessage.addListener(
    (msg: BgRequest, sender): Promise<Ack | EnableSiteResponse> | undefined => {
      const tabId = sender.tab?.id;
      switch (msg?.t) {
        case 'enableSite':
          return enableSite(msg.origin, msg.tabId);
        case 'resetSite':
          return resetSite(msg.origin).then(() => ({ ok: true }));
        case 'applyDisguise':
          if (tabId === undefined) return Promise.resolve({ ok: false, error: 'no sender tab' });
          return applyDisguise(tabId, msg.url);
        case 'restoreOriginal':
          if (tabId === undefined) return Promise.resolve({ ok: false, error: 'no sender tab' });
          return restoreOriginal(tabId);
        default:
          return undefined;
      }
    },
  );

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });
});
