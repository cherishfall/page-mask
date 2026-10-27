/**
 * 页内界面宿主与「宿主保护样式」（REVIEW N40、#22）。
 *
 * 页内界面（悬浮切换按钮、页面内编辑面板、设置向导、遮罩覆盖层）各挂在一个自定义元素宿主上，
 * 界面本身在宿主的 shadow root 里。shadow 边界挡得住页面选择器命中内部元素，但挡不住：
 * - 命中宿主自身的规则：`html > div{display:none!important}`、`div:empty`、`*{filter/transform}` ……
 * - 从宿主继承进 shadow 的属性：line-height、direction、color、letter-spacing ……
 * shadow 内的 `:host{all:initial}` 属于作者层普通优先级，打不过页面作者层的 !important。
 *
 * 做法：
 * 1. 宿主用自定义元素名（不是 div），页面的 div / 标签选择器首先就匹配不到
 * 2. 后台把下面这份固定样式以用户样式表（insertCSS origin:'USER'，与正式隐藏样式同一通道，ADR-0002）
 *    注入本文档：用户层的 !important 高于页面作者层的 !important，`*`、`:empty`、`html > *` 都压不过它。
 *    `all: initial` 切断一切继承（direction / unicode-bidi 不在 all 之内，单独写）
 * 3. 宿主一律是视口左上角 0×0 的 fixed 盒子，内部界面自己 fixed 定位；宿主 transform/filter 被重置，
 *    子元素的 fixed 始终相对视口
 *
 * 这份样式随文档跟踪（core/doc-styles.ts 的第三份记录），与正式隐藏样式无关：原样态下悬浮按钮
 * 仍在页面上，保护样式只在一键清空、扩展更新交接时撤掉。
 */

/** 页内界面宿主的自定义元素名 */
export const HOST_TAGS = {
  toggle: 'pagemask-toggle',
  editor: 'pagemask-editor',
  wizard: 'pagemask-wizard',
  mask: 'pagemask-mask',
} as const;

export type HostKind = keyof typeof HOST_TAGS;

/** 各宿主的叠放层级（宿主是 fixed 盒子，自成层叠上下文；内部 z-index 只在宿主内比较） */
export const HOST_Z_INDEX: Record<HostKind, number> = {
  wizard: 2147483647,
  editor: 2147483646,
  toggle: 2147483645,
  mask: 2147483644,
};

const ALL_HOSTS = Object.values(HOST_TAGS).join(', ');

/** 宿主选择器列表（体检、拾取排除插件自身节点用） */
export const HOST_SELECTOR = ALL_HOSTS;

/** 宿主保护样式里的标记属性（自定义属性，不影响渲染） */
export const SHIELD_MARKER_PROP = '--pagemask-shield';

function hostRule(selector: string, decls: Record<string, string>): string {
  const body = Object.entries(decls)
    .map(([k, v]) => `${k}: ${v} !important;`)
    .join(' ');
  return `${selector} { ${body} }`;
}

/** 固定的宿主保护样式（后台注入，内容脚本只能请求开 / 关，不能改写内容） */
export const HOST_SHIELD_CSS: string = [
  hostRule(ALL_HOSTS, {
    all: 'initial',
    direction: 'ltr',
    'unicode-bidi': 'isolate',
    display: 'block',
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    margin: '0',
    padding: '0',
    border: '0',
    overflow: 'visible',
    visibility: 'visible',
    opacity: '1',
    transform: 'none',
    filter: 'none',
    contain: 'none',
    'pointer-events': 'auto',
    // 标记：新注入的实例据此判断本文档里是否有失联旧实例留下的用户样式表（见 hostShieldPresent）
    [SHIELD_MARKER_PROP]: '1',
  }),
  ...(Object.keys(HOST_TAGS) as HostKind[]).map((k) =>
    hostRule(HOST_TAGS[k], { 'z-index': String(HOST_Z_INDEX[k]) }),
  ),
].join('\n');

/** 节点是否属于插件自己的界面（宿主本身或宿主内部；shadow 内的节点经 getRootNode 回到宿主） */
export function isOwnUiNode(node: Node | null): boolean {
  let n: Node | null = node;
  while (n) {
    if (n instanceof Element && n.closest(HOST_SELECTOR)) return true;
    const root = n.getRootNode();
    n = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

/**
 * 本文档里是否已经有本扩展注入的宿主保护样式（用一个临时探针元素读标记属性）。
 * 新实例在开始注入任何东西之前调用：为真说明之前有实例在这里工作过——扩展更新 / 重载后
 * 新旧实例不在同一个隔离环境（实测），拿不到旧实例的样式记录，只能据此推断要接手哪些样式。
 */
export function hostShieldPresent(doc: Document): boolean {
  const root = doc.documentElement;
  if (!root) return false;
  const probe = doc.createElement(HOST_TAGS.mask);
  root.appendChild(probe);
  try {
    return getComputedStyle(probe).getPropertyValue(SHIELD_MARKER_PROP).trim() === '1';
  } finally {
    probe.remove();
  }
}

/**
 * 新实例启动时广播的 DOM 事件（不带数据）。DOM 事件跨隔离环境可见：扩展更新后失联的旧实例
 * 收到它就读一次 ctx.isValid，随即收尾（撤下界面、还原标题图标）。网页也能发这个事件，
 * 但对仍然有效的实例只是多核对一次，没有副作用。
 * （WXT 自己的「新脚本启动」通知靠 CustomEvent.detail 识别，detail 跨隔离环境读不到，只对同一环境有效。）
 */
export const TAKEOVER_EVENT = 'pagemask:takeover';
