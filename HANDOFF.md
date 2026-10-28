# HANDOFF · 0.3.0 已完成，剩人工验收与上架

> 本文件只在交接时临时放根目录（见 `AGENTS.md`），看完即可删除。正式的设计共识在 `docs/design.md`，过程记录在 `docs/dev/`。

## 现在到哪了

0.3.0 的 9 张票（#39–#47）**全部实现并提交**，spec 是 [#38](https://github.com/cherishfall/page-mask/issues/38)。

- 单测：475 项全绿（`npm run compile && npx vitest run`）
- E2E：6 个套件 405 项全绿（`npm run test:e2e`）
- 打包门禁：`npm run check:package`、`npm run check:docs` 通过
- 版本号已改 0.3.0，`CHANGELOG.md`（中英）、`README.md`（中英）、`CHROMEWEBSTORE.md` 都已同步

**跑 E2E 的环境坑**：这台机器的工具沙箱里 Chrome 起不来（`sandbox initialization failed`），要加环境变量
`CHROME_ARGS="--no-sandbox --disable-gpu"` 再跑 `npm run test:e2e`。用户自己跑不需要。

## 这批做了什么（只给索引，细节别在这看）

| 事情 | 落点 |
|---|---|
| 新站点授权后直接进向导（根因：权限框会销毁 popup） | issue #39、`docs/dev/DEVLOG.md` 的 #39 段 |
| 管理页拆成「网站 / 设置」两个 tab + hash 路由 | issue #40 |
| 站点设置页（标题、图标、规则删除+撤销、一键清空） | issue #41 |
| 只想改标题也能配置（popup「设置标题和图标」→ 管理页「待添加」） | issue #42 |
| 向导清空 / 取消 / 危险按钮实底红 | issue #43 |
| 预览清单行内编辑（收起方式、同类范围、删除、命名改进） | issue #44 |
| 幕布（已添加站点） | issue #45、`docs/adr/0007-curtain-ephemeral-full-page-cover.md` |
| 幕布（未添加站点：popup「遮住本页」+ activeTab） | issue #46 |

设计共识与术语已同步：`docs/design.md`（「幕布」一节、界面清单、收起方案的界面用词）、`GLOSSARY.md`（新增「幕布」「管理页」「站点设置页」，收起方式改叫「消失 / 留空 / 盖住」）。

## 剩下的都是人工活

1. **真实权限弹窗验收**（E2E 用替身替换了 `permissions.request`，自动化覆盖不到）：
   - 在没添加过的网站上点扩展 → 点「为当前网站开启清爽模式」→ 点「允许」→ **向导应当直接出现，不需要点第二次**
   - 点「拒绝」→ 什么都不发生；再点一次扩展，权限框应当重新弹出
   - popup 的「重新授权」同样一次到位
   - popup 的「遮住本页」在没添加过的网站上应当当场遮住（`activeTab` 的授予时机只有真机能确认）
2. **商店截图重拍**：`docs/store-assets/` 里的截图 2（向导）与截图 5（管理页）是旧界面，还需要补一张幕布。
   `tests/e2e/store-shots.mjs` 还没跟上 0.3.0 的新结构，重拍前先改它（`CHROMEWEBSTORE.md` §8 里标了 ⚠️）。
3. **提交商店**：`CHROMEWEBSTORE.md` 是逐字段粘贴用的材料。权限与 0.2.0 一致（storage、scripting、activeTab + 按站点可选主机权限），隐私政策已复核、无变化。
4. **发 release**：0.2.0 那次是打 tag + 建 GitHub Release（附 zip）。0.3.0 同样做即可：`npm run zip` 后 `gh release create v0.3.0 .output/page-mask-0.3.0-chrome.zip --notes-file <CHANGELOG 的 0.3.0 段>`。

## 建议下一步调用的 skill

- 动手改代码前：`implement`
- 碰界面 / 交互：`modern-web-guidance`（先 search 再 retrieve）、`web-design-guidelines`、`ui-ux-pro-max`
- 碰扩展 API / 商店材料：`chrome-extensions`
- 再交接时：`handoff`
