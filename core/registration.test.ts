import { describe, expect, it } from 'vitest';
import { registrationPlan } from './registration';

describe('registrationPlan', () => {
  it('按站点生成独立注册项，matches 覆盖整站', () => {
    const p = registrationPlan('https://weread.qq.com');
    expect(p.id).toBe('pagemask:https://weread.qq.com');
    expect(p.matches).toEqual(['https://weread.qq.com/*']);
    expect(p.js).toEqual(['content-scripts/content.js']);
    expect(p.persistAcrossSessions).toBe(true);
    expect(p.runAt).toBe('document_idle');
  });
  it('不同站点 id 不冲突（含端口）', () => {
    expect(registrationPlan('http://localhost:3000').id).not.toBe(registrationPlan('http://localhost:5173').id);
  });
});
