/**
 * fmby-web#658：CAS `.cas` 对账报告的**纯展示逻辑**（抽出以便行为断言）。
 *
 * 与 `formatCasDrive.ts` 同族纪律：这些决定「对账状态会不会对用户撒谎」，
 * 必须能被直接调用验证；留在 JSX 里只能靠读源码字符串断言，对
 * 「把未识别默认成已对账」这类变异恒绿，验证等于没有。
 *
 * ★不伪造事实（与 copy_state 三原则同源）：
 * 1. `identified=false` ⇒ 「未识别」，**绝不**默认「已对账」；
 * 2. `identified=true 且 reconciled=false` ⇒ 「已识别·未对账」（真实差异待处理态），
 *    既不谎称成功也不谎称失败；
 * 3. 时间戳非法/缺失 ⇒ 「未生成」，不显示 1970 年。
 */

import type { CasReconcileReport } from '@fmby/v2-shared/contracts/manage/casAdmin';

/** 对账状态（由 identified / reconciled 两字段组合派生，不引入第三真源）。 */
export type CasReconcileTone = 'success' | 'warning' | 'neutral';

export interface CasReconcileView {
  /** 状态文案。 */
  label: string;
  tone: CasReconcileTone;
  /** 是否已对账（reconciled 原样）。 */
  reconciled: boolean;
  /** 是否已识别（identified 原样）。 */
  identified: boolean;
}

/**
 * 由 `identified` / `reconciled` 派生展示态。
 *
 * 组合语义取自后端 DTO（`CasReconcileReportDto`）：
 *   identified = 报告条目已被识别到
 *   reconciled = 已完成对账
 * ⇒ 四象限中只有三种需区分展示（identified=false 时 reconciled 无展示意义）。
 */
export function resolveReconcileView(report: CasReconcileReport): CasReconcileView {
  const { identified, reconciled } = report;
  if (!identified) {
    return { label: '未识别', tone: 'neutral', reconciled, identified };
  }
  if (reconciled) {
    return { label: '已对账', tone: 'success', reconciled, identified };
  }
  return { label: '已识别 · 未对账', tone: 'warning', reconciled, identified };
}

/** 报告生成时间；`null` / 非有限值 / `<=0` ⇒ 「未生成」（不伪造 1970 年）。 */
export function formatGeneratedAt(generatedAtMs: number | null | undefined): string {
  if (generatedAtMs === null || generatedAtMs === undefined) return '未生成';
  if (!Number.isFinite(generatedAtMs) || generatedAtMs <= 0) return '未生成';
  return new Date(generatedAtMs).toLocaleString();
}

/**
 * 汇总计数（供页面头部「已对账 / 待处理 / 未识别」三档）。
 *
 * ★三档之和恒等于条目总数（不丢不重）—— 由测试锁死。
 */
export function summarizeReconcile(reports: readonly CasReconcileReport[]): {
  total: number;
  reconciled: number;
  pending: number;
  unidentified: number;
} {
  let reconciled = 0;
  let pending = 0;
  let unidentified = 0;
  for (const report of reports) {
    const view = resolveReconcileView(report);
    if (!view.identified) unidentified += 1;
    else if (view.reconciled) reconciled += 1;
    else pending += 1;
  }
  return { total: reports.length, reconciled, pending, unidentified };
}
