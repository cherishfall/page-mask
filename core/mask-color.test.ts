import { canvasIsDark, parseCssColor, resolveMaskColor } from './mask-color';

describe('parseCssColor：getComputedStyle 输出的颜色', () => {
  it.each([
    ['rgb(30, 30, 30)', { r: 30, g: 30, b: 30, a: 1 }],
    ['rgba(255, 0, 0, 0.5)', { r: 255, g: 0, b: 0, a: 0.5 }],
    ['rgba(0, 0, 0, 0)', { r: 0, g: 0, b: 0, a: 0 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
    ['rgb(30 30 30 / 0.25)', { r: 30, g: 30, b: 30, a: 0.25 }],
  ])('%s', (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected);
  });

  it('不认识的写法（oklch、color()）返回 null', () => {
    expect(parseCssColor('oklch(0.5 0.1 200)')).toBeNull();
    expect(parseCssColor('')).toBeNull();
  });
});

describe('resolveMaskColor：沿祖先链（近 → 远）取实际看到的背景色', () => {
  it.each<[string, string[], boolean, string]>([
    ['取最近的不透明祖先', ['rgba(0, 0, 0, 0)', 'rgb(30, 30, 30)', 'rgb(17, 17, 17)'], false, 'rgb(30, 30, 30)'],
    ['到根都透明：浅色画布为白', ['rgba(0, 0, 0, 0)', 'transparent'], false, 'rgb(255, 255, 255)'],
    ['到根都透明：深色画布为 Chrome 的 #121212', ['rgba(0, 0, 0, 0)'], true, 'rgb(18, 18, 18)'],
    ['空链（没有祖先）', [], false, 'rgb(255, 255, 255)'],
    ['半透明叠在不透明祖先上', ['rgba(255, 255, 255, 0.5)', 'rgb(0, 0, 0)'], false, 'rgb(128, 128, 128)'],
    // 白底上先盖 50% 蓝 = (127.5,127.5,255)，再盖 50% 红 = (191.25,63.75,127.5)
    [
      '两层半透明逐层叠加',
      ['rgba(255, 0, 0, 0.5)', 'rgba(0, 0, 255, 0.5)', 'rgb(255, 255, 255)'],
      false,
      'rgb(191, 64, 128)',
    ],
    ['半透明叠在浅色画布上', ['rgba(0, 0, 0, 0.5)'], false, 'rgb(128, 128, 128)'],
    ['半透明叠在深色画布上', ['rgba(255, 255, 255, 0.1)'], true, 'rgb(42, 42, 42)'],
    ['空格写法的半透明', ['rgb(30 30 30 / 0.5)', 'rgb(0, 0, 0)'], false, 'rgb(15, 15, 15)'],
    ['不认识的写法按不透明处理、原样使用', ['transparent', 'oklch(0.5 0.1 200)'], false, 'oklch(0.5 0.1 200)'],
  ])('%s', (_name, chain, dark, expected) => {
    expect(resolveMaskColor(chain, dark)).toBe(expected);
  });
});

describe('canvasIsDark：页面画布（没有任何背景时露出的底色）是否为深色', () => {
  it.each<[string, string | null, boolean, boolean]>([
    // 页面没声明 color-scheme：画布永远是白的，系统深色也不变
    ['normal', null, true, false],
    ['dark', null, false, true],
    ['light dark', null, false, false],
    ['light dark', null, true, true],
    ['only light', null, true, false],
    // CSS 是 normal 时看 <meta name="color-scheme">
    ['normal', 'dark', false, true],
    ['normal', 'light dark', true, true],
    ['normal', 'light dark', false, false],
    // CSS 声明优先于 meta
    ['light', 'dark', true, false],
  ])('css=%s meta=%s 系统深色=%s → %s', (css, meta, prefersDark, expected) => {
    expect(canvasIsDark(css, meta, prefersDark)).toBe(expected);
  });
});
