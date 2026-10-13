/**
 * 安装向导的**三页编排**（fmby-v2 #640 卡面：① 数据库+缓存 ② 服务器配置 ③ 管理员配置）。
 *
 * 只做门控与翻页，**不重写任何判定**：
 *   - 口令强度/二次确认 → `passwordPolicy.ts`
 *   - PG 结构化字段校验 → `pgConnection.ts`
 * 组件侧只消费 `stepProblem` / `stepDone`（honesty 测试⑩「不得在组件里重写规则」）。
 */

import { confirmPasswordProblem } from './passwordPolicy';
import { pgFieldsProblem, type PgFields } from './pgConnection';

export type WizardStepId = 'database' | 'server' | 'admin';

export interface WizardStepMeta {
  id: WizardStepId;
  /** 页签标题（卡面三页措辞）。 */
  title: string;
  /** 序号文案，1 起。 */
  index: number;
}

export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { id: 'database', title: '数据库 / 缓存', index: 1 },
  { id: 'server', title: '服务器配置', index: 2 },
  { id: 'admin', title: '管理员配置', index: 3 },
];

/** 向导收集的全部值（与 `InstallApplyRequest` 的三组一一对应）。 */
export interface WizardValues {
  dbKind: 'sqlite' | 'postgresql';
  sqlitePath: string;
  cacheKind: 'builtin' | 'redis';
  redisUrl: string;
  /** 仅 dbKind=postgresql 参与判定。 */
  pg: PgFields;
  adminUsername: string;
  adminPassword: string;
  adminConfirm: string;
}

/**
 * 单页门控。返回 null = 本页填齐可继续；否则返回**第一条**中文原因。
 *
 * ★② 服务器配置恒过（`ponytail:` 诚实边界）：V2 `install_flow.rs` 的 apply 只收
 *   database / cache / admin 三组，**没有服务器配置字段** ⇒ 本页只呈现生效值、
 *   不收集输入。真要做（站点名/监听地址等）需后端先加契约，属后端卡。
 */
export function stepProblem(step: WizardStepId, values: WizardValues): string | null {
  switch (step) {
    case 'database': {
      if (values.dbKind === 'postgresql') {
        const problem = pgFieldsProblem(values.pg);
        if (problem) return problem;
      }
      if (values.cacheKind === 'redis' && values.redisUrl.trim().length === 0) {
        return '请填写 Redis 连接串';
      }
      return null;
    }
    case 'server':
      return null;
    case 'admin': {
      if (values.adminUsername.trim().length === 0) return '请填写管理员用户名';
      if (values.adminPassword.length === 0) return '请先设置管理员密码';
      if (values.adminPassword.trim().length === 0) return '密码不能只有空白字符';
      return confirmPasswordProblem(values.adminPassword, values.adminConfirm);
    }
  }
}

/** 本页是否已填齐（用于「下一步」按钮禁用与跳页拦截）。 */
export function stepDone(step: WizardStepId, values: WizardValues): boolean {
  return stepProblem(step, values) === null;
}

export function nextWizardStep(step: WizardStepId): WizardStepId | null {
  const i = WIZARD_STEPS.findIndex((s) => s.id === step);
  return i >= 0 && i + 1 < WIZARD_STEPS.length ? WIZARD_STEPS[i + 1].id : null;
}

export function prevWizardStep(step: WizardStepId): WizardStepId | null {
  const i = WIZARD_STEPS.findIndex((s) => s.id === step);
  return i > 0 ? WIZARD_STEPS[i - 1].id : null;
}
