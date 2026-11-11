import { describe, expect, it } from 'vitest';
import { registrationPlan } from './registration';
import { sitePatterns } from './site-key';

describe('registrationPlan', () => {
  it('按站点生成独立注册项，matches 用传入的有效模式（裸域 + 子域）', () => {
    const key = 'reader.example';
    const p = registrationPlan(key, sitePatterns(key));
    expect(p.id).toBe('pagemask:reader.example');
    expect(p.matches).toEqual(['*://reader.example/*', '*://*.reader.example/*']);
    expect(p.js).toEqual(['content-scripts/content.js']);
    expect(p.persistAcrossSessions).toBe(true);
    // 首屏防闪：脚本在页面开始解析前启动，立即请求隐藏样式、压标题
    expect(p.runAt).toBe('document_start');
  });

  it('迁移前只持有旧精确模式时，matches 就是那些旧模式', () => {
    const p = registrationPlan('weibo.com', ['https://weibo.com/*']);
    expect(p.matches).toEqual(['https://weibo.com/*']);
  });

  it('不同站点 id 不冲突（含端口）', () => {
    const a = registrationPlan('localhost:3000', sitePatterns('localhost:3000'));
    const b = registrationPlan('localhost:5173', sitePatterns('localhost:5173'));
    expect(a.id).toBe('pagemask:localhost:3000');
    expect(a.id).not.toBe(b.id);
  });
});
