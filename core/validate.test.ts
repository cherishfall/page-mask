import { describe, expect, it } from 'vitest';
import {
  isLexicallySafeSelector,
  isSafeSelector,
  readStoredSettings,
  toStoredSettings,
  isValidScope,
  isValidStrategy,
  readSettings,
  sanitizeProfile,
  sanitizeTabIcon,
} from './validate';
import { isValidSiteKey } from './site-key';
import { createEmptyProfile } from './types';

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

describe('站点 key、范围、方案校验（表格驱动）', () => {
  const cases: [string, () => boolean, boolean][] = [
    ['javascript: 站点 key', () => isValidSiteKey('javascript:alert(1)'), false],
    ['ftp 站点 key', () => isValidSiteKey('ftp://x.com'), false],
    ['带协议的 origin（旧形态）', () => isValidSiteKey('https://x.com'), false],
    ['带路径的 key', () => isValidSiteKey('x.com/a'), false],
    ['带默认端口的 origin（旧形态）', () => isValidSiteKey('https://x.com:443'), false],
    ['规范站点 key', () => isValidSiteKey('reader.example'), true],
    ['带非默认端口的 key', () => isValidSiteKey('localhost:8080'), true],
    ['畸形 scope：include 缺 patterns', () => isValidScope({ type: 'include' }), false],
    ['畸形 scope：未知类型', () => isValidScope({ type: 'some' }), false],
    ['畸形 scope：patterns 为空', () => isValidScope({ type: 'exclude', patterns: [] }), false],
    ['畸形 scope：prefix 非字符串', () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 1 }] }), false],
    [
      '畸形 scope：prefix 不属于本站',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://b.com/' }] }, 'a.com'),
      false,
    ],
    ['scope：整站', () => isValidScope({ type: 'all' }), true],
    [
      'scope：仅这类页面',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/r/' }] }, 'a.com'),
      true,
    ],
    [
      'scope：子域页面属于同一个站点',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://s.a.com/r/' }] }, 'a.com'),
      true,
    ],
    [
      'scope：仅首页（精确匹配）',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/', match: 'exact' }] }, 'a.com'),
      true,
    ],
    [
      '畸形 scope：未知匹配方式',
      () => isValidScope({ type: 'include', patterns: [{ label: 'x', prefix: 'https://a.com/', match: 'regex' }] }, 'a.com'),
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
  it('capsuleHidden 只有显式 true 才落字段（#111）：缺省 = 显示，旧数据兼容', () => {
    // 显式 true 保留
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), capsuleHidden: true })?.profile.capsuleHidden).toBe(true);
    // false / 非布尔 / 缺失都不落字段（缺省 = 显示）
    expect('capsuleHidden' in (sanitizeProfile({ ...createEmptyProfile('https://a.com'), capsuleHidden: false })?.profile ?? {})).toBe(false);
    expect('capsuleHidden' in (sanitizeProfile({ ...createEmptyProfile('https://a.com'), capsuleHidden: 'yes' })?.profile ?? {})).toBe(false);
    expect('capsuleHidden' in (sanitizeProfile(createEmptyProfile('https://a.com'))?.profile ?? {})).toBe(false);
  });

  it('身份字段非法整体拒绝', () => {
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), origin: 'javascript:alert(1)' })).toBeNull();
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), origin: 'not a key' })).toBeNull();
    // 导入文件里可以造出 origin:'*' 这类幻影站点（#186）：存储校验必须拒收
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), origin: '*' })).toBeNull();
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), formatVersion: 2 })).toBeNull();
    expect(sanitizeProfile({ ...createEmptyProfile('https://a.com'), hideRules: {} })).toBeNull();
  });

  it('站点身份归一为 key（#162）：旧 origin 与子域都收成 eTLD+1，子域规则保留', () => {
    const res = sanitizeProfile({
      ...createEmptyProfile('https://www.weibo.com'),
      hideRules: [
        {
          id: 'r1',
          elementName: 'x',
          candidates: ['#ok'],
          strategy: 'remove',
          scope: { type: 'include', patterns: [{ label: 'x', prefix: 'https://s.weibo.com/r/' }] },
          onlyThis: false,
          createdAt: 1,
        },
      ],
    })!;
    expect(res.profile.origin).toBe('weibo.com');
    // 子域页面上的规则属于同一个站点，不能被静默丢掉
    expect(res.profile.hideRules.map((r) => r.id)).toEqual(['r1']);
    expect(res.droppedRules).toBe(0);
    // 已是 key 的原样保留（含非默认端口 / IP）
    expect(sanitizeProfile(createEmptyProfile('weibo.com'))!.profile.origin).toBe('weibo.com');
    expect(sanitizeProfile(createEmptyProfile('127.0.0.1:8080'))!.profile.origin).toBe('127.0.0.1:8080');
  });

  it('次要字段回落安全默认值，畸形规则被丢弃并计数', () => {
    const res = sanitizeProfile({
      ...createEmptyProfile('https://a.com'),
      switchState: 'weird',
      icon: 'weird',
      floatingBtnPos: { x: 'a', y: 1 },
      hideRules: [
        { id: 'r1', elementName: 'x', candidates: ['#ok'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
        { id: 'r2', elementName: 'x', candidates: ['#ok'], strategy: 'remove', scope: { type: 'include' }, onlyThis: false, createdAt: 1 },
        { id: 'r3', elementName: 'x', candidates: ['a;b'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
      ],
    })!;
    expect(res.profile.switchState).toBe('original');
    expect(res.profile.icon).toEqual({ kind: 'none' });
    expect(res.profile.floatingBtnPos).toBeNull();
    expect(res.profile.hideRules.map((r) => r.id)).toEqual(['r1']);
    expect(res.droppedRules).toBe(2);
  });

  it('「保存过标题和图标」（#98）：显式值优先，旧数据按有没有标题推导', () => {
    const empty = createEmptyProfile('https://a.com');
    const derive = (over: Record<string, unknown>) => sanitizeProfile({ ...empty, ...over })!.profile.titleIconSet;

    // 0.5.x 存量：只设过收起规则的网站没有一个标题 / 图标 → 没设置过
    expect(derive({ hideRules: [] })).toBe(false);
    // 存量里设过标题的网站 → 设置过（只有那条流程会写标题字段）
    expect(derive({ disguisedTitle: '阅读' })).toBe(true);
    // 显式 false 覆盖推导结果：用户点了「恢复网站原来的标题和图标」后，值清空但字段留下 false
    expect(derive({ disguisedTitle: '阅读', titleIconSet: false })).toBe(false);
    // 显式 true：保存时输入框清空（标题回落默认）也算设置过
    expect(derive({ titleIconSet: true })).toBe(true);
    // 坏类型按推导走，不炸
    expect(derive({ disguisedTitle: '阅读', titleIconSet: 'yes' })).toBe(true);
  });
});

describe('sanitizeTabIcon（#121：三态白名单）', () => {
  it('三种合法值原样保留', () => {
    expect(sanitizeTabIcon({ kind: 'site' })).toEqual({ kind: 'site' });
    expect(sanitizeTabIcon({ kind: 'none' })).toEqual({ kind: 'none' });
    expect(sanitizeTabIcon({ kind: 'preset', id: 'doc' })).toEqual({ kind: 'preset', id: 'doc' });
  });

  it('缺失 / 畸形 / 不认识的编号 → 不显示图标（旧数据观感不变）', () => {
    for (const bad of [undefined, null, 42, 'site', [], {}, { kind: 'preset' }]) {
      expect(sanitizeTabIcon(bad)).toEqual({ kind: 'none' });
    }
    expect(sanitizeTabIcon({ kind: 'preset', id: 'unknown' })).toEqual({ kind: 'none' });
    expect(sanitizeTabIcon({ kind: 'preset', id: 7 })).toEqual({ kind: 'none' });
  });

  it('旧的上传字段 faviconDataUrl 被当未知字段丢掉', () => {
    const raw: Record<string, unknown> = { ...createEmptyProfile('https://a.com') };
    delete raw.icon; // 旧数据没有新字段
    raw.faviconDataUrl = 'data:image/png;base64,AAAA';
    const res = sanitizeProfile(raw)!;
    expect(res.profile.icon).toEqual({ kind: 'none' });
    expect('faviconDataUrl' in res.profile).toBe(false);
  });

  it('新建站点默认「网站原来的图标」', () => {
    expect(createEmptyProfile('https://a.com').icon).toEqual({ kind: 'site' });
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

  it('胶囊不透明度（#102）：只接受三档，坏值 / 旧数据回落「清晰」', () => {
    expect(readSettings(undefined).toggleOpacity).toBe(1);
    // 旧三档字符串（旧存储 / 旧导出文件）迁移：full→1 / soft→0.9 / faint→0.7（#110）
    expect(readSettings({ toggleOpacity: 'full' }).toggleOpacity).toBe(1);
    expect(readSettings({ toggleOpacity: 'soft' }).toggleOpacity).toBe(0.9);
    expect(readSettings({ toggleOpacity: 'faint' }).toggleOpacity).toBe(0.7);
    // 数值夹取与坏值回默认
    expect(readSettings({ toggleOpacity: 0.35 }).toggleOpacity).toBe(0.4);
    expect(readSettings({ toggleOpacity: 5 }).toggleOpacity).toBe(1);
    expect(readSettings({ toggleOpacity: 'dim' }).toggleOpacity).toBe(1);
  });

  it('「遮住」按钮位置（#50）：合法坐标保留，缺字段 / 类型不对一律回落 null', () => {
    expect(readSettings({ curtainBtnPos: { x: 1.5, y: 2 } }).curtainBtnPos).toEqual({ x: 1.5, y: 2 });
    expect(readSettings(undefined).curtainBtnPos).toBeNull();
    expect(readSettings({ curtainBtnPos: null }).curtainBtnPos).toBeNull();
    expect(readSettings({ curtainBtnPos: { x: NaN, y: 2 } }).curtainBtnPos).toBeNull();
    expect(readSettings({ curtainBtnPos: { x: 1, y: '2' } }).curtainBtnPos).toBeNull();
    expect(readSettings({ curtainBtnPos: 'left' }).curtainBtnPos).toBeNull();
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
    expect(stored).toEqual({
      defaultTitle: '新建标签页',
      curtainBtnPos: null,
      uiLanguage: 'auto',
      toggleOpacity: 1,
      settingsVersion: 2,
    });
    expect(readStoredSettings(stored)).toEqual({
      defaultTitle: '新建标签页',
      curtainBtnPos: null,
      uiLanguage: 'auto',
      toggleOpacity: 1,
    });
  });
});
