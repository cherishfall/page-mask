# HANDOFF — 0.2.0 质量加固进度（2026-10-27，因积分不足暂停）

读 `AGENTS.md`、`docs/dev/AGENT-KICKOFF.md` 后按其工作循环继续。远程 master 最新提交 `f3781e2`，已推送。

## 已完成并关闭（均已推送、票内有验证评论）
#19 #27 #30 #31 #32 #33 #20 #21 #35 #22 #26 #28

## 剩余（按开工说明顺序）
#23 遮罩 → #34 向导 → #24 编辑面板 → #25 悬浮按钮/页内无障碍 → #36 文档与商店文案 → #29 商店素材与 0.2.0 发布（版本号、CHANGELOG、tag v0.2.0、#18 早间报告）。#37 不做。
- #23、#34 已认领并评论"开始实现"，代码未完成。
- 完成 #36/#29 前不要删 HANDOFF.md 以外的东西；#36 要求删除本文件和 `docs/dev/evidence/real-*.png`。

## 工作区里的未提交半成品（未验证，不要直接提交）
两个被中断的子任务留下：
- #23：`core/mask-color.*`、`ui/mask-color.ts`、`ui/mask-layer.ts`、`ui/follow.ts`、`tests/follow.test.ts`、`tests/mask-layer.test.ts`、`tests/e2e/check-mask.mjs`，`ui/content-runtime.ts` 有改动
- #34：`ui/wizard/*`（含新增 `wizard-styles.ts`、`wizard.css`）、`core/wizard-logic.*`、`tests/e2e/check-wizard.mjs`
- 共同改动：`package.json`（test:e2e 追加脚本）、`tests/e2e/run-e2e.mjs`

处理办法：先 `npm run compile && npm test && npm run build && npm run test:e2e` 看这些改动是否可用；可用则按票逐条核对验收后分票提交，不可用则 `git stash` 后重做。两张票会同时改 `ui/content-runtime.ts`，注意分开提交。

## 已知需要后续处理
- `tests/e2e/run-e2e.mjs` 里指向 #25 的预期失败（菜单「编辑规则」）在 #25 完成时转正。
- 失效项「去处理」按钮归 #24/#25。
- #36 需把 GLOSSARY 加"界面用词"字段（管理页现用词：清爽模式、收起项、网站、待授权）。
- 人工验收项：真实授权弹窗（重新授权/授权并启用/一次授权全部）、16px 图标观感、正式版 Chrome 标签栏对比（CfT 里新标签页显示了图标）、商店截图、审核员步骤实走。
- CI 在 `b7b8d76` 后的运行结果未确认；Dependabot 首次运行报错可能需在仓库设置里启用。
- `/tmp/pm-head-*`、`/tmp/pm-iso-*` 为子代理遗留临时目录，可手动清理。

## 命令
`gh` 加 `HTTPS_PROXY=http://127.0.0.1:7890`。验证：`npm run compile && npm test && npm run build && npm run zip && npm run check:package && npm run test:e2e`。
