# 按站点的图片 / 视频 / 声音三个开关

日期：2026-11-06 · 状态：已采纳 · 相关：ADR-0002（规则模型与样式表注入）、ADR-0004（本地存储）、ADR-0005（按文档注入与首屏遮挡）、issue#116

## 背景

「收起内容」针对的是用户点选的**具体元素**。issue#116 要再加三个整站级的开关：收起图片、收起视频、静音网页。它们针对的是**一类元素 / 一路声音**，不在规则模型里，且必须能一键彻底还原。

调研存档 `docs/dev/research-media-hiding.md` 给出两条硬约束：

- 微博 App 无图模式、X Data Saver、Reddit Low data、Telegram 的共同形态是**灰块占位**：布局不动、链接还能点、页面不塌。Text Mode 与 Chrome 站点禁图的裂图 / 布局塌是同类扩展的两大差评形态；HoverBlurr 等还会**豁免小图标**，因为按钮图标、表情全变灰方块会让页面显得坏了。
- `display:none` / `filter` 都**不会暂停 `<video>` 播放**。只把画面收起来、声音还在响，比不收更糟；站点脚本反复调 `play()` 也要压得住。

平台事实（已核实）：`chrome.tabs.update({ muted })` 不需要 `tabs` 权限；`Tab.mutedInfo.reason` 可取 `user` / `capture` / `extension`，`extensionId` 标明是哪个扩展设置的（Chrome 46+）。Chrome 自带的「静音网站」是按域名持久的站点权限，与扩展的标签页级静音互不覆盖。

## 决定

1. **三个字段，显式 `true` 才落库**：`hideImages? / hideVideos? / mutePage?` 存在站点配置里，缺省 = 不收起。关掉写 `undefined`（字段消失），不留一个要额外解释的 `false`。三者都是真实用户设置，参与 `updatedAt` 与导入合并；旧数据不需要迁移，导出文件结构不变。
2. **灰块并入既有用户样式表通道**：`filter: brightness(0) invert(N) !important` + `background-color`（让透明 PNG 也落成一整块灰），浅色 / 深色各一套灰度。CSS 文本由 `buildMediaCss()` 生成并**并进 `buildDisguiseCss()`**，继续走 `insertCSS` / `removeCSS` 的 `origin: 'USER'` 通道（ADR-0002）；首屏遮挡用同一份文本，向导预览不传媒体参数，因此点选时页面是真图。不用 `display`、不用 `visibility`、不动 `pointer-events`。
3. **CSS 管不了的两件事交给内容脚本，且只在开关打开期间挂监听**：
   - 小图豁免：CSS 没法按渲染尺寸选元素，给 ≤32px 或 emoji 的 `img` 打 `data-pm-media-keep`，选择器用 `:not()` 放行。尺寸未知时先灰着，`load` 后重新判定。
   - 视频：扫到 `video` 就 `pause()` + `muted = true`，并在 `document` 捕获阶段拦 `play` 事件（play 不冒泡但经过 document）。不包 `HTMLMediaElement.prototype.play`、不装轮询。还原时按改之前的值放回 `muted`，**不替网站恢复播放**。
4. **静音走浏览器自己的标签页静音**：`chrome.tabs.update(tabId, { muted })`。目标状态由后台按当前存储与 `sender.tab.id` 算，消息不带方向、不带站点。解除前必须核对 `mutedInfo.reason === 'extension' && extensionId === 本扩展`，不抢用户手动静音、Chrome 自带「静音网站」或其他扩展设的静音。用户手动取消静音后不追着按回去。`tabs.onUpdated` 只在**地址变化**时对账，避免每次页面加载都唤醒后台（零影响铁律）。
5. **只在「按你的设置显示」时生效**，切「网站原样」把画面、视频静音、标签页静音一起还原；删除这个网站的设置先还原声音再收尾，不留哑掉的标签页。
6. **三处入口共用一份键与文案**：`MEDIA_FLAG_KEYS` 是唯一的键 / 顺序来源，`mediaFlagPatch()` 是唯一的写入口径；站点设置页、弹窗、悬浮按钮「⋯」菜单都从它渲染。菜单刻意不是 `role="menu"`，所以勾选项用 `role="switch" + aria-checked` + 可见勾选标记，而不是孤立的 `menuitemcheckbox`（WCAG 4.1.2）。
7. **如实告知边界**：这是「看起来收起，不是不加载」，图片请求照发；背景图、iframe 内嵌播放器、`<canvas>`、内联 SVG 本期不收；静音是标签页级而非网站级，离开该网站会自动恢复。边界写进界面说明、README 与商店材料，不夸大。

## Considered Options

- **用 declarativeNetRequest 拦掉图片 / 媒体请求**：否决。要新权限、安装时多一条警告，违背零影响与最小权限；「关掉就回来」还得重新发请求，还原不可靠；本期产品要的是保布局的灰块，不是省流量。
- **`display:none` / `visibility:hidden`**：否决。布局塌、链接点不到，正是调研里的差评形态。
- **逐元素盖遮罩**：否决。一条用户样式表规则就能覆盖无限滚动新增的所有元素，逐元素要常驻扫描，代价高得多。
- **给菜单项加 `role="menuitemcheckbox"`**：否决。现有菜单不是 `role="menu"`（方向键导航契约没实现），孤立使用会让读屏读到没有父菜单的菜单项。
- **后台用存储记录「本扩展静音过哪些标签页」**：否决。SW 无状态是既有架构决定，且 `MutedInfo` 已经把归属写在标签页上了。
- **小图标也一起变灰**：否决。调研里这是明确的坏相形态，产品所有者拍板「留原样」。
- **弹窗只放主按钮、三个开关只在管理页**：否决。对照 uBlock 面板与 Dark Reader 弹窗，多个并列开关是成熟做法；「一屏一个主操作」约束的是实心主按钮，开关不在此列。

## Consequences

- `core/types.ts` / `validate.ts` / `apply-key.ts` 三处必须同时加字段，否则拨开关不会即时生效；这条已写进 `HANDOFF.md` 硬约束。
- 内容脚本多一个只在开关打开期间存在的 `MutationObserver`；未开启的页面与未添加的网站没有任何新增开销。
- 标签页静音是**会话级、标签页级**：用户手动取消后扩展不追回，直到下次拨开关 / 切两态 / 换地址才重新按设置来。
- 画面与视频的还原路径分散在 `applyAll` / `restoreAll` / `clearPageUi` / `openWizard` / `teardown` 五处，任一处漏掉都会留下灰块或停播的视频；`tests/e2e/check-media.mjs` 用真机覆盖「原样全还原 → 切回来全生效」。**标签页静音是例外，且是刻意的**：`openWizard` 只临时还原画面与视频，不解除标签页静音——向导是点选界面，用户在这里不需要听声音，退出后由 `applyAll` 按存储重新对账即可，不会永久残留。
- 删除某个网站的设置时只做**单向**解除静音（#125）：`releaseMute()` 绝不写 `muted:true`，否则删除站点 B 会把站点 A 上用户手动取消的静音按回去。
- 「该不该静音」的前提包含**站点权限仍在**（#130）：用户在 Chrome 扩展详情页收回访问权时配置不会删，只看配置会让 `permissions.onRemoved` 的收尾空转，双向对账还可能把这个标签页重新静音。`shouldMute()` 用 `permissions.contains` 核对 origin；`releaseMute()` 依旧只单向解除，重新授予权限后由现有 `syncMute` 对账恢复。
- 真机 E2E 抓到一个实现回归：视频还原时清了「改过的视频」集合却没删「原静音值」记录，导致「开 → 关 → 再开 → 再关」第二次还原失效。修法见 `ui/media-controller.ts` 的 `restoreVideos()`，并补了循环回归单测——这条说明媒体这类有状态的 DOM 改写必须按「一轮一清」设计。
