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
    const next = msg.t === 'applyDisguise' ? state.formalNext : msg.t === 'draftCss' ? msg.next : null;
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
