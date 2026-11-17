/**
 * 跨 SW 回收记录「每份文档当前实际插入的向导预览样式文本」（#239）。
 *
 * 正式样式的文本可以由配置重算（releaseOrphanCss 一直这么撤孤儿），预览草稿不行——
 * 它只存在于内容脚本的记录里（core/doc-styles.ts），而扩展更新 / 重载时旧实例在另一个
 * 隔离环境里被冻结交接（handover），开着的向导的预览文本没人撤，留下的「免保存临时隐藏」
 * 只有刷新页面才能除掉。后台在这里把每次 draftCss 实际落进文档的文本记入 storage.session
 * （SW 回收不丢、浏览器重启即清，与预览样式的生命周期一致），供两处清理：
 * - releaseOrphanCss：把孤儿预览与保护 / 正式样式一并撤掉
 * - draftCss 且 prev 为空：新实例首次换草稿时先撤这份残留再插新的
 *
 * 记录是「恢复副本」，不是正常路径的事实源：正常换入换出仍以内容脚本带来的 prev 为准。
 * 每份文档一个键（draft:<tabId>:<documentId|frameId>），避免多文档并发写同一对象互相覆盖。
 * storage.session 不可用时全部退化为无记录：孤儿清理退回按配置重算的现状（导航兜底）。
 */
import type { Browser } from 'wxt/browser';

const KEY_PREFIX = 'draft:';

/** 样式注入目标 → 记录键（documentId 精确到文档；旧版浏览器退回 frameId） */
export function draftKeyOf(target: Browser.scripting.InjectionTarget): string {
  return `${KEY_PREFIX}${target.tabId}:${target.documentIds?.[0] ?? target.frameIds?.[0] ?? 0}`;
}

export interface DraftTracker {
  /** 记录该文档当前实际插入的草稿文本；null 即删除记录。失败静默：记录是尽力而为的恢复副本 */
  set(key: string, css: string | null): Promise<void>;
  /** 读取该文档的草稿记录（不删） */
  get(key: string): Promise<string | null>;
  /** 读取并删除该文档的草稿记录（孤儿只撤一次） */
  take(key: string): Promise<string | null>;
}

export function createDraftTracker(session: Browser.storage.StorageArea | undefined): DraftTracker {
  return {
    async set(key, css) {
      if (!session) return;
      try {
        if (css === null) await session.remove(key);
        else await session.set({ [key]: css });
      } catch {
        // 记录失败不影响样式本身：孤儿清理退回按配置重算的现状
      }
    },
    async get(key) {
      if (!session) return null;
      try {
        const bag = (await session.get(key)) as Record<string, unknown>;
        return typeof bag[key] === 'string' ? (bag[key] as string) : null;
      } catch {
        return null;
      }
    },
    async take(key) {
      const css = await this.get(key);
      if (css !== null) await this.set(key, null);
      return css;
    },
  };
}
