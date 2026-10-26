/**
 * 内容脚本侧：本文档已注入的隐藏样式记录（正式样式 + 向导预览样式）。
 *
 * 注入记录属于"文档"而不是"标签页"，由文档自己的内容脚本持有（随文档一起进出 bfcache），
 * 每次请求把 prev 带给无状态的后台（协议见 core/messages.ts），SW 回收不丢记录。
 *
 * - 同一文档的所有样式请求走一条 promise 链串行执行，prev 在执行时（而非排队时）读取，杜绝孤儿样式
 * - 记录以后台回传的 css（文档里实际存在的文本）为准；发送失败 / 没有回复时保持原记录
 * - 从不抛出：结果以 CssAck 返回，调用方检查 ok 决定提示
 *
 * 用法：
 *   const styles = createDocStyles((m) => browser.runtime.sendMessage(m));
 *   await styles.syncFormal();        // 按存储同步正式样式（原样态即移除）
 *   await styles.setDraft(css);       // 向导预览；null 清除
 */
import type { BgRequest, CssAck } from './messages';

export type SendToBackground = (msg: BgRequest) => Promise<unknown>;

export interface DocStyles {
  /** 按存储当前状态与本页地址同步正式样式 */
  syncFormal(): Promise<CssAck>;
  /** 移除本文档的正式样式（进入向导前临时还原） */
  clearFormal(): Promise<CssAck>;
  /** 设置预览样式；与当前相同则不发请求 */
  setDraft(css: string | null): Promise<CssAck>;
}

function isCssAck(v: unknown): v is CssAck {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as CssAck).ok === 'boolean' &&
    'css' in v &&
    ((v as CssAck).css === null || typeof (v as CssAck).css === 'string')
  );
}

export function createDocStyles(send: SendToBackground): DocStyles {
  let formal: string | null = null;
  let draft: string | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  function enqueue(op: () => Promise<CssAck>): Promise<CssAck> {
    const run = chain.then(op);
    chain = run.catch(() => undefined);
    return run;
  }

  async function request(msg: BgRequest): Promise<CssAck | null> {
    try {
      const res = await send(msg);
      return isCssAck(res) ? res : null;
    } catch {
      return null;
    }
  }

  function unreachable(css: string | null): CssAck {
    return { ok: false, error: 'background unreachable', css };
  }

  return {
    syncFormal: () =>
      enqueue(async () => {
        const res = await request({ t: 'applyDisguise', prev: formal });
        if (!res) return unreachable(formal);
        formal = res.css;
        return res;
      }),
    clearFormal: () =>
      enqueue(async () => {
        if (formal === null) return { ok: true, css: null };
        const res = await request({ t: 'restoreOriginal', prev: formal });
        if (!res) return unreachable(formal);
        formal = res.css;
        return res;
      }),
    setDraft: (css) =>
      enqueue(async () => {
        const next = css || null;
        if (next === draft) return { ok: true, css: draft };
        const res = await request({ t: 'draftCss', prev: draft, next });
        if (!res) return unreachable(draft);
        draft = res.css;
        return res;
      }),
  };
}
