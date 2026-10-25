# 开发日志（DEVLOG）

按时间倒序记录开发过程中的关键事件、超出 `docs/design.md` 范围的临时决策及其理由。正式的架构决策写 `docs/adr/`，这里只记过程。

## 2026-10-26 深夜 · 通宵冲刺启动

- 环境验证完毕：Node 22.20 / npm 11.17 / Chrome 156 / Clash 代理（gh 前缀方式）全部可用；已启动防休眠进程（caffeinate，自过期）。
- 建立本目录与 `AGENTS.md` 新规范（语言、目录结构、提交纪律、测试、真实网站验证约定）。
- 下一步：拆分任务票（GitHub issues）→ WXT 脚手架 → 按 `docs/design.md` V1 优先级实现。
