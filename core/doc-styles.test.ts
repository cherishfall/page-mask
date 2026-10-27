/**
 * 内容脚本侧的文档样式记录（createDocStyles）。
 * 接缝：send（= browser.runtime.sendMessage）。这里用一个按 prev/next 协议工作的假后台，
 * 它维护"文档里实际存在的样式表"，可以直接观察有没有孤儿样式、有没有闪现空档。
 */
import { describe, expect, it } from 'vitest';
import { createDocStyles } from './doc-styles';
import type { BgRequest, CssAck } from './messages';

/** 假后台：sheets = 文档里实际存在的样式表；formalNext = 存储里当前应有的正式样式 */
function fakeBackground() {
  const sheets: string[] = [];
  const state = { formalNext: 'F1' as string | null, fail: false, gaps: 0 };
  const log: BgRequest[] = [];
  async function send(msg: BgRequest): Promise<CssAck> {
    log.push(msg);
    await new Promise((r) => setTimeout(r, Math.random() * 5)); // 打乱时序
    if (state.fail) return { ok: false, error: 'boom', css: 'prev' in msg ? msg.prev : null };
    const prev = 'prev' in msg ? msg.prev : null;
    const next =
      msg.t === 'applyDisguise'
        ? state.formalNext
        : msg.t === 'draftCss'
          ? msg.next
          : msg.t === 'hostShield' && msg.on
            ? 'SHIELD'
            : null;
    if (prev !== next) {
      if (next) sheets.push(next);
      if (prev) {
        const i = sheets.indexOf(prev);
        if (i >= 0) sheets.splice(i, 1);
      }
    }
    return { ok: true, css: next };
  }
  return { send, sheets, state, log };
}

describe('createDocStyles 按文档记录已注入样式', () => {
  it('正式样式：首次同步插入，之后切原样移除（请求里带上本文档的旧文本）', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);

    await styles.syncFormal();
    expect(bg.sheets).toEqual(['F1']);

    await styles.clearFormal();
    expect(bg.sheets).toEqual([]);
    expect(bg.log.at(-1)).toEqual({ t: 'restoreOriginal', prev: 'F1' });
  });

  it('同一文档的并发请求串行执行，不会留下孤儿样式', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);

    const all: Promise<unknown>[] = [];
    for (let i = 0; i < 6; i++) {
      bg.state.formalNext = `F${i}`;
      all.push(styles.syncFormal());
      all.push(styles.setDraft(i % 2 ? `D${i}` : null));
    }
    await Promise.all(all);

    // 最后一次正式同步时存储为 F5；预览最后设为 D5。没有任何别的残留
    expect(bg.sheets.sort()).toEqual(['D5', 'F5']);
  });

  it('预览样式：与上次相同就不发请求', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);

    await styles.setDraft('D1');
    await styles.setDraft('D1');
    await styles.setDraft(null);
    await styles.setDraft(null);

    expect(bg.log.map((m) => m.t)).toEqual(['draftCss', 'draftCss']);
    expect(bg.sheets).toEqual([]);
  });

  it('后台失败：记录保持为后台告知的实际文本，返回 ok:false 供调用方提示', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);
    await styles.setDraft('D1');

    bg.state.fail = true;
    const res = await styles.setDraft('D2');

    expect(res.ok).toBe(false);
    bg.state.fail = false;
    await styles.setDraft(null);
    expect(bg.sheets).toEqual([]); // 仍按 D1 去删，没有孤儿
  });

  it('消息发送抛错（后台不可达）或没有回复：不改记录、不抛出，返回 ok:false', async () => {
    let mode: 'throw' | 'undefined' = 'throw';
    const styles = createDocStyles(async () => {
      if (mode === 'throw') throw new Error('Could not establish connection');
      return undefined;
    });

    expect((await styles.syncFormal()).ok).toBe(false);
    mode = 'undefined';
    expect((await styles.setDraft('D1')).ok).toBe(false);
  });
});

describe('宿主保护样式（第三份记录）', () => {
  it('开启后注入一份，重复开启不再请求；关闭时按记录移除', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);

    await styles.syncShield(true);
    await styles.syncShield(true);
    expect(bg.sheets).toEqual(['SHIELD']);
    expect(bg.log.filter((m) => m.t === 'hostShield')).toHaveLength(1);

    await styles.clearFormal(); // 正式样式的进退不影响保护样式
    expect(bg.sheets).toEqual(['SHIELD']);

    await styles.syncShield(false);
    expect(bg.sheets).toEqual([]);
    expect(bg.log.at(-1)).toEqual({ t: 'hostShield', on: false, prev: 'SHIELD' });
  });
});

describe('正式样式带上本页地址（SPA 路由变化后后台按新地址判断生效范围）', () => {
  it('syncFormal(url) 把地址放进请求', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);
    await styles.syncFormal('https://site.test/chapter/2');
    expect(bg.log.at(-1)).toEqual({ t: 'applyDisguise', prev: null, url: 'https://site.test/chapter/2' });
  });
});

describe('扩展更新 / 重复注入时的交接', () => {
  it('handover 等进行中的请求结束后交出记录，之后旧实例的请求一律不再发出', async () => {
    const bg = fakeBackground();
    const old = createDocStyles(bg.send);
    void old.syncFormal();
    void old.syncShield(true);
    const record = await old.handover();
    expect(record).toEqual({ formal: 'F1', draft: null, shield: 'SHIELD' });

    const sent = bg.log.length;
    const late = await old.setDraft('D9');
    expect(late.ok).toBe(false);
    expect(bg.log.length).toBe(sent);
  });

  it('新实例用交接来的记录继续：同样的样式不重复注入，旧预览被撤掉，没有孤儿', async () => {
    const bg = fakeBackground();
    const old = createDocStyles(bg.send);
    await old.syncFormal();
    await old.syncShield(true);
    await old.setDraft('D1');

    const next = createDocStyles(bg.send, old.handover());
    await next.syncFormal();
    await next.syncShield(true);
    await next.setDraft(null);
    expect(bg.sheets.sort()).toEqual(['F1', 'SHIELD']);

    bg.state.formalNext = null;
    await next.syncFormal();
    await next.syncShield(false);
    expect(bg.sheets).toEqual([]);
  });

  it('交接记录拿不到（旧实例异常）时按空记录开始', async () => {
    const bg = fakeBackground();
    const next = createDocStyles(bg.send, Promise.reject(new Error('x')));
    await next.syncFormal();
    expect(bg.sheets).toEqual(['F1']);
  });
});

describe('releaseOrphans（扩展更新后，旧实例在另一个隔离环境、交不出记录）', () => {
  it('排在本实例的注入之后发出（先插新的，再请后台删旧的，中间不闪）；本实例记录不变', async () => {
    const bg = fakeBackground();
    const styles = createDocStyles(bg.send);
    void styles.syncFormal();
    void styles.syncShield(true);
    const ok = await styles.releaseOrphans('https://site.test/a');
    expect(ok).toBe(true);
    expect(bg.log.map((m) => m.t)).toEqual(['applyDisguise', 'hostShield', 'releaseOrphanCss']);
    expect(bg.log.at(-1)).toEqual({ t: 'releaseOrphanCss', url: 'https://site.test/a' });
    expect((await styles.handover()).formal).toBe('F1');
  });
});
