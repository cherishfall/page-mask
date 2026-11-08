/**
 * 幕布上的「恢复」按钮（#50）：纯 DOM，不依赖 Vue。
 *
 * 为什么单独一个模块：幕布有两条代码路径（已添加站点的内容脚本 ui/content-runtime.ts、
 * 没添加过的一次性脚本 entrypoints/curtain-oneshot.ts），原来各写了一份「恢复」按钮，
 * 长得不一样。按钮归幕布宿主所有，两条路径共用这同一份实现与 ui/toggle/toggle.css 里的
 * 同一套材质（--pm-bg / --pm-border-control / --pm-radius-pill / --pm-shadow-overlay）。
 *
 * - 视觉：常态全不透明（#87：遮住后唯一的出路，半透明会在白底幕布上把描边对比拉到 3:1 以下），
 *   只显示睁开的眼睛；悬停 / 键盘聚焦显出「恢复」两个字。
 *   「恢复」始终占位、只变透明度，所以出现文字时按钮不位移、不挤压
 * - 拖动：按下并移动超过阈值（core/curtain.ts 的 isCurtainDrag）算拖动，松手不恢复；
 *   否则算点击（恢复）。用 setPointerCapture，指针被系统取消时同样收尾
 * - 位置：调用方给初始坐标（已添加站点取该站 capsule 的 floatingBtnPos，一次性脚本取全局位置），
 *   拖动结束后只回传坐标，写回存储的策略由调用方决定
 */
import { isCurtainDrag } from '@/core/curtain';
import { onLocaleChange, t } from '@/core/i18n';
import { BUTTON_EDGE, clampPos } from '@/core/button-pos';
import type { ButtonPos } from '@/core/types';
import { EYE_OUTLINE_PATH } from './icons/paths';
import { adoptToggleStyles } from './toggle/toggle-styles';

/** 没存过坐标时的默认位置：与胶囊同一套（离线右各 16px） */
const DEFAULT_INSET = 16;
/** 首帧还没排版时按典型尺寸夹紧，避免算出负数（实际约 61×28，只用于极端情况兜底） */
const FALLBACK_SIZE = { width: 62, height: 28 };
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface CurtainRestoreDeps {
  /** 幕布宿主的根容器（ui/curtain.ts 的 layer.root） */
  root: HTMLElement;
  /** 记住的位置（视口坐标，锚点是按钮左上角）；null = 右下角 */
  position: ButtonPos | null;
  /** 拖动结束：已发生的位移（已夹进视口），写回存储由调用方决定 */
  onMove(pos: ButtonPos): void;
  /** 点击（不是拖动）→ 撤幕布 */
  onRestore(): void;
}

export interface CurtainRestoreButton {
  el: HTMLButtonElement;
  /** 移除按钮、解绑全部监听（可重复调用） */
  destroy(): void;
}

/** 睁开的眼睛（与胶囊上的「遮住」图标同形，去掉斜线那一笔） */
function createEyeIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pm-curtain-restore-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const outline = doc.createElementNS(SVG_NS, 'path');
  // 路径数据与弹窗 EyeOpenIcon 共用一份（#132）：睁眼在全项目只有一个样子
  outline.setAttribute('d', EYE_OUTLINE_PATH);
  const pupil = doc.createElementNS(SVG_NS, 'circle');
  pupil.setAttribute('cx', '12');
  pupil.setAttribute('cy', '12');
  pupil.setAttribute('r', '3');
  svg.append(outline, pupil);
  return svg;
}

export function createCurtainRestoreButton(deps: CurtainRestoreDeps): CurtainRestoreButton {
  const doc = deps.root.ownerDocument;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'pm-curtain-restore';
  btn.dataset.testid = 'pm-curtain-restore';
  // 语言切换时就地换字（#57：幕布按钮已打开的页面也要跟着变）
  const syncText = () => {
    btn.setAttribute('aria-label', t().curtain.restoreAria);
    btn.title = t().curtain.restore;
    label.textContent = t().curtain.restore;
  };
  const label = doc.createElement('span');
  label.className = 'pm-curtain-restore-label';
  btn.append(createEyeIcon(doc), label);
  syncText();
  const offLocale = onLocaleChange(syncText);

  const rootNode = deps.root.getRootNode();
  if (rootNode instanceof ShadowRoot) adoptToggleStyles(rootNode);

  /** 当前坐标；null = 右下角（默认位置） */
  let pos: ButtonPos | null = deps.position;

  function size(): { width: number; height: number } {
    const r = btn.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : FALLBACK_SIZE;
  }

  function clamp(p: ButtonPos): ButtonPos {
    const { width, height } = size();
    return clampPos(p.x, p.y, width, height, window.innerWidth, window.innerHeight);
  }

  /**
   * 摆放按钮。free = 拖动中：跟手（左上角自由坐标，已夹紧）。
   * 0.8.6 起与胶囊同用自由定位（#135）：存什么坐标渲染哪，不再贴边停靠；
   * 悬停显隐「恢复」文字时按钮向右生长（left 锚定，左侧不跳）。
   */
  function place(free = false): void {
    if (!pos) {
      btn.style.left = '';
      btn.style.top = '';
      btn.style.right = `${DEFAULT_INSET}px`;
      btn.style.bottom = `${DEFAULT_INSET}px`;
      return;
    }
    btn.style.bottom = '';
    btn.style.right = '';
    btn.style.left = `${Math.round(pos.x)}px`;
    btn.style.top = `${Math.round(pos.y)}px`;
    void free;
  }

  deps.root.appendChild(btn);
  place();

  const ac = new AbortController();
  const opts = { signal: ac.signal };

  let drag: { pointerId: number; startX: number; startY: number; grabX: number; grabY: number; moved: boolean } | null =
    null;
  /** 本次手势拖动过：随后的 click 不当成「恢复」 */
  let suppressClick = false;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || drag) return;
    const r = btn.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      moved: false,
    };
    suppressClick = false;
    btn.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!btn.hasPointerCapture(e.pointerId)) return;
    if (!drag.moved && !isCurtainDrag(e.clientX - drag.startX, e.clientY - drag.startY)) return;
    drag.moved = true;
    btn.classList.add('pm-curtain-restore-dragging');
    pos = clamp({ x: e.clientX - drag.grabX, y: e.clientY - drag.grabY });
    place(true);
  }

  /**
   * 松手 / 指针被系统取消（触屏滑动、来电等）/ 捕获被夺走都走到这里：统一收尾。
   * 拖动过就落库（视觉上已经移动了，不落库下次会跳回去）；没拖动过什么也不做，留给 click 判定。
   */
  function endDrag(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    drag = null;
    btn.classList.remove('pm-curtain-restore-dragging');
    if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
    if (moved) {
      suppressClick = true;
      if (pos) {
        // 0.8.6 自由定位：坐标已随拖动夹紧，原样落库（与胶囊同一模型，#135）
        place();
        deps.onMove(pos);
      }
    }
  }

  function onClick(): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    deps.onRestore();
  }

  /** 窗口变小后重新夹紧：x/y 都可能出界（0.8.6 自由坐标），只改显示位置，不回写存储 */
  function onResize(): void {
    if (!pos) return;
    const next = clamp(pos);
    if (next.x === pos.x && next.y === pos.y) return;
    pos = next;
    place();
  }

  btn.addEventListener('pointerdown', onPointerDown, opts);
  btn.addEventListener('pointermove', onPointerMove, opts);
  btn.addEventListener('pointerup', endDrag, opts);
  btn.addEventListener('pointercancel', endDrag, opts);
  btn.addEventListener('lostpointercapture', endDrag, opts);
  btn.addEventListener('click', onClick, opts);
  window.addEventListener('resize', onResize, opts);

  let destroyed = false;
  return {
    el: btn,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      offLocale();
      ac.abort();
      btn.remove();
    },
  };
}
