/**
 * 后台引擎在 fakeBrowser 下的消息处理测试。
 * 接缝：runtime.onMessage（与 popup / 内容脚本发来的真实消息同一入口）+ storage.local。
 * fakeBrowser 不实现 scripting / permissions，这里用 vi.fn 记录调用（相当于浏览器边界的替身）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBackground } from './background-engine';
import { createEmptyProfile, type SiteProfile } from './types';

const ORIGIN = 'https://reader.example';
const TAB = { id: 7 } as const;

function stubScripting() {
  const registered = new Set<string>();
  const scripting = {
    getRegisteredContentScripts: vi.fn(async ({ ids }: { ids: string[] }) =>
      ids.filter((id) => registered.has(id)).map((id) => ({ id })),
    ),
    registerContentScripts: vi.fn(async (list: { id: string }[]) => {
      for (const s of list) registered.add(s.id);
    }),
    unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => {
      for (const id of ids) registered.delete(id);
    }),
    executeScript: vi.fn(async () => []),
    insertCSS: vi.fn(async (_injection: { css: string; target: unknown; origin?: string }) => undefined),
    removeCSS: vi.fn(async () => undefined),
  };
  Object.assign(fakeBrowser.scripting, scripting);
  const permissions = { remove: vi.fn(async () => true) };
  Object.assign(fakeBrowser.permissions, permissions);
  return { scripting, permissions, registered };
}

/** 模拟一条消息进入后台，返回监听器给出的回复 */
async function send(msg: unknown, sender: { tab?: { id: number } } = {}) {
  const results = await fakeBrowser.runtime.onMessage.trigger(msg, sender as never, () => undefined);
  return results.find((r) => r !== undefined);
}

function disguisedProfile(): SiteProfile {
  const p = createEmptyProfile(ORIGIN);
  p.switchState = 'disguised';
  p.hideRules = [
    {
      id: 'r1',
      elementName: '顶部横幅',
      candidates: ['#promo-banner'],
      strategy: 'remove',
      scope: { type: 'all' },
      onlyThis: false,
      createdAt: 1,
    },
  ];
  return p;
}

describe('后台引擎（fakeBrowser）', () => {
  let stubs: ReturnType<typeof stubScripting>;

  beforeEach(() => {
    fakeBrowser.reset();
    stubs = stubScripting();
    createBackground({ browser: fakeBrowser });
  });

  it('enableSite：为站点注册内容脚本并立即注入当前标签页', async () => {
    const res = await send({ t: 'enableSite', origin: ORIGIN, tabId: 3 });

    expect(res).toEqual({ ok: true });
    expect(stubs.registered.has(`pagemask:${ORIGIN}`)).toBe(true);
    expect(stubs.scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ matches: [`${ORIGIN}/*`], js: ['content-scripts/content.js'] }),
    ]);
    expect(stubs.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 3 } }),
    );
  });

  it('enableSite：同一站点重复启用不会重复注册', async () => {
    await send({ t: 'enableSite', origin: ORIGIN, tabId: 3 });
    await send({ t: 'enableSite', origin: ORIGIN, tabId: 4 });

    expect(stubs.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    expect(stubs.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it('enableSite：注入失败时回复 ok:false 与错误原因', async () => {
    stubs.scripting.executeScript.mockRejectedValueOnce(new Error('Cannot access contents of the page'));

    const res = (await send({ t: 'enableSite', origin: ORIGIN, tabId: 3 })) as { ok: boolean; error?: string };

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Cannot access');
  });

  it('applyDisguise：清爽态站点向发送方标签页注入隐藏样式；restoreOriginal 移除同一份样式', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });

    expect(await send({ t: 'applyDisguise', url: `${ORIGIN}/home` }, { tab: TAB })).toEqual({ ok: true });
    expect(stubs.scripting.insertCSS).toHaveBeenCalledTimes(1);
    const inserted = stubs.scripting.insertCSS.mock.calls[0]![0];
    expect(inserted.target).toEqual({ tabId: TAB.id });
    expect(inserted.css).toContain('#promo-banner');

    expect(await send({ t: 'restoreOriginal' }, { tab: TAB })).toEqual({ ok: true });
    expect(stubs.scripting.removeCSS).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: TAB.id }, css: inserted.css, origin: 'USER' }),
    );
  });

  it('applyDisguise：原样态站点不注入样式', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: createEmptyProfile(ORIGIN) });

    await send({ t: 'applyDisguise', url: `${ORIGIN}/home` }, { tab: TAB });

    expect(stubs.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it('applyDisguise：没有发送方标签页时拒绝', async () => {
    const res = await send({ t: 'applyDisguise', url: `${ORIGIN}/home` });

    expect(res).toEqual({ ok: false, error: 'no sender tab' });
  });

  it('resetSite：注销内容脚本、撤销站点权限并删除站点配置', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });
    await send({ t: 'enableSite', origin: ORIGIN, tabId: 3 });

    expect(await send({ t: 'resetSite', origin: ORIGIN })).toEqual({ ok: true });

    expect(stubs.registered.size).toBe(0);
    expect(stubs.permissions.remove).toHaveBeenCalledWith({ origins: [`${ORIGIN}/*`] });
    expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
  });

  it('resetSite：权限撤销抛错也照样删除配置', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });
    stubs.permissions.remove.mockRejectedValueOnce(new Error('Invalid match pattern'));

    await send({ t: 'resetSite', origin: ORIGIN });

    expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
  });

  it('首次安装时打开引导页', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    const tabs = await fakeBrowser.tabs.query({});
    expect(tabs.map((t) => t.url)).toContain('chrome-extension://test-extension-id/onboarding.html');
  });
});
