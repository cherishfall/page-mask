/**
 * 页面级幕布控制器的登记处（#107）：每个文档最多一个控制器，常规内容脚本与一次性脚本共用。
 *
 * 背景：幕布有三处入口（胶囊、弹窗、快捷键），历史上内容脚本与一次性脚本各有一套控制器、
 * 两套消息应答，组合使用会互相矛盾（遮 → 撤 → 再遮，第三次遮不上）。收敛成「每个文档一个
 * 控制器」（ADR-0011）：动作接口固定为 state / cover / dismiss / toggle，cover / dismiss 幂等；
 * 登记在隔离环境 window 的同一个槽位上——后来者要么委托（一次性脚本见到内容脚本的登记），
 * 要么让位（内容脚本见到一次性脚本的登记）。
 *
 * 槽位对象自己就是注销的令牌：unregister 只删与自己相同的登记，失联旧实例收尾时
 * 删不掉后来者新写的登记。跨隔离环境的残留（扩展重载后的新脚本在另一个 world，实测看不见
 * 旧登记）由 ui/curtain.ts 的 CurtainLayer.show() 在铺层前摘掉旧宿主兜底。
 */

/** 页面级幕布控制器：三处入口（胶囊 / 弹窗 / 快捷键）与跨脚本委托共用的一套动作 */
export interface PageCurtainController {
  /** 现在是否真的铺着幕布 */
  state(): boolean;
  /** 遮住流程是否进行中（cover 已被调、还没铺上）：异步 cover 的控制器要实现它，
   *  否则让位接管方会以为「没遮」而丢掉这次的遮住请求（#114 二轮复查） */
  covering?(): boolean;
  /** 铺幕布（已铺时无操作）；一次性脚本要先读配置，允许异步 */
  cover(): void | Promise<void>;
  /** 撤幕布（没铺时无操作），撤掉后仍可再遮 */
  dismiss(): void | Promise<void>;
  /** 切换：遮着就撤，没遮就遮 */
  toggle(): void | Promise<void>;
}

/** window 上登记槽位的形状 */
export interface CurtainControllerSlot {
  /** 登记来源：content = 内容脚本，oneshot = 一次性脚本（后者见到内容脚本的登记只委托，不让位） */
  owner: 'content' | 'oneshot';
  controller: PageCurtainController;
  /** 摘掉本登记；登记已被后来者替换时是空操作（失联旧实例删不掉新登记） */
  unregister(): void;
}

interface RegistryWindow {
  __pagemaskCurtain?: CurtainControllerSlot;
  __pagemaskCurtainPending?: boolean;
}

/** 当前登记的控制器；没有登记时 null */
export function currentCurtainController(): CurtainControllerSlot | null {
  return (window as unknown as RegistryWindow).__pagemaskCurtain ?? null;
}

/** 登记本文档的幕布控制器（覆盖已有登记；让旧控制器先收尾是调用方的责任） */
export function registerCurtainController(
  owner: CurtainControllerSlot['owner'],
  controller: PageCurtainController,
): CurtainControllerSlot {
  const w = window as unknown as RegistryWindow;
  const slot: CurtainControllerSlot = {
    owner,
    controller,
    unregister: () => {
      if (w.__pagemaskCurtain === slot) w.__pagemaskCurtain = undefined;
    },
  };
  w.__pagemaskCurtain = slot;
  return slot;
}
