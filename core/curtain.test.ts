import { curtainColor, curtainRestoreAction } from './curtain';

describe('curtainRestoreAction：幕布「恢复」的分支决策（#45，最容易写错的地方）', () => {
  it('进入前是清爽态 → 回到清爽标题与图标（guard.apply(effectiveTitle(...), ...)）', () => {
    expect(curtainRestoreAction('disguised')).toBe('disguise');
  });

  it('进入前是原样态 → 才还原真实标题与图标（guard.restore()）', () => {
    expect(curtainRestoreAction('original')).toBe('real');
  });

  it('两个动作是分支而不是一律还原真实标题（一律 restore() 会让清爽态当场露馅）', () => {
    expect(curtainRestoreAction('disguised')).not.toBe(curtainRestoreAction('original'));
  });
});

describe('curtainColor：幕布底色的取值顺序（#45）', () => {
  it.each<[string, string, string, boolean, string]>([
    ['html 不透明 → 用 html', 'rgb(30, 30, 30)', 'rgb(200, 200, 200)', false, 'rgb(30, 30, 30)'],
    ['html 透明 → 用 body', 'rgba(0, 0, 0, 0)', 'rgb(17, 17, 17)', false, 'rgb(17, 17, 17)'],
    ['html 半透明不算不透明 → 用 body', 'rgba(0, 0, 0, 0.5)', 'rgb(240, 240, 240)', false, 'rgb(240, 240, 240)'],
    ['transparent 也取不到 → 用 body', 'transparent', 'rgb(30, 30, 30)', false, 'rgb(30, 30, 30)'],
    ['都取不到：浅色画布兜底为白', 'rgba(0, 0, 0, 0)', 'transparent', false, 'rgb(255, 255, 255)'],
    ['都取不到：深色画布兜底为近黑', '', '', true, 'rgb(18, 18, 18)'],
    ['认不出的写法（oklch 等）按实色处理、原样使用', 'oklch(0.5 0.1 200)', 'rgb(30, 30, 30)', false, 'oklch(0.5 0.1 200)'],
  ])('%s', (_name, htmlBg, bodyBg, dark, expected) => {
    expect(curtainColor(htmlBg, bodyBg, dark)).toBe(expected);
  });
});
