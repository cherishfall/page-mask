# 交接 / 工作前沿（0.7.0 批次）

最后更新：2026-11-06 18:17
当前版本：`0.6.7`（tag `v0.6.7`），分支 `master`。子票 1（`b261615`）、子票 2（`633baad`）已提交推送；子票 3 文档已改完待提交；下一步发版 `0.7.0`。
本批目标：实现 issue#116「按站点收起图片 / 收起视频 / 网页静音」→ 发版 `0.7.0` → 全量复查并迭代到收敛。

## 状态表

| 步骤 | 状态 | 备注 |
|---|---|---|
| 读项目文档 / 调研代码与同类产品 | 已完成 | 调研存档 `docs/dev/research-media-hiding.md`；平台事实已核实（见下） |
| 实现方案 + 待确认项 | 已完成，**产品所有者已确认** | `docs/dev/design-116.md`；拍板：小图标留原样、三处叫法定稿「收起图片 / 收起视频 / 静音网页」、菜单用开关角色、弹窗收成一组 |
| 子票 1 数据与行为 | **已完成、已推送** | 字段 / 校验 / CSS / 视频 / 静音 / 单测；`npm run compile` 通过、单测 670 全过、主 E2E 240 项全过 |
| 子票 2 三处界面 + i18n + 术语表 | **已完成、已推送** | 站点设置页卡片 / 弹窗一组三行 / ⋯ 菜单三个勾选项；`compile`、单测 679 项、全套 E2E 841 项全绿 |
| 子票 3 文档 + ADR-0012 | 已改完，待提交 | ADR-0012、`docs/design.md` / `design-ui.md` / `dev/design-116.md` / `dev/DEVLOG.md`、`README.md`、`CHANGELOG.md`（0.7.0 中英）、`CHROMEWEBSTORE.md`、`PRIVACY.md` 全部更新；`check:docs` / `check:package` 通过（32 个文件） |
| 发版 0.7.0 | 未开始 | 版本号 → push → annotated tag → `gh release create` 附 `.output/*.zip` → 回填本文件 |
| 全量复查（含视觉）→ 新 issue → 0.7.x 迭代 | 未开始 | 按 `docs/dev/visual-review.md` |

## 建议顺序

1. 产品所有者已确认方案（小图标留原样、三处叫法定稿、菜单用开关角色、弹窗收成一组），无需再问。
2. 按上表子票顺序串行做；一票一提交，主会话亲自验收（关键实现抽查、全套门禁重跑）再提交推送。
3. 发版后立刻开复查轮，问题开新 issue，修完版本号第三位 +1 再发版，直到收敛。

## 硬约束（别踩）

- 一票一提交一推送：做完立刻 commit + **立即 push** 到 `master`，`gh issue close --comment "已实现，commit <hash>：一句话"`，再更新本文件，才做下一张。严禁攒着批量关。
- 门禁：`npm run compile` + `npx vitest run` + E2E（`CHROME_ARGS="--no-sandbox --disable-gpu"`）；文档票加 `npm run check:docs` / `check:package`。
- 新增字段必须同时改 `core/types.ts`、`core/validate.ts` 的 `sanitizeProfile` 白名单、`core/apply-key.ts`（否则拨开关不生效）。
- CSS 走现有 `insertCSS` 用户样式表通道（`origin: 'USER'` + `!important`），禁止行内样式 / `<style>` 标签 / 新权限 / DNR。
- 不改 `wxt.config.ts` 的权限集；`tabs.update({muted})` 已核实无需 `tabs` 权限。
- 不碰「永不做」清单：全局总开关、快捷键（幕布那条除外）、预置规则、远程订阅、右键菜单、免保存临时隐藏。
- 界面文案以 `GLOSSARY.md` 为唯一权威，中英两份 `core/i18n/messages.*.ts` 同步（键集合有单测守门）；禁止「清空 / 一键 / 屏蔽 / 拦截 / 配置」等 Avoid 词。
- 全过程文档中文；`README.md` / `CHANGELOG.md` 中英双语。临时文件一律放仓库内 `tmp/`。
- 真实网站验证只用匿名可访问页面与专用测试浏览器配置，第三方截图不入库（要入库先打码并放 `docs/dev/`）。
- 批次结束后删除本文件，过程教训进 `docs/dev/DEVLOG.md`，架构决策进 `docs/adr/`。

## 已核实的事实（省后续排查）

- `chrome.tabs.update({muted})` 不需要新增权限；`MutedInfo` 有 `reason`（`user` / `capture` / `extension`）与 `extensionId`（Chrome 46+），可据此只解除本扩展设置的静音。
- Chrome 自带的「静音网站」是按域名持久的站点权限，与扩展的标签页级静音互不覆盖；扩展不抢它。
- 没有 `tabs` 权限时 `tabs.query({})` 读不到 `tab.url`，但已授权站点有主机权限；静音消息走 `sender.tab.id` 定位，不依赖 query 读 url。
- 胶囊菜单当前**不是** `role="menu"`（`ui/FloatingToggle.vue` 源码注释），mini 形态没有 ⋯ 菜单；三项勾选要用开关角色，不能孤零零用 `menuitemcheckbox`。
- 弹窗 `ui/popup/PopupBody.vue` 宽 320，欢迎页直接复用同一组件做示意图；改动会自动反映到首次引导第 2 步。
- E2E：CfT 157 品牌版 Chrome 忽略 `--load-extension`，权限靠构建产物改 manifest 预授予；`chrome.action.openPopup()` 不授予 activeTab；check-mask 偶发 CDP 超时复跑即过。
- 仓库 `git stash@{0}` 是 `wip(#116): types+validate 预留字段`，票里明确说**不要当半成品继续用**，按票定稿重做。

## 发版流程

版本号 → `CHANGELOG.md`（中英）→ push → annotated tag（message = 中文 changelog 小节）→
`HTTPS_PROXY=http://127.0.0.1:7890 gh release create` 附 `.output/*.zip` → 更新本文件。
