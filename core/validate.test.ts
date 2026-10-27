import { describe, expect, it } from 'vitest';
import {
  isLexicallySafeSelector,
  isSafeFaviconDataUrl,
  isSafeSelector,
  readStoredSettings,
  toStoredSettings,
  isValidOrigin,
  isValidScope,
  isValidStrategy,
  MAX_FAVICON_DATA_URL_LENGTH,
  readSettings,
  sanitizeProfile,
} from './validate';
import { createEmptyProfile } from './types';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('候选选择器校验（表格驱动）', () => {
  const rejected: [string, unknown][] = [
    ['跳出规则块并发起外链请求', 'x{} body{background:url(https://a)}'],
    ['分号', 'a;b'],
    ['@import', '@import url(https://a/x.css)'],
    ['@ 规则跟在选择器后', 'a @media'],
    ['未闭合圆括号', 'div:not(.a'],
    ['未闭合方括号', '[data-x="1"'],
    ['未闭合引号', '[data-x="1]'],
    ['多余右括号', 'a)'],
    ['注释', 'a /* x */'],
    ['逗号并集（不是单个选择器）', '.a, .b'],
    ['左花括号', 'a{'],
    ['右花括号', '}a'],
    ['换行', '.a\n.b'],
    ['结尾悬空反斜杠', '.a\\'],
    ['空串', ''],
    ['纯空白', '   '],
    ['非字符串', 42],
    ['过长', `.${'a'.repeat(2000)}`],
    ['语法非法（浏览器解析器拒绝）', 'a:::b'],
    ['语法非法：以组合符开头', '> .a'],
  ];
  it.each(rejected)('拒绝：%s', (_name, sel) => {
    expect(isSafeSelector(sel)).toBe(false);
  });

  const accepted: [string, string][] = [
    ['id', '#id'],
    ['子代组合', '.a > .b'],
    ['属性', '[data-x="1"]'],
    ['nth-of-type', 'div.feed > li:nth-of-type(2)'],
    ['括号内的逗号', 'div:not(.a, .b)'],
    ['引号内的 @ 与分号', '[href^="mailto:a@b.com;x"]'],
    ['转义字符', '#a\\:b'],
  ];
  it.each(accepted)('通过：%s', (_name, sel) => {
    expect(isSafeSelector(sel)).toBe(true);
  });

  it('无 DOM 的上下文（后台）仍做词法检查', () => {
    expect(isSafeSelector('x{} body{}', () => true)).toBe(false);
    expect(isLexicallySafeSelector('.a > .b')).toBe(true);
  });
});

describe('图标、origin、范围、方案校验（表格驱动）', () => {
  const cases: [string, () => boolean, boolean][] = [
    ['png data URL', () => isSafeFaviconDataUrl(PNG), true],
    ['远程图标 https', () => isSafeFaviconDataUrl('https://evil.example/x.png'), false],
    ['远程图标 //', () => isSafeFaviconDataUrl('//evil.example/x.png'), false],
    ['svg data URL', () => isSafeFaviconDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), false],
    ['非图片 data URL', () => isSafeFaviconDataUrl('data:text/html;base64,PGI+'), false],
    ['超大图标', () => isSafeFaviconDataUrl(`data:image/png;base64,${'A'.repeat(MAX_FAVICON_DATA_URL_LENGTH)}`), false],
    ['javascript: origin', () => isValidOrigin('javascript:alert(1)'), false],
    ['ftp origin', () => isValidOrigin('ftp://x.com'), false],
    ['带路径的 origin', () => isValidOrigin('https://x.com/a'), false],
    ['带默认端口的 origin', () => isValidOrigin('https://x.com:443'), false],
    ['规范 origin', () => isValidOrigin('https://weread.qq.com'), true],
    ['非默认端口 origin', () => isValidOrigin('http://localhost:8080'), true],
    ['畸形 scope：include 缺 patterns', () => isValidScope({ type: 'include' }), false],
    ['畸形 scope：未知类型', () => isValidScope({ type: 'some' }), false],
    ['畸形 scope：patterns 为空', () => isValidScope({ type: 'exclude', patterns: [] }), false],
    ['畸形 scope：prefix 非字符串', () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 1 }] }), false],
    [
      '畸形 scope：prefix 不属于本站',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://b.com/' }] }, 'https://a.com'),
      false,
    ],
    ['scope：整站', () => isValidScope({ type: 'all' }), true],
    [
      'scope：仅这类页面',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/r/' }] }, 'https://a.com'),
      true,
    ],
    [
      'scope：仅首页（精确匹配）',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/', match: 'exact' }] }, 'https://a.com'),
      true,
    ],
    [
      '畸形 scope：未知匹配方式',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/', match: 'regex' }] }, 'https://a.com'),
      false,
    ],
    ['未知收起方案', () => isValidStrategy('explode'), false],
    ['合法收起方案', () => isValidStrategy('mask'), true],
  ];
  it.each(cases)('%s', (_name, fn, expected) => {
    expect(fn()).toBe(expected);
  });
});

describe('sanitizeProfile', () => {
  it('身份字段非法整体拒绝', () => {
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), origin: 'javascript:alert(1)' })).toBeNull();
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), formatVersion: 2 })).toBeNull();
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), hideRules: {} })).toBeNull();
  });

  it('次要字段回落安全默认值，畸形规则被丢弃并计数', () => {
    const res = sanitizeProfile({
      ...createEmptyProfile('https://a.com'),
      switchState: 'weird',
      faviconDataUrl: 'https://evil.example/x.png',
      floatingBtnPos: { x: 'a', y: 1 },
      hideRules: [
        { id: 'r1', elementName: 'x', candidates: ['#ok'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
        { id: 'r2', elementName: 'x', candidates: ['#ok'], strategy: 'remove', scope: { type: 'include' }, onlyThis: false, createdAt: 1 },
        { id: 'r3', elementName: 'x', candidates: ['a;b'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
      ],
    })!;
    expect(res.profile.switchState).toBe('original');
    expect(res.profile.faviconDataUrl).toBeNull();
    expect(res.profile.floatingBtnPos).toBeNull();
    expect(res.profile.hideRules.map((r) => r.id)).toEqual(['r1']);
    expect(res.droppedRules).toBe(2);
  });
});

describe('readSettings', () => {
  it('类型不对或空白视为没设置（null）', () => {
    expect(readSettings(undefined).defaultTitle).toBeNull();
    expect(readSettings({ defaultTitle: null }).defaultTitle).toBeNull();
    expect(readSettings({ defaultTitle: 42 }).defaultTitle).toBeNull();
    expect(readSettings({ defaultTitle: ' \t ' }).defaultTitle).toBeNull();
    expect(readSettings({ defaultTitle: '周报' }).defaultTitle).toBe('周报');
    expect(readSettings({ defaultTitle: '新建标签页' }).defaultTitle).toBe('新建标签页'); // 不做旧版迁移
  });
});

describe('readStoredSettings / toStoredSettings（0.1.0 迁移）', () => {
  it('无版本标记的旧默认值视为没设置，其余照常', () => {
    expect(readStoredSettings({ defaultTitle: '新建标签页' }).defaultTitle).toBeNull();
    expect(readStoredSettings({ defaultTitle: '周报' }).defaultTitle).toBe('周报');
    expect(readStoredSettings(undefined).defaultTitle).toBeNull();
  });
  it('带版本标记的值原样保留', () => {
    const stored = toStoredSettings({ defaultTitle: '新建标签页' });
    expect(stored).toEqual({ defaultTitle: '新建标签页', settingsVersion: 2 });
    expect(readStoredSettings(stored)).toEqual({ defaultTitle: '新建标签页' });
  });
});
