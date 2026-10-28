/**
 * 管理页的模块级状态与操作（三个视图共用，避免层层 props，也避免各写一份存储读取）。
 *
 * - 存储态：profiles / 全局设置 / 待授权站点，storage 与 permissions 变化后整体刷新
 * - 编辑态：标题输入框绑定 drafts，聚焦中或有未保存改动（dirty）时不覆盖，其余字段照常刷新
 * - 操作：标题自动保存、开关、授权、一键清空、导出 / 导入
 *
 * 用工厂而不是裸单例，便于单测里各建一份互不干扰的状态；页面用文件末尾的 managementStore。
 */
import { reactive } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage, INVALID_EXPORT_FILE, type ImportResult } from '@/core/storage';
import { currentUiLanguage, defaultTitleFor, quickTitleValue, type QuickTitle } from '@/core/titles';
import type { HideRule, SiteProfile } from '@/core/types';
import { originPattern } from '@/core/registration';
import type { Ack, EnableSiteResponse, OpenEditorMsg, ReconcileResponse } from '@/core/messages';
import { syncDrafts } from '@/core/drafts';
import { importErrorText, previewReplace, type ReplaceImpact } from '@/core/import-preview';

/** 全局默认标题在 drafts 里的键；站点用 origin 作键 */
export const DEFAULT_KEY = '__default__';
/** 打字停顿多久后自动保存（打完字直接关掉标签页也不丢，审查 N28） */
export const AUTOSAVE_MS = 800;

export interface ManagementState {
  profiles: SiteProfile[];
  loaded: boolean;
  /** 存储里的全局默认标题（null = 跟随界面语言默认） */
  defaultTitle: string | null;
  /** 输入框草稿：键 = origin，全局默认标题用 DEFAULT_KEY */
  drafts: Record<string, string>;
  /** 当前聚焦的字段 */
  focusedKey: string | null;
  /** 有配置、没授权的站点（待授权） */
  pendingOrigins: string[];
  authError: string;
  /** 「添加这个网站」正在请求权限 / 写入配置 */
  adding: boolean;
  addError: string;
  /** 正在切换开关的站点 */
  toggling: Record<string, boolean>;
  toggleError: Record<string, string>;
  /** 收起项删除 / 撤销写入失败（键 = origin） */
  ruleError: Record<string, string>;
  resetError: Record<string, string>;
  /** 等确认清空的站点（视图据此打开确认框） */
  resetTarget: SiteProfile | null;
  importMode: 'merge' | 'replace';
  importResult: string;
  /** 整体替换导入的影响预览（视图据此打开确认框） */
  replaceImpact: ReplaceImpact | null;
}

export function createManagementStore() {
  const storage = createPageMaskStorage(browser.storage.local);
  /** 浏览器界面语言：决定默认标题与快捷标题填入中文还是英文 */
  const uiLanguage = currentUiLanguage();
  const languageDefaultTitle = defaultTitleFor(uiLanguage);

  const state = reactive<ManagementState>({
    profiles: [],
    loaded: false,
    defaultTitle: null,
    drafts: {},
    focusedKey: null,
    pendingOrigins: [],
    authError: '',
    adding: false,
    addError: '',
    toggling: {},
    toggleError: {},
    ruleError: {},
    resetError: {},
    resetTarget: null,
    importMode: 'merge',
    importResult: '',
    replaceImpact: null,
  });

  /** 最近一次从存储读到的值（失焦时用来同步聚焦期间别处写入的新值） */
  let stored: Record<string, string> = {};
  const dirty = new Set<string>();
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** 等待「确认替换」的导入文件内容 */
  let pendingBundle: unknown = null;
  let started = false;

  /** 正在编辑的字段：聚焦中或有未保存改动 */
  const isEditing = (key: string) => state.focusedKey === key || dirty.has(key);

  async function reload() {
    const [list, settings] = await Promise.all([storage.listProfiles(), storage.getSettings()]);
    const granted = await Promise.all(
      list.map((p) => browser.permissions.contains({ origins: [originPattern(p.origin)] }).catch(() => false)),
    );
    stored = { [DEFAULT_KEY]: settings.defaultTitle ?? '' };
    for (const p of list) stored[p.origin] = p.disguisedTitle ?? '';
    state.drafts = syncDrafts(state.drafts, stored, isEditing);
    state.profiles = list;
    state.defaultTitle = settings.defaultTitle;
    state.pendingOrigins = list.filter((_, i) => !granted[i]).map((p) => p.origin);
    state.loaded = true;
  }

  /** 挂载时调用一次：首次读取 + 订阅存储 / 权限变化（重复调用无副作用） */
  async function init() {
    if (started) return;
    started = true;
    await reload();
    browser.storage.onChanged.addListener((_, area) => {
      if (area === 'local') void reload();
    });
    // 用户可能在扩展详情里收回或授予了站点访问权限
    browser.permissions.onAdded.addListener(() => void reload());
    browser.permissions.onRemoved.addListener(() => void reload());
  }

  function focus(key: string) {
    state.focusedKey = key;
  }

  function onInput(key: string) {
    dirty.add(key);
    clearTimeout(saveTimers.get(key));
    saveTimers.set(
      key,
      setTimeout(() => void saveDraft(key), AUTOSAVE_MS),
    );
  }

  function onBlur(key: string) {
    if (state.focusedKey === key) state.focusedKey = null;
    // 没有未保存改动：同步聚焦期间别处写入的新值
    if (!dirty.has(key) && key in stored) state.drafts[key] = stored[key]!;
  }

  /** 保存一个标题草稿；保存期间又有新输入时保持 dirty，等下一次保存 */
  async function saveDraft(key: string) {
    clearTimeout(saveTimers.get(key));
    saveTimers.delete(key);
    const value = state.drafts[key] ?? '';
    try {
      if (key === DEFAULT_KEY) {
        const t = value.trim();
        await storage.putSettings({ defaultTitle: t || null }); // 留空 = 跟随界面语言默认
        state.defaultTitle = t || null;
      } else {
        const title = value.trim() ? value : null;
        await storage.updateProfile(key, (d) => {
          d.disguisedTitle = title;
        });
      }
      if ((state.drafts[key] ?? '') === value) dirty.delete(key);
    } catch {
      // 写入失败：保持 dirty，输入框保留用户输入，下一次输入或失焦时再试
    }
  }

  /*
   * 快捷标题：按钮上显示、点击填入的都是按浏览器界面语言取的值（中文浏览器「阅读」，
   * 英文浏览器 "Reading"）——标签页标题给浏览器标签栏看，按钮上写什么就填什么。填入后立即保存。
   */
  async function pickTitle(key: string, q: QuickTitle) {
    state.drafts[key] = quickTitleValue(q, uiLanguage);
    dirty.add(key);
    await saveDraft(key);
  }

  /** 请后台立即对账（导入、授权之后），让站点配置、授权、注册三者一致 */
  async function reconcileNow(): Promise<void> {
    const res: ReconcileResponse | undefined = await browser.runtime.sendMessage({ t: 'reconcile' }).catch(() => undefined);
    if (!res?.ok) console.warn('[PageMask] 对账失败', res?.error);
  }

  /**
   * 授权并启用（单个站点或一次授权全部）：一次权限请求带上所有站点。
   * 权限请求必须处在点击手势的同步上下文中，所以它是本函数的第一条语句，之前不能有 await。
   */
  function authorize(origins: string[]) {
    const request = browser.permissions.request({ origins: origins.map(originPattern) });
    state.authError = '';
    void (async () => {
      const ok = await request.catch(() => false);
      if (!ok) {
        state.authError = '没有拿到访问权限，网站设置仍然保留；需要时再点一次并选择「允许」';
        return;
      }
      await reconcileNow();
      await reload();
    })();
  }

  /**
   * 添加一个还没配置的网站（#42：只想改标签页标题、不收起任何内容的入口）。
   *
   * 写下的是一份合法的「0 条规则」站点配置：清爽态、标题取用户填的值（留空 = 全局默认），
   * 因此页面上的元素一个都不会被收起。这也是新站点唯一会落库的路径——用户在「待添加」页
   * 点了「添加这个网站」，就是那次保存。
   *
   * 权限请求必须处在点击手势的同步上下文中：它是本函数的第一件事，之前不能有 await。
   * 用户在权限框上拒绝时什么都不写，停在「待添加」状态。
   */
  function addSite(origin: string, title: string): Promise<'added' | 'denied' | 'failed'> {
    let request: Promise<boolean>;
    try {
      request = browser.permissions.request({ origins: [originPattern(origin)] });
    } catch {
      request = Promise.resolve(false);
    }
    state.adding = true;
    state.addError = '';
    return (async () => {
      try {
        const granted = await request.catch(() => false);
        if (!granted) {
          state.addError = '需要允许访问这个网站，才能添加它。可以再点一次「添加这个网站」并选择「允许」';
          return 'denied';
        }
        await storage.updateProfile(
          origin,
          (d) => {
            d.switchState = 'disguised';
            d.disguisedTitle = title.trim() ? title : null;
            d.hideRules = [];
          },
          { create: true },
        );
        await reconcileNow();
        await reload();
        // 已经打开着的页面要立即拿到悬浮按钮与标签页标题，不必刷新
        await injectOpenTabs(origin);
        return 'added';
      } catch {
        state.addError = '没能添加这个网站，请稍后再试一次';
        return 'failed';
      } finally {
        state.adding = false;
      }
    })();
  }

  /** 给某个站点已打开的标签页注入内容脚本（与 popup 的启用流程走同一条消息） */
  async function injectOpenTabs(origin: string): Promise<void> {
    const tabs = await browser.tabs.query({}).catch(() => []);
    for (const t of tabs) {
      if (t.id === undefined || !sameOrigin(t.url, origin)) continue;
      await browser.runtime.sendMessage({ t: 'enableSite', origin, tabId: t.id }).catch(() => undefined);
    }
  }

  // 写入均为原子更新：基于最新存储值只改本次操作涉及的字段

  async function toggleSite(p: SiteProfile, e: Event) {
    const input = e.target as HTMLInputElement;
    const target = input.checked ? 'disguised' : 'original';
    state.toggling[p.origin] = true;
    state.toggleError[p.origin] = '';
    try {
      await storage.updateProfile(p.origin, (d) => {
        d.switchState = target;
      });
    } catch {
      input.checked = p.switchState === 'disguised';
      state.toggleError[p.origin] = '没能切换清爽模式，请稍后再试一次';
    } finally {
      state.toggling[p.origin] = false;
    }
  }

  /**
   * 原子改写某个网站的收起项列表（删除与撤销共用）：写前重读最新值，只改 hideRules。
   * update 拿到的一定是存储里最新的列表，不用视图里的副本覆盖别处的改动。
   */
  async function updateRules(origin: string, update: (rules: HideRule[]) => HideRule[]): Promise<void> {
    state.ruleError[origin] = '';
    try {
      await storage.updateProfile(origin, (d) => {
        d.hideRules = update(d.hideRules);
      });
    } catch {
      state.ruleError[origin] = '没能保存这次改动，请稍后再试一次';
    }
  }

  /** 换 / 清除标签页图标：null = 回到默认的全透明图标（标签页上图标位留空） */
  async function setIcon(origin: string, dataUrl: string | null): Promise<void> {
    await storage.updateProfile(origin, (d) => {
      d.faviconDataUrl = dataUrl;
    });
  }

  /**
   * 「在页面上编辑」：找到该站已打开的标签页，让页面里的内容脚本打开编辑面板，并把那个标签页切到前台。
   * 换收起方式、重选元素都要页面上下文，只能这样跳过去。
   * - noTab：没有打开这个网站的页面（列表为空时也是它——未授权的站点读不到网址，会一并落到这里）
   * - failed：页面里的内容脚本喊不起来（页面在安装 / 授权前就打开了，或后台拒绝注入）
   */
  async function openPageEditor(origin: string): Promise<'opened' | 'noTab' | 'failed'> {
    // 按 origin 自己比对（不用 tabs.query 的 url 过滤：match pattern 对端口不友好）。
    // 没有这个站点权限的标签页读不到 url，自然会被排除，正好只挑出能注入的那些。
    const tabs = await browser.tabs.query({}).catch(() => []);
    const mine = tabs.filter((t) => t.id !== undefined && sameOrigin(t.url, origin));
    const tab = mine.find((t) => t.active) ?? mine[0];
    const tabId = tab?.id;
    if (tabId === undefined) return 'noTab';
    const open = () => browser.tabs.sendMessage(tabId, { t: 'openEditor' } satisfies OpenEditorMsg);
    try {
      await open();
    } catch {
      // 内容脚本可能还没注入（页面开着才授权、或扩展刚更新）：让后台对账注入一次再发
      const res: EnableSiteResponse | undefined = await browser.runtime
        .sendMessage({ t: 'enableSite', origin, tabId })
        .catch(() => undefined);
      if (!res?.ok) return 'failed';
      try {
        await open();
      } catch {
        return 'failed';
      }
    }
    await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
    if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    return 'opened';
  }

  /** 请求清空：只记下目标，确认框由视图打开 */
  function askReset(p: SiteProfile) {
    state.resetError[p.origin] = '';
    state.resetTarget = p;
  }

  /** 确认框关闭：confirmed 来自 <dialog> 的 returnValue */
  async function confirmReset(confirmed: boolean) {
    const p = state.resetTarget;
    state.resetTarget = null;
    if (!p || !confirmed) return;
    state.resetError[p.origin] = '';
    const res: Ack | undefined = await browser.runtime.sendMessage({ t: 'resetSite', origin: p.origin }).catch(() => undefined);
    if (!res?.ok) state.resetError[p.origin] = '没能清空，请稍后再试一次';
    await reload();
  }

  async function doExport() {
    const bundle = await storage.exportBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagemask-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /**
   * 读入用户选择的导出文件。
   * 返回 'confirm' 时视图要打开整体替换确认框；'auto' / 'failed' 不需要额外交互。
   */
  async function importFile(file: File): Promise<'auto' | 'confirm' | 'failed'> {
    state.importResult = '';
    let bundle: unknown;
    try {
      bundle = JSON.parse(await file.text());
    } catch {
      state.importResult = importErrorText(new Error(INVALID_EXPORT_FILE));
      return 'failed';
    }
    if (state.importMode === 'replace') {
      // 文件无效时 previewReplace 返回 null，直接交给 importBundle 报出具体原因（不会改动数据）
      const impact = previewReplace(await storage.listProfiles(), bundle);
      if (impact) {
        pendingBundle = bundle;
        state.replaceImpact = impact;
        return 'confirm';
      }
    }
    await runImport(bundle, state.importMode);
    return 'auto';
  }

  /** 整体替换确认框关闭：confirmed 来自 <dialog> 的 returnValue */
  async function confirmReplace(confirmed: boolean) {
    const bundle = pendingBundle;
    pendingBundle = null;
    state.replaceImpact = null;
    if (!confirmed) {
      state.importResult = '已取消导入，本机设置没有改动';
      return;
    }
    if (bundle === null) return;
    await runImport(bundle, 'replace');
  }

  async function runImport(bundle: unknown, mode: 'merge' | 'replace') {
    try {
      const res = await storage.importBundle(bundle, mode);
      state.importResult = describeImport(res);
      // 导入可能新增或移除了站点：立即对账（新站点在授权前显示「待授权」）
      await reconcileNow();
    } catch (err) {
      state.importResult = importErrorText(err);
    }
    await reload();
  }

  /** 如实报告导入结果：新增 / 更新 / 删掉 / 跳过 */
  function describeImport(res: ImportResult): string {
    const parts = [`新增 ${res.added} 个网站`, `更新 ${res.updated} 个网站`];
    if (res.removed) parts.push(`删掉 ${res.removed} 个本机网站`);
    if (res.skipped) parts.push(`跳过 ${res.skipped} 个无效网站`);
    if (res.skippedRules) parts.push(`忽略 ${res.skippedRules} 个无效收起项`);
    return `导入完成：${parts.join('，')}（${res.mode === 'merge' ? '合并' : '整体替换'}）`;
  }

  return {
    state,
    uiLanguage,
    languageDefaultTitle,
    init,
    reload,
    focus,
    onInput,
    onBlur,
    saveDraft,
    pickTitle,
    authorize,
    addSite,
    toggleSite,
    updateRules,
    setIcon,
    openPageEditor,
    askReset,
    confirmReset,
    doExport,
    importFile,
    confirmReplace,
  };
}

/** 标签页地址是否属于这个站点（读不到 url 的标签页一律算不是） */
function sameOrigin(url: string | undefined, origin: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export type ManagementStore = ReturnType<typeof createManagementStore>;

/** 管理页使用的单例 */
export const managementStore = createManagementStore();
