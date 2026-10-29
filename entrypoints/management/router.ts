/**
 * 管理页的 hash 路由（手写，不引路由库）。
 *
 * 两个视图各有独立地址，刷新、直接粘贴、浏览器前进后退都停在正确视图：
 *   `#/sites`                 网站列表
 *   `#/sites/<host>`          某个网站的站点设置（host 是 origin 的 host，含非默认端口）
 *
 * 「插件设置」是独立的 HTML 页面（settings.html，#55），不在本路由里：旧地址 `#/settings`
 * 认不出来，会落回网站列表。同理，旧地址 `#/add/<来源>`（「待添加」页）在 #56 删除——
 * 标签页标题与图标改为在页面右下角 ⋯ 菜单里就地改，不再需要一条单独的路由。
 *
 * 首次进入没有 hash（或 hash 认不出来）时用 replaceState 落到 `#/sites`，不新增历史记录。
 */
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { normalizeSiteHost } from './site';

export type ManagementRoute = { name: 'sites' } | { name: 'site'; host: string };

export const SITES_HASH = '#/sites';

/** 某个网站的站点设置地址 */
export function siteHash(host: string): string {
  return `${SITES_HASH}/${host}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** hash 是否属于本页的地址之一（用于判断要不要改写成默认地址） */
export function isRouteHash(hash: string): boolean {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  return parts[0] === 'sites';
}

/** 解析 hash；认不出来的一律当作网站列表（调用方通常已先改成 `#/sites`） */
export function parseRoute(hash: string): ManagementRoute {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'sites' && parts[1]) {
    return { name: 'site', host: normalizeSiteHost(safeDecode(parts.slice(1).join('/'))) };
  }
  return { name: 'sites' };
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
