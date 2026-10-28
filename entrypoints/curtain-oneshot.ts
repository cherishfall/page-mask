/**
 * 一次性幕布脚本（#46，design.md「幕布」一节的「未添加过的网站」那条）：
 * 没添加过的网站里没有内容脚本（ADR-0001：未配置零注入），老板走过来时却恰恰可能正在看它。
 * 用户点 popup 的「遮住本页」，后台用 activeTab 把本脚本注入当前标签页，立刻铺开幕布。
 *
 * 与已添加站点的幕布（#45）共用同一套覆盖层与标题逻辑，只是：
 * - 没有站点配置，标题取全局默认 / 界面语言默认；图标换成透明图标
 * - 没有悬浮胶囊，幕布上自己放一个「恢复」入口（默认低对比度，指针移上去才显出完整按钮）
 * - 进入前一定是原样态（这里本来就没有配置），所以恢复一律还原标题与图标
 *
 * 幂等：重复注入不叠加第二层——已遮住时什么都不做，恢复走幕布上的「恢复」按钮。
 * 不留痕迹：不写配置、不注册脚本、不申请站点权限；刷新 / 整页跳转后脚本随文档消失，幕布自然不见。
 */
export default defineUnlistedScript(() => {
  // 幂等要同步判：脚本主体要动态导入模块（异步），两次注入可能在同一批里到达，
  // 只靠「已经遮住了」判断会放过第二次。先占位，主体跑完再换成真正的句柄。
  const w = window as unknown as { __pagemaskCurtain?: CurtainHandle; __pagemaskCurtainPending?: boolean };
  if (w.__pagemaskCurtain || w.__pagemaskCurtainPending) return;
  w.__pagemaskCurtainPending = true;
  void run().catch((e: unknown) => {
    w.__pagemaskCurtainPending = false;
    console.warn('[PageMask] 遮住本页失败', e);
  });
});

type CurtainHandle = { restore(): void };

async function run(): Promise<void> {
  // 动态导入：本文件在构建期会被 WXT 读取入口定义，顶层引入会把 Vue 单文件组件与 ?inline 样式
  // 一起拉进那个环境（entrypoints/content.ts 的注释里记过这个坑）
  const [{ browser }, { CurtainLayer }, { createPageHost }, { TitleFaviconGuard }, { createDocStyles }, { effectiveTitle }, storageMod] =
    await Promise.all([
      import('wxt/browser'),
      import('@/ui/curtain'),
      import('@/ui/page-host'),
      import('@/core/disguise'),
      import('@/core/doc-styles'),
      import('@/core/titles'),
      import('@/core/storage'),
    ]);

  const w = window as unknown as { __pagemaskCurtain?: CurtainHandle; __pagemaskCurtainPending?: boolean };
  if (w.__pagemaskCurtain) {
    w.__pagemaskCurtainPending = false;
    return;
  }

  const layer = new CurtainLayer({ createHost: () => createPageHost(null, 'curtain') });
  const guard = new TitleFaviconGuard(document);
  const styles = createDocStyles((m) => browser.runtime.sendMessage(m));

  // 宿主保护样式（core/host-shield.ts）：页面自己的 CSS 压不到幕布
  void styles.syncShield(true);

  const settings = await storageMod
    .createPageMaskStorage(browser.storage.local)
    .getSettings()
    .catch(() => null);
  guard.apply(effectiveTitle({ disguisedTitle: null }, settings), null);
  layer.show();

  const handle: CurtainHandle = {
    restore() {
      layer.hide();
      guard.restore();
      void styles.syncShield(false);
      w.__pagemaskCurtain = undefined;
      w.__pagemaskCurtainPending = false;
    },
  };
  w.__pagemaskCurtain = handle;
  w.__pagemaskCurtainPending = false;

  // 「恢复」入口：幕布上唯一的控件。默认几乎看不见，指针移上去才显出完整按钮——
  // 幕布的作用是"看起来像页面还没加载"，上面多一个显眼的按钮会当场穿帮。
  const root = layer.root;
  if (root) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '恢复';
    btn.dataset.pmCurtainRestore = '';
    btn.dataset.testid = 'pm-curtain-restore';
    btn.setAttribute('aria-label', '撤掉幕布，回到刚才的页面');
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      padding: '4px 12px',
      borderRadius: '999px',
      border: '1px solid transparent',
      background: 'transparent',
      color: 'var(--pm-fg-muted)',
      font: 'inherit',
      fontSize: '12px',
      lineHeight: '1.4',
      cursor: 'pointer',
      opacity: '0.55',
    } as Partial<CSSStyleDeclaration>);
    const reveal = () => (btn.style.opacity = '1');
    const conceal = () => (btn.style.opacity = '0.55');
    btn.addEventListener('pointerenter', reveal);
    btn.addEventListener('pointerleave', conceal);
    btn.addEventListener('focus', reveal);
    btn.addEventListener('blur', conceal);
    btn.addEventListener('click', () => handle.restore());
    root.appendChild(btn);
  }
}
