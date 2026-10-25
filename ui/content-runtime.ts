/**
 * 内容脚本运行时：生命周期编排。
 * - 已配置站点伪装态：请求后台注入隐藏样式 + 标题/图标伪装 + 体检 + 悬浮按钮
 * - 原样态：完全还原（样式、标题、图标），悬浮按钮保留（切回入口）
 * - storage.onChanged 驱动同站多标签页联动；SPA 路由变化重评估生效范围
 */
import { createApp, type App } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage, profileKey } from '@/core/storage';
import { TitleFaviconGuard, effectiveTitle } from '@/core/disguise';
import { probeRules } from '@/core/health';
import type { GlobalSettings, SiteProfile } from '@/core/types';
import FloatingToggle from './FloatingToggle.vue';

const TOGGLE_HOST_ID = 'pagemask-floating-host';

export function initContentRuntime(): void {
  const origin = location.origin;
  const storage = createPageMaskStorage(browser.storage.local);
  const guard = new TitleFaviconGuard(document);

  let profile: SiteProfile | null = null;
  let settings: GlobalSettings = { defaultTitle: '新建标签页' };
  let host: HTMLDivElement | null = null;
  let app: App | null = null;
  let lastHref = location.href;
  let lastHealthFingerprint = '';

  // ---------- 悬浮按钮 ----------

  function mountToggle() {
    if (host) {
      syncToggleProps();
      return;
    }
    host = document.createElement('div');
    host.id = TOGGLE_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(host);
    app = createApp(FloatingToggle, {
      state: profile?.switchState ?? 'original',
      position: profile?.floatingBtnPos ?? null,
      onToggle: handleToggle,
      onMoved: handleMoved,
      onEdit: handleEdit,
      onResetPos: handleResetPos,
    });
    app.mount(mountPoint);
  }

  function syncToggleProps() {
    // 简单可靠：卸载重建（按钮极小，无感知）
    unmountToggle();
    mountToggle();
  }

  function unmountToggle() {
    app?.unmount();
    app = null;
    host?.remove();
    host = null;
  }

  async function handleToggle() {
    if (!profile) return;
    profile.switchState = profile.switchState === 'disguised' ? 'original' : 'disguised';
    await storage.putProfile(profile); // 按站点记忆 + storage.onChanged 联动所有标签页
  }

  async function handleMoved(pos: { x: number; y: number }) {
    if (!profile) return;
    profile.floatingBtnPos = pos;
    await storage.putProfile(profile);
  }

  async function handleResetPos() {
    if (!profile) return;
    profile.floatingBtnPos = null;
    await storage.putProfile(profile);
    syncToggleProps();
  }

  function handleEdit() {
    openEditorPanel();
  }

  // ---------- 编辑面板 / 向导（后续任务票接入） ----------

  function openEditorPanel() {
    console.info('[PageMask] 编辑面板即将接入');
  }

  function openWizard() {
    console.info('[PageMask] 设置向导即将接入');
  }

  // ---------- 伪装应用 / 还原 ----------

  async function applyAll(): Promise<void> {
    if (!profile) return;
    await browser.runtime.sendMessage({ t: 'applyDisguise', url: location.href }).catch(() => undefined);
    guard.apply(effectiveTitle(profile, settings), profile.faviconDataUrl);
    await runHealthCheck();
    mountToggle();
  }

  async function restoreAll(): Promise<void> {
    await browser.runtime.sendMessage({ t: 'restoreOriginal' }).catch(() => undefined);
    guard.restore();
    mountToggle();
  }

  /** 体检：仅伪装态下采集（原样态规则本就不应用，只会假警报） */
  async function runHealthCheck(): Promise<void> {
    if (!profile || profile.switchState !== 'disguised') return;
    const results = probeRules(profile.hideRules, location.href, (sel) => {
      try {
        return document.querySelectorAll(sel).length;
      } catch {
        return 0;
      }
    });
    let changed = false;
    const now = Date.now();
    for (const { rule, status } of results) {
      if (rule.lastHealth !== status) {
        rule.lastHealth = status;
        rule.lastHealthAt = now;
        changed = true;
      }
    }
    const fp = JSON.stringify(profile.hideRules.map((r) => [r.id, r.lastHealth]));
    if (changed && fp !== lastHealthFingerprint) {
      lastHealthFingerprint = fp;
      await storage.putProfile(profile);
    }
  }

  // ---------- 状态刷新 ----------

  async function refreshState(): Promise<void> {
    const [p, s] = await Promise.all([storage.getProfile(origin), storage.getSettings()]);
    settings = s;
    if (!p) {
      // 站点被一键清空：撤掉一切痕迹
      unmountToggle();
      guard.restore();
      return;
    }
    profile = p;
    if (profile.switchState === 'disguised') {
      await applyAll();
    } else {
      await restoreAll();
    }
  }

  // storage 变化驱动：开关切换、规则增删改、标题/图标修改、健康状态回写
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const keys = Object.keys(changes);
    if (!keys.some((k) => k === profileKey(origin) || k === 'settings')) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshState(), 150);
  });

  // SPA 路由变化：重评估每条规则的生效范围（微信读书翻页等场景）
  setInterval(() => {
    if (location.href !== lastHref && profile?.switchState === 'disguised') {
      lastHref = location.href;
      void applyAll();
    } else {
      lastHref = location.href;
    }
  }, 1000);

  // popup 触发的入口消息
  browser.runtime.onMessage.addListener((msg: { t?: string }) => {
    if (msg?.t === 'openWizard') openWizard();
    if (msg?.t === 'openEditor') openEditorPanel();
  });

  void refreshState();
}
