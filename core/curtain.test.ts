import { CURTAIN_DRAG_THRESHOLD_PX, curtainColor, curtainRestoreAction, curtainTitle, isCurtainDrag } from './curtain';

describe('isCurtainDrag：松手时算拖动还是点击（#50）', () => {
  it('位移不超过阈值（4 像素）算点击：松手就恢复', () => {
    expect(isCurtainDrag(4, 0)).toBe(false);
    expect(isCurtainDrag(0, -4)).toBe(false);
    expect(isCurtainDrag(-4, 0)).toBe(false);
  });

  it('位移超过阈值（4 像素）算拖动：松手不恢复', () => {
    expect(isCurtainDrag(5, 0)).toBe(true);
    expect(isCurtainDrag(0, 4.5)).toBe(true);
    expect(isCurtainDrag(-5, 0)).toBe(true);
  });

  it('按欧氏距离判定：斜向 (3, 3) 的实际位移 4.24px 算拖动', () => {
    expect(isCurtainDrag(3, 3)).toBe(true);
    expect(isCurtainDrag(2, 2)).toBe(false);
  });

  it('阈值导出成常量，两条代码路径不会各写一个数', () => {
    expect(CURTAIN_DRAG_THRESHOLD_PX).toBe(4);
    expect(isCurtainDrag(CURTAIN_DRAG_THRESHOLD_PX + 0.1, 0)).toBe(true);
  });
});

describe('curtainTitle：遮住时的标题（#50）', () => {
  it('待授权的站点有配置、只是没授权：用它自己设置的标题，不是全局默认', () => {
    expect(curtainTitle({ disguisedTitle: '本站标题' }, { defaultTitle: '全局标题' }, 'zh-CN')).toBe('本站标题');
  });

  it('从没添加过的站点（没有配置）：落到全局默认，再落到界面语言默认', () => {
    expect(curtainTitle(null, { defaultTitle: '全局标题' }, 'zh-CN')).toBe('全局标题');
    expect(curtainTitle(null, { defaultTitle: null }, 'zh-CN')).toBe('阅读');
    expect(curtainTitle(null, null, 'en-US')).toBe('Reading');
  });

  it('站点标题为空白时不算设置（Chrome 会在标签页上显示网址）', () => {
    expect(curtainTitle({ disguisedTitle: '  ' }, { defaultTitle: '全局标题' }, 'zh-CN')).toBe('全局标题');
  });
});

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
