# 更新日志 / Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 结构与 [语义化版本](https://semver.org/lang/zh-CN/)。
每个版本下「中文」与「English」两节逐条对应。
This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).
Under each version, the Chinese and English sections correspond item by item.

## [0.9.1] - 2026-11-12

上架前的全面质量批次：一次全方位审查（代码 / 文案中英 / 界面规范 / 无障碍 / 商店材料 / 全界面真实渲染目检）发现的问题全部修完。功能与权限不变——权限集合仍是 storage、scripting、activeTab 加按站点的可选主机权限。

### 中文

#### 修复

- **带非默认端口的站点管理页打不开（#166，#162 遗留）**：`localhost:3000`、`example.com:8443` 这类站点在「全部网站设置」里点了没反应、手输地址也显示「没有这个网站的设置」。现在列表行能进、地址能直达
- **向导点选嵌套内容给提示（#167）**：点中网页组件内部区域（shadow DOM）或网页里嵌的另一层页面（iframe）时，提示「收起设置管不到它，所以没有选中」并拒绝选中——这类选择生成的规则永远不生效，还可能误伤外层同名元素。设计文档承诺的提示从此兑现
- **弹窗不再可能停在「读取中」（#168）**：设置读取失败时落到空态并给一句「重新打开弹窗再试一次」；点「收起内容」没反应时页面也给一句话

#### 改动

- **「在哪些页面收起」改成原生单选分段（#142）**：与「收起方式」同一套控件，读屏统一报「N 选 1」，同屏不再有两种互斥语义
- **弹窗的失效提醒可以点了（#175）**：「N 项可能失效」现在是一个入口，点它直接打开「收起内容」重新选；原样态保存的确认按钮补了「保存」二字（「保存，先保持原样」/「保存，现在打开」）；设置面板的「收起 / 展开」改成「收起面板 / 展开面板」，不再与「收起内容」撞名；删除入口与失效项带下划线、看得出来能点；站点设置页的收起项清单加了序号，同名条目分得清；欢迎页可以「跳过引导」；向导「看效果」的清单带上总数（「这次要收起的内容（6 项）」），行多时最后一行藏在滚动区里也不会漏
- **ⓘ 说明气泡加了指向箭头（#175）**：气泡与它解释的那一行连在一起，不再像在解释上一张卡
- **文案全面梳理（#172 / #173 / #174）**：界面禁词（如「生效」）清零；同一概念全项目一种叫法（「检查一样的」「默认标题」「悬浮按钮」）；常驻提示一律不加句尾句号（立了成文规矩）；标题留空说明改成一句有因果的话（「留空就用「阅读」——如果清成完全空白再保存，Chrome 会改成显示网址」）；站点设置页灰度卡两段说明合并成「行内短句 + ⓘ」
- **界面细节（#169 / #170 / #171）**：开关动效与悬停 / 按下态补齐并符合成文动效规矩；页内浮层遮罩统一一份浓度（暗色自动加深）；键帽样式两套合一；幕布上的恢复按钮补方向键移动（与胶囊同一份步长）

#### 面向审阅者

- 商店提交材料、README、隐私政策同步了 0.8.x 以来的旧名与过期状态（「整页变灰」口径、悬浮按钮叫法、插件设置内容清单），中英一致（#163）
- CI 新增版本三方一致性校验（package.json / 更新日志 / 商店材料）（#176）

### English

#### Fixed

- **Sites on a non-default port were unreachable from the list (#166, #162 regression)**: `localhost:3000`-style sites did nothing when clicked in “All site settings”, and typing the address directly showed “no settings for this site”. Both paths work now
- **Picking nested content now explains itself (#167)**: clicking inside a widget’s inner area (shadow DOM) or a page embedded in the page (iframe) says hide settings can’t reach it and declines the pick — such rules could never work and could even hide look-alike elements in the outer document. This delivers what the design doc promised
- **The popup can no longer get stuck on “Loading” (#168)**: if settings can’t be read, it falls to the empty state with “reopen the popup and try again”; a dead click on “Hide items” now shows a notice on the page instead

#### Changed

- **“Where it applies” is now a native radio segment (#142)**: the same control as the hide method — screen readers announce it as one-of-N, and the panel no longer mixes two kinds of exclusive choice
- **The stale-items notice in the popup is actionable (#175)**: “N may be broken” now opens “Hide items” to pick again; the “As is” save dialog buttons say Save (“Save, keep as is” / “Save, turn it on now”); the panel labels are “Collapse panel / Expand panel” so they no longer collide with “Hide items”; the delete entry and stale marks are underlined and look clickable; hidden-item rows are numbered so look-alike names are tellable; the welcome page has “Skip this guide”; the wizard’s review list carries a total (“What will be hidden (6 items)”) so a long list can’t hide its last row from you
- **ⓘ bubbles point at their row (#175)**: a small caret ties each bubble to the row it explains instead of the card above
- **Copy pass across every surface (#172 / #173 / #174)**: banned words are gone; one concept one name everywhere; resident hints never end in a full stop (a written rule now); the blank-title note is one causal sentence (“Leave it empty to use “Reading” — if you clear it completely, Chrome will show the address instead”); the site-settings gray card carries one short line plus an ⓘ instead of two stacked paragraphs
- **Interface details (#169 / #170 / #171)**: switch motion and hover/press states fixed to the written motion rules; in-page dialogs share one backdrop shade (darker in dark mode); keycap styles merged; the curtain’s restore button gains arrow-key movement with the same step as the floating button

#### For reviewers

- Store listing, README and the privacy policy are in sync with post-0.8.x naming and states (“Turn the whole page gray”, “floating button”, the Settings page contents), Chinese and English alike (#163)
- CI now checks that package.json, the changelog and the store materials agree on the version (#176)

## [0.9.0] - 2026-11-11

主线是「网站按可注册域名识别」：`weibo.com`、`www.weibo.com`、`s.weibo.com` 从此算一个网站。其余五处是 0.8.19 之后报上来的交互与文案问题：收起内容多了对称的清空出口、原样态保存不再像没生效、空设置时开关旁写明后果、界面上的长说明收掉、三处界面立了唯一对照表并加了自动检查。

### 中文

#### 改动

- **网站身份改成可注册域名（#162）**：`weibo.com`、`www.weibo.com`、`s.weibo.com` 现在是同一个网站——一份设置、一次授权、列表一行；`weibo.com` 与 `weibo.cn` 仍是两个。升级后第一次读到旧配置时自动合并：收起项取并集，冲突的取最近改过的那份，旧数据不丢。规则仍按每个页面的实际网址生效，「只在 weibo.com 首页收起」不会套到子域页面
- **收起内容多了「恢复网站原来的内容」（#160）**：站点设置页「收起的内容」卡底部与向导的选内容步骤底部各一个入口，与「恢复网站原来的标题和图标」对称。只清收起项，标题、图标、开关、整页变灰一概不动；清之前先确认一次，并写明几项会没了
- **原样态下点保存先问一句（#159）**：之前会静默保存、页面毫无变化，看着像没生效。现在弹一个框问「现在打开吗」——两条路都完成保存，不替你自动打开
- **没有可生效的设置时，开关旁写明「打开后页面不变」（#158）**：弹窗、悬浮按钮、站点设置页三处同一句话、同一个判断；开关照常可拨，不再让人以为坏了
- **界面上的长说明收掉（#161）**：只在前几次有用的引导文字收进 ⓘ 或折叠起来；状态、后果、边界这类「不知道就会做错」的话仍留在界面上，但压成一句
- **三处界面对齐并加了自动检查（#157）**：弹窗、悬浮按钮菜单、站点设置页的排列顺序、叫法与控件来源统一，对照表是唯一权威——改一处漏两处会在提交前报出来；站点设置页的「整页变灰」卡归位，旧名「图片和视频」彻底退场

#### 取舍（如实说明）

- 同一注册域名下的不同子域共用一份设置与一次授权。这是「用户认为它们是一个网站」的直接后果：本来想分开配的两个子域会被合并
- 只允许过 `weibo.com` 的老用户，打开 `s.weibo.com` 时弹窗会说「这个页面还没允许访问」，点一次「允许访问」补上——升级不会自动替你扩权
- 迁移时新增的授权是「裸域 + 子域」两条模式；带非默认端口的站点用 http、https 两条精确模式（浏览器的匹配模式不支持 `*://主机:端口/*`）。IP 地址、`localhost` 与带端口的地址保持原样，不合并子域
- 公共后缀表只内置常见子集（`com.cn` / `co.uk` / `github.io` 等）：表外的后缀会把同后缀的两个独立站点当成一个（共用设置与授权），不会丢数据

### English

#### Changed

- **A site is now its registrable domain (#162)**: `weibo.com`, `www.weibo.com` and `s.weibo.com` are one site — one set of settings, one permission grant, one row in the list; `weibo.com` and `weibo.cn` remain two. Existing settings are merged the first time they are read after upgrading: hidden items are unioned and the more recently edited copy wins for shared fields, so nothing is lost. Rules still apply per page URL — “hide only on the weibo.com home page” does not leak onto subdomains
- **“Use the site’s own content” for hidden items (#160)**: one entry at the bottom of the “Hidden items” card and one at the bottom of the wizard’s pick step, mirroring “Use the site’s own title and icon”. It clears hidden items only — title, icon, switch state and grayscale stay; a confirmation first says how many items will go
- **Saving while the site shows “As is” now asks once (#159)**: previously it saved silently with nothing changing on the page, which looked broken. A dialog now asks whether to turn “Show this site your way” on; both answers save, and it never turns it on for you
- **When nothing applies, the switch says “Nothing changes on the page” (#158)**: same sentence and same test in the popup, the floating button and the site settings page; the switch still works, so it no longer looks broken
- **Long explanations trimmed (#161)**: guidance that only matters the first few times now lives behind an ⓘ or a disclosure; state, consequences and limits — the things you get wrong if you don’t know them — stay on screen, one short sentence each
- **The three surfaces are aligned and checked automatically (#157)**: order, wording and control source for the popup, the floating menu and the site settings page now have a single authoritative table, and changing one but not the others fails before commit; the “Grayscale whole page” card moved back into place and the old name is gone

#### Trade-offs (stated plainly)

- Subdomains of one registrable domain share one set of settings and one grant. That is the direct consequence of treating them as one site: two subdomains you wanted to configure separately will be merged
- If you only ever allowed `weibo.com`, opening `s.weibo.com` shows “This page isn’t allowed yet” with one “Allow access” button — upgrading does not widen permissions for you
- A site is granted with two patterns (bare domain plus subdomains); sites on a non-default port use explicit http and https patterns, because match patterns do not support `*://host:port/*`. IP addresses, `localhost` and addresses with a port stay exact and do not merge subdomains
- The public suffix list is a built-in subset (`com.cn`, `co.uk`, `github.io` and other common ones): an unknown suffix makes two independent sites on that suffix share settings and a grant. No data is lost

## [0.8.19] - 2026-11-11

「整页变灰」的图标与语义对齐：原来是「山 + 太阳」的图片符号，功能升级为整页后换成了灰度 / 对比度的通行符号。功能与权限不变。

### 中文

#### 改动

- **「媒体」钮与弹窗开关行的图标换成对比度符（半填充圆）**：0.8.18 把功能从「图片和视频变灰」升级为「整页变灰」后，画着一张图片的图标已经答不上「这是什么东西」；半填充圆是灰度 / 对比度的通行符号（M3 的 contrast 符号、macOS 与 GNOME 的对比度设置同款）。关态 = 描边（圆 + 中线），开态 = 右半填实——与面具图标同一套「描边 / 填实」状态语言，关与开一眼可辨

### English

#### Changed

- **The “Media” button and popup switch icon is now a contrast symbol (half-filled circle)**: after 0.8.18 upgraded the feature to “Turn the whole page gray”, the old picture glyph (mountain + sun) no longer answered “what is this”; the half-filled circle is the standard glyph for grayscale / contrast (M3's contrast symbol, also macOS and GNOME contrast settings). Off = outline (circle + midline), on = right half filled — the same outline / filled state language as the mask icon, clearly distinguishable at a glance
## [0.8.18] - 2026-11-11

按用户提案把「图片和视频变灰」升级为「整页变灰」：一条 CSS 规则像素级覆盖整个页面，过去三轮返工的覆盖边界（背景图、canvas、iframe 内容、SVG）一次清零。开关的位置、记忆、与主开关的独立性都不变。

### 中文

#### 改动

- **「图片和视频变灰」→「整页变灰」（#156）**：打开后整个页面变成黑白——文字、图片、视频、按钮、背景图、canvas、连 iframe 里的内容全都一样；位置大小不变、链接还能点、文字照样读。此前按媒体类型灰度的路线修了三轮仍不断出现「某类图没灰」（书封走背景图的多抓鱼、登录态的推特），整页灰从机制上消灭这类问题。依据：iOS/macOS 系统灰度同为整屏方案，市面 grayscale 类扩展全部是一条 CSS 规则；技术实测 fixed 元素不受影响、文字保持可读
- **叫法同步**：弹窗、站点设置页、欢迎页、悬浮按钮读屏名统一为「整页变灰」（中英同改）；开关的记忆、三处入口、与「按你的设置显示」的独立性全部不变

#### 取舍（如实说明）

- 本扩展自己的悬浮按钮等界面也会跟着页面变黑白（页面上无法豁免整页滤镜，功能不受影响——状态靠形状与明度仍然可辨，与 iOS 系统灰度对浮层的处理一致）
- ≤32px 小图标豁免退场：页面自己的按钮图标也变灰
- 自动播放视频的「点击放行」保留：放行的是播放动作，画面本来就是黑的

### English

#### Changed

- **“Turn pictures & videos gray” → “Turn the whole page gray” (#156)**: flipping it turns the entire page black & white — text, pictures, videos, buttons, background images, `<canvas>`, even content inside iframes; same place, same size, links still work, text stays readable. The per-media approach kept hitting “this kind of image didn't turn gray” after three rounds of fixes (covers drawn as background images, logged-in X); whole-page gray eliminates that class of problem mechanically. Precedent: iOS/macOS system grayscale is a whole-screen toggle, and every grayscale extension is one CSS rule; verified that fixed-position elements stay put and text remains readable
- **Naming synced**: popup, site settings, the guide and the floating button's accessible name all say “Turn the whole page gray” (Chinese and English); the switch's memory, its three entries and its independence from “Your settings” are unchanged

#### Trade-offs (stated plainly)

- PageMask's own interface (the floating button and friends) turns black & white with the page — a page-level filter cannot exempt it, and it keeps working (states stay distinguishable by shape and lightness, matching how iOS system grayscale treats overlays)
- The ≤32px icon exemption is gone: the site's own button icons turn gray too
- The click-to-allow rule for autoplaying videos stays: it releases the playback, and the picture is already black & white
## [0.8.17] - 2026-11-10

0.8.16 发版后两轮深审查（Web Interface Guidelines 代码审查 + 第二轮全量截图目检）的收尾：读屏可达性补齐、触屏细节、两处措辞。功能与权限不变。

### 中文

#### 修复

- 弹窗 ⓘ 信息标对读屏不可达：聚焦时只播报「更多信息」三个字，浮层正文读不到——补 `aria-describedby` 指向浮层正文，聚焦即播报完整内容
- 弹窗「页面还没加载好」的说明行是异步出现的，读屏感知不到——补 `role="status"`
- 触屏点击胶囊时系统默认的灰色高亮闪一下，叠在自有反馈上显脏——有意关掉（按钮自带悬停 / 按下 / 选中底反馈）
- 弹窗删除确认框内容超高时滚动会连动到弹窗页面——滚动限制在框内
- 两处措辞：ⓘ 浮层与站点设置页对「点击放行视频」统一说成「点一下视频就能看」；不透明度滑杆说明补上方向（数值越小越淡）

### English

#### Fixed

- The popup's ⓘ info tags were unreachable for screen readers: focusing announced only “More information” without the popover text — wired `aria-describedby` to the popover body so focus reads the full content
- The “page hasn't finished loading” notice appears asynchronously but was invisible to screen readers — added `role="status"`
- The system tap-highlight flash on touch overlaid the capsule's own hover / press / selected feedback — turned off intentionally
- Scroll chaining from the popup's delete dialog into the popup page when content overflows — contained to the dialog
- Two wording nits: the ⓘ popover and the site settings page now use the same phrasing for click-to-allow (“click a video to watch it”); the opacity slider hint spells out the direction (lower = fainter)
## [0.8.16] - 2026-11-10

按真机反馈收口观感：悬浮按钮开启态去掉指示条与强调色、弹窗松开间距并砍短文字、灰度补上背景图与「没加载好的页面」两个缺口，设计文档同步审计；发版前全量截图审查又修掉一批文案与可点性问题。功能与权限不变。

### 中文

#### 改动

- **悬浮按钮开启态重做（#152）**：0.8.15 的「强调色图标 + 分段底部 2px 指示条」退场——指示条紧贴胶囊边框，看着像两道重复的线；改成图标开关的通行做法（Material 3 图标按钮 / Carbon 工具栏选中态 / iOS 控制中心同路）：填实图标换墨色、分段铺一层淡灰选中底，「开」靠形状（填实 vs 描边）与墨色浓淡两个信号辨认，不再依赖颜色；悬停 / 按下用一层更深的透明薄层表达，状态切换保留 150ms 过渡
- **弹窗观感（#153）**：组件间距 4→8px、卡片内边距 4→12px，把 0.8.15 为英文高度红线压掉的呼吸感还回来；说明文字砍短——已设置网站的卡头不再有说明行，灰度卡、遮住卡、悬浮按钮行的说明各收成一句短话，被砍掉的细节（黑白但可读可点、自动播放的视频会暂停、快捷键照常可用）移进两个 ⓘ 信息标，鼠标悬停或键盘聚焦时浮出、Esc 撤下；删除悬浮按钮行上方的独立分割线；底部「全部网站设置」「插件设置」改回文字链接（muted + 下划线），不再占按钮的视觉档；「标题和图标」「收起内容」两颗入口同为次操作档——已设置网站里「收起内容」不再独占实心蓝主按钮（待授权网站的「允许访问」仍是实心）
- **灰度补两个缺口（#154）**：① 书封 / 封面这类用 CSS 背景图画的内容图现在一并变灰（多抓鱼实测：首页 18 个背景图元素全部变灰，≤32px 小图标照旧豁免）——0.8.15 及之前这类站点等于没开；② 页面没加载好时（比如网络代理抖动出现的 Chrome 错误页）打开灰度不再失败：设置照常保存，弹窗改为一句「这个页面还没加载好。打开之后，图片和视频会自动变黑白」，等页面真正打开灰度自动生效——0.8.15 及之前这种场景只会留下「没能在这个页面上启动」

#### 修复

- 灰度在多抓鱼等「封面走 CSS 背景图」的站点上不生效（根因：纯 img/video 选择器盖不住背景图，本版由内容脚本扫描打标）
- 在没加载好的页面上打开灰度，设置没能保存、灰度永远开不上（根因：Chrome 错误页拒绝脚本注入，配置写入被一并跳过）

#### 修复（发版审查，0.8.16 收口前）

- 弹窗顶部的站点名不带端口，和「全部网站设置」列表里的同一个网站对不上号（现在与列表、悬浮按钮用同一套展示名规则）
- 同一个「图片和视频变灰」在浮层说明里被写成「变成黑白」：全项目统一「变灰」的说法（弹窗 ⓘ 浮层、站点设置页说明、欢迎页，中英同步）
- 站点设置页的提示句引用「原样」「按设置」这些要先学的状态名，改成「上面的开关关着 / 打开时」
- 「留空就用『阅读』——标题不能设成空白」读起来自相矛盾，重写成一句连贯的话（向导、站点设置页、插件设置页三处同源）
- 站点设置页「恢复网站原来的标题和图标」看不出能点，补下划线；清单里的序号徽章改成和页面号码牌同一个颜色
- 悬浮按钮选中态的悬停反馈太弱（和选中底几乎一个颜色），加深一档

### English

#### Changed

- **Floating button's on state redesigned (#152)**: 0.8.15's accent icon + 2px bottom rule are gone — the rule sat flush against the capsule border and read as a doubled line. The state now follows the common icon-toggle pattern (Material 3 icon button, Carbon selected toolbar icon, iOS Control Center): the filled icon turns ink, the segment gets a quiet gray selected fill, and "on" is carried by shape (filled vs outline) plus ink weight instead of color. Hover and press deepen a translucent state layer; the 150ms transition stays
- **Popup made breathable (#153)**: component spacing 4→8px, card padding 4→12px, giving back the air 0.8.15 traded away for the English height limit. Copy is halved — the set-up site's mask card no longer has a hint line, and the gray / cover / floating-button hints are each one short sentence; the details that were cut (black-and-white but readable and clickable, autoplaying videos pause, shortcuts keep working) moved into two ⓘ info tags that appear on hover or keyboard focus and dismiss with Esc; the standalone divider above the floating-button row is removed; the two footer entries are text links again (muted + underline) instead of buttons; “Title & icon” and “Hide items” are equal secondary buttons — “Hide items” no longer holds the only solid primary (a pending site's “Allow access” still does)
- **Gray closes two gaps (#154)**: ① content images drawn as CSS background images (book covers and the like) now turn gray too — on such sites the switch used to do nothing; ② turning gray on from a page that hasn't finished loading (say, a Chrome error page after a proxy hiccup) no longer fails: the setting is saved, the popup explains “once the page is open, pictures and videos turn gray automatically”, and it takes effect without another toggle

#### Fixed

- Gray had no effect on sites like duozhuayu whose covers are CSS background images (root cause: an img/video selector can't reach background images; this release marks them via the content script)
- Turning gray on from an error page silently failed to save the setting (root cause: script injection is refused on Chrome error pages, skipping the profile write)

## [0.8.15] - 2026-11-10

按真机反馈重做弹窗、悬浮按钮与设置面板的外观和排布，并做一次全界面文案专项。功能与权限不变。

### 中文

#### 改动

- **弹窗重排（#148）**：新老网站共用同一套四块卡，顺序与悬浮按钮四段一一对应——① 面具卡（开关 + 「标题和图标」「收起内容」两颗入口并排一行，主操作在右）② 灰度卡 ③ 遮住卡（与前两张同款卡片框，但卡内没有开关，只有按钮 + 快捷键 + 一句「只是临时挡住、刷新就还原」）④ 辅助行（悬浮按钮开关，不带卡片框）。「查看使用说明」从底部挪到标题右侧；没设置过的网站不显示假开关，改用一句肯定句说明设置好之后开关做什么；两颗编辑入口不再置灰——任何状态、开关开或关都能点
- **悬浮按钮开启态收敛（#149）**：去掉整颗墨底反白（真机上太扎眼），改成三个低调但可辨的信号——中性底 + 强调色图标填实 + 分段底部 2px 指示条；悬停 / 按下改用底色变化，不再把整颗压暗；状态切换补 150ms 颜色过渡，系统开启「减弱动态」时保留 120ms 纯色淡变；高对比度模式改用系统高亮色
- **设置面板收窄且可收起（#150）**：选内容 / 看效果两步的面板由 720px 收到 480px（两步仍同宽），标题栏新增「收起 / 展开」——收起后只剩一条标题栏，原本被面板挡住的页面元素可以直接点，草稿不丢；拖动抓手的常态底色与对比度提高，看得出能拖
- **文案专项（#151）**：叫法统一、中英对齐、去口语化——说明文字里不再混用开关全称（全称只留给开关标签本身）；「遮住整页 / 遮住整个页面」等几套叫法统一为「遮住这一页」；英文把 "Hidden items"（概念名）当数量单位的地方改回 "N items set to hide"，「除了这类页面」统一为 "Except these pages"；去掉「有人走过来时」「人走开了」「想收拾的网站」这类不专业说法；「编辑面板」「工具条」「现成的标题」等内部名词退出界面；同一句删除失败提示、同一句「标题不能留成空白」的坑提示各收成一份出处；删掉三个没人用的文案键

#### 修复

- 英文弹窗在「已设置」状态下会超过 Chrome 弹出的 600px 上限（英文说明比中文长），收紧卡片内边距后回到 588.9px

### English

#### Changed

- **Popup rebuilt around four cards (#148)**: new and already-set-up sites share one layout, matching the floating button's four segments — ① mask card (switch plus “Title & icon” / “Hide items” side by side, primary action on the right) ② gray card ③ cover card (same card frame, but no switch inside: a button, the shortcut key, and one line saying the cover is temporary) ④ helper row (the floating-button switch, deliberately not a card). “View the guide” moved up next to the title; an unset site shows no fake switch but one plain sentence about what the switch will do; both edit entries are always clickable, whatever the switch says
- **Floating button's on state toned down (#149)**: the solid ink fill is gone (too loud on a real screen); the state now reads through three quiet signals — neutral fill, accent-coloured filled icon, and a 2px accent rule along the bottom of that segment. Hover and press change the background instead of dimming the whole button. State changes get a 150ms colour transition, kept at 120ms of plain colour fade under “reduce motion”, and high-contrast mode uses the system highlight colours
- **Setup panel narrower and collapsible (#150)**: the pick / check panel drops from 720px to 480px (both steps stay the same width), and its title bar gains Collapse / Expand — collapsed it is a single bar, the page underneath is clickable, and drafts are kept; the drag grip got a resting background and stronger contrast so it reads as draggable
- **Copy pass across the whole interface (#151)**: one name per thing, Chinese and English aligned, casual phrasing removed — explanatory text no longer reuses the switch's full label (that label is now the only place it appears); the several names for covering a page collapse into “Cover this page” / 「遮住这一页」; where English used “Hidden items” (a concept name) as a count it now says “N items set to hide”, and the scope option is “Except these pages”; 「有人走过来时」「人走开了」「想收拾的网站」 and their English counterparts are rewritten in plain professional language; internal names (“editor”, “toolbar”, “ready-made titles”) are gone from the interface; the delete-failure line and the “a title can't be blank” caveat each have a single source of truth now; three unused copy keys removed

#### Fixed

- The English popup in the set-up state exceeded Chrome's 600px popup limit (English runs longer than Chinese); tightening the card padding brings it back to 588.9px

## [0.8.14] - 2026-11-09

会话保留的边界收口：删掉设置就清场，弹窗里重新打开悬浮按钮就真的出现。

### 中文

#### 修复

- **删掉这个网站的设置后，页面彻底回到原样**：会话标记（这一页挂出过悬浮按钮）一并清掉——之后这个网站即便以「什么都没设置」的形态再出现，页面也不会莫名冒出悬浮按钮
- **在弹窗里重新打开「悬浮按钮」，页面上真的会出现**：从「关」拨到「开」是明确要求这一页有按钮，页面照办（此前刷新过页面再打开开关会出现「弹窗说开着、页面没按钮」）
- 顺手修掉两处会偶发变红的测试断言（等胶囊真的出现再断言、圆点判断改成精确匹配）

### English

#### Fixed

- **Deleting this site’s settings now clears the page completely**: the keep-alive marker is dropped too, so the site coming back with nothing configured no longer makes a floating button appear out of nowhere
- **Turning “Floating button” back on in the popup really brings it back**: switching from off to on explicitly asks for the button on that page, and the page complies (previously, after a reload the popup said “on” while the page had no button)
- Two flaky test assertions fixed as well (wait for the button to actually appear; exact class matching for the step dots)

## [0.8.13] - 2026-11-09

修好一个真机发现的毛病：只开了灰度的网站上，关掉灰度后遮住整页、再恢复，悬浮按钮不见了。

### 中文

#### 修复

- **遮住/恢复之后悬浮按钮还在**：会话保留（按钮在本次浏览期间不因设置清空而消失）现在按「这一页挂出过」判断，而不是「此刻按钮还在不在」——遮住整页与进设置向导都会临时收起按钮，按新判断它们返回时按钮会挂回来
- 同族场景一并修好：关掉灰度后进设置向导、再退出，按钮同样会挂回来

### English

#### Fixed

- **The floating button is back after covering and restoring**: the keep-alive rule now asks “did this page ever show it” instead of “is it on screen right now” — covering the page and opening the wizard both take the button down for a moment, and it now comes back when they close
- The same fix covers the sibling case: unchecking gray, opening the wizard and closing it again keeps the button in place

## [0.8.12] - 2026-11-09

夜间质量循环的第二轮：独立代码审查、全界面视觉巡检与界面准则审查收口，功能不变。

### 中文

#### 修复

- **向导选同类：取消勾选不再弄丢导航**——勾了两组同类时，取消其中一组（哪怕不是亮着的那组），另一组的「第 i / N 个」导航不再消失；换组瞬间强调框也不再闪现在上一组成员上
- **同类号牌的定位标记不再被文案污染**：位置号牌「第 i / N 个」用固定标记，不影响其他测试按号牌前缀统计
- **向导遮罩预览所见 = 保存所得**：预览遮罩底色改用与运行时同一套算法（按被遮元素背后的实际底色计算、圆角跟随），不再硬编码灰色——深色或彩色页面上预览不再与保存后不一致
- **悬浮按钮的图标钮补上读屏名称**：面具主钮与「媒体」钮此前只靠悬停提示当名称（部分读屏不播报），与「遮住」钮统一
- **填实（开启）状态补悬停/按下反馈**：设计规范要求五种状态缺一不可，此前只有关着的状态有
- **失效项按钮统一叫「重新选一次」**：与失效提示、GLOSSARY 同一套叫法；向导文字链命中区垫到 24px
- **文案**：自动播放的视频「被按住」改说「会暂停」；欢迎页第 3 步不再引入「媒体」这个要学的叫法（直接说图片图标）；「盖住」统一为「遮住」；选内容的取消动作统一为「取消选中」（GLOSSARY 登记）

### English

#### Fixed

- **Wizard: unchecking one group no longer kills the other group's navigator**; the highlight no longer flashes on the previous group when switching
- **The position badge no longer leaks localized text into its test id**
- **Wizard mask preview now matches what saving produces**: the preview tint uses the same color logic as the runtime masks (computed from the real background, following the element's radius) instead of a hardcoded gray
- **The floating button's icon buttons have screen-reader names now**, consistent with the cover button
- **The filled (ON) state has hover/pressed feedback**, completing the five required states
- **The stale-row button is now uniformly “Pick again”**, matching the stale hint and the glossary; text links in the wizard get a 24px hit area
- **Copy**: autoplaying videos are “paused” (not “held down”); the welcome page no longer introduces a second name for the gray switch; “cover” unified to the product verb; deselection wording unified

## [0.8.11] - 2026-11-09

欢迎页重排成一步一屏，补上变灰功能的介绍；向导选同类时可以逐个找到了。

### 中文

#### 变更

- **欢迎页分步单屏**：一次只显示一步，内容列放宽到 720px，常态不用滚动；第 2 步补上「图片和视频变灰」的介绍（共四件事），第 3 步按最新胶囊形态重写
- **弹窗新增「重看插件介绍」**：在弹窗底部，随时能回看
- **向导选内容时同类可逐个查看**：勾上「另外 N 个一样的也一起收起」后，行内出现「第 i / N 个」和「上一个 / 下一个」，页面上当前成员用实线框标出并自动滚到视野中央；整组虚线框保留
- **向导面板定宽**：选内容与看效果两步面板宽度不再随内容变来变去

#### 修复

- 欢迎页与插件功能的同步加了一份守门测试：以后加新功能，欢迎页文案没跟上会直接挂测试

### English

#### Changed

- **The welcome page now shows one step per screen**: the content column widens to 720px and fits without scrolling; step 2 now introduces “Turn pictures & videos gray” (four things in all), and step 3 matches the current floating button
- **“See the intro again” in the popup**: the intro is reachable at any time from the popup footer
- **Step through similar matches in the wizard**: after checking “Also hide the other N like this one”, the row shows “i of N” with Previous / Next; the current match on the page gets a solid highlight and is scrolled into view, while the dashed group outline stays
- **Stable wizard width**: the panel no longer resizes as rows appear during picking

#### Fixed

- A guard test now keeps the welcome page in sync: adding a feature without updating the intro fails the tests

## [0.8.10] - 2026-11-09

插件弹窗分组重排：面具开关和它管的两项框进同一张卡，弹窗自己解释悬浮按钮上每颗钮是干嘛的。

### 中文

#### 变更

- **面具卡**：「按你的设置显示」开关成为卡片头部（带与悬浮按钮主钮同源同态的面具图标），卡内是「收起内容」与「标题和图标」两颗钮——看一眼就知道这颗开关管着哪两件事
- 开关关着时，卡内两颗钮置灰暂不可用，卡底一行说明「打开开关就能改」（iOS / Windows 设置的通行做法）
- **灰度卡与悬浮按钮卡**：「图片和视频变灰」「悬浮按钮」也换成同一款卡片容器，三张卡一个样子
- 卡片分组不改任何行为：开关怎么拨、按钮进哪个流程、设置存在哪，全都和之前一样

### English

#### Changed

- **The mask card**: the "Show this site your way" switch now heads a card (with the same mask icon as the floating button's main button), and "Hide items" / "Title & icon" sit inside it — the popup now shows what that switch governs at a glance
- With the switch off, the two buttons inside are paused and a one-line hint says turning the switch back on lets you edit (the usual iOS / Windows settings pattern)
- **Matching cards**: "Turn pictures & videos gray" and "Floating button" use the same card container — one look across the panel
- Pure regrouping: switches, flows and storage behave exactly as before

## [0.8.9] - 2026-11-09

悬浮按钮的图标与开关状态重做：面具不再吓人，开还是关一眼可辨。

### 中文

#### 变更

- **主按钮换威尼斯面具图标**：横长圆润轮廓 + 两道弯眼缝，与产品名 PageMask 对应——旧版实心蛋形加两只小圆眼在 13px 下像骷髅/头套剪影，装机反馈「太吓人」；填实态眼缝镂空，读得出「面具」
- **开关状态整钮填实**：功能开着 = 那颗钮整颗变成墨色底、图标反白（iOS 控制中心同类做法）；关着 = 透明底描边，比开着明显低调。开/关不再只靠 13px 图标内部的填实差异来猜
- 对比发生在胶囊自己的墨底/白底上，任何网页底色下都看得清（深浅主题反色对 ≥11:1）

### English

#### Changed

- **The main button is now a venetian mask icon**: a rounded, horizontal outline with two curved eye slits, matching the PageMask name — the old solid egg shape with two dot eyes read like a skull at 13px and users called it scary; the filled state keeps the eye slits hollow so it still reads as a mask
- **Switch states now fill the whole button**: a feature that is ON turns its button into a solid ink chip with an inverted icon (like iOS Control Center); OFF is an outlined icon on transparent background, clearly quieter than ON. You no longer have to guess from fill differences inside a 13px icon
- The contrast happens on the capsule's own ink/white surfaces, so it stays readable over any web page (inverted pair ≥11:1 in both themes)

## [0.8.8] - 2026-11-09

悬浮按钮去掉拖动把手：整根按钮都能拖，静止宽度再省四分之一。

### 中文

#### 变更

- **拖动不再需要把手**：按住悬浮按钮的任何位置拖动即可移动——按下后移动超过 8 像素才算拖动，不足就是正常点击，按钮不会误触（与 iOS 辅助功能的悬浮球同类做法）；拖动把手整段退场，静止宽度 126 → 约 101 像素，高度 26 不变（无障碍下限）
- **键盘移动保留**：Tab 聚焦到按钮本体后用方向键移动（每次 15 像素），位置照旧按网站记住、拖动越界自动收回视口内
- **触屏补齐**：主按钮在触屏上与其他图标钮一样放大到 40×40（0.8.6 起它漏在放大档外）

### English

#### Changed

- **No more drag handle**: press and drag the floating button anywhere to move it — moving more than 8px after pressing counts as a drag, less is a normal click, so buttons never misfire (the same approach as iOS AssistiveTouch); the handle segment is gone, resting width shrinks from 126 to about 101px, height stays 26 (the accessibility floor)
- **Keyboard moving stays**: Tab to the button body and use arrow keys to move it (15px per press); position is still remembered per site and drags are clamped back into the viewport
- **Touch catch-up**: on touch screens the main button now enlarges to 40×40 like the other icon buttons (it was missing from that tier since 0.8.6)

## [0.8.7] - 2026-11-09

修复：只开了灰度的网站上，在悬浮按钮上关掉灰度会把整根按钮拆掉。

### 中文

#### 修复

- **「只灰度」网站在胶囊上关掉灰度，悬浮按钮不再当场消失**：胶囊挂载判据只在页面加载时评估；会话中间把最后一项设置关掉（胶囊或弹窗均可），已经挂着的按钮当页保留——页面上始终有入口能拨回来；刷新后按判据该藏就藏。「删除这个网站的设置」仍然立即清理页面

### English

#### Fixed

- **Turning gray off from the floating button no longer removes the button itself on gray-only sites**: the mount check now runs only when the page loads. Clearing the last setting mid-session (from the button or the popup) keeps the mounted button for the rest of the page visit, so there is always an entry point to switch back; after a reload the usual visibility rule applies. "Delete this site's settings" still clears the page right away

## [0.8.6] - 2026-11-08

悬浮按钮单一形态：一颗面具主钮、自由定位、把手只在用到时出现。

### 中文

#### 变更

- **主按钮换成面具图标**：填实=按你的设置显示、描边=原样；不再用「圆点+文字」
- **单一形态**：mini 形态、折叠钮与文字标签退场，⋯ 菜单常驻——原来的 mini 用户因此获得拖动与菜单
- **位置自由定位**：不再限制在浏览器两侧，窗口变化自动夹回视口
- **拖动把手悬停才出现**（触屏常显），静止时少一颗钮

### English

#### Changed

- **The main button is now a mask icon**: filled = "Your settings", outline = "As is"; the dot + label pair is retired
- **One single form**: the mini form, collapse button and text label are gone, and the ⋯ menu is always at hand — former mini users gain dragging and the menu
- **Free positioning**: the button is no longer confined to the browser's sides; window changes snap it back into the viewport
- **The drag handle appears on hover only** (always visible on touch), so the resting button carries one less piece

## [0.8.5] - 2026-11-08

没配置过的网站也能在弹窗里直接开「图片和视频变灰」——「只想把信息流变灰」不再需要先走一遍向导。

### 中文

#### 新增

- **弹窗在还没设置过的网站上直接提供灰度开关**：打开它会像第一次设置一样申请这个网站的访问权限，然后 PageMask 补一份只带灰度的配置、当前页面立即变灰、悬浮按钮挂载——收起的内容和标签页标题图标一概不碰
- 这类「只灰度」站点的主按钮暂无可视效果（收起与标题图标都为空），属已知形态；之后通过向导添加收起或标题后照常生效

### English

#### Added

- **The popup offers the gray switch on sites that have never been set up**: turning it on asks for that site's access, first-time-style; PageMask then creates a profile that carries only the gray setting, and the current page turns gray right away with the floating button mounted — nothing about hidden elements or the tab title is touched
- Such gray-only sites show a main button without a visible effect yet (nothing but the gray is configured) — a known shape; adding rules or a title via the wizard later works as usual

## [0.8.4] - 2026-11-08

0.8.3 独立代码审查的收口（一条轻微项）：功能与权限没有变化。

### 中文

#### 修复

- **原样态+灰度的首帧遮挡按时撤掉**：切「原样」时首帧遮挡会换成灰度样式文本，之前落地后没显式撤、靠 1.5 秒兜底超时——极端情况下刷新后立刻进向导，向导里页面会先发灰再突然恢复。现在与清爽态路径对称，正式样式落地即撤

### English

#### Fixed

- **The first-paint shield is released on time in "As is" + gray**: switching to "As is" swaps the shield to the gray stylesheet text, but it was never explicitly released — it relied on a 1.5s fallback. In the worst case, opening the wizard right after a reload showed a gray-tinted page that suddenly regained color. Now symmetric with the "Your settings" path: the shield is released as soon as the formal styles land

## [0.8.3] - 2026-11-08

产品结构修正：「图片和视频变灰」成为完全独立的开关，不再被「按你的设置显示 / 原样」总开关管辖（ADR-0014）。

### 中文

#### 变更

- **主开关收窄**：「按你的设置显示 / 原样」现在只管两件定制——收起的内容、标签页标题和图标。切「原样」= 把你收起的正经内容还给你、标签页回到本来的样子
- **灰度独立**：图片和视频的变灰按自己的开关走，原样态下照常生效——恢复正经内容的时候，页面该低调还是低调；胶囊「媒体」钮在任何状态下按下都有可见反应
- **胶囊顺序**：媒体钮挪到遮住钮前面（全功能与 mini 相同）——媒体是随看随切的高频状态，遮住是应急动作，离主按钮最远
- **媒体钮开启态图标**：只填实框里的山和太阳、外框保持描边（此前整颗填实会糊成一个方块）；弹窗开关行的小图标同步同一套状态
- 灰度的说明文案改为讲独立（不再有「只在按设置时起作用」句）

### English

#### Changed

- **The main switch is narrowed**: 「按你的设置显示 / 原样」 ("Your settings" / "As is") now governs exactly two customizations — what's hidden and the tab title & icon. "As is" gives you back the parts you hid and the site's own title
- **The gray switch is fully independent**: pictures and videos follow their own switch and stay gray in either state — restoring the real content no longer drags the gray along, and the capsule "Media" button always has a visible effect
- **Capsule order**: the Media button now sits before the Cover button (both forms) — a frequently flipped state belongs near the main button, the emergency action farthest away
- **Media button's on-state icon**: only the mountain and sun inside the frame are filled while the frame keeps its stroke (the fully-filled version read as a plain square); the popup's row icon follows the same state
- The gray switch's hint copy now describes its independence

## [0.8.2] - 2026-11-07

0.8.1 修复复查的收尾（无必修项，三条建议全落）：功能与权限没有变化。

### 中文

#### 修复

- **扩展更新后的静音清扫覆盖未配置的站点**：一次性幕布页不在内容脚本重注入范围内，它的残留静音之前要等到下一次导航才解除；现在更新 / 重载时对所有标签页清扫一遍（只解除本扩展设的那份）
- **放行记录随容器子树移出也清掉**：信息流把整张卡片换掉时，卡片里放行过的视频同样不再被内部记录钉住（补子树分支的回归单测）
- **幕布静音的导航兜底与遮 / 撤消息确认共用同一条队列**（补交错回归单测）

### English

#### Fixed

- **The update-time mute sweep now covers unconfigured sites**: a one-shot curtain page is not in the content-script reinjection range, so its leftover mute used to wait for the next navigation; updates and reloads now sweep every tab (only the extension's own mute is removed)
- **Allow records clear with the subtree**: when a feed swaps out a whole card, a video the user unblocked inside it is no longer pinned by the internal record (regression test for the subtree branch added)
- **Regression tests for the navigation fallback sharing the same per-tab queue** as cover / restore messages

## [0.8.1] - 2026-11-07

0.8.0 发版后独立代码审查的收口，都是特定操作顺序下才会碰到的状态问题；功能与权限没有变化。

### 中文

#### 修复

- **放行过的视频被信息流移出文档后不再被钉住**：内部记录会随元素移出页面一并清掉；同一个视频再插回来按新一轮算，超出去过的点击窗口后自动播放重新被压制（补回归单测）
- **快速连按遮住 / 恢复不再留下哑掉的标签页**：同一标签页的静音写入改为按消息到达顺序串行执行，连发时最终状态 = 最后一条消息的方向（补三连发回归单测）
- **扩展更新 / 重载瞬间不再残留静音**：上一个实例在幕布静音中失效时它的解除消息发不出去；新实例启动时补一次单向解除（只解除本扩展设的那份）
- 测试稳定性：滚动跟手断言由固定两帧改为「3 秒内追上」，不再因 scroll 事件与动画帧的先后抖动而误报

### English

#### Fixed

- **A video you unblocked is no longer pinned after the feed removes it**: the internal record is cleared together with the element leaving the page; if the same video element comes back it starts a new round, and autoplay is held again once your click window has passed (regression test added)
- **Rapid cover / restore no longer leaves a muted tab behind**: mute writes for one tab now run serially in message order, so the final state always matches the last message (regression test added)
- **No mute residue across extension updates / reloads**: when the previous instance dies under the curtain its unmute message dies with it; the new instance releases any leftover of ours when it starts
- Test stability: the scroll-follow assertion now waits up to 3 seconds instead of a fixed two frames, so it no longer misfires on scroll-event / animation-frame jitter

## [0.8.0] - 2026-11-07

按网站的「图片和视频变灰」一个开关取代 0.7.x 的三个开关；遮住整页时连声音一起按住。旧设置自动迁移，不新增任何权限。

### 中文

#### 新增

- **图片和视频变灰**：一个按网站记的开关。图片和视频变成黑白的，位置不变、大小不变、链接还能点、截图里的字还能看清——整个页面从花花绿绿降到像一篇图文资料；≤32px 的小图标与表情保持原样。声音完全不参与：音量归播放器自己的按钮和 Chrome 右键标签页「静音网站」
- **自动播放的视频被按住**：站点自己让视频播起来的（X 刷信息流那种自动播放）一律按停，页面上没有会动的东西；你点击某个视频区域，那一个视频就放行正常播放，画面保持黑白。被按停的视频不替网站恢复播放
- **遮住这一页连声音一起按住**：幕布遮住哪个标签页就静哪个标签页，恢复（或刷新、离开页面）时声音跟着回来；只解除本扩展设的那份静音，你自己用 Chrome 右键或播放器静音的不受影响。没添加过的网站用弹窗遮住，同样连声音一起遮
- **胶囊上的「媒体」钮**：全功能与 mini 形态都有，一点就变灰 / 还原；弹窗一行开关、站点设置页「图片和视频」卡，三处是同一组设置。弹窗重排：「遮住这一页」带上与胶囊同源的闭眼 / 睁眼图标、媒体开关行带上媒体图标

#### 变更

- **0.7.x 的「收起图片 / 收起视频 / 静音网页」三个开关退场**：原来开着收起图片或收起视频的网站，升级后自动等于「图片和视频变灰」开着；「静音网页」的常设开关不再提供——想让某个网站一直没声，用 Chrome 自带的右键标签页「静音网站」（按域名持久）。悬浮按钮「⋯」菜单里的媒体三行随之移除

#### 说明

- 「变灰」只是去掉颜色：图片 / 视频请求照发，不省流量、不代替广告过滤工具；CSS 背景图、iframe 内嵌播放器、`<canvas>`、内联 SVG 不变灰
- 不新增权限：黑白观感是一条样式表，幕布静音用 Chrome 自带的标签页静音（不需要 `tabs` 权限，只解除本扩展设的那份）

### English

#### Added

- **Turn pictures & videos gray**: one per-site switch. Pictures and videos turn black & white — same place, same size, links still work, text in screenshots stays readable — and a loud feed reads like a quiet article; icons and emoji up to 32px stay as they are. Sound is not touched at all: volume belongs to the player's own button and Chrome's "Mute site"
- **Autoplaying videos are held down**: videos the site starts by itself (a scrolling feed on X, for example) are paused, so nothing on the page moves; click a video and that one plays normally, still in black & white. Videos we paused are not resumed for the site
- **Covering a page holds its sound**: the tab under the curtain is muted; uncovering, reloading or leaving the page brings the sound back. Only the mute this extension set is removed — a mute you set via Chrome or the player is untouched. It works on sites you have not added too (cover from the popup)
- **A "Media" button on the floating capsule**: both the full and mini forms have it — one click turns the gray on or off. The popup gets one switch row and the site's settings page a "Pictures & videos" card, all the same setting. The popup is re-laid out, and its "Cover this page" button and gray switch now carry the same icons as the capsule

#### Changed

- **The 0.7.x "Hide images / Hide videos / Mute this page" switches are retired**: a site that had hiding enabled automatically becomes "gray" after the update; the always-on mute switch is gone — to keep a site silent, use Chrome's own right-click "Mute site" (persistent per site). The floating menu's three media switches are removed accordingly

#### Notes

- "Gray" only removes color: image and video requests still happen — not a data saver, not an ad blocker; CSS background images, embedded players inside iframes, `<canvas>` and inline SVG are not grayed
- No new permissions: the black & white look is one stylesheet, and the curtain mute uses Chrome's own tab mute (no `tabs` permission; only the extension's own mute is ever removed)

## [0.7.1] - 2026-11-06

0.7.0 发版后复查的一批收口，都是特定操作顺序下才会碰到的状态还原问题；功能、界面用词与权限都没有变化。

### 中文

#### 修复

- **删掉某个网站的设置，不会把别的标签页重新静音**：此前手动取消过静音的标签页，删除别的网站时不再被按回去；只解除本扩展设置、且按当前设置已经不该继续静音的那一份
- **收回站点权限、整体导入替换设置时也不留哑掉的标签页**：这两条删除类路径现在和「删除这个网站的设置」一样收尾
- **小图标判定更稳**：一律按页面上实际显示的尺寸算；还没排好版时宁可先灰一帧，等图片加载完或样式变了再重判，写着小尺寸、实际被放大的大图不会再漏出来
- **视频被替换、开关反复拨动、播放器在页面里挪位置都能正确还原**：挪位置不再被当成移除，静音不会闪断；关掉开关时放回这一轮开始前的声音状态
- **图片加载完立刻重判**：懒加载的小图标不再一直灰着，不必等页面上恰好还有别的变动
- **界面与商店材料的小处收口**：讲整组开关的那句话和每行的说明分开、菜单未选中项也有看得见的空框、三处开关分组让读屏软件认得；商店材料如实写明会读取标签页地址、菜单默认项数与实际一致

### English

#### Fixed

- **Deleting one site's settings no longer re-mutes other tabs**: a tab you had manually unmuted is no longer muted again when you delete a different site. PageMask only removes the mute it set itself when the current settings no longer call for it
- **No muted tabs left behind** when site permission is revoked or an import replaces all settings; both paths now clean up the same way as deleting a site's settings
- **Small-icon detection is more reliable**: it always uses the size actually shown on the page. Until an image is laid out it stays grey for a frame, then re-checks after loading or a style change, so a large image declared as 16×16 cannot slip through
- **Videos restore correctly** when replaced, when switches are flipped repeatedly, and when a player is moved around the page. Moving a player is no longer treated as removal, so sound does not flicker back; turning a switch off restores the sound state from the start of that round
- **Images are re-checked as soon as they load**: lazy-loaded small icons no longer stay grey until something else happens to change the page
- **Interface and store-listing polish**: the note about the whole group is separated from the per-switch notes, unselected menu items show a visible empty box, all three switch groups are announced properly by screen readers, and the store listing now states accurately that tab URLs are read and matches the menu's real item count

## [0.7.0] - 2026-11-06

给每个网站加了三个独立开关：收起图片、收起视频、静音网页。三处入口是同一组设置，只在「按你的设置显示」时起作用。

### 中文

#### 新增

- **收起图片**：网页上的图片变成灰块，位置不变、链接还能点，按钮上的小图标与表情保持原样。这是「看起来收起」，图片请求照发，不省流量、不代替广告过滤工具
- **收起视频**：视频变成灰块，并且暂停、不出声。网站脚本反复调播放也会被按住；切回原样时只把声音放回改动前的状态，不替网站恢复播放
- **静音网页**：用 Chrome 自带的标签页静音让这个标签页不出声，画面照常，标签页上会出现静音的小喇叭。只解除本扩展设置的那一份静音，不动你手动静音、Chrome 自带的「静音网站」或其他扩展设置的静音
- **三处入口，同一组设置**：站点设置页新增「图片、视频和声音」卡片（每行一句说明），弹窗底部收成一组三行，悬浮按钮「⋯」菜单新增一组带勾选标记的开关（点一下不关菜单，可以连着拨几个）。改哪一处，另两处和页面效果都跟着变
- **原样态连声音一起还原**：切「原样」会把灰块、视频停播、标签页静音一并还原；切回「按你的设置显示」重新生效。删除这个网站的设置也不会留下哑掉的标签页
- **不新增权限**：标签页静音走浏览器自己的开关，不需要 `tabs` 权限；没有拦请求、没有新增主机权限。已知边界写进界面说明、README 与商店材料

### English

#### Added

- **Hide images**: pictures turn into grey blocks that stay in place with their links still working; small icons on buttons and emoji are left alone. This changes only what you see — image requests still happen, so it is neither a data saver nor an ad blocker
- **Hide videos**: videos turn into grey blocks, pause and go silent. Repeated calls to play by the site's own scripts are held back too. Switching back restores the previous sound state rather than resuming playback for the site
- **Mute this page**: uses Chrome's own tab mute so the tab makes no sound while the picture stays as it is (Chrome shows a muted speaker icon on the tab). PageMask only removes the mute it set itself and leaves your own mute, Chrome's "Mute site" and other extensions' mutes alone
- **Three places, one set of settings**: a "Pictures, videos & sound" card on the site's settings page (a plain-language note under each switch), a compact three-row group at the bottom of the popup, and a group of ticked switches in the floating button's "⋯" menu (which stays open so you can flip several). Change any one of them and the other two and the page follow
- **"As is" brings the sound back too**: switching to the original view restores the grey blocks, the paused/silenced videos and the tab mute together; switching back applies them again. Deleting a site's settings does not leave a muted tab behind
- **No new permissions**: tab mute uses the browser's own switch and needs no `tabs` permission; no requests are blocked and no host permission was added. The limits are spelled out in the interface, the README and the store listing

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
