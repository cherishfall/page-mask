/**
 * 页面级幕布控制器登记处（ui/curtain-controller.ts，#107 / ADR-0011）：
 * 登记可读回、注销只删自己的（旧实例删不掉新登记）、参考实现的幂等与往返。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  currentCurtainController,
  registerCurtainController,
  type PageCurtainController,
} from '@/ui/curtain-controller';

/** 参考实现：体现「cover / dismiss 幂等、toggle 往返、state 以实际状态为准」的契约 */
function fakeController(covered = false): PageCurtainController & { layers: number } {
  let active = covered;
  let layers = 0;
  return {
    get layers() {
      return layers;
    },
    state: () => active,
    cover: () => {
      if (active) return; // 已铺时无操作，不铺第二层
      active = true;
      layers += 1;
    },
    dismiss: () => {
      if (!active) return; // 没铺时无操作
      active = false;
      layers -= 1;
    },
    toggle: () => {
      if (active) {
        active = false;
        layers -= 1;
      } else {
        active = true;
        layers += 1;
      }
    },
  };
}

beforeEach(() => {
  const w = window as unknown as { __pagemaskCurtain?: unknown };
  w.__pagemaskCurtain = undefined;
});

describe('幕布控制器登记处（#107）', () => {
  it('没有登记时读回 null', () => {
    expect(currentCurtainController()).toBeNull();
  });

  it('登记后可读回同一个控制器', () => {
    const c = fakeController();
    registerCurtainController('oneshot', c);
    expect(currentCurtainController()?.controller).toBe(c);
    expect(currentCurtainController()?.owner).toBe('oneshot');
  });

  it('旧登记的 unregister 删不掉新登记（失联旧实例不能误删接替者）', () => {
    const old = registerCurtainController('oneshot', fakeController());
    const fresh = registerCurtainController('content', fakeController());
    old.unregister();
    expect(currentCurtainController()).toBe(fresh);
    fresh.unregister();
    expect(currentCurtainController()).toBeNull();
  });

  it('重复 unregister 是空操作', () => {
    const slot = registerCurtainController('content', fakeController());
    slot.unregister();
    slot.unregister();
    expect(currentCurtainController()).toBeNull();
  });

  it('参考实现：cover 幂等、dismiss 幂等、toggle 往返', () => {
    const c = fakeController();
    c.cover();
    c.cover();
    expect(c.layers).toBe(1); // 第二次 cover 不铺第二层
    expect(c.state()).toBe(true);
    c.toggle();
    expect(c.state()).toBe(false);
    c.dismiss(); // 没铺时 dismiss 无操作
    expect(c.state()).toBe(false);
    c.cover();
    expect(c.state()).toBe(true);
    c.dismiss();
    expect(c.state()).toBe(false);
    expect(c.layers).toBe(0); // 每一层都撤干净
  });
});
