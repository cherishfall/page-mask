# 开发日志（DEVLOG）

按时间倒序记录开发过程中的关键事件、超出 `docs/design.md` 范围的临时决策及其理由。正式的架构决策写 `docs/adr/`，这里只记过程。

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
