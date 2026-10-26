/**
 * 首屏过渡遮挡（ADR-0005）：只在 document_start 启动时用，只活几十毫秒。
 *
 * 为什么需要：正式隐藏样式要经后台 insertCSS（用户样式表通道，ADR-0002），往返一次 SW
 * 赶不上首帧（实测 CfT 157 本地页面首个动画帧约在 5ms）；连读一次 storage 也常常赶不上。
 * 内容脚本没有任何同步读取配置的途径，只能先"什么都别画"，知道配置后再精确到规则。
 *
 * 做法：可构造样式表（new CSSStyleSheet + document.adoptedStyleSheets）——不是 DOM 节点、
 * 不受页面 CSP 限制、不会被框架重渲染洗掉，与 ADR-0002 否决 <style>/行内样式的理由不冲突。
 * 1. 启动即整页透明（:root opacity 0；子元素无法用 visibility:visible 透出）
 * 2. 读到配置：清爽态 → 换成该页的精确隐藏规则；否则立即撤掉
 * 3. 后台确认正式样式已注入 → 撤掉（之后完全由用户样式表负责）
 * 兜底：超时自动撤掉，任何异常都不会让页面一直空白。
 */
export interface FirstPaintShield {
  /** 换成精确规则（null = 没有要藏的，等同撤掉）；已撤掉则无操作 */
  narrow(css: string | null): void;
  /** 撤掉遮挡；可重复调用 */
  release(): void;
}

const NOOP: FirstPaintShield = { narrow: () => undefined, release: () => undefined };

export function createFirstPaintShield(doc: Document, { timeoutMs = 1500 } = {}): FirstPaintShield {
  // 只在页面还没开始显示时有意义；对已加载页面（启用站点时 executeScript 注入）用了反而会闪一下白
  if (doc.readyState !== 'loading') return NOOP;
  let sheet: CSSStyleSheet | null = null;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(':root { opacity: 0 !important; }');
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch {
    return NOOP; // 不支持可构造样式表的环境：退回只靠用户样式表
  }
  const timer = setTimeout(() => release(), timeoutMs);

  function release(): void {
    if (!sheet) return;
    const s = sheet;
    sheet = null;
    clearTimeout(timer);
    try {
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((x) => x !== s);
    } catch {
      // 忽略
    }
  }

  return {
    narrow(css) {
      if (!sheet) return;
      if (!css) return release();
      try {
        sheet.replaceSync(css);
      } catch {
        release();
      }
    },
    release,
  };
}
