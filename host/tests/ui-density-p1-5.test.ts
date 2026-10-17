// P1-5（FE-UI-DENSITY-AUDIT §4）DOM 断言：库详情页「已加载 x/y」三处收敛为 hero 一处。
//
// 审计原文建议（§4 P1-5）：
//   LibraryDetailPage.tsx:83-86 构造 loadedLabel → :95 hero 展示、:168 工具条再算
//   一遍「已加载 x/y · 已全部加载」、:187-190 尾部 loadMoreHintCard 第三次展示
//   加载状态 ⇒ hero 保留一处；工具条只显示「当前结果 N 个」；尾部滚动提示只显示
//   「继续下滑自动加载」/「已全部展开」布尔态，不带数字。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（同 ui-density-p1-8.test.ts 理由）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-5.test.ts

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

const src = stripComments(read('src/pages/browse/LibraryDetailPage.tsx'));

test('P1-5: hero 的 loadedLabel 保留（加载计数唯一消费点）', () => {
  assert.match(src, /loadedLabel=\{loadedLabel\}/, 'hero 应继续消费 loadedLabel');
  assert.match(src, /const loadedLabel =/, 'loadedLabel 构造应保留');
});

test('P1-5: 工具条只显示「当前结果 N 个」，去「已加载 x/y / 已全部加载」尾巴', () => {
  assert.match(src, /当前结果：\{items\.length\} 个/, '工具条应保留当前结果计数');
  assert.ok(!src.includes('已全部加载'), '工具条「已全部加载 N 个」尾巴应删除');
  assert.ok(
    !/已加载 \$\{loadedCount\}\/\$\{vm\.totalItems\}` : ` · 已全部加载/.test(src),
    '工具条的条件加载尾巴应删除'
  );
});

test('P1-5: 尾部滚动提示只带布尔态，不带数字', () => {
  assert.ok(
    !src.includes('个条目已经全部展开了'),
    '尾部提示不应再重复 totalItems 数字'
  );
  assert.match(src, /已全部展开/, '终态应为「已全部展开」布尔态');
});
