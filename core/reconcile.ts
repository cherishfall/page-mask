/**
 * 站点生命周期对账（纯函数）：让「站点配置 / 站点授权 / 动态注册」三者一致（REVIEW B1）。
 *
 * 规则：
 * - 有配置且已授权 → 必须注册（缺了补注册；写法与当前计划不同则更新）
 * - 注册了但没有配置或没有授权 → 注销
 * - 有配置没有授权 → 不注册，列入 pending（界面显示「待授权」；不删配置）
 * - 已授权但没有配置（新站点向导进行中）→ 不注册：保存时写入配置，后台随即对账补注册
 * - 不是本扩展命名空间（REGISTRATION_ID_PREFIX）的注册一律不动
 *
 * 幂等：同一输入重复执行，第二次得到空计划。后台在安装/更新、浏览器启动、授权增减、
 * 配置增删、导入后调用（见 core/background-engine.ts）。
 */
import { REGISTRATION_ID_PREFIX, registrationPlan, type RegistrationPlan } from './registration';

/** scripting.getRegisteredContentScripts 返回的条目（只用到这些字段） */
export interface RegisteredScript {
  id: string;
  matches?: string[];
  js?: string[];
  runAt?: string;
  persistAcrossSessions?: boolean;
}

export interface ReconcileInput {
  /** 有站点配置的来源 */
  configured: readonly string[];
  /** 其中已持有主机权限的来源 */
  granted: readonly string[];
  /** 当前已注册的动态内容脚本 */
  registered: readonly RegisteredScript[];
}

export interface ReconcilePlan {
  register: RegistrationPlan[];
  update: RegistrationPlan[];
  /** 要注销的注册 id */
  unregister: string[];
  /** 有配置、没授权的来源（待授权） */
  pending: string[];
}

const sameList = (a: readonly string[] | undefined, b: readonly string[]) =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i]);

function matchesPlan(s: RegisteredScript, p: RegistrationPlan): boolean {
  return (
    sameList(s.matches, p.matches) &&
    sameList(s.js, p.js) &&
    s.runAt === p.runAt &&
    s.persistAcrossSessions === p.persistAcrossSessions
  );
}

export function planReconcile({ configured, granted, registered }: ReconcileInput): ReconcilePlan {
  const grantedSet = new Set(granted);
  const wanted = new Map<string, RegistrationPlan>();
  const pending: string[] = [];
  for (const origin of [...new Set(configured)].sort()) {
    if (grantedSet.has(origin)) {
      const plan = registrationPlan(origin);
      wanted.set(plan.id, plan);
    } else {
      pending.push(origin);
    }
  }

  const ours = registered.filter((s) => s.id.startsWith(REGISTRATION_ID_PREFIX));
  const byId = new Map(ours.map((s) => [s.id, s]));

  const register: RegistrationPlan[] = [];
  const update: RegistrationPlan[] = [];
  for (const [id, plan] of wanted) {
    const current = byId.get(id);
    if (!current) register.push(plan);
    else if (!matchesPlan(current, plan)) update.push(plan);
  }
  const unregister = ours
    .map((s) => s.id)
    .filter((id) => !wanted.has(id))
    .sort();

  return { register, update, unregister, pending };
}
