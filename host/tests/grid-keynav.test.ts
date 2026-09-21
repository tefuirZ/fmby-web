// FE-LIST-KEYNAV：网格方向键漫游算法单测（可证伪）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 覆盖：二维移动（←→↑↓）、行内 Home/End、边界停止（不环绕/不越界）、
// 末行不满时的 ↓ 语义、虚拟化下的分页边界（触底请求更多但焦点不动）、
// key 映射。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nextGridIndex,
  shouldRequestMore,
  gridDirectionForKey,
  type GridKeyNavRequest,
} from '../src/features/a11y/useGridRovingFocus.ts';

/** items=7, columns=3 → 行: [0,1,2][3,4,5][6] */
const base: GridKeyNavRequest = {
  activeIndex: 0,
  itemCount: 7,
  columns: 3,
  hasMore: false,
};

test('nextGridIndex：无活动项时任何方向落到首项', () => {
  for (const dir of ['left', 'right', 'up', 'down', 'home', 'end'] as const) {
    assert.equal(nextGridIndex({ ...base, activeIndex: -1 }, dir), 0);
  }
});

test('nextGridIndex：空列表不动', () => {
  for (const dir of ['left', 'right', 'up', 'down', 'home', 'end'] as const) {
    assert.equal(nextGridIndex({ ...base, itemCount: 0 }, dir), -1);
  }
});

test('nextGridIndex：← → 在同一行内移动，行首/行尾停在边界（不跨行、不环绕）', () => {
  assert.equal(nextGridIndex({ ...base, activeIndex: 1 }, 'left'), 0);
  assert.equal(nextGridIndex({ ...base, activeIndex: 0 }, 'left'), 0, '行首 ← 停住');
  assert.equal(nextGridIndex({ ...base, activeIndex: 1 }, 'right'), 2);
  assert.equal(nextGridIndex({ ...base, activeIndex: 2 }, 'right'), 2, '行尾 → 停住（不跨到下行）');
});

test('nextGridIndex：↑ ↓ 按列移动一整行', () => {
  assert.equal(nextGridIndex({ ...base, activeIndex: 4 }, 'up'), 1);
  assert.equal(nextGridIndex({ ...base, activeIndex: 4 }, 'down'), 6, '4 的下一行同列是 7，不存在 → 落末项 6');
  assert.equal(nextGridIndex({ ...base, activeIndex: 1 }, 'down'), 4);
  assert.equal(nextGridIndex({ ...base, activeIndex: 0 }, 'up'), 0, '首行 ↑ 停住');
});

test('nextGridIndex：↓ 到末行不满时落到末项，不越界', () => {
  // 第三行只有 index 6。从 3/4/5 下移：3→6, 4→6（本列无 7）, 5→6
  assert.equal(nextGridIndex({ ...base, activeIndex: 3 }, 'down'), 6);
  assert.equal(nextGridIndex({ ...base, activeIndex: 4 }, 'down'), 6, '本列下行不存在 → 落末项');
  assert.equal(nextGridIndex({ ...base, activeIndex: 5 }, 'down'), 6);
  assert.equal(nextGridIndex({ ...base, activeIndex: 6 }, 'down'), 6, '末项 ↓ 停住');
});

test('nextGridIndex：→ 不越过末项（末行不满时）', () => {
  assert.equal(nextGridIndex({ ...base, activeIndex: 6 }, 'right'), 6);
});

test('nextGridIndex：Home/End 在当前行内跳转', () => {
  assert.equal(nextGridIndex({ ...base, activeIndex: 4 }, 'home'), 3, '第二行行首');
  assert.equal(nextGridIndex({ ...base, activeIndex: 3 }, 'end'), 5, '第二行行尾');
  // 末行不满：End 不能越过末项
  assert.equal(nextGridIndex({ ...base, activeIndex: 6 }, 'end'), 6);
});

test('nextGridIndex：单列（一维列表/横滚轨道）时 ←→↑↓ 均为逐项移动', () => {
  // 语义：一维轨道里按 → 应看下一张卡。若沿用二维「行内列」判断
  // （col < cols-1，cols=1 时恒假）会让 ←/→ 完全不动 → 漫游失效。
  const single: GridKeyNavRequest = { activeIndex: 2, itemCount: 5, columns: 1, hasMore: false };
  assert.equal(nextGridIndex(single, 'up'), 1);
  assert.equal(nextGridIndex(single, 'down'), 3);
  assert.equal(nextGridIndex(single, 'left'), 1);
  assert.equal(nextGridIndex(single, 'right'), 3);
  // 边界不环绕
  assert.equal(nextGridIndex({ ...single, activeIndex: 0 }, 'left'), 0);
  assert.equal(nextGridIndex({ ...single, activeIndex: 4 }, 'right'), 4);
});

test('nextGridIndex：columns<=0 时按 1 列处理（防御，不崩）', () => {
  assert.equal(nextGridIndex({ activeIndex: 1, itemCount: 3, columns: 0, hasMore: false }, 'up'), 0);
});

test('shouldRequestMore：仅触底且 hasMore 时为真；无更多/非触底为假', () => {
  assert.equal(shouldRequestMore({ ...base, activeIndex: 6, hasMore: true }, 'down'), true);
  assert.equal(shouldRequestMore({ ...base, activeIndex: 6, hasMore: true }, 'end'), true);
  assert.equal(shouldRequestMore({ ...base, activeIndex: 6, hasMore: true }, 'right'), true);
  assert.equal(
    shouldRequestMore({ ...base, activeIndex: 6, hasMore: true }, 'up'),
    false,
    '向上不触发加载',
  );
  assert.equal(
    shouldRequestMore({ ...base, activeIndex: 6, hasMore: false }, 'down'),
    false,
    '无更多则不请求',
  );
  assert.equal(
    shouldRequestMore({ ...base, activeIndex: 3, hasMore: true }, 'down'),
    false,
    '未触底不请求',
  );
  assert.equal(shouldRequestMore({ ...base, itemCount: 0, hasMore: true }, 'down'), false);
});

test('gridDirectionForKey：识别六键，其余返回 null', () => {
  assert.equal(gridDirectionForKey('ArrowLeft'), 'left');
  assert.equal(gridDirectionForKey('ArrowRight'), 'right');
  assert.equal(gridDirectionForKey('ArrowUp'), 'up');
  assert.equal(gridDirectionForKey('ArrowDown'), 'down');
  assert.equal(gridDirectionForKey('Home'), 'home');
  assert.equal(gridDirectionForKey('End'), 'end');
  assert.equal(gridDirectionForKey('Tab'), null);
  assert.equal(gridDirectionForKey('Enter'), null);
  assert.equal(gridDirectionForKey('a'), null);
});

test('组合不变量：任何方向的结果都落在 [0, itemCount-1] 内', () => {
  for (const itemCount of [1, 2, 5, 7, 12, 13]) {
    for (const columns of [1, 2, 3, 5]) {
      for (const activeIndex of [-1, 0, 1, 4, itemCount - 1]) {
        for (const dir of ['left', 'right', 'up', 'down', 'home', 'end'] as const) {
          const r = nextGridIndex({ activeIndex, itemCount, columns, hasMore: false }, dir);
          assert.ok(
            r >= 0 && r < itemCount,
            `越界: itemCount=${itemCount} columns=${columns} active=${activeIndex} dir=${dir} → ${r}`,
          );
        }
      }
    }
  }
});
