<template>
  <main class="page">
    <h1>PageMask · 页面清爽模式</h1>
    <p class="sub">管理你设置过的网站：开关清爽模式、标签页标题和图标、收起项的状态，以及导出 / 导入。</p>

    <!-- 全局设置 -->
    <section class="card">
      <h2>标签页显示</h2>
      <p class="hint">让标签栏更简洁，减少分心。</p>
      <div class="row">
        <label for="default-title">默认标签页标题</label>
        <input
          id="default-title"
          v-model="drafts[DEFAULT_KEY]"
          :placeholder="languageDefaultTitle"
          aria-describedby="default-title-hint"
          @focus="focusedKey = DEFAULT_KEY"
          @blur="onBlur(DEFAULT_KEY)"
          @input="onInput(DEFAULT_KEY)"
          @change="saveDraft(DEFAULT_KEY)"
        />
      </div>
      <div class="row quick" role="group" aria-labelledby="default-title-quick">
        <span id="default-title-quick" class="hint">快捷填入</span>
        <button v-for="q in QUICK_TITLES" :key="q.label" type="button" class="chip" @click="pickTitle(DEFAULT_KEY, q)">
          {{ quickTitleValue(q, uiLanguage) }}
        </button>
      </div>
      <p id="default-title-hint" class="hint">
        网站没有单独设置标题时使用；留空则用「{{ languageDefaultTitle }}」（跟随浏览器语言）。标签页标题不会留成空白：空白时 Chrome 会改为显示网址。
      </p>
    </section>

    <!-- 站点列表 -->
    <section v-if="loaded && profiles.length === 0" class="card empty">
      还没有设置任何网站。打开想变清爽的网站，点浏览器工具栏上的 PageMask 图标即可开始。
    </section>
    <!-- 有配置、没授权的站点不少于 2 个（典型：刚导入）：一次请求全部授权 -->
    <section v-if="pendingOrigins.length >= 2" class="card pending-all" data-testid="pm-mgmt-pending-all">
      <span>{{ pendingOrigins.length }} 个网站待授权，授权前这些网站的设置不会生效。</span>
      <button type="button" class="primary" data-testid="pm-mgmt-authorize-all" @click="authorize(pendingOrigins)">
        一次授权全部
      </button>
    </section>
    <p v-if="authError" class="hint error" role="alert">{{ authError }}</p>

    <section v-for="p in profiles" :key="p.origin" class="card site" :data-origin="p.origin">
      <div v-if="pendingOrigins.includes(p.origin)" class="row pending" data-testid="pm-mgmt-pending">
        <span class="badge">待授权</span>
        <span class="hint">浏览器没有这个网站的访问权限，设置都还在，授权后立即生效。</span>
        <button type="button" class="primary" data-testid="pm-mgmt-authorize" @click="authorize([p.origin])">
          授权并启用
        </button>
      </div>
      <div class="site-head">
        <h2 class="host">{{ hostOf(p.origin) }}</h2>
        <div class="switch-row">
          <label :for="idOf('switch', p.origin)">清爽模式</label>
          <input
            :id="idOf('switch', p.origin)"
            type="checkbox"
            switch
            role="switch"
            data-testid="pm-mgmt-switch"
            :checked="p.switchState === 'disguised'"
            :disabled="!!toggling[p.origin]"
            @change="(e) => toggleSite(p, e)"
          />
        </div>
      </div>
      <p class="state">
        已收起 {{ p.hideRules.length }} 项<template v-if="staleRules(p).length > 0">
          ·
          <span class="stale"><span aria-hidden="true">● </span>{{ staleRules(p).length }} 项可能失效</span>
        </template>
      </p>
      <!-- 失效清单直接写出来（title 提示键盘和触屏都看不到，审查 N39） -->
      <ul v-if="staleRules(p).length > 0" class="stale-list" data-testid="pm-mgmt-stale-list">
        <li v-for="r in staleRules(p)" :key="r.id">「{{ r.elementName }}」最近没找到，可能网站改版了，可以打开这个网站重新选一次</li>
      </ul>
      <p v-if="toggleError[p.origin]" class="hint error" role="alert">{{ toggleError[p.origin] }}</p>

      <div class="site-body">
        <div class="row">
          <label :for="idOf('title', p.origin)">标签页标题</label>
          <input
            :id="idOf('title', p.origin)"
            v-model="drafts[p.origin]"
            data-testid="pm-mgmt-title"
            :placeholder="(drafts[DEFAULT_KEY] ?? '').trim() || languageDefaultTitle"
            @focus="focusedKey = p.origin"
            @blur="onBlur(p.origin)"
            @input="onInput(p.origin)"
            @change="saveDraft(p.origin)"
          />
        </div>
        <div class="row quick" role="group" :aria-labelledby="idOf('quick', p.origin)">
          <span :id="idOf('quick', p.origin)" class="hint">快捷填入</span>
          <button v-for="q in QUICK_TITLES" :key="q.label" type="button" class="chip" @click="pickTitle(p.origin, q)">
            {{ quickTitleValue(q, uiLanguage) }}
          </button>
        </div>
        <div class="row" role="group" :aria-labelledby="idOf('icon', p.origin)">
          <span :id="idOf('icon', p.origin)" class="label">标签页图标</span>
          <img v-if="p.faviconDataUrl" :src="p.faviconDataUrl" class="favicon" alt="当前标签页图标" data-testid="pm-mgmt-favicon" />
          <span v-else class="hint">未设置：标签页上不显示图标</span>
          <label class="button file-button" :class="{ busy: !!iconBusy[p.origin] }">
            {{ iconBusy[p.origin] ? '正在处理…' : p.faviconDataUrl ? '换一张图标' : '上传图标' }}
            <input
              type="file"
              data-testid="pm-mgmt-icon-input"
              :accept="ICON_SOURCE_TYPES.join(',')"
              :aria-describedby="idOf('icon-hint', p.origin)"
              :disabled="!!iconBusy[p.origin]"
              @change="(e) => uploadFavicon(p, e)"
            />
          </label>
          <button v-if="p.faviconDataUrl" type="button" class="ghost danger" @click="clearFavicon(p)">清除图标</button>
        </div>
        <p :id="idOf('icon-hint', p.origin)" class="hint">PNG、JPG、GIF、WebP 或 ICO，不超过 5MB，会自动缩小成 32×32。</p>
        <p v-if="iconError[p.origin]" class="hint error" role="alert">{{ iconError[p.origin] }}</p>
        <div class="row actions">
          <button type="button" class="danger" @click="askReset(p)">一键清空</button>
          <span v-if="resetError[p.origin]" class="hint error" role="alert">{{ resetError[p.origin] }}</span>
        </div>
      </div>
    </section>

    <!-- 导出 / 导入 -->
    <section class="card">
      <h2>导出 / 导入</h2>
      <p class="hint">把全部网站的设置存成一个文件；换电脑或重装浏览器后导入，就能恢复。</p>
      <div class="row">
        <button type="button" class="primary" @click="doExport">导出配置</button>
      </div>
      <!-- 先选导入方式，再选文件（审查 N20） -->
      <fieldset class="import-mode">
        <legend>导入方式</legend>
        <div class="radio">
          <input id="import-merge" v-model="importMode" type="radio" name="import-mode" value="merge" aria-describedby="import-merge-hint" />
          <label for="import-merge">合并（推荐）</label>
          <span id="import-merge-hint" class="hint">同一网站的收起项会合在一起，本机已有的设置不会丢</span>
        </div>
        <div class="radio">
          <input id="import-replace" v-model="importMode" type="radio" name="import-mode" value="replace" aria-describedby="import-replace-hint" />
          <label for="import-replace">整体替换</label>
          <span id="import-replace-hint" class="hint">先删掉本机现有的全部设置，再换成文件里的（导入前会再确认一次）</span>
        </div>
      </fieldset>
      <div class="row">
        <label class="button file-button">
          选择配置文件并导入
          <input type="file" accept="application/json" data-testid="pm-mgmt-import-input" @change="doImport" />
        </label>
      </div>
      <p class="hint" role="status" data-testid="pm-mgmt-import-result">{{ importResult }}</p>
    </section>

    <!-- 一键清空二次确认（原生模态对话框，安全按钮「取消」默认聚焦） -->
    <dialog ref="resetDialog" aria-labelledby="reset-title" data-testid="pm-mgmt-reset-dialog" @close="onResetClose">
      <template v-if="resetTarget">
        <h2 id="reset-title">清空 {{ hostOf(resetTarget.origin) }} 的全部设置？</h2>
        <ul>
          <li>{{ resetTarget.hideRules.length }} 个收起项会被删除</li>
          <li>这个网站的标签页标题、图标设置会被删除</li>
          <li>这个网站回到从未设置过的状态，页面上的悬浮按钮随之消失</li>
          <li>浏览器对这个网站的访问权限会被收回（下次设置需要重新允许）</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>取消</button>
        <button value="confirm" class="primary danger">确认清空</button>
      </form>
    </dialog>

    <!-- 整体替换导入确认：如实列出影响 -->
    <dialog ref="replaceDialog" aria-labelledby="replace-title" data-testid="pm-mgmt-replace-dialog" @close="onReplaceClose">
      <template v-if="replaceImpact">
        <h2 id="replace-title">用这个文件整体替换现有设置？</h2>
        <ul data-testid="pm-mgmt-replace-impact">
          <li>本机现有的 {{ replaceImpact.localSites }} 个网站、{{ replaceImpact.localRules }} 个收起项会全部被替换</li>
          <li v-if="replaceImpact.removedOrigins.length > 0">
            其中 {{ replaceImpact.removedOrigins.length }} 个网站在文件里没有，会被彻底移除（共
            {{ replaceImpact.removedRules }} 个收起项）：{{ replaceImpact.removedOrigins.map(hostOf).join('、') }}
          </li>
          <li>换成文件里的 {{ replaceImpact.incomingSites }} 个网站、{{ replaceImpact.incomingRules }} 个收起项</li>
          <li v-if="replaceImpact.replacesSettings">默认标签页标题也会换成文件里的</li>
          <li>这一步不能撤销；不放心的话，先取消并「导出配置」留一份</li>
        </ul>
      </template>
      <form method="dialog" class="dialog-actions">
        <button value="cancel" autofocus>取消</button>
        <button value="confirm" class="primary danger">确认替换</button>
      </form>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage, INVALID_EXPORT_FILE, type ImportResult } from '@/core/storage';
import { isSafeFaviconDataUrl } from '@/core/validate';
import { currentUiLanguage, defaultTitleFor, QUICK_TITLES, quickTitleValue, type QuickTitle } from '@/core/titles';
import type { HideRule, SiteProfile } from '@/core/types';
import { originPattern } from '@/core/registration';
import type { Ack, ReconcileResponse } from '@/core/messages';
import { syncDrafts } from '@/core/drafts';
import { importErrorText, previewReplace, type ReplaceImpact } from '@/core/import-preview';
import {
  checkIconSource,
  containRect,
  ICON_ERROR,
  ICON_SIZE,
  ICON_SOURCE_TYPES,
  MAX_ICON_DATA_URL_LENGTH,
} from '@/core/icon';

const storage = createPageMaskStorage(browser.storage.local);
/** 存储态：每次存储变化后整体刷新（开关、规则数、体检结果、图标、待授权） */
const profiles = ref<SiteProfile[]>([]);
const loaded = ref(false);
/** 浏览器界面语言：决定默认标题与快捷标题填入中文还是英文 */
const uiLanguage = currentUiLanguage();
const languageDefaultTitle = defaultTitleFor(uiLanguage);

/*
 * 编辑态（审查 N19）：标题输入框绑定 drafts，而不是直接绑存储对象。
 * 键 = 站点来源；全局默认标题用 DEFAULT_KEY。
 * 输入框聚焦中、或有还没保存的改动（dirty）时，存储变化不覆盖这个字段；其余部分照常刷新。
 */
const DEFAULT_KEY = '__default__';
const drafts = ref<Record<string, string>>({});
/** 最近一次从存储读到的值（失焦时用来同步聚焦期间别处写入的新值） */
let stored: Record<string, string> = {};
const dirty = new Set<string>();
const focusedKey = ref<string | null>(null);
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** 打字停顿多久后自动保存（打完字直接关掉标签页也不丢，审查 N28） */
const AUTOSAVE_MS = 800;

const importMode = ref<'merge' | 'replace'>('merge');
const importResult = ref('');
const resetDialog = ref<HTMLDialogElement | null>(null);
const replaceDialog = ref<HTMLDialogElement | null>(null);
const resetTarget = ref<SiteProfile | null>(null);
const replaceImpact = ref<ReplaceImpact | null>(null);
/** 等待「确认替换」的导入文件内容 */
let pendingBundle: unknown = null;
const iconError = ref<Record<string, string>>({});
const iconBusy = ref<Record<string, boolean>>({});
const resetError = ref<Record<string, string>>({});
const toggleError = ref<Record<string, string>>({});
const toggling = ref<Record<string, boolean>>({});
/** 有配置、没授权的站点（待授权） */
const pendingOrigins = ref<string[]>([]);
const authError = ref('');

onMounted(async () => {
  await reload();
  browser.storage.onChanged.addListener((_, area) => {
    if (area === 'local') void reload();
  });
  // 用户可能在扩展详情里收回或授予了站点访问权限
  browser.permissions.onAdded.addListener(() => void reload());
  browser.permissions.onRemoved.addListener(() => void reload());
});

/** 正在编辑的字段：聚焦中或有未保存改动 */
const isEditing = (key: string) => focusedKey.value === key || dirty.has(key);

async function reload() {
  const [list, settings] = await Promise.all([storage.listProfiles(), storage.getSettings()]);
  const granted = await Promise.all(
    list.map((p) => browser.permissions.contains({ origins: [originPattern(p.origin)] }).catch(() => false)),
  );
  stored = { [DEFAULT_KEY]: settings.defaultTitle ?? '' };
  for (const p of list) stored[p.origin] = p.disguisedTitle ?? '';
  drafts.value = syncDrafts(drafts.value, stored, isEditing);
  profiles.value = list;
  pendingOrigins.value = list.filter((_, i) => !granted[i]).map((p) => p.origin);
  loaded.value = true;
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
  if (focusedKey.value === key) focusedKey.value = null;
  // 没有未保存改动：同步聚焦期间别处写入的新值
  if (!dirty.has(key) && key in stored) drafts.value[key] = stored[key]!;
}

/** 保存一个标题草稿；保存期间又有新输入时保持 dirty，等下一次保存 */
async function saveDraft(key: string) {
  clearTimeout(saveTimers.get(key));
  saveTimers.delete(key);
  const value = drafts.value[key] ?? '';
  try {
    if (key === DEFAULT_KEY) {
      const t = value.trim();
      await storage.putSettings({ defaultTitle: t || null }); // 留空 = 跟随界面语言默认
    } else {
      const title = value.trim() ? value : null;
      await storage.updateProfile(key, (d) => {
        d.disguisedTitle = title;
      });
    }
    if ((drafts.value[key] ?? '') === value) dirty.delete(key);
  } catch {
    // 写入失败：保持 dirty，输入框保留用户输入，下一次输入或失焦时再试
  }
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
  authError.value = '';
  void (async () => {
    const ok = await request.catch(() => false);
    if (!ok) {
      authError.value = '没有拿到访问权限，网站设置仍然保留；需要时再点一次并选择「允许」';
      return;
    }
    await reconcileNow();
    await reload();
  })();
}

function hostOf(origin: string): string {
  return new URL(origin).hostname.replace(/^www\./, '');
}

function staleRules(p: SiteProfile): HideRule[] {
  return p.hideRules.filter((r) => r.lastHealth === 'stale');
}

/** 每个站点控件的 id（label for / aria 关联用）；origin 里的 :/. 换成 - */
function idOf(kind: string, origin: string): string {
  return `site-${kind}-${origin.replace(/[^a-z0-9]/gi, '-')}`;
}

/*
 * 快捷标题：按钮上显示、点击填入的都是按浏览器界面语言取的值（中文浏览器「阅读」，
 * 英文浏览器 "Reading"）——标签页标题给浏览器标签栏看，按钮上写什么就填什么。填入后立即保存。
 */
async function pickTitle(key: string, q: QuickTitle) {
  drafts.value[key] = quickTitleValue(q, uiLanguage);
  dirty.add(key);
  await saveDraft(key);
}

// 以下写入均为原子更新：基于最新存储值只改本次操作涉及的字段

async function toggleSite(p: SiteProfile, e: Event) {
  const input = e.target as HTMLInputElement;
  const target = input.checked ? 'disguised' : 'original';
  toggling.value[p.origin] = true;
  toggleError.value[p.origin] = '';
  try {
    await storage.updateProfile(p.origin, (d) => {
      d.switchState = target;
    });
  } catch {
    input.checked = p.switchState === 'disguised';
    toggleError.value[p.origin] = '没能切换清爽模式，请稍后再试一次';
  } finally {
    toggling.value[p.origin] = false;
  }
}

async function clearFavicon(p: SiteProfile) {
  iconError.value[p.origin] = '';
  await storage.updateProfile(p.origin, (d) => {
    d.faviconDataUrl = null;
  });
}

/**
 * 上传图标：限制原图大小，用 canvas 缩小成 32×32 PNG（data URL 远小于 20KB），再按 core/validate 校验后保存。
 * 原图不保存，也不发起任何网络请求。
 */
async function uploadFavicon(p: SiteProfile, e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空，之后再选同一个文件也会触发 change
  if (!file) return;
  iconError.value[p.origin] = '';
  const bad = checkIconSource(file);
  if (bad) {
    iconError.value[p.origin] = bad;
    return;
  }
  iconBusy.value[p.origin] = true;
  try {
    const dataUrl = await compressIcon(file);
    if (typeof dataUrl !== 'string') {
      iconError.value[p.origin] = dataUrl.error;
      return;
    }
    await storage.updateProfile(p.origin, (d) => {
      d.faviconDataUrl = dataUrl;
    });
  } catch {
    iconError.value[p.origin] = ICON_ERROR.encode;
  } finally {
    iconBusy.value[p.origin] = false;
  }
}

async function compressIcon(file: Blob): Promise<string | { error: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: ICON_ERROR.decode };
  }
  try {
    const rect = containRect(bitmap.width, bitmap.height, ICON_SIZE);
    if (!rect) return { error: ICON_ERROR.decode };
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: ICON_ERROR.encode };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, rect.dx, rect.dy, rect.dw, rect.dh);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > MAX_ICON_DATA_URL_LENGTH || !isSafeFaviconDataUrl(dataUrl)) return { error: ICON_ERROR.encode };
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

function askReset(p: SiteProfile) {
  resetTarget.value = p;
  resetDialog.value?.showModal();
}

function onResetClose() {
  const dialog = resetDialog.value;
  const confirmed = dialog?.returnValue === 'confirm';
  if (dialog) dialog.returnValue = ''; // Esc 等关闭方式不设返回值，重置以免沿用上一次
  const p = resetTarget.value;
  if (confirmed && p) void doReset(p);
}

async function doReset(p: SiteProfile) {
  resetError.value[p.origin] = '';
  const res: Ack | undefined = await browser.runtime.sendMessage({ t: 'resetSite', origin: p.origin }).catch(() => undefined);
  if (!res?.ok) resetError.value[p.origin] = '没能清空，请稍后再试一次';
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

async function doImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importResult.value = '';
  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    importResult.value = importErrorText(new Error(INVALID_EXPORT_FILE));
    return;
  }
  if (importMode.value === 'replace') {
    // 文件无效时 previewReplace 返回 null，直接交给 importBundle 报出具体原因（不会改动数据）
    const impact = previewReplace(await storage.listProfiles(), bundle);
    if (impact) {
      pendingBundle = bundle;
      replaceImpact.value = impact;
      replaceDialog.value?.showModal();
      return;
    }
  }
  await runImport(bundle, importMode.value);
}

function onReplaceClose() {
  const dialog = replaceDialog.value;
  const confirmed = dialog?.returnValue === 'confirm';
  if (dialog) dialog.returnValue = '';
  const bundle = pendingBundle;
  pendingBundle = null;
  if (confirmed) void runImport(bundle, 'replace');
  else importResult.value = '已取消导入，本机设置没有改动';
}

async function runImport(bundle: unknown, mode: 'merge' | 'replace') {
  try {
    const res = await storage.importBundle(bundle, mode);
    importResult.value = describeImport(res);
    // 导入可能新增或移除了站点：立即对账（新站点在授权前显示「待授权」）
    await reconcileNow();
  } catch (err) {
    importResult.value = importErrorText(err);
  }
  await reload();
}

/** 如实报告导入结果：新增 / 更新 / 移除 / 跳过 */
function describeImport(res: ImportResult): string {
  const parts = [`新增 ${res.added} 个网站`, `更新 ${res.updated} 个网站`];
  if (res.removed) parts.push(`移除 ${res.removed} 个本机网站`);
  if (res.skipped) parts.push(`跳过 ${res.skipped} 个无效网站`);
  if (res.skippedRules) parts.push(`忽略 ${res.skippedRules} 个无效收起项`);
  return `导入完成：${parts.join('，')}（${res.mode === 'merge' ? '合并' : '整体替换'}）`;
}
</script>

<style>
/* 共享样式（字体、颜色、按钮、输入框、开关、徽标、对话框）来自 @/styles/base.css；这里只写管理页布局 */
body {
  background: var(--pm-bg-subtle);
}
.page {
  max-width: 720px;
  margin: var(--pm-space-6) auto;
  padding: 0 var(--pm-space-4) 60px;
}
h1 {
  font-size: var(--pm-font-size-heading);
  margin: 0;
}
.card h2 {
  font-size: var(--pm-font-size-title);
  margin: 0 0 var(--pm-space-2);
}
.sub {
  color: var(--pm-fg-muted);
  margin: var(--pm-space-1) 0 18px;
}
.card {
  margin-bottom: 14px;
}
.card.empty {
  color: var(--pm-fg-muted);
}
.site-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
}
.site-head .host {
  margin: 0;
  overflow-wrap: anywhere;
}
.switch-row {
  display: flex;
  align-items: center;
  gap: var(--pm-space-2);
  flex: none;
}
.switch-row label {
  cursor: pointer;
}
.state {
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
  margin: var(--pm-space-1) 0 var(--pm-space-2);
}
.stale {
  color: var(--pm-danger);
}
.stale-list {
  margin: 0 0 var(--pm-space-2);
  padding-left: 18px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: var(--pm-space-2) 0;
  flex-wrap: wrap;
}
.row > label,
.row > .label {
  color: var(--pm-fg);
  min-width: 96px;
}
.row input:not([type]) {
  flex: 1;
  min-width: 180px;
}
.row.quick {
  gap: 6px;
  margin-top: -2px;
}
.actions {
  margin-top: 10px;
}
.favicon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}
.file-button.busy {
  cursor: progress;
}
.pending-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
}
.row.pending {
  margin: 0 0 10px;
}
.import-mode {
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-control);
  margin: var(--pm-space-3) 0 var(--pm-space-2);
  padding: var(--pm-space-2) var(--pm-space-3);
}
.import-mode legend {
  padding: 0 var(--pm-space-1);
}
.radio {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: var(--pm-space-1) 0;
}
.radio input {
  margin: 0;
  align-self: center;
}
.radio .hint {
  margin: 0;
  flex-basis: 100%;
  padding-left: 22px;
}
</style>
