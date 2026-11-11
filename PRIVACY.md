# PageMask 隐私政策 / Privacy Policy

生效日期 / Effective: 2026-10-27 · 最后更新 / Last updated: 2026-11-11

PageMask 是一个 Chrome 扩展：在你主动添加的网站上收起你选择的页面元素，可把图片 / 视频变成黑白的（变灰），遮住整页时连标签页声音一起按住，也可为该网站设置标签页标题与图标。本政策说明它处理哪些数据。
PageMask is a Chrome extension that hides page elements you choose on websites you add, can turn pictures and videos gray, hold a tab's sound together with the full-page cover, and set a tab title and icon for that site. This policy explains what data it handles.

> 下方为英文全文（Chrome 应用商店的官方口径），其后是中文译文，两者内容一致。
> The English text below is the canonical version for the Chrome Web Store; a Chinese translation follows. Both say the same thing.

## English

### Summary

PageMask does not send any data to the developer or to anyone else. There is no server, account, analytics, advertising or third-party code. Everything described below stays in your own browser.

### Data stored on your device

Only for sites you add, PageMask stores in your browser's local extension storage (`chrome.storage.local`):

- the site's identity (its registrable domain, e.g. `weibo.com`; IP addresses, `localhost` and addresses with a port are kept as-is);
- your hide rules: CSS selectors that identify the elements you picked, a short label (up to 8 characters taken from the element's text or accessibility label, which you can edit), the hiding method, and the pages it applies to (a URL path prefix, if you chose one);
- the tab title and icon image you set for that site, and the site's on/off state;
- one per-site switch for "Turn pictures & videos gray" (whether the media on that site is shown in black & white);
- the position of the on-page button, and whether each rule still found its element the last time the page was opened (with a timestamp);
- one global default tab title.

To work, PageMask reads the page structure locally on sites you added (to let you pick elements, to check that rules still match, and — only while the gray switch is on — to tell small icons from large images and to hold videos that autoplay). That page content is not stored except for the short label above, and is never transmitted.

Covering the page ("Cover this page") also mutes that tab using Chrome's own tab mute. That mute state is held by the browser on the tab, not stored by PageMask; it is not synced, not uploaded, and does not add a `tabs` permission. The mute lives exactly as long as the cover: uncovering, refreshing or leaving the page removes it. PageMask only removes the mute it set itself, and does not touch a mute you or another extension set.

### What we don't do

We do not collect, transmit, sell or share any data. Your data is not used for advertising, profiling, credit or lending. PageMask's use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

### Permissions

- `storage`: saves the settings above locally.
- `activeTab`: when you open the popup, reads the current tab's URL to identify the site.
- `scripting` and per-site host access: requested one site at a time, only when you enable that site, and used only to apply your settings there — including the gray styles and the on-page autoplay hold while the gray switch is on. The gray switch adds no permission.

### Retention and your controls

Data stays until you remove it. "Delete this site's settings" (「删除这个网站的设置」) in the management page deletes that site's settings and removes its access permission. Uninstalling PageMask deletes all of its stored data. "Export" creates a file you save yourself; PageMask cannot access or delete it afterwards. You can also remove a site's access under "Site access" on Chrome's extension details page.

### Children

PageMask is not directed at children and does not knowingly handle children's personal information.

### Changes

If this policy changes, the new version will be published at this URL with an updated date, and changes will be noted in the release notes ([CHANGELOG.md](CHANGELOG.md)).

### Contact

Email: cherishfall@hotmail.com · Issues: https://github.com/cherishfall/page-mask/issues

## 中文

### 概要

PageMask 不向开发者或任何第三方发送任何数据。它没有服务器、没有账号、没有统计、没有广告、没有第三方代码。下面描述的一切都只留在你自己的浏览器里。

### 保存在你设备上的数据

只针对你主动添加的网站，PageMask 会在浏览器的扩展本地存储（`chrome.storage.local`）里保存：

- 网站身份（可注册域名，例如 `weibo.com`；IP 地址、`localhost` 与带端口的地址按原样保留）；
- 你的收起规则：用来定位你所选元素的 CSS 选择器、一个短标签（最多 8 个字符，取自元素文字或无障碍名称，你可以修改）、收起方式、生效页面（如果你选了某一类页面，就是一段网址路径前缀）；
- 你为该网站设置的标签页标题与图标图片，以及该网站的开关状态；
- 该网站的一个开关：「整页变灰」（该网站是否整页黑白显示）；
- 页面内按钮的位置，以及每条规则最近一次打开页面时是否仍找到目标（带时间戳）；
- 一个全局默认的标签页标题。

为了工作，PageMask 会在你添加的网站上于本地读取页面结构（让你点选元素、核对规则是否仍然命中；只在变灰开关打开期间，还会用来按住自动播放的视频）。除上面那个短标签之外，页面内容不会被保存，也永远不会被发送出去。

遮住整页（「遮住这一页」）时会把该标签页静音，用的是 Chrome 自带的标签页静音。这个状态由浏览器记在标签页上，不由 PageMask 保存；不同步、不上传，也不需要 `tabs` 权限。静音与幕布同生共死：撤幕布、刷新或离开页面即解除。PageMask 只解除自己设置的那一份静音，不会动你或别的扩展设置的静音。

### 我们不做的事

我们不收集、不传输、不出售、不分享任何数据。你的数据不会被用于广告、画像、信用评估或放贷。PageMask 对数据的使用符合 Chrome 应用商店的用户数据政策，包括 Limited Use 要求。

### 权限

- `storage`：在本地保存上述设置。
- `activeTab`：打开 popup 时读取当前标签页的网址，用来判断是哪个网站。
- `scripting` 与按网站的主机权限：只在你开启某个网站时，针对这一个网站申请，并且只用于在该网站上应用你的设置——包括变灰样式，以及变灰开关打开期间对自动播放视频的按停。变灰开关没有带来新权限。

### 保留期限与你掌握的操作

数据一直保留，直到你删掉它。在管理页对某个网站点「删除这个网站的设置」，会删除该网站的设置并收回它的访问权限；卸载 PageMask 会删除它保存的全部数据；「导出」会生成一个由你自己保存的文件，PageMask 之后无法读取或删除它。你也可以在 Chrome 扩展详情页的「网站访问权限」里移除某个网站的权限。

### 儿童

PageMask 不面向儿童，也不会在知情的情况下处理儿童的个人信息。

### 变更

如果本政策发生变化，新版本会发布在这个网址上并更新日期，变更也会写进[更新日志](CHANGELOG.md)。

### 联系方式

邮箱：cherishfall@hotmail.com · 问题反馈：https://github.com/cherishfall/page-mask/issues
