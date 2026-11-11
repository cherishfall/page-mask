import { describe, expect, it } from 'vitest';
import { planReconcile, type RegisteredScript } from './reconcile';
import { registrationPlan } from './registration';
import { sitePatterns } from './site-key';

const A = 'a.example';
const B = 'b.example';
const C = 'localhost:3000';

/** 已按当前计划注册好的脚本（浏览器 getRegisteredContentScripts 返回的形状） */
const reg = (key: string, patterns = sitePatterns(key)): RegisteredScript => {
  const p = registrationPlan(key, patterns);
  return { id: p.id, matches: p.matches, js: p.js, runAt: p.runAt, persistAcrossSessions: p.persistAcrossSessions };
};

const canonical = (key: string) => sitePatterns(key);

describe('planReconcile：配置 × 授权 × 已注册 → 要做什么', () => {
  const cases: {
    name: string;
    configured: string[];
    grantedPatterns: string[];
    registered: RegisteredScript[];
    register: string[];
    update: string[];
    unregister: string[];
    pending: string[];
  }[] = [
    {
      name: '空状态：什么都不做',
      configured: [],
      grantedPatterns: [],
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '扩展更新/重载后注册被清空：配置 ∩ 已授权 → 全部补注册',
      configured: [A, B],
      grantedPatterns: [...canonical(A), ...canonical(B)],
      registered: [],
      register: [A, B],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '已一致：不重复注册（幂等）',
      configured: [A],
      grantedPatterns: canonical(A),
      registered: [reg(A)],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '授权被收回：注销，配置保留为「待授权」',
      configured: [A, B],
      grantedPatterns: canonical(B),
      registered: [reg(A), reg(B)],
      register: [],
      update: [],
      unregister: [`pagemask:${A}`],
      pending: [A],
    },
    {
      name: '配置已删（一键清空 / 整体替换导入）：注销',
      configured: [B],
      grantedPatterns: [...canonical(A), ...canonical(B)],
      registered: [reg(A), reg(B)],
      register: [],
      update: [],
      unregister: [`pagemask:${A}`],
      pending: [],
    },
    {
      name: '导入后从未授权：不注册，全部成为待授权',
      configured: [A, B, C],
      grantedPatterns: [],
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [A, B, C], // 按站点 key 字典序输出，便于界面与日志稳定
    },
    {
      name: '已授权但没有配置（新站点向导进行中）：不注册',
      configured: [],
      grantedPatterns: canonical(A),
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '旧版本注册的写法与当前计划不同（如 runAt / 文件路径变了）：更新',
      configured: [A],
      grantedPatterns: canonical(A),
      registered: [{ ...reg(A), runAt: 'document_idle' }, { ...reg(B), js: ['old/content.js'] }],
      register: [],
      update: [A],
      unregister: [`pagemask:${B}`],
      pending: [],
    },
    {
      name: '不是本扩展命名空间的注册不动（例如开发模式下框架自己的注册）',
      configured: [],
      grantedPatterns: [],
      registered: [{ id: 'wxt:content' }],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const plan = planReconcile({
        configured: c.configured,
        grantedPatterns: c.grantedPatterns,
        registered: c.registered,
      });
      expect(plan.register.map((p) => p.matches)).toEqual(c.register.map((key) => canonical(key)));
      expect(plan.update.map((p) => p.id)).toEqual(c.update.map((key) => `pagemask:${key}`));
      expect(plan.unregister).toEqual(c.unregister);
      expect(plan.pending).toEqual(c.pending);
    });
  }

  it('要注册的条目就是 registrationPlan 的完整计划（裸域在前、子域在后）', () => {
    const plan = planReconcile({ configured: [A], grantedPatterns: canonical(A), registered: [] });
    expect(plan.register).toEqual([registrationPlan(A, canonical(A))]);
  });

  it('迁移用户只有旧精确模式：仍然注册，不判待授权', () => {
    const plan = planReconcile({ configured: ['weibo.com'], grantedPatterns: ['https://weibo.com/*'], registered: [] });
    expect(plan.pending).toEqual([]);
    expect(plan.register).toEqual([registrationPlan('weibo.com', ['https://weibo.com/*'])]);
  });

  it('新授权模式下三条模式都在（旧精确 + 裸域 + 子域）：裸域在前，旧模式在后', () => {
    const plan = planReconcile({
      configured: ['weibo.com'],
      grantedPatterns: ['https://weibo.com/*', '*://*.weibo.com/*', '*://weibo.com/*'],
      registered: [],
    });
    expect(plan.register[0]!.matches).toEqual(['*://weibo.com/*', '*://*.weibo.com/*', 'https://weibo.com/*']);
  });

  it('子域页面与裸域共用一份配置：授权只给裸域也注册裸域模式', () => {
    const plan = planReconcile({ configured: ['weibo.com'], grantedPatterns: ['*://weibo.com/*'], registered: [] });
    expect(plan.pending).toEqual([]);
    expect(plan.register[0]!.matches).toEqual(['*://weibo.com/*']);
  });
});
