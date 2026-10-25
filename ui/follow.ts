/**
 * 元素跟随定位：rAF 循环把盒子位置同步到目标元素当前矩形（design.md：遮罩滚动跟手）。
 * 幽灵标记（元素已被移除、无活动矩形）用"初始矩形 + 滚动差值"跟随。
 */

export interface LivePair {
  el: Element;
  box: HTMLElement;
}

export interface GhostPair {
  /** 进入预览时捕获的视口矩形 */
  baseRect: { left: number; top: number; width: number; height: number };
  baseScroll: { x: number; y: number };
  box: HTMLElement;
}

export class ElementFollower {
  private live = new Map<HTMLElement, LivePair>();
  private ghosts = new Map<HTMLElement, GhostPair>();
  private raf = 0;

  trackLive(el: Element, box: HTMLElement): void {
    this.live.set(box, { el, box });
    this.tick();
    this.ensure();
  }

  trackGhost(baseRect: GhostPair['baseRect'], box: HTMLElement): void {
    this.ghosts.set(box, {
      baseRect,
      baseScroll: { x: window.scrollX, y: window.scrollY },
      box,
    });
    this.tick();
    this.ensure();
  }

  drop(box: HTMLElement): void {
    this.live.delete(box);
    this.ghosts.delete(box);
    box.remove();
    if (this.live.size === 0 && this.ghosts.size === 0) this.stop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const { box } of this.live.values()) box.remove();
    for (const { box } of this.ghosts.values()) box.remove();
    this.live.clear();
    this.ghosts.clear();
  }

  private ensure(): void {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.loop());
  }

  private loop(): void {
    if (this.live.size === 0 && this.ghosts.size === 0) {
      this.raf = 0;
      return;
    }
    this.tick();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private tick(): void {
    for (const { el, box } of this.live.values()) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        box.style.display = 'none';
        continue;
      }
      box.style.display = '';
      box.style.left = `${r.left}px`;
      box.style.top = `${r.top}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
    }
    for (const { baseRect, baseScroll, box } of this.ghosts.values()) {
      const dx = window.scrollX - baseScroll.x;
      const dy = window.scrollY - baseScroll.y;
      box.style.left = `${baseRect.left - dx}px`;
      box.style.top = `${baseRect.top - dy}px`;
      box.style.width = `${baseRect.width}px`;
      box.style.height = `${baseRect.height}px`;
    }
  }
}
