/**
 * 一次性幕布脚本（#46，design.md「幕布」一节的「未添加过的网站」那条）：
 * 没添加过的网站里没有内容脚本（ADR-0001：未配置零注入），老板走过来时却恰恰可能正在看它。
 * 用户点 popup 的「遮住本页」，后台用 activeTab 把本脚本注入当前标签页，立刻铺开幕布。
 *
 * 与已添加站点的幕布（#45）共用同一套覆盖层、标题逻辑与恢复按钮
 * （ui/curtain-restore.ts，样式也是同一份 ui/toggle/toggle.css），只是：
 * - 没有悬浮胶囊；幕布上那颗「恢复」按钮就是唯一的入口
 * - 标题按本站自己的配置取（待授权的站点有配置、只是权限被收回，不能用全局默认盖掉它），
 *   图标一律换成透明图标
 * - 没有站点配置可写：按钮位置记在全局设置里（本机界面状态，导入时保留本机值）
 * - 进入前一定是原样态（这里本来就没有配置），所以恢复一律还原标题与图标
 *
 * 幂等（#50）：window 上只登记一个控制器、只注册一次消息监听。重复注入不再叠第二层，
 * 而是让活着的控制器再遮一次——「撤掉后再次遮住」也走这条路。
 * 消息（#50）：应答「现在遮着没有」与「撤掉」，且只接受扩展自己的页面发来的，
 * 只作用于本文档（网页里的脚本影响不到别的站点）。
 * 不留痕迹：不写站点配置、不注册脚本、不申请站点权限；刷新 / 整页跳转后脚本随文档消失。
 */
export default defineUnlistedScript(() => {
  // 幂等要同步判：脚本主体要动态导入模块（异步），两次注入可能在同一批里到达，
  // 只靠「已经遮住了」判断会放过第二次。先占位，主体跑完再换成真正的控制器。
  const w = window as unknown as OneshotWindow;
  if (w.__pagemaskCurtain) {
    // 已经有一个活着的控制器（可能刚撤掉幕布）：让它再遮一次，不叠加、不重复注册监听
    void w.__pagemaskCurtain.cover();
    return;
  }
  if (w.__pagemaskCurtainPending) return;
  w.__pagemaskCurtainPending = true;
  void run().catch((e: unknown) => {
    w.__pagemaskCurtainPending = false;
    console.warn('[PageMask] 遮住本页失败', e);
  });
});

/** 一次性幕布控制器：遮、撤都由它负责，撤掉之后还能再遮 */
interface CurtainOneshot {
  /** 铺幕布（已铺时无操作）；重复注入与「撤掉后再遮」都调它 */
  cover(): Promise<void>;
  /** 撤幕布（没铺时无操作），之后仍可再遮 */
  restore(): void;
}

interface OneshotWindow {
  __pagemaskCurtain?: CurtainOneshot;
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
  ]);

  const w = window as unknown as OneshotWindow;
  // 并发的第二次注入已经先登记了控制器：交给它
  if (w.__pagemaskCurtain) {
    w.__pagemaskCurtainPending = false;
    void w.__pagemaskCurtain.cover();
    return;
  }

  const origin = location.origin;
  const extensionBase = browser.runtime.getURL('/');
  const layer = new CurtainLayer({ createHost: () => createPageHost(null, 'curtain') });
  const guard = new TitleFaviconGuard(document);
  const styles = createDocStyles((m) => browser.runtime.sendMessage(m));
  const storage = storageMod.createPageMaskStorage(browser.storage.local);
  let button: { destroy(): void } | null = null;
  /** 进行中的遮住流程：同批到来的第二次注入复用同一次，不铺第二层 */
  let pending: Promise<void> | null = null;

  function restore(): void {
    if (!layer.active) return;
    button?.destroy();
    button = null;
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
        storage.getProfile(origin).catch(() => null),
        storage.getSettings().catch(() => null),
      ]);
      guard.apply(curtainTitle(profile, settings), null);
      layer.show();
      const root = layer.root;
      if (!root) return;
      button = createCurtainRestoreButton({
        root,
        // 没添加过的网站没有站点配置：位置记在全局设置里（默认右下角）
        position: settings?.curtainBtnPos ?? null,
        onMove: (pos) => void storage.setCurtainBtnPos(pos).catch(() => undefined),
        onRestore: restore,
      });
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  const handle: CurtainOneshot = { cover, restore };
  w.__pagemaskCurtain = handle;
  w.__pagemaskCurtainPending = false;

  // 查询 / 撤掉幕布（#50）：只接受扩展自己的页面发来的，只作用于本文档；
  // 没遮住时查询回 covered:false（不报错），撤掉之后仍可再遮
  browser.runtime.onMessage.addListener(
    (msg: { t?: string } | undefined, sender, sendResponse: (r: { ok: boolean; covered: boolean }) => void) => {
      if (msg?.t !== 'curtainState' && msg?.t !== 'curtainDismiss') return false;
      if (!fromExtensionPage(sender as { id?: string; url?: string } | undefined, browser.runtime.id, extensionBase)) {
        return false;
      }
      if (msg.t === 'curtainDismiss') restore();
      sendResponse({ ok: true, covered: layer.active });
      return false;
    },
  );

  await cover();
}
