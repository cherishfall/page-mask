# 0.8.15 界面批次 · 调研报告

日期：2026-11-09
范围：用户真机试用 0.8.14 报的 5 条反馈（见 `HANDOFF.md`），总诉求「功能排布合理、外观和动效合理、自解释、提示语简练准确规范、与胶囊呼应」。
方法：把 5 条反馈拆成 7 个可判定的决策点，逐个查**成熟设计系统的成文规则**与**同类产品的既有做法**；项目内 `docs/design-ui.md` 已引用过的规则不重复凑数，本次新查到的证据单独标注。所有结论必须能说出参考了谁、哪条规则、为什么取舍；查不到就写查不到。

> 本文是**证据与结论**，落地方案见 `docs/dev/design-0.8.15-popup.md`。两者冲突时以 `GLOSSARY.md`、`docs/design.md`、`docs/design-ui.md` 为准。

---

## 一、结论摘要

| # | 决策点 | 结论 | 主要依据 | 是否修正项目旧结论 |
|---|---|---|---|---|
| 1 | 未配置网站第一次打开弹窗，要不要就是完整卡片 | **要**。两态共用同一套结构；只对「尚不存在的对象」隐藏对应动作 | Carbon Empty States、GOV.UK 空状态/下一步、Ant Design | 修正 0.8.10 只给 ready 态做卡片分组 |
| 2 | 「按你的设置显示」关着时，两颗入口能不能点 | **能点**，去掉禁用与那句「暂不可用」 | GOV.UK Button「避免禁用」、Ant Design disabled 定义、项目 `docs/design-ui.md` §六、胶囊 ⋯ 菜单现状 | **推翻** 0.8.10「目检改判：禁用 + 说明」 |
| 3 | 四功能的顺序与卡片分层 | 面具卡（标题和图标 → 收起内容）→ 灰度卡 → 遮住卡 → 辅助区（悬浮按钮，弱化） | GOV.UK / Ant 一屏一个主操作、Ant「1 primary + n secondary」、Carbon 分组 | 修正 0.8.10 把「悬浮按钮」插在功能中间 |
| 4 | 「重看插件介绍」放哪 | **采纳用户方案**：标题右侧小字文字链接；欢迎页预览态隐藏 | Ant「Text button 用于最次要动作」、Carbon progressive disclosure、WCAG 2.5.8 | 修正 0.8.11 让它独占一行按钮 |
| 5 | 「收起内容」为什么一直是蓝色实心 | **保留**。它是这一屏唯一主操作，蓝底是主操作档位的外观，不是随手加的强调色 | GOV.UK「Avoid using multiple default buttons on a single page」、Ant「at most one primary button in a section」、项目 `docs/design-ui.md` §四 | 不推翻，但要在产品里把「为什么它最显眼」说清 |
| 6 | 胶囊开启态墨底反白能否换成更低调的做法 | **能**。改成「强调色图标 + 图标填实 + 加粗/指示边框」，容器保持中性；加 120–180ms 状态过渡 | WCAG 2.2 SC 1.4.11 原文与 Figure 6、M3 Buttons specs（Toggle selected/unselected 色表、shape morph）、SC 1.4.1 Use of Color | **推翻** 代码注释里「24px 下整颗换底是唯一稳定满足 3:1 的位置」 |
| 7 | 向导工具条 720px 定宽 | 不再「一个数字管所有步骤」；收窄 + 两步同宽 + 可折叠，并给状态切换加过渡 | Nielsen #3 用户可控与自由、Fitts、同类元素点选工具（详见方案文档） | 修正 #123 / 0.8.11 #140 的定宽口径 |

---

## 二、逐点证据

### 1. 未配置态 / 已配置态要不要同构

**查到的规则**

- [Carbon Design System · Empty states](https://v10.carbondesignsystem.com/patterns/empty-states-pattern/)：「Provide guidance about why there is no data, and either what the user can do to address the lack of data, or the circumstances under which the data would appear. And use plain language.」；并把「Configuration required」单列一类——「Provide an explanation and the first step for the user to take for the required configuration.」
- 同页「In-line documentation」：首次使用可以保留页面的完整结构并配一句说明，「Following a **progressive disclosure** model, it could provide links out to more detailed documentation」；同时要求「Keep the content limited to one feature. Do not talk about other areas of the app.」
- [Ant Design · Empty](https://ant.design/components/empty) 与 Shopify Polaris / Atlassian 的 empty state 写法一致：空状态要有「说明 + 明确的第一个动作」，而不是把界面换成另一套。
- [GOV.UK Button](https://design-system.service.gov.uk/components/button/)：警告按钮「Only use for actions with serious destructive consequences that cannot be easily undone」——对**还不存在的设置**显示「删除这个网站的设置」，没有后果可展示。

**结论**

- 两态**共用同一套卡片骨架**，这正是用户说的「第一次打开就是第二张图」。差异只保留两处：
  - 未配置态顶部一句**短**说明（Carbon：说明为什么空 + 第一步做什么），不再用现在那段把三个功能名逐个念一遍的长句（卡片本身已自解释，重复了）。
  - 未配置态**不显示**「删除这个网站的设置」（对象不存在；GOV.UK 危险动作只给真实破坏性动作）。
- 「悬浮按钮」这类「管界面自己」的设置，可以显示但必须写清「设置之后才会出现在页面上」，避免用户以为拨了没反应（Carbon「circumstances under which the data would appear」）。
- 这不违反 `docs/design.md`「零影响」：显示的仍是这个网站自己的面板，不是往页面里注入任何东西。

### 2. 开关关着时，两颗入口能不能点

**查到的规则**

- [GOV.UK Button · Disabled buttons](https://design-system.service.gov.uk/components/button/)：「**Disabled buttons have poor contrast and can confuse some users, so avoid them if possible. Only use disabled buttons if research shows it makes the user interface easier to understand.**」
- [Ant Design Button](https://ant.design/components/button)：`disabled` 的语义是「used when actions are **not available**」；而「收起内容」「标题和图标」在开关关着时**完全可用**（它们是编辑入口，改的是「打开之后生效什么」，不是从属于开关的即时设置）。
- 项目自己的 `docs/design-ui.md` §六已写：「禁用态：GOV.UK、Ant 都建议尽量不用；保留，但必须自带原因」。
- 胶囊 ⋯ 菜单的 `handleEdit` / `handleMoreItems`（`ui/content-runtime.ts`）从来不检查开关状态，两处行为不一致。

**结论**

- **去掉 `:disabled="!switchOn"` 与 `disguiseOffHint`**。0.8.10 当时改判禁用，理由是「只加说明时看到的和读到的打架」——真正的问题是那句说明写成了「暂不可用」（说了谎），而不是「可点」本身有问题。
- 用户这次的直觉与两家设计系统一致，且与胶囊一致。**采纳**。
- 连带：`tests/e2e/check-pages.mjs` 387–402 的禁用断言要改成「两态都可点」；`PopupBody.vue` 顶部还留着「主开关关着时两项保持可点」的旧注释（与 0.8.10 代码打架），这次一并统一。

### 3. 四功能的顺序与卡片分层

**查到的规则**

- [GOV.UK Button](https://design-system.service.gov.uk/components/button/)：「**Avoid using multiple default buttons on a single page.** Having more than one main call to action reduces their impact, and makes it harder for users to know what to do next.」；「Pages with too many calls to action make it hard for users to know what to do next. Before adding lots of secondary buttons, try to simplify the page.」
- [Ant Design Button](https://ant.design/components/button)：「Primary button: used for the main action, **there can be at most one primary button in a section**」；「If you need several buttons, we recommend that you use **1 primary button + n secondary buttons**」；「Text button: used for the **most secondary action**」。
- 项目 `AGENTS.md` 整屏审查第 4 条与 `docs/design-ui.md` §五：一屏一个主操作、退路最轻、说明跟着对象走。

**结论**

按用户给的四大功能顺序，同时满足「主操作只有一个、次操作在前」：

```
标题和图标（次操作）  →  收起内容（唯一主操作，蓝色实心，放在卡内最后）
图片和视频变灰（独立开关卡）
遮住这一页（卡片化，与上面同款）
悬浮按钮（辅助设置，弱化、不带卡片框）  ← 对应胶囊 ⋯ 菜单
```

- 「标题和图标」排前与用户要的「按页面顺序」一致（标签页层面 → 页面内容 → 视觉降调 → 整页遮挡）；「收起内容」仍是这一屏唯一实心主按钮，放在卡内最后，符合 GOV.UK / Ant 的主操作位置惯例。**两件事不冲突**。
- 「遮住这一页」卡片化后必须补一句极短的临时性说明（「只挡这一页，刷新就恢复」），否则会被读成「会记住的设置」——它按 `docs/design.md` 是页面级临时状态，不写配置。
- 「悬浮按钮」不是四大功能之一，是「这个入口本身要不要显示」，放到遮住之后并弱化成一行：既对上胶囊 ⋯ 菜单里「按钮自己那一组」，也符合格式塔共同区域（同框 = 同组）。
- 胶囊 ⋯ 菜单两项顺序现在是「收起内容」在前（#80 当年按弹窗对齐）；弹窗调换后菜单**必须一起调换**，否则用户要的对应关系反而断一处。

### 4. 「重看插件介绍」

**查到的规则**

- [Ant Design Button](https://ant.design/components/button)：「Text button: used for the most secondary action」；「Link button: used for **external** links」——介绍页是扩展内部页面，用文字按钮/文字链接比「按钮」更对。
- [Carbon Empty states](https://v10.carbondesignsystem.com/patterns/empty-states-pattern/)：首次使用可以「provide links out to more detailed documentation」，属 progressive disclosure，不该占主要操作的位置。
- [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)：目标至少 24×24（项目 `docs/design-ui.md` 已按此落地）。小字链接要用 padding 把命中区垫够，项目已有先例（`.link-replay` 用 `padding: 6px 0`）。
- [GOV.UK Button](https://design-system.service.gov.uk/components/button/)：次要动作太多就应「simplify the page」。

**结论**

- **采纳用户方案**：标题栏右侧一行 12px 文字链接，左「PageMask」右「重看插件介绍」。320px 弹窗中英文都放得下（中文 6 字约 72px、英文 "See the intro again" 约 108px，加标题仍不足 240px）。
- 命中区用 padding 垫到 ≥24；`prefers-reduced-motion` 之外给一个极轻的 hover 下划线变化即可，不做动效。
- 欢迎页第 2 步是 `inert + aria-hidden` 的真实组件预览，会跟着显示一个「重看插件介绍」指向介绍页自己——给 `PopupBody` 加一个 `preview` 开关，预览态隐藏这个链接；`tests/onboarding-sync.test.ts` 的守门断言是读源码字符串，仍成立。
- **落地时改了文案**（0.8.15 #148 / #151）：中文「重看插件介绍」→「查看使用说明」，英文 "See the intro again" → "View the guide"。「插件介绍」不是登记叫法，英文那句也超出「动作 + 对象」的写法；`popup.replayIntroAria` 另给读屏全称「查看 PageMask 使用说明」。上面按原文宽度做的估算仍成立（新文案更短）。

### 5. 蓝色实心主按钮

**查到的规则**

- 项目 `docs/design-ui.md` §四：四档按钮里「主操作 = 实心强调色，白字，这一屏最想让人做的那件事，最多一个」；`styles/controls.css` 里 `.primary` 用 `--pm-accent`。
- [GOV.UK Button](https://design-system.service.gov.uk/components/button/)：「Use a default button for the main call to action on a page」；[Ant Design Button](https://ant.design/components/button)：「at most one primary button in a section」。
- 历史：#81 定「收起内容」为唯一主入口、「标题和图标」为次入口，从 `633f701` 起一直沿用；0.8.10 只是给 ready 态套了卡片框，没改档位。

**结论**

- **保留蓝底**。它是「一屏一个主操作」这条规则的外观，不是某个版本随手加的强调色。用户问「为什么这么多版本要加蓝色背景」，答案是规则而非习惯。
- 但要区分两处「低调」：用户第 5 条说的「最小化侵入」针对的是**悬浮在别人网页上的胶囊**；弹窗是用户主动打开的设置面板，有一个醒目的主操作是 GOV.UK / Ant / Carbon 的共同做法。两者不矛盾，报告里向用户说清。
- 全弹窗（含未配置态）统一后仍只有这一颗实心主按钮，符合规则。

### 6. 胶囊开启态：墨底反白是不是唯一解

这是本批最需要证据的一条，因为项目代码注释把现状写成了无障碍硬约束。

**查到的规则（原文）**

- [WCAG 2.2 · Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)，成功判据：「The visual presentation of the following have a contrast ratio of at least 3:1 against adjacent color(s): **User Interface Components** — Visual information required to identify user interface components and **states**…」
  - Intent 段：「Also, any visual information necessary to **indicate state**, such as whether a component is selected or focused must also ensure that the information used to identify the control in that state has a minimum 3:1 contrast ratio.」
  - 关键的一段：「This success criterion **does not require that changes in color that differentiate between states of an individual component meet the 3:1 contrast ratio when they do not appear next to each other** … However, the component must not lose contrast with the adjacent colors, and non-text indicators such as the check in a checkbox … must have sufficient contrast to the adjacent colors.」
  - **Figure 6（Pass）**：「Two examples which pass this success criterion, using either a solid fill to indicate a checked-state that has contrast, **or a thicker border as well as** yellow fill.」→ **加粗描边是合规路径**，整颗实底不是唯一解。
  - Figure 5（Pass）：「It is possible to use a flat design where the status indicator fills the component and does not contrast with the component, but does contrast with the colors adjacent to the component.」
  - Figure 7（Fail）与「Relationship with Use of Color」：**只靠色相变化**（黄/白）不合规；必须同时有形状、填充或明度差异 → 对应 [SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)。
- [Material Design 3 · Buttons specs](https://m3.material.io/components/buttons/specs) 的 Toggle 色表明确区分 unselected / selected，并给出五种配色：**Standard** 是「unselected icon `on-surface-variant` → selected icon `primary`」，**容器仍透明**；**Outlined** 是「unselected `outline-variant` / `on-surface-variant` → selected `inverse-surface` / `inverse-on-surface`」；Filled 才是「`primary` / `on-primary`」。同页：「Other color roles can be used as long as the container and text have a **3:1 contrast ratio**」。
  - 同页 Shape morph：「toggle buttons also change the resting shape from round (unselected) to square (selected)」→ **形状本身也是状态信号**，不只有底色。
  - [M3 Icon buttons specs 的第三方整理](https://github.com/tankrap/m3x/blob/main/specs/icon-button.md)：Standard toggle「toggle selected icon `primary`」；Outlined「transparent + 1dp `outline-variant`」，selected「container `inverse-surface`」。
  - [Flutter M3 IconButton](https://leancode.co/glossary/iconbutton-in-flutter)：`isSelected` + `selectedIcon`（**换图标**而不是只换底色）是表达开关态的既有做法；`.filledTonal` 是「medium-emphasis」的中间档，比 `.filled` 轻。
- 项目 `styles/tokens.css`：`--pm-accent` 对 `--pm-bg` 浅色 5.17:1 / 深色 7.68:1；`--pm-border-control` 对 `--pm-bg` 浅色 3.25:1 / 深色 4.13:1。**两者都过 3:1 门槛**，可以承担状态信号，无需再借 `--pm-fg` 的墨底。

**结论**

- 代码注释里「24px 下唯一稳定满足 WCAG 1.4.11 3:1 的位置 = 整颗钮」这个说法**过强**：WCAG 自己给了加粗描边、状态指示物、与相邻色对比等多条合规路径；M3 的 Standard / Outlined toggle 更是不换容器底色或只用 tonal 底。
- **改为三重信号，容器保持中性**：
  1. 图标颜色 `--pm-fg-muted` → `--pm-accent`（5.17:1 / 7.68:1，状态信号过 3:1）；
  2. 图标内容填实 / 描边变化（不只靠颜色，满足 1.4.1）；
  3. 该分段加一圈 2px `--pm-accent` 或 `--pm-border-control` 的描边 / 底部指示条（3.25:1，对应 WCAG Figure 6 的 thicker border 路径）。
- 容器底色保持 `--pm-bg`（白/深），不再整颗反色 → 视觉重量大幅下降；且开启态用**蓝**，与弹窗里的开关、主按钮同色，正好实现用户要的「胶囊 ↔ 弹窗相互映衬」（现在的墨底反白是无彩色，反而与弹窗的蓝色体系脱节）。
- **不会重蹈 0.8.3 的覆辙**：当时只有「13px 图标内部填实 vs 描边」一个同色信号，才被判看不清；新方案是「颜色 + 形状/填实 + 边框」三个信号，且颜色本身有 5:1 以上对比。
- **动效**：现状是 0ms 瞬时变黑。按 M3 motion / Carbon motion 的状态切换约定补 120–180ms 的 `background-color` / `color` / `border-color` 过渡，并用 `@media (prefers-reduced-motion: reduce)` 关掉；具体数值与依据见方案文档。
- 同步范围（修一类）：主按钮面具与媒体钮共用同一条规则、弹窗卡头的面具/媒体图标同源同态、欢迎页第 3 步胶囊是真实组件、`styles/tokens.css` 顶部对比度表里「bg on fg 是选中态整钮填实的反色对（#137）」这条注释、`tests/tokens-contrast.test.ts` 若解析该表。

### 7. 向导工具条宽度与遮挡

**查到的规则**

- [Nielsen 十项启发式 #3「User control and freedom」](https://www.nngroup.com/articles/ten-usability-heuristics/) 与 #1「Visibility of system status」：工具不该把用户要操作的对象挡住且没有退路。
- [Laws of UX · Fitts's Law](https://lawsofux.com/fittss-law/)：目标越大越好命中；反过来说，**一个压住半屏的浮层会减少可点区域**。
- 项目 `docs/design-ui.md` §七已登记「目标够大（Fitts）」「用户可控（Nielsen 3）」。
- 历史事实（本地代码）：720px 来自 #123，理由是当时「看效果」一行四列（名字 / 范围 / 调整 / ✕）在 560 下挤成两三行；0.8.11 #140 又因「忽宽忽窄」把两步都钉死成 720。现在 `WizardApp.vue` 默认行已折成「序号 + 名字 + 调整 + ✕」+ 一行摘要，**四列理由不再成立**。

**结论**（具体数值与同类产品证据见方案文档）

- 不再靠「拍一个宽度」解决，分三件事：① 两步仍同宽（保住「不变来变去」的成果）但收窄；② 增加「收起面板」能力，点选时可临时让开页面（Nielsen #3）；③ 宽度/收起/状态切换都给短过渡，避免新的突变。
- 标题和图标单步仍是按内容伸缩，要一起核对，不能出现三步长三种样子。

---

## 三、本次修正的旧结论（重要）

| 旧结论（写在代码/注释/CHANGELOG 里） | 修正 | 依据 |
|---|---|---|
| 「24px 下整颗换底是唯一稳定满足 WCAG 1.4.11 3:1 的位置」（`ui/toggle/toggle.css` 154–158） | 不是唯一解；加粗边框、状态指示物、图标颜色变化都有合规路径 | WCAG 1.4.11 Intent + Figure 6；M3 Buttons specs |
| 「主开关关着 → 两颗入口禁用 + 说明」（0.8.10 目检改判，`check-pages.mjs` 锁死） | 改成两态都可点，删掉那句不实的说明 | GOV.UK Button Disabled；Ant disabled 语义；胶囊现状 |
| 「720px 因为四列装不下」（#123） | 四列已不存在 | `WizardApp.vue` 默认行结构 |
| 「未配置态没有开关可框，两颗入口保持原样」（`PopupBody.vue` 注释） | 两态共用结构 | Carbon Empty States；用户反馈 |

---

## 四、参考来源清单

访问日期均为 2026-11-09。

| 来源 | URL | 本次取用的规则 |
|---|---|---|
| GOV.UK Design System · Button | https://design-system.service.gov.uk/components/button/ | 一页一个主按钮、次要动作太多要简化、禁用态要避免、危险按钮只给不可撤销动作、按钮文案写动作 |
| Material Design 3 · Buttons specs | https://m3.material.io/components/buttons/specs | Toggle selected/unselected 五色表、Standard/Outlined toggle、3:1 对比要求、shape morph |
| Material Design 3 · Icon buttons（页面正文为脚本渲染，未能抓取，改用 spec 整理与 Flutter 文档交叉验证） | https://m3.material.io/components/icon-buttons/overview · https://github.com/tankrap/m3x/blob/main/specs/icon-button.md · https://leancode.co/glossary/iconbutton-in-flutter | filled / filledTonal / outlined / standard 四档、isSelected + selectedIcon |
| W3C WCAG 2.2 · Understanding SC 1.4.11 | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html | 状态指示 3:1、Figure 5/6/7、与 1.4.1 Use of Color 的关系 |
| W3C WCAG 2.2 · SC 1.4.1 / 2.5.8 | https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 不能只靠颜色；目标 ≥24×24 |
| Ant Design · Button | https://ant.design/components/button | 一区一个 primary、1 primary + n secondary、Text/Link button 档位、disabled 语义 |
| Carbon Design System · Empty states | https://v10.carbondesignsystem.com/patterns/empty-states-pattern/ | 首次使用要说明原因与第一步、渐进披露、内容限于一个功能 |
| Nielsen Norman Group · 10 Usability Heuristics | https://www.nngroup.com/articles/ten-usability-heuristics/ | #1 状态可见、#3 用户可控与自由 |
| Laws of UX · Fitts's Law | https://lawsofux.com/fittss-law/ | 遮挡减少可点区域 |
| 项目内（不重复计入「三家以上」） | `docs/design-ui.md`、`docs/design.md`、`GLOSSARY.md`、`styles/tokens.css`、`AGENTS.md` | 项目已成的落地规则与对比度实算表 |

> 未能直接抓取正文的页面（M3 icon buttons overview 为脚本渲染、Ant Empty 等）已在表中注明，未据此编造规则；相关结论均由可抓取的 specs / 交叉来源支撑。
