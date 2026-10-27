/**
 * 后台引擎在 fakeBrowser 下的测试。
 * 接缝：runtime.onMessage（与 popup / 管理页 / 内容脚本发来的真实消息同一入口）、
 * 生命周期事件（onInstalled / onStartup / permissions.onAdded / onRemoved / storage.onChanged）+ storage.local。
 * fakeBrowser 不实现 scripting / permissions / tabs.sendMessage，这里用 vi.fn 做浏览器边界的替身：
 * 记录注册表与已授权来源，行为按 Chrome 文档（重复 id 报 "Duplicate script ID"）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBackground } from './background-engine';
import { registrationPlan } from './registration';
import { createEmptyProfile, type SiteProfile } from './types';

const ORIGIN = 'https://reader.example';
const OTHER = 'https://other.example';
const TAB = { id: 7 } as const;
const EXT_URL = 'chrome-extension://test-extension-id/';

/** 简易事件替身（fakeBrowser 的 permissions 事件未实现） */
function fakeEvent<A extends unknown[]>() {
  const listeners: ((...args: A) => unknown)[] = [];
  return {
    addListener: (l: (...args: A) => unknown) => void listeners.push(l),
    removeListener: () => undefined,
    hasListener: () => false,
    trigger: (...args: A) => Promise.all(listeners.map((l) => l(...args))),
  };
}

function stubBrowser() {
  type Reg = { id: string; matches?: string[]; js?: string[]; runAt?: string; persistAcrossSessions?: boolean };
  const registered = new Map<string, Reg>();
  const granted = new Set<string>();
  const scripting = {
    getRegisteredContentScripts: vi.fn(async (filter?: { ids?: string[] }) =>
      [...registered.values()].filter((s) => !filter?.ids || filter.ids.includes(s.id)),
    ),
    registerContentScripts: vi.fn(async (list: Reg[]) => {
      for (const s of list) if (registered.has(s.id)) throw new Error(`Duplicate script ID '${s.id}'`);
      for (const s of list) registered.set(s.id, { ...s });
    }),
    updateContentScripts: vi.fn(async (list: Reg[]) => {
      for (const s of list) registered.set(s.id, { ...registered.get(s.id), ...s });
    }),
    unregisterContentScripts: vi.fn(async (filter?: { ids?: string[] }) => {
      for (const id of filter?.ids ?? [...registered.keys()]) {
        if (!registered.has(id)) throw new Error(`Nonexistent script ID '${id}'`);
        registered.delete(id);
      }
    }),
    executeScript: vi.fn(async (_injection: { target: unknown; files?: string[]; func?: unknown; args?: unknown[] }) => [
      { result: true },
    ]),
    insertCSS: vi.fn(async (_injection: { css: string; target: unknown; origin?: string }) => undefined),
    removeCSS: vi.fn(async () => undefined),
  };
  Object.assign(fakeBrowser.scripting, scripting);
  const onAdded = fakeEvent<[{ origins?: string[] }]>();
  const onRemoved = fakeEvent<[{ origins?: string[] }]>();
  const permissions = {
    contains: vi.fn(async ({ origins }: { origins: string[] }) => origins.every((o) => granted.has(o))),
    remove: vi.fn(async ({ origins }: { origins: string[] }) => {
      for (const o of origins) granted.delete(o);
      return true;
    }),
    onAdded,
    onRemoved,
  };
  Object.assign(fakeBrowser.permissions, permissions);
  const sendMessage = vi.fn(async (_tabId: number, _msg: unknown): Promise<unknown> => ({ ok: true }));
  Object.assign(fakeBrowser.tabs, { sendMessage });
  return { scripting, permissions, registered, granted, sendMessage };
}

/** 内容脚本所在文档（后台按 sender 定位文档、判断生效范围） */
const DOC_SENDER = { id: 'test-extension-id', tab: TAB, frameId: 0, documentId: 'doc-A', url: `${ORIGIN}/home` };
/** 扩展自己的页面（popup / 管理页；管理页以标签页打开，所以也可能带 tab） */
const EXT_SENDER = { id: 'test-extension-id', url: `${EXT_URL}popup.html` };

/**
 * 模拟一条消息进入后台，返回经 sendResponse 回传的结果。
 * 同时断言"回调式回复"：监听器返回 true 保持通道（Chrome 148 以下不支持用返回的 Promise 回复）。
 */
async function send(msg: unknown, sender: object = EXT_SENDER) {
  let reply!: (v: unknown) => void;
  const replied = new Promise((r) => (reply = r));
  const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger(msg, sender as never, reply as never);
  expect(returned.filter((r) => r !== undefined && r !== false)).toEqual([true]);
  return replied;
}

function disguisedProfile(origin = ORIGIN): SiteProfile {
  const p = createEmptyProfile(origin);
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

const pattern = (o: string) => `${o}/*`;
const idOf = (o: string) => `pagemask:${o}`;

describe('后台引擎（fakeBrowser）', () => {
  let stubs: ReturnType<typeof stubBrowser>;
  /** 一个停在已配置站点上的标签页 */
  let siteTabId: number;

  beforeEach(async () => {
    fakeBrowser.reset();
    stubs = stubBrowser();
    createBackground({ browser: fakeBrowser });
    siteTabId = (await fakeBrowser.tabs.create({ url: `${ORIGIN}/book/1` })).id!;
  });

  async function configure(origin = ORIGIN, { grant = true } = {}) {
    if (grant) stubs.granted.add(pattern(origin));
    await fakeBrowser.storage.local.set({ [`profile:${origin}`]: disguisedProfile(origin) });
  }

  /** 后台监听器是 fire-and-forget 的，等对账结果落到注册表 */
  const eventually = (fn: () => void) => vi.waitFor(fn, { timeout: 1000, interval: 5 });

  // ---------- 对账触发点 ----------

  describe('对账', () => {
    it('扩展更新 / 重载后（onInstalled: update）补注册所有已配置且已授权的站点', async () => {
      await configure(ORIGIN);
      await configure(OTHER);
      await eventually(() => expect(stubs.registered.size).toBe(2));
      stubs.registered.clear(); // 浏览器在更新时清空了动态注册

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '0.1.0' } as never);

      await eventually(() => expect([...stubs.registered.keys()].sort()).toEqual([idOf(OTHER), idOf(ORIGIN)]));
      expect(stubs.registered.get(idOf(ORIGIN))).toEqual(registrationPlan(ORIGIN));
    });

    it('浏览器启动（onStartup）时对账', async () => {
      await configure(ORIGIN);
      await eventually(() => expect(stubs.registered.size).toBe(1));
      stubs.registered.clear();

      await fakeBrowser.runtime.onStartup.trigger();

      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(true));
    });

    it('授权被收回（permissions.onRemoved）：注销该站点，配置保留', async () => {
      await configure(ORIGIN);
      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(true));

      stubs.granted.delete(pattern(ORIGIN));
      await stubs.permissions.onRemoved.trigger({ origins: [pattern(ORIGIN)] });

      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(false));
      expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).not.toEqual({});
    });

    it('重新授权（permissions.onAdded）：补注册', async () => {
      await configure(ORIGIN, { grant: false });
      await eventually(() => expect(stubs.scripting.getRegisteredContentScripts).toHaveBeenCalled());
      expect(stubs.registered.size).toBe(0);

      stubs.granted.add(pattern(ORIGIN));
      await stubs.permissions.onAdded.trigger({ origins: [pattern(ORIGIN)] });

      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(true));
    });

    it('新站点保存（配置被创建）后补注册；配置被删除后注销', async () => {
      stubs.granted.add(pattern(ORIGIN));
      await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });
      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(true));

      await fakeBrowser.storage.local.remove(`profile:${ORIGIN}`);
      await eventually(() => expect(stubs.registered.has(idOf(ORIGIN))).toBe(false));
    });

    it('reconcile 消息：立即对账并回复待授权站点（导入之后用）', async () => {
      await configure(ORIGIN);
      await configure(OTHER, { grant: false });

      const res = await send({ t: 'reconcile' });

      expect(res).toEqual({ ok: true, pending: [OTHER] });
      expect([...stubs.registered.keys()]).toEqual([idOf(ORIGIN)]);
    });

    it('并发触发也不会重复注册（"Duplicate script ID" 不会冒出来）', async () => {
      await configure(ORIGIN);
      await eventually(() => expect(stubs.registered.size).toBe(1));
      stubs.registered.clear();

      const results = await Promise.all([send({ t: 'reconcile' }), send({ t: 'reconcile' }), send({ t: 'reconcile' })]);

      expect(results.every((r) => (r as { ok: boolean }).ok)).toBe(true);
      expect(stubs.registered.size).toBe(1);
    });

    it('浏览器侧已存在同 id 注册（Duplicate script ID）时吞掉并改为更新', async () => {
      await configure(ORIGIN);
      // 让 getRegistered 漏报一次（例如别的上下文刚注册），register 会撞上重复 id
      stubs.scripting.getRegisteredContentScripts.mockResolvedValueOnce([]);

      const res = await send({ t: 'reconcile' });

      expect(res).toEqual({ ok: true, pending: [] });
      expect(stubs.registered.has(idOf(ORIGIN))).toBe(true);
    });
  });

  // ---------- 特权消息只接受扩展页面 ----------

  describe('特权消息来源校验', () => {
    for (const msg of [
      { t: 'enableSite', origin: ORIGIN, tabId: 7 },
      { t: 'resetSite', origin: ORIGIN },
      { t: 'reconcile' },
    ]) {
      it(`${msg.t}：内容脚本（网页）发来时拒绝，不做任何事`, async () => {
        await configure(ORIGIN);
        await eventually(() => expect(stubs.registered.size).toBe(1));
        stubs.scripting.executeScript.mockClear();

        const res = (await send(msg, DOC_SENDER)) as { ok: boolean; code?: string };

        expect(res.ok).toBe(false);
        expect(res.code).toBe('forbidden');
        expect(stubs.scripting.executeScript).not.toHaveBeenCalled();
        expect(stubs.permissions.remove).not.toHaveBeenCalled();
        expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).not.toEqual({});
      });
    }

    it('别的扩展发来时拒绝', async () => {
      const res = (await send({ t: 'reconcile' }, { id: 'evil', url: 'chrome-extension://evil/x.html' })) as { ok: boolean };
      expect(res.ok).toBe(false);
    });

    it('以标签页打开的管理页（带 sender.tab）照常接受', async () => {
      const res = await send({ t: 'reconcile' }, { ...EXT_SENDER, url: `${EXT_URL}management.html`, tab: { id: 99 } });
      expect(res).toEqual({ ok: true, pending: [] });
    });
  });

  // ---------- enableSite ----------

  describe('enableSite', () => {
    it('已配置站点：对账注册并立即注入当前标签页', async () => {
      await configure(ORIGIN);

      const res = await send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId });

      expect(res).toEqual({ ok: true });
      expect(stubs.registered.has(idOf(ORIGIN))).toBe(true);
      expect(stubs.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: siteTabId },
        files: ['content-scripts/content.js'],
      });
    });

    it('新站点（还没有配置）：只注入当前标签页并打开向导，不注册、不写配置', async () => {
      stubs.granted.add(pattern(ORIGIN));

      const res = await send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId, open: 'newSite' });

      expect(res).toEqual({ ok: true });
      expect(stubs.registered.size).toBe(0);
      expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
      const calls = stubs.scripting.executeScript.mock.calls.map(([inj]) => inj);
      expect(calls[0]).toEqual({ target: { tabId: siteTabId }, files: ['content-scripts/content.js'] });
      expect(calls[1]).toEqual(expect.objectContaining({ target: { tabId: siteTabId }, args: ['newSite'] }));
    });

    it('标签页已不在该站点（跳走了 / 传错了）：拒绝，不注入', async () => {
      stubs.granted.add(pattern(ORIGIN));
      const otherTab = (await fakeBrowser.tabs.create({ url: `${OTHER}/x` })).id!;

      const res = (await send({ t: 'enableSite', origin: ORIGIN, tabId: otherTab })) as { ok: boolean; code?: string };

      expect(res).toEqual(expect.objectContaining({ ok: false, code: 'tabMismatch' }));
      expect(stubs.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('没有站点授权：回复 notGranted', async () => {
      const res = (await send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId })) as { ok: boolean; code?: string };
      expect(res).toEqual(expect.objectContaining({ ok: false, code: 'notGranted' }));
      expect(stubs.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('重复启用（双击）幂等：不重复注册、不报错', async () => {
      await configure(ORIGIN);
      const [a, b] = await Promise.all([
        send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId }),
        send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId }),
      ]);
      expect(a).toEqual({ ok: true });
      expect(b).toEqual({ ok: true });
      expect(stubs.registered.size).toBe(1);
    });

    it('注入失败时回复 injectFailed 与错误原因', async () => {
      await configure(ORIGIN);
      stubs.scripting.executeScript.mockRejectedValueOnce(new Error('Cannot access contents of the page'));

      const res = (await send({ t: 'enableSite', origin: ORIGIN, tabId: siteTabId })) as {
        ok: boolean;
        code?: string;
        error?: string;
      };

      expect(res.ok).toBe(false);
      expect(res.code).toBe('injectFailed');
      expect(res.error).toContain('Cannot access');
    });
  });

  // ---------- 回复通道 ----------

  it('回调式回复：只支持 sendResponse 的浏览器下也能拿到结果（监听器同步返回 true，而不是 Promise）', async () => {
    const sendResponse = vi.fn();
    const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
      { t: 'reconcile' },
      EXT_SENDER as never,
      sendResponse,
    );
    expect(returned).toContain(true);
    expect(returned.some((r) => r instanceof Promise)).toBe(false);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, pending: [] }));
  });

  it('未知消息不占用回复通道', async () => {
    const returned: unknown[] = await fakeBrowser.runtime.onMessage.trigger({ t: 'nope' }, {} as never, () => undefined);
    expect(returned.every((r) => r !== true)).toBe(true);
  });

  // ---------- 隐藏样式（按文档） ----------

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

  it('applyDisguise：非默认端口的同主机页面（匹配模式不写端口会命中所有端口）不注入', async () => {
    await fakeBrowser.storage.local.set({ [`profile:${ORIGIN}`]: disguisedProfile() });

    const res = await send({ t: 'applyDisguise', prev: null }, { ...DOC_SENDER, url: 'https://reader.example:8443/home' });

    expect(res).toEqual({ ok: true, css: null });
    expect(stubs.scripting.insertCSS).not.toHaveBeenCalled();
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

  // ---------- 一键清空 ----------

  describe('resetSite（一键清空）', () => {
    it('先通知该站点已打开的标签页还原，再收回授权、注销、删配置', async () => {
      await configure(ORIGIN);
      const otherTab = (await fakeBrowser.tabs.create({ url: `${OTHER}/x` })).id!;
      const order: string[] = [];
      stubs.sendMessage.mockImplementation(async (tabId: number) => {
        order.push(`siteReset:${tabId}`);
        return { ok: true };
      });
      stubs.permissions.remove.mockImplementation(async ({ origins }) => {
        order.push('permissions.remove');
        for (const o of origins) stubs.granted.delete(o);
        return true;
      });

      expect(await send({ t: 'resetSite', origin: ORIGIN })).toEqual({ ok: true });

      expect(stubs.sendMessage).toHaveBeenCalledWith(siteTabId, { t: 'siteReset' });
      expect(stubs.sendMessage).not.toHaveBeenCalledWith(otherTab, expect.anything());
      expect(order).toEqual([`siteReset:${siteTabId}`, 'permissions.remove']);
      expect(stubs.registered.size).toBe(0);
      expect(stubs.permissions.remove).toHaveBeenCalledWith({ origins: [pattern(ORIGIN)] });
      expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
    });

    it('标签页迟迟不回复（页面卡住 / 内容脚本不在）也会在超时后继续清空', async () => {
      await configure(ORIGIN);
      stubs.sendMessage.mockImplementation(() => new Promise(() => undefined));
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      try {
        const pending = send({ t: 'resetSite', origin: ORIGIN });
        await vi.advanceTimersByTimeAsync(5000);
        expect(await pending).toEqual({ ok: true });
      } finally {
        vi.useRealTimers();
      }
      expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
    });

    it('权限撤销抛错也照样删除配置', async () => {
      await configure(ORIGIN);
      stubs.permissions.remove.mockRejectedValueOnce(new Error('Invalid match pattern'));

      await send({ t: 'resetSite', origin: ORIGIN });

      expect(await fakeBrowser.storage.local.get(`profile:${ORIGIN}`)).toEqual({});
    });
  });

  // ---------- 新站点向导取消 ----------

  describe('cancelNewSite（新站点首次向导被取消）', () => {
    it('站点还没有配置：注销并收回本站授权', async () => {
      stubs.granted.add(pattern(ORIGIN));

      expect(await send({ t: 'cancelNewSite' }, DOC_SENDER)).toEqual({ ok: true });

      expect(stubs.permissions.remove).toHaveBeenCalledWith({ origins: [pattern(ORIGIN)] });
      expect(stubs.granted.has(pattern(ORIGIN))).toBe(false);
    });

    it('站点已有配置（例如另一个标签页刚保存过）：什么都不收回', async () => {
      await configure(ORIGIN);

      await send({ t: 'cancelNewSite' }, DOC_SENDER);

      expect(stubs.permissions.remove).not.toHaveBeenCalled();
      expect(stubs.granted.has(pattern(ORIGIN))).toBe(true);
    });

    it('不是来自网页标签页（没有 sender.tab / url）时拒绝', async () => {
      stubs.granted.add(pattern(ORIGIN));
      const res = (await send({ t: 'cancelNewSite' }, EXT_SENDER)) as { ok: boolean };
      expect(res.ok).toBe(false);
      expect(stubs.permissions.remove).not.toHaveBeenCalled();
    });
  });

  it('首次安装时打开引导页', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);

    const tabs = await fakeBrowser.tabs.query({});
    expect(tabs.map((t) => t.url)).toContain('chrome-extension://test-extension-id/onboarding.html');
  });
});
