/**
 * 「删除 → 5 秒内可撤销」的界面状态与定时器：页面内编辑面板（#25）与管理页的站点设置（#41）共用。
 *
 * 列表运算在 core/rule-undo.ts（纯函数、有单测）；这里只管"最近一次删除"与它的计时器，
 * 写存储交给调用方传进来的 apply —— 两个界面的写入通道不同（编辑面板直接写 storage，管理页走 store）。
 */
import { onBeforeUnmount, ref, type Ref } from 'vue';
import { detachRule, reattachRule, UNDO_MS, type RuleUndo } from '@/core/rule-undo';
import type { HideRule } from '@/core/types';

/** 写入口：拿到一个「按最新列表算出新列表」的函数；返回什么由调用方决定（通常是 fire-and-forget） */
export type RuleListWriter = (update: (rules: HideRule[]) => HideRule[]) => void;

export interface RuleUndoState {
  /** 待撤销的删除；null = 没有 */
  pending: Ref<RuleUndo | null>;
  /** 删掉一条（rules 传界面上眼下的列表），并开始计时 */
  remove: (rules: readonly HideRule[], ruleId: string) => void;
  /** 把最近删掉的那条插回原位置 */
  undo: () => void;
}

export function useRuleUndo(apply: RuleListWriter): RuleUndoState {
  const pending = ref<RuleUndo | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function remove(rules: readonly HideRule[], ruleId: string) {
    const hit = detachRule(rules, ruleId);
    if (!hit) return;
    // 同一时间只保留最近一次的撤销机会：又删了一条，上一条就作废
    stopTimer();
    pending.value = hit.undo;
    timer = setTimeout(() => {
      pending.value = null;
      timer = null;
    }, UNDO_MS);
    // 写存储时按最新列表再算一次（别处可能刚改过）；撤销信息用眼下这份的下标
    apply((current) => detachRule(current, ruleId)?.rules ?? current);
  }

  function undo() {
    const entry = pending.value;
    if (!entry) return;
    pending.value = null;
    stopTimer();
    apply((current) => reattachRule(current, entry));
  }

  onBeforeUnmount(stopTimer);
  return { pending, remove, undo };
}
