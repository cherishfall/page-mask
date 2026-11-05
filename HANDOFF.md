# HANDOFF — PageMask 交接（2026-11-05 10:15）

用户换用别的 harness 框架，本文件是完整交接。仓库：`/Users/lifan/AiCodingProjects/page-mask`，远程 `cherishfall/page-mask`，分支 `master`。

## 一、现在是什么状态

**已发版 0.5.5**（tag `v0.5.5`，zip 在 `.output/page-mask-0.5.5-chrome.zip`）。测试基线全绿：

- `npm run compile`（vue-tsc）✅
- `npx vitest run` → 35 文件 / **611 项** ✅
- `npm run test:e2e` → 七个脚本 **98 / 188 / 16 / 155 / 63 / 146 / 26** ✅
- 真站冒烟 `node tests/e2e/run-e2e-real.mjs` → weread / dedao / mowen ✅（geekbang 返回 451，环境限制，与插件无关）
- 商店素材 `node tests/e2e/store-shots.mjs` → `docs/store-assets/`（已按 0.5.2 重拍；0.5.3–0.5.5 的界面变化只涉及向导标记与引导页，**商店截图待重拍**）

## 二、今晚到今晨做了什么（全部已推送，master）

| 版本 | 收的票 |
|---|---|
| 0.5.1 | #83 拖动把手统一共享 SVG；#84 位置改「贴边侧锚定」（mini↔全功能往停靠边收）；#85 圆角随端点（悬停底色不再溢出胶囊）；#86 改名「全部网站设置」；#87 首轮目检三修（幕布按钮可见性、弹窗空状态文案、夹具侧栏）；#88 多抓鱼实站三问题（捕获层滚轮路由、同类计数随懒加载、预览「检查同类」） |
| 0.5.2 | #92 第二轮目检三修（「打开开关后」四处文案指名道姓、onboarding 底栏 sticky、幕布「恢复」二字常显） |
| 0.5.3 | #93 引导页文字减负：四段长文 → 每步一句 + 四张小图 |
| 0.5.4 | #94 拖动回归修复（#84 重写时删掉「拖动中跟手」分支，右半视口拖动被钉死右缘） |
| 0.5.5 | #82 标记语言定案（密行号码牌移到该行左侧）；#95 check-mask 的 rAF 兜底 |

**根因与机制**：`docs/dev/visual-review.md`（交接关/发版关 + 五条防滥用闸门）、`docs/dev/consistency-checklist.md`（十条缺陷索引）、AGENTS.md 两处指针。这套机制是本次返工循环的产物——此前交付门禁只有 DOM 断言、零截图目检，用户是唯一的目检环节。

## 三、给用户的遗留清单

1. **装机复核 0.5.5**：重点是多抓鱼（点选滚动 / 懒加载计数 / 「检查同类」往返）、胶囊拖动跟手、引导页新观感、密行号码牌。
2. **商店提交前**：`CHROMEWEBSTORE.md` 的「0.5.0 待重走」检查单要在真实 Chrome 重走一遍；商店截图需按 0.5.5 重拍（`node tests/e2e/store-shots.mjs`，注意 `store-shots.mjs` 里的向导流程已在 #91 改过）。
3. **master → main**：仓库主分支仍是 `master`，如需改名要先确认远端默认分支与商店提交流程。

## 四、下一步能做的事（按性价比）

1. **发版前全量巡检**（`docs/dev/visual-review.md` 的发版关）：28 张截图在 `tmp/visual-audit/2026-11-05/`（`node tmp/visual-audit/shoot-2026-11-05.mjs` + `retake-capsules.mjs` 可重跑），派一个**无代码上下文**的子代理只看图挑毛病，一轮出完。
2. **真机复核多抓鱼 / 得到 / 极客时间 / 墨问**（AGENTS.md 要求，只用匿名可访问页面与专用测试配置）。
3. **store-shots 按 0.5.5 重拍并核对构图**。
4. **未做的产品议题**（都有依据，需要用户拍板，不要自行决定）：「按设置」短名是否改回长名、mini 态是否加文字兜底、插件设置页默认标题语言（#89 已随显式界面语言走）。

## 五、常用命令

```bash
npm run compile                 # vue-tsc 类型检查
npx vitest run                  # 单测（611 项）
npm run test:e2e                # 全套 E2E（七个脚本）
npx wxt build && node tests/e2e/check-<xxx>.mjs   # 单个 E2E 脚本
node tests/e2e/run-e2e-real.mjs # 真站冒烟（匿名页）
node tests/e2e/store-shots.mjs  # 商店素材
npm run zip                     # 打包（产物 .output/page-mask-<版本>-chrome.zip）
npm run check:docs              # 文档禁用词与链接检查
npm run check:package           # 打包门禁
```

发版序列：改 `package.json` version → `CHANGELOG.md` 加中英双语小节 → `npm run zip` → commit → `git tag vX.Y.Z` → `git push --follow-tags`。

## 六、环境注意事项（这台 Mac）

- `gh` 必须带前缀：`HTTPS_PROXY=http://127.0.0.1:7890 gh ...`；git 已配仓库级代理，git 命令免前缀。
- npm 用官方源精确版本：`npm install <pkg>@<精确版本> --save-exact --registry=https://registry.npmjs.org`；提交前核对 `grep -c registry.npmmirror.com package-lock.json` 应为 0。
- 依赖变更后跑 `npm run notices` 重生成 `public/THIRD_PARTY_NOTICES.txt`。
- 临时文件一律放仓库内 `tmp/`（已 gitignore）。

## 七、Git 状态

`master` 与远端同步，工作区干净（本次全部提交已推送）。最近提交：

```
0.5.5  chore(release): 0.5.5——标记语言定案
       fix(wizard): 密行的号码牌移到元素左侧，归属一眼确定 (#82 标记语言)
       docs(handoff): …
```

未推的远端：无。
