/**
 * 删除一条收起规则并在几秒内撤销：页面内编辑面板与管理页的站点设置共用（#41）。
 *
 * 撤销要把规则「按原下标插回、id 不变」——所以删除时记下它在列表里的下标。
 * 这里只做列表运算，不碰存储也不碰定时器：两个界面各有自己的写入通道
 * （编辑面板直接写 storage，管理页走 store），定时器由 ui/rule-undo.ts 统一管。
 */
import type { HideRule } from './types';

/** 删除后多久内可以撤销 */
export const UNDO_MS = 5000;

/** 一次待撤销的删除 */
export interface RuleUndo {
  /** 删除前的规则快照（恢复时用它，id 不变） */
  rule: HideRule;
  /** 删除前在列表里的下标：恢复时插回原位 */
  index: number;
  /** 给用户看的名称 */
  name: string;
}

/** 删除的结果：新列表 + 撤销所需的信息 */
export interface DetachedRule {
  rules: HideRule[];
  undo: RuleUndo;
}

/** 复制规则：快照不与被删掉的响应式对象共享引用 */
function snapshot(rule: HideRule): HideRule {
  return JSON.parse(JSON.stringify(rule)) as HideRule;
}

/** 从列表里取出某条规则；找不到返回 null（例如别处已经删掉了） */
export function detachRule(rules: readonly HideRule[], ruleId: string): DetachedRule | null {
  const index = rules.findIndex((r) => r.id === ruleId);
  const rule = rules[index];
  if (!rule) return null;
  const copy = snapshot(rule);
  return { rules: rules.filter((r) => r.id !== ruleId), undo: { rule: copy, index, name: copy.elementName } };
}

/** 把撤销的规则按原下标插回；下标超出当前长度时放到末尾（中间被删过几条也不会丢） */
export function reattachRule(rules: readonly HideRule[], undo: RuleUndo): HideRule[] {
  const next = [...rules];
  next.splice(Math.min(undo.index, next.length), 0, snapshot(undo.rule));
  return next;
}
