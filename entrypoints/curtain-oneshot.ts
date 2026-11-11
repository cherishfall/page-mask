/**
 * 一次性幕布脚本（#46，design.md「幕布」一节的「未添加过的网站」那条）：
 * 没添加过的网站里没有内容脚本（ADR-0001：未配置零注入），老板走过来时却恰恰可能正在看它。
 * 用户点 popup 的「遮住本页」或按快捷键，后台把本脚本注入当前标签页，立刻铺开幕布。
 *
 * 与已添加站点的幕布（#45）共用同一套覆盖层、标题逻辑与恢复按钮
 * （ui/curtain-restore.ts，样式也是同一份 ui/toggle/toggle.css），只是：
 * - 没有悬浮胶囊；幕布上那颗「恢复」按钮就是唯一的入口
 * - 标题按本站自己的配置取（待授权的站点有配置、只是权限被收回，不能用全局默认盖掉它），
 *   图标一律换成透明图标
 * - 没有站点配置可写：按钮位置记在全局设置里（本机界面状态，导入时保留本机值）
 * - 进入前一定是原样态（这里本来就没有配置），所以恢复一律还原标题与图标
 *
 * 每个文档一个控制器（#107，ADR-0011）：控制器（state / cover / dismiss / toggle）登记在
 * window.__pagemaskCurtain（ui/curtain-controller.ts），与内容脚本共用同一个登记处：
 * - 启动时已有内容脚本的登记：只委托遮住，不铺层、不注册监听（内容脚本自己的监听应答消息）；
 * - 已有另一个一次性脚本的登记：先委托；委托失败说明那是扩展重载前的失联旧实例
 *   （它的扩展 API 已死），摘掉它的登记、自己接管；
 * - 没有登记：自己登记。重复注入（同批或先后）都不叠第二层。
 * 消息（#107）：四条幕布消息（curtainState / curtainCover / curtainDismiss / curtainToggle）
 * 都委托给登记处里的控制器应答，且只接受扩展自己的页面发来的，只作用于本文档。
 * 不留痕迹：不写站点配置、不注册脚本、不申请站点权限；刷新 / 整页跳转后脚本随文档消失。
 */
// 类型单独 import type（构建期擦除，不会把运行时代码拉进读取入口；runtime 值在 run() 里动态导入）
import type { CurtainControllerSlot, PageCurtainController } from '@/ui/curtain-controller';

export default defineUnlistedScript(() => {
  const w = window as unknown as OneshotWindow;
  // 同批到来的第二次注入正在初始化：让它完成（幂等要同步判：脚本主体要动态导入模块，异步）
  if (w.__pagemaskCurtainPending) return;
  const existing = w.__pagemaskCurtain;
  if (existing?.owner === 'content') {
    // 内容脚本的控制器已登记：只委托遮住（幂等），不铺第二层、不重复注册监听（#107）。
    // 它失联时的收尾（撤层 + 注销）由它自己的 ctx 负责；这里委托失败也只忽略——
    // 幕布层随文档消失，页内的「恢复」按钮不依赖消息，仍可用。
    void Promise.resolve(existing.controller.cover()).catch(() => undefined);
    return;
  }
  w.__pagemaskCurtainPending = true;
  if (existing) {
    // 另一个一次性脚本的控制器：可能是扩展重载前的失联旧实例。委托遮住；委托失败
    // （旧实例读存储就抛「Extension context invalidated」）就摘掉它的登记、自己接管。
    // 同一扩展会话里的重复注入委托成功，不重复铺层、不重复注册监听。
    void (async () => {
      try {
        await Promise.resolve(existing.controller.cover());
        w.__pagemaskCurtainPending = false;
      } catch {
        w.__pagemaskCurtainPending = false;
        try {
          existing.controller.dismiss();
        } catch {
          // 旧层撤不掉就让它随文档消失（宿主会被 CurtainLayer.show() 摘掉）
        }
        existing.unregister();
        void run().catch((e: unknown) => console.warn('[PageMask] 遮住本页失败', e));
      }
    })();
    return;
  }
  void run().catch((e: unknown) => {
    w.__pagemaskCurtainPending = false;
    console.warn('[PageMask] 遮住本页失败', e);
  });
});

interface OneshotWindow {
  __pagemaskCurtain?: CurtainControllerSlot;
  __pagemaskCurtainPending?: boolean;
}

async function run(): Promise<void> {
  // 动态导入：本文件在构建期会被 WXT 读取入口定义，顶层引入会把 Vue 单文件组件与 ?inline 样式
  // 一起拉进那个环境（entrypoints/content.ts 的注释里记过这个坑）
  const [
    { browser },
    { CurtainLayer },
    { createPageHost },
    { TitleFaviconGuard },
    { createDocStyles },
    storageMod,
    { createCurtainRestoreButton },
    { curtainTitle },
    { fromExtensionPage },
    { TRANSPARENT_PNG },
    { registerCurtainController },
    { siteKey },
  ] = await Promise.all([
    import('wxt/browser'),
    import('@/ui/curtain'),
    import('@/ui/page-host'),
    import('@/core/disguise'),
    import('@/core/doc-styles'),
    import('@/core/storage'),
    import('@/ui/curtain-restore'),
    import('@/core/curtain'),
    import('@/core/messages'),
    import('@/core/icon'),
    import('@/ui/curtain-controller'),
    import('@/core/site-key'),
  ]);

  const w = window as unknown as OneshotWindow;
  // 并发的第二次注入已经先登记了控制器：交给它。
  // pending 必须复位——不复位的话，此后本文档的任何一次注入都在入口处静默返回（实测过的失效模式）
  const existing = w.__pagemaskCurtain;
  if (existing) {
    w.__pagemaskCurtainPending = false;
    void Promise.resolve(existing.controller.cover()).catch(() => undefined);
    return;
  }

  const site = siteKey(location.href)!;
  const extensionBase = browser.runtime.getURL('/');
  const layer = new CurtainLayer({ createHost: () => createPageHost(null, 'curtain') });
  const guard = new TitleFaviconGuard(document);
  const styles = createDocStyles((m) => browser.runtime.sendMessage(m));
  const storage = storageMod.createPageMaskStorage(browser.storage.local);
  let button: { destroy(): void } | null = null;
  /** 进行中的遮住流程：同批到来的第二次注入复用同一次，不铺第二层 */
  let pending: Promise<void> | null = null;

  /** 幕布静音（0.8.0，ADR-0013）：遮住即静音本标签页，恢复 / 页面卸载即还原；发不出去就静默（后台兜底） */
  function sendCurtainMute(muted: boolean): void {
    try {
      void browser.runtime.sendMessage({ t: 'curtainMute', muted }).catch(() => undefined);
    } catch {
      // 扩展失联瞬间：后台 onUpdated 兜底按导航状态收尾
    }
  }

  function dismiss(): void {
    if (!layer.active) return;
    button?.destroy();
    button = null;
    sendCurtainMute(false);
    layer.hide();
    guard.restore();
    void styles.syncShield(false);
  }

  async function cover(): Promise<void> {
    if (layer.active) return;
    if (pending) return pending;
    pending = (async () => {
      // 宿主保护样式（core/host-shield.ts）：页面自己的 CSS 压不到幕布
      void styles.syncShield(true);
      // 待授权站点已经有配置（只是权限被收回）：遮住时用它自己设置的标题，而不是全局默认（#50）
      const [profile, settings] = await Promise.all([
        storage.getProfile(site).catch(() => null),
        storage.getSettings().catch(() => null),
      ]);
      // 遮住时固定空白图标（#121）：不能按站点配置取图标，否则选「网站原来的图标」
      // 或预置图标的站点一遮住就露出真图标
      guard.apply(curtainTitle(profile, settings), TRANSPARENT_PNG);
      // 读存储的间隙里登记处可能换了人（内容脚本让位接管，#107）：那就不再铺层——
      // CurtainLayer.show() 的孤儿清扫会把新登记者的层一起摘掉，赢家自己会遮
      if (w.__pagemaskCurtain?.controller !== controller) return;
      layer.show();
      sendCurtainMute(true); // 遮住即静音本标签页（0.8.0）：与已添加站点的幕布同一语义
      const root = layer.root;
      if (!root) return;
      button = createCurtainRestoreButton({
        root,
        // 没添加过的网站没有站点配置：位置记在全局设置里（默认右下角）
        position: settings?.curtainBtnPos ?? null,
        onMove: (pos) => void storage.setCurtainBtnPos(pos).catch(() => undefined),
        onRestore: dismiss,
      });
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  const controller: PageCurtainController = {
    state: () => layer.active,
    covering: () => pending !== null, // 遮住流程进行中（还没铺上）：让位接管方据此补遮（#114）
    cover,
    dismiss,
    toggle: () => {
      // 撤是同步的；遮要走完读配置的异步流程——把 promise 交出去，消息应答才能回「动作后」的状态
      if (layer.active) {
        dismiss();
        return;
      }
      return cover();
    },
  };
  registerCurtainController('oneshot', controller);
  w.__pagemaskCurtainPending = false;

  // 整页跳转 / 刷新 / 关标签页：幕布随文档消失，声音跟着还原（后台 onUpdated 兜底覆盖脚本被杀的路径）
  window.addEventListener('pagehide', () => {
    if (layer.active) sendCurtainMute(false);
  });

  // 查询 / 遮住 / 撤掉 / 切换（#107）：只应答自己登记的控制器。内容脚本让位接管登记处之后，
  // 应答归内容脚本自己的监听——两个监听器都动手的话，同一条 toggle 会各跑一遍（遮上又立刻
  // 切回去），等于没切。这里退位时静默（不占回复通道），由登记者应答。
  // 只接受扩展自己的页面发来的，只作用于本文档；没遮住时查询回 covered:false（不报错）。
  browser.runtime.onMessage.addListener(
    (msg: { t?: string } | undefined, sender, sendResponse: (r: { ok: boolean; covered: boolean }) => void) => {
      if (
        msg?.t !== 'curtainState' &&
        msg?.t !== 'curtainCover' &&
        msg?.t !== 'curtainDismiss' &&
        msg?.t !== 'curtainToggle'
      ) {
        return false;
      }
      if (!fromExtensionPage(sender as { id?: string; url?: string } | undefined, browser.runtime.id, extensionBase)) {
        return false;
      }
      if (w.__pagemaskCurtain?.controller !== controller) return false;
      void (async () => {
        try {
          if (msg.t === 'curtainDismiss') await Promise.resolve(controller.dismiss());
          else if (msg.t === 'curtainCover') await Promise.resolve(controller.cover());
          else if (msg.t === 'curtainToggle') await Promise.resolve(controller.toggle());
        } catch {
          // 动作失败也回当前状态，不把回复通道挂死
        }
        // covered 把「遮住流程进行中」也算上（#114 三轮复查）：后台 coverPage 注入后的回查
        // 可能落在「监听器已注册、存储还没读完」的几毫秒窗口里，只查 state() 会回 false、
        // 后台就此误报失败。动作类回复走到这里时流程已完成，covering 恒为 false，不受影响。
        sendResponse({ ok: true, covered: controller.state() || controller.covering?.() === true });
      })();
      return true; // 异步回复
    },
  );

  await cover();
}
