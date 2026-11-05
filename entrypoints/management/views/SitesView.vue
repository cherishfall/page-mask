<template>
  <section class="view" aria-labelledby="pm-sites-title">
    <!-- 标题行右侧给「插件设置」入口：插件设置页有「← 全部网站设置」返回，两页互达（#87 审查第 6 条） -->
    <div class="sites-head">
      <h2 id="pm-sites-title" class="view-title">{{ t.management.sitesTitle }}</h2>
      <a class="forward" href="settings.html" data-testid="pm-mgmt-settings-link">{{ t.popup.settings }}</a>
    </div>
    <p class="hint">{{ t.management.sitesHint }}</p>

    <p v-if="!store.state.loaded" class="hint">{{ t.common.loading }}</p>

    <p v-else-if="store.state.profiles.length === 0" class="card empty" data-testid="pm-mgmt-empty">
      {{ t.management.sitesEmpty }}
    </p>

    <template v-else>
      <!-- 有配置、没授权的站点不少于 2 个（典型：刚导入）：一次请求全部授权 -->
      <div v-if="store.state.pendingOrigins.length >= 2" class="card pending-all" data-testid="pm-mgmt-pending-all">
        <span>{{ t.management.pendingAll(store.state.pendingOrigins.length) }}</span>
        <button
          type="button"
          class="primary"
          data-testid="pm-mgmt-authorize-all"
          @click="store.authorize(store.state.pendingOrigins)"
        >
          {{ t.management.authorizeAll }}
        </button>
      </div>
      <p v-if="store.state.authError" class="hint error" role="alert">{{ store.state.authError }}</p>

      <ul class="site-list">
        <li v-for="p in store.state.profiles" :key="p.origin" class="site-row" :data-origin="p.origin">
          <div class="site-main">
            <!-- 链接与「⋯」是兄弟不是嵌套（#113：链接里套按钮不合法、读屏混乱）；
                 行尾 › 仍是「进详情」的提示，⋯ 在它右边管删除 -->
            <a class="site-link" :href="siteHash(siteHostOf(p.origin))" data-testid="pm-mgmt-site-link">
              <img v-if="p.faviconDataUrl" class="favicon" :src="p.faviconDataUrl" alt="" />
              <span v-else class="favicon initial" aria-hidden="true">{{ initialOf(p.origin) }}</span>
              <span class="site-text">
                <span class="site-host">{{ siteLabelOf(p.origin) }}</span>
                <span class="site-meta">
                  <span>{{ p.switchState === 'disguised' ? t.common.clean : t.common.original }}</span>
                  <span aria-hidden="true">·</span>
                  <!-- 0 条规则不写「已收起 0 项」 -->
                  <span>{{ p.hideRules.length > 0 ? t.common.hiddenCount(p.hideRules.length) : t.common.hiddenNone }}</span>
                  <template v-if="staleCount(p) > 0">
                    <span aria-hidden="true">·</span>
                    <span class="pm-mark pm-mark-danger" data-testid="pm-mgmt-row-stale">
                      <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.common.staleCount(staleCount(p)) }}
                    </span>
                  </template>
                </span>
              </span>
              <span class="chevron" aria-hidden="true">›</span>
            </a>
            <button
              type="button"
              class="site-more"
              :aria-label="t.management.moreActions(siteLabelOf(p.origin))"
              aria-haspopup="menu"
              :aria-expanded="menuOrigin === p.origin"
              :data-origin="p.origin"
              data-testid="pm-mgmt-site-more"
              @click="toggleMenu(p)"
            >
              <span aria-hidden="true">⋯</span>
            </button>
            <!-- 行尾菜单（#113）：popover 自带「点外面关闭」与 Esc，进 top layer 不被别的浮层压住。
                 只有删除一项（不加编辑按钮：整行点击已是编辑入口；不做多选），红字与胶囊菜单同一写法 -->
            <!-- ref 用函数形式：模板 ref 在 v-for 里会被收成数组（实测踩坑），拿不到元素 -->
            <div v-if="menuOrigin === p.origin" :ref="(el: Element | ComponentPublicInstance | null) => (menuEl = el as HTMLElement | null)" v-bind="POPOVER" class="site-menu" data-testid="pm-mgmt-site-menu" @toggle="onMenuToggle">
              <button type="button" class="site-menu-item danger" data-testid="pm-mgmt-row-delete" @click="onRowDelete">
                {{ deleteActionLabel }}
              </button>
            </div>
          </div>

          <!-- 删除失败在发起处提示（#113）：哪一行点的就显示在哪一行 -->
          <p v-if="store.state.resetError[p.origin]" class="hint error row-error" role="alert">
            {{ store.state.resetError[p.origin] }}
          </p>

          <div v-if="isPending(p)" class="site-pending" data-testid="pm-mgmt-pending">
            <span class="pm-mark pm-mark-warning">
              <span class="pm-mark-dot" aria-hidden="true"></span>{{ t.management.pendingBadge }}
            </span>
            <span class="hint">{{ t.management.pendingHint }}</span>
            <button type="button" data-testid="pm-mgmt-authorize" @click="store.authorize([p.origin])">
              {{ t.management.authorize }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import type { SiteProfile } from '@/core/types';
import { deleteSiteAction } from '@/core/site-delete';
import { t } from '@/ui/i18n';
import { siteHash } from '../router';
import { siteHostOf, siteLabelOf, staleRulesOf } from '../site';
import { managementStore as store } from '../store';

const isPending = (p: SiteProfile) => store.state.pendingOrigins.includes(p.origin);
const staleCount = (p: SiteProfile) => staleRulesOf(p).length;
const initialOf = (origin: string) => siteLabelOf(origin).slice(0, 1).toUpperCase();
/** 删除项的文案与详情页页脚 / 胶囊菜单 / 弹窗同一份（core/site-delete.ts） */
const deleteActionLabel = deleteSiteAction();

/** popover 属性（Vue 的模板类型还没有收录，按 modern-web-guidance 建议用对象展开） */
const POPOVER = { popover: 'auto' } as Record<string, string>;

// ---------- 行尾「⋯」菜单（#113） ----------

const menuEl = ref<HTMLElement | null>(null); // eslint 抑制不需要；函数 ref 直接赋值
const moreEl = ref<HTMLButtonElement | null>(null);
/** 当前开着菜单的行（一个列表同时最多一个菜单）；null = 都关着 */
const menuOrigin = ref<string | null>(null);

async function toggleMenu(p: SiteProfile) {
  if (menuOrigin.value === p.origin) {
    closeMenu();
    return;
  }
  menuOrigin.value = p.origin;
  await nextTick();
  const menu = menuEl.value;
  const more = document.querySelector<HTMLButtonElement>(`button.site-more[data-origin="${CSS.escape(p.origin)}"]`);
  moreEl.value = more;
  if (!menu || !more) return;
  menu.showPopover();
  positionMenu(menu, more);
  // 焦点进菜单（popover 自己不动焦点）；Esc / 点外面的关闭由 @toggle 统一收尾
  menu.querySelector<HTMLButtonElement>('button')?.focus();
}

/** 视口内翻转 / 夹紧（与胶囊菜单同一套思路：上方放不下翻到下方，左右不出视口） */
function positionMenu(menu: HTMLElement, more: HTMLElement) {
  const m = menu.getBoundingClientRect();
  const t = more.getBoundingClientRect();
  const gap = 6;
  let top = t.bottom + gap;
  if (top + m.height > window.innerHeight - 8) top = t.top - m.height - gap; // 下方放不下 → 翻到上方
  let left = t.right - m.width; // 默认右对齐触发按钮
  if (left < 8) left = 8;
  if (left + m.width > window.innerWidth - 8) left = window.innerWidth - 8 - m.width;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(8, top))}px`;
}

function onMenuToggle() {
  // 关闭（Esc / 点外面 / 选中菜单项都会走到这）：焦点回「⋯」，登记清空
  if (!menuEl.value?.matches(':popover-open')) {
    menuOrigin.value = null;
    moreEl.value?.focus();
    moreEl.value = null;
  }
}

function closeMenu() {
  menuEl.value?.hidePopover();
  menuOrigin.value = null;
}

/** 点了「删除这个网站的设置」：关菜单、发起删除——确认框是 App.vue 里共用的那一个 */
function onRowDelete() {
  const origin = menuOrigin.value;
  closeMenu();
  const p = store.state.profiles.find((x) => x.origin === origin);
  if (p) store.askReset(p);
}
</script>

<style scoped>
.sites-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pm-space-3);
  margin-bottom: var(--pm-space-1);
}

.forward {
  flex: none;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}

.forward:hover {
  color: var(--pm-fg);
}

.view-title {
  font-size: var(--pm-font-size-title);
  margin: 0;
}

.empty {
  color: var(--pm-fg-muted);
}

.pending-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-3);
  margin-bottom: var(--pm-space-3);
}

.site-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-2);
}

.site-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-card);
}

/* 行内两兄弟（#113）：链接占满、⋯ 靠右；窄屏域名换行时按钮不被挤掉 */
.site-main {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.site-link {
  display: flex;
  align-items: center;
  gap: var(--pm-space-3);
  flex: 1;
  min-width: 0;
  padding: var(--pm-space-3) var(--pm-space-4);
  border-radius: var(--pm-radius-card);
  color: var(--pm-fg);
  text-decoration: none;
}

/* 行尾菜单按钮（#113）：24×24 起（WCAG 2.5.8）；「⋯」字形小一号，视觉低于主内容 */
.site-more {
  flex: none;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 24px;
  min-block-size: 24px;
  margin-right: var(--pm-space-1);
  border: none;
  border-radius: var(--pm-radius-control);
  background: transparent;
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-title);
  line-height: 1;
  cursor: pointer;
}

.site-more:hover {
  background: var(--pm-bg-subtle);
  color: var(--pm-fg);
}

/* 行尾菜单：与胶囊菜单同一套材质（popover 关着时 UA 设 display:none） */
.site-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  min-inline-size: 160px;
  padding: var(--pm-space-1);
  border: 1px solid var(--pm-border-control);
  border-radius: var(--pm-radius-card);
  background: var(--pm-bg);
  color: var(--pm-fg);
  box-shadow: var(--pm-shadow-overlay);
}

.site-menu-item {
  display: block;
  inline-size: 100%;
  border: none;
  border-radius: var(--pm-radius-control);
  padding: 6px 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.site-menu-item:hover {
  background: var(--pm-bg-subtle);
}

.site-menu-item.danger {
  color: var(--pm-danger);
}

.row-error {
  grid-column: 1 / -1;
  margin: 0 var(--pm-space-4) var(--pm-space-2);
}

.site-link:hover {
  background: var(--pm-bg-subtle);
}

.favicon {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.favicon.initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--pm-bg-subtle);
  border: 1px solid var(--pm-border);
  color: var(--pm-fg-muted);
  font-size: var(--pm-font-size-caption);
  font-weight: var(--pm-font-weight-strong);
  text-transform: uppercase;
}

.site-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.site-host {
  font-weight: var(--pm-font-weight-strong);
  overflow-wrap: anywhere;
}

.site-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--pm-font-size-caption);
  color: var(--pm-fg-muted);
}

.chevron {
  margin-left: auto;
  padding-left: var(--pm-space-2);
  color: var(--pm-fg-muted);
}

.site-pending {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--pm-space-2);
  margin: 0 var(--pm-space-4);
  padding: var(--pm-space-2) 0 var(--pm-space-3);
  border-top: 1px solid var(--pm-border);
}

.site-pending .hint {
  margin: 0;
}
</style>
