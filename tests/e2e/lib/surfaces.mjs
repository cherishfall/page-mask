/**
 * 三处界面对照表的唯一解析器（#157）。
 *
 * 权威是 `docs/design-surfaces.md`：本文件只把它读成机器可用的行，不复制任何期望值。
 * `tests/surfaces.test.ts`（提交前）与三条 E2E（真渲染）都从这里取期望的顺序 / 叫法，
 * 所以「改一处漏两处」只有一份口径可改，不会出现两套断言各自漂移。
 *
 * 表格格式固定（见文档「规矩」第 4 条）：固定列名、`|` 分隔、`—` 表示该处没有这一项。
 * 表头列名对不上直接抛错——宁可让门禁报「对照表格式坏了」，也不要静默跳过。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DOC_PATH = path.join(ROOT, 'docs/design-surfaces.md');

/** 文档里的四个小节；键名与测试 / E2E 的用法一致 */
const SECTIONS = {
  canonical: '## 三、规范顺序',
  popup: '### 4.1 插件弹窗',
  capsuleBody: '### 4.2 悬浮胶囊 · 本体',
  capsuleMenu: '### 4.3 悬浮胶囊 · ⋯ 菜单',
  siteSettings: '### 4.4 站点设置页',
};

/** 每个小节必需的表头列（按名字取，不依赖列顺序） */
const COLUMNS = {
  canonical: ['序', '功能项', '组', '说明'],
  popup: ['序', '功能项', '控件', '界面用词（中）', '界面用词（英）', '文案键', '备注'],
  capsuleBody: ['序', '功能项', '控件', '界面用词（中）', '界面用词（英）', '文案键', '备注'],
  capsuleMenu: ['序', '功能项', '组', '控件', '界面用词（中）', '界面用词（英）', '文案键', '备注'],
  siteSettings: ['序', '功能项', '控件', '界面用词（中）', '界面用词（英）', '文案键', '备注'],
};

/** 取某个标题下、下一个标题之前的行 */
function sectionLines(lines, heading) {
  const start = lines.findIndex((line) => line.trim().startsWith(heading));
  if (start < 0) throw new Error(`docs/design-surfaces.md 缺小节「${heading}」`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,6}\s/.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/** 解析一个 markdown 表格：第一行表头、第二行分隔线，其余为数据行 */
function parseTable(lines, name, expectedColumns) {
  const tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  if (tableStart < 0) throw new Error(`对照表「${name}」缺 markdown 表格`);

  const rows = [];
  for (let i = tableStart; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(lines[i]);
  if (rows.length < 3) throw new Error(`对照表「${name}」只有表头，没有数据行`);

  const header = splitRow(rows[0]);
  for (const col of expectedColumns) {
    if (!header.includes(col)) throw new Error(`对照表「${name}」缺列「${col}」（实际列：${header.join(' / ')}）`);
  }
  // 第二行必须是分隔线（只含 - 和 :），否则说明表头与数据错位
  if (!splitRow(rows[1]).every((cell) => /^:?-{3,}:?$/.test(cell))) {
    throw new Error(`对照表「${name}」第二行不是 markdown 分隔线`);
  }

  return rows.slice(2).map((line, index) => {
    const cells = splitRow(line);
    if (cells.length !== header.length) {
      throw new Error(`对照表「${name}」第 ${index + 1} 行列数 ${cells.length} ≠ 表头 ${header.length}`);
    }
    const get = (col) => cells[header.indexOf(col)];
    const row = {};
    for (const col of header) row[col] = get(col);
    const seq = Number(get('序'));
    if (!Number.isInteger(seq)) throw new Error(`对照表「${name}」第 ${index + 1} 行「序」不是整数：${get('序')}`);
    return {
      seq,
      item: get('功能项'),
      group: get('组')?.replace(/^—$/, '') ?? '',
      control: get('控件') ?? '',
      labelZh: get('界面用词（中）') ?? '',
      labelEn: get('界面用词（英）') ?? '',
      key: get('文案键') ?? '',
      note: get('备注') ?? get('说明') ?? '',
    };
  });
}

/**
 * 读对照表。默认读仓库里的 `docs/design-surfaces.md`；测试可传别的路径做负向用例。
 * @param {string} [docPath]
 */
export function loadSurfaces(docPath = DOC_PATH) {
  const lines = fs.readFileSync(docPath, 'utf8').split('\n');
  const result = {};
  for (const [name, heading] of Object.entries(SECTIONS)) {
    result[name] = parseTable(sectionLines(lines, heading), name, COLUMNS[name]);
  }
  return result;
}

/** 菜单在默认位（没拖过）与拖过之后的期望项：`按钮放回右下角` 只在拖过后出现 */
export function menuRows(surfaces, withReset = false) {
  return surfaces.capsuleMenu.filter((row) => withReset || !row.note.includes('拖过才出现'));
}

/** 菜单期望顺序（含分组分隔线 `---`），供 E2E 与源码断言共用 */
export function menuOrder(surfaces, withReset = false) {
  const rows = menuRows(surfaces, withReset);
  const out = [];
  rows.forEach((row, index) => {
    if (index > 0 && row.group !== rows[index - 1].group) out.push('---');
    out.push(row.labelZh);
  });
  return out;
}

export { DOC_PATH, ROOT };
