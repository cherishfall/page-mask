# 更新日志 / Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 结构与 [语义化版本](https://semver.org/lang/zh-CN/)。
每个版本下「中文」与「English」两节逐条对应。
This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).
Under each version, the Chinese and English sections correspond item by item.

## [0.6.7] - 2026-11-06

### 中文

#### 变更

- **「右下角的小按钮」改叫「悬浮按钮」**：原来那个是位置描述，不像个名字。弹窗开关、插件设置的卡片标题、欢迎页第 3 步同步改（#124）
- **两个管理页的互跳入口对齐**：都在页面标题行右侧、同一个次要按钮（有边框、深色字），插件设置页顶部不再另放一条「← 全部网站设置」（#124）

#### 修复

- **「插件设置」入口的字色是蓝的**：链接做成按钮时，全局的链接色盖住了按钮文字色；补一条 `a.button` 的字色，现在和旁边的按钮同色（#124）

### English

#### Changed

- **"The small button in the corner" is now "Floating button"**: the old label described where it sits instead of naming it. The popup switch, the settings card and the welcome step all use the new name (#124)
- **The two management pages now link to each other the same way**: same secondary button in the title row on the right; the settings page no longer has a separate "← All site settings" link at the top (#124)

#### Fixed

- **The "Extension settings" link was blue**: the global link colour overrode the button's text colour when a link is styled as a button; `a.button` now keeps the button colour (#124)

## [0.6.6] - 2026-11-06

装机复核抓到的两处：面板挤、退出太容易误触。

### 中文

#### 修复

- **「看效果」那一屏太挤**：面板最大宽度 560 → 720，正文字号不变但一行放得下「名字 / 范围 / 调整 / ✕」；左右内边距恢复到 16——上批把内边距挪到标题栏时**连左右一起挪走了**，文字会顶到面板边缘（#123）
- **拖动工具条不再贴死视口边缘**：四边至少留 16，视觉上不再是「被截断」（#123）

#### 变更

- **「退出设置」按钮每次都先问一次**：0.6.4 起整条标题栏可拖，按在按钮上不拖动、松手就是一次点击，误触一次这次选的内容全没；现在无论有没有改动都会确认，没改动时说明「这次还没有未保存的改动」。Esc 仍然只在真有未保存内容时才问（#123）

### English

#### Fixed

- **The "see how it looks" panel was cramped**: max width 560 → 720 so the four columns (name / scope / adjust / remove) fit on one line, and the body's horizontal padding is back to 16 — the previous release moved the padding onto the title bar and took the left/right padding with it, so text ran to the panel edge (#123)
- **Dragging the toolbar no longer pins it to the viewport edge**: it keeps a 16px gap on all sides (#123)

#### Changed

- **"Exit setup" now always asks once**: since 0.6.4 the whole title bar is draggable, so a slightly-off press lands as a click and throws away the current picks; the confirmation now appears whether or not anything changed, and says so plainly when nothing is unsaved. Esc still only asks when there is unsaved work (#123)

## [0.6.5] - 2026-11-06

0.6.4 交付前的「新眼睛」复查抓到的两处，都属于同一条：看着不像一套。

### 中文

#### 修复

- **10 个内置图标改成同一套画法**：统一描边粗细、统一字形框、圆头圆角，只有细节点缀用实心。此前一半是描边、一半是实心，凑成一排不像一套（#121）
- **图标选中态不再只靠颜色**：选中的那一格右上角多一枚勾选角标，色弱用户也分得出选的是哪一个（WCAG 1.4.1，#121）

### English

#### Fixed

- **The 10 built-in icons now share one drawing system**: same stroke weight, same glyph box, rounded caps and joins, with fills only for small details. Previously half were outlines and half were solid — side by side they didn't read as a set (#121)
- **The selected icon no longer relies on colour alone**: the chosen tile gets a check badge in its top-right corner, so colour-blind users can still tell which one is picked (WCAG 1.4.1, #121)

## [0.6.4] - 2026-11-06

0.6.3 装机复核后的一批界面与交互修缮（#117）：浮层在白底网页上看得见了、工具条整条标题栏能拖、图标不用再自己找图、设置一键直达。

### 中文

#### 修复

- **页内浮层在白底网页上分不出边界**：向导工具条与确认框原来只有一层几乎看不见的阴影，白底上等于没有边界；现在有 1px 描边 + 近 / 中 / 远三层阴影，系统强制颜色模式下也有边（#118）

#### 新增

- **向导工具条的整条标题栏都能拖**：按在标题、进度或空白处都能移动，按钮照常点击；把手可点区从 24 加到 32（触屏 44），图形不变（#119）
- **小胶囊「⋯」菜单多了「调整不透明度」**：点了直接打开插件设置的不透明度那一栏，滚到卡片、焦点落在滑杆上（#120）
- **标签页图标改成三选一**：网站原来的图标 / 不显示图标 / 换成内置的 10 个图标——不用再自己找图上传（#121）

#### 变更

- 插件设置里不再有「默认图标」：图标三态之后它没有要解决的问题（#121）
- **只换标题、不动图标的网站，标签页上会保留网站自己的图标**（#121）
- 遮住整页时标签页图标固定为空白，不跟着站点设置走；撤掉幕布后换回该站自己选的那一张（#121）

#### 文档

- README 新增「升级：换版本不丢设置」：固定目录覆盖 + 刷新，别卸载（#122）

### English

#### Fixed

- **In-page panels no longer disappear into white pages**: the wizard toolbar and dialog had only a barely visible shadow; they now have a 1px border plus near / mid / far shadows, and keep an edge in forced-colors mode (#118)

#### Added

- **The whole title bar of the wizard toolbar is draggable**: press the title, the step text or empty space to move it — buttons still click normally; the grip's hit area went from 24 to 32 (44 on touch) with the artwork unchanged (#119)
- **The small button's ⋯ menu gained "Adjust opacity"**: opens the extension settings on the opacity card, scrolls to it and focuses the slider (#120)
- **Tab icon is now a three-way choice**: the site's own icon / no icon / one of 10 built-in icons — no more hunting for image files (#121)

#### Changed

- The default-icon setting is gone: the three-way choice leaves it nothing to do (#121)
- **Sites that only change the title now keep the site's own tab icon** (#121)
- Covering a page always uses a blank tab icon regardless of the site's choice, and restoring brings back the icon that site picked (#121)

#### Docs

- README gained "Upgrading without losing your settings": overwrite the same folder and hit reload, don't remove (#122)

## [0.6.3] - 2026-11-06

发版后深度审查第二、三轮（#115）：复查上一轮修复本身，10 处跟进 + 1 处毫秒级收口。
Post-release deep review, rounds two and three (#115): reviewing the previous round's own fixes — 10 follow-ups plus one millisecond-level close-out.

### 中文

#### 修复

- **向导开着时弹窗不再报「没能遮住」**：页面控制器拒遮（向导正开着）时不再触发重新注入——重新注入会把用户正开着的向导关掉（#115）
- **一次遮住请求不再可能被两个控制器互相推让掉**：控制器接口补「遮住进行中」标记，接管方据此把这次请求接住补遮（#115）
- **「遮住」报成功更严谨**：注入后的回查避开一次性脚本还在加载的窗口（等一拍重查）；毫秒级的「读配置还没读完」窗口也并入「遮住进行中」（#115）
- 删除确认框关闭后焦点不再被菜单的收起事件拽走；列表「⋯」快速点两行不再可能报错（#115）

#### 变更

- 表单与视觉细节：向导和胶囊面板的标题输入也不再触发密码管理器；弹窗底部链接文字颜色与按钮一致；欢迎页示意图显式不可点；单选行间距与命中区补齐；清理不再使用的文案键（#115）

### English

#### Fixed

- **The popup no longer reports "couldn't cover" while the wizard is open**: when the page controller refuses (the wizard owns the page), the fallback no longer re-injects — which would tear down the user's open wizard (#115)
- **A cover request can no longer be dropped between two controllers**: the controller interface gained a "covering in progress" flag so the adopting controller picks up and completes the request (#115)
- **"Covered" reporting is stricter**: the post-injection check waits out the one-shot script's module load; the millisecond window while it reads storage now also counts as "in progress" (#115)
- Focus is no longer yanked out of the delete dialog by the menu's collapse event; clicking "⋯" on two list rows quickly can no longer throw (#115)

#### Changed

- Form and visual details: the wizard and capsule-panel title inputs no longer trigger the password manager; popup footer links use the same text colour as buttons; the welcome-page artwork is explicitly non-interactive; radio rows got back spacing and hit-area padding; an unused copy key was removed (#115)

## [0.6.2] - 2026-11-06

发版后深度审查第一轮（#114）：代码复查 + Web Interface Guidelines 审计 + 真站冒烟，修复 16 项。
Post-release deep review, round one (#114): code review + Web Interface Guidelines audit + real-site smoke — 16 fixes.

### 中文

#### 修复

- **删除确认框可能被跳过**：弹窗里的删除失败过一次后，再按 Esc 关闭确认框会被当成「确认」，直接再次删除。现在与站点设置页同一口径，关闭即复位（#114）
- **遮住功能可能在一个标签页里永久失效**：极少数时序下（页面注入与启用站点赛跑），一次性脚本会静默退位却留下「初始化中」标记，之后这个标签页再也遮不上。修复退位路径，标记总会复位（#114）
- **遮住/恢复的状态更可信**：幕布遮住后注入不再假报成功（注入后回查一次）；弹窗的「恢复」不再拿打开时的旧状态比对（期间页面可能已被别处改过）（#114）
- **列表「⋯」菜单快速点两行不再报错**；弹窗底部两个入口变成真链接，中键 / Cmd+点击也能开新标签页（#114）

#### 变更

- 表单细节：标题输入框不再触发密码管理器（autocomplete=off，三处）；单选行点击区没有死区；返回链接与所有链接悬停有反馈；长域名标题换行不出孤行（#114）
- 真站冒烟脚本跟上 #98 的行为（只收起内容不改标签页标题），微信读书 / 得到 / 墨问重跑全绿（#114）

### English

#### Fixed

- **The delete confirmation could be skipped**: after one failed delete in the popup, pressing Esc on the dialog was treated as confirmation and deleted again. It now resets on close, same as the site settings page (#114)
- **Covering could permanently fail in a tab**: in a rare race (one-shot injection vs. enabling the site), the one-shot script bowed out but left an "initializing" flag behind, after which that tab could never be covered. The bow-out path now always resets the flag (#114)
- **Cover state is more trustworthy**: injection now verifies the curtain is really up before reporting success; the popup's "Restore" no longer compares against a snapshot taken when the popup opened (the page may have changed meanwhile) (#114)
- **Clicking "⋯" on two list rows quickly no longer errors**; the two popup footer entries are real links now — middle-click / Cmd+click open them in a new tab (#114)

#### Changed

- Form details: title inputs no longer trigger the password manager (autocomplete=off, three places); radio rows have no dead zones; the back link and all links show hover feedback; long hostnames don't leave orphan lines when wrapped (#114)
- The real-site smoke script now matches #98 (content-only sites keep their tab title); re-run green on weread / dedao / mowen (#114)

## [0.6.1] - 2026-11-06

第二轮装机反馈：幕布三处入口互通、欢迎页矮窗口、胶囊可淡可小可藏、删除入口补齐。
Second round of real-device feedback: curtain entries now agree, the welcome page survives short windows, the capsule can fade / shrink / disappear, and delete entries are everywhere you need them.

### 中文

#### 修复

- **幕布三处入口（胶囊 / 弹窗 / 快捷键）现在互相认账**：以前页面上可能同时有两套幕布控制器，「遮 → 撤 → 再遮」第三次会失灵。现在每个页面只有一个控制器，任何一处遮住、另外两处都能恢复；没添加过的网站也能反复遮 / 撤（#107）
- **欢迎页在矮窗口里显示不全**：窗口只有几百像素高时，底栏压住第 2 步卡片、切步也不滚动。现在滚动只发生在内容区，底栏固定在底部；切「下一步」自动把当前步骤带进视野，读屏同步播报当前步（#108）

#### 变更

- **胶囊收到 WCAG 允许的最小尺寸**：高 32 → 26，全功能宽 170 → 164、mini 宽约 80 → 74；可点区仍是 24×24，触屏仍 40×40。不做大小档——现在就是上限（#109）
- **不透明度改成 10%–100% 的滑杆**：原来的三档（100% / 85% / 70%）换成一档 10% 的滑杆，拖动即时预览、松手保存；鼠标移上去、键盘选中或拖动时立刻恢复全清楚。旧设置里的三档自动迁移（清晰 → 100%、淡一点 → 90%、很淡 → 70%）（#110）

#### 新增

- **「右下角的小按钮」可以按网站关掉**：插件弹窗里一个开关，关掉后这个网站不显示胶囊；再打开时胶囊回到右下角、完整形态。关掉不影响收起规则、标题和图标、遮住整页的快捷键（#111、#112）
- **弹窗里能删除这个网站的设置**：藏在弹窗最底部的红字入口，二次确认后删除配置、收回权限——胶囊被藏起来之后，删除从这里仍然够得着（#112）
- **「全部网站设置」列表可以逐行删除**：每行行尾一个「⋯」菜单，点开就是「删除这个网站的设置」；不用再先进详情页。确认框与详情页是同一个，不加编辑按钮、不做多选（#113）

### English

#### Fixed

- **The three curtain entries (capsule / popup / shortcut) now agree with each other**: two curtain controllers could coexist on a page, so cover → restore → cover again failed on the third press. There is now exactly one controller per page; covering from any entry can be undone from any other, and unadded sites can be covered and restored repeatedly (#107)
- **The welcome page was cut off in short windows**: with a few hundred pixels of height the bottom bar covered step 2 and switching steps didn't scroll. Scrolling now happens only in the content area with a fixed bottom bar; moving to a step brings it into view and a screen-reader announcement follows (#108)

#### Changed

- **The capsule shrunk to the smallest size WCAG allows**: height 32 → 26, full width 170 → 164, mini width ~80 → 74; hit areas stay 24×24 (40×40 on touch). No size presets — this is the ceiling (#109)
- **Opacity is now a 10%–100% slider**: the three presets (100% / 85% / 70%) became a slider with 10% steps, previewing instantly and saving on release; it turns fully clear on hover, keyboard focus or drag. Old presets migrate automatically (Clear → 100%, Softer → 90%, Faintest → 70%) (#110)

#### Added

- **The small button in the corner can be turned off per site**: a switch in the popup hides the capsule on that site; turning it back on restores the capsule at the bottom-right corner in full form. Hiding doesn't affect hide rules, the title and icon, or the cover shortcut (#111, #112)
- **The popup can now delete a site's settings**: a red text entry at the very bottom with a confirmation — reachable even when the capsule is hidden (#112)
- **The site list supports per-row deletion**: each row ends with a "⋯" menu containing "Delete this site's settings" — no need to open the details page first. Same confirmation dialog as the details page; no edit button, no multi-select (#113)

## [0.6.0] - 2026-11-05

第一轮装机复核内容（装机版：已由产品所有者安装复核，未作为商店版本发布）。
First review round (installed build: reviewed on the reviewer's machine, never published as a store version).

### 中文

#### 新增

- **幕布快捷键**：默认 Ctrl+Shift+X（Windows）/ ⌘+Shift+X（Mac），按一下遮住整页、再按一下恢复；没添加过的网站也能遮。全产品只有这一条快捷键（#101）
- **胶囊不透明度三档**：清晰 / 淡一点 / 很淡（0.6.1 起改为 10%–100% 滑杆），只调它闲着的时候有多淡，一碰就恢复清楚（#102）

#### 变更

- **只改保存过「标题和图标」的网站**：只收起内容的网站不再被顺手改掉标签页标题（#98）
- **保存过标题的网站可以恢复原样**：站点设置页里一键还原网站自己的标题和图标，收起的内容不动（#99）
- **向导同类组统一用描边**：删掉 1.1 / 1.2 子号牌，组与组的边界一眼可辨（#100）
- **欢迎页改用真实组件**：三步三功能，示意图就是真的弹窗与胶囊，不会再过期（#103）
- **新插件图标**：一副歪着放在纸上的面具，16px 起每一档都单独核对（#104）

### English

#### Added

- **Curtain keyboard shortcut**: Ctrl+Shift+X (Windows) / ⌘+Shift+X (Mac) by default — press to cover the page, press again to restore; works on unadded sites too. This remains the product's only shortcut (#101)
- **Capsule opacity presets**: Clear / Softer / Faintest (replaced by the 10%–100% slider in 0.6.1) — only how faint it sits when idle, instantly clear on touch (#102)

#### Changed

- **Only sites with a saved title and icon get renamed**: sites that only hide content no longer have their tab title changed as a side effect (#98)
- **Saved titles can be restored**: one click in the site settings puts back the site's own title and icon without touching hidden content (#99)
- **Wizard groups share one outline**: the 1.1 / 1.2 sub-badges are gone; group boundaries read at a glance (#100)
- **The welcome page renders real components**: three steps, three features — the artwork is the actual popup and capsule, so it can't go stale (#103)
- **A new extension icon**: a mask resting tilted on a page, verified at every size from 16px up (#104)

## [0.5.5] - 2026-11-05

标记语言定案 + 测试脚本加固。/ Marker language settled, plus a test-script fix.

### 中文

#### 修复

- **密行里的号码牌归属不明**：在 24 像素高的列表行上，号码牌浮在元素上方、视觉上落在上一行里——看着像上一行的编号，同组最后一行像漏了牌子。密行的号码牌现在放在该行**左侧、与该行同高**，归属一眼确定，也不遮行首文字；够高的卡片与横幅维持原样
- 测试脚本加固：真站冒烟/真机脚本在无头浏览器里动画帧不触发时不再整条崩掉

### English

#### Fixed

- **Badges were ambiguous in dense rows**: on a 24-pixel list row the badge floated above the element and visually landed in the previous row — it read as that row’s number, and the last member of a group looked like it had none. Dense-row badges now sit to the **left of their row, aligned with it**, so ownership is obvious and the row’s text stays clear; taller cards and banners are unchanged
- Test scripts no longer crash when animation frames don’t fire in a headless browser

## [0.5.4] - 2026-11-05

拖动回归修复。/ Drag regression fix.

### 中文

#### 修复

- **全功能胶囊拖动被钉在右缘**：上一版重构位置逻辑时删掉了「拖动中跟手」分支——右半视口里拖动只能上下滑。现在拖动全程跟手，松手后仍按停靠边贴靠（往右收不变）（#94）

### English

#### Fixed

- **The capsule was pinned to the right edge while dragging**: the position refactor dropped the follow-the-pointer branch — dragging in the right half only moved vertically. Dragging now follows the pointer the whole way; releasing still docks to the nearest edge (#94)

## [0.5.3] - 2026-11-05

首次引导页减负：文字砍到每步一句，每步配一张小图。/ The welcome page loses its walls of text: one line per step, one small illustration each.

### 中文

#### 变更

- **引导页文字减负**：四段长文各砍成一句具体动作；每步配一张小图——工具栏固定示意（SVG）、弹窗微缩模型（真实按钮名）、「点选 → 看效果 → 保存」流程、胶囊微缩模型
- 小提示压成一行；上一轮的贴底「下一步」保留

### English

#### Changed

- **Welcome page text diet**: each of the four long paragraphs is now one concrete action, with a small illustration — toolbar pinning (SVG), a miniature popup (real button names), the pick → preview → save flow, and a miniature capsule
- One-line tip; the bottom-docked “Next” from the previous release stays

## [0.5.2] - 2026-11-05

第二轮「新眼睛」全量目检后的三处小修。/ Three small fixes from the second full "fresh eyes" pass.

### 中文

#### 修复

- **站点设置页与插件设置页的「打开开关后」说法**：站点页指名为「上面的『按你的设置显示』开关」；插件设置页那两处删掉开关说法——那页没有开关，条件本来就是「网站自己没设置时」
- **首次引导页的主按钮不再压在折叠线下**：整页内容超过一屏，底部「下一步」一栏滚动时贴着视口底走
- **遮住整页后「恢复」二字常显**：此前只有图标，右侧留空看着像没渲染完整；唯一的出路不该靠悬停才自我解释

### English

#### Fixed

- **“When the switch is on” copy**: the site page now names the switch (“Shown your way” at the top); the two spots on the Settings page drop the switch wording — that page has no switch, the condition is simply “when a site has none of its own”
- **The onboarding primary button no longer sits below the fold**: the page is taller than one screen, so the bottom bar sticks to the viewport while scrolling
- **“Restore” on the curtain button is always shown**: icon-only with blank right half read as a rendering glitch; the only way back shouldn't need hover to explain itself

## [0.5.1] - 2026-11-05

交付验收加了一道「渲染出来看一眼」的关：每轮改动交付前拍真实渲染截图、交给只看图的「新眼睛」审一轮，发版前全量巡检。本版由此拦下并修掉一批装机才会发现的问题。/ Delivery now includes a rendered-eyes pass: real screenshots reviewed by a context-free "fresh eyes" agent per round, and a full sweep before each release. This release fixes a batch of issues that previously only surfaced after install.

### 中文

#### 修复

- **点选阶段页面滚不动**：全屏捕获层吞掉了滚轮的默认滚动——信息流站（滚动放在内层容器上）完全滚不了。现在滚轮转交给指针下的滚动容器，边选边滚、随下随加载（#88）
- **「另外 N 个一样的」不随懒加载更新**：向导开着时页面变了就重算（事件驱动，不做轮询），新卡片加载进来计数与成员标记实时跟上（#88）
- **看效果阶段没法确认同类勾得对不对**：勾了同类的行新增「检查同类」，跳回点选亮出整组，看完回来草稿不丢（#88）
- **遮住整页后的恢复按钮几乎看不见**：常态半透明在白底幕布上对比度不足 3:1，而它是唯一的出路；改常态全不透明（#87）
- **收起/展开按钮悬停底色溢出胶囊圆头**：圆角跟着实际的端点元素走（#85）
- **拖动把手两副样子**：胶囊与向导工具条统一为同一枚六点 SVG（#83）
- **全功能 ↔ mini 切换位置跳**：改为按贴边侧锚定——右停靠往右收、左停靠往左收；幕布恢复按钮松手同规则贴最近边（顺带修掉「恢复按钮拖到中间、胶囊悬在半空」的潜伏 bug）（#84）
- **收起/展开按钮悬停范围超出胶囊本体**：同上圆角修正（#85）

#### 变更

- **「网站设置」改名「全部网站设置」**：弹窗里它会读成「这个网站的设置」；弹窗入口、列表页标题、返回链接、首次引导提及全部同步，英文 All site settings（#86）
- **管理列表页加「插件设置」入口**：插件设置页本有返回，两页从此互达（#87 审查）
- **默认标签页标题跟随显式选择的界面语言**：选了 English 就得到 "Reading"；「自动」档仍按浏览器语言（#89，推翻旧决策，理由见票）
- **按钮在默认位时「⋯」菜单不再显示「按钮放回右下角」**：不起作用的项不摆；拖过之后照常出现（#90）
- **弹窗空状态提示与实物一致**：不再说「两颗按钮」（漏了「遮住这一页」）（#87）

### English

#### Fixed

- **The page couldn't scroll while picking**: the full-screen capture layer swallowed wheel scrolling — sites that scroll in an inner container (infinite feeds) couldn't scroll at all. Wheel input is now routed to the scrollable container under the pointer, so you can pick and scroll as the feed loads (#88)
- **“Also hide N alike” didn't follow lazy loading**: with the wizard open, page changes now recompute counts and member badges (event-driven, no polling) (#88)
- **No way to check a "similar" match in the preview**: rows with the checkbox ticked get a “Check matches” button that jumps back to picking with the whole group lit; your draft is kept (#88)
- **The restore button on the curtain was nearly invisible**: its semi-transparent look fell below 3:1 contrast on white pages — and it is the only way back. Now fully opaque by default (#87)
- **The fold/unfold button's hover background spilled outside the pill**: cap radii now follow whichever element actually sits at each end (#85)
- **Two different drag handles**: the capsule and the wizard toolbar now share one six-dot SVG grip (#83)
- **The button jumped when switching full ↔ mini**: positions anchor to the docked edge — right-docked shrinks rightward, left-docked leftward; the curtain restore button snaps the same way on release (also fixes a latent bug where the capsule could end up mid-screen) (#84)

#### Changed

- **“网站设置” renamed “全部网站设置” (All site settings)**: in the popup it read as "this site's settings"; popup entry, list title, browser tab title, back links and onboarding mentions all follow (#86)
- **The site list page links to “插件设置” (Settings)**: the two pages now reach each other (#87 review)
- **The default tab title follows an explicitly chosen interface language**: picking English yields "Reading"; “自动” still follows the browser language (#89, overturning the old decision — see the issue for why)
- **The “⋯” menu hides “按钮放回右下角” while the button is at its default spot**: a no-op item isn't shown; it returns once you drag (#90)
- **The popup's empty-state hint now matches what's on screen**: it no longer says “two buttons” and skip “Cover this page” (#87)

## [0.5.0] - 2026-11-04

把界面从上到下过了一遍：同一个东西只有一个样子、一个叫法，一个动作只剩一条路。/ Went over the whole interface: one look and one name per thing, one path per action.

### 中文

#### 变更

- **改收起的内容只剩一条路**：页面内那个独立的编辑面板删掉了。点「编辑收起的内容」直接进设置向导的「看效果」——页面按你的设置显示着，逐行改名、换收起方式、换范围、重新选这一项；「上一步」回到点选，可以再加新的。已经收起的项在页面上用虚线框加「之前收起了」标出来
- **「只这一个 / 同类一起（N）」换成一道勾选框**：「页面上另外 2 个一样的也一起收起」，回答一个是非题，不用先学会「同类」这个词。页面上没有第二个一样的，这道勾选框根本不出现；勾上或取消，页面当场变，工具条上说一句「另外 2 个也收起了」/「现在只收这一个」
- **「收起更多内容」也标出已收起的**：从这个入口进去，页面上已经收着的项同样画虚线框加「之前收起了」；再点其中一个是重复添加，会提示「这一项已经收起了」而不会新增一条
- **「看效果」每行只放一件事**：序号、名称、一句摘要（例如「消失 · 整个网站」）、「调整」、✕。收起方式、在哪些页面收起、重新选、高级（选择器原文）都折进「调整」
- **页面右下角的小按钮**：这个网站只要有设置就出现（只改过标题也算，以前不出现）；「⋯」菜单补上「收起更多内容」，按用途分三组——标题和图标 / 收起更多 / 编辑收起 ｜ 按钮放回右下角 ｜ 删除这个网站的设置（永远排在最后）
- **「你添加的网站」改名「网站设置」**：和「插件设置」配成一对。这个页面上那个「在页面上编辑」删掉了——它不知道该去哪个页面；改成一句说明：想到页面上改，就点工具栏图标再点「编辑收起的内容」
- **按钮全项目一套**：主操作（实心）/ 次操作（有底有边）/ 轻操作（无底无边）/ 危险（红字红边），五种状态齐全。一屏最多一个实心主按钮；能不禁用就不禁用
- **删除只有两种**：从清单里去掉一项，一律是行尾一个 ✕；删除整个网站的设置，才是红字按钮加二次确认
- **向导底栏只放按钮**：退出改成文字按钮「退出设置」；「上一步」带上目的地（「上一步：改标题」「上一步：重新选内容」）
- **文案**：「按你的设置显示 / 网站原样」缩成「按设置 / 原样」（开关的标签仍用全称）；「全部删掉」→「全部取消选择」；「N 项已收起」这类说法彻底不用
- **扩展改名**：`PageMask · 页面清爽模式` → `PageMask · 收起网页上不想看的部分`（英文 `PageMask — Hide the Parts You Don't Want`）

#### 修复

- 「盖住」的预览原来只盖住点中的那一个，保存后却盖住整组；现在预览与保存结果一致
- 保存中的按钮不显示「正在保存…」（状态没跟着变）
- 页面右下角三个小图标按钮的可点区域太小（16 / 22 像素），提到 24×24，触屏 40×40
- 界面里最后一处 10 像素的字没有了
- 弹窗底部「网站设置」「插件设置」原来是无框小字，看着像不能点；改成了普通按钮
- 标题小面板右上角的裸 ✕ 改成文字「关闭」（✕ 只留给「从清单里去掉一项」）

### English

#### Changed

- **One way to edit what's hidden**: the separate in-page editor is gone. “Edit hidden items” now opens the setup wizard at its last step — the page is showing your settings, and you rename, change the hide method, change where it applies, or pick the element again, row by row. “Back” takes you to picking, to add more. Items you already hid are outlined with a dashed border and a “Hidden before” tag
- **“Just this one / All N alike” is now a checkbox**: “Also hide the other 2 like this one” — a yes-or-no question instead of a word to learn. When there's no second one on the page, the checkbox doesn't appear at all. Tick or untick and the page changes right away, with a line in the toolbar: “The other 2 are hidden too” / “Only this one is hidden now”
- **One decision per row in the result step**: number, name, a one-line summary (e.g. “Disappear · The whole site”), “Adjust”, ✕. Hide method, where it applies, pick again, and the advanced selector all live inside “Adjust”
- **The small button in the corner**: now appears whenever the site has any setting (a changed tab title counts; it used to stay hidden). Its “⋯” menu gained “Hide more” and is grouped by purpose — title and icon / hide more / edit hidden | put the button back | delete this site's settings (always last)
- **The corner button has a mini form**: just the state dot (click to switch “Your settings / As is”), Cover (one click when it matters), and Expand — no text, no menu, no grip; a pair of icons switches between mini and full, and each site remembers its own choice
- **“Hide items” also marks what's already hidden**: the wizard stops at picking, items already hidden get the same dashed outline and “Hidden before” tag; clicking one again replaces that rule in place instead of creating a second one
- **“Your sites” renamed “Site settings”**, pairing with “Settings”. The “Edit on the page” button there is gone — it couldn't know which page to open; a sentence now says: use the toolbar icon, then “Edit hidden items”
- **One set of buttons everywhere**: primary (solid) / secondary (filled, bordered) / quiet (no fill, no border) / danger (red text and border), with all five states. At most one solid primary button per screen; avoid disabling buttons where possible
- **Only two kinds of removal**: taking one item off a list is always a ✕ at the end of its row; deleting a whole site's settings is a red button plus a confirmation
- **The wizard's bottom bar holds buttons only**: exit is a text button “Exit setup”; “Back” names its destination (“Back: tab title”, “Back: pick again”)
- **Wording**: “Shown your way / As the site is” shortened to “Your settings / As is” (the switch keeps the full label); “Remove all” became “Deselect all”; “N items hidden” is no longer used anywhere
- **Renamed**: `PageMask — Clean & Focused Pages` → `PageMask — Hide the Parts You Don't Want` (Chinese: `PageMask · 收起网页上不想看的部分`)

#### Fixed

- “Cover” used to preview only the element you clicked, but covered the whole group once saved; the preview now matches the result
- Buttons didn't show “Saving…” while saving (the state wasn't reactive)
- The three small icon buttons in the corner were too small to hit (16 / 22 px); they're 24×24 now, 40×40 on touch screens
- The last 10 px text in the interface is gone
- The two footer entries in the popup (“Site settings” / “Settings”) were borderless small text that didn't look clickable; they're regular buttons now
- The bare ✕ atop the title panel became a text “Close” button (✕ is reserved for taking an item off a list)

## [0.4.1] - 2026-11-02

把界面上说的话重写了一遍：不再用自造的名词指代功能，每个按钮和提示都落到具体的动作上。/ Rewrote what the interface says: no more invented nouns standing in for features — every button and hint now names the action.

### 中文

#### 变更

- **按钮和菜单改成说人话**：主按钮「为当前网站开启清爽模式」→「设置这个网站」；「编辑当前网站」→「编辑收起的内容」；底部入口「管理全部网站」→「你添加的网站」；「遮住本页 / 恢复本页」→「遮住这一页 / 恢复这一页」
- **两个状态换了名字**：「清爽 / 原样」→「按你的设置显示 / 网站原样」。开关标签、页面右下角小按钮的悬停提示、网站列表里的状态都跟着改，不用先猜「清爽」是什么意思
- **技术词全部下架**：「授权 / 待授权 / 授权并启用 / 一次授权全部」→「允许访问 / 需要允许访问 / 允许访问 / 全部允许」；「生效范围」统一成「在哪些页面收起」；「规则」→「收起设置 / 收起项」；「去处理」→「重新选一次」；「快捷填入」→「现成的标题」；「小胶囊」→「页面右下角的小按钮」
- **同一件事全项目只留一个叫法**：设置第 3 步和页面内编辑面板原来一个叫「在哪些页面收起」、一个叫「生效范围」，现在统一；「整站 / 仅 / 除外」这类缩写全部删掉
- **说不清的地方补足**：用不了的页面说清原因（「Chrome 自己的页面不让扩展改动，换一个普通网页再试」）；第一次打开时说清能做什么（改标签页标题和图标、点选页面内容收起来）；失效提醒改成「「顶部导航栏」最近找不到目标了，可能网站改版了。在哪些页面收起：整个网站」
- **数量说法不再自相矛盾**：网站显示原样时，「已收起 N 项」是句假话，改成中性的「N 项收起设置」
- **扩展简介与工具栏提示**：简介去掉「一键收起」，悬停提示从「让当前网站更清爽」改成「设置这个网站的标签页标题、收起内容」

#### 修复

- 插件设置页的标签页标题现在跟随界面语言（原来固定是中文）

### English

#### Changed

- **Buttons and menus now say what they do**: the main button "Turn on clean mode for this site" → "Set up this site"; "Edit this site" → "Edit hidden items"; the bottom entry "Manage all sites" → "Your sites"; "Cover this page / Restore this page" stays, and the page-side wording matches
- **The two states were renamed**: "Clean / Original" → "Shown your way / As the site is". The switch label, the small button's tooltip and the site list follow, so nobody has to guess what "Clean" means
- **Jargon is gone**: "authorize / needs access / allow and turn on / allow all" → "allow access / needs access / allow access / allow all"; "where it applies" is one name everywhere; "rule" → "hidden item / items set to hide"; "fix it" → "pick again"; "quick fill" → "ready-made titles"; "the small capsule" → "the small button at the bottom-right"
- **One name per thing**: step 3 and the on-page editor used to call the same setting two different things; they now match, and abbreviations like "whole site / only / except" are gone
- **Where it was vague, it now explains**: unsupported pages say why ("Chrome's own pages don't let extensions change them. Try a normal web page"); the first-time hint says what you can do; broken items read "“Nav bar” can't be found any more — the site may have changed. Where it applies: the whole site"
- **Counts no longer contradict the state**: "N items hidden" was untrue while a site showed as-is; it is now the neutral "N items set to hide"
- **Store blurb and toolbar tooltip**: dropped "with a click" from the short description, and the tooltip now names the action instead of "make this site clean & focused"

#### Fixed

- The Settings page tab title now follows the interface language (it used to stay Chinese)

## [0.4.0] - 2026-10-30

一次「把界面捋顺」的批次：面板更简单、设置分成两个页面、向导变成三步、整套界面有中英文。/ A batch that straightens out the interface: a simpler popup, settings split into two pages, a three-step wizard, and a bilingual UI.

### 中文

#### 新增

- **面板只留三件事**：主操作、编辑当前网站、还有一个能来回点的「遮住本页 / 恢复本页」；底部并排两个入口——「管理全部网站」与「插件设置」。原来的「设置标题和图标」从面板移除，改到页面右下角小胶囊的菜单里
- **设置分成两个独立页面**：「你添加的网站」是网站列表，点进去是一个网站的设置页；「插件设置」单独一页，放默认标题、默认图标、导出 / 导入、界面语言与版本信息，也注册成了扩展的「扩展程序选项」
- **默认标签页图标**：插件有一张自己的默认图标，生效顺序是网站自己设的 > 插件默认 > 透明（不显示）。改了默认图标，没单独设过图标的网站会一起变
- **设置向导变成三步**：标签页标题和图标 → 点选要收起的内容 → 看效果。选中的内容列成清单、可逐项删掉；生效范围也在「看效果」这一步定；点保存即完成
- **页面右下角小胶囊的菜单变成四项**：标签页标题和图标 / 编辑收起的内容 / 按钮放回右下角 / 删除这个网站的设置
- **「一键清空」改叫「删除这个网站的设置」**：确认框里写清删的是什么、影响哪些东西；网站的设置页和页面菜单里是同一个名字
- **遮住整页后是一颗睁眼的小按钮**：和平时那根小胶囊同一套长相，可以拖动、记住位置；鼠标移上去（或键盘聚焦）才显出「恢复」两个字
- **导出文件更完整**：除了全部网站的设置，还带上插件设置（默认标题、默认图标）与导出时的版本号；文件名形如 `pagemask-0.4.0-20261030120000.json`
- **全界面中英双语**：面板、管理页、向导、页面内的按钮与提示都有中文和英文两套文案；「插件设置」里可以选界面语言（跟随浏览器 / 简体中文 / English），切换立即生效

#### 修复

- **标签页标题不再和网站"对抢"**：个别网站反复改写标签页标题时，插件补写频率受控；实在抢不过（网站用定时器死守）就彻底放手，浏览器保持流畅，不再卡顿

### English

#### Added

- **The popup keeps three things**: the main action, "Edit this site", and a two-way "Cover this page / Restore this page" switch; two side-by-side entries at the bottom — "Manage all sites" and "Settings". The old "Set tab title & icon" is gone from the popup; it moved into the menu of the small capsule at the bottom-right of the page
- **Settings split into two pages**: "Your sites" lists the sites you added; clicking one opens that site's settings page. "Settings" is its own page with the default title, default icon, export / import, interface language and version info, and it is registered as the extension's "Options" page
- **Default tab icon**: PageMask now has its own default icon; the order is the site's own icon > the default icon > transparent (nothing shown). Change the default and every site without its own icon follows
- **The setup wizard is now three steps**: tab title and icon → pick what to hide → check the result. Everything picked is listed and can be removed item by item; the scope is decided on the "check the result" step too; saving finishes it in one click
- **The capsule's ⋯ menu now has four items**: tab title and icon / edit what's hidden / put the button back at the bottom-right / delete this site's settings
- **"Reset" is now "Delete this site's settings"**: the confirmation spells out what is deleted and what it affects; the site's settings page and the on-page menu share the same name
- **After covering the page there is a small open-eye button**: same look as the capsule, draggable, remembers its position; hover (or keyboard focus) reveals the word "Restore"
- **Export files are more complete**: besides every site's settings they now include the plugin settings (default title, default icon) and the version at export time; the file name looks like `pagemask-0.4.0-20261030120000.json`
- **The whole interface is bilingual**: the popup, management pages, wizard and on-page controls all have Chinese and English; pick the interface language ("follow the browser" / 简体中文 / English) in Settings and it takes effect immediately

#### Fixed

- **The tab title is no longer fought over**: on sites that rewrite their title in a loop, PageMask now writes back at a controlled rate; if the site simply won't yield (a timer keeps resetting it), PageMask lets go entirely — the browser stays smooth, no more freezing

## [0.3.0] - 2026-10-28

真实使用一周后的反馈批次：加不进去的网站、只想改标题的网站、向导不好用的地方，以及一个应急能力。/ A batch of fixes and features from a week of real use: sites that could not be added, sites that only needed a new tab title, wizard friction, and one emergency capability.

### 中文

#### 修复

- **新站点授权后直接进入设置向导**：原来点「允许」之后什么都不发生，得再点一次扩展图标（权限确认框会关闭扩展弹窗，后面的步骤没能继续）。现在弹窗只发一条消息，由后台在用户手势里请求权限并接着完成注入与开向导，一次点击即可
- **「已收起 0 项」这类写法**：只想改标题的网站没有任何收起项，现在显示「没有收起任何内容」

#### 新增

- **只想改标签页标题也可以**：popup 新增「设置标题和图标」，直接进管理页把标题、图标填好保存，一个元素都不用收起
- **管理页拆成「网站」与「设置」两个 tab**：网站是已添加网站的列表，点进去是这个网站的设置页（开关、标签页标题、图标、已收起的项、一键清空）；设置里放全局默认标题与导出 / 导入
- **站点设置页**：已收起的项可以删除（5 秒内可撤销），换收起方式与重选元素仍然在页面上做（那里才有上下文）
- **设置向导更顺手**：点选阶段新增「清空」，一步清掉已选；「退出」改叫「取消」，确认框里危险按钮改成红色实底，安全按钮默认聚焦
- **预览清单行内编辑**：每一行直接换收起方式、改名、删除；范围标签显示「同类 3 处」这样的命中数，点一下只收起这一处
- **三种收起方式的界面叫法改为「消失 / 留空 / 盖住」**：消失 = 下面的内容往上补；留空 = 位置留着不动；盖住 = 盖一块和背景同色的板
- **幕布**：一键把整页连同标签页标题一起遮住，再一键回到点击前的样子（原来是什么状态就回什么状态）。没添加过的网站也能用：popup 点「遮住本页」，当场遮住，不留任何配置

#### 工程

- 元素命名改进：文字都在子元素里的容器不再叫「div 元素」
- E2E 覆盖管理页三视图、预览清单、幕布（含未添加站点的一次性脚本）；测试收尾失败不再影响用例结论

### English

#### Fixed

- **Adding a new site now opens the setup wizard right away**: after clicking "Allow" nothing used to happen and you had to click the extension icon again (the permission prompt closes the popup, so the following steps never ran). The popup now only sends a message; the background asks for permission inside the user gesture and then injects and opens the wizard in one go
- **Wording like "0 items hidden"**: a site that only changes its tab title has nothing hidden — it now says "nothing hidden"

#### Added

- **Tab title only is fine**: the popup gains "Set tab title & icon" — open the management page, fill in the title and icon, save, and not a single element is hidden
- **The management page splits into "Sites" and "Settings" tabs**: Sites lists the sites you added; clicking one opens its settings page (switch, tab title, icon, hidden items, reset). Settings holds the default title and export / import
- **Site settings page**: hidden items can be deleted (undo for 5 seconds); changing the hide method and re-picking an element still happen on the page itself, where the context is
- **A smoother wizard**: "Clear" empties your selection in one click; "Exit" is now "Cancel"; the destructive button in the confirmation is solid red and the safe button has focus
- **Inline editing in the preview list**: change the hide method, rename and delete right on each row; the scope label shows how many match ("3 alike"), and one click hides just this one
- **Hide methods are now "Disappear / Keep space / Cover"**: disappear pulls the following content up; keep space leaves the gap; cover puts a sticker the colour of the background over it
- **Curtain**: cover the whole page and the tab title in one click, and go back exactly to what it was before. It works on sites you have not added too — "Cover this page" in the popup covers it on the spot and leaves no configuration behind

#### Engineering

- Better element names: containers whose text lives in child elements no longer become "div element"
- E2E now covers the three management views, the preview list, and the curtain (including the one-shot script for un-added sites); cleanup failures no longer affect the verdict

## [0.2.0] - 2026-10-27

上架前的质量加固：可用性缺陷、无障碍、文档一致性。/ Pre-release quality pass: usability defects, accessibility, documentation consistency.

### 中文

#### 修复

- **遮罩覆盖**：页面后加载的元素会被自动补上遮罩；遮罩颜色取自元素背后的真实底色（深色页面不再刺眼）；页面静止时不再逐帧运行；遮罩下的链接点不到
- **设置向导**：取消某个选择后序号重新编号；改一个元素的方案不会让其它预览标记坍缩；预览标记不再盖住重排上来的内容、也不拦截点击；Esc 分层处理（有浮层只关浮层、退出确认框上 Esc 等于继续编辑）；「继续选择」保留已改的方案；滚动后点击选中的是指针下的元素；工具条默认在底部、可拖动也可用方向键移动
- **编辑规则**：popup 增加「编辑当前网站」入口；「重选元素」取消后旧规则原样保留，保存时在同一次写入里替换；面板跟随存储变化，SPA 换页后规则列表随之更新；高级选择器逐行校验并指出第几行；删除后 5 秒内可撤销；失效规则给出可读说明与「去处理」按钮
- **悬浮按钮**：点菜单项不再误切开关；菜单自动避开视口边缘；按钮可用键盘操作（Tab 聚焦、回车切换）；拖动改用专用把手，触屏不再残留监听；位置贴边保存，窗口变化后仍够得着
- **扩展页面**：开关改为原生 switch 语义；弹窗、管理页、引导页的对比度与深色模式达标；确认框改为原生对话框，焦点进入框内
- **存储**：所有站点配置经统一校验 + 原子更新写入，避免并发覆盖；导入先校验后写入

#### 新增

- 新图标（16 / 32 / 48 / 128），悬浮按钮使用配套单色图标
- 默认标签页标题「阅读」/ "Reading"、默认透明图标；管理页提供常用标签页标题快捷选择
- manifest 多语言（英文默认 + 简体中文），最低支持 Chrome 116
- 设计 tokens 与自动对比度测试；界面统一使用 tokens
- 内容脚本宿主隔离：页面样式（含 `!important`）压不到插件界面；扩展更新后新实例接管旧页面
- 站点生命周期对账：撤销授权后显示「待授权」并可重新授权；一键清空时已打开页面立即还原
- 首次安装的四步引导页

#### 工程

- CI、打包门禁（`npm run check:package`）、第三方组件声明、SECURITY.md
- 依赖锁定精确版本；可移植 E2E（Chrome for Testing），覆盖主流程与各界面专项

### English

#### Fixed

- **Cover**: elements inserted after page load get covered automatically; the cover color is taken from the real background behind the element (no more glare on dark pages); nothing runs per frame while the page is still; links under a cover are not clickable
- **Setup wizard**: badge numbers renumber after unselecting; changing one element's method no longer collapses other preview markers; markers no longer cover reflowed content or block clicks; Esc is handled by layer (only the open overlay closes; Esc on the exit dialog means keep editing); "continue selecting" keeps your adjustments; after scrolling, a click selects the element under the pointer; the toolbar sits at the bottom by default, can be dragged or moved with arrow keys
- **Edit rules**: the popup gains an "Edit this site" entry; "re-pick element" keeps the old rule if you cancel, and replaces it in the same write when you save; the panel follows storage changes and updates its rule list after SPA navigation; the advanced selector backdoor validates line by line and names the failing line; deletions can be undone for 5 seconds; broken rules show a readable explanation with a "fix it" button
- **Floating button**: clicking a menu item no longer flips the switch; the menu stays inside the viewport; the button is keyboard operable (Tab to focus, Enter to toggle); dragging uses a dedicated handle and leaves no listeners behind on touch; the position is saved against the nearest edge and stays reachable after resizing
- **Extension pages**: the switch uses native switch semantics; contrast and dark mode meet the thresholds on the popup, management and onboarding pages; confirmations are native dialogs with focus moved inside
- **Storage**: every site profile is written through a single validator and atomic updates, avoiding lost updates; imports are validated before writing

#### Added

- New icons (16 / 32 / 48 / 128), with a matching monochrome icon for the floating button
- Default tab title "Reading" (「阅读」) and a transparent default icon; quick title presets in the management page
- Localized manifest (English default + Simplified Chinese), minimum Chrome 116
- Design tokens with automated contrast tests; the UI uses tokens throughout
- Host isolation: page styles (including `!important`) cannot reach PageMask UI; after an extension update a new instance takes over open pages
- Site lifecycle reconciliation: a revoked site shows "pending" and can be re-authorized; resetting a site reverts open pages immediately
- Four-step first-run onboarding

#### Engineering

- CI, a packaging gate (`npm run check:package`), third-party notices, SECURITY.md
- Dependencies pinned to exact versions; portable E2E (Chrome for Testing) covering the main flow and each UI area

## [0.1.0] - 2026-10-26

首个功能完整版本。/ First functional release.

### 中文

- 按网站生效：仅用户主动添加的网站生效，未配置网站零注入、零影响
- 点选向导：悬停高亮、连续多选、选大/选小调整层级、整页防呆提示、Esc 二次确认
- 三种收起方式：彻底移除 / 原地留白 / 遮罩覆盖，预览期可随时切换
- 收起规则：多候选选择器（语义属性优先，过滤构建工具生成的类名），生效范围零输入（整站 / 仅这类 / 排除这类）
- 标签页标题与图标：可设置自定义标题与图标，网站动态改写标题时自动改回
- 每网站开关：页面内悬浮按钮（可拖动、记住位置），同站多标签页联动，状态按网站记忆
- 页面内编辑面板：当前页面规则列表、换方案/改范围即时生效、删除、重选、高级选择器后门（保存前必须现场命中）
- 管理页：全站总览、标签页标题/图标设置、失效状态、一键清空（二次确认）、导出/导入（合并或整体替换）
- 失效体检：仅在清爽态采集，用人话提醒
- 首次安装引导
- 隐私：配置只存在本机，PageMask 自身不发起网络请求，权限最小化（按网站的可选主机权限）

### English

- Works per site: only user-added sites are affected; zero injection elsewhere
- Pick wizard: hover highlight, multi-select, bigger/smaller level adjustment, whole-page guard, Esc double-confirm
- Three hiding methods: remove / blank-in-place / cover, switchable during preview
- Hide rules: multi-candidate selectors (semantic attributes first, build-tool generated class names filtered), zero-typing scope (whole site / only these pages / except these pages)
- Tab title & icon: custom title and icon per site; titles rewritten by the site are changed back automatically
- Per-site switch: an on-page floating button (draggable, remembers its position); all tabs of a site switch together; state remembered per site
- On-page editor panel: rule list for the current page, live method/scope changes, delete, re-pick, advanced raw-selector backdoor (must match live before saving)
- Management page: all-sites overview, tab title/icon settings, health state, one-click reset with confirmation, export/import (merge or replace)
- Rule health check: collected in clean mode only, plain-language notices
- First-run onboarding
- Privacy: settings stay on your device, PageMask itself makes no network requests, minimal permissions (per-site optional host permissions)

[0.4.0]: https://github.com/cherishfall/page-mask/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cherishfall/page-mask/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cherishfall/page-mask/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cherishfall/page-mask/releases/tag/v0.1.0
