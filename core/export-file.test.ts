import { describe, expect, it } from 'vitest';
import { exportFileName, localStamp } from './export-file';

/** 本地时间构造：不经过 UTC，测的就是"本地时间"这一条 */
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe('导出文件名（#55）', () => {
  it('pagemask-<版本>-<本地时间到秒>.json', () => {
    expect(exportFileName('0.4.0', local(2026, 10, 29, 23, 59, 59))).toBe('pagemask-0.4.0-20261029235959.json');
  });

  it('月 / 日 / 时 / 分 / 秒都补零，且用本地时间（不是 UTC）', () => {
    expect(localStamp(local(2026, 1, 2, 3, 4, 5))).toBe('20260102030405');
    const at = local(2026, 7, 8, 9, 10, 11);
    // 与 Date 自己的本地时间读数一致；用 toISOString 会因时区偏移得到另一天
    expect(localStamp(at)).toBe(
      `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, '0')}${String(at.getDate()).padStart(2, '0')}` +
        `${String(at.getHours()).padStart(2, '0')}${String(at.getMinutes()).padStart(2, '0')}${String(at.getSeconds()).padStart(2, '0')}`,
    );
  });

  it('版本号里不安全的字符不会跑进文件名；没有版本时写 unknown', () => {
    expect(exportFileName('0.4.0 beta/1', local(2026, 10, 29))).toBe('pagemask-0.4.0-beta-1-20261029000000.json');
    expect(exportFileName('  ', local(2026, 10, 29))).toBe('pagemask-unknown-20261029000000.json');
  });
});
