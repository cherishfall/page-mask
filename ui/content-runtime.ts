/**
 * 内容脚本运行时：生命周期编排。
 * - 已配置站点伪装态：请求后台注入隐藏样式（方案A/B）+ 标题/图标伪装 + 体检 +
 *   方案C遮罩覆盖层 + 悬浮按钮
 * - 原样态：完全还原（样式、标题、图标、遮罩），悬浮按钮保留（切回入口）
 * - storage.onChanged 驱动同站多标签页联动；SPA 路由变化重评估生效范围
 */
import { createApp, type App } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage, profileKey } from '@/core/storage';
import { TitleFaviconGuard, effectiveTitle } from '@/core/disguise';
import { probeRules } from '@/core/health';
import { maskRulesAt } from '@/core/css-builder';
import type { GlobalSettings, SiteProfile } from '@/core/types';
import FloatingToggle from './FloatingToggle.vue';
import WizardApp from './wizard/WizardApp.vue';
import EditorPanel from './editor/EditorPanel.vue';
import { ElementFollower } from './follow';

const TOGGLE_HOST_ID = 'pagemask-floating-host';
const WIZARD_HOST_ID = 'pagemask-wizard-host';
const EDITOR_HOST_ID = 'pagemask-editor-host';
const MASK_HOST_ID = 'pagemask-mask-host';

export function initContentRuntime(): void {
  const origin = location.origin;
  const storage = createPageMaskStorage(browser.storage.local);
  const guard = new TitleFaviconGuard(document);
  const follower = new ElementFollower();

  let profile: SiteProfile | null = null;
  let settings: GlobalSettings = { defaultTitle: '新建标签页' };
  let host: HTMLDivElement | null = null;
  let app: App | null = null;
  let wizardHost: HTMLDivElement | null = null;
  let wizardApp: App | null = null;
  let editorHost: HTMLDivElement | null = null;
  let editorApp: App | null = null;
  let maskHost: HTMLDivElement | null = null;
  let wizardActive = false;
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

  // ---------- 方案C 遮罩覆盖层 ----------

  function ensureMaskHost(): HTMLDivElement {
    if (maskHost) return maskHost;
    maskHost = document.createElement('div');
    maskHost.id = MASK_HOST_ID;
    Object.assign(maskHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483644',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.documentElement.appendChild(maskHost);
    return maskHost;
  }

  function clearMasks(): void {
    follower.stop();
    maskHost?.remove();
    maskHost = null;
  }

  /** 方案C遮罩：对当前页面生效的每条 mask 规则，给命中元素盖上不透明贴纸（滚动跟手） */
  function rebuildMasks(): void {
    clearMasks();
    if (!profile || profile.switchState !== 'disguised') return;
    const rules = maskRulesAt(profile.hideRules, location.href);
    if (rules.length === 0) return;
    const mh = ensureMaskHost();
    const seen = new Set<Element>();
    for (const rule of rules) {
      for (const sel of rule.candidates) {
        let els: NodeListOf<Element>;
        try {
          els = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        for (const el of Array.from(els)) {
          if (seen.has(el)) continue;
          seen.add(el);
          const box = document.createElement('div');
          Object.assign(box.style, {
            position: 'fixed',
            background: '#f4f4f4',
            boxSizing: 'border-box',
          } as Partial<CSSStyleDeclaration>);
          mh.appendChild(box);
          follower.trackLive(el, box);
        }
      }
    }
  }

  // ---------- 编辑面板 / 向导 ----------

  function closeEditorPanel(): void {
    editorApp?.unmount();
    editorApp = null;
    editorHost?.remove();
    editorHost = null;
  }

  /** 悬浮按钮右键 → 编辑伪装。改动直接写库，storage 变化即时重应用＝即时预览 */
  function openEditorPanel(): void {
    if (!profile || wizardActive || editorHost) return;
    editorHost = document.createElement('div');
    editorHost.id = EDITOR_HOST_ID;
    Object.assign(editorHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    const shadow = editorHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(editorHost);
    editorApp = createApp(EditorPanel, {
      origin,
      url: location.href,
      onClose: closeEditorPanel,
      onAddElement: () => {
        closeEditorPanel();
        void openWizard('addElement');
      },
      onReselect: (ruleId: string) => {
        // 重选元素 = 删除旧规则 + 进向导重新点选（v1 简化，记 DEVLOG）
        if (!profile) return;
        profile.hideRules = profile.hideRules.filter((r) => r.id !== ruleId);
        void storage.putProfile(profile);
        closeEditorPanel();
        void openWizard('addElement');
      },
    });
    editorApp.mount(mountPoint);
  }

  /** 打开设置向导：伪装态先临时还原全部规则再进入，退出后恢复（design.md 核心流程） */
  async function openWizard(mode: 'newSite' | 'addElement') {
    if (!profile || wizardActive) return;
    wizardActive = true;
    closeEditorPanel();

    const wasDisguised = profile.switchState === 'disguised';
    if (wasDisguised) {
      await browser.runtime.sendMessage({ t: 'restoreOriginal' }).catch(() => undefined);
      guard.restore();
      clearMasks();
    }
    unmountToggle();

    wizardHost = document.createElement('div');
    wizardHost.id = WIZARD_HOST_ID;
    Object.assign(wizardHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none', // 覆盖层自身穿透，页面照常交互；交互元素自行恢复 pointer-events
    } as Partial<CSSStyleDeclaration>);
    const shadow = wizardHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(wizardHost);

    wizardApp = createApp(WizardApp, {
      mode,
      url: location.href,
      onDone: () => {
        wizardApp?.unmount();
        wizardApp = null;
        wizardHost?.remove();
        wizardHost = null;
        wizardActive = false;
        // 保存路径已写入 storage；这里统一按当前配置恢复（保存触发 onChanged 但被向导屏蔽）
        void refreshState();
      },
    });
    wizardApp.mount(mountPoint);
  }

  // ---------- 伪装应用 / 还原 ----------

  async function applyAll(): Promise<void> {
    if (!profile) return;
    await browser.runtime.sendMessage({ t: 'applyDisguise', url: location.href }).catch(() => undefined);
    guard.apply(effectiveTitle(profile, settings), profile.faviconDataUrl);
    rebuildMasks();
    await runHealthCheck();
    mountToggle();
  }

  async function restoreAll(): Promise<void> {
    await browser.runtime.sendMessage({ t: 'restoreOriginal' }).catch(() => undefined);
    guard.restore();
    clearMasks();
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
      closeEditorPanel();
      guard.restore();
      clearMasks();
      return;
    }
    profile = p;
    if (profile.switchState === 'disguised') {
      await applyAll();
    } else {
      await restoreAll();
    }
  }

  // storage 变化驱动：开关切换、规则增删改、标题/图标修改、健康状态回写。
  // 向导打开期间屏蔽（避免向导内的临时状态被真样式覆盖），退出时统一 refreshState
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || wizardActive) return;
    const keys = Object.keys(changes);
    if (!keys.some((k) => k === profileKey(origin) || k === 'settings')) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshState(), 150);
  });

  // SPA 路由变化：重评估每条规则的生效范围（微信读书翻页等场景）；向导期间屏蔽
  setInterval(() => {
    if (wizardActive) return;
    if (location.href !== lastHref && profile?.switchState === 'disguised') {
      lastHref = location.href;
      void applyAll();
    } else {
      lastHref = location.href;
    }
  }, 1000);

  // popup 触发的入口消息
  browser.runtime.onMessage.addListener((msg: { t?: string; mode?: 'newSite' | 'addElement' }) => {
    if (msg?.t === 'openWizard') void openWizard(msg.mode ?? 'addElement');
    if (msg?.t === 'openEditor') openEditorPanel();
  });

  void refreshState();
}
