/**
 * 编辑态与存储态分离（#26 / 审查 N19）：输入框绑定本地草稿，存储变化时只刷新「没在编辑」的字段。
 * 纯函数，管理页用它在每次 storage.onChanged 后重算草稿。
 */

/**
 * 按最新存储值重算草稿：
 * - 正在编辑的字段（keep(key) 为 true：输入框聚焦，或有还没保存的改动）保留草稿，不被存储变化冲掉；
 * - 其余字段换成存储里的值；
 * - 存储里已不存在的字段（站点被删除）丢弃。
 */
export function syncDrafts(
  drafts: Readonly<Record<string, string>>,
  stored: Readonly<Record<string, string>>,
  keep: (key: string) => boolean,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    next[key] = keep(key) && key in drafts ? drafts[key]! : value;
  }
  return next;
}
