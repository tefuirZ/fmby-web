// FE-DELETE-UX-OPTIMISTIC：挂载（数据源）删除乐观更新纯逻辑单测。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖卡面两条硬断言：
//  (a) mutation 返回后该 id 不在列表（乐观移除）；
//  (b) 失败回滚（previous 快照恢复，含被删 id）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { optimisticRemoveMount, rollbackMountList } from '../src/pages/manage/mounts/hooks/deleteOptimistic';

const LIST = {
  items: [
    { id: 'm-1', name: 'A' },
    { id: 'm-2', name: 'B' },
    { id: 'm-3', name: 'C' },
  ],
};

test('乐观移除：返回副本不含目标 id（原列表不变）', () => {
  const next = optimisticRemoveMount(LIST, 'm-2');
  assert.notEqual(next, LIST, '应返回新对象（不原地改）');
  const ids = next!.items.map((m) => m.id);
  assert.ok(!ids.includes('m-2'), 'm-2 应被移除');
  assert.deepEqual(ids, ['m-1', 'm-3']);
  // 原列表不受影响（回滚安全）
  assert.equal(LIST.items.length, 3);
});

test('乐观移除：删除首/末项也正确', () => {
  assert.deepEqual(optimisticRemoveMount(LIST, 'm-1')!.items.map((m) => m.id), ['m-2', 'm-3']);
  assert.deepEqual(optimisticRemoveMount(LIST, 'm-3')!.items.map((m) => m.id), ['m-1', 'm-2']);
});

test('乐观移除：undefined / 非列表输入原样透传（不崩）', () => {
  assert.equal(optimisticRemoveMount(undefined, 'x'), undefined);
  const weird = { other: 1 } as never;
  assert.equal(optimisticRemoveMount(weird, 'x'), weird, '非列表结构原样返回');
});

test('失败回滚：直接还原 previous 快照（含被删 id）', () => {
  const failed = optimisticRemoveMount(LIST, 'm-2');
  const restored = rollbackMountList(failed, LIST);
  assert.equal(restored, LIST, '回滚应还原为 previous 引用');
  assert.deepEqual(restored!.items.map((m) => m.id), ['m-1', 'm-2', 'm-3']);
});
