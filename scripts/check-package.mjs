#!/usr/bin/env node
// 打包门禁：在 `npm run zip` 之后运行，检查即将上传商店的 zip 是否合规。任一项不通过即非零退出。
//
// 检查项：
//   - manifest（产物目录与 zip 内各查一遍）：manifest_version 为 3；name 解析后 ≤45 字符；description 解析后 ≤132 字符
//     （name/description 若为 __MSG_x__，到 _locales/<各语言>/messages.json 查实际文本，每种语言都检查）
//   - name/description/action.default_title 各语言文本不含禁用词（伪装、disguise、New Tab、新建标签页、摸鱼）
//   - 有 _locales 时必须声明 default_locale；各语言 messages.json 键集合一致、每条都有 message 文本
//   - icons 含 16/32/48/128，且对应文件在 zip 内存在
//   - 安装时零站点权限（REVIEW B11）：无 content_scripts、无 host_permissions；
//     动态注册引用的内容脚本 content-scripts/content.js（core/registration.ts）存在
//   - zip 内无 *.map、.DS_Store、*.test.*、tests/ 路径；包含 THIRD_PARTY_NOTICES.txt
//
// 用法：node scripts/check-package.mjs [zip 路径]   默认 .output/<name>-<version>-chrome.zip
// zip 用纯 Node 解析（中央目录 + zlib），不引入依赖。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.output', 'chrome-mv3');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const zipPath = resolve(process.argv[2] ?? join(root, '.output', `${pkg.name}-${pkg.version}-chrome.zip`));

const LIMITS = { name: 45, description: 132 };
const REQUIRED_ICON_SIZES = ['16', '32', '48', '128'];
const NOTICES = 'THIRD_PARTY_NOTICES.txt';
/** 与 core/registration.ts 的 CONTENT_SCRIPT_FILE 一致：后台按站点动态注册的就是这个文件 */
const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------- zip 解析 ----------

/** 解析 zip 中央目录，返回 Map<路径, () => Buffer>。 */
function readZip(file) {
  const buf = readFileSync(file);
  // End of Central Directory：签名 0x06054b50，位于末尾（之后最多 65535 字节注释）。
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 文件（找不到中央目录结尾）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 中央目录损坏');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, () => {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${name}：不支持的压缩方式 ${method}`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------- manifest 检查 ----------

/**
 * 解析 __MSG_x__ 占位符：返回 [{ locale, text }]。非占位符时 locale 为 null。
 * readFile(path) 返回文件文本或 null。
 */
function resolveMessage(value, readFile, listLocales, defaultLocale) {
  const m = /^__MSG_(\w+)__$/.exec(value ?? '');
  if (!m) return [{ locale: null, text: value ?? '' }];
  const key = m[1].toLowerCase(); // Chrome 中消息名大小写不敏感
  const locales = listLocales();
  if (locales.length === 0) return [{ locale: null, text: null, error: `使用了 ${value}，但包内没有 _locales` }];
  const lookup = (locale) => {
    const raw = readFile(`_locales/${locale}/messages.json`);
    const messages = raw ? JSON.parse(raw) : {};
    return Object.entries(messages).find(([k]) => k.toLowerCase() === key)?.[1].message;
  };
  return locales.flatMap((locale) => {
    const text = lookup(locale);
    if (text !== undefined) return [{ locale, text }];
    // 非默认语言缺消息时 Chrome 回退到 default_locale，不算错误（默认语言那一项会单独检查）
    if (defaultLocale && locale !== defaultLocale) return [];
    return [{ locale, text: null, error: `_locales/${locale}/messages.json 缺少消息 ${m[1]}` }];
  });
}

function checkManifest(label, manifest, readFile, listLocales, hasFile) {
  if (manifest.manifest_version !== 3) fail(`[${label}] manifest_version 应为 3，实际为 ${manifest.manifest_version}`);

  for (const field of ['name', 'description']) {
    if (!manifest[field]) {
      fail(`[${label}] manifest 缺少 ${field}`);
      continue;
    }
    for (const { locale, text, error } of resolveMessage(
      manifest[field],
      readFile,
      listLocales,
      manifest.default_locale,
    )) {
      const where = locale ? `${field}（${locale}）` : field;
      if (error) {
        fail(`[${label}] ${where}：${error}`);
        continue;
      }
      // 按 Unicode 字符计数（与商店一致，中文一个字算 1）
      const len = [...text].length;
      if (len > LIMITS[field]) fail(`[${label}] ${where} 长度 ${len} 超过上限 ${LIMITS[field]}：「${text}」`);
      checkWording(label, where, text);
    }
  }

  // action.default_title 若用占位符，也必须能解析（无长度上限，但同样不得出现禁用词）
  const actionTitle = manifest.action?.default_title;
  if (actionTitle) {
    for (const { locale, text, error } of resolveMessage(actionTitle, readFile, listLocales, manifest.default_locale)) {
      const where = locale ? `action.default_title（${locale}）` : 'action.default_title';
      if (error) fail(`[${label}] ${where}：${error}`);
      else checkWording(label, where, text);
    }
  }
  const locale = manifest.default_locale;
  const locales = listLocales();
  if (locale && !hasFile(`_locales/${locale}/messages.json`)) {
    fail(`[${label}] default_locale 为 ${locale}，但缺少 _locales/${locale}/messages.json`);
  }
  // Chrome 规则：有 _locales 必须声明 default_locale，反之亦然，否则拒绝加载
  if (!locale && locales.length > 0) fail(`[${label}] 包内有 _locales，但 manifest 缺少 default_locale`);
  checkLocaleKeys(label, locales, readFile);
  // 安装时不得带任何站点权限：内容脚本只走动态注册，站点授权一律运行时申请
  if ('content_scripts' in manifest) {
    fail(`[${label}] manifest 不应包含 content_scripts（安装时会出现站点权限提示）：${JSON.stringify(manifest.content_scripts)}`);
  }
  if ('host_permissions' in manifest) {
    fail(`[${label}] manifest 不应包含 host_permissions（站点授权应在运行时申请）：${JSON.stringify(manifest.host_permissions)}`);
  }
  if (!hasFile(CONTENT_SCRIPT_FILE)) fail(`[${label}] 缺少动态注册用的内容脚本 ${CONTENT_SCRIPT_FILE}`);
  const icons = manifest.icons ?? {};
  for (const size of REQUIRED_ICON_SIZES) {
    const path = icons[size];
    if (!path) fail(`[${label}] manifest.icons 缺少 ${size} 尺寸`);
    else if (!hasFile(path.replace(/^\//, ''))) fail(`[${label}] 图标 ${size} 指向的 ${path} 不存在`);
  }
}

/** 商店可见文案不得出现的叫法（附录 store D5 / GLOSSARY：对外话术统一为"清爽"） */
const FORBIDDEN_WORDS = [/伪装/, /disguis/i, /new\s*tab/i, /新建标签页/, /摸鱼/];
function checkWording(label, where, text) {
  for (const re of FORBIDDEN_WORDS) {
    if (re.test(text)) fail(`[${label}] ${where} 含有禁用词 ${re}：「${text}」`);
  }
}

/** 各语言 messages.json 的键集合必须一致（大小写不敏感，与 Chrome 一致），避免某语言漏翻回退成英文 */
function checkLocaleKeys(label, locales, readFile) {
  const keySets = new Map();
  for (const l of locales) {
    let messages;
    try {
      messages = JSON.parse(readFile(`_locales/${l}/messages.json`) ?? '{}');
    } catch (e) {
      fail(`[${label}] _locales/${l}/messages.json 不是合法 JSON：${e.message}`);
      continue;
    }
    for (const [k, v] of Object.entries(messages)) {
      if (typeof v?.message !== 'string' || v.message === '') fail(`[${label}] _locales/${l} 的 ${k} 缺少 message 文本`);
    }
    keySets.set(l, new Set(Object.keys(messages).map((k) => k.toLowerCase())));
  }
  const all = new Set([...keySets.values()].flatMap((s) => [...s]));
  for (const [l, keys] of keySets) {
    const missing = [...all].filter((k) => !keys.has(k));
    if (missing.length) fail(`[${label}] _locales/${l} 缺少消息：${missing.join(', ')}`);
  }
}

// ---------- 主流程 ----------

// 1) 产物目录
const outManifestPath = join(outDir, 'manifest.json');
if (!existsSync(outManifestPath)) {
  fail(`找不到 ${relative(root, outManifestPath)}，请先 npm run build / npm run zip`);
} else {
  const readOut = (p) => (existsSync(join(outDir, p)) ? readFileSync(join(outDir, p), 'utf8') : null);
  const outLocales = () => {
    const dir = join(outDir, '_locales');
    return existsSync(dir) ? readdirSafe(dir) : [];
  };
  checkManifest('产物目录', JSON.parse(readFileSync(outManifestPath, 'utf8')), readOut, outLocales, (p) =>
    existsSync(join(outDir, p)),
  );
}

// 2) zip
if (!existsSync(zipPath)) {
  fail(`找不到 zip：${relative(root, zipPath)}，请先 npm run zip`);
} else {
  const entries = readZip(zipPath);
  const files = [...entries.keys()].filter((n) => !n.endsWith('/'));
  const readZipText = (p) => (entries.has(p) ? entries.get(p)().toString('utf8') : null);
  const zipLocales = () => [
    ...new Set(files.map((f) => /^_locales\/([^/]+)\/messages\.json$/.exec(f)?.[1]).filter(Boolean)),
  ];

  const manifestText = readZipText('manifest.json');
  if (!manifestText) fail('zip 根目录缺少 manifest.json');
  else checkManifest('zip', JSON.parse(manifestText), readZipText, zipLocales, (p) => entries.has(p));

  const forbidden = [
    [/\.map$/i, 'sourcemap（*.map）'],
    [/(^|\/)\.DS_Store$/, '.DS_Store'],
    [/\.test\.[^/]+$/i, '测试文件（*.test.*）'],
    [/(^|\/)tests?\//i, 'tests/ 目录'],
  ];
  for (const f of files) {
    for (const [re, what] of forbidden) if (re.test(f)) fail(`zip 内不应包含${what}：${f}`);
  }
  if (!entries.has(NOTICES)) fail(`zip 根目录缺少 ${NOTICES}（运行 npm run notices 生成到 public/）`);

  if (errors.length === 0) console.log(`  zip：${relative(root, zipPath)}，${files.length} 个文件`);
}

function readdirSafe(dir) {
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, 'messages.json')));
}

if (errors.length) {
  console.error(`✖ 打包门禁未通过（${errors.length} 项）：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✔ 打包门禁通过');
