/**
 * ⓘ 信息标（#161）：一处定义，弹窗 / 管理页 / 插件设置页 / 向导共用。
 *
 * 抽成组件要解决的几个坑（票里逐条列过）：
 * - 唯一 id：不再把浮层 id 写死在模板里（旧实现两处各写死一个）。欢迎页第 2 步嵌了真实弹窗，
 *   同一份界面会多实例；每个实例 setup 里调一次 nextInfoTipId()，aria-describedby 各指各的浮层。
 * - 读屏可达：浮层正文是常驻 DOM（不用 v-if、不只靠 hover），aria-describedby 指向它，
 *   聚焦时读屏播报 label + 全文（0.8.17 WIG 教训，DEVLOG.md:9）。
 * - Esc 撤下 + 与宿主共存：模块一加载就在 window 捕获阶段挂一个监听，早于向导在 onMounted
 *   里注册的 window 捕获 Esc（它会 stopPropagation 抢走按键并弹退出确认）。焦点在本 ⓘ 上时，
 *   这次 Esc 归 ⓘ：preventDefault + stopImmediatePropagation + blur，向导那边收不到。
 * - 公共 i18n：组件不引用任何 t.*，读屏名由 label prop 传（调用方取 common.infoLabel），
 *   正文由 text prop 传（跟着它解释的对象走）。
 * - 样式作用域：样式全在 styles/info-tip.css，类名带 pm-info-tip* / pm-info-anchor 前缀，
 *   不裸用 .switch-row。扩展页面经 base.css @import，向导 shadow root 经 wizard-styles.ts
 *   ?inline 注入 adoptedStyleSheets —— 全局 <style> 穿不过 shadow boundary。
 *
 * 写成 Vue 渲染函数组件（.ts，非 .vue）：项目没有组件测试框架，vitest 不解析 .vue，
 * 而 .ts 组件能被真实 import + createApp 挂载，组件的 DOM/a11y 契约才有真实自动断言守着。
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';

/** 每个实例一个 id：模块级自增，同一页面多实例不撞（含欢迎页里嵌的真实弹窗）。 */
let seq = 0;
export function nextInfoTipId(): string {
  return `pm-info-tip-${++seq}`;
}

export const INFO_TIP_TRIGGER_CLASS = 'pm-info-tip-trigger';
export const INFO_TIP_BUBBLE_CLASS = 'pm-info-tip-bubble';
/** 调用方给「ⓘ 所在的那一行」加这个类：浮层锚定整行宽度，弹窗/工具条窗口不会裁掉越界内容 */
export const INFO_TIP_ANCHOR_CLASS = 'pm-info-anchor';

/** 这次 Esc 是不是冲着这一枚 ⓘ 来的。composedPath 跨 shadow root 仍保留完整路径（window 捕获阶段 target 会被重定向成 host）。 */
export function isInfoTipEscape(e: KeyboardEvent, el: Element): boolean {
  if (e.key !== 'Escape' || e.isComposing || (e as KeyboardEvent & { keyCode?: number }).keyCode === 229) return false;
  const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
  if (path) return path.includes(el);
  return e.target === el || (typeof Node !== 'undefined' && e.target instanceof Node && el.contains(e.target));
}

interface InfoTipEntry {
  el: HTMLElement;
  onEscape: () => void;
}

const entries = new Set<InfoTipEntry>();
let listening = false;

function onWindowKeyDown(e: KeyboardEvent): void {
  for (const entry of entries) {
    if (!isInfoTipEscape(e, entry.el)) continue;
    // Esc 归这枚 ⓘ：撤下浮层。stopImmediatePropagation 让后面注册的宿主监听（向导 window 捕获的
    // 退出确认、页面自己的 Esc 快捷键）都收不到这次按键 —— 与「Esc 撤下」和「向导 Esc 归向导」相容。
    e.preventDefault();
    e.stopImmediatePropagation();
    entry.onEscape();
    return;
  }
}

function ensureListener(): void {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('keydown', onWindowKeyDown, true);
  listening = true;
}
// 模块加载即注册（早于任何宿主在 onMounted 里注册的 window 捕获监听）
ensureListener();

export function registerInfoTipEsc(entry: InfoTipEntry): () => void {
  entries.add(entry);
  ensureListener();
  return () => {
    entries.delete(entry);
  };
}

/** 仅供断言：当前登记的 ⓘ 数量（卸载后应归零） */
export function infoTipEntryCount(): number {
  return entries.size;
}

export default defineComponent({
  name: 'InfoTip',
  props: {
    /** 浮层正文：按需可读的说明（b 类），由调用方从各自文案表取 */
    text: { type: String, required: true },
    /** 读屏名：公共键，不绑死 popup.* */
    label: { type: String, required: true },
    /** 需要保留在浮层上的 data-testid（旧 E2E 锚点） */
    testId: { type: String, default: undefined },
  },
  setup(props) {
    const id = nextInfoTipId();
    const triggerEl = ref<HTMLElement | null>(null);
    const dismissed = ref(false);
    let unregister: (() => void) | null = null;

    onMounted(() => {
      const el = triggerEl.value;
      if (!el) return;
      unregister = registerInfoTipEsc({
        el,
        onEscape: () => {
          dismissed.value = true;
          el.blur();
        },
      });
    });
    onBeforeUnmount(() => {
      unregister?.();
      unregister = null;
    });

    // 两个根节点（fragment）：trigger 与 bubble 是相邻兄弟，CSS 用 `+` 把 hover/focus 关联起来；
    // bubble 常驻 DOM（display 控制显隐），不随 v-if 生灭。
    return () => [
      h(
        'span',
        {
          ref: triggerEl,
          class: INFO_TIP_TRIGGER_CLASS,
          tabindex: '0',
          'aria-label': props.label,
          'aria-describedby': id,
          'data-pm-info-dismissed': dismissed.value ? 'true' : 'false',
          onFocus: () => {
            dismissed.value = false;
          },
          onMouseleave: () => {
            dismissed.value = false;
          },
        },
        [
          h('svg', { class: 'pm-info-tip-icon', viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
            h('circle', { cx: 8, cy: 8, r: 6.4, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
            h('line', { x1: 8, y1: 7.2, x2: 8, y2: 11, stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
            h('circle', { cx: 8, cy: 4.9, r: 0.95, fill: 'currentColor' }),
          ]),
        ],
      ),
      h(
        'span',
        {
          id,
          role: 'tooltip',
          class: INFO_TIP_BUBBLE_CLASS,
          'data-testid': props.testId,
        },
        props.text,
      ),
    ];
  },
});
