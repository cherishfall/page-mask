/**
 * #161「引导性文字整屏规矩」的自动断言。
 *
 * 这张票先补断言再动界面：ⓘ 组件的多实例 / a11y / Esc / shadow 内样式，规矩是否成文并挂靠索引，
 * 「必须留下不许收起」清单是否还在，中英键是否同步，四处收口是否落地。
 *
 * 两类做法（与项目既有惯例一致）：
 * - 组件行为：项目没有组件测试框架、vitest 不解析 .vue，所以 InfoTip 写成 .ts 渲染函数组件，
 *   这里用 createApp 真实挂载到 jsdom，断言的是组件真正渲染出来的 DOM 与真实键盘事件；
 * - 结构/文档：用 Node 直接读源码（同 tests/media-ui.test.ts / onboarding-sync.test.ts）。
 */
// @ts-ignore -- node:fs 无类型声明（项目未装 @types/node）
import { readFileSync } from 'node:fs';
import { createApp, h, nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/core/i18n';
import { createStyleAdopter } from '@/ui/adopt-css';
import InfoTip, {
  INFO_TIP_BUBBLE_CLASS,
  INFO_TIP_TRIGGER_CLASS,
  infoTipEntryCount,
  isInfoTipEscape,
  nextInfoTipId,
} from '@/ui/info-tip/InfoTip';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8') as string;

/** 把若干枚 ⓘ 挂到同一个页面（模拟欢迎页第 2 步嵌真实弹窗的多实例） */
function mountTips(texts: string[], label = '更多信息') {
  const host = document.createElement('div');
  host.className = 'pm-info-anchor';
  document.body.appendChild(host);
  const app = createApp({
    render: () => h('div', texts.map((text) => h(InfoTip, { text, label }))),
  });
  app.mount(host);
  return { host, app };
}

describe('ⓘ 组件：真实 DOM 与键盘行为（验收 2）', () => {
  it('多实例 id 不冲突，aria-describedby 各自指向常驻 DOM 里的浮层', () => {
    const { host, app } = mountTips(['甲细节', '乙细节']);
    const triggers = [...host.querySelectorAll(`.${INFO_TIP_TRIGGER_CLASS}`)];
    const bubbles = [...host.querySelectorAll(`.${INFO_TIP_BUBBLE_CLASS}`)];
    // 未 hover / 未聚焦也在 DOM：内容留在 DOM，不只靠 hover，也不随 v-if 生灭
    expect(triggers).toHaveLength(2);
    expect(bubbles).toHaveLength(2);
    const ids = triggers.map((t) => t.getAttribute('aria-describedby') ?? '');
    expect(new Set(ids).size).toBe(2);
    ids.forEach((id, i) => {
      expect(id).toMatch(/^pm-info-tip-\d+$/);
      const bubble = bubbles[i]!;
      expect(host.querySelector(`#${id}`)).toBe(bubble);
      expect(bubble.getAttribute('role')).toBe('tooltip');
      expect(bubble.textContent).toBe(i === 0 ? '甲细节' : '乙细节');
    });
    app.unmount();
    host.remove();
  });

  it('键盘聚焦可达，读屏名与浮层正文都齐（0.8.17 WIG 教训）', () => {
    const { host, app } = mountTips(['逐字可读的浮层正文'], '点我看说明');
    const trigger = host.querySelector(`.${INFO_TIP_TRIGGER_CLASS}`) as HTMLElement;
    expect(trigger.tabIndex).toBe(0);
    expect(trigger.getAttribute('aria-label')).toBe('点我看说明');
    const id = trigger.getAttribute('aria-describedby')!;
    expect(host.querySelector(`#${id}`)?.textContent).toContain('逐字可读的浮层正文');
    app.unmount();
    host.remove();
  });

  it('Esc 撤下浮层：blur + dismissed，且宿主 window 捕获的 Esc 抢不到（与向导共存）', async () => {
    const { host, app } = mountTips(['说明']);
    const trigger = host.querySelector(`.${INFO_TIP_TRIGGER_CLASS}`) as HTMLElement;
    let hostSawEsc = false;
    // 晚于组件模块注册的 window 捕获监听：模拟 WizardApp onMounted 里那个（它会抢 Esc 弹退出确认）
    const hostListener = () => {
      hostSawEsc = true;
    };
    window.addEventListener('keydown', hostListener, true);
    trigger.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    trigger.dispatchEvent(ev);
    await nextTick();
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
    expect(trigger.getAttribute('data-pm-info-dismissed')).toBe('true');
    expect(hostSawEsc).toBe(false);
    window.removeEventListener('keydown', hostListener, true);
    app.unmount();
    host.remove();
  });

  it('焦点不在 ⓘ 上时 Esc 放行给宿主（不误吞向导/页面的 Esc）', () => {
    const { host, app } = mountTips(['说明']);
    let hostSawEsc = false;
    const hostListener = () => {
      hostSawEsc = true;
    };
    window.addEventListener('keydown', hostListener, true);
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(hostSawEsc).toBe(true);
    window.removeEventListener('keydown', hostListener, true);
    app.unmount();
    host.remove();
  });

  it('重新聚焦后 dismissed 复位（Esc 不是永久隐藏，helper text 始终可再得）', async () => {
    const { host, app } = mountTips(['说明']);
    const trigger = host.querySelector(`.${INFO_TIP_TRIGGER_CLASS}`) as HTMLElement;
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await nextTick();
    expect(trigger.getAttribute('data-pm-info-dismissed')).toBe('true');
    trigger.focus();
    await nextTick();
    expect(trigger.getAttribute('data-pm-info-dismissed')).toBe('false');
    app.unmount();
    host.remove();
  });

  it('组件卸载后注销 Esc 登记，不留悬挂监听', () => {
    const before = infoTipEntryCount();
    const { host, app } = mountTips(['说明']);
    expect(infoTipEntryCount()).toBe(before + 1);
    app.unmount();
    host.remove();
    expect(infoTipEntryCount()).toBe(before);
  });
});

describe('唯一 id 与 Esc 判定的纯函数', () => {
  it('连续生成的 id 互不相同、形如 pm-info-tip-N', () => {
    const ids = Array.from({ length: 30 }, () => nextInfoTipId());
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) expect(id).toMatch(/^pm-info-tip-\d+$/);
  });

  it('只有 Escape + 事件路径命中自身才算；组字 / 229 / 别的键 / 别的元素都不算', () => {
    const el = document.createElement('span');
    const other = document.createElement('span');
    const fake = (init: Record<string, unknown> = {}): KeyboardEvent =>
      ({
        key: 'Escape',
        isComposing: false,
        keyCode: 0,
        target: el,
        composedPath: () => [el],
        ...init,
      }) as unknown as KeyboardEvent;
    expect(isInfoTipEscape(fake(), el)).toBe(true);
    expect(isInfoTipEscape(fake({ key: 'Enter' }), el)).toBe(false);
    expect(isInfoTipEscape(fake({ isComposing: true }), el)).toBe(false);
    expect(isInfoTipEscape(fake({ keyCode: 229 }), el)).toBe(false);
    expect(isInfoTipEscape(fake({ composedPath: () => [other] }), el)).toBe(false);
  });
});

describe('样式：扩展页面与 shadow root 同一份（验收 2「shadow 内样式生效」）', () => {
  const base = read('../styles/base.css');
  const wizardStyles = read('../ui/wizard/wizard-styles.ts');
  const css = read('../styles/info-tip.css');

  it('base.css @import 了 info-tip.css（扩展页面这一路）', () => {
    expect(base).toContain("@import './info-tip.css'");
  });

  it('wizard-styles.ts 把 info-tip.css?inline 接进 createStyleAdopter（shadow root 这一路）', () => {
    expect(wizardStyles).toContain('info-tip.css?inline');
    expect(wizardStyles).toMatch(/createStyleAdopter\([^)]*infoTipCss/);
  });

  it('这份 CSS 默认隐藏 / hover+focus 浮出 / Esc 撤下 / 锚定整行 / 只用 token / 无裸类名', () => {
    expect(css).toMatch(/\.pm-info-tip-bubble\s*\{[^}]*display:\s*none/s);
    expect(css).toContain('.pm-info-tip-trigger:hover + .pm-info-tip-bubble');
    expect(css).toContain('.pm-info-tip-trigger:focus + .pm-info-tip-bubble');
    expect(css).toContain(".pm-info-tip-trigger[data-pm-info-dismissed='true'] + .pm-info-tip-bubble");
    expect(css).toContain('inset-inline: 0');
    expect(css).not.toContain('.switch-row');
    // 只禁「属性值里的字面颜色」；注释里的 #161 是票号不是色值，别被宽泛正则误伤
    expect(css).not.toMatch(/:\s*#[0-9a-fA-F]{3,8}\b/);
    expect(css).toMatch(/var\(--pm-/);
  });

  it('createStyleAdopter 真的能把这份 CSS 文本注入 shadow root', () => {
    const doc = document.implementation.createHTMLDocument();
    const styles: string[] = [];
    const root = {
      ownerDocument: doc,
      adoptedStyleSheets: [] as CSSStyleSheet[],
      appendChild: (n: Node) => {
        const el = n as HTMLStyleElement;
        if (el.tagName === 'STYLE') styles.push(el.textContent ?? '');
        return n;
      },
      prepend: (n: Node) => {
        const el = n as HTMLStyleElement;
        if (el.tagName === 'STYLE') styles.push(el.textContent ?? '');
        return n;
      },
    } as unknown as ShadowRoot;
    createStyleAdopter(css)(root);
    const injected = [
      ...(root.adoptedStyleSheets as CSSStyleSheet[]).map((s) => {
        try {
          return Array.from(s.cssRules).map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      }),
      ...styles,
    ].join('\n');
    expect(injected).toContain('.pm-info-tip-trigger');
  });
});

describe('三条规矩成文与索引挂靠（验收 1）', () => {
  const copy = read('../docs/design-copy.md');
  const ui = read('../docs/design-ui.md');
  const design = read('../docs/design.md');
  const checklist = read('../docs/dev/consistency-checklist.md');

  it('四家依据都写全（含 GOV.UK 三条 / Carbon 两条 / NN/g 资深用户那句 / WCAG 1.4.13 + WIG）', () => {
    for (const s of [
      "Use hint text for help that's relevant to the majority of users",
      'Keep hint text to a single short sentence, without any full stops',
      'Helper text is the preferred method of assisting users because it is always visible',
      'avoid having to scan past a large list of features they rarely use',
      '1.4.13',
      '0.8.17',
    ]) {
      expect(copy, `缺少依据：${s}`).toContain(s);
    }
    for (const who of ['GOV.UK', 'Carbon', 'NN/g', 'WCAG']) expect(copy).toContain(who);
  });

  it('a / b / c 三条规矩都在，c 明确否决「记住已读后自动隐藏」并写明无 seen 机制', () => {
    for (const s of ['多数人每次都需要', '完成操作必需', '危险与后果', '状态与错误', '边界坑', '键盘可达', '读屏可达', 'Esc 可撤', '内容留在 DOM']) {
      expect(copy, `缺少规矩要点：${s}`).toContain(s);
    }
    expect(copy).toContain('不做「记住已读后自动隐藏」');
    expect(copy).toContain('GlobalSettings');
    expect(copy).toContain('seen');
  });

  it('design-ui.md / design.md 挂指针，consistency-checklist.md 索引条目挂靠权威', () => {
    expect(ui).toContain('design-copy.md');
    expect(design).toContain('design-copy.md');
    expect(checklist).toContain('design-copy.md');
    expect(checklist).toContain('只是索引');
  });
});

describe('必须留下、不许收起清单（验收 3；tests/media-ui.test.ts:71-82 另守一份）', () => {
  const zhSrc = read('../core/i18n/messages.zh.ts');
  const enSrc = read('../core/i18n/messages.en.ts');
  const popup = read('../ui/popup/PopupBody.vue');
  const site = read('../entrypoints/management/views/SiteSettingsView.vue');
  const settings = read('../entrypoints/settings/App.vue');

  it('中英两侧六个清单键都还在', () => {
    for (const lang of ['zh', 'en'] as const) {
      const m = MESSAGES[lang];
      expect(m.media.hint, `${lang}.media.hint`).toBeTruthy();
      expect(m.media.hintShort, `${lang}.media.hintShort`).toBeTruthy();
      expect(m.popup.coverHint, `${lang}.popup.coverHint`).toBeTruthy();
      expect(m.management.deleteSite.impact, `${lang}.management.deleteSite.impact`).toBeTruthy();
      expect(m.settings.replaceDialog.irreversible, `${lang}.settings.replaceDialog.irreversible`).toBeTruthy();
      expect(m.common.titleBlankHint, `${lang}.common.titleBlankHint`).toBeTruthy();
    }
  });

  it('它们以常驻形式留在模板里，不是被塞进 ⓘ 浮层', () => {
    expect(popup).toContain('t.media.hintShort');
    expect(popup).toContain('t.popup.coverHint');
    expect(site).toContain('t.media.hint');
    expect(site).toContain('deleteSiteImpact()');
    expect(settings).toContain('t.settings.replaceDialog');
    expect(read('../ui/wizard/WizardApp.vue')).toContain('t.wizard.titleHint');
  });

  it('空白标题坑的三处脚注都插值同一份 const（DEVLOG #151 同值双键教训）', () => {
    expect((zhSrc.match(/\$\{titleBlankHint\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((enSrc.match(/\$\{titleBlankHint\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('中英同步与公共 i18n 键（验收 4）', () => {
  const zhSrc = read('../core/i18n/messages.zh.ts');
  const enSrc = read('../core/i18n/messages.en.ts');

  it('common.infoLabel 两侧都有；popup.infoLabel 两侧都删了', () => {
    for (const lang of ['zh', 'en'] as const) {
      expect(MESSAGES[lang].common.infoLabel).toBeTruthy();
      expect((MESSAGES[lang].popup as unknown as Record<string, unknown>).infoLabel).toBeUndefined();
    }
  });

  it('删掉的键两侧一起删（源码里不残留，含注释）', () => {
    for (const src of [zhSrc, enSrc]) {
      for (const key of ['appSub', 'toggleIntro', 'shortcutHint', 'adjustEmpty']) {
        expect(src, `残留已删键 ${key}`).not.toContain(key);
      }
      const popupBlock = src.slice(src.indexOf('popup: {'), src.indexOf('management: {'));
      expect(popupBlock).not.toContain('infoLabel');
      const settingsBlock = src.slice(src.indexOf('settings: {'), src.indexOf('onboarding: {'));
      expect(settingsBlock).not.toMatch(/\bsub:/);
    }
  });

  it('组件不绑死 popup.*，读屏名由 label prop 传', () => {
    const comp = read('../ui/info-tip/InfoTip.ts');
    expect(comp).not.toContain('t.popup');
    expect(comp).toContain('label:');
    expect(comp).toContain("'aria-label': props.label");
  });
});

describe('四处收口（验收 3 / 5）', () => {
  const popup = read('../ui/popup/PopupBody.vue');
  const site = read('../entrypoints/management/views/SiteSettingsView.vue');
  const settings = read('../entrypoints/settings/App.vue');
  const wizard = read('../ui/wizard/WizardApp.vue');
  const onboarding = read('../entrypoints/onboarding/App.vue');

  it('弹窗两处 ⓘ 已迁到公共组件，硬编码 id / 内联实现 / dismissInfoOnEsc 全部退场', () => {
    expect((popup.match(/<InfoTip/g) ?? []).length).toBe(2);
    expect(popup).toContain('t.common.infoLabel');
    for (const legacy of ['pm-popup-tip-media', 'pm-popup-tip-toggle', 'dismissInfoOnEsc', '.popup-info']) {
      expect(popup, `残留内联 ⓘ：${legacy}`).not.toContain(legacy);
    }
  });

  it('PopupBody 全局样式不再裸用 .switch-row（DEVLOG.md:66 管理页串味事故）', () => {
    const style = popup.slice(popup.indexOf('<style>'));
    expect(style).not.toMatch(/^\.switch-row\s*\{/m);
    expect(style).toContain('.popup .switch-row');
  });

  it('插件设置页用 ⓘ 收 b 类长说明；站点设置页与向导只剩 a 类必需说明，常驻', () => {
    expect(settings).toContain('<InfoTip');
    // 卡片级说明的 ⓘ 跟标题同一行（与弹窗「标签 + ⓘ」同一形态），不独占一行
    expect((settings.match(/class="card-head pm-info-head pm-info-anchor"/g) ?? []).length).toBe(3);
    expect(onboarding).toContain('features');
    // 站点设置页的三条都是「状态 / 完成操作必需」（a 类，Carbon：pertinent 信息不进 tooltip），
    // 压成一句短句常驻。0.9.1（#174）起本页只有一枚合法 ⓘ：灰度卡的 media.hint
    // 从「组级注脚」改成行内 ⓘ（0.8.18 后卡里只有一个开关，注脚定位已失），
    // 与弹窗同构；除它之外不许再出现第二枚。
    expect(site).toContain(':text="t.media.hint"');
    expect((site.match(/<InfoTip/g) ?? []).length).toBe(1);
    for (const k of ['t.management.titleIntro', 't.management.iconIntro', 't.management.rulesEditHint']) {
      expect(site, `${k} 应常驻`).toContain(`{{ ${k} }}`);
      expect(site, `${k} 不该被塞进 ⓘ`).not.toContain(`:text="${k}"`);
    }
    // 向导「看效果」这屏怎么操作是完成操作必需，常驻短句，不藏
    expect(wizard).toContain('{{ t.wizard.previewHint }}');
    expect(wizard).not.toContain(':text="t.wizard.previewHint"');
  });

  it('零风险重复清零：详情页不再挂列表页说明，插件设置页不再有重复 intro', () => {
    expect(read('../entrypoints/management/App.vue')).not.toContain('appSub');
    for (const legacy of ['toggleIntro', 't.settings.sub', 'shortcutHint']) expect(settings, `残留 ${legacy}`).not.toContain(legacy);
    expect(wizard).not.toContain('adjustEmpty');
  });

  it('插件设置页的 b 类长说明改成 ⓘ 的 text prop，不再当常驻 hint 段落', () => {
    for (const k of ['t.settings.titleIntro', 't.settings.toggleHint', 't.settings.transferIntro']) {
      expect(settings, `${k} 应当作为 ⓘ 的 text prop`).toContain(`:text="${k}"`);
      expect(settings, `${k} 不该仍是常驻说明段落`).not.toContain(`<p class="hint">{{ ${k} }}</p>`);
    }
    // 含状态 / 后果的说明常驻，不藏（语言切换后默认标题跟着浏览器语言；快捷键遮住是临时的）
    for (const k of ['t.settings.languageIntro', 't.settings.shortcutIntro']) {
      expect(settings, `${k} 含状态/后果，应常驻`).toContain(`{{ ${k} }}`);
      expect(settings, `${k} 不该被塞进 ⓘ`).not.toContain(`:text="${k}"`);
    }
  });

  it('欢迎页四件事仍在，但不再逐字复述弹窗 tooltip / coverHint', () => {
    const onboardingSrc = read('../core/i18n/messages.zh.ts');
    for (const lang of ['zh', 'en'] as const) {
      const m = MESSAGES[lang];
      const text = JSON.stringify(m.onboarding.steps);
      for (const name of [m.popup.setupMore, m.popup.editTitle, m.media.mediaGray, m.popup.coverPage]) {
        expect(text, `${lang} 欢迎页漏了功能名 ${name}`).toContain(name);
      }
      expect(onboardingSrc).toBeTruthy();
    }
    // 第 3 步长句不再把胶囊逐字复述进去（压成一句短句）
    expect(JSON.stringify(MESSAGES.zh.onboarding.steps[2]!.text).length).toBeLessThan(120);
  });
});
