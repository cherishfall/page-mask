/**
 * 跨扩展更新记录「每份文档当前实际插入的向导预览样式文本」（#239；存储选型 #247 修订）。
 *
 * 正式样式的文本可以由配置重算（releaseOrphanCss 一直这么撤孤儿），预览草稿不行——
 * 它只存在于内容脚本的记录里（core/doc-styles.ts），而扩展更新 / 重载时旧实例在另一个
 * 隔离环境里被冻结交接，开着的向导的预览文本没人撤，留下的「免保存临时隐藏」
 * 只有刷新页面才能除掉。后台在这里把每次 draftCss 实际落进文档的文本记入 storage.local：
 * 第一版记在 storage.session，但 session 区随扩展更新 / 重载被清空（官方文档原句
 * "The storage is cleared if the extension is disabled, reloaded, updated, and when the
 * browser restarts"），恰好够不着目标场景（#247）——local 跨更新持久，扩展卸载才清。
 *
 * 记录是「恢复副本」，不是正常路径的事实源：正常换入换出仍以内容脚本带来的 prev 为准。
 * 每份文档一个键（draft:<tabId>:<documentId|frameId>），值带写入时间（{ css, at }）；
 * 文档消失后没人 take 的残留键由 sweep() 只在 onStartup 清掉（>24h）——不能挂在
 * onInstalled：update 的 sweep 会抢在 reinject 后的孤儿清理前面删掉活文档仍需要的
 * 超龄记录（#249）。防止无界累积（local 总配额 10MB，单条草稿文本很小）。
 * storage.local 不可用时全部退化为无记录：孤儿清理退回按配置重算的现状（导航兜底）。
 */
import type { Browser } from 'wxt/browser';

const KEY_PREFIX = 'draft:';
/** 残留记录的清扫时限：文档关掉后没人 take 的键最多留这么久 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 样式注入目标 → 记录键（documentId 精确到文档；旧版浏览器退回 frameId） */
export function draftKeyOf(target: Browser.scripting.InjectionTarget): string {
  return `${KEY_PREFIX}${target.tabId}:${target.documentIds?.[0] ?? target.frameIds?.[0] ?? 0}`;
}

interface DraftEntry {
  css: string;
  at: number;
}

export interface DraftTracker {
  /** 记录该文档当前实际插入的草稿文本；null 即删除记录。失败静默：记录是尽力而为的恢复副本 */
  set(key: string, css: string | null): Promise<void>;
  /** 读取该文档的草稿记录（不删） */
  get(key: string): Promise<string | null>;
  /** 读取并删除该文档的草稿记录（孤儿只撤一次） */
  take(key: string): Promise<string | null>;
  /** 清扫超龄的残留键（只在 onStartup 调用，#249）：文档消失后没人 take 的记录不能累积 */
  sweep(now?: number): Promise<void>;
}

export function createDraftTracker(area: Browser.storage.StorageArea | undefined): DraftTracker {
  return {
    async set(key, css) {
      if (!area) return;
      try {
        if (css === null) await area.remove(key);
        else await area.set({ [key]: { css, at: Date.now() } });
      } catch {
        // 记录失败不影响样式本身：孤儿清理退回按配置重算的现状
      }
    },
    async get(key) {
      if (!area) return null;
      try {
        const bag = (await area.get(key)) as Record<string, unknown>;
        const e = bag[key] as DraftEntry | undefined;
        return e && typeof e.css === 'string' ? e.css : null;
      } catch {
        return null;
      }
    },
    async take(key) {
      const css = await this.get(key);
      if (css !== null) await this.set(key, null);
      return css;
    },
    async sweep(now = Date.now()) {
      if (!area) return;
      try {
        const all = (await area.get(null)) as Record<string, unknown>;
        const stale = Object.entries(all)
          .filter(([k, v]) => {
            if (!k.startsWith(KEY_PREFIX)) return false;
            const e = v as DraftEntry | undefined;
            return !e || typeof e.at !== 'number' || now - e.at > MAX_AGE_MS;
          })
          .map(([k]) => k);
        if (stale.length > 0) await area.remove(stale);
      } catch {
        // 清扫失败不影响功能：残留键等下一次 onStartup 再扫（#249：只在启动时扫）
      }
    },
  };
}
