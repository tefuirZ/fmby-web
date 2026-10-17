// P1-2（FE-UI-DENSITY-AUDIT §4）DOM 断言：任务中心同一 state 不再绑两个类别控件。
//
// 审计原文建议（§4 P1-2）：
//   「分类总览」卡片组（TaskCenterCategoryGroups）与「筛选与列表」区的类别 select
//   （TaskCenterFilters）绑同一个 categoryFilter ⇒ 二选一保留。
//   本卡采用审计选项 A：保留卡片组（更直观、带 KPI 数字），删 select 的类别项；
//   卡片组补「全部」复位 chip；选中态统一为仓内既有 chip[aria-pressed] 词汇
//   （ManagePages.module.css 已定义 .chip[aria-pressed='true']，与审计
//   「统一 chip 词汇」意图一致，且零新增 CSS）。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（同 ui-density-p1-8.test.ts 理由）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-2.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // host/
const read = (p) => readFileSync(join(repoRoot, p), 'utf8');

const filtersPath = 'src/pages/manage/task-center/components/TaskCenterFilters.tsx';
const groupsPath = 'src/pages/manage/task-center/components/TaskCenterCategoryGroups.tsx';
const pagePath = 'src/pages/manage/ManageTaskCenterPage.tsx';

test('P1-2: 筛选区不再渲染类别 select（双控件之一被删）', () => {
  const src = read(filtersPath);
  assert.ok(!src.includes('全部类别'), '「全部类别」select 项应删除（与分类总览卡片组重复）');
  assert.ok(
    !/CATEGORY_ORDER/.test(src),
    'CATEGORY_ORDER 仅用于类别 select 选项，删除 select 后不应再被引用'
  );
  // select 仍存在（状态/时间范围还需要），但只绑 statusFilter / rangePreset
  assert.ok(src.includes('<select'), '状态/范围 select 应保留');
  assert.ok(!/value=\{categoryFilter\}/.test(src), '不应再有 select 绑定 categoryFilter');
});

test('P1-2: TaskCenterFilters 不再接收 categoryFilter 死 prop', () => {
  const src = read(filtersPath);
  const iface = src.slice(
    src.indexOf('interface TaskCenterFiltersProps'),
    src.indexOf('}', src.indexOf('interface TaskCenterFiltersProps'))
  );
  assert.ok(iface.length > 0, '应存在 TaskCenterFiltersProps 接口');
  assert.ok(
    !iface.includes('categoryFilter'),
    'props 接口应删掉 categoryFilter（不留死 prop）'
  );
  const page = read(pagePath);
  // 父页面仍持有该 state（卡片组用），但不再传给 Filters
  const filtersCall = page.slice(page.indexOf('<TaskCenterFilters'), page.indexOf('/>', page.indexOf('<TaskCenterFilters')));
  assert.ok(
    !filtersCall.includes('categoryFilter'),
    '父页面调用 TaskCenterFilters 不应再传 categoryFilter'
  );
});

test('P1-2: 分类总览卡片组补「全部」复位 chip', () => {
  const src = read(groupsPath);
  assert.ok(src.includes("setCategoryFilter('all')"), '应存在一键复位到全部类别');
  assert.ok(src.includes('aria-pressed'), '复位/选中态应使用 chip[aria-pressed] 词汇');
});

test('P1-2: 卡片组按钮统一 chip 词汇（弃 secondary/ghost 双轨）', () => {
  const src = read(groupsPath);
  assert.ok(
    !src.includes('styles.secondaryButton') && !src.includes('styles.ghostButton'),
    '类别按钮应统一为 styles.chip + aria-pressed'
  );
  assert.ok(src.includes('styles.chip'), '应使用仓内统一 chip 词汇');
});
