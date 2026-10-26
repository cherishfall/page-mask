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

/** 内容脚本所在文档（后台按 sender 定位文档、判断生效范围） */
const DOC_SENDER = { tab: TAB, frameId: 0, documentId: 'doc-A', url: `${ORIGIN}/home` };

/**
 * 模拟一条消息进入后台，返回经 sendResponse 回传的结果。
 * 同时断言"回调式回复"：监听器返回 true 保持通道（Chrome 148 以下不支持用返回的 Promise 回复）。
 */
async function send(msg: unknown, sender: object = {}) {
  let reply!: (v: unknown) => void;
  const replied = new Promise((r) => (reply = r));
  const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger(msg, sender as never, reply as never);
  expect(returned.filter((r) => r !== undefined && r !== false)).toEqual([true]);
  return replied;
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

  it('回调式回复：只支持 sendResponse 的浏览器下也能拿到结果（监听器同步返回 true，而不是 Promise）', async () => {
    const sendResponse = vi.fn();
    const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
      { t: 'enableSite', origin: ORIGIN, tabId: 3 },
      {} as never,
      sendResponse,
    );
    expect(returned).toContain(true);
    expect(returned.some((r) => r instanceof Promise)).toBe(false);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
  });

  it('未知消息不占用回复通道', async () => {
    const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger({ t: 'nope' }, {} as never, () => undefined);
    expect(returned.every((r) => r !== true)).toBe(true);
  });

  it('applyDisguise：按发送方文档注入隐藏样式，回传已注入文本', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });

    const res = (await send({ t: 'applyDisguise', prev: null }, DOC_SENDER)) as { ok: boolean; css: string };

    expect(res.ok).toBe(true);
    expect(res.css).toContain('#promo-banner');
    expect(stubs.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: TAB.id, documentIds: ['doc-A'] },
      css: res.css,
      origin: 'USER',
    });
  });

  it('applyDisguise：生效范围按 sender.url 判断（不信任消息里的地址）', async () => {
    const p = disguisedProfile();
    p.hideRules[0]!.scope = { type: 'include', patterns: [{ label: '书架', prefix: `${ORIGIN}/shelf` }] };
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: p });

    const res = (await send(
      { t: 'applyDisguise', prev: null, url: `${ORIGIN}/shelf/1` },
      { ...DOC_SENDER, url: `${ORIGIN}/home` },
    )) as { ok: boolean; css: string | null };

    expect(res).toEqual({ ok: true, css: null });
    expect(stubs.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it('applyDisguise：文本与本文档已注入的相同则跳过（不闪）', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });
    const first = (await send({ t: 'applyDisguise', prev: null }, DOC_SENDER)) as { css: string };
    stubs.scripting.insertCSS.mockClear();

    const again = await send({ t: 'applyDisguise', prev: first.css }, DOC_SENDER);

    expect(again).toEqual({ ok: true, css: first.css });
    expect(stubs.scripting.insertCSS).not.toHaveBeenCalled();
    expect(stubs.scripting.removeCSS).not.toHaveBeenCalled();
  });

  it('applyDisguise：文本变了先插新、再删旧（中间不出现无样式的空档）', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });
    const order: string[] = [];
    stubs.scripting.insertCSS.mockImplementation(async ({ css }) => void order.push(`insert:${css}`));
    stubs.scripting.removeCSS.mockImplementation((async ({ css }: { css: string }) => void order.push(`remove:${css}`)) as never);

    const res = (await send({ t: 'applyDisguise', prev: 'OLD' }, DOC_SENDER)) as { css: string };

    expect(order).toEqual([`insert:${res.css}`, 'remove:OLD']);
    expect(stubs.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: TAB.id, documentIds: ['doc-A'] },
      css: 'OLD',
      origin: 'USER',
    });
  });

  it('applyDisguise：站点切到原样时移除本文档的旧样式', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: createEmptyProfile(ORIGIN) });

    const res = await send({ t: 'applyDisguise', prev: 'OLD' }, DOC_SENDER);

    expect(res).toEqual({ ok: true, css: null });
    expect(stubs.scripting.insertCSS).not.toHaveBeenCalled();
    expect(stubs.scripting.removeCSS).toHaveBeenCalledWith(expect.objectContaining({ css: 'OLD' }));
  });

  it('restoreOriginal：后台不靠内存记录（SW 回收后的新实例）也能移除内容脚本报上来的样式', async () => {
    // beforeEach 刚创建的后台实例从没注入过任何东西，等价于 SW 被回收后重启
    const res = await send({ t: 'restoreOriginal', prev: 'CSS-A' }, DOC_SENDER);

    expect(res).toEqual({ ok: true, css: null });
    expect(stubs.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: TAB.id, documentIds: ['doc-A'] },
      css: 'CSS-A',
      origin: 'USER',
    });
  });

  it('draftCss：预览样式同样按 prev/next 在本文档内替换', async () => {
    expect(await send({ t: 'draftCss', prev: null, next: 'D1' }, DOC_SENDER)).toEqual({ ok: true, css: 'D1' });
    expect(await send({ t: 'draftCss', prev: 'D1', next: null }, DOC_SENDER)).toEqual({ ok: true, css: null });
    expect(stubs.scripting.insertCSS).toHaveBeenCalledWith(expect.objectContaining({ css: 'D1' }));
    expect(stubs.scripting.removeCSS).toHaveBeenCalledWith(expect.objectContaining({ css: 'D1' }));
  });

  it('注入失败：回复 ok:false，并告知文档里仍是旧样式', async () => {
    stubs.scripting.insertCSS.mockRejectedValueOnce(new Error('No document with id'));

    const res = (await send({ t: 'draftCss', prev: 'D1', next: 'D2' }, DOC_SENDER)) as {
      ok: boolean;
      css: string | null;
      error?: string;
    };

    expect(res.ok).toBe(false);
    expect(res.css).toBe('D1');
    expect(res.error).toContain('No document');
    expect(stubs.scripting.removeCSS).not.toHaveBeenCalled();
  });

  it('发送方没有 documentId（旧版浏览器）时退回按 frameId 定位', async () => {
    await send({ t: 'draftCss', prev: null, next: 'D1' }, { tab: TAB, frameId: 0, url: `${ORIGIN}/home` });
    expect(stubs.scripting.insertCSS).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: TAB.id, frameIds: [0] } }),
    );
  });

  it('样式消息：没有发送方标签页时拒绝', async () => {
    const res = await send({ t: 'applyDisguise', prev: null });
    expect(res).toEqual({ ok: false, error: 'no sender tab', css: null });
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
