// FE-DELETE-UX-OPTIMISTIC：媒体库删除乐观更新纯逻辑单测（第二条主链路）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 媒体库列表响应形态（ManageLibrariesResponse）：`{ items: ManageLibraryRecord[] }`。
// 注：原 FE-OPT-01 ② 的实现误用 `libraries` 字段，乐观移除实际未命中缓存；本卡修正为 `items`。

import test from 'node:test';
import assert from 'node:assert/strict';
import { optimisticRemoveLibrary, rollbackLibraryList } from '../src/pages/manage/libraries/hooks/deleteOptimistic';

const LIST = {
  items: [
    { id: 'lib-1' },
    { id: 'lib-2' },
    { id: 'lib-3' },
  ],
};

test('乐观移除：返回副本不含目标库 id（原列表不变）', () => {
  const next = optimisticRemoveLibrary(LIST, 'lib-2');
  assert.notEqual(next, LIST);
  const ids = next!.items.map((e) => e.id);
  assert.ok(!ids.includes('lib-2'));
  assert.deepEqual(ids, ['lib-1', 'lib-3']);
  assert.equal(LIST.items.length, 3);
});

test('乐观移除：删除首/末项也正确', () => {
  assert.deepEqual(optimisticRemoveLibrary(LIST, 'lib-1')!.items.map((e) => e.id), ['lib-2', 'lib-3']);
  assert.deepEqual(optimisticRemoveLibrary(LIST, 'lib-3')!.items.map((e) => e.id), ['lib-1', 'lib-2']);
});

test('乐观移除：undefined / 非列表输入原样透传（不崩）', () => {
  assert.equal(optimisticRemoveLibrary(undefined, 'x'), undefined);
  const weird = { other: 1 } as never;
  assert.equal(optimisticRemoveLibrary(weird, 'x'), weird);
});

test('失败回滚：直接还原 previous 快照（含被删库 id）', () => {
  const failed = optimisticRemoveLibrary(LIST, 'lib-2');
  const restored = rollbackLibraryList(failed, LIST);
  assert.equal(restored, LIST);
  assert.deepEqual(restored!.items.map((e) => e.id), ['lib-1', 'lib-2', 'lib-3']);
});
