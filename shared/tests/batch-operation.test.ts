/**
 * FE-OPT-04：批量操作内核单测（选择集 + 逐条运行状态机）。
 *
 * 复用 shared/tests 既有 node:test 约定（无 vitest/jsdom）——断言纯函数：
 * - selection：全选/反选/范围选（shift 锚点）/三态表头/跨页保留；
 * - runner：逐条状态迁移（pending→running→ok/fail）、部分失败不中断、
 *   失败项可重试、并发度、abort 跳过。
 *
 * 跑法：node --import ./tests/register-resolver.mjs --test tests/batch-operation.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearVisible,
  failedItems,
  headerCheckState,
  invertVisible,
  isBatchRunning,
  pruneSelection,
  runBatch,
  selectAll,
  summarize,
  toggleOne,
  toggleRange,
} from '../src/batch/index.ts';

/* ---------------- selection ---------------- */

test('selection：单点 toggle 幂等（勾选加入 / 取消移除）', () => {
  assert.deepEqual(toggleOne([], 'a', true), ['a']);
  assert.deepEqual(toggleOne(['a'], 'a', true), ['a']);
  assert.deepEqual(toggleOne(['a', 'b'], 'a', false), ['b']);
  assert.deepEqual(toggleOne(['a'], 'b', false), ['a']);
});

test('selection：全选并入可见项，跨页已选保留', () => {
  assert.deepEqual(selectAll(['z'], ['a', 'b']), ['z', 'a', 'b']);
  assert.deepEqual(selectAll(['a'], ['a', 'b']), ['a', 'b']);
});

test('selection：清空仅移除可见项（跨页选择不丢）', () => {
  assert.deepEqual(clearVisible(['a', 'b', 'z'], ['a', 'b']), ['z']);
});

test('selection：反选仅当前页取反', () => {
  assert.deepEqual(invertVisible(['a', 'z'], ['a', 'b']), ['z', 'b']);
});

test('selection：范围选按锚点→目标（顺序无关，含反向拖选）', () => {
  const visible = ['a', 'b', 'c', 'd', 'e'];
  // 正向
  assert.deepEqual(
    toggleRange({ selected: [], visibleIds: visible, id: 'd', anchorId: 'b', checked: true }),
    ['b', 'c', 'd'],
  );
  // 反向（目标在锚点之前）：锚点 c→目标 a 覆盖 a..c，从 {b,c,d} 中移除后剩 d
  assert.deepEqual(
    toggleRange({ selected: ['b', 'c', 'd'], visibleIds: visible, id: 'a', anchorId: 'c', checked: false }),
    ['d'],
  );
});

test('selection：范围选锚点缺失退化为单点 toggle', () => {
  const visible = ['a', 'b', 'c'];
  assert.deepEqual(
    toggleRange({ selected: [], visibleIds: visible, id: 'b', anchorId: null, checked: true }),
    ['b'],
  );
  assert.deepEqual(
    toggleRange({ selected: [], visibleIds: visible, id: 'b', anchorId: 'zzz', checked: true }),
    ['b'],
  );
});

test('selection：表头三态（未选/半选/全选）', () => {
  const visible = ['a', 'b', 'c'];
  assert.equal(headerCheckState([], visible), 'unchecked');
  assert.equal(headerCheckState(['a'], visible), 'indeterminate');
  assert.equal(headerCheckState(['a', 'b', 'c'], visible), 'checked');
  assert.equal(headerCheckState([], []), 'unchecked');
});

test('selection：prune 剔除失效 id', () => {
  assert.deepEqual(pruneSelection(['a', 'b', 'zzz'], ['a', 'b']), ['a', 'b']);
});

/* ---------------- runner ---------------- */

test('runner：逐条状态迁移 pending→running→ok', async () => {
  const seen: string[] = [];
  const final = await runBatch(
    [
      { id: '1', label: 'one' },
      { id: '2', label: 'two' },
    ],
    async () => {},
    { onUpdate: (s) => seen.push(`${s.id}:${s.status}`) },
  );
  assert.deepEqual(
    final.map((s) => s.status),
    ['ok', 'ok'],
  );
  assert.ok(seen.includes('1:pending'));
  assert.ok(seen.includes('1:running'));
  assert.ok(seen.includes('1:ok'));
});

test('runner：部分失败不中断其余（fail 记录 error，其余 ok）', async () => {
  const final = await runBatch(
    [
      { id: '1', label: 'ok' },
      { id: '2', label: 'boom' },
      { id: '3', label: 'ok' },
    ],
    async (id) => {
      if (id === '2') throw new Error('not_found: gone');
    },
  );
  assert.deepEqual(
    final.map((s) => s.status),
    ['ok', 'fail', 'ok'],
  );
  const failed = failedItems(final);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].error, 'not_found: gone');
});

test('runner：summarize 汇总（ok/fail/pending→skipped）', () => {
  const s = summarize([
    { id: '1', label: 'a', status: 'ok' },
    { id: '2', label: 'b', status: 'fail' },
    { id: '3', label: 'c', status: 'pending' },
  ]);
  assert.deepEqual(s, { total: 3, ok: 1, fail: 1, skipped: 1 });
});

test('runner：isBatchRunning 判定（有 pending/running 即真）', () => {
  assert.equal(isBatchRunning([{ id: '1', label: 'a', status: 'ok' }]), false);
  assert.equal(isBatchRunning([{ id: '1', label: 'a', status: 'running' }]), true);
  assert.equal(isBatchRunning([{ id: '1', label: 'a', status: 'pending' }]), true);
});

test('runner：串行默认（调用顺序 = 输入顺序，无并发交叉）', async () => {
  const order: string[] = [];
  await runBatch(
    [
      { id: '1', label: 'a' },
      { id: '2', label: 'b' },
      { id: '3', label: 'c' },
    ],
    async (id) => {
      order.push(`in:${id}`);
      await Promise.resolve();
      order.push(`out:${id}`);
    },
  );
  assert.deepEqual(order, ['in:1', 'out:1', 'in:2', 'out:2', 'in:3', 'out:3']);
});

test('runner：并发度 2 时同时最多两个在飞', async () => {
  let inFlight = 0;
  let peak = 0;
  await runBatch(
    Array.from({ length: 6 }, (_, i) => ({ id: String(i), label: `x${i}` })),
    async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
    },
    { concurrency: 2 },
  );
  assert.ok(peak <= 2, `peak concurrent ${peak} should be <= 2`);
  assert.ok(peak >= 2, `peak concurrent ${peak} should reach 2`);
});

test('runner：abort 后剩余项保持 pending（skipped）', async () => {
  let stop = false;
  const final = await runBatch(
    Array.from({ length: 5 }, (_, i) => ({ id: String(i), label: `x${i}` })),
    async (id) => {
      if (id === '1') stop = true;
    },
    { shouldAbort: () => stop },
  );
  // 处理了 0、1（1 置 stop），后续保持 pending
  assert.equal(final[0].status, 'ok');
  assert.equal(final[1].status, 'ok');
  assert.equal(final.filter((s) => s.status === 'pending').length, 3);
});
