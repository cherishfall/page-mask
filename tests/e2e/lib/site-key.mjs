/**
 * core/site-key.ts 的测试侧复用（#192）：真站 E2E 的站点 key 必须与扩展内核同一套
 * eTLD+1 语义（0.9.1 时 harness 自己写的简版只保留 host[:port]，真站多段域名的档案
 * 写错存储键，内容脚本按内核 key 找不到 → 按设计休眠）。测试侧不许另写「半个实现」，
 * 这里用 devDependencies 里的 TypeScript 把内核源码转译成 Node 可直接 import 的 .mjs
 * （core/site-key.ts 无外部依赖，纯类型擦除即可）。
 *
 * 产物写到 tmp/e2e-gen/site-key.mjs（已在 .gitignore，tmp/ 可随时清空）：
 * 导入本模块即自动生成（内容与源码转译结果逐字节比对，落后或缺失才重写，幂等）；
 * 也可以在跑 E2E 前显式执行 `node tests/e2e/lib/site-key.mjs` 预生成（package.json 的
 * test:e2e 链第一步）。生成物不许提交进库。
 *
 * 一致性由 tests/harness-site-key.test.ts 守门：harness.siteKeyOf 与 core.siteKey
 * 对一组真实主机名逐个相等。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '../../../core/site-key.ts');
const OUT_DIR = path.join(HERE, '../../../tmp/e2e-gen');
const OUT = path.join(OUT_DIR, 'site-key.mjs');

/** 转译内核源码（每次调用都重新转译，几十毫秒级；结果只与源码内容有关） */
function transpileCoreSiteKey() {
  const ts = createRequire(import.meta.url)('typescript');
  const src = fs.readFileSync(SOURCE, 'utf8');
  return ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
}

/**
 * 确保 .mjs 产物存在且与当前源码一致，返回产物路径。
 * 内容比对（不比 mtime）：跨进程幂等，源码一改自动失效。
 */
export function ensureCoreSiteKeyBundle() {
  const code = transpileCoreSiteKey();
  if (fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === code) return OUT;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, code);
  return OUT;
}

const mod = await import(ensureCoreSiteKeyBundle());

/** 与 core/site-key.ts 的 siteKey 同一实现（eTLD+1，IP / localhost / 单标签 / 带端口不合并） */
export const siteKey = mod.siteKey;
/** 与 core/site-key.ts 的 sitePatterns 同一实现（站点 key → 规范匹配模式） */
export const sitePatterns = mod.sitePatterns;

/** 直接执行本文件（node tests/e2e/lib/site-key.mjs）= 预生成产物后退出 */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(`✓ core/site-key.ts 已转译到 ${path.relative(process.cwd(), OUT)}`);
}
