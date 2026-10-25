<template>
  <div class="page">
    <h1>PageMask 管理页</h1>
    <p class="sub">所有已配置站点在此总览。改伪装标题/图标、看体检状态、一键清空、导出导入。</p>

    <!-- 全局设置 -->
    <section class="card">
      <h2>全局默认</h2>
      <div class="row">
        <label>默认伪装标题</label>
        <input v-model="defaultTitle" placeholder="新建标签页" @change="saveSettings" />
        <span class="hint">站点未单独设置时使用。不能为空白——空白会让 Chrome 显示网址反而泄露。</span>
      </div>
    </section>

    <!-- 站点列表 -->
    <section v-if="profiles.length === 0" class="card empty">
      还没有配置任何站点。在目标网站点击浏览器工具栏的 PageMask 图标即可开始。
    </section>
    <section v-for="p in profiles" :key="p.origin" class="card site">
      <div class="site-head">
        <span class="host">{{ hostOf(p.origin) }}</span>
        <span class="state" :class="p.switchState">
          {{ p.switchState === 'disguised' ? '伪装中' : '原样' }} · {{ p.hideRules.length }} 条规则
          <template v-if="staleOf(p) > 0">· <span class="stale" :title="staleList(p)">● {{ staleOf(p) }} 条可能失效</span></template>
        </span>
      </div>
      <div class="site-body">
        <div class="row">
          <label>伪装标题</label>
          <input v-model="p.disguisedTitle" :placeholder="defaultTitle" @change="saveProfile(p)" />
        </div>
        <div class="row">
          <label>伪装图标</label>
          <img v-if="p.faviconDataUrl" :src="p.faviconDataUrl" class="favicon" alt="当前伪装图标" />
          <span v-else class="hint">未设置（中性默认）</span>
          <input type="file" accept="image/*" @change="(e) => uploadFavicon(p, e)" />
          <button v-if="p.faviconDataUrl" class="ghost danger" @click="p.faviconDataUrl = null; saveProfile(p)">清除图标</button>
        </div>
        <div class="row actions">
          <button class="ghost" @click="toggleSite(p)">{{ p.switchState === 'disguised' ? '切回原样' : '进入伪装' }}</button>
          <button class="ghost danger" @click="askReset(p)">一键清空</button>
        </div>
      </div>
    </section>

    <!-- 导出 / 导入 -->
    <section class="card">
      <h2>导出 / 导入</h2>
      <p class="hint">导出全部站点配置为一个 JSON 文件，换电脑/重装浏览器时导入。导入默认合并（同源规则并集），也可整体替换。</p>
      <div class="row">
        <button class="primary" @click="doExport">导出配置</button>
        <input type="file" accept="application/json" ref="importInput" style="display: none" @change="doImport" />
        <button class="ghost" @click="($refs.importInput as HTMLInputElement).click()">导入配置</button>
        <label class="inline"><input type="radio" value="merge" v-model="importMode" /> 合并（默认）</label>
        <label class="inline"><input type="radio" value="replace" v-model="importMode" /> 整体替换</label>
      </div>
      <p v-if="importResult" class="hint">{{ importResult }}</p>
    </section>

    <!-- 一键清空二次确认 -->
    <div v-if="resetTarget" class="mask" @click.self="resetTarget = null">
      <div class="dialog">
        <h3>清空 {{ hostOf(resetTarget.origin) }} 的全部配置？</h3>
        <ul>
          <li>{{ resetTarget.hideRules.length }} 条隐藏规则将被删除</li>
          <li>伪装标题、图标设置将被删除</li>
          <li>该站点恢复为"从未配置过"的状态，悬浮按钮随之消失</li>
          <li>浏览器对该站点的授权会被收回（下次配置需重新允许）</li>
        </ul>
        <div class="row right">
          <button class="ghost" @click="resetTarget = null">取消</button>
          <button class="primary danger" @click="doReset">确认清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { createPageMaskStorage } from '@/core/storage';
import type { ExportBundle, SiteProfile } from '@/core/types';

const storage = createPageMaskStorage(browser.storage.local);
const profiles = ref<SiteProfile[]>([]);
const defaultTitle = ref('新建标签页');
const resetTarget = ref<SiteProfile | null>(null);
const importMode = ref<'merge' | 'replace'>('merge');
const importResult = ref('');
const importInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  defaultTitle.value = (await storage.getSettings()).defaultTitle;
  await reload();
  browser.storage.onChanged.addListener((_, area) => {
    if (area === 'local') void reload();
  });
});

async function reload() {
  profiles.value = await storage.listProfiles();
}

function hostOf(origin: string): string {
  return new URL(origin).hostname.replace(/^www\./, '');
}

function staleOf(p: SiteProfile): number {
  return p.hideRules.filter((r) => r.lastHealth === 'stale').length;
}

function staleList(p: SiteProfile): string {
  return p.hideRules
    .filter((r) => r.lastHealth === 'stale')
    .map((r) => `「${r.elementName}」最近没找到目标，可能网站改版了`)
    .join('\n');
}

async function saveSettings() {
  const t = defaultTitle.value.trim();
  await storage.putSettings({ defaultTitle: t || '新建标签页' });
}

async function saveProfile(p: SiteProfile) {
  if (p.disguisedTitle !== null && !p.disguisedTitle.trim()) p.disguisedTitle = null;
  await storage.putProfile(p);
}

async function toggleSite(p: SiteProfile) {
  p.switchState = p.switchState === 'disguised' ? 'original' : 'disguised';
  await storage.putProfile(p);
}

async function uploadFavicon(p: SiteProfile, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  p.faviconDataUrl = dataUrl;
  await storage.putProfile(p);
}

function askReset(p: SiteProfile) {
  resetTarget.value = p;
}

async function doReset() {
  const p = resetTarget.value;
  if (!p) return;
  resetTarget.value = null;
  await browser.runtime.sendMessage({ t: 'resetSite', origin: p.origin });
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
  URL.revokeObjectURL(url);
}

async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text()) as ExportBundle;
    const res = await storage.importBundle(bundle, importMode.value);
    importResult.value = `导入完成：新增 ${res.added} 个站点，更新 ${res.updated} 个站点（${importMode.value === 'merge' ? '合并' : '整体替换'}）`;
  } catch (err) {
    importResult.value = `导入失败：${err instanceof Error ? err.message : String(err)}`;
  }
  (e.target as HTMLInputElement).value = '';
  await reload();
}
</script>

<style>
body {
  margin: 0;
  background: #f6f7f9;
  font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
  color: #222;
}
.page {
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px 60px;
}
h1 {
  font-size: 20px;
}
h2 {
  font-size: 15px;
  margin: 0 0 10px;
}
h3 {
  font-size: 15px;
  margin: 0 0 8px;
}
.sub {
  color: #777;
  font-size: 13px;
  margin: 4px 0 18px;
}
.card {
  background: #fff;
  border: 1px solid #e8eaee;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.card.empty {
  color: #888;
  font-size: 14px;
}
.site-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.host {
  font-size: 15px;
  font-weight: 600;
}
.state {
  font-size: 12px;
  color: #888;
}
.state.disguised {
  color: #3575e0;
}
.stale {
  color: #e5484d;
  cursor: help;
  white-space: pre-line;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
  flex-wrap: wrap;
}
.row.right {
  justify-content: flex-end;
}
.row label {
  font-size: 13px;
  color: #555;
  min-width: 70px;
}
.row input[type='text'],
.row input:not([type]) {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  flex: 1;
  min-width: 180px;
}
.hint {
  font-size: 12px;
  color: #999;
}
.inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #555;
}
.actions {
  margin-top: 10px;
}
button {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  background: #fafafa;
  color: #333;
}
button.primary {
  background: #3575e0;
  border-color: #3575e0;
  color: #fff;
}
button.primary.danger {
  background: #d33;
  border-color: #d33;
}
button.ghost {
  background: transparent;
}
button.danger {
  color: #c33;
  border-color: #e5b4b4;
}
.favicon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  vertical-align: middle;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.dialog {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  width: 380px;
  max-width: 90vw;
}
.dialog ul {
  padding-left: 18px;
  font-size: 13px;
  color: #555;
  margin: 8px 0 14px;
}
.dialog li {
  margin: 4px 0;
}
</style>
