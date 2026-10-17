// P1-4（FE-UI-DENSITY-AUDIT §4）DOM 断言：历史页同一计数只显示一次。
//
// 审计原文建议（§4 P1-4）：
//   HistoryPage.tsx:71 页头「共整理出 N 条记录」与 :126 工具条「当前结果：N 条」
//   为同值两项之和 ⇒ 删工具条那处，保留页头；工具条右侧改为展示「筛选生效中」
//   状态（仅当 typeFilter/timeRange/stateFilter ≠ all）。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（同 ui-density-p1-8.test.ts 理由）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-4.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // host/
const read = (p) => readFileSync(join(repoRoot, p), 'utf8');

/** 剔除 JSX 块注释与行注释后再断言（防实现注释里的字符串触发假红）。 */
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const src = stripComments(read('src/pages/browse/HistoryPage.tsx'));

test('P1-4: 页头「共整理出 N 条记录」保留（计数唯一消费点）', () => {
  assert.match(src, /共整理出 \{allItems\.length\} 条记录/, '页头计数应保留');
});

test('P1-4: 工具条「当前结果：N 条」删除（与页头同值重复）', () => {
  assert.ok(!src.includes('当前结果：'), '工具条同值计数应删除');
  assert.ok(
    !src.includes('continueWatching.length + recentlyPlayed.length + completed.length'),
    '三项之和的重复计算应一并退场'
  );
});

test('P1-4: 工具条改为「筛选生效中」状态指示（仅当任一筛选 ≠ all）', () => {
  assert.match(src, /筛选生效中/, '应有「筛选生效中」指示');
  assert.match(
    src,
    /typeFilter !== 'all' \|\| timeRange !== 'all' \|\| stateFilter !== 'all'/,
    '指示应条件渲染（任一筛选生效才显示）'
  );
});
