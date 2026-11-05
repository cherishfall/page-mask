# HANDOFF — PageMask 0.6.1 实施交接（2026-11-06）

> 给下一个执行者（zcode）。这是一份自包含交接：先读本文，再读 `AGENTS.md`、`GLOSSARY.md`、`docs/design.md`、`docs/design-ui.md`，然后读 GitHub 上的 **#106（spec）** 与 **#107–#113（子票）**。票里有完整验收；本文补跨票决策、落点、坑与环境。
>
> 目标：**按顺序实现 #107–#113，发 0.6.1**。不发 0.7.0；不要把 0.6.0 重新发一遍。

## 0. 进度表（执行时随手更新）

| 票 | 内容 | 状态 |
|---|---|---|
| #107 | 幕布状态收敛为唯一控制器（P0） | ☐ |
| #108 | 欢迎页内容区滚动 + 底栏固定 | ☐ |
| #109 | 胶囊收到 WCAG 最小尺寸（32→26） | ☐ |
| #110 | 不透明度 10%–100% 滑杆 | ☐ |
| #111 | 单站「不显示胶囊」开关 | ☐ |
| #112 | 弹窗补齐删除与胶囊开关（依赖 #111） | ☐ |
| #113 | 列表页行尾删除 | ☐ |
| #105 | 0.6.1 文档、商店素材与发版 | ☐ |

建议顺序：#107 → #108 → #109 → #110 → #111 → #112 → #113 → #105。
依赖：#112 blocked by #111；#105 blocked by #107–#113（GitHub 原生依赖已挂）。

## 1. 版本口径（很重要）

- 用户已经装过并复核了 **0.6.0** 的构建（0.5.5 + #98–#104 的内容）。
- 但仓库 `package.json` 仍是 **0.5.5**，没有 `v0.6.0` tag；`#105` 原来叫「0.6.0 文档、商店素材与发版」，现已改成 **「0.6.1 文档、商店素材与发版」**。
- **本批发 0.6.1，不发 0.7.0**。版本从 0.5.5 直接到 0.6.1。
- **不要追溯补 `v0.6.0` tag**，除非用户明确要求。
- 0.6.1 同时包含两轮内容：
  - #97 第一轮（#98–#104，已关闭）= 0.6.0 装机内容；
  - #106 第二轮（#107–#113）= 本批修复。
- `CHANGELOG.md` 要有 **0.6.0 与 0.6.1 两节**，中英逐条对应；0.6.0 那节注明是「装机版」，版本历史才连续。

## 2. 当前仓库状态（开始前先核对）

- 路径：`/Users/lifan/AiCodingProjects/page-mask`
- 远程：`cherishfall/page-mask`，分支 `master`
- 交接时 HEAD：`b200c7d fix(icon): 16px 的眼洞改回圆点，不再是方眼 (#104)`
- `package.json`：`0.5.5`
- #98–#104 已关闭；#105 已改为 0.6.1 发版；#106 + #107–#113 开着。
- 工作区应当干净；`tmp/` 下可能有上一轮的探针与截图（已 gitignore，可清）。

开始前跑一遍：

```bash
git status --short
git log --oneline -8
node -p "require('./package.json').version"
HTTPS_PROXY=http://127.0.0.1:7890 gh issue list --state open --limit 12
```

如果 #105 的状态/标题与本文不一致，**以 GitHub 当前状态和用户最新指令为准**，并在动手前先把差异记到票里。

## 3. 这批的四个根子（读票前先建立框架）

1. **幕布状态没有唯一主人**：页面上可能有常规内容脚本 + 一次性脚本两套幕布控制器；一次性脚本不认「遮住」；快捷键问状态时只取第一个回话。→ #107。
2. **欢迎页没把矮视口当约束**：整页滚动 + sticky 底栏，底栏压住第 2 步；切步不滚动。→ #108。
3. **胶囊存在感只有三档、不能退出**：最低 70% 仍显眼；不能隐藏；尺寸 32 高、170 宽。→ #109 / #110 / #111。
4. **入口能力不对等**：胶囊有删除，弹窗没有；列表没有删除；隐藏胶囊会把这些功能架空。→ #112 / #113。

## 4. 每票的落点、做法与坑

### #107 幕布状态收敛为唯一控制器（先做）

**文件**：`entrypoints/curtain-oneshot.ts`、`ui/content-runtime.ts`、`ui/curtain.ts`、`core/background-engine.ts`、`entrypoints/popup/App.vue`、`core/messages.ts`。

**做法**

- 每个文档一个页面级控制器，接口 `state() / cover() / dismiss() / toggle()`，`cover`/`dismiss` 幂等。
- 统一登记在 `window.__pagemaskCurtain`；常规内容脚本与一次性脚本共用。一次性脚本启动时若已有控制器，**只委托，不再铺层**；控制器失效要注销（带令牌，避免旧实例删新登记）。
- 消息保留 `curtainState` / `curtainCover` / `curtainDismiss`，新增 `curtainToggle`；后台快捷键只发 `curtainToggle`，没接收方才注入一次性脚本。
- `sendResponse` 返回**动作执行后**的状态；异步时 `return true`。
- 弹窗打开用 `curtainState` 初始化，点击用 `curtainToggle` 并更新本地 `covered`。
- 幕布铺开后胶囊仍卸掉（#50：页面上只留一颗「恢复」按钮）；不要试图把胶囊留在幕布上。

**实测事实（可直接引用）**

- SW → 内容脚本 `sender.url = chrome-extension://<id>/background.js`，`fromExtensionPage` 放行，不是消息被拒。
- 已添加网站、内容脚本活着时，`state=false → cover=true → state=true → dismiss=false → state=false → cover=true` 全通。
- 一次性脚本只认 `curtainState` / `curtainDismiss`，后台在「没遮着」时发 `curtainCover`，所以「遮 → 撤 → 再遮」第 3 次失效。

**测试**：新增 `tests/e2e/check-curtain-state.mjs`，加进 `package.json` 的 `test:e2e` 链；覆盖已添加网站四组合、未添加网站「遮 → 撤 → 再遮」、`pagemask-curtain` 宿主 ≤1。真机手测四组合（#101 遗留，必须补）。

**坑**：内容脚本与一次性脚本是否同一隔离世界；多监听器时 `tabs.sendMessage` 只取第一个 `sendResponse`；扩展重载后旧内容脚本失联；`coverPage` 不要无条件注入第二套。

### #108 欢迎页内容区滚动 + 底栏固定

**文件**：`entrypoints/onboarding/App.vue`（可能加 `styles/base.css` 的小工具类）。

**实测**：1084×544 下文档高 1141；三张步骤卡 134 / **512** / 183；底栏 sticky 488–544，压住第 2 步；手动能滚，切步不滚。

**做法**

- 应用壳：`body/#app height:100dvh`；`.page` 改成 `display:flex; flex-direction:column; height:100dvh; max-width:560px; margin:0 auto`。
- 新增 `.scroll`：`flex:1; min-height:0; overflow-y:auto; padding:48px 24px 24px; scrollbar-gutter:stable; overscroll-behavior:contain`。`h1`、副标题、`.steps`、`.tip` 全放进去。
- `.nav`：`flex:none; position:static`（不再 sticky）；`padding:12px 24px calc(12px + env(safe-area-inset-bottom))`；`border-top:1px solid var(--pm-border)`；`background:var(--pm-bg-subtle)`。操作栏只放按钮与圆点。
- 切步：`await nextTick()` → `.step.active.scrollIntoView({block:'start'})`；`prefers-reduced-motion` 用 `auto`；`.step { scroll-margin-block: 12px }`。
- 读屏：一条 `role="status"` 的视觉隐藏文本播报「第 N 步，共 M 步：<标题>」；不抢焦点。

**测试**：1084×544 与 1440×900 两档；底栏不覆盖 `scroll`；第 2 步能完整滚到；高窗口无多余滚动条；Tab 顺序。

**坑**：flex 子项要 `min-height:0` 才能滚；`100dvh` 不是 `100vh`；macOS 覆盖式滚动条看不见，别用「有没有滚动条」判断；headless 里 `Runtime.callFunctionOn` 偶尔超时（已知抖动，复跑）。

### #109 胶囊收到 WCAG 最小尺寸

**文件**：`ui/toggle/toggle.css`、`tests/e2e/check-toggle.mjs`、`docs/design-ui.md`。

**实测**：全功能 170×32；mini 80×30；主按钮 64×26；四段 24×26（被主按钮撑高）。

**做法**

- `.pm-tg`：`padding: 2px` → `0`；`border:1px` 保留；`gap:1px` 先保留。
- `.pm-tg-main`：`padding: 4px 8px` → `3px 7px`；12px 字号、18px 行高不变 → 高 24。
- 四段 `min-*:24px` 不变；`align-items:stretch` 拉到 24；容器 24+2 边框 = **26**。
- mini 同样 26 高；宽度约 76。
- 全功能宽度约 164（外框 −4、主按钮左右 −2）；不要为了宽度删文字或删段。
- 首尾圆头、悬停底色、焦点环重新目检；不要加 `overflow:hidden`（会裁焦点环）。
- 触屏 `@media (pointer: coarse)` 40×40 不动。

**验收**：高度 26（±1）；四段 ≥24；最小字号 12；白/深/灰三底色 + 全功能/mini + 100%/10% 目检。

**坑**：不要用 `transform: scale()`；不要压到 24 以下；`check-toggle` 有现成的命中区断言；文字可能换行。

### #110 不透明度 10%–100% 滑杆

**文件**：`core/toggle-opacity.ts`、`core/types.ts`、`core/validate.ts`、`core/storage.ts` 及测试、`entrypoints/settings/App.vue`、`ui/content-runtime.ts`、`core/i18n/messages.zh.ts` / `messages.en.ts`、`tests/toggle-opacity.test.ts`、`docs/design-ui.md` / `styles/tokens.css`。

**数据**

- `TOGGLE_OPACITY_MIN=0.1`、`MAX=1`、`STEP=0.1`、默认 1。
- `normalizeToggleOpacity(v)`：数值夹取 + 一位小数；旧字符串 `full→1`、`soft→0.9`、`faint→0.7`；非法 → 1。
- `GlobalSettings.toggleOpacity: number`；`readSettings`、导出/导入/合并、`storage.test.ts` / `validate.test.ts` 全改。
- 删除 `TOGGLE_OPACITY` / `TOGGLE_OPACITY_LEVELS` / `isToggleOpacity` 及引用。
- `syncToggleState`：`toggleState.opacity = settings.toggleOpacity`。

**设置页**

- 三档 radio → `<input type="range" min="10" max="100" step="10">` + `<output>N%</output>`。
- `input` 即时更新预览；`change` 持久化（避免拖动时每 10ms 写存储）。
- `aria-valuetext="N%"`；`forced-colors` 用系统色；滑块可点区 ≥24；轨道 4 / 滑块 16 / 焦点环 2+2；只用 `--pm-*`。
- 文案标题「不透明度」；说明「调的是它闲着的时候有多淡；鼠标移上去、用键盘选中或拖动时会立刻变清楚」；10%–30% 给一行 `role="status"` 提示「调得太淡会不容易找到；鼠标移上去会变清楚」。

**无障碍口径**

- 100% 时文字对比度 ≥4.5；低档位是「闲置可见度」，不再要求每档 ≥4.5；10% 约 1.2:1 是用户主动选择。
- `toggle-opacity.test.ts` 改写：normalize/迁移/夹取 + 100% ≥4.5；删除「三档都 ≥4.5」；注释写明例外。
- 幕布「恢复」按钮保持 100%。

**坑**：旧 `toggleOpacity` 字符串断言散在 `validate.test.ts` / `storage.test.ts`；`soft=0.85` 不在 10% 网格上，统一归 0.9；`forced-colors` 已有胶囊规则，别漏。

### #111 单站「不显示胶囊」开关（数据与行为）

**文件**：`core/types.ts`、`core/validate.ts`、`ui/content-runtime.ts`、相关测试；弹窗 UI 在 #112。

**做法**

- `SiteProfile.capsuleHidden?: boolean`；只有显式 `true` 才落字段（照 `capsuleMini` 的写法）。
- `sanitizeProfile` 带上；导出/导入/合并沿用 profile 管线；旧文件 = 显示。
- 写入 `updateProfile(..., { touch:false })`：本机界面状态，不刷新 `updatedAt`，不参与「较新一方」合并。
- `mountToggle` 第一道判断加 `profile.capsuleHidden === true` → `unmountToggle()` 返回。
- 隐藏不影响：收起规则、标题/图标、快捷键、幕布「恢复」按钮。
- 显示时同一次写入重置：`capsuleHidden=false` + `floatingBtnPos=null` + `capsuleMini=false`。
- 坐标与幕布恢复按钮共用，重置会一起回右下角（用户已确认可接受）。

**测试**：E2E 用 storage 直接写 `capsuleHidden:true` → 无 `pagemask-toggle`；写回 false + 非默认位置 + mini → 胶囊在右下角、全功能；隐藏时快捷键遮住、恢复按钮在。

**坑**：`hasSiteSettings` 不改；pending 站点没有权限、本来就没胶囊；弹窗开关在 #112，别在本票临时加 UI 又删。

### #112 弹窗补齐删除与胶囊显示开关

**文件**：`ui/popup/PopupBody.vue`、`entrypoints/popup/App.vue`、`core/i18n/messages.*`、E2E。

**布局（ready）**

```
标题
站点卡：域名 + 按你的设置显示开关 + 摘要
[收起内容]  ← 唯一主按钮
[标题和图标]
[遮住这一页  ⌘⇧X]
────────
右下角的小按钮      [显示 ●]   ← 新开关
────────
[全部网站设置] [插件设置]
────────
删除这个网站的设置   ← 红字文字按钮，最底
```

- 弹窗 320 宽；加两行后 `document.body.scrollHeight <= 600`，不许出滚动。
- 删除：原生 `<dialog>`，标题 `deleteSiteTitle(host)`、正文 `deleteSiteImpact()`、`取消` 默认焦点、`删除设置` 实心红；宽度 `min(288px, calc(100vw - 24px))`。
- 确认后 `runtime.sendMessage({t:'resetSite', origin})`；成功 `window.close()`；失败保留弹窗 + `role="alert"`；处理中文字变进行时。
- 胶囊开关：标签「右下角的小按钮」，默认开；关 = `capsuleHidden:true`；开 = `capsuleHidden:false` + `floatingBtnPos:null` + `capsuleMini:false`，一次 `updateProfile` 写完，`touch:false`；本地 profile 同步。
- 只在 **ready**（有配置、已允许访问）出现；pending 没权限、页面本来没胶囊，开关先不显示；new / unsupported / loading 不出现。
- 文案复用 `core/site-delete.ts`，不另写。

**坑**：popup 是会死的上下文（权限框/文件框会销毁）；`window.close()` 时机；两个开关的标签必须区分；320 宽下 dialog 不能溢出；`resetSite` 会先让打开页面还原再收权限。

### #113 列表页行尾删除

**文件**：`entrypoints/management/views/SitesView.vue`、`SiteSettingsView.vue`、`entrypoints/management/App.vue`、新建 `DeleteSiteDialog.vue`、E2E。

**做法**

- 行结构：`li.site-row` → `div.site-main`（`a.site-link` + `button.site-more`）+ `div.site-pending`。链接与按钮是兄弟，不嵌套。
- `.site-row` 两列：`grid-template-columns: minmax(0,1fr) auto`；`.site-link flex:1`；`.site-more` 24×24，`aria-label="更多操作：<host>"`。
- 行尾 `›` 保留；「⋯」在它右边 4px；窄屏域名换行、按钮不被挤掉。
- 「⋯」开 `popover`，只有一项「删除这个网站的设置」（危险色，`role="menuitem"`）；Esc/点外关；焦点回「⋯」；菜单位置做视口翻转/夹紧。
- 把 `SiteSettingsView` 的 `<dialog>` 与 `openReset/onResetClose/删除后跳回列表` 抽成 `DeleteSiteDialog.vue`，在 `App.vue` 渲染一次；两个视图都只调 `managementStore.openReset(profile)`。
- 删除成功后：列表页留在列表、行消失；详情页回 `#/sites`；失败在发起处提示。
- 不加「编辑」按钮、不做多选、不改行点击进详情、不改「允许访问」。

**坑**：链接里套按钮不合法；焦点返回；popover 在窄视口的位置；待授权行的「允许访问」块要跨整行；`resetTarget` 是全局状态，两个视图共用一个 dialog。

## 5. 跨票决策（已和产品所有者定案，不要重新问）

**数据模型**

- `SiteProfile.capsuleHidden?: boolean`，显式 true 才落字段；`touch:false`。
- `GlobalSettings.toggleOpacity: number`（0.1–1）；迁移 `full→1 / soft→0.9 / faint→0.7`。
- 不新增 `capsuleSize`。

**入口能力（本批结束时的目标）**

| 能力 | 胶囊 | 弹窗 | 列表 | 幕布恢复按钮 | 快捷键 |
|---|---|---|---|---|---|
| 按设置/原样 | 有 | 有 | — | — | — |
| 收起内容 | 有 | 有 | — | — | — |
| 标题和图标 | 有 | 有 | — | — | — |
| 遮住/恢复 | 有 | 有 | — | 恢复 | 切换 |
| 删除网站设置 | 有 | **新增** | **新增** | — | — |
| 显示/不显示胶囊 | — | **新增** | — | — | — |
| 全功能/mini | 有 | 不做 | — | — | — |
| 放回右下角 | 有 | 不做 | — | — | — |

**已定案的产品口径**

- 胶囊保留 mini；不做大小档；现在的大小是上限，收到 WCAG 最小（高 26、宽约 164）。
- 不透明度 10%–100%、步长 10；悬停/聚焦/拖动回 100%；幕布恢复按钮 100%。
- 不显示胶囊：开关在弹窗、默认开、按站点；从关到开重置右下角 + 全功能。
- 弹窗囊括站点四项（标题和图标 / 收起内容 / 遮住 / 删除）+ 胶囊开关；不放 mini/放回。
- 列表逐行删；不加编辑按钮、不做多选。
- 欢迎页应用壳 + 切步跟随。
- 幕布每文档一个控制器；三处入口互通；遮住后胶囊卸掉，页内恢复入口是眼睛按钮。

## 6. 门禁与验证

```bash
npm run compile                     # vue-tsc
npx vitest run                      # 单测
CHROME_ARGS="--no-sandbox --disable-gpu" npm run test:e2e   # 全套 E2E
npm run check:docs                  # 文档禁用词/链接
npm run check:package               # 打包门禁
```

- 每票：compile + vitest + 相关 E2E；全绿再 commit。
- 全套 E2E 在发版前跑一次；`check-mask` 偶发 rAF 抖动（`Runtime.callFunctionOn` 超时），单跑复跑即可，不要当回归。
- 视觉：`docs/dev/visual-review.md` 的交接关（2–5 张截图 + 「新眼睛」一轮，flash 档）；纯文案免审。发版关全量巡检。
- 真机手测（自动化不了，必须由用户或用户在真机执行）：快捷键四组合、欢迎页 1084×544、胶囊 10%/隐藏、弹窗/列表删除。
- 中英 i18n 一一对应；`core/i18n.test.ts` 会递归比较键。

**交接时的基线（2026-11-06 01:2x）**

- `npm run compile`：通过（2026-11-06 01:2x 实测）。
- `npx vitest run`：**629 项通过**（2026-11-06 01:23 实测）。
- `npm run test:e2e`：七个脚本全过，分别 **100 / 200 / 16 / 160 / 63 / 146 / 26**（共 711 项），失败 0，预期失败 0（2026-11-06 01:24 实测）。

## 7. 发版 0.6.1（#105）

1. `package.json` → `0.6.1`。
2. `CHANGELOG.md` 两节：0.6.0（#97 那批，装机版）+ 0.6.1（本批）；中英逐条对应。
3. 文档：README、GLOSSARY、docs/design.md、docs/design-ui.md、ADR-0011、CHROMEWEBSTORE.md；`npm run check:docs`。
4. 商店素材：`node tests/e2e/store-shots.mjs` 重拍；核对截图与 0.6.1 界面。
5. 全量视觉巡检 + 「新眼睛」一轮 + 真机手测记录。
6. `npm run zip` → commit → annotated tag `v0.6.1`（message = 中文 changelog 小节）→ `git push --follow-tags` → `gh release create v0.6.1 .output/page-mask-0.6.1-chrome.zip`。
7. **不要补 `v0.6.0` tag**。
8. 关 #105，附 tag / release / zip 链接。

## 8. 协作规则（AGENTS.md 摘要，必须遵守）

- 用户是**非技术产品/需求方**，不是前端/设计专业。只提问题和需求，不负责判断怎么做。
- **先自己把功课做完再开口**：界面主次、按钮层级、交互、文案，先查成熟产品/设计系统（GOV.UK、Carbon、Ant、Material、HIG、WCAG），带结论回来；不要拿技术细节、专业名词、一堆方案问用户。
- 只有两种情况找用户：① 真正的产品取舍拿不准；② 需求本身有问题（与已定规则冲突、有用户没意识到的副作用）。提问用大白话，一次最多一两个。
- 视觉/色彩决策不盲从：对照成熟做法，认为有问题当场指出；说不出参考对象的视觉意见不落地。
- **修一类，不是修一个**：每处问题在全项目审计同类位置（其他页面、同页其他状态、其他入口、中英文案）；收尾在 commit/回复里写「同类位置扫过哪些、其余无同类」。
- 文案：以 `GLOSSARY.md` 为唯一权威；说具体动作与结果，不造词；同一件事一个叫法；改文案同步 i18n 中英两侧。
- 一票一提交一推送一关票：`npm run compile` + 测试过关 → commit（Conventional Commits，正文可中文）→ push `master` → `gh issue close --comment "已实现，commit <hash>：一句话"`。不攒包。
- 大块探索/批量生成派子代理，主会话保持精简；进度以 git 增量提交保底。
- 临时文件一律放仓库内 `tmp/`（已 gitignore）；不要写系统 `/tmp`、家目录。不要删 `.workbuddy/`。
- 真实网站验证只用匿名可访问页面和专用测试配置；不用用户的登录态/个人数据；真实网站截图不入库（必要时打码放 `docs/dev/`）。
- 交付前按 `docs/dev/visual-review.md` 拍本轮改到的界面（2–5 张）+ 派「新眼睛」审一轮；审查员只看图、不看代码、用 flash 档；问题清单随交付。
- 用户会在真机上做最终确认；不要用自动化冒充真机手测。

## 9. 环境（这台 Mac）

- 系统：macOS；Shell `/bin/zsh`；Node 22 / npm 11。
- Chrome for Testing 缓存在 `.cache/chrome/`；品牌版 Chrome 137+ 忽略 `--load-extension`，E2E 用 CfT 157。
- E2E 运行可能需要 `CHROME_ARGS="--no-sandbox --disable-gpu"`；headless 下后台标签页不跑 rAF，点击扩展页面前先 `bringToFront()`。
- `gh` 必须带前缀：`HTTPS_PROXY=http://127.0.0.1:7890 gh ...`；git 已配仓库级代理，git 命令免前缀。
- npm 镜像只在用户级 `~/.npmrc`；仓库不带 `.npmrc`。新增/升级依赖用官方源 + 精确版本：
  `npm install <pkg>@<精确版本> --save-exact --registry=https://registry.npmjs.org`
  提交前 `grep -c registry.npmmirror.com package-lock.json` 应为 0。
- 依赖变化后 `npm run notices` 重生成 `public/THIRD_PARTY_NOTICES.txt`。
- 若代理掉线：git/gh 降级为本地操作，稍后重试；不要改为直连或改 lockfile 源。

## 10. 已知风险 / 未决

1. **快捷键是否真的被 Chrome 绑定**：自动化触发不了浏览器级按键；#101 一直没做真机手测。若按键完全没反应，先在 `chrome://extensions/shortcuts` 确认绑定未被占用，并记录实际绑定。这是 #107 的验收项，不是可选项。
2. **0.6.0 与仓库的差异**：用户装的 0.6.0 构建可能来自未提交的工作区；若某条现象在 master 上复现不了，先比较构建来源，不要硬改。
3. **E2E 抖动**：`check-mask` 的 rAF / `Runtime.callFunctionOn` 超时是已知环境抖动；复跑，不要当回归，也不要把测试改成迁就抖动。
4. **弹窗高度**：加删除 + 开关后必须 ≤600；如果超，收紧间距或分组，不要让它出滚动条。
5. **胶囊 10%**：文字几乎不可见是预期；不要在实现时偷偷把下限抬回 70%，也不要把对比度测试加回「每档 ≥4.5」。口径在 #110。
6. **隐藏胶囊的开关只在弹窗**：站点设置页没有；这是用户定案，不要自作主张加回去（除非用户后续要求）。
7. **幕布期间胶囊不显示**：这是 #50 的既有设计，不要为了「三处互通」把胶囊留在幕布上。

## 11. 第一批动作（按这个顺序）

1. 读 `AGENTS.md`、`GLOSSARY.md`、`docs/design.md`、`docs/design-ui.md`、`docs/dev/visual-review.md`。
2. 用 `gh` 读 #106 + #107–#113（票里有完整验收）。
3. 核对第 1–2 节的仓库/版本/issue 状态；若 #105 已不是 0.6.1，先和用户确认。
4. 跑基线：`npm run compile` + `npx vitest run` + `npm run test:e2e`。
5. 从 #107 开始，一票一提交一推送一关票；每票完成后更新本文进度表。
6. 全部完成后走 #105 发 0.6.1。
7. **发版完成后删除 `HANDOFF.md`**（AGENTS.md：交接完成即删），把过程教训写进 `docs/dev/DEVLOG.md`。

## 12. 交接完成的标准

- [ ] #107–#113 全部关闭，每张有 commit 与验证记录。
- [ ] `npm run compile` / `npx vitest run` / 全套 E2E / `check:docs` / `check:package` 全绿。
- [ ] 0.6.1 已发布：`v0.6.1` tag + GitHub release + zip；没有补 `v0.6.0` tag。
- [ ] 文档、i18n、商店截图与 0.6.1 实际界面对得上。
- [ ] 真机手测记录在 #107 / #105 的评论里。
- [ ] `HANDOFF.md` 已删除，DEVLOG 有本轮记录。
