/**
 * 「删除这个网站的设置」的文案（#56）。
 *
 * 同一件事有两个入口：页面右下角 ⋯ 菜单，和管理页的站点设置页页脚。两处必须同一套名字、
 * 同一套说明，所以两边都从这里取（文案本体在 core/i18n 的 management.deleteSite，改一处两处一起改）。
 *
 * 说清删的是「设置」而不是整个扩展；同时讲明会收回浏览器给 PageMask 的访问权限、网站从
 * 「你添加的网站」里消失——这两件事用户在意，又不该在点下去之后才发现。
 */
import { t } from './i18n';

/** 区块标题 / 菜单项 */
export function deleteSiteHeading(): string {
  return t().management.deleteSite.heading;
}

/** 危险按钮上的字（确认框里那个实底红的按钮也是它） */
export function deleteSiteAction(): string {
  return t().management.deleteSite.action;
}

/** 确认框标题：带上域名 —— 同一个菜单可能同时开在几个标签页上 */
export function deleteSiteTitle(label: string): string {
  return t().management.deleteSite.title(label);
}

/** 确认框正文：删掉什么、还会发生什么 */
export function deleteSiteImpact(): string {
  return t().management.deleteSite.impact;
}
