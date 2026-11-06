# 开发日志（DEVLOG）

按时间倒序记录开发过程中的关键事件、超出 `docs/design.md` 范围的临时决策及其理由。正式的架构决策写 `docs/adr/`，这里只记过程。

## 0.6.4 批次（2026-11-06，spec #117 / 子票 #118–#122）

0.6.3 装机后产品所有者集中报五件事，全部落成票、一票一提交一推送。四张由我实现，图标三态派子代理后由我逐处复核、补三条 E2E 并改了它的一处收尾写法。

- **#118 浮层边界**：根子不是「白」，是边界不存在——`.pm-wiz-toolbar` 与 `.pm-wiz-dialog` 没有 border，只靠 `--pm-shadow-overlay` 里那圈 6% 黑的环（白底 1.14:1、深色 1.28:1）。改成三层阴影 + `--pm-border-overlay`（浅 1.69 / 深 1.92），并删掉环。**画边必须用 border 不能用 box-shadow**：`forced-colors` 下阴影会被浏览器丢弃，那时面板与页面同色、彻底无边。
- **#119 整条标题栏可拖**：事件上移到 `.pm-wiz-head`，`closest()` 排除 `button:not(.pm-wiz-handle)`；把手 24→32（触屏 44）。胶囊把手明确不动（常驻、低调优先）。
- **#120 菜单直达不透明度**：内容脚本调不到 `openOptionsPage`，新增 `openSettings` 消息由后台 `tabs.create`；`tabs.create` 不需要 `tabs` 权限。设置页加 `#opacity` 深链，焦点落滑杆、描边高亮（不只靠颜色）。
- **#121 图标三态**：`icon: {kind}` 取代 `faviconDataUrl`；`defaultIconDataUrl` 与整条上传管线一起删。**最大的坑是 guard 的 `null` 语义**——原来 `apply(title, null)` 表示「空白」，改成「不接管图标」后，任何漏改的调用点都会从空白变成露出网站真图标；幕布四条路径单独钉死为透明图。子代理原本在 `hideCurtain` 里先写透明图、再由调用方补一次真图标，我改成一次性写入该站自己那一态（少一次 DOM 写，也不依赖调用方记得补）。
- **#122 README**：未打包扩展按加载目录的绝对路径认身份，换目录 = 新扩展 = 空存储；点「移除」也一定清空。文档写清「固定目录覆盖 + 刷新」，并给用扩展 ID 核对身份的方法。
- **验收纪律重申**：子代理说完成不等于落地。这次它没跑成 E2E（Chrome 起不来），我自己重跑八个脚本共 811 项 + 深浅色；`grep` 残留字段；补了三条幕布×图标的断言（不接管站点图标 / 遮住固定空白 / 撤掉后回来）。

## 发版后深度审查循环收敛（2026-11-06，三轮 + 0.6.2 / 0.6.3）

按用户授权跑「审查 → 修 → patch+1 → 发版」循环，三轮后收敛。每轮都由**独立子代理**执行（主会话只做取舍与修复），对象是上一轮的产物——包括修复本身：

- **第一轮（0.6.2，#114）**：代码复查（全量 diff）+ Web Interface Guidelines 逐条审计 + 真站冒烟。抓到 2 个真 bug（删除确认框 returnValue 不复位 → 失败后 Esc 跳过确认再删一次；oneshot 退位不复位 pending → 整个标签页遮住功能静默失效）、3 个竞态、8 条指南违规。**真站冒烟的「失败」是过期断言**（脚本比 #98 旧，还在断言「只收内容也改标题」）——先查实现再信报告。
- **第二轮（0.6.3，#115）**：专审第一轮修复的 diff，抓到 10 处：修复没修全（autocomplete 只落了两处）、修复引入视觉回归（链接默认蓝字盖过按钮字色）、假失败竞态（coverPage 回查撞上 oneshot 动态导入）、丢遮窗口（adopt 只看 state() 会漏「遮住进行中」）等。**教训：修复本身也是新代码，必须有第二轮新眼睛。**
- **第三轮（同 0.6.3）**：专审第二轮修复，7 个重点全过，唯一残留（毫秒级应答窗口）一行修掉，结论「可以收敛」。

**循环收敛判据**：当一轮审查的发现只剩「上轮修复的毫秒级收口」且明确写「可以收敛」时，停。继续循环只会烧 token 复述已知问题。

**方法沉淀**：①子代理审 diff、主会话做取舍与修复，主会话上下文不被代码细节淹没；②每轮审查对象是上一轮的输出（含修复），不是永远同一个原始 diff；③审查员的「拒绝清单」要先核对再动手（三轮里两条「必修」实为误报/既有设计）。

## 0.6.1 发版记录（2026-11-06）

第二批装机反馈（#106 / #107–#113）七张票一晚收口，过程要点：

- **applyKey 漏了 capsuleHidden**（#112 实测抓到）：「不显示胶囊」改变的是按钮的存在性，响应式更新救不了——它不在「要不要整页重应用」的判据里时，存储变化后 refreshState 在「键没变」处提前返回，胶囊永远卸不掉。教训：**改「存在性」的字段必须进 applyKey**，响应式只救「属性变化」。
- **v-for 内的模板 ref 是数组**（#113 实测抓到）：行尾菜单的 `ref="menuEl"` 拿到的是 `[div]`，`showPopover is not a function`。改成函数 ref，源码留注释。
- **两个监听器都动手 = toggle 互相抵消**（#107）：`tabs.sendMessage` 只取第一个**回复**，不阻止其他监听器**执行动作**。「登记者应答、另一方静默退位」是唯一安全的规则。
- 视觉巡检：发版关全量 21 张（`docs/dev/evidence/0.6.1/`），两位「新眼睛」只看图审一轮；商店素材 6 张 + 宣传图块重拍（新胶囊尺寸、弹窗新布局、列表 ⋯ 菜单）。
- 版本口径：0.5.5 → **0.6.1**（0.6.0 是装机版、无 tag、不补发）；CHANGELOG 两节中英逐条对应。

## #107 幕布唯一控制器：两条实测出的坑（2026-11-06）

实现 ADR-0011 时，方案里没写、靠真实浏览器跑出来的两个坑：

- **「登记者应答」是硬约束，不是优化**。第一版让一次性脚本的监听「每条消息现读登记处、委托给当前控制器」，意图是接管后仍能应答。实测：内容脚本接管登记处后，两个监听器都活着、都动手——同一条 `curtainToggle` 各跑一遍（内容脚本遮上，一次性脚本又切回去），回复还是第二个监听器的「遮上了」。`tabs.sendMessage` 只取第一个**回复**，不阻止其他监听器**执行动作**；唯一安全的规则是谁登记谁应答，另一方静默退位（不占回复通道）。
- **「回复动作后的状态」要求 toggle 把异步交出去**。一次性脚本的 `cover` 要先读存储（异步）；`toggle` 里 `void cover()` 会让回复在遮完之前就发出（`covered:false`），后台以为没遮上。修法：`toggle` 返回 cover 的 promise，监听器 `await` 后再回复。内容脚本的 toggle 是同步的，不受影响。

另：内容脚本在**没有站点配置**时不占幕布消息的回复通道（遮不了页就别承认自己是接收方），否则站点刚删除后注入的一次性脚本会与它报告矛盾状态。同文档「先一次性脚本、后内容脚本」的让位接管会**保留遮住状态**（撤旧层、登记自己、接着遮）——比交接文档定的「只要求一层」多走了一步，理由：用户遮着页面时启用站点，幕布不该消失；E2E `check-curtain-state.mjs` 已覆盖此场景（44 项断言，全绿）。

## #104 图标：一副歪着放在纸上的面具（2026-11-05）

这轮改了十版，值得记的不是结果，是**每一版为什么会死**：

- **“白页 + 横带”永远读成字母 B**（两块白色 + 一条横线），换成角上盖、斜切、缺口都只是在 B / 折角 / 书签之间换。主体是“页面”时，横切构图的宿命。
- **眼罩一旦开眼洞就像“被看着”**；一旦封死就退回蝴蝶结 / 色带。A2 之所以“酷”，恰恰是眼洞给的——这是题材的硬约束，不是调色能救的。
- **倾斜是折中**：把眼罩歪 10°、偏向左上、一角探出纸边，它从“一张正对着你的脸”变成“摘下来放在纸上的物件”，眼洞保留但“被盯”的感觉弱了。
- **白页必须有内容行**：只有纸和眼罩时，眼罩会读成无限符号；加上下方两行灰线，白纸才成立为“一页纸”，眼罩才成立为“面具”。16px 也要留一行，否则退回色带。
- **16px 单独画**：眼罩加厚、眼洞改成 2px 方点（圆点会糊）、倾斜收到 10°、只留一行内容。128 的图缩到 16 会变成一条模糊的斜带。
- 顺手让 `scripts/gen-icons.mjs` 支持 `CHROME_ARGS`（沙箱 / CI 里要 `--no-sandbox`），此前只有 E2E 的 launcher 认这个变量。

## #103 欢迎页改用真实组件：拆弹窗、三步三功能（2026-11-05）

- **手抄必然过期**：第 2 步的弹窗是照着画的假图（开关 vs 按钮、缺域名与状态说明、胶囊形按钮），0.5.5 的弹窗改了以后它立刻说错话。修法不是重画，而是把 `entrypoints/popup/App.vue` 拆成 `ui/popup/PopupBody.vue`（纯 props/emit）+ 取数容器，欢迎页直接 import 同一个组件。
- **拆分的关键约束**：`browser.*`、存储监听、状态机全部留在容器里；`data-testid` 原样保留，现有 E2E 一条不用改。
- **胶囊复用**要解决两件事：样式平时走 shadow root（`toggle.css?inline`），所以在扩展页面里注入一次（`ui/toggle/preview-style.ts`）；`position: fixed` 由 `preview` 模式改成 `static`，并禁用拖动。
- **示意图能看不能点**：外层 `inert` + `aria-hidden="true"`。副产品：欢迎页因此有三个 `<h1>`（弹窗预览里的 logo），E2E 的「只有一个 h1」改为忽略 aria-hidden 子树——装饰性嵌入不该算页面标题。
- **内容砍到三步**：固定到工具栏 / 三件事 / 小按钮。删掉「收起内容分两步」——欢迎页只回答「能做什么、在哪儿点」，操作细节由向导自己教。
- 加了源码级守卫：欢迎页必须 import 这两个组件，旧假图的类名（`ap-btn` / `ap-switch` / `ap-foot`）不许再出现。

## #102 胶囊不透明度三档（2026-11-05）

- **为什么不是滑块**：滑块会被调到一个谁也复现不了的中间值，想回默认还得靠感觉；三档足够表达「太扎眼」。数值 100% / 85% / 70%，按 tokens 浅色值实算最差文字对比度 15.8 / 9.8 / 5.9，三档都 ≥4.5。
- **边框跌破 3:1 是已知例外**：整颗元素降透明度时，边框相对页面底色的对比必然下降；不降文字、只降底色又会在深色页上变成「深字压深底」。权衡后选择整体降、文字优先保底，并把例外登记在 `styles/tokens.css`。悬停 / 键盘聚焦 / 拖动立刻回到 100%，「淡」只在闲置时存在。
- **强制颜色模式回到 100%**：高对比度用户不该再被压一层透明度。
- **预览用真实组件**：设置页里注入同一份 `toggle.css`，渲染 `FloatingToggle` 的 `preview` 模式（`position: static`、不可拖），外面套 `inert` + `aria-hidden`。预览与真机不会走样——这也是欢迎页那张票要复用的机制。
- 只作用于胶囊；幕布上的「恢复」按钮固定 85%，是遮住后唯一的回家路，不跟随这个设置。

## #101 幕布快捷键：推翻「永不做快捷键」，只开一个口子（2026-11-05）

`design.md` 的「永不做」第一行被推翻了，所以先补 ADR-0010 再写代码。执行时值得记的几点：

- **Chrome 的硬规则**：必须带 Ctrl / Alt（Mac 上是 Command），做不到单键；一个扩展最多 4 个预设键；组合被占时**静默不绑定**，所以设置页必须显示「当前实际绑定」而不是写死默认值；改键只能去 `chrome://extensions/shortcuts`，没有 API。
- **快捷键会授予 activeTab**（Chrome 文档明确列出「commands 快捷键」是用户手势之一）：于是没添加过的网站也能遮，一次注入 `curtain-oneshot.js` 即可。这条让快捷键比「打开弹窗再点遮住」在陌生网站上更可用。
- **命令处理必须有返回 Promise 的监听器**：`commands.onCommand` 的回调同步返回后 Chrome 不管，但单测要等异步分支跑完；让监听器 `return toggleCurtainByShortcut()`，生产无副作用、测试可 await。
- **失败反馈不用通知、不加权限**：`chrome://` 等不能注入的页面，用按标签页的 `!` 角标 + `action.setTitle` 说明原因，3 秒后自己清掉。3 秒定时器在 SW 空闲回收（30 秒量级）之内，不会被截断。
- **测试边界**：CDP 只能发页面级按键，浏览器级快捷键在自动化里触发不了。命令的三条分支（撤 / 遮 / 注入）与不支持页面走 fake browser 单测；真机手测写进验收，交付时不谎报「已自动化验证」。
- 避免与既有断言打架：弹窗按钮里多了一个 `<kbd>`，`textContent` 会带上键位，E2E 改为读 `.popup-cover-label`——按钮的可见文字与快捷键提示从此各自有稳定的锚点。

## #100 同类组统一描边：删掉 1.1 / 1.2 子号牌（2026-11-05）

0.5.5 的「小组挂子号牌、大组画描边」被用户当场识别成 bug（「有的有编号、有的没有」）。复盘时确认它还是个**假承诺**：子号牌长得像清单里的一项，但点它只是跳到同一条规则的行，不能单独操作。

- 小组与大组本来就都画了描边（`pushPageCss` 对所有勾选的组都注入 outline，只是小组上又叠了牌子），所以这次是**纯减法**：删掉 `sameGroupMembers` / `addSubBadge` / `SAME_SUB_BADGE_LIMIT`，标记语言收敛成「号码牌 = 清单里的一项；描边 = 这一组跟着一起收起」。
- 描边从 `rgb(37 99 235 / 0.4)` 提到 `rgb(59 130 246 / 0.9)`：它成了成员唯一的标记，原来那个透明度在深色页面上几乎看不见；颜色仍用蓝色虚线，与主选中框的橙色实线区分层级。
- 子号牌还兼任「勾上后滚到哪里」的定位目标，删掉后换成 `firstSameGroupMember()`（按候选查第一个非自身成员，只为滚动，不建 DOM）。
- 测试留了回归守卫：E2E 断言页面上 `pm-sub-badge-*` 数量必须为 0，防止以后又长回来。

## #98 标题与图标：只改「保存过」的网站（2026-11-05）

0.5.5 装机后用户报「只设了收起规则，标签页标题却被改成『阅读』」。查下来不是渲染 bug，是**模型缺一个概念**：

- 旧模型里「没设过标题」和「设了但留空」都存成 `null`，而取值链总要兜底到「插件默认 / 语言默认」。这条兜底在 0.5.0 之前成立（标题是向导第一步，每个网站都必然经过）；#81 把两条流程拆开后，「只收起内容」的网站成了新状态，兜底就把没设置过的东西改掉了。**流程拆分改变了「空值」的含义，却没改数据模型**——这是整批反馈里最值得记的一条。
- 修法：`SiteProfile.titleIconSet` 把「保存过」变成显式事实；清爽态只在为真时 `guard.apply`，为假时显式 `guard.restore`（之前可能压过）。旧数据按 `!!(disguisedTitle || faviconDataUrl)` 推导——只有那条流程会写这两个字段，所以推断对 0.5.x 存量是准确的。
- 写入点有三处，缺一处就会「保存了却不生效」：向导 `titleOnlyPatch`、管理页标题自动保存、管理页图标上传。用 `grep titleOnlyPatch / disguisedTitle` 把所有写入路径列出来逐个补，比事后按症状修便宜。
- **连带语义变化**：全局「默认标题 / 默认图标」不再自动套到所有网站，只剩两处用途——打开表单时的预填值、遮住整页时的标题与图标。设置页的两段说明同步改写，否则界面在骗人。
- **应用键**：`core/apply-key.ts` 要带上 `titleIconSet`，否则「刚点完保存」不会触发整页重应用（标题要等下一次存储变化才生效）。
- E2E 的两处写法随之调整：`run-e2e` 的种子配置显式 `titleIconSet: true`（它要验证标题补刀与 SPA 翻页重压）；「新站点只保存收起内容」的断言从「标题变成默认」改成「标题保持原样」，并顺带验证「标记翻转 → 标题立刻压上去」。
- **#99 补了出口**：保存过之后要能回到「没设置过」，否则误点一次保存就只能删整个网站。`titleIconResetPatch()` 只动 `titleIconSet / disguisedTitle / faviconDataUrl` 三个字段，向导表单与站点设置页共用；向导侧走 `finish(true, notice)`，收回预览、关面板、给一句提示。

## #81 拆开向导：两条独立流程、无首次模式（2026-11-04）

「收起内容」与「标题和图标」本是两件事（填两个字段 vs 在页面上点选），却共用一个三步壳，「只改标题，完成」是小表单被套进长流程后的逃生门。本次拆开，值得留痕的结构取舍：

- **点选阶段旧项全互动是本次最大的语义变更**：已收起的项不再用「之前收起了」虚线角标标记，而是直接进选择集——与新选的统一编号、进同一份清单。点它 = 取消（草稿一并去掉，等同清单 ✕）；再点 = 按默认值当新的一项加回。原 `onPickBefore` 的「原地替换」手势退场——一个手势只许一个意思。失效行的「重新选」保留，但实现从回调改到 `onSelectionChange` 里检测「新加进来的元素」，重选后的元素留在选择集（草稿已带着它，不会被当成新项重复建）。
- **「选大一点」对旧项需要同步草稿**：`replaceInSelection` 原位换元素只动选择集，旧项草稿的 el / 候选不会自己跟。`adjust()` 里在调整前抓快照：正常替换走 `replaceDraftElement`；「选大成已选中的另一项」等价取消，草稿交给 `onSelectionChange` 的 removed 分支删——两条路径不重叠，靠 `selBefore.includes(next)` 区分。
- **保存路径合流**：原来 `newSite` 纯追加、编辑模式走 `mergeSavedRules`；无首次模式后只剩一条路——`mergeSavedRules` + 空 `editIds`（空数组与 null 在删除语义上等价，纯追加自然成立）。新站点「收起内容」保存只写规则 + 开清爽，**不写标题**（标题属「标题和图标」流程，两流程各管各的字段）。
- **`isDirty` 靠基线快照**：旧项打开时就在选择集里，`selEls.length > 0` 不再是 dirty 证据。打开时记 `baselineDrafts` 签名，无改动时退出不弹确认框（check-toggle 的既有断言得以保留）；「还没进过看效果的新选」用「选择集里存在草稿之外的元素」补判。
- **弹窗权限请求的入口变宽**：新站点现在两颗按钮都要先请权限（`requestPermission: !profile`），「标题和图标」在新站点上也走 `enableSite` + `open: 'editTitle'`（写配置必须先注入内容脚本）。

## 0.5.0 收尾批次（#75–#78，2026-11-04）

用户睡前的六条反馈，一晚三票全落地（行内整理 / 三口归一 / 胶囊 mini）。值得留痕的：

- **「同类」默认从「一起收」翻成「只收这一个」暴露了一个隐藏缺陷**：captureBaseRects 只量候选命中的元素——默认一起收时「另外几个」恰好在候选里所以总能量到；默认只收一个后它们不在候选里，勾选的一瞬间元素已被预览移除、虚线框失去定位。修法是把「一起收会带上的元素」也量进缓存。教训：**改默认值等于改前置条件，要把依赖这个默认的隐式链路全部重走一遍**。
- **editTitle 的「只改标题，完成」不能顺手打开清爽**：titleOnlyPatch 原本固定 switchState: disguised（newSite 语义）。三口归一后同一个按钮服务两种入口，改为 keepState 参数——同一个控件长出第二种语义时，把「各语义下的正确行为」列成表再动手。
- **run-e2e 的主流程断言改成相对计数**（点一下 +1 而不是写死数字）：种子规则让「已选 N 个」不再是固定值，写死的数字每加一个入口就碎一次。
- **沙箱对同一条命令的重跑假象**贯穿整晚：每个写文件脚本都先 `grep` 确认落盘再继续，被 traceback 吓到时先读文件再决定重放。


## 0.5.0 · #74 补漏：同一类问题只修了「最先看到的那一处」（2026-11-04）

用户复查 0.5.0 构建后发现四处漏网（详见 #74），全部是**同类问题的其它入口**：弹窗底部入口（#65 只提了高度没换样式，验收漏了）、标题小面板的裸 ✕、首次引导页的「上一步」、「收起更多内容」不标已收起的项。

教训两条：

1. **修一类的自查不能只对着 commit message**。#65 的提交正文写了「四档按钮」，但弹窗底部那两个按钮实际只动了高度；自查时要回到代码/界面逐处核对，把「哪些位置同类、各自怎么改」真的列出来，而不是复述意图。
2. **改动跨入口的功能（如标记已收起项）要把每个入口的路径都走一遍再关票**。#69 只验了「编辑收起的内容」入口，「收起更多内容」这条平行路径上同样的用户诉求没被覆盖，E2E 也只写了前者的断言。

工具记录：沙箱执行偶尔会对同一条命令重跑一遍（第一次尝试的输出被丢弃），**写文件的脚本可能实际执行了两次**——补丁类脚本 `assert old in s` 会在第二次因找不到 old 而报 AssertionError，看到 traceback 先读文件确认再重试，不要盲目重放补丁。

## 0.5.0 · #72 可达性与禁用态（2026-11-03）

按 `docs/dev/ui-ux-audit.md` 的第 2、3、7、10 条修一整类问题，顺手在全项目扫同类位置。

- **命中区**：胶囊的把手 / 遮住 / ⋯ 原来是 16 / 22 / 22 宽，现在是 `min-inline-size: 24px; min-block-size: 24px`（触屏 `pointer: coarse` 下 40×40），图标本体不动（把手 10×16、遮住 13、⋯ 13px 的字）。胶囊总宽 133 → 145、高度仍是 32，右下角定位与拖动落库都没变（E2E 断言 right / bottom 与改前一致）。
- **把手字符换 SVG**：原来用点阵字符 `⠿`，各平台字形大小不一，还得把字号压到 10px 才放得下。改成 6 个点的 inline SVG，字号问题随之消失。
- **禁用态（审计里明确要改的做法）**：先把「处理期间禁用」全部改成「可点但忽略重复点击，状态由按钮文字说」——弹窗的开关与四个按钮、站点设置页的开关。守卫放在处理函数的第一句（`busy` / `toggling`），关掉时把控件拨回存储里的状态。只留下一处真禁用：站点设置页「在页面上编辑」在待授权时不可点，原因写在按钮下面那一行（`management.editNeedAccess`）。
- **审计范围**（全项目的 disabled）：弹窗 5 处、站点设置页 3 处（开关 / 图标文件框 / 在页面上编辑）、插件设置页 1 处（图标文件框）、`TitleIconFields` 1 处（图标文件框）、向导 6 处。判断标准——**按钮文字自己变成进行时 / 带计数 / 旁边已有一行说明**的算合规：向导全部（「正在保存…」「看效果（0）」「同类一起不可选」旁边有说明）、三处图标文件框（label 文字变「正在处理…」）。其余改掉。
- **异常标记统一**：新增 `styles/marks.css`（`.pm-mark` + `.pm-mark-warning` / `.pm-mark-danger`，圆点在文字前、6px、`currentColor`），替换掉 `base.css` 的 `.badge` 描边徽标与散在四处的 `● ` 字符。落点：弹窗、管理页列表行、站点设置页（状态行 / 待授权块 / 收起项行）、编辑面板。
- **测试**：单测 `tests/font-size.test.ts` 扫全项目样式里的 `font-size`，小于 12px 直接红；E2E 补命中尺寸（含 `Emulation.setTouchEmulationEnabled` 模拟触屏量 40×40）、胶囊与编辑面板的最小字号、两种标记的结构与颜色（弹窗、列表行、编辑面板）。`check-pages` 原来断言「处理中按钮 disabled」的两条改成「文字变进行时 + 再点一次不发请求」。
- **留痕**：`docs/design-ui.md` §二 补第 5 条（异常标记只有一种样子），审计文档标注第 2/3/7/10 条已修。

## 0.4.1 · 只说人话：全界面文案重写（2026-11-02）

起因是弹窗那一屏「为当前网站开启清爽模式 + 开启后 PageMask 才会处理它」看不懂。按「修一类，不是修一个」把它归成**一类问题**再全项目扫：

- **三类毛病**：① 自造名词当解释（清爽模式、号码牌、小胶囊）；② 空转的动作描述（处理它、编辑当前网站、授权并启用、去处理）；③ 同一概念两套叫法（「在哪些页面收起」vs「生效范围」、「管理全部网站」vs「你添加的网站」、「快捷填入」vs「快捷标题」、「重新选」vs「重新选一次」）。
- **审计范围**：`core/i18n/messages.zh.ts` / `messages.en.ts` 全量逐条过（454/419 行）、`public/_locales/*/messages.json`（扩展名/简介/工具栏提示）、`GLOSSARY.md`、`docs/design.md` 界面清单、`README.md`、`CHROMEWEBSTORE.md`、`tests/e2e/store-shots.mjs` 的拼版字幕。**组件里没有写死中文**（早先 #57 已收口），所以改文案只动两个文件。
- **命名决定**（用户拍板）：两态改叫「按你的设置显示 / 网站原样」，「清爽」只留在扩展名与内部文档（选项 A：保留识别度，但不拿它当唯一解释）；技术词一律换成「允许访问 / 收起设置 / 起作用」；按钮落到动词（设置这个网站、编辑收起的内容、遮住这一页）。
- **顺手修掉的真问题**：① 「已收起 N 项」在网站显示原样时是假话 → 改中性的「N 项收起设置」；② 失效提示的「最近在整站没找到目标」不成句 → 改成「在哪些页面收起：整个网站」，并删掉只有一处用的 `scopeShort/scopeLabel`，全项目只留 `scopeHumanLabel`；③ 插件设置页的标签页标题一直写死中文（`initUiLanguage()` 没传 title）。
- **文案改动会打到测试**：单测与 E2E 里有 ~20 处写死中文的断言。处理原则——**能改成「语义断言」的就改语义**（语言用例改成「有没有中文字符」而不是「是不是某一个词」；toggle 主按钮改用 `data-testid` 定位，不再靠 `title^="PageMask"`），确实要锁文案的改成从 `t()` 取值。
- **E2E 里挖出一个真竞态**（与文案无关，已顺手修测试）：删除确认框按 Esc 关闭后，元素要等 Vue 下一帧才移除；用例只看 `:modal` 就返回，紧接着第二次「⋯ → 删除」时 `deleteOpen` 仍为 true，`v-if` 不会重新挂载 → 确认框不出现。把等待条件改成「元素真的从 DOM 消失」。两次连跑稳定。
- **门禁**：单测 573 项、E2E（run-e2e 103 / pages 184 / toggle 121 / wizard 129 / mask 16 / editor 20 / language 27）、`check:docs`、`check:package` 全绿；产物 `.output/page-mask-0.4.1-chrome.zip`（27 文件 / 192 KB）。
- **扩展改名**（用户当日决定）：`PageMask · 页面清爽模式` → `PageMask · 收起网页上不想看的部分`，英文 `Clean & Focused Pages` → `Hide the Parts You Don't Want`。理由：界面上 0.4.1 起不再出现「清爽模式」，名字再挂着它就成了唯一一处要用户先学会的词；未上架商店，换名字零成本。`package.json` 升到 0.4.2 承接这次改名。

## 0.4.0 · #48 十张票收尾（2026-10-30）

- **节奏**：串行做完 10 张子票，一张一 commit；#58 文档票由两个会话接力完成。全部 574 项单测 + 600 项 E2E 断言 + 打包门禁全绿。
- **顺手但必要的两处跨票统一**：#53 之后把「选内容/看效果」两处清单的删除按钮合成一套外观（`ea12522`）；插件设置页「导出配置」改叫「导出全部设置」（`934fb86`）——文案禁用词「配置」是发布前扫描抓出来的。
- **check-mask 偶发 `Runtime.callFunctionOn` 超时**：本批至少 4 次，全部是单跑复跑即过的 CDP 抖动，无一例复现失败；集中在 puppeteer evaluate 竞态，与产品代码无关。
- **i18n 架构**（#57）：自写 `core/i18n` 文案表，不引 vue-i18n；中英键集合一致性用单测锁死（递归比较键 + 函数签名），漏翻会直接红。兜底标题「阅读」刻意跟浏览器语言而不跟界面语言开关。
- **E2E 仍绕不开 activeTab**：面板「未添加网站遮住整页」的真实路径（点工具栏图标）无法自动化，`chrome.action.openPopup()` 不授予 activeTab；E2E 用预授权替代路径覆盖，真机留人工确认（HANDOFF 已记）。
- **已知取舍**（用户确认过，别当缺陷修）：向导第 2 步面板 308→412px（清单化的代价，清单限高、工具条可拖）；点选元素只能指针操作（键盘遍历是另一套交互模型）；站点设置页导出包含插件设置。
- **遗留观察**：进入点选阶段的第一次 pointerdown 偶尔不生效（store-shots 自动化里发现，重试即成功）。不影响测试与功能；若将来有用户反馈「第一次点击没反应」，从 `ui/wizard/pick-controller.ts` 的层挂载时序查起。
- **流程教训**：做完 8 张票忘了关 issue，被用户纠正后立规矩——HANDOFF「做一个关一个」，收尾评论必带 commit。

## 0.3.0 · #46 幕布：没添加过的网站

- **一次性脚本 `entrypoints/curtain-oneshot.ts`**（`defineUnlistedScript`）：产物在扩展根 `curtain-oneshot.js`，**不进 manifest**、不注册、不写配置，由 popup 发消息、后台用 `activeTab` 注入当前标签页。幂等要**同步**判——脚本主体要动态导入模块，两次注入可能同批到达，只靠「已经遮住了」会放过第二次，所以先占位（`__pagemaskCurtainPending`）再换成真正的句柄。
- 动态导入是必须的：WXT 构建期会读入口定义，顶层引入会把 Vue 单文件组件与 `?inline` 样式拉进那个环境（`entrypoints/content.ts` 记过这个坑）。
- 与 #45 共用 `ui/curtain.ts` 覆盖层、`core/curtain.ts` 底色、`core/disguise.ts` 标题守卫；`createPageHost` 支持 `ctx = null`（一次性脚本没有 WXT ctx）。
- **E2E 绕不开 activeTab**：`chrome.action.openPopup()` 不授予 activeTab（`tests/e2e/lib/extension.mjs` 的注释里记过），所以用例直接从控制页 `scripting.executeScript` 注入脚本本体；「popup 点击」那一步留人工验证。

## 0.3.0 · #45 幕布（已添加站点）

- 幕布是**页面内临时状态**：不进 `SiteProfile`、不改 `switchState`、只作用于当前标签页（ADR-0007）。
- **恢复分支最容易写错**：进入前是清爽态就还原成清爽标题（`guard.apply(effectiveTitle(...))`），只有进入前是原样态才 `guard.restore()`。一律 restore 会让清爽态当场露馅。
- 生命周期要显式接进 `applyAll` / `restoreAll`（它们会重新调 `guard`，把幕布的标题盖掉）、`openWizard`、`openEditorPanel`、`handleSiteReset`、`clearPageUi` / `teardown`。
- 幕布期间开关被别处改掉时，点「恢复」先按进入前分支执行，再强制重应用一次对齐最新开关态。
- 已知边角：bfcache 后退返回时文档连 JS 状态一起恢复，幕布会保持遮住；要「离开即撤」可在 `pageshow.persisted` 补一刀。

## 0.3.0 · #43 点选工具条与危险色

- 「退出」改叫「取消」：它实际是放弃这次设置，不是退出点选模式。确认框标题「放弃这些设置？」，默认焦点在「继续编辑」，「放弃」实底红。
- 新增「清空（N）」：一次去掉全部已选、留在点选模式。
- 危险色收敛成两条：行内次级 = 红字红边，确认框主危险 = 实底红；向导、编辑面板、管理页三处统一。

## 0.3.0 · #42 只想改标题

- **不在向导里加逃生口**：向导的语义是「进入全屏点选」，而且里面根本没有标题输入，放开 0 条也只存得下默认标题。改走管理页的「待添加」页。
- 路由用 `#/add/<encodeURIComponent(origin)>` 而不是给 `#/sites/<host>` 加参数：新建配置需要完整来源（http / https 看 host 看不出来），`#/add/` 把「这个网站还不在名单里」直接写在地址上。
- 「添加这个网站」是新站点唯一落库的路径：在**普通标签页**里请求权限（popup 会被权限框销毁），写一份 0 条规则的配置（清爽态、标题取输入值或全局默认）。

## 0.3.0 · #39 权限请求改由后台发起

- 根因：popup 里 `await permissions.request`，权限框弹出会销毁 popup 文档，`await` 之后的 `enableSite` 从未发出；第二次点击能进只是因为权限已在、promise 立即返回。
- 修法：popup 只发消息，后台 `onMessage` 监听器里**第一句**同步调 `permissions.request`——用户手势可跨 `runtime.sendMessage` 传到后台，但只在同一个同步回合内有效。请求返回后由后台继续对账、注入、开向导。
- `denied`（用户拒绝）与 `gestureLost`（后台没拿到手势）分开报错；真实权限弹窗无法自动化，E2E 只覆盖「允许之后恢复生效」，请求 payload 由后台单测覆盖。

## 0.3.0 · #41 站点设置页

- **撤销抽成「纯逻辑 + 组合式函数」两层**：列表运算（`detachRule` / `reattachRule`，按原下标插回、id 不变）放 `core/rule-undo.ts`，无 Vue、无存储、有单测；「最近一次删除 + 5 秒计时器 + 何时结束」放 `ui/rule-undo.ts` 的 `useRuleUndo`。写入通道由调用方传入：编辑面板给 `storage.updateProfile`，管理页给 `store.updateRules`。两处共用同一份逻辑，行为不会再分叉。
- **删除时按「最新列表」再算一次**：撤销信息（原下标、名称）用界面上眼下这份列表算，真正写存储时用 `update((current) => …)` 里的最新列表再删一次。别处刚改过规则时既不会覆盖别人，也不会把已经不在的规则插回去。
- **图标上传抽到 `entrypoints/management/tab-icon.ts`**：`checkIconSource` → 解码 → `containRect` → canvas → 长度与 `isSafeFaviconDataUrl` 复校。解码与绘制是唯一依赖浏览器的两步，做成可替换的 `IconDecoder`，单测用替身覆盖「格式不对 / 超过 5MB / 解码失败 / 尺寸非法 / 编码失败 / 结果不合法」六条分支；页面只负责把 `error`（全部来自 `ICON_ERROR`）显示出来。
- **「在页面上编辑」不用 `tabs.query({ url })`**：match pattern 对端口不友好（本项目站点身份是含端口的 origin），改成 `tabs.query({})` 后自己按 `new URL(url).origin` 比对——没权限的标签页读不到 `url`，天然只会挑出能注入的那些。发送失败时退回 popup 同一套兜底：先请后台 `enableSite` 对账注入，再发一次。
- **一键清空迁到页脚，0 条规则时确认框不出现「0 个收起项会被删除」**：整行不渲染，而不是换个说法；清空成功后视图自动回列表（这一页已经没有内容可看）。列表行上的按钮与确认框一并删掉，行布局从两列收成一列。
- **收起方式换原生 radio group**：与向导一致（同一 `name` 为一组，方向键切换、读屏报「3 选 1」），视觉上仍是与按钮同一套外观的分段；`aria-pressed` 只留生效范围那组按钮（它们是互斥的即时操作，不是表单取值）。

## 0.3.0 · #44 预览清单行内编辑

- **「调整」弹片整体删掉**：收起方式、名称、范围、删除全在清单行里完成，号码牌从「打开弹片」改成「滚到对应行并高亮」。少一层浮层，也就少一套 Esc / 焦点 / 定位逻辑（`overlayOpen()` 现在只看三个 `<dialog>`）。
- **radio 的 `name` 必须每行一个**：原生 radio 是按 `name` 分组的，所有行共用一个名字会让第 2 行的一切换把第 1 行的选中态清掉。同一行内三个选项共用一个名字，方向键、读屏「3 选 1」都是原生行为。
- **范围标签的可点性看「切过去会不会不一样」，不是看当前命中数**：切到「仅这一处」后当前候选只命中 1 个，但此时仍要能切回「同类 N 处」，所以 `onlyThis` 为真时用「同类那组」的命中数判断，为假时用当前命中数判断。两边都是 1 时显示「仅这一处」且 `disabled`。命中数在进入预览时与每次切换后重算（`document.querySelectorAll` + 排除插件宿主，与 `core/health.ts` 同口径）；DOM 后来变了不实时跟踪——清单本身就是一次性确认界面。
- **自动命名新增「后代文本」一级**：只在没有直接文本时用，且整段文本超过 40 字不采用（页面主区域 / 正文容器命中时拿正文开头当名字反而更难认），仍取不到才退回「div 元素」。
- **高亮用一次性 class + `animationend`**：`prefers-reduced-motion` 下不加动画，只留静态底色，定时器兜底移除 class。

## 0.3.0 · #40 管理页骨架与 hash 路由

- **路由手写、不引 vue-router**：`#/sites`、`#/sites/<host>`、`#/settings`；`parseRoute` 是纯函数（`entrypoints/management/router.ts`），首次进入没有 hash（或 hash 认不出来）时用 `history.replaceState` 落到 `#/sites`，不新增历史记录。两个 tab 用普通 `<a href="#/…">` + `aria-current="page"`，前进后退与深链交给浏览器。
- **路由参数用 host 而不是 hostname**：站点身份是 origin（含协议与非默认端口），`#/sites/127.0.0.1:8080` 才不会和另一端口的站点相撞；展示名仍去掉 `www.` 并转回 Unicode。同一主机不同协议会落到同一个 hash，这是「域名」这层抽象的已知歧义，当前取列表里的第一个。
- **状态抽成 `entrypoints/management/store.ts`**：`profiles / drafts / dirty / pendingOrigins`、标题自动保存（800ms 防抖 + dirty 防覆盖）、授权、一键清空、导入导出全部搬进去，三个视图共用；用工厂 `createManagementStore` 让单测各建一份，页面用模块级单例。
- **一键清空暂时留在列表行**：#41 才在站点设置页做页脚入口；本票不丢这个能力，行的链接与清空按钮是兄弟节点（按钮不能嵌在 `<a>` 里），二次确认框原样保留。
- **站点设置页只做骨架**：标题输入、图标上传、规则清单与一键清空由 #41 补，页面里留一句说明。`core/icon.ts` 暂时没有生产调用方，保留给 #41。
- **E2E 跟着 DOM 调整**：图标上传与站点级标题输入暂无可测 UI，相关断言随 #41 补回；默认标题的自动保存、dirty 防覆盖改在设置 tab 上测；新增 tab / 深链 / 后退 / 待授权 / 空状态的断言。

## 0.2.0 · #25 悬浮按钮与页内无障碍

- **胶囊拆成三段**：拖动把手（专用 handle，`setPointerCapture`，方向键可移动）/ 主按钮（`aria-pressed` + 可见文字「清爽」「原样」+ 状态点）/ 「⋯」菜单按钮。原来整根胶囊是一个 `div`，`pointerdown.prevent` 同时承担拖动与点击，菜单项挂在它的子节点上：点菜单项时 `pointerdown` 先冒泡到根节点把菜单关掉，`pointerup` 又发出 `toggle` —— 这既是 N1 的成因，也是键盘完全用不了的原因。现在菜单项与主按钮是兄弟节点，不再经过拖动逻辑。
- **菜单用 `popover="auto"`**，因此「点外面关闭」「Esc 关闭」是浏览器行为，不用自己挂 document 监听；进 top layer 后也不可能被页面浮层压住。
- **位置自己算，没用 position-area**：项目 `minimum_chrome_version` 是 116，`position-area` / `position-try-fallbacks` / `focusgroup` / `commandfor` 都晚于它。按 `viewport-aware-dropdowns` 的无 polyfill 退路用 `getBoundingClientRect()` 算「上方优先 + 右对齐 + 越界贴边 + 下方翻转」，并用手算 clamp 替代 `position-try`。
- **对比度靠「本体 + 外圈」两条腿**：单一不透明底色不可能对白底、深色、中灰三种页面都 ≥3:1（白底够、中灰 2.64、深底靠本体 18.9）。所以胶囊本体用 tokens 的不透明底（深底过 3:1），再加一圈 `rgb(0 0 0 / 0.5)` 的半透明黑外圈（浅底 3.95、中灰 3.07）。`check-toggle.mjs` 会把外圈按页面底色合成后实算比值，改色值时会报警。
- **位置存储仍是 `{x, y}` 像素**（没有改成「边 + 比例」的数据模型）：松手时把 x 吸附到最近的一条边、y 夹进视口，挂载与窗口变化时再夹紧一次。效果与「贴边 + 比例」相近，但不改动存储 schema、不需要迁移。
- **右键菜单彻底去掉**（「永不做」清单本来就不允许）：`check-toggle.mjs` 有一条「右键胶囊不会打开菜单」守着，防止再把入口加回来。


## 0.2.0 · #34 向导状态机

- **选择集从 `Set` 改成有序数组**：序号牌、预览标记、草稿清单三处编号统一来自它的下标，"取消一项后重新编号"变成免费的性质，不用在每处维护计数。`replaceInSelection` 保证「选大/选小」原位替换（旧实现 delete + add 会挪到末尾，序号乱跳）。
- **幽灵标记改用「进入预览时缓存的矩形 + 滚动差值」**：彻底移除的元素没有矩形，之前每次重画都量一次得到 0×0，改别的项就会让其它标记坍缩。缓存一次后，重画与改方案都不再依赖元素是否还在。
- **Esc 只在一处判断**：`wizardEscAction` 是纯函数，有浮层时返回 `none` 且**不 preventDefault**——只有让浏览器自己处理这次 Esc，`<dialog>` / `popover` 的原生关闭才会发生（早先在校验阶段拦下，结果浮层关不掉）。输入法组字（`isComposing` / `keyCode 229`）不响应。
- **命中一律按指针实际位置**：滚轮滚动不触发 `pointermove`，而 `pointerdown` 自带坐标。选择阶段不再复用"上一次悬停结果"，滚动时也按最后的指针位置重新命中——这条同时修掉"滚动后点到旧元素"和"悬停框停在旧元素上"。
- **工具条默认底部居中**：底部居中的代价是它盖住页面底部约 140px，那里点不到元素。权衡后仍按票里的要求做（可拖动 + 方向键移动作为退路），没有改成顶部（顶部会挡站点导航，反而是更常见的要收起的东西）。

## 0.2.0 · #23 遮罩方案

- **跟随定位彻底改成事件驱动**（`ui/follow.ts`）：滚动（window 捕获，覆盖页面内滚动容器）、`resize`、被跟随元素与 `<body>` 的 ResizeObserver、CSS 过渡/动画、以及调用方 `check()/kick()`；连续 3 帧矩形不变就停帧。原来常驻 rAF 的写法在静止页面上每秒空转 60 次，E2E 现在能测到静止 2 秒 0 次调用。
- **遮罩颜色取最近不透明祖先背景**（`core/mask-color.ts` 纯函数）：固定浅灰在深色页面上像贴了张白纸。深度上限 8 层，遇到 `transparent` / 半透明继续向上找。
- **遮罩盒子拦截指针**：方案 B（原地留白）本来就点不到，方案 C 之前能点穿，两种方案行为不一致。现在盒子 `pointer-events:auto`，点击/指针事件在 shadow root 上截住；滚轮放行，用户照常滚动页面。

## 0.2.0 · #24 编辑面板

- **「重选元素」不再先删旧规则**：向导收 `replaceRuleId`，保存时在同一次 `updateProfile` 里先把旧规则摘掉再追加。取消向导、预览期 SW 回收都不再丢规则。
- **面板的「当前页面地址」用响应式对象传**：手动 `createApp` 不会重渲染根组件，传字符串快照会让 SPA 换页后的规则列表永远停在打开那一刻；改成传 `reactive({ url })`，运行时在 `wxt:locationchange` 里更新。
- **高级后门逐行校验**：之前把整段当选择器列表检查，只要有一行命中就放行，第 2 行写错也存得进去。改成逐行 `isSafeSelector` + 现场命中，错误提示具体到第几行。
- **面板改用 `<dialog popover="manual">`**（N31 一并处理）：进 top layer 但页面不 inert，符合"页面仍可操作的面板"；`popover=manual` 不自带 Esc 关闭，所以 Esc 在 document 捕获阶段处理——面板开着时焦点可能已经被用户点到页面上，只在 dialog 上监听会漏。
- **删除后 5 秒可撤销**：撤销把规则按原下标插回，id 不变，页面效果随之恢复（存储监听驱动）。


## 0.2.0 · #22 内容脚本生命周期与界面隔离

- **WXT ctx**：`main(ctx)`；监听、定时器、空闲回调全部 `ctx.addEventListener` / `ctx.setTimeout` / `ctx.requestIdleCallback`，storage / runtime 监听在 `ctx.onInvalidated` 里移除；失效即 teardown：冻结样式记录（`styles.handover()`）、停体检、关向导与编辑面板、撤悬浮按钮与遮罩、标题守卫断开并还原。
- **实测：扩展重载后旧脚本留下的用户样式表仍然生效**，新扩展实例按原文 `removeCSS` 能删掉；**同一文本注入几次就要删几次**。另外，重新注入的新脚本落在**另一个**隔离环境（`window.__pagemask` 看不到旧实例，#21 时 e2e.md 第 11 条的说法不成立），WXT 的「新脚本启动」CustomEvent 靠 `detail` 识别，`detail` 跨环境读不到，旧实例收不到通知。由此定下两条接管路径（ADR-0006）：同环境走 `handover()` 交接记录；跨环境广播 `pagemask:takeover` 让旧实例自检收尾，样式靠保护样式里的标记属性 `--pagemask-shield` 探测、先插后删（`releaseOrphanCss`）。
- **更新后重新注入**：`onInstalled(update)` 对账后向已配置且已授权站点的已打开标签页 `executeScript`（参考 Dark Reader），不注入休眠标签页、同主机其他端口。没被重新注入的旧页面：标题守卫要补刀时、页面重新可见时、点悬浮按钮时读一次 `ctx.isValid`（WXT 在 `runtime.id` 消失时就地触发失效）。
- **SPA 路由**：删掉每秒轮询，改 `ctx.addEventListener(window, 'wxt:locationchange')`。WXT 0.21 用 Navigation API 的 `navigate` 事件，pushState / replaceState / 后退都会触发；该事件在 URL 真正更新前派发，所以 `applyDisguise` 带上 `location.href`（后台只在与 sender.url 同源时采用），不依赖 sender.url 是否已更新。
- **宿主**：自定义元素 `pagemask-toggle / -editor / -wizard / -mask`（`core/host-shield.ts`），`ui/page-host.ts` 统一创建：open shadow、共享可构造样式表、`<div class="pm-root" lang="zh-CN">` 根容器、shadow root 上拦 keydown/keyup/keypress 冒泡。宿主保护样式由后台注入，文本固定（内容脚本只能开 / 关）。因为保护样式把宿主 `all:initial !important`，shadow 内 `:host` 上的作者层声明全部失效，界面基准字体 / 颜色 / color-scheme 改设在 `.pm-root`。遮罩覆盖层也进了 shadow（`pointer-events:none` 沿用原行为，可点穿归 #23）。
- **悬浮按钮响应式**：根组件是渲染函数读 `reactive` 状态，存储变化只改状态。整页重应用的判据 `core/apply-key.ts`：不含体检字段、按钮坐标、修改时间；原样态不含地址。
- **体检**（`runHealthCheck`）：宽限 3 秒后等空闲回调体检一次，有没找到的再隔 5 秒空闲时查第二次，两次都没找到才判 stale；第二次时已不在生效范围内的规则不下结论；路由变化、切原样、进向导、收尾都会作废进行中的体检；`countPageHits` 排除插件宿主。没有改数据模型（同一页面内两个时间点确认）。
- **标题守卫**：只观察 `<head>` 的 subtree + `<html>` 的直接子节点（发现 head 出现 / 被替换）；补刀每秒最多 10 次，超过退避 2 秒再补一次；先记录站点写入的值、再判断运行时是否有效，失效收尾时还原到站点最新的标题。
- **构建坑**：`entrypoints/content.ts` 顶层如果还引用某个导入（哪怕只是类型和值写在同一条 `import` 里），WXT 读入口选项时会把它连带加载，`?inline` 样式在那里加载失败（`Cannot read properties of undefined (reading 'get')`）。类型单独 `import type`。

## 0.2.0 · #21 站点生命周期对账

- **对账纯函数** `core/reconcile.ts`：输入 配置来源 + 其中已授权的来源 + 已注册脚本，输出 注册 / 更新 / 注销 / 待授权。授权按 `permissions.contains` 逐站判断（而不是解析 `getAll` 的匹配模式），用户在扩展详情里选「所有网站」时也算已授权。只处理 `pagemask:` 前缀的注册。写法与当前计划不同（升级后 runAt / 文件路径变了）时更新而不是重复注册。
- **触发点**：onInstalled（全部 reason）、onStartup、permissions.onAdded/onRemoved、storage.onChanged 里站点配置的**创建或删除**（新站点保存、整体替换导入、一键清空），以及管理页导入/授权后发的 `reconcile` 消息（可以等结果再刷新界面）。两条路并存：消息保证界面拿到确定结果，storage 监听兜底（例如向导在页面里保存，内容脚本不能发特权消息）。同一 SW 内对账串行；"Duplicate script ID" 改为 update。
- **已授权但没有配置不自动收回**：新站点向导进行中正是这个状态（预览样式需要站点授权）。收回只在两处发生：向导取消（`cancelNewSite`，后台再核对一次确实没有配置）、一键清空。遗留：用户在新站点向导中途直接关掉标签页，授权会留着（没有配置、也不注册，不影响页面）。
- **新站点流程**：popup 点击 → 同步 `permissions.request` → `enableSite{ open:'newSite' }`；后台核对 `tabs.get(tabId)` 的来源、授权，对账，`executeScript(files)` 后再 `executeScript(func)` 调内容脚本登记在隔离环境里的 `window.__pagemask.open(mode)`。去掉了 popup 的 sleep 轮询。配置在向导保存时才 `create`。
- **特权消息来源**：enableSite / resetSite / reconcile 要求 `sender.id === runtime.id` 且 `sender.url` 以扩展根地址开头。不要求"没有 sender.tab"：以标签页打开的管理页带 tab。
- **内容脚本入口核对（B28）**：首屏遮挡与首个样式请求照旧立即发出（后台按 sender.url 的来源查配置，端口不符得到空样式），随后按 `location.origin` 读配置，没有配置也不是新站点向导就撤掉遮挡、保持休眠，不挂任何监听和界面。代价：同主机其他端口的页面会有几毫秒的整页透明（读配置的时间）；内容脚本拿不到同步配置，无法更早判断。
- **一键清空**：后台先 `tabs.query({})` 找该来源的标签页逐个发 `siteReset`（每个最多等 1.5 秒），内容脚本关向导、撤预览与正式样式、还原标题图标、卸载界面后回复；之后收回授权、注销、删配置。内容脚本在配置真正删除前不再按存储重新应用（防止体检回写把样式注回来）。
- **manifest 去占位脚本（B11）**：保留 `defineContentScript`（#22 要用 WXT 的 ctx），在 `build:manifestGenerated` 钩子里 `delete manifest.content_scripts`。WXT 对非 runtime 注册的内容脚本不写 host_permissions，产物里不需要额外清理。`check:package` 增加：无 content_scripts、无 host_permissions、`content-scripts/content.js` 存在。
- **E2E 授予权限**：`developerPrivate.addHostPermission` 对可选主机权限无效（实测），只能用 manifest 两次重载法；popup 用 `action.openPopup()` 打开，测试拷贝加 `tabs` 权限代替 activeTab。详见 `docs/dev/e2e.md`。

## 0.2.0 · #20 注入引擎：按文档跟踪 + 首屏防闪
- **消息协议**（`core/messages.ts`）：`applyDisguise {prev}`、`restoreOriginal {prev}`、`draftCss {prev, next}`，回复 `CssAck {ok, error?, css}`，css = 处理后文档里实际存在的文本。内容脚本侧记录在 `core/doc-styles.ts`，一条 promise 链串行。后台 `core/background-engine.ts` 不再有 Map。
- **后台回复**统一 `sendResponse` + 同步 `return true`；非后台消息返回 false 不占通道。popup 的 enableSite、管理页的 resetSite 检查 `res?.ok` 并提示；内容脚本样式失败 `console.warn`；向导预览失败弹页内提示。
- **首屏过渡遮挡**（ADR-0005）：实测 CfT 157 本地页面首个动画帧在 5～10ms，SW 往返赶不上（先做了只改 `document_start` 的版本，E2E 首帧断言 3 次全失败），一次 storage 读取也只有 1/3 能赶上首帧。调研：uBO MV2 靠 `webNavigation` 抢先注入（要新权限，否决），Dark Reader 用 `<style>`（与 ADR-0002 冲突，否决）。最终用可构造样式表：先整页透明，读到配置后换精确规则，正式样式到位后撤掉。
- **标题守卫**：`document_start` 时 `<head>` 不存在，图标等 head 出现再插（Chrome 只认 head 里的图标声明）；启动时快照是空的，改为观察到站点自己写入的标题/图标时更新快照（顺带解决 B21「还原回到开启那一刻的标题」）。
- **每个候选独立 CSS 块**；「原地留白」补 `opacity:0`；向导预览改用 `buildPreviewCss`，与正式样式同一实现（B33）。
- **一键清空后的已打开页面**：内容脚本"配置被删"分支顺带按存储同步一次样式（后台算出 null 即移除）；但撤权限先于删配置，移除可能因无权限失败，完整修复仍归 B7。

## 0.2.0 · #28 manifest 多语言与最低 Chrome 版本

- **多语言包**：`public/_locales/{en,zh_CN}/messages.json`（WXT 原样复制到产物），`default_locale: en`；`name` / `description` / `action.default_title` 改为 `__MSG_extName__` / `__MSG_extDescription__` / `__MSG_actionTitle__`。没有引入 `@wxt-dev/i18n`（只需 manifest 层面的多语言）；`wxt prepare` 会按默认语言的 messages 生成 `.wxt/types/i18n.d.ts` 的 `getMessage` 键类型，与现有代码无冲突。
- **坑：WXT 用 popup 的 `<title>` 覆盖 `action.default_title`**，且 `<title>` 优先于 `<meta name="manifest.default_title">`。在 `wxt.config.ts` 的 `build:manifestGenerated` 钩子里改回占位，popup 页面标题不动。
- **打包门禁补充**（`scripts/check-package.mjs`）：各语言键集合一致、每条有 message 文本；有 `_locales` 必须声明 `default_locale`；name/description/按钮提示的各语言文本不含禁用词（伪装 / disguise / New Tab / 新建标签页 / 摸鱼）；按钮提示占位也必须能解析。已用篡改产物验证四类错误都会拦下。
- **真机验证**：`tests/e2e/check-i18n.mjs`（手动跑，不进 `test:e2e`）。macOS 上 `--lang`、`--accept-lang` 都不改变 Chrome 界面语言（实测 CfT 157，系统语言 zh-Hans-CN），只有 Cocoa 参数 `-AppleLanguages (en-US)` 生效。
- **`minimum_chrome_version: "116"`**，核实结果如下（"渐进"表示不支持时自动降级、不影响功能）：

| 用到的能力 | 起始版本 | 是否硬要求 | 来源 |
|---|---|---|---|
| MV3、`optional_host_permissions`、`chrome.scripting`、`insertCSS` 的 `origin: 'USER'`（文档未单列版本，即随 scripting 一起） | 88 | 是 | [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[MV3 迁移](https://developer.chrome.com/docs/extensions/develop/migrate/manifest) |
| `insertCSS` / `removeCSS` 返回 Promise | 90 | 是 | scripting |
| `registerContentScripts` / `unregisterContentScripts` / `getRegisteredContentScripts`，含 `runAt`、`persistAcrossSessions` | 96 | 是 | scripting |
| `InjectionTarget.documentIds`、`InjectionResult.documentId` | 106 | 是（#20 用） | scripting |
| `MessageSender.documentId` | 106 | 是（#20 用） | [runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime) |
| `runtime.onMessage` 用 `sendResponse` 回复 | 所有版本 | — | runtime |
| 构建产物 JS 语法：Vite 8 默认 `build.target` 为 Baseline Widely Available（2025-05-01）= `chrome111`，WXT 0.21 未覆盖 | 111 | 是 | `node_modules/vite/dist/node/chunks/node.js` |
| Popover API | 114 | 是（#25 计划用） | [Introducing the popover API](https://developer.chrome.com/blog/introducing-popover-api) |
| CSS `@starting-style`（若用于入场动画） | 117 | 渐进 | [New in Chrome 117](https://developer.chrome.com/blog/new-in-chrome-117) |
| CSS `light-dark()`（已有兜底） | 123 | 渐进 | [New in Chrome 123](https://developer.chrome.com/blog/new-in-chrome-123) |
| `<dialog>` | 37 | — | MDN |

  硬下限是 114（Popover）。取 116 的理由：多留两个版本余量，避开 Popover 首发版本可能存在的问题；116 发布于 2023 年 8 月，Chrome 自动更新，低于它的用户可以忽略；本项目也只在新版 CfT（157）上做真机测试，无法覆盖更老的版本。没有取 123：`light-dark()` 和 `@starting-style` 都已渐进处理，不值得为此挡掉用户。按[官方说明](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version)，低于该版本的浏览器在商店显示"不兼容"，已安装用户会静默停止更新，所以以后上调要谨慎。
- 补 `homepage_url`：https://github.com/cherishfall/page-mask 。

## 0.2.0 · #32 选择器生成与生效范围推导修正

- **首页用精确匹配，而不是不提供**：`ScopePattern` 增加可选 `match: 'exact'`（缺省 = 带边界的前缀匹配，旧数据不用迁移）。理由：「只在首页藏推荐流」是真实需求，直接拿掉选项会丢功能；精确匹配只比 站点+路径，忽略 `?` 与 `#`。`sanitizeScope` 白名单同步。
- **前缀匹配加边界**：前缀后面必须是结尾、`/`、`?`、`#`，`/web` 不再命中 `/website`；推导出的前缀统一不带尾部斜杠，旧数据里以 `/` 结尾的前缀行为不变。
- **hash 路由站点**（路径为根、`#/` 或 `#!/` 开头）不提供「这类页面」，保存框与编辑面板显示「这个网站用 # 区分页面，暂时只能按整站生效」。
- **国际化域名显示**：浏览器 `URL` 只能把中文域名转成 `xn--`，没有反向转换；`core/origin.ts` 自带一个 RFC 3492 解码器（仅用于显示，解不开就原样显示），不引入依赖。
- **候选选择器**：通过库的 `blacklist` 过滤 Vue/Angular/React 的构建期属性与 id；元素自身没有特征时向上找最近的有特征祖先拼接（`.side > div:nth-child(4)` → 同类模式泛化成 `.side > div`），找不到才用库从页面根数位置的兜底路径；纯标签 / 通配 / 纯位置候选一律丢弃；候选按稳定度排序后与主候选比对命中集合，再截断到 3 个。

## 2026-10-26 04:30 · V1 0.1.0 定版（通宵冲刺完成）

真机验证结论：**微信读书、得到、墨问**三个站点全流程（点选→预览→保存→规则真实命中隐藏→标题伪装）通过；**极客时间对本机当前网络出口一律 451**（含 `--no-proxy-server` 直连，www 与 time 子域皆然，疑出口 IP 被判境外）——环境受限非插件问题，用户日常网络下待人工复核一次即可。

超出设计文档的关键决策（后续可推翻）：

- **点选事件改为全屏捕获层**（uBlock 元素选择器同款）：拾取期盖透明层接管全部指针事件，`elementsFromPoint` 反查目标。起因：极客时间这类站点的 window 捕获监听会抢先吞事件；顺带天然挡住链接跳转。
- **向导保存的范围选择是整批一个范围**（整站/仅这类/排除这类），非逐条规则设置——设计文档允许"保存时设置"，逐条 UI 过重，v1 从简。
- **编辑面板"重选元素"** = 删除旧规则 + 进向导重新点选（而非原地重选），v1 从简。
- **预览样式走后台 draftCss 通道**（与正式样式分道跟踪），insertCSS/removeCSS 全部 `origin:'USER'`。

## 2026-10-26 03:00 · 向导全流程 E2E 通过（真鼠标拾取→预览→保存）

两个通宵踩坑，值得记录：

- **shadow 事件重定向**：shadow DOM 内元素的事件传到 window 级监听器时，target 会被重定向成 shadow host。自家 UI 判定必须同时认 host 本身、host 的后代、shadow 内部节点三者。症状：JS 点击工具条按钮被当成页面点选（还把 host 选中了），且捕获阶段的 stopPropagation 吞掉了按钮本该收到的点击。
- **Vue 响应式代理 × chrome.storage**：响应式代理数组经 chrome.storage 序列化会变成 `{"0":..,"1":..}` 数字键对象，后续 `.map` 全崩。修法在存储层入口（putProfile）统一 JSON 规范化，所有写入方一并治愈。
- **insertCSS 通道**：默认 origin 是 AUTHOR，须显式 `origin:'USER'` 才是设计要求的用户样式表通道；removeCSS 参数必须与插入完全一致（探针脚本验证过 CfT 157 行为符合文档）。

## 2026-10-26 02:00 · 真机 E2E 链路打通（重要里程碑）

用 puppeteer-core + Chrome for Testing 157 加载真实扩展，12 项断言全过：伪装态标题/图标替换、方案A/B 生效、范围外零影响、原样态完全还原、悬浮按钮常驻、开关反复切换。证据截图 `docs/dev/evidence/`。`npm run test:e2e`。

过程决策（超出设计文档的部分）：

- **E2E 浏览器用 Chrome for Testing**：品牌版 Chrome 137+ 忽略 `--load-extension`（SW 根本不出现，第一版 E2E 因此超时）。CfT 157 从 npmmirror 镜像下载到 `/tmp/cft`，绕开被墙的 Google 存储。
- **E2E 权限预授予**：动态注册的内容脚本必须先持有目标站点宿主权限才会注入；权限弹窗无法自动化点击。E2E 用构建产物拷贝（`/tmp/pm-e2e-ext`）把测试站点写进 manifest `host_permissions`（加载未打包扩展时安装即授权），等价于用户点过「允许」。生产构建不带这些权限。
- **MV3 SW 懒启动**：E2E 先做一次 about:blank 导航唤醒后台（tabs.onUpdated 监听拉起 SW），再 waitForTarget。
- **测试环境用 jsdom**：css-selector-generator 在 happy-dom 下会生成非法选择器 `[]` 抛异常（库自身 CI 用 jsdom），已换。

## 2026-10-26 01:30 · 引擎与内容脚本运行时

后台动态注册/注销、insertCSS 幂等应用/还原、内容脚本生命周期（标题/图标补刀、storage 驱动多标签联动、SPA 路由重评估、悬浮按钮全内联样式零 `<style>` 注入）。60 项单测全绿。

## 2026-10-26 00:50 · 脚手架与领域层

WXT + Vue 3 + TS 构建链路验证通过；领域模型/存储层/选择器生成 51 项单测。npm 源用 npmmirror（`.npmrc`，不依赖代理存活）。

## 2026-10-26 深夜 · 通宵冲刺启动

- 环境验证完毕：Node 22.20 / npm 11.17 / Chrome 156 / Clash 代理（gh 前缀方式）全部可用；已启动防休眠进程（caffeinate，自过期）。
- 建立本目录与 `AGENTS.md` 新规范（语言、目录结构、提交纪律、测试、真实网站验证约定）。
- 任务拆票：GitHub epic #2 + 15 张子票。
