/**
 * 消息来源判定（#50，沿用的 REVIEW B26 口径）：幕布的两条消息「查询状态 / 撤掉幕布」
 * 只能由扩展自己的页面发起，网页里的内容脚本 / 网页脚本发来的消息一律不算。
 */
import { fromExtensionPage } from '@/core/messages';

const ID = 'abcdefghijklmnop';
const BASE = `chrome-extension://${ID}/`;

describe('fromExtensionPage：谁是"自己人"', () => {
  it('popup / 管理页 / 引导页 / 控制页（本扩展的扩展页面）→ true', () => {
    expect(fromExtensionPage({ id: ID, url: `${BASE}popup.html` }, ID, BASE)).toBe(true);
    expect(fromExtensionPage({ id: ID, url: `${BASE}management.html#https://a.com` }, ID, BASE)).toBe(true);
  });

  it('网页里的内容脚本 / 网页脚本（url 是网页地址）→ false', () => {
    expect(fromExtensionPage({ id: ID, url: 'https://weread.qq.com/web/reader' }, ID, BASE)).toBe(false);
  });

  it('别的扩展 / 没有发送方 / 没有 url → false', () => {
    expect(fromExtensionPage({ id: 'other-extension', url: `${BASE}popup.html` }, ID, BASE)).toBe(false);
    expect(fromExtensionPage(undefined, ID, BASE)).toBe(false);
    expect(fromExtensionPage({}, ID, BASE)).toBe(false);
  });

  it('同 id 但地址只是前缀相似（不同目录）→ false', () => {
    expect(fromExtensionPage({ id: ID, url: `chrome-extension://${ID}.evil/popup.html` }, ID, BASE)).toBe(false);
  });
});
