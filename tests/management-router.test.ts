/**
 * 管理页 hash 路由与站点标识（#40）。纯函数，不需要浏览器。
 */
import { describe, expect, it } from 'vitest';
import { addHash, isRouteHash, parseRoute, siteHash } from '@/entrypoints/management/router';
import { normalizeSiteHost, siteHostOf, siteLabelOf, staleRulesOf } from '@/entrypoints/management/site';
import { createEmptyProfile } from '@/core/types';

describe('管理页 hash 路由', () => {
  it('没有 hash、根 hash、认不出来的 hash 都落到网站列表', () => {
    expect(parseRoute('')).toEqual({ name: 'sites' });
    expect(parseRoute('#')).toEqual({ name: 'sites' });
    expect(parseRoute('#/')).toEqual({ name: 'sites' });
    expect(parseRoute('#/sites')).toEqual({ name: 'sites' });
    expect(parseRoute('#/sites/')).toEqual({ name: 'sites' });
    expect(parseRoute('#/nope')).toEqual({ name: 'sites' });
    expect(isRouteHash('')).toBe(false);
    expect(isRouteHash('#/nope')).toBe(false);
  });

  it('「插件设置」不在本路由里：旧地址 #/settings 落回网站列表，由独立页面承载（#55）', () => {
    expect(parseRoute('#/settings')).toEqual({ name: 'sites' });
    expect(parseRoute('#/settings/')).toEqual({ name: 'sites' });
    expect(isRouteHash('#/settings')).toBe(false);
  });

  it('站点设置地址带 host（含端口），可直接粘贴', () => {
    expect(parseRoute('#/sites/example.com')).toEqual({ name: 'site', host: 'example.com' });
    expect(parseRoute('#/sites/127.0.0.1:8080')).toEqual({ name: 'site', host: '127.0.0.1:8080' });
    expect(siteHash('example.com')).toBe('#/sites/example.com');
    expect(siteHash('127.0.0.1:8080')).toBe('#/sites/127.0.0.1:8080');
    expect(isRouteHash('#/sites/example.com')).toBe(true);
    expect(isRouteHash('#/sites/example.com/')).toBe(true);
  });

  it('手输中文域名也能对上 Punycode 形式的站点标识', () => {
    const puny = normalizeSiteHost('例子.中国');
    expect(puny).toMatch(/^xn--/);
    expect(parseRoute(`#/sites/${puny}`)).toEqual({ name: 'site', host: puny });
    expect(parseRoute('#/sites/例子.中国')).toEqual({ name: 'site', host: puny });
  });

  it('待添加地址带着完整来源（http 还是 https 不靠 host 猜）', () => {
    expect(addHash('https://example.com')).toBe('#/add/https%3A%2F%2Fexample.com');
    expect(parseRoute(addHash('https://example.com'))).toEqual({ name: 'add', origin: 'https://example.com' });
    expect(parseRoute(addHash('http://127.0.0.1:8080'))).toEqual({ name: 'add', origin: 'http://127.0.0.1:8080' });
    expect(isRouteHash(addHash('https://example.com'))).toBe(true);
  });

  it('待添加地址的来源不合法或缺来源时落到网站列表（不渲染半截页面）', () => {
    expect(parseRoute('#/add')).toEqual({ name: 'sites' });
    expect(parseRoute('#/add/')).toEqual({ name: 'sites' });
    expect(parseRoute('#/add/not-a-url')).toEqual({ name: 'sites' });
    expect(parseRoute('#/add/chrome%3A%2F%2Fsettings')).toEqual({ name: 'sites' });
    expect(parseRoute('#/add/%E0%A4%A')).toEqual({ name: 'sites' });
  });
});

describe('站点标识与展示名', () => {
  it('路由参数用 host（保留非默认端口），展示名去掉 www. 并转回 Unicode', () => {
    expect(siteHostOf('https://www.example.com:8443')).toBe('www.example.com:8443');
    expect(siteLabelOf('https://www.example.com:8443')).toBe('example.com:8443');
    expect(siteLabelOf('https://例子.中国')).toBe('例子.中国');
    expect(siteHostOf('not a url')).toBe('not a url');
  });

  it('失效项只统计 lastHealth 为 stale 的规则', () => {
    const p = createEmptyProfile('https://reader.example');
    p.hideRules = [
      { id: 'a', elementName: '页头', candidates: ['#a'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 1 },
      { id: 'b', elementName: '侧栏', candidates: ['#b'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 2, lastHealth: 'stale' },
      { id: 'c', elementName: '广告', candidates: ['#c'], strategy: 'remove', scope: { type: 'all' }, onlyThis: false, createdAt: 3, lastHealth: 'stale' },
    ];
    expect(staleRulesOf(p).map((r) => r.id)).toEqual(['b', 'c']);
  });
});
