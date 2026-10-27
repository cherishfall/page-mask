# 页内界面宿主走用户样式表保护 + 扩展更新后新实例接管

页内界面（悬浮切换按钮、页面内编辑面板、设置向导、遮罩覆盖层）各挂在一个自定义元素宿主上（`pagemask-toggle` 等），界面在宿主的 open shadow root 里。宿主自身的样式由后台以**用户样式表**（`insertCSS origin:'USER'`，与正式隐藏样式同一通道，ADR-0002）注入一份固定的「宿主保护样式」：`all:initial`、`direction:ltr`、`display:block`、`position:fixed`、0×0、`z-index` 等全部 `!important`。用户层 `!important` 高于页面作者层 `!important`，页面的 `html>div`、`div:empty`、`body~*`、`*{line-height/direction/color}` 都改不了宿主，也不会经宿主继承进 shadow。保护样式与正式样式分开记录（`core/doc-styles.ts` 第三份记录），原样态下照样保留，只在一键清空时撤掉。

内容脚本改用 WXT `ContentScriptContext`：监听、定时器、空闲回调由 ctx 托管，ctx 失效即收尾（撤下界面、还原标题图标、冻结样式记录）。扩展更新 / 重载后，后台向已配置且已授权站点的已打开标签页重新注入内容脚本，新实例接管：

- **同一隔离环境**（同一扩展实例重复注入）：旧实例经 `window.__pagemask.handover()` 交出样式记录，新实例从它继续。
- **扩展更新 / 重载**：实测新脚本落在**另一个**隔离环境，看不到旧实例的 `window`，WXT 的「新脚本启动」通知（靠 `CustomEvent.detail` 识别）也收不到。新实例广播一个不带数据的 DOM 事件，旧实例读 `ctx.isValid`（`runtime.id` 已消失）随即收尾；样式按推断接手：启动时用探针读保护样式里的标记属性，有则说明旧实例留下了样式，新实例先插自己的一份，再请后台按当前配置各删一份旧的（实测同一文本注入几次就要删几次，所以先插后删不闪）。

## Considered Options

- **WXT `createShadowRootUi`**：没有直接用。它是 async 的（运行时的挂载 / 卸载在一条串行链里同步完成），往 shadow 里塞 `<style>`（我们沿用共享的可构造样式表），遮罩覆盖层也要同一套宿主。自写的 `ui/page-host.ts` 与它等效（自定义元素宿主、shadow 内重置、按键隔离、`ctx.onInvalidated(remove)`）。
- **只靠 `:host{all:initial}` / 宿主行内样式**：被否决。两者都打不过页面作者层的 `!important`（REVIEW N40）。
- **closed shadow root**：没有采用。open 便于调试和 E2E；页面脚本本就能找到宿主元素。
- **扩展更新后不重新注入，只靠旧实例自检失联**：不够。失联没有任何事件，旧按钮会一直留到用户切换标签页或点它；旧实例注入的隐藏样式也没人能删（新扩展实例不知道原文）。参考 Dark Reader 的做法，更新后对已打开页面重新注入。
- **后台按 documentId 在 storage 里记样式**：被否决，违背 ADR-0005 的「后台无状态」，且文档关闭没有通知，记录只增不减。

## Consequences

- 页面无法用 CSS 隐藏或改变插件界面；页面脚本仍可直接删除宿主元素（不防）。
- 扩展更新后，已打开的已配置站点页面不刷新即由新版本接管。推断接手的局限：旧实例停在向导预览中时，预览样式文本推断不出来，会留到页面刷新；更新前后隐藏样式的生成规则变了（css-builder 改动）时，旧的正式样式同样会留到刷新。
- 宿主标签名固定，页面能借此探测到插件（与此前固定 id 相同，REVIEW N28）。
- 按键隔离只拦冒泡阶段：站点若在 window / document 的**捕获**阶段绑快捷键，输入时仍会触发。
