/**
 * Shadow DOM 工具：PageMask 的页内界面（悬浮按钮、向导、编辑面板）都挂在 open shadow root 里。
 *
 * 用法：
 *   await waitForShadow(page, 'pagemask-wizard', '[data-testid="pm-wiz-save"]');
 *   await clickInShadow(page, 'pagemask-toggle', '[title^="PageMask"]');                 // 真实左键
 *   await clickInShadow(page, 'pagemask-toggle', '[title^="PageMask"]', { button: 'right' }); // 真实右键
 *   const txt = await shadowText(page, 'pagemask-wizard', '[data-testid="pm-wiz-preview"]');
 */
import { CheckError, waitFor } from './harness.mjs';

/** shadow root 内元素是否存在 */
export async function shadowExists(page, hostSelector, innerSelector) {
  return page.evaluate(
    (h, s) => !!document.querySelector(h)?.shadowRoot?.querySelector(s),
    hostSelector,
    innerSelector,
  );
}

/** 等待 shadow root 内元素出现 */
export async function waitForShadow(page, hostSelector, innerSelector, { timeout = 8000 } = {}) {
  await waitFor(
    page,
    `${hostSelector} 内出现 ${innerSelector}`,
    (h, s) => !!document.querySelector(h)?.shadowRoot?.querySelector(s),
    [hostSelector, innerSelector],
    { timeout },
  );
}

/** 取 shadow root 内元素的文本 */
export async function shadowText(page, hostSelector, innerSelector) {
  return page.evaluate(
    (h, s) => document.querySelector(h)?.shadowRoot?.querySelector(s)?.textContent ?? '',
    hostSelector,
    innerSelector,
  );
}

/**
 * 在 shadow root 内找到元素，取其包围盒中心，用 page.mouse 做真实鼠标点击
 * （会经过命中测试：被别的元素盖住就点不到，这正是要验证的）。
 * options.button: 'left'（默认）| 'right'；options.offset: { x, y } 相对左上角的点击位置。
 */
export async function clickInShadow(page, hostSelector, innerSelector, { button = 'left', offset } = {}) {
  const box = await page.evaluate(
    (h, s) => {
      const el = document.querySelector(h)?.shadowRoot?.querySelector(s);
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    hostSelector,
    innerSelector,
  );
  if (!box) throw new CheckError(`找不到 ${hostSelector} 内的 ${innerSelector}`);
  if (box.width === 0 || box.height === 0) throw new CheckError(`${hostSelector} 内的 ${innerSelector} 不可见（尺寸为 0）`);
  const x = box.x + (offset ? offset.x : box.width / 2);
  const y = box.y + (offset ? offset.y : box.height / 2);
  await page.mouse.click(x, y, { button });
  return { x, y };
}
