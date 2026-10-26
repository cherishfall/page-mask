# 无人值守实现开工说明（PageMask 1.0.0 质量加固）

> 给执行实现的 agent 读。用户在睡觉，**全程不要向用户提问或等待确认**；所有产品决策已在 GitHub 上定好。遇到真正无法自行决定的事，按第 6 节处理后继续推进下一张票。

## 1. 开工前必读（按顺序）

1. `AGENTS.md`：协作规范、语言、目录、提交纪律、本机网络（`gh` 必须加 `HTTPS_PROXY=http://127.0.0.1:7890` 前缀）
2. GitHub spec #18 正文与评论：`HTTPS_PROXY=http://127.0.0.1:7890 gh issue view 18 --comments`（任务表、依赖、**已确定的决策**）
3. `docs/dev/review/REVIEW.md` 及附录 `appendix-ui.md`、`appendix-store.md`：每张票引用的问题编号（B/N/D/Q）的证据、行号与修复要点
4. `docs/design.md`（含「永不做」清单）、`GLOSSARY.md`、`docs/adr/`
5. 当前票的正文与全部评论（评论里的用户决策优先于正文）

需要时激活 skill：`chrome-extensions`（所有涉及扩展 API / manifest / 商店的票）、`modern-web-guidance`（所有 UI 票，按票里列出的指南 id `retrieve`，并在提交说明里写明遵循了哪些指南）、`tdd`（修 bug 先写失败测试）、`implement`。

## 2. 已确定的决策（不要再问）

| 事项 | 决定 | 票 |
|---|---|---|
| 新图标 | 方案 A：浏览器窗口 + 擦除带，主色同设计 tokens 主色 | #27 |
| 默认标签页 | 图标全透明；默认标题中文「阅读」/ 英文 "Reading"；管理页快捷标题至少含「新建标签页」/"New Tab"、「阅读」、「文档」、「笔记」；公开材料不宣传 New Tab | #35 |
| npm 镜像 | 移除仓库 `.npmrc` 镜像，lockfile 用官方源重建；本机镜像写入 `~/.npmrc` 并在 AGENTS.md 说明 | #30 |
| 隐私表单 | 勾 Website content + Web history；三条 Limited Use 全勾；政策写明仅存本机 | #36 |
| 第三方图片 | 从仓库删除，**不改写 git 历史、不 force push**；AGENTS.md 加截图规则 | #36 |
| 联系邮箱 | cherishfall@hotmail.com | #36 |

## 3. 分支与提交

- 在分支 **`release/1.0.0`** 上工作（不存在就从 master 创建并 `git push -u origin release/1.0.0`）。不直接推 master，方便用户早上审阅；全部完成后开 PR 到 master（第 7 节）。
- 每张票完成即提交并推送，Conventional Commits，正文中文，结尾写 `Closes #<票号>`（合并到 master 前不会自动关闭，所以还要手动关票，见第 4 节）。
- 禁止：force push、改写历史、`git reset --hard`、`git clean -f`、改全局 git 配置、修改 Kiro 权限文件。这些已被权限配置拒绝，被拒时换做法，不要重试同一命令。

## 4. 工作循环

重复以下步骤，直到 #18 下除 #37 外的票全部关闭：

1. **找可开工的票**：#18 的子 issue 中，状态 open、所有 blocked-by 票都已关闭的票。查询：
   `HTTPS_PROXY=http://127.0.0.1:7890 gh api repos/cherishfall/page-mask/issues/<n> --jq '.issue_dependencies_summary.blocked_by'`（为 0 即可开工）。
   多张可开工时按此顺序取：#19 → #30 → #33 → #27 → #31 → #32 → #20 → #21 → #35 → #28 → #22 → #23 → #34 → #24 → #25 → #26 → #36 → #29 → #37。
2. **认领**：`gh issue edit <n> --add-assignee @me`，并评论"开始实现"。
3. **实现**：先读票里引用的审查条目，再读相关代码；bug 类先写能复现问题的失败测试（单测或 E2E），再修到通过。只做票内范围，顺手发现的新问题记到 #18 评论，不要扩大改动。
4. **验证**（全部通过才算完成）：
   - `npm run compile`
   - `npm test`
   - `npm run build`
   - 涉及运行时/界面的票：`npm run test:e2e`（Chrome for Testing 在 `/tmp/cft/`；若缺失，从 `https://registry.npmmirror.com/-/binary/chrome-for-testing/` 下载 mac-arm64 版解压到 `/tmp/cft/` 并执行 `xattr -dr com.apple.quarantine /tmp/cft`；#31 完成后改用其下载脚本。品牌版 Chrome 137+ 会忽略 `--load-extension`，不能替代）
   - 对照票的每一条 Acceptance criteria 逐条核对；无法自动验证的条目（例如需要真实授权弹窗、肉眼看图标）在票里评论说明"需用户人工验收"，不要假装完成。
5. **收尾**：提交推送 → 在票里评论（做了什么、怎么验证的、提交哈希、遗留的人工验收项）→ 勾选已满足的验收项 → `gh issue close <n>`。重要取舍补记到 `docs/dev/DEVLOG.md`。

## 5. 质量要求

- 用户可见文案一律清爽话术，按 GLOSSARY 的"界面用词"；不出现「伪装 / 摸鱼 / 泄露 / disguise」。代码内部命名可保留。
- 「永不做」清单不得违反（快捷键、全局总开关、内置预置规则、远程订阅、右键菜单入口、免保存临时隐藏）。popup 里的普通按钮不算右键菜单入口。
- 新增依赖用精确版本，优先成熟库；不引入网络请求、远程代码。
- 大块探索或批量改动可派子代理，主会话保持精简。

## 6. 卡住时怎么办（不要停下来等人）

- **网络/代理失败**：git 本地提交照常，`gh` 操作稍后重试（间隔几分钟，最多 5 次）；仍失败就把要写的评论内容追加到 `docs/dev/DEVLOG.md` 的"待同步到 GitHub"小节，继续干活。
- **测试环境问题**（浏览器下载失败等）：先完成能验证的部分，在票里说明未验证项，保持票 open，加评论 `blocked: 原因`，转去做下一张可开工的票。
- **真正需要产品决策**：按审查文档的推荐方案执行，在票里写明"按审查推荐执行，待用户确认"，继续推进。
- **同一做法失败两次**：停止微调，分析根因，换一种思路。
- **上下文快用完**：先提交推送已完成的工作，把进度、当前票、下一步写进根目录 `HANDOFF.md`（按 AGENTS.md），推送后再继续或结束。

## 7. 全部完成后

1. 在 `release/1.0.0` 上最后跑一遍 compile / test / build / test:e2e / zip。
2. 开 PR：`HTTPS_PROXY=http://127.0.0.1:7890 gh pr create --base master --head release/1.0.0`，标题不超过 70 字符；正文写：完成的票、验证方式、**需要用户人工验收的清单**（真实授权弹窗、图标 16px 观感、商店截图、审核员测试步骤实走）、未完成或 blocked 的票。
3. 在 #18 评论一份早间报告（与 PR 正文要点一致，附 PR 链接）。
4. 不要合并 PR、不要提交商店，这两步留给用户。
