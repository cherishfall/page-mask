/**
 * 导出文件名（#55）：`pagemask-<插件版本>-<YYYYMMDDHHmmss>.json`。
 *
 * 时间取**本地时间**、精确到秒、无分隔符：同一秒内导出两次会重名，浏览器自动加 (1)，
 * 这是有意的——用户看文件名就知道是什么时候导出的，不需要再打开文件。
 */

/** 本地时间戳：YYYYMMDDHHmmss（月 / 日 / 时 / 分 / 秒补零） */
export function localStamp(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
}

/** 导出文件名；版本号里只保留文件名安全的字符，取不到版本时写 unknown */
export function exportFileName(version: string, at: Date): string {
  const v = version.trim().replace(/[^0-9A-Za-z._-]/g, '-');
  return `pagemask-${v || 'unknown'}-${localStamp(at)}.json`;
}
