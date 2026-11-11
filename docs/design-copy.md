# 引导性文字：什么时候露出、什么时候收起来（#161）

> 性质声明：本文是**权威**。「界面里要不要放一段说明、放成常驻还是按需」以本文为准；
> `docs/dev/consistency-checklist.md` **只是索引**，不在这里另立规矩。控件尺寸、颜色、字号、
> 按钮层级与排布仍以 `docs/design-ui.md` / `styles/tokens.css` 为准；界面用词以 `GLOSSARY.md` 为准。

软件界面不是小作文。有些文字前几次有用，后面几百几千次几乎都是多余的；但另一些（危险后果、
状态、边界坑）少一句就会出错。本文件把「哪些留、哪些收、怎么收」一次说清，四处界面照此收口。

**为什么新建本文件、而不是塞进 `docs/design-ui.md` 的某一节**：那份文档管的是控件外观
（色彩 / 字号 / 按钮 / 排布），「信息密度与呈现时机」是另一条独立维度，依据的是另外四家与
WCAG 2.2 1.4.13；混进外观规范会把一份文档撑成两种性质。`docs/design-ui.md` 与 `docs/design.md`
各挂一条指针指到这里，权威仍只有一处，索引也不重复。

## 一、四家依据（原文）

1. [GOV.UK Design System · Text input](https://design-system.service.gov.uk/components/text-input/)
   - *"Use hint text for help that's relevant to the majority of users"* —— 只有多数人用得上的才配写成常驻提示。
   - *"Keep hint text to a single short sentence, without any full stops"* —— 常驻提示只许一句短句，不加句号。
   - *"Do not use hint text to explain anything that's longer than a short, simple sentence"* —— 超过一句短句的解释不配当常驻提示。
2. [Carbon · Form](https://carbondesignsystem.com/components/form/usage/)
   - *"Helper text is the preferred method of assisting users because it is always visible for the user to reference without additional effort"* —— 完成操作必需的信息始终可见，不额外费劲去找。
   - *"all pertinent assistive information to form completion … be presented simply and directly as helper text under the field and not be in a tooltip"* —— 与完成操作直接相关的信息放在字段下面，不进 tooltip；这正是第三节「必须留下」的依据。
3. [NN/g · Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
   - *"Initially, show users only a few of the most important options. Offer a larger set of specialized options upon request"* —— 先露少数，其余按需。
   - 原文点出资深用户的收益是 *"avoid having to scan past a large list of features they rarely use"* —— 正对应用户说的「后面几百几千次多余」。
4. WCAG 2.2 [1.4.13 Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) + 项目 **0.8.17** WIG 教训
   - 1.4.13：hover / focus 触发的内容必须可撤下（dismissible）、可悬停（hoverable）、常驻（persistent）；键盘可达、读屏可达，不能只靠鼠标。
   - 0.8.17 WIG（`docs/dev/DEVLOG.md`）：ⓘ 信息标此前聚焦只播报「更多信息」，浮层正文对读屏完全不可达——视觉审查抓不到这类问题，必须让 `aria-describedby` 指向常驻 DOM 里的正文，由代码级断言兜住。

## 二、三条整屏规矩

**a. 常驻：多数人每次都需要 / 完成操作必需 / 危险与后果 / 状态与错误 / 边界坑。**
跟着它解释的那个对象走、不进操作栏；只许一句短句（GOV.UK + Carbon + 项目既有「说明跟着对象走」
「ready 态卡头无说明行」）。一句说不完的，说明它本来就不该常驻。

**b. 按需：只在前几次有用、或少数人才需要。**
收进 ⓘ / `<details>`；必须**键盘可达、读屏可达、Esc 可撤、内容留在 DOM**，不能只靠 hover
（NN/g + WCAG 1.4.13）。ⓘ 的唯一实现是 `ui/info-tip/InfoTip.ts` + `styles/info-tip.css`：
每实例唯一 id、`aria-describedby` 指向常驻 DOM 里的浮层、`role="tooltip"`、`tabindex="0"`；
浮层由 CSS 显隐、不由 `v-if` 生灭；Esc 撤下后重新聚焦即可再得（persistent）。样式一份共享，
扩展页面经 `styles/base.css` 引入、页内 shadow root 经 `ui/wizard/wizard-styles.ts` 注入。

**c. 不做「记住已读后自动隐藏」。**
Carbon 要求 helper text 始终可得、NN/g 要求按需可得；自动隐藏会让老用户找不到解释、换设备又重来。
而且项目目前**没有任何 seen / 已读机制**：`GlobalSettings` 仅 4 个字段，欢迎页只在 `onInstalled`
的 install 分支打开且不写任何 `seen` 标记。新增字段还要同步导出 / 导入，属于新功能而不是减字。
**不做「记住已读后自动隐藏」**。

## 三、必须留下、不许收起（逐条有断言守着）

`media.hint` / `media.hintShort`（灰度独立于主开关）、`popup.coverHint`（临时性）、
`management.deleteSite.impact` 与 `settings.replaceDialog.*`（危险后果）、
`common.titleBlankHint` 三处脚注（空白标题坑）、所有状态 / 错误 / 读屏文本。
Carbon 的「pertinent 信息不进 tooltip」是这条的依据；`tests/media-ui.test.ts:71-82`
与 `tests/copy-guidance.test.ts` 各守一份，不许推翻。

## 四、落地口径

弹窗 / 站点设置页 / 插件设置页 / 欢迎页 / 向导：先删零风险重复（跨页串用的说明、同义重复的两条），
再把 b 类长说明收进 ⓘ、a 类常驻的压成一句短句。改完按 `AGENTS.md`「界面整屏审查」五条逐条自查：
一行只做一件事、一个符号只有一个意思、动词跟对象真实状态、一屏一个主操作、同一个东西全项目一个样子。
文案票与结构票分开提交，便于出回归时定位。
