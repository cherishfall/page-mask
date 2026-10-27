import { describe, expect, it } from 'vitest';
import { planReconcile, type RegisteredScript } from './reconcile';
import { registrationPlan } from './registration';

const A = 'https://a.example';
const B = 'https://b.example';
const C = 'http://localhost:3000';

/** 已按当前计划注册好的脚本（浏览器 getRegisteredContentScripts 返回的形状） */
const reg = (origin: string): RegisteredScript => {
  const p = registrationPlan(origin);
  return { id: p.id, matches: p.matches, js: p.js, runAt: p.runAt, persistAcrossSessions: p.persistAcrossSessions };
};

describe('planReconcile：配置 × 授权 × 已注册 → 要做什么', () => {
  const cases: {
    name: string;
    configured: string[];
    granted: string[];
    registered: RegisteredScript[];
    register: string[];
    update: string[];
    unregister: string[];
    pending: string[];
  }[] = [
    {
      name: '空状态：什么都不做',
      configured: [],
      granted: [],
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '扩展更新/重载后注册被清空：配置 ∩ 已授权 → 全部补注册',
      configured: [A, B],
      granted: [A, B],
      registered: [],
      register: [A, B],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '已一致：不重复注册（幂等）',
      configured: [A],
      granted: [A],
      registered: [reg(A)],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '授权被收回：注销，配置保留为「待授权」',
      configured: [A, B],
      granted: [B],
      registered: [reg(A), reg(B)],
      register: [],
      update: [],
      unregister: [`pagemask:${A}`],
      pending: [A],
    },
    {
      name: '配置已删（一键清空 / 整体替换导入）：注销',
      configured: [B],
      granted: [A, B],
      registered: [reg(A), reg(B)],
      register: [],
      update: [],
      unregister: [`pagemask:${A}`],
      pending: [],
    },
    {
      name: '导入后从未授权：不注册，全部成为待授权',
      configured: [A, B, C],
      granted: [],
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [C, A, B], // 按来源字典序输出，便于界面与日志稳定
    },
    {
      name: '已授权但没有配置（新站点向导进行中）：不注册',
      configured: [],
      granted: [A],
      registered: [],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
    {
      name: '旧版本注册的写法与当前计划不同（如 runAt / 文件路径变了）：更新',
      configured: [A],
      granted: [A],
      registered: [{ ...reg(A), runAt: 'document_idle' }, { ...reg(B), js: ['old/content.js'] }],
      register: [],
      update: [A],
      unregister: [`pagemask:${B}`],
      pending: [],
    },
    {
      name: '不是本扩展命名空间的注册不动（例如开发模式下框架自己的注册）',
      configured: [],
      granted: [],
      registered: [{ id: 'wxt:content' }],
      register: [],
      update: [],
      unregister: [],
      pending: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const plan = planReconcile({ configured: c.configured, granted: c.granted, registered: c.registered });
      expect(plan.register.map((p) => p.matches[0])).toEqual(c.register.map((o) => `${o}/*`));
      expect(plan.update.map((p) => p.id)).toEqual(c.update.map((o) => `pagemask:${o}`));
      expect(plan.unregister).toEqual(c.unregister);
      expect(plan.pending).toEqual(c.pending);
    });
  }

  it('要注册的条目就是 registrationPlan 的完整计划', () => {
    const plan = planReconcile({ configured: [A], granted: [A], registered: [] });
    expect(plan.register).toEqual([registrationPlan(A)]);
  });
});
