# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## 协作原则（用户背景）

用户是 Java 后端工程师，不是产品/UI/UX/前端专业人士，这方面仅有有限的知识和经验。与用户协作时遵守：

1. **不盲从用户的决策**：用户在产品/UI/前端上的决策出于自身有限认知，未必了解影响面和准确性。若认为其决策不合适、有异议，或过程中产生了更好的建议，必须及时提出并再次讨论，直到双方都认为方案达到各自标准才通过；不允许一味采纳用户的决策。
2. **非专业用语优先**：能用大白话说清楚的，不用行话；必须使用专业名词时，先用一两句话解释这个名词是什么意思。
3. **优先成熟方案、多给选项**：存在经过广泛验证的组件和方案时优先推荐；讨论决策时尽可能多几个选项，说明各自的取舍、推荐及理由，避免用户因不知道某个方案的存在而错过更好的选择。
4. **主动指出知识盲区**：用户不具备的领域知识（浏览器行为、平台限制、行业惯例等）不可能由用户主动问出来。在相关决策点上，必须主动指出反直觉的行为、边界情况和平台限制（例如"标题设为空白会导致 Chrome 显示网址"这类坑），避免用户在不知情时做出不利于自己的决策。

## 语言与文档规范

- 开发过程文档一律用**中文**写（用户阅读效率优先）。
- 面向用户/外部的关键文档提供**中英双语**：`README.md`、`CHANGELOG.md`（release note）。
- 术语以根目录 `GLOSSARY.md` 为准，禁止使用各术语 _Avoid_ 字段列出的叫法。

## 文档目录结构

| 位置 | 用途 |
|---|---|
| `README.md` | 面向用户与 Chrome 商店审核：产品意图、安装、使用方法（中英双语） |
| `CHANGELOG.md` | 版本发布说明（中英双语） |
| `GLOSSARY.md` | 术语表（唯一权威） |
| `docs/design.md` | 最终设计共识，实现的唯一依据 |
| `docs/adr/` | 架构决策记录（ADR） |
| `docs/dev/` | 开发过程文档（开发日志 `DEVLOG.md`、测试与验证记录等）。过程文档**不要**堆在仓库根目录 |
| `HANDOFF.md` | 仅在任务中断需要交接时临时放根目录，交接完成后删除 |

## 开发纪律

- **完成一个可验收粒度的功能就 commit + push**（远程 `cherishfall/page-mask`，`master` 分支），不要攒大包提交。
- commit message 用 Conventional Commits（type/scope 英文，正文可中文）。
- 遇到超出 `docs/design.md` 已定范围的技术决策：**先调研成熟开源项目**（uBlock Origin、Dark Reader、Tabee/chrome-tab-modifier 等）的做法，综合做出合理决策后继续推进，不阻塞等待用户；重要取舍事后补记 ADR 或 DEVLOG。
- 实现的结构与写法参考成熟插件，力争最佳实践；设计文档中「永不做」清单（快捷键、全局总开关、预置规则、远程订阅、右键菜单、免保存临时隐藏）任何情况下不得违反。

## 测试与验证

- 每个功能配必要测试（单测 + 关键路径），测试不过不提交。
- 最终阶段用浏览器自动化在真实网站验证：**微信读书、得到、极客时间、墨问**。
- 真实网站验证只使用**匿名可访问页面**和专用测试浏览器配置；不使用用户的登录态、个人数据。

## 临时文件

- agent 与脚本产生的一切临时文件（草稿、日志、探针脚本、导出的 issue 正文、浏览器测试配置等）**一律放在仓库内 `tmp/`**（已在 `.gitignore`），不要写到系统 `/tmp`、家目录或其它位置。用完可删，`tmp/` 整个清空也不影响项目。
- E2E 工具（`tests/e2e/lib/tmp.mjs`）与脚本已默认使用 `tmp/`；新写的脚本要用临时目录时同样指向 `tmp/`。
- 所有文件路径用仓库内路径；写仓库外的路径（例如误把 `docs/...` 写到上一级目录）会被权限配置直接拒绝，出现时检查路径而不是重试。

## 会话与上下文

- 大块探索、批量代码生成优先派 subagent 承担（重活可用 GLM-5.3-Flash），保持主会话上下文精简，必要时主动压缩上下文。
- 进度以 git 增量提交保底，任何中断不丢工作。
- 若 token 不足或无法继续：写 `HANDOFF.md` 到仓库根目录，供用户切换模型/工具续跑。

## 本机网络环境（仅适用于用户这台 Mac）

- 用户位于中国内地，访问 GitHub 依赖本地 Clash 代理 `127.0.0.1:7890`（代理可能掉线，掉线时 git/gh 降级为本地操作稍后重试）。
- `gh` 命令必须加前缀 `HTTPS_PROXY=http://127.0.0.1:7890`；本仓库 git 已配仓库级代理，git 命令免前缀。
- npm 镜像只配在用户级 `~/.npmrc`（`registry=https://registry.npmmirror.com`）；**仓库不带 `.npmrc`**，`package-lock.json` 里的 `resolved` 必须全部是 `https://registry.npmjs.org`（CI 与其他贡献者用官方源）。已实测的规则：
  - `npm ci`、不带包名的 `npm install`：npm 默认 `replace-registry-host=npmjs`，下载时把 lockfile 里的官方地址自动换成镜像，**不改写 lockfile**，日常装依赖直接用即可（快）。
  - **新增 / 升级 / 删除依赖**（`npm install <pkg>`、`npm update`、重建 lockfile）：新写入的条目会记录成镜像地址。必须临时指定官方源：`npm install <pkg>@<精确版本> --save-exact --registry=https://registry.npmjs.org`（官方源可直连但慢，超时给足）。
  - 提交前核对：`grep -c registry.npmmirror.com package-lock.json` 应为 0；若不为 0，删除 `node_modules` 与 `package-lock.json` 后用 `npm install --registry=https://registry.npmjs.org` 重建。
  - `npm audit` 镜像不支持，一律加 `--registry=https://registry.npmjs.org`。
- 依赖一律精确版本（无 `^`/`~`）。依赖版本变化后运行 `npm run notices` 重新生成 `public/THIRD_PARTY_NOTICES.txt` 并提交（CI 会校验它是否过期）。
