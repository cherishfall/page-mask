# HANDOFF — PageMask 交接文档

> 写于 2026-10-26 上午（通宵冲刺 + 商店资料两轮收尾后）。供下一任 agent/工具或未来的我快速接手。读完本文件 + `AGENTS.md` + `docs/design.md` 即可开工。

## 一句话现状

**V1（0.1.0）功能完整、三层测试全绿、商店上架资料全套就绪**，全部已推送 GitHub（master）。无未提交代码，无未完成任务票（epic #2 及 15 子票全关）。

## 必读文件（按序）

1. `AGENTS.md` — 协作规范、语言、目录、提交纪律、本机网络环境（gh 要 `HTTPS_PROXY=http://127.0.0.1:7890` 前缀；git 已配仓库级代理免前缀；npm 用 npmmirror）
2. `docs/design.md` — 实现的唯一设计依据（含「永不做」清单：快捷键/全局开关/预置规则/远程订阅/右键菜单/免保存临时隐藏）
3. `docs/dev/DEVLOG.md` — 全部过程决策与踩坑（shadow 事件重定向、Vue 代理×storage 序列化、insertCSS origin:'USER'、极客时间 451 等）
4. `docs/store-submission.md` — 商店上架全套（照走即可）

## 已完成

- V1 全功能：站点名单动态注册（零注入铁律）、点选向导（uBlock 式捕获层）、三收起方案、标题/图标伪装+补刀、悬浮开关、编辑面板（含高级选择器后门）、管理页、体检、引导、导出导入
- 测试：64 单测（vitest+jsdom）｜本地全量 E2E 30+ 断言｜真机 E2E：**微信读书/得到/墨问全流程通过**（真实规则命中并隐藏）
- 商店包：双语 README/CHANGELOG、PRIVACY.md、图标、4 张 1280×800 截图、440×280 宣传图、教程含逐字段粘贴文案；`npm run zip` 产出可用
- 定位决策（已与用户确认）：**「清爽模式/专注阅读」话术**，用户可见层零「伪装/摸鱼」字样；**名字保留 PageMask + 品类副标题**（中「PageMask · 页面清爽模式」/ 英 "PageMask — Clean & Focused Pages"）；README 竞品对比为客观的各自适合场景

## 待办

**用户人工（无法自动化）**：① 自己浏览器走一遍弹窗授权→向导（权限弹窗不可自动点击，仅此路径未端到端验证）；② 极客时间 451（本机网络出口被其判境外所致，用户日常网络复核）；③ 商店提交（$5 开发者账号 + 教程 §1–8.5）；④ 可选：master→main 改名。

**下一任 agent 可做**：任何 V2/修补。开工先 `npm install && npm run compile && npm test` 验环境；改 UI 记得用户可见文案必须保持清爽话术（对照 `docs/store-submission.md` §3）。

## 常用命令与环境事实

```bash
npm test                # 单测（vitest）
npm run compile         # vue-tsc 类型检查
npm run build && npm run zip   # 构建 + 商店包
npm run test:e2e        # 本地全量 E2E（自动 build）
node tests/e2e/run-e2e-real.mjs   # 四站点真机 E2E
node tests/e2e/store-shots-extra.mjs  # 商店截图重生成
```

- E2E 浏览器：Chrome for Testing 157 在 `/tmp/cft/`（**品牌版 Chrome 137+ 忽略 `--load-extension`**）；若 /tmp 清空，从 `registry.npmmirror.com/-/binary/chrome-for-testing/` 下载 mac-arm64 版并 `xattr -dr com.apple.quarantine`
- E2E 权限预授予：拷贝 `.output/chrome-mv3` 到 /tmp 后把测试站点写进拷贝的 manifest `host_permissions`（生产构建不带）；权限弹窗无法自动点击
- Node 的 URL 对 `chrome-extension://` 的 `.origin` 返回 `"null"`，扩展基础路径用字符串截取

## 版本纪律

semver 从 0.1.0 起（用户已确认），1.0.0 留给商店上架定版；更新流程见 `docs/store-submission.md` §8。
