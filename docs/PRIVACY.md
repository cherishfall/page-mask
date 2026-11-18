# PageMask 隐私政策 / Privacy Policy

生效日期 / Effective: 2026-10-27 · 最后更新 / Last updated: 2026-11-18

PageMask 是一个 Chrome 扩展：在你添加的网站上收起选中的页面内容，把整页变成黑白，遮住整页并静音这个标签页，也能改这个网站的标签页标题和图标。这份政策说明它处理哪些数据。
PageMask is a Chrome extension that hides page elements you choose on sites you add, can turn the whole page gray, can cover the page and mute its tab, and can set a tab title and icon for the site. This policy explains what data it handles.

> 下方为英文全文（Chrome 应用商店的官方口径），其后是中文译文，两者内容一致。
> The English text below is the canonical version for the Chrome Web Store; a Chinese translation follows. Both say the same thing.

## English

### Summary

PageMask does not send any data to the developer or to anyone else. There is no server, account, analytics or advertising. It loads no external scripts or remote code and makes no network requests. All code ships inside the extension package (open-source notices in [THIRD_PARTY_NOTICES](../public/THIRD_PARTY_NOTICES.txt)); everything described below stays in your own browser.

### Data stored on your device

Only for sites you add, PageMask stores in your browser's local extension storage (`chrome.storage.local`):

- the site's address (subdomains under the same registrable domain count as one site, e.g. `weibo.com`; IP addresses, `localhost` and addresses with a port are stored as-is);
- your hide rules: the CSS selectors that locate the elements you picked (short rules that point at page elements), a short label (auto-filled from the element's text or the name screen readers announce, editable, at most 60 characters), the hiding method, and the pages it applies to (a URL path prefix, if you chose one);
- the tab title and icon image you set for that site, and the site's on/off state;
- one per-site switch for "Turn the whole page gray" (whether the entire page is shown in black & white);
- the position of the on-page button, and whether each rule still found its element the last time the page was opened (with a timestamp);
- local interface preferences: whether the on-page button is shown on that site, the display language of PageMask's own pages, and the button's opacity;
- one global default tab title.

To work, PageMask reads the page structure locally on sites you added: to let you pick elements, to check that your settings still match, and — only while the gray switch is on — to pause videos the site autoplays. That page content is not stored except for the short label above, and is never transmitted.

Covering the page ("Cover this page") also mutes that tab using Chrome's own tab mute. That state is held by the browser on the tab, not stored by PageMask; it is not synced, not uploaded, and does not add a `tabs` permission. The mute lasts only while the page is covered: uncovering, refreshing or leaving the page removes it. PageMask only removes the mute it set itself, and does not touch a mute you or another extension set.

### What we don't do

We do not upload, sell or share any data. Your data is not used for advertising, profiling, credit or lending. PageMask's use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

### Permissions

- `storage`: saves the settings above locally.
- `activeTab`: when you open the popup, reads the current tab's URL to identify the site.
- `scripting`: used only after you enable a site, to run PageMask's own code there and apply your settings, including the gray styles and pausing autoplay videos while the gray switch is on.
- Per-site host access: requested one site at a time, only when you enable that site; PageMask never runs on a site you haven't allowed. The gray switch adds no permission.

### Retention and your controls

Data stays until you remove it. "Delete this site's settings" in the management page deletes that site's settings and removes its access permission. Uninstalling PageMask deletes all of its stored data. "Export" creates a file you save yourself; PageMask cannot access or delete it afterwards. You can also remove a site's access under "Site access" on Chrome's extension details page.

### Children

PageMask is not directed at children and does not knowingly handle children's personal information.

### Changes

If this policy changes, the new version will be published at this URL with an updated date, and changes will be noted in the release notes ([CHANGELOG.md](../CHANGELOG.md)).

### Contact

Email: cherishfall@hotmail.com · Issues: https://github.com/cherishfall/page-mask/issues

Online version of this policy: https://cherishfall.github.io/page-mask/privacy.html — the same policy, on the web.

## 中文

### 概要

PageMask 不向开发者或任何第三方发送任何数据。它没有服务器、没有账号、没有统计、没有广告；不加载任何外部脚本或远程代码，也不发起网络请求。全部代码都在扩展包里（开源库清单见 [THIRD_PARTY_NOTICES](../public/THIRD_PARTY_NOTICES.txt)）；下面说的一切都只留在你自己的浏览器里。

### 保存在你设备上的数据

只针对你主动添加的网站，PageMask 会在浏览器的扩展本地存储（`chrome.storage.local`）里保存：

- 网站地址（同一个主域下的子域算同一个网站，例如 `weibo.com`；IP 地址、`localhost` 和带端口的地址按原样保存）；
- 你的收起规则：用来找到你所选元素的 CSS 选择器（一段定位网页元素的小规则）、一个短标签（按元素文字或读屏软件读到的名称自动填好，可以修改，最长 60 个字符）、收起方式，以及生效的页面（如果选了某一类页面，就是一段网址路径前缀）；
- 你为该网站设置的标签页标题与图标图片，以及该网站的开关状态；
- 该网站的一个开关：「整页变灰」（该网站是否整页黑白显示）；
- 页面内按钮的位置，以及每条规则上次打开页面时是否还能找到目标（带时间戳）；
- 本机的界面偏好：该网站是否显示页面内按钮、PageMask 自己界面的显示语言、按钮的不透明度；
- 一个全局默认的标签页标题。

PageMask 需要在你添加的网站上读取页面结构，全部在本机完成：让你点选元素、核对保存的设置是否还找得到目标；只在变灰开关打开期间，还会用来暂停自动播放的视频。除了上面那个短标签，页面内容不会被保存，也不会被发送出去。

遮住整页（「遮住这一页」）时，会用 Chrome 自带的标签页静音把这个标签页静音。静音状态由浏览器记在标签页上，PageMask 不保存；不同步、不上传，也不需要 `tabs` 权限。遮住期间才静音：撤掉遮住、刷新或离开页面，静音就解除。PageMask 只解除自己设置的静音，不会动你或别的扩展设置的静音。

### 我们不做的事

我们不上传、不出售、不分享任何数据。你的数据不会被用于广告、画像、信用评估或放贷。PageMask 对数据的使用符合 Chrome 应用商店的用户数据政策，包括 Limited Use 要求。

### 权限

- `storage`：在本地保存上述设置。
- `activeTab`：打开 popup 时读取当前标签页的网址，用来判断是哪个网站。
- `scripting`：只在你开启某个网站时使用，用来在这个网站上运行 PageMask 自己的代码、应用你的设置，包括变灰样式，以及变灰开关打开期间暂停自动播放的视频。
- 按网站的主机权限：只在你开启某个网站时，针对这一个网站申请；没允许的网站不会运行。变灰开关没有带来新权限。

### 保留期限与你掌握的操作

数据一直保留，直到你删掉它。在管理页对某个网站点「删除这个网站的设置」，会删掉该网站的设置并收回访问权限；卸载 PageMask 会删除它保存的全部数据；「导出」生成的文件由你自己保存，PageMask 之后读不到也删不掉。你也可以在 Chrome 扩展详情页的「网站访问权限」里移除某个网站的权限。

### 儿童

PageMask 不面向儿童，也不会在知情的情况下处理儿童的个人信息。

### 变更

如果本政策发生变化，新版本会发布在这个网址上并更新日期，变更也会写进[更新日志](../CHANGELOG.md)。

### 联系方式

邮箱：cherishfall@hotmail.com · 问题反馈：https://github.com/cherishfall/page-mask/issues

本政策的在线版本：https://cherishfall.github.io/page-mask/privacy.html —— 同一份政策的网页版。
