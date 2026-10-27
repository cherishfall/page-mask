/**
 * 项目内临时目录：所有 E2E / 脚本的临时文件统一放在 <仓库>/tmp/（已在 .gitignore），
 * 方便查找和清理，不散落到系统 /tmp。
 *
 * 导入本模块即生效：把 TMPDIR 指向 <仓库>/tmp，之后 os.tmpdir() 以及子进程（Chrome）的临时文件都落在这里。
 * 已显式设置 PM_KEEP_SYSTEM_TMP=1 时不改动（例如 CI 想用系统临时目录）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_TMP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../tmp');

fs.mkdirSync(PROJECT_TMP, { recursive: true });
if (!process.env.PM_KEEP_SYSTEM_TMP) process.env.TMPDIR = PROJECT_TMP;
