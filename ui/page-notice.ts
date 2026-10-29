/**
 * 页内轻提示（#53）：保存完关掉向导之后说一句话，不拦着用户。
 *
 * 用在「这次一条规则都没有」的保存上（只改了标签页标题）：向导一关页面就变样，
 * 不给一句话用户会以为没生效。它不是对话框——没有按钮、不抢焦点、几秒后自己消失。
 *
 * 自己一个宿主（core/host-shield.ts 的 HOST_TAGS.notice）：向导卸载后提示还在。
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createPageHost } from './page-host';

/** 提示停留多久（够读完一句话，又不至于一直挂着） */
export const NOTICE_MS = 4000;

/**
 * 在页面底部显示一句提示。返回撤掉它的函数（宿主挂了 onInvalidated，扩展失效时也会自己消失）。
 */
export function showPageNotice(ctx: ContentScriptContext | null, text: string, ms = NOTICE_MS): () => void {
  const host = createPageHost(ctx, 'notice');
  const el = host.root.ownerDocument.createElement('div');
  el.className = 'pm-notice';
  el.dataset.testid = 'pm-page-notice';
  el.setAttribute('role', 'status');
  el.textContent = text;
  host.root.appendChild(el);
  const timer = setTimeout(() => host.remove(), ms);
  return () => {
    clearTimeout(timer);
    host.remove();
  };
}
