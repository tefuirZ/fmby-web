// fmby-web#658：CAS 对账报告的**行为断言**（纯函数，等价于 #8 的 formatCasDrive 纪律）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/manage-cas-reconcile.test.ts
//
// ★为什么是行为断言而不是「渲染不炸即过」：
//   把 `identified=false` 默认成「已对账」这类变异，在「只渲染一遍不报错」的
//   测试里是恒绿的。必须直接调函数、直接比返回值。

import test from 'node:test';
import assert from 'node:assert/strict';
import type { CasReconcileReport } from '@fmby/v2-shared/contracts/manage/casAdmin';
import {
  formatGeneratedAt,
  resolveReconcileView,
  summarizeReconcile,
} from '../src/pages/manage/cas/reconcilePresentation';

const report = (
  identified: boolean,
  reconciled: boolean,
  generatedAtMs: number | null = 1_700_000_000_000,
): CasReconcileReport => ({
  reportId: 'r1',
  source: 'scan',
  identified,
  reconciled,
  generatedAtMs,
});

test('① identified=false ⇒ 「未识别」，绝不默认「已对账」', () => {
  const view = resolveReconcileView(report(false, true));
  assert.equal(view.label, '未识别');
  assert.equal(view.tone, 'neutral');
  // ★reconciled 原样透出（展示折叠了，但事实字段不许被改写）
  assert.equal(view.reconciled, true);
  assert.equal(view.identified, false);
});

test('② identified=true 且 reconciled=false ⇒ 「已识别 · 未对账」（真实差异态，不谎称成功/失败）', () => {
  const view = resolveReconcileView(report(true, false));
  assert.equal(view.label, '已识别 · 未对账');
  assert.equal(view.tone, 'warning');
});

test('③ identified=true 且 reconciled=true ⇒ 「已对账」', () => {
  const view = resolveReconcileView(report(true, true));
  assert.equal(view.label, '已对账');
  assert.equal(view.tone, 'success');
});

test('④ 时间戳非法/缺失 ⇒ 「未生成」，不伪造 1970 年', () => {
  assert.equal(formatGeneratedAt(null), '未生成');
  assert.equal(formatGeneratedAt(undefined), '未生成');
  assert.equal(formatGeneratedAt(0), '未生成', '0 不是「1970-01-01」，是「没生成过」');
  assert.equal(formatGeneratedAt(-1), '未生成');
  assert.equal(formatGeneratedAt(Number.NaN), '未生成');
  // 合法值：返回非空且不是「未生成」
  const ok = formatGeneratedAt(1_700_000_000_000);
  assert.notEqual(ok, '未生成');
  assert.ok(ok.length > 0);
});

test('⑤ 汇总三档之和恒等于总数（不丢不重）', () => {
  const reports = [
    report(true, true),
    report(true, false),
    report(false, false),
    report(false, true),
    report(true, false),
  ];
  const s = summarizeReconcile(reports);
  assert.equal(s.total, 5);
  assert.equal(s.reconciled + s.pending + s.unidentified, s.total, '三档之和须等于总数');
  // 样本核算：(t,t)=1 → 已对账；(t,f)×2 → 待处理；(f,f)+(f,t)=2 → 未识别
  //   （identified=false 优先，其 reconciled 无展示意义）
  assert.equal(s.reconciled, 1, 'identified&&reconciled 的条目数');
  assert.equal(s.pending, 2, 'identified&&!reconciled 的条目数');
  assert.equal(s.unidentified, 2, '!identified 的条目数');
});

test('⑥ 空报告 ⇒ 全 0，不炸', () => {
  const s = summarizeReconcile([]);
  assert.deepEqual(s, { total: 0, reconciled: 0, pending: 0, unidentified: 0 });
});
