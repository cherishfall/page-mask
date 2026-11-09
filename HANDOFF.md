# 交接 / 工作前沿（0.8.15 界面批次）

最后更新：2026-11-10 01:20
**一句话现状：0.8.15 还没发布。** 四张票里 A、B 已完成并关票（#148 / #149），C 已实现并推送（#150，最后一次门禁复核中），D 文案专项（#151）与发版收尾（版本号 / CHANGELOG / tag / release）**未开始**。

> 本文是给「换模型 / 换 agent 工具」用的移交文档：不读聊天记录也能接着做。所有结论都有仓库内的文件或 commit 可查。

---

## 0. 接手第一件事（按顺序）

1. `git log --oneline -8` 与 `git status --short`：确认工作区干净、HEAD 是 C 票提交（`8fe9c75`）或其后的收口提交。
2. 读本文 §2 进度表、§4「C 票复核清单」、§6「D 票待办」。
3. 跑一遍 §5 的基线门禁，确认环境可用（E2E 约 3 分钟）。
4. C 票复核通过 → `gh issue close 150`；然后做 D 票（§6）。
5. 发版前真机目检（§8）由用户做；AI 本批**不做视觉/仿真验证**（用户长期偏好）。

---

## 1. 仓库与提交状态

- 仓库：`/Users/lifan/AiCodingProjects/page-mask`（GitHub `cherishfall/page-mask`），分支 `master`，Chrome 扩展，当前版本号仍是 **`0.8.14`**（`package.json` 未改）。
- 起点：`v0.8.14` 已发布（tag + release 存在）。
- 本批提交（旧 → 新）：
  | commit | 内容 |
  |---|---|
  | `fe16142` | 调研报告 `docs/dev/research-0.8.15-ui.md` + 方案初稿 + 工作前沿 |
  | `1b9721d` | 方案 v2 定稿（回收三份审计）+ 建 #151 |
  | `4b515dc` | **A 票 #148** 弹窗整体重排（已关票） |
  | `10c1b10` | **B 票 #149** 胶囊开启态（已关票） |
  | `8fe9c75` | **C 票 #150** 向导工具条实现（**票还没关**） |
  | 见 `git log` | 本文 + C 票折叠残余 padding 收口 |
- 未关票：**#150**（实现已落地）、**#151**（文案专项，未开工）。#142 / #37 是旧票，与本批无关。
- 临时文件全部在 `tmp/`（已 gitignore，不会入库）：`audit-code.md` / `audit-copy.md` / `research-design.md` / `issue-*.md` / E2E 日志。**换环境后这些可能不存在**，但结论已提炼进 `docs/dev/design-0.8.15-popup.md` 与本文。

---

## 2. 进度总表

| 步骤 | 状态 | 证据 / 备注 |
|---|---|---|
| 基线门禁 | ✅ | 起点 `compile` / 705 单测 / 全套 E2E / `check:docs` / `check:package` 全绿 |
| 设计系统 + 同类产品调研 | ✅ | `docs/dev/research-0.8.15-ui.md`（GOV.UK / M3 / WCAG 2.2 / Ant / Carbon / Nielsen / Apple HIG / Carbon Motion / uBO / Stylus / DevTools / Figma） |
| 代码 / 测试 / 文案全貌审计 | ✅ | 三份子代理报告，结论已并入方案与本文（原始文件在 `tmp/`） |
| 方案文档 | ✅ **v4** | `docs/dev/design-0.8.15-popup.md`，**实现的唯一依据**；v2 修叫法/动效，v3 改并排+英文高度，v4 定折叠不做高度补间 |
| 发 issue / 拆票 | ✅ | #148 弹窗、#149 胶囊、#150 向导、#151 文案专项 |
| **A（#148）弹窗重排** | ✅ **已关票** | `4b515dc`，主会话亲手复跑门禁（900 项） |
| **B（#149）胶囊开启态** | ✅ **已关票** | `10c1b10`，主会话亲手复跑门禁 |
| **C（#150）向导工具条** | 🔄 **已实现已推送，票未关** | `8fe9c75`；最后一次折叠 padding 收口后门禁见 §4 |
| **D（#151）文案专项** | ⬜ **未开始** | 范围见 §6.1 |
| 文档同步（README / CHROMEWEBSTORE / design 系列 / DEVLOG / ADR） | ⬜ 未开始 | 清单见 §6.2 |
| 发版（版本号 / CHANGELOG / tag / release） | ⬜ 未开始 | 流程见 §6.3 |
| 收尾（删 HANDOFF） | ⬜ 未开始 | 批次结束后删本文件 |

---

## 3. 已交付的两票（可直接信任，但知道改了什么）

### A 票 #148 弹窗整体重排（`4b515dc`）

- **两态同构**：`new`（没设置过）与 `ready` 共用一份模板，只按 `hasProfile` 增减三处：面具卡卡头开关、辅助行开关、底部删除入口。
- **四块顺序**：① 面具卡（标题和图标 → 收起内容）② 灰度卡 ③ 遮住卡 ④ 辅助行（悬浮按钮，无卡片框）；与胶囊「主按钮 → 媒体 → 遮住 → ⋯」一一对应。
- **两钮解禁**：任何状态、开关开或关都能点；删掉了 `:disabled` 与「暂不可用」说明。
- **并排**：卡内两颗编辑入口一行、左次右主、等高 40px（符合 `docs/design-ui.md` §五「主操作永远在最右」）。
- **遮住卡片化**：同款卡片框，卡内**没有开关**（动作 ≠ 设置），附「只是临时挡住」说明。
- **帮助入口**：「查看使用说明」从底部独占一行挪到标题右侧；`preview` 态隐藏（欢迎页第 2 步）。
- **文案**：按方案 §7.2 中英同改；`popup.replayIntroAria` 是新增键。
- **测试**：`check-pages.mjs` 新增结构断言（并排同一行、主按钮 ≥40、说明字号一致、pending 不渲染四块卡、preview 隐藏链接），旧的禁用态断言等强度重写。
- **高度**：中文 ready 511.3px / 英文 ready 588.9px（Chrome 上限 600）。**英文只余 11.1px，是最紧的一处。**

### B 票 #149 胶囊开启态（`10c1b10`）

- 开启态从整颗墨底反白改为三个独立信号：**容器中性 + `--pm-accent` 图标 + 图标内容填实 + 分段底部 2px 指示条**（WCAG 1.4.11 状态 3:1、1.4.1 不只靠颜色）。
- 150ms Carbon productive 过渡；`prefers-reduced-motion` 保留 120ms 纯色淡变（**不是 0ms**）；`forced-colors` 用系统 Highlight/HighlightText。
- 连带：眼缝 `stroke` 改 `--pm-bg`；弹窗卡头图标同源变蓝；`styles/tokens.css` 与 `tests/tokens-contrast.test.ts` 注释更新（**`bg/fg` 数据行保留**，`required` 守门不能删）。
- 测试：旧的墨底 RGB 断言按新规格等强度重写；新增「两颗开态一套外观」「reduced-motion >0 且 <400ms」「普通模式 150ms」；4 处固定 sleep 换成观测量轮询（`toggleSettled`）。
- **留给真机目检**：底部指示条沿左圆头被裁掉约 7px，两颗可见长度略有差异（同一条 CSS 规则，差异来自胶囊形状）；备选 `inset 0 0 0 2px` 全描边或居中 12px 短线。

---

## 4. C 票复核清单（新接手者必做，做完关 #150）

实现已推送 `8fe9c75`，内容：
- `ui/wizard/wizard.css`：`.pm-wiz-toolbar` 的 `max-width` 与 `.wide` 的 `width` 720 → **480**（两步仍同宽）；新增 `.collapsed` 折叠规则（排除 `.pm-wiz-head` 与 `.pm-wiz-sr` 的 aria-live 节点）；`.pm-wiz-collapse` 命中区 24、150ms 颜色过渡、reduced-motion 120ms；抓手 `GripIcon` 常态加极淡底、颜色提到 `--pm-fg`（不新造符号）。
- `ui/wizard/WizardApp.vue`：新增 `collapsed` 状态与「收起 / 展开」按钮（`data-testid="pm-wiz-collapse"`，`aria-expanded` / `aria-controls="pm-wiz-body"` 指向 section 自身）；`.wide` 绑定不变。
- `core/i18n/*`：`wizard` 组新增 `collapse` / `expand` / `collapseAria` / `expandAria`。
- `tests/e2e/check-wizard.mjs`：新增独立验收段 16 条（两步同宽 ≤480、调整不折行、折叠后真实点选页面、展开不丢草稿、aria 三态、折叠态退出流程）。
- `docs/design.md:83`：补 0.8.15 收窄到 480 与可收起。
- **本次额外收口**：`.pm-wiz-toolbar.collapsed { padding-bottom: 0 }`——原实现折叠后标题栏下方还挂一条 12px 面板底色，收掉后「只剩标题栏一条」。

**最后门禁**（折叠 padding 收口后复跑）：
- `npm run compile` / `npx vitest run` / `npm run check:docs` / `npm run check:package` / 全套 E2E 全部通过，`全部 E2E 断言通过 ✅`。
- 若接手时发现 E2E 偶发红：`check-mask` 的 `Runtime.callFunctionOn` 超时是 CDP 抖动，复跑即可；E2E 末尾「清理临时目录失败 [SAFE_DELETE_BULK_CONFIRM_REQUIRED]」不是失败。

**关票命令**（复核通过后）：
```
HTTPS_PROXY=http://127.0.0.1:7890 gh issue close 150 --comment "已实现，commit 8fe9c75：向导工具条 720→480px（两步仍同宽），新增「收起/展开」让页面可点，抓手可见性提高；折叠不做高度补间（方案 v4）；门禁全绿。"
```

**C 票已知待确认项（不阻塞关票，供真机或后续票）**：
1. 面板的 150ms 颜色过渡在折叠动作上不可见（折叠态没有不同颜色值，过渡只在按钮 hover/focus 可见）。属性已加、无害。
2. `aria-controls="pm-wiz-body"` 指向 `<section>` 自身，语义不够精确（v4 否掉了包容器的方案）；引用有效，可接受。
3. 中文「收起」与主叫法「收起内容」同词，第一眼可能混淆；480px 空间有限，靠 aria-label 全称区分。英文 Collapse 无此问题。
4. 抓手常态浅底是一处可见外观变化，若目检觉得偏重，可只保留颜色提升、去掉常态底。
5. **320px 窄视口存在既有内容溢出**：`.pm-wiz-drafts { min-inline-size: 340px }` 在 320px 视口（工具条被 `100vw-32` 夹到 288）会横向溢出。**不是本票引入**（720→480 不改变 320px 的 clamp 结果），未修，登记备查。
6. 「收起」用轻操作（无框）比「退出设置」（有框）视觉更轻，`docs/design-ui.md` §四对轻操作的定义是「内容里的小动作」，存在准则张力；本批按「退路最轻」的直觉定档，可讨论。

---

## 5. 门禁与纪律（不要绕过）

- 门禁命令（一条条跑，E2E 约 3 分钟）：
  ```
  npm run compile
  npx vitest run
  CHROME_ARGS="--no-sandbox --disable-gpu" npm run test:e2e
  npm run check:docs
  npm run check:package
  ```
- **一票一提交一推送**（master，Conventional Commits），关票评论带 commit 号。**子代理说「完成」不等于落地**：必须亲手 `git diff` 抽查关键实现与断言、重跑全套门禁，再提交。
- **断言被改动时必须等强度重写，不许删掉或放宽成永真**；等待条件要落在会变的观测量上（`docs/dev/DEVLOG.md` 0.8.14 教训），不要用固定 sleep。
- 界面文案以 `GLOSSARY.md` 为唯一权威，_Avoid_ 列禁用；中英两份必须同增同删同改（`core/i18n.test.ts` 守键集合 / arity / 英文无中文）。
- **修一类，不是修一个**：同类位置一次扫完（五态、多入口、中英、深浅色、320/600 边界）。
- 已定共识不得静默回退：灰度独立于主开关（ADR-0014）、幕布是页面级临时状态不写配置（ADR-0007）、悬浮按钮会话语义（0.8.13/0.8.14）、胶囊四段与单一形态（ADR-0015/0016）。
- 「永不做」：全局总开关、内置站点预置规则、远程订阅、右键菜单、uBlock 式元素级临时隐藏、除幕布外的快捷键。
- 临时文件只放 `tmp/`；真实网站截图不入库。
- **不做视觉/仿真验证、不截图、不生成图片**：用户长期偏好，真机目检留给他（`docs/dev/visual-review.md` 与用户偏好冲突时按用户偏好，本批已留痕）。

---

## 6. D 票待办（#151 文案专项 + 文档 + 发版）

### 6.1 #151 文案专项（票已建，正文在 GitHub）

范围：跨界面叫法统一（遮住整页 / 一键遮住整页）、中英对齐（"Hidden items" 当计量单位、`rowScopeExclude` 等）、简练准确（「有人走过来时」「人走开了」「收拾」等委婉语）、清理死键（`quickFill` / `quickTitle` / `onboarding.done`）、抽 `common.titleBlankHint`、`GLOSSARY.md` 自身两处矛盾（`:144` 与 `:43` 冲突、菜单项数描述）。
依据：`tmp/audit-copy.md`（若已丢失，按票面清单与全仓 Grep 重建）。
边界：不改已登记主叫法、不改结构/外观/动效、中英同改、全套门禁。

### 6.2 文档同步清单（全仓 Grep 已扫）

| 文件 | 要改什么 |
|---|---|
| `docs/design.md` | `:67`「两颗按钮」、`:69` 菜单两项顺序、`:81/:86` 弹窗结构与「三件事/四件事」、`:88` 三件事滞后 |
| `docs/design-ui.md` | 若登记动效口径，补 150ms / reduced-motion 120ms |
| `README.md:86` | 「弹窗上的两颗按钮」 |
| `CHROMEWEBSTORE.md:14 / 64` | 人工测试步骤里的「两颗按钮」 |
| `CHROMEWEBSTORE.md:186–187` | 版本表补 0.8.15 一行 |
| `CHANGELOG.md` | **只在顶部新增 0.8.15 中英两节**，历史条目不改 |
| `GLOSSARY.md` | 补「查看使用说明」「收起/展开」等新界面用词；主叫法不动 |
| `docs/dev/DEVLOG.md` | 顶部（新在上）补本批过程教训 |
| `docs/adr/` | 可选：弹窗两态同构 / 开启态三信号 / 工具条可收起，不确定就只进 DEVLOG |
| `docs/dev/research-0.8.15-ui.md:94` | 加脚注：英文已由 "See the intro again" 收短为 "View the guide" |
| `docs/store-assets/` | 商店 PNG 仍是 0.8.10 旧图，需重拍 |

### 6.3 发版流程（项目铁律）

1. `package.json` 版本号 `0.8.14` → `0.8.15`。
2. `CHANGELOG.md` 顶部新增 0.8.15 中英两节（逐条对应）。
3. `npm run compile` + 全套门禁 + `check:package`。
4. commit + `git push`。
5. annotated tag：`git tag -a v0.8.15 -m "<中文 changelog 小节>"`，`git push origin v0.8.15`。
6. `gh release create v0.8.15 .output/page-mask-0.8.15-chrome.zip --title ... --notes-file ...`（`.output/*.zip`）。
7. 收尾：DEVLOG / 必要 ADR / **删除本 HANDOFF**。

---

## 7. 本批已定、但用户可以推翻的取舍（不要重新发明，也不要偷偷改回）

1. **「收起内容」不改名「收起页面内容」**：`GLOSSARY.md` 已成套登记，改名牵动 15+ 文件与大量字面量断言；改用卡片结构 + 每块一句说明补足自解释。
2. **没设置过的网站不显示假开关**：面具卡卡头、辅助行、删除入口三处按「对象是否存在」收住，避免「点了没反应」。卡片、顺序、其余按钮都照用户说的做。
3. **「遮住这一页」做同款卡片**（用户明确要求「样式和上面的差不多」），但卡内没有开关、只有按钮 + 键帽 + 临时性说明，靠结构而非容器区分「动作」与「设置」。
4. **向导不按阶段分宽、不改停靠角落**：会重新引入用户抱怨过的「形状变来变去」，且与 #140 及底部位置断言绑定。
5. **折叠不做高度补间**（方案 v4），只做 150ms 颜色过渡 + 瞬时收起。
6. **帮助入口用短文字链接而非图标**：图标不自解释；短文案已解决 320px 挤压，合规靠 C42 撑 24px 命中区。
7. **幕布淡入淡出不在本批**：会动首屏防闪 E2E，留给后续动效票。
8. **弹窗卡片密度从 8px 收到 4px**：为英文长文案让高度，中文态本不需要这么挤；英文 ready 仅余 11.1px。用户目检后一句话可改（缩短英文说明 / padding 12→8 / 恢复 8px 密度）。

---

## 8. 真机目检清单（用户做，AI 不做）

- **弹窗**：没设置过的网站首次打开是否与已设置态同一套卡片；两颗编辑入口是否都能点；顺序是否「标题和图标 → 收起内容」；遮住卡是否像上面几张、又不被误读成会记住的设置；辅助行是否明显更轻；「查看使用说明」是否挤标题；整屏是否过挤（尤其英文）。
- **胶囊**：开启态是否够低调、又能一眼看出开/关；悬停/按下是否仍有反馈；底部指示条左端被圆角收口是否难看。
- **向导**：480px 是否还挡点选；「收起」是否好找、收起后页面是否完全可点、展开是否不丢草稿；抓手是否看得出能拖。
- **深色 / 高对比度**：胶囊开态、弹窗对比度。
- 商店提交前人工路径：`CHROMEWEBSTORE.md` §0。

---

## 9. 本批改动文件地图（截至 `8fe9c75` + 收口）

**产品代码**
- `ui/popup/PopupBody.vue`（A 票：模板重排、并排、说明字号、preview）
- `ui/FloatingToggle.vue`（A 票：⋯ 菜单两项调序）
- `ui/toggle/toggle.css`（B 票：开启态三信号、过渡、forced-colors、眼缝）
- `ui/wizard/WizardApp.vue` / `ui/wizard/wizard.css`（C 票：收窄、收起/展开、抓手、折叠 padding）
- `core/i18n/messages.zh.ts` / `messages.en.ts`（A 票文案 + C 票收起键）
- `styles/tokens.css`（B 票注释；色值未动）
- `entrypoints/onboarding/App.vue`（A 票：传 `preview`）

**测试**
- `tests/e2e/check-pages.mjs`、`check-toggle.mjs`、`check-media.mjs`、`check-language.mjs`、`check-wizard.mjs`、`store-shots.mjs`、`tests/onboarding-sync.test.ts`、`tests/tokens-contrast.test.ts`

**文档**
- `docs/dev/design-0.8.15-popup.md`（方案 v4，唯一依据）、`docs/dev/research-0.8.15-ui.md`、`docs/design.md`、`docs/dev/design-media-gray.md`、`GLOSSARY.md`、`HANDOFF.md`

---

## 10. 不要做的事

- 不要把 `package.json` 版本号提前改成 0.8.15 再忘了发版；发版前版本号仍是 0.8.14 是正常的。
- 不要因为「票已实现」就跳过亲手复核与全套门禁；本批 A/B 两票都是在复核阶段发现真问题（英文超 600px、4 处固定 sleep）才收口的。
- 不要在没有目检的情况下反复调视觉密度/指示条形状——已登记为待用户拍板。
- 不要动 `.workbuddy/`、不要把 `tmp/` 提交入库、不要删 `HANDOFF.md` 直到批次真正结束。
- 不要回退 A/B 票的成果去「重做一版」；方案 v4 是当前唯一依据。
