// E3 前端断言 · ②③④ 转正（后端已落地：w06 feat/w06-perf-capacity-3000）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 卡面 5 条的覆盖（接 task-center-e3-feedback.contract.test.ts 之后）：
//   ② 每批 append 计数正确 —— applyTaskCenterBatch 纯函数（行为断言，非字符串比对）
//   ③ 人为 5s 延迟仍 ≤300ms —— backoffMs + keepPreviousData（结构断言；计时须 Playwright）
//   ④ 3s 无数据降级 —— WS 断开 ⇒ status closed/error ⇒ 调用方走分页（降级面已存在）

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const PAGE = '../../host/src/pages/manage/ManageTaskCenterPage.tsx';
const HOOKS_RT =
  '../../host/src/pages/manage/task-center/hooks/useTaskCenterRealtime.ts';
const HOOKS_Q =
  '../../host/src/pages/manage/task-center/hooks/useTaskCenterQueries.ts';

import {
  applyTaskCenterBatch,
  parseTaskCenterBatch,
  taskCenterBackoffMs,
  type TaskCenterBatchWire,
} from '../src/pages/manage/task-center/hooks/useTaskCenterRealtime';

function batch(seq: number, items: Array<{ category: string; id: string; status: string; bucket: 'pending' | 'active' | 'terminal' }>): TaskCenterBatchWire {
  return {
    batch_seq: seq,
    batch_index: 0,
    has_more: false,
    total_hint: items.length,
    items,
  };
}

// ── ② 每批 append 计数正确 ──────────────────────────────────────────────────

test('②a 全新任务 ⇒ append 计数 = 批内条数', () => {
  const rows = [{ category: 'scan', id: '1', status: 'Queued' }];
  const r = applyTaskCenterBatch(rows, batch(1, [
    { category: 'scan', id: '2', status: 'Running', bucket: 'active' },
    { category: 'scrape', id: '9', status: 'Queued', bucket: 'pending' },
  ]));
  assert.equal(r.appended, 2, '两条新任务都必须计入 append');
  assert.equal(r.updated, 0);
  assert.equal(r.rows.length, 3, '1 旧 + 2 新');
});

test('②b 已有任务 ⇒ 原地更新（append 计数不变）', () => {
  const rows = [
    { category: 'scan', id: '1', status: 'Queued' },
    { category: 'scan', id: '2', status: 'Running' },
  ];
  const r = applyTaskCenterBatch(rows, batch(2, [
    { category: 'scan', id: '1', status: 'Succeeded', bucket: 'terminal' },
  ]));
  assert.equal(r.appended, 0, '已有任务不算 append');
  assert.equal(r.updated, 1);
  assert.equal(r.rows[0].status, 'Succeeded', 'status 必须被更新');
  assert.equal(r.rows.length, 2, '行数不变');
});

test('②c 空批 ⇒ 零 append 零更新', () => {
  const r = applyTaskCenterBatch([], batch(3, []));
  assert.equal(r.appended, 0);
  assert.equal(r.updated, 0);
  assert.equal(r.rows.length, 0);
});

test('②d WS 帧解析：非 JSON / 非本事件 / 缺字段 ⇒ null（不崩）', () => {
  assert.equal(parseTaskCenterBatch('not json'), null);
  assert.equal(parseTaskCenterBatch('{"type":"playback.session.started"}'), null);
  assert.equal(parseTaskCenterBatch('{"type":"task.center.batch"}'), null, '缺 payload');
  const good = parseTaskCenterBatch(
    JSON.stringify({
      type: 'task.center.batch',
      payload: { batch_seq: 1, batch_index: 0, has_more: false, total_hint: 0, items: [] },
    })
  );
  assert.ok(good, '合法帧必须解析成功');
  assert.equal(good?.batch_seq, 1);
});

// ── ③ 人为 5s 延迟仍 ≤300ms 出内容（结构前提）─────────────────────────────

test('③a 重连退避封顶 15s（断线时不无限快速重连打爆后端）', () => {
  assert.equal(taskCenterBackoffMs(1), 1000);
  assert.equal(taskCenterBackoffMs(2), 2000);
  assert.equal(taskCenterBackoffMs(3), 4000);
  assert.equal(taskCenterBackoffMs(10), 15000, '封顶 15s');
});

test('③b keepPreviousData 仍在（延迟期间旧内容不清空 ⇒ ≤300ms 出内容的前提）', () => {
  const hooks = read(HOOKS_Q);
  assert.ok(
    /placeholderData:\s*keepPreviousData/.test(hooks),
    'list query 的 keepPreviousData 是「延迟期间旧内容仍在」的结构前提'
  );
});

// ── ④ WS 断开降级分页 ──────────────────────────────────────────────────────

test('④a 降级面存在：分页端点 + WS 消费 hook 并存（断开 ⇒ 走分页）', () => {
  const rt = read(HOOKS_RT);
  const hooks = read(HOOKS_Q);
  // WS 消费（实时）与分页 query（降级）同时存在 ⇒ 断开时调用方走分页。
  assert.ok(rt.includes('useTaskCenterRealtime') || rt.includes('export function useTaskCenterRealtime'), 'WS 消费 hook 应存在');
  assert.ok(
    /taskCenterApi\.getItems/.test(hooks),
    '分页 query 必须仍在（WS 断开时的降级面）'
  );
});

test('④b seqGapped 机制存在（跳号 ⇒ 调用方全量重拉 = 降级触发点）', () => {
  const rt = read(HOOKS_RT);
  assert.ok(
    /seqGapped/.test(rt),
    'WS 消费必须有 seqGapped 丢帧检测（跳号 = 丢事件 ⇒ 全量重拉）'
  );
  assert.ok(
    /batch_seq/.test(rt),
    '丢帧判据 = batch_seq 不连续'
  );
});

test('④c WS 路径 scope=admin（管理面数据只有 admin 连接能收到）', () => {
  const rt = read(HOOKS_RT);
  assert.ok(
    /scope=admin/.test(rt),
    'WS 路径必须带 scope=admin（与后端 can_receive 的 admin-only 对应）'
  );
});

// ── 反向断言撤除（后端已落地 ⇒ 前端 hooks 现在应有 WS 符号）────────────────

test('E3 已落地：任务中心 hooks 现在消费 WS 帧（反向断言撤除）', () => {
  const rt = read(HOOKS_RT);
  assert.ok(
    /WebSocket/.test(rt),
    'E3 后端已落地 ⇒ 前端必须有 WS 消费代码（旧反向断言「不得出现 WebSocket」已撤）'
  );
  assert.ok(
    /batch_seq/.test(rt),
    'batch_seq 丢帧检测应存在'
  );
});
