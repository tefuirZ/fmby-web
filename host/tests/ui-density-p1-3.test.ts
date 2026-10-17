// P1-3（FE-UI-DENSITY-AUDIT §4）DOM 断言：媒体资源页 total 唯一化 + 瞬态指标板退场。
//
// 审计原文建议（§4 P1-3）：
//   ① 指标板（MediaItemMetricsBoard）：「资源总数」与页头重复，「当前页有覆盖/
//      可播放/待处理」随翻页乱跳 ⇒ 短期直接删除该节（筛选条已含 itemsCount）；
//   ② localOverrideCount 只算一次传入消费方；
//   ③ total 只保留页头一处（删筛选条的「总计 N 条」chip）。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（同 ui-density-p1-8.test.ts 理由）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-3.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

const pagePath = 'src/pages/manage/ManageMediaItemsPage.tsx';
const filtersPath = 'src/pages/manage/media-items/components/MediaItemFilters.tsx';
const boardPath = 'src/pages/manage/media-items/components/MediaItemMetricsBoard.tsx';

test('P1-3: 瞬态指标板整节退场（文件与导出一并清理）', () => {
  assert.equal(existsSync(join(repoRoot, boardPath)), false, 'MediaItemMetricsBoard.tsx 应删除');
  const page = stripComments(read(pagePath));
  assert.ok(!page.includes('MediaItemMetricsBoard'), '页面不应再引用指标板');
  const index = read('src/pages/manage/media-items/components/index.ts');
  assert.ok(!index.includes('MediaItemMetricsBoard'), 'components/index.ts 不应再导出指标板');
});

test('P1-3: total 全页唯一——只保留页头 meta 一处', () => {
  const page = read(pagePath);
  assert.match(
    page,
    /共 \{total\} 条资源/,
    '页头 meta 的「共 N 条资源」应保留（total 唯一消费点）'
  );
  const filters = stripComments(read(filtersPath));
  const iface = filters.slice(
    filters.indexOf('interface MediaItemFiltersProps'),
    filters.indexOf('}', filters.indexOf('interface MediaItemFiltersProps'))
  );
  assert.ok(!/\btotal:/.test(iface), '筛选条 props 不应再接收 total');
  assert.ok(!filters.includes('总计'), '筛选条不应再有「总计 N 条」chip（与页头重复）');
});

test('P1-3: localOverrideCount 只算一次（删内联重算）', () => {
  const page = read(pagePath);
  const occurrences = page.split('items.filter((item) => item.hasLocalOverride).length').length - 1;
  assert.equal(occurrences, 1, `hasLocalOverride 过滤应只出现 1 次；实测 ${occurrences} 次`);
  assert.match(page, /localOverrideCount=\{localOverrideCount\}/, '筛选条应消费同一变量');
});
