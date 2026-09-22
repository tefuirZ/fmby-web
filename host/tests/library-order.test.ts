// FE-LIBRARY-ORDER-UI：媒体库排序纯函数 + 契约 wire 单测。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { moveLibraryIds } from '../src/pages/manage/libraries/hooks/libraryOrder';

const IDS = ['lib-1', 'lib-2', 'lib-3', 'lib-4'];

test('上移：把第 3 项提到第 2 位', () => {
  assert.deepEqual(moveLibraryIds(IDS, 'lib-3', -1), ['lib-1', 'lib-3', 'lib-2', 'lib-4']);
});

test('下移：把第 1 项推到第 2 位', () => {
  assert.deepEqual(moveLibraryIds(IDS, 'lib-1', 1), ['lib-2', 'lib-1', 'lib-3', 'lib-4']);
});

test('首项移到上移：原序副本，不环绕', () => {
  const next = moveLibraryIds(IDS, 'lib-1', -1);
  assert.deepEqual(next, IDS);
  assert.notEqual(next, IDS, '应返回新副本（不原地改）');
});

test('末项下移：原序副本，不环绕', () => {
  assert.deepEqual(moveLibraryIds(IDS, 'lib-4', 1), IDS);
});

test('空列表 / 不存在 id：返回副本不崩', () => {
  assert.deepEqual(moveLibraryIds([], 'x', -1), []);
  const next = moveLibraryIds(IDS, 'missing', 1);
  assert.deepEqual(next, IDS);
  assert.notEqual(next, IDS);
});

test('连续上移到底再不可越过（边界稳定）', () => {
  let ids = IDS;
  ids = moveLibraryIds(ids, 'lib-4', -1); // -> [...lib-3, lib-4]
  ids = moveLibraryIds(ids, 'lib-4', -1);
  ids = moveLibraryIds(ids, 'lib-4', -1);
  ids = moveLibraryIds(ids, 'lib-4', -1); // 已首位，再上移不动
  assert.deepEqual(ids, ['lib-4', 'lib-1', 'lib-2', 'lib-3']);
});
