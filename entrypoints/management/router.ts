/**
 * 管理页的 hash 路由（手写，不引路由库）。
 *
 * 四个视图各有独立地址，刷新、直接粘贴、浏览器前进后退都停在正确视图：
 *   `#/sites`                 网站列表
 *   `#/sites/<host>`          某个网站的站点设置（host 是 origin 的 host，含非默认端口）
 *   `#/add/<origin>`          还没添加的网站（站点设置视图的「待添加」状态）
 *   `#/settings`              设置
 *
 * 「待添加」单独一条地址而不是给 `#/sites/<host>` 加参数：新建配置需要完整来源
 * （`http` 还是 `https` 靠 host 看不出来），用 `#/add/` 把「这个网站还不在名单里」
 * 这件事直接写在地址上，站点设置地址继续只表示已在名单里的网站，两边都不含糊。
 *
 * 首次进入没有 hash（或 hash 认不出来）时用 replaceState 落到 `#/sites`，不新增历史记录。
 */
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { normalizeOrigin } from '@/core/origin';
import { normalizeSiteHost } from './site';

export type ManagementRoute =
  | { name: 'sites' }
  | { name: 'site'; host: string }
  | { name: 'add'; origin: string }
  | { name: 'settings' };

export const SITES_HASH = '#/sites';
export const SETTINGS_HASH = '#/settings';
export const ADD_HASH = '#/add/';

/** 某个网站的站点设置地址 */
export function siteHash(host: string): string {
  return `${SITES_HASH}/${host}`;
}

/** 还没添加的网站的地址（origin 要编码：里面带 `//` 与 `:`） */
export function addHash(origin: string): string {
  return ADD_HASH + encodeURIComponent(origin);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** hash 是否属于本页的几种地址之一（用于判断要不要改写成默认地址） */
export function isRouteHash(hash: string): boolean {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  return parts[0] === 'sites' || parts[0] === 'add' || parts[0] === 'settings';
}

/** 解析 hash；认不出来的一律当作网站列表（调用方通常已先改成 `#/sites`） */
export function parseRoute(hash: string): ManagementRoute {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'add' && parts[1]) {
    // 来源必须是规范形式（只能 http/https）；认不出来就当作没有这条地址
    const origin = normalizeOrigin(safeDecode(parts.slice(1).join('/')));
    return origin ? { name: 'add', origin } : { name: 'sites' };
  }
  if (parts[0] === 'sites' && parts[1]) {
    return { name: 'site', host: normalizeSiteHost(safeDecode(parts.slice(1).join('/'))) };
  }
  return { name: 'sites' };
}

/**
 * 把当前地址换成另一个 hash，并让路由立即跟上（replaceState 不触发 hashchange）。
 * 用于「待添加」页添加成功后原地变成站点设置页：不在历史里留下已经完成的那一步。
 */
export function replaceHash(hash: string): void {
  globalThis.history.replaceState(null, '', hash);
  globalThis.dispatchEvent(new HashChangeEvent('hashchange'));
}

/**
 * 当前路由（随 hashchange 更新）。
 * 首次进入无 hash / hash 不认识时改写地址，避免用户看到空地址或拼错的 hash。
 */
export function useHashRoute(): Ref<ManagementRoute> {
  const route = ref<ManagementRoute>(parseRoute(globalThis.location?.hash ?? ''));

  function sync() {
    const hash = globalThis.location?.hash ?? '';
    if (!isRouteHash(hash)) {
      // replaceState 不触发 hashchange，改完要自己再同步一次
      globalThis.history.replaceState(null, '', SITES_HASH);
    }
    route.value = parseRoute(globalThis.location?.hash ?? '');
  }

  onMounted(() => {
    sync();
    globalThis.addEventListener('hashchange', sync);
  });
  onUnmounted(() => globalThis.removeEventListener('hashchange', sync));

  return route;
}
