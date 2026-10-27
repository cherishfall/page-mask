# 开发日志（DEVLOG）

按时间倒序记录开发过程中的关键事件、超出 `docs/design.md` 范围的临时决策及其理由。正式的架构决策写 `docs/adr/`，这里只记过程。

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
