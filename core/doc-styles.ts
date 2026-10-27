/**
 * 内容脚本侧：本文档已注入的用户样式表记录（正式隐藏样式 + 向导预览样式 + 宿主保护样式）。
 *
 * 注入记录属于"文档"而不是"标签页"，由文档自己的内容脚本持有（随文档一起进出 bfcache），
 * 每次请求把 prev 带给无状态的后台（协议见 core/messages.ts），SW 回收不丢记录。
 *
 * - 同一文档的所有样式请求走一条 promise 链串行执行，prev 在执行时（而非排队时）读取，杜绝孤儿样式
 * - 记录以后台回传的 css（文档里实际存在的文本）为准；发送失败 / 没有回复时保持原记录
 * - 从不抛出：结果以 CssAck 返回，调用方检查 ok 决定提示
 * - 交接（#22）：扩展更新 / 重复注入时旧实例失效，但它注入的用户样式表仍留在文档里（实测扩展重载后
 *   照样生效，新扩展实例按原文可以删掉）。旧实例 handover() 交出记录并冻结，新实例以它为起点继续，
 *   不会重复注入、也不会留下谁都删不掉的样式
 *
 * 用法：
 *   const styles = createDocStyles((m) => browser.runtime.sendMessage(m), old?.handover());
 *   await styles.syncFormal(location.href); // 按存储同步正式样式（原样态即移除）
 *   await styles.setDraft(css);              // 向导预览；null 清除
 *   await styles.syncShield(true);           // 宿主保护样式
 */
import type { BgRequest, CssAck } from './messages';

export type SendToBackground = (msg: BgRequest) => Promise<unknown>;

/** 本文档里由本扩展注入、尚未移除的三份样式文本 */
export interface StyleRecord {
  formal: string | null;
  draft: string | null;
  shield: string | null;
}

export interface DocStyles {
  /** 按存储当前状态与本页地址同步正式样式；url 缺省时后台用 sender.url */
  syncFormal(url?: string): Promise<CssAck>;
  /** 移除本文档的正式样式（进入向导前临时还原） */
  clearFormal(): Promise<CssAck>;
  /** 设置预览样式；与当前相同则不发请求 */
  setDraft(css: string | null): Promise<CssAck>;
  /** 开 / 关宿主保护样式；状态未变则不发请求 */
  syncShield(on: boolean): Promise<CssAck>;
  /** 等进行中的请求结束后交出记录，并冻结本实例（之后的请求都不再发出） */
  handover(): Promise<StyleRecord>;
  /**
   * 请后台撤掉失联旧实例留下的样式（扩展更新后旧实例在另一个隔离环境，交不出记录）。
   * 排在本实例已有的注入请求之后执行；本实例自己的记录不变
   */
  releaseOrphans(url?: string): Promise<boolean>;
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

const EMPTY: StyleRecord = { formal: null, draft: null, shield: null };

export function createDocStyles(send: SendToBackground, initial?: Promise<StyleRecord | null | undefined>): DocStyles {
  const rec: StyleRecord = { ...EMPTY };
  let frozen = false;
  let shieldSynced = false;
  let chain: Promise<unknown> = (initial ?? Promise.resolve(null)).then(
    (r) => {
      if (r) Object.assign(rec, { formal: r.formal ?? null, draft: r.draft ?? null, shield: r.shield ?? null });
    },
    () => undefined,
  );

  function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = chain.then(op);
    chain = run.catch(() => undefined);
    return run;
  }

  /** 冻结后不再发任何请求（旧实例已把记录交给新实例） */
  function guarded(key: keyof StyleRecord, op: () => Promise<CssAck>): Promise<CssAck> {
    return enqueue(async () => (frozen ? { ok: false, error: 'handed over', css: rec[key] } : op()));
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

  /** 发请求并按回复更新某份记录 */
  async function swap(key: keyof StyleRecord, msg: BgRequest): Promise<CssAck> {
    const res = await request(msg);
    if (!res) return unreachable(rec[key]);
    rec[key] = res.css;
    return res;
  }

  return {
    syncFormal: (url) =>
      guarded('formal', () => swap('formal', { t: 'applyDisguise', prev: rec.formal, ...(url ? { url } : {}) })),
    clearFormal: () =>
      guarded('formal', async () =>
        rec.formal === null ? { ok: true, css: null } : swap('formal', { t: 'restoreOriginal', prev: rec.formal }),
      ),
    setDraft: (css) =>
      guarded('draft', async () => {
        const next = css || null;
        if (next === rec.draft) return { ok: true, css: rec.draft };
        return swap('draft', { t: 'draftCss', prev: rec.draft, next });
      }),
    syncShield: (on) =>
      guarded('shield', async () => {
        // 本实例第一次总要问一次后台：交接来的可能是旧版本扩展的保护样式文本，后台会换成当前版本
        if (shieldSynced && on === (rec.shield !== null)) return { ok: true, css: rec.shield };
        const res = await swap('shield', { t: 'hostShield', on, prev: rec.shield });
        if (res.ok) shieldSynced = true;
        return res;
      }),
    handover: () =>
      enqueue(async () => {
        frozen = true;
        return { ...rec };
      }),
    releaseOrphans: (url) =>
      enqueue(async () => {
        if (frozen) return false;
        return (await request({ t: 'releaseOrphanCss', ...(url ? { url } : {}) }))?.ok === true;
      }),
  };
}
