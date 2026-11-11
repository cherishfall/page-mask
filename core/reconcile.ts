/**
 * 站点生命周期对账（纯函数）：让「站点配置 / 站点授权 / 动态注册」三者一致（REVIEW B1）。
 *
 * 规则：
 * - 有配置、且该站点有有效授权模式 → 必须注册（缺了补注册；写法与当前计划不同则更新）
 * - 注册了但没有配置或没有有效授权 → 注销
 * - 有配置没有有效授权 → 不注册，列入 pending（界面显示「待授权」；不删配置）
 * - 已授权但没有配置（新站点向导进行中）→ 不注册：保存时写入配置，后台随即对账补注册
 * - 不是本扩展命名空间（REGISTRATION_ID_PREFIX）的注册一律不动
 *
 * 站点身份是站点 key（core/site-key.ts，#162）。授权按模式给，模式再按 siteKeyOfPattern
 * 归到站点：迁移用户手里只有 `https://weibo.com/*` 这类旧精确模式时，它们就是有效模式，
 * 不会因为新代码期望通配模式而被判成「待授权」。
 *
 * 幂等：同一输入重复执行，第二次得到空计划。后台在安装/更新、浏览器启动、授权增减、
 * 配置增删、导入后调用（见 core/background-engine.ts）。
 */
import { REGISTRATION_ID_PREFIX, registrationPlan, type RegistrationPlan } from './registration';
import { siteKeyOfPattern, sitePatterns } from './site-key';

/** scripting.getRegisteredContentScripts 返回的条目（只用到这些字段） */
export interface RegisteredScript {
  id: string;
  matches?: string[];
  js?: string[];
  runAt?: string;
  persistAcrossSessions?: boolean;
}

export interface ReconcileInput {
  /** 有站点配置的站点 key */
  configured: readonly string[];
  /** 全部已授权的主机模式（permissions.getAll().origins） */
  grantedPatterns: readonly string[];
  /** 当前已注册的动态内容脚本 */
  registered: readonly RegisteredScript[];
}

export interface ReconcilePlan {
  register: RegistrationPlan[];
  update: RegistrationPlan[];
  /** 要注销的注册 id */
  unregister: string[];
  /** 有配置、没有有效授权的站点 key（待授权） */
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

/**
 * 某个站点当前有效（已授权）的匹配模式，按 sitePatterns 的顺序——裸域在前、子域在后；
 * 其余归到同一站点的旧精确模式（如 `https://weibo.com/*`）排在后面。没有授权时为空。
 */
export function grantedPatternsFor(key: string, grantedPatterns: readonly string[]): string[] {
  const own = new Set<string>();
  for (const p of grantedPatterns) {
    if (siteKeyOfPattern(p) === key) own.add(p);
  }
  if (own.size === 0) return [];
  const out: string[] = [];
  for (const p of sitePatterns(key)) if (own.delete(p)) out.push(p);
  for (const p of grantedPatterns) if (own.delete(p)) out.push(p);
  return out;
}

export function planReconcile({ configured, grantedPatterns, registered }: ReconcileInput): ReconcilePlan {
  const wanted = new Map<string, RegistrationPlan>();
  const pending: string[] = [];
  for (const key of [...new Set(configured)].sort()) {
    const patterns = grantedPatternsFor(key, grantedPatterns);
    if (patterns.length > 0) {
      const plan = registrationPlan(key, patterns);
      wanted.set(plan.id, plan);
    } else {
      pending.push(key);
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
