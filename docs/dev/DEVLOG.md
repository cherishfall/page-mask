# 开发日志（DEVLOG）

按时间倒序记录开发过程中的关键事件、超出 `docs/design.md` 范围的临时决策及其理由。正式的架构决策写 `docs/adr/`，这里只记过程。

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
