// FE-UI-2 P0 修复的红侧：P0-①（中控任务队列空壳/谎报空态/死链/假形状）+ P0-②（粗口文案）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/manage-overview-honesty.test.ts
//
// 为什么是**源码契约**断言而不是真 DOM：本卡修的是「不许谎报」——
//   ① 硬编码空数组（`const tasks = []`）是恒真谎言，肉眼看不出来（UI 显示得很「正常」）；
//   ② 空态文案把「没有数据」说成「全部完成」；
//   ③ 死链指向不存在的路由；
//   ④ 详情模态用**后端没有的字段**（假进度 / 假子项日志）编数据。
// 四条都能用**源码/路由表/契约**断言机械钉死，且改动本身就是源码级 ⇒ 断言与改动同层。
//
// ★rebase 后与 main 对齐的一处（2026-10-18）：main 的 P1-9 ① 已把
//   ActiveTaskQueueWidget + TaskDetailModal **整个从首屏拔除**（密度审计：
//   中控 13→10 块）。所以「首屏接线」不再是本卡的验收面——改钉两件事：
//   (a) 首屏**不得**再把空壳队列挂回来（回归钉）；
//   (b) 组件本体仍在仓内且**不再编造后端没有的字段**（将来重新挂载时也不会说谎）。
//
// ★诚实边界（不假装是浏览器测试）：本文件不断言渲染结果，只断言**接线与文案**；
//   「空态在真 DOM 里显示的字符串」由农场验收节点人工/自动化跑（见交付说明）。
//   这里只保证「坏代码进不来」，不保证「页面长什么样」。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/**
 * 剥掉注释后的源码（CSS block 注释 + 行注释）。
 *
 * ★为什么必须剥：修复说明里**会引用改前的坏字符串**（「改前是 X」），
 *   若不剥，断言会把「注释里提到粗口」误判成「UI 里还有粗口」——
 *   那会让任何人不敢在注释里记录改前原文，反而丢失审计痕迹。
 *   断言的目标是**会渲染给用户看的代码**，不是给人看的注释。
 */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const OVERVIEW_PAGE = 'host/src/pages/manage/ManageOverviewPage.tsx';
const OVERVIEW_INDEX = 'host/src/pages/manage/overview/index.ts';
const QUEUE_WIDGET = 'host/src/pages/manage/overview/components/ActiveTaskQueueWidget.tsx';
const TASK_MODAL = 'host/src/pages/manage/overview/components/TaskDetailModal.tsx';
const NAMING_HEADER = 'host/src/pages/manage/naming-rules/components/NamingRulesHeader.tsx';

// ─── P0-① 任务队列：不许恒空、不许谎报、不许死链、不许假形状 ────────────────

test('P0-①a：首屏不得渲染空壳任务队列（main P1-9 ① 已拔除，不许回归）', () => {
  const src = readCode(OVERVIEW_PAGE);
  assert.ok(
    !/<ActiveTaskQueueWidget/.test(src),
    '中控首屏不得再渲染 ActiveTaskQueueWidget（main 的 P1-9 ① 决策：首屏拔除空壳队列，任务域真面在任务中心）',
  );
  // 历史病灶钉死：无论谁再挂回来，都不许用硬编码空数组喂它
  assert.ok(
    !/const\s+tasks\s*:\s*ActiveTaskQueueItem\[\]\s*=\s*\[\]/.test(src),
    'ManageOverviewPage 不得再用 `const tasks: ActiveTaskQueueItem[] = []` 硬编码空数组（恒空 = 组件永远收不到数据）',
  );
});

test('P0-①b：空态文案不得谎报「全部完成」', () => {
  const src = readCode(QUEUE_WIDGET);
  // 改前原样：`所有挂载目录、海报与元数据已完成最新刮削与入库。`
  assert.ok(
    !src.includes('已完成最新刮削与入库'),
    '空态不得把「没有数据」说成「全部完成」（任务队列空闲 ≠ 全部刮削完成）',
  );
  assert.ok(
    !/所有[^"']*已完成/.test(src),
    '空态不得出现「所有…已完成」这类完成态断言（空态只能说明「暂无数据」）',
  );
});

test('P0-①c：「任务中心」链接必须指向真实路由', () => {
  const src = readCode(QUEUE_WIDGET);
  // 路由表唯一权威
  const router = read('host/src/app/router/index.tsx');
  const routes = new Set([...router.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]));
  assert.ok(routes.has('task-center'), '路由表应声明 task-center（真源 host/src/app/router/index.tsx）');

  // 改前死链：`to="/manage/tasks"`（tasks 不在路由表里）
  assert.ok(
    !src.includes('/manage/tasks'),
    '不得再指向不存在的 /manage/tasks（路由表只有 /manage/task-center）',
  );
  assert.ok(
    src.includes('/manage/task-center'),
    '任务中心链接必须指向 /manage/task-center（真实路由）',
  );
  // 死链不在路由表 ⇒ 反过来证「改前确实是死链」的前提成立
  assert.ok(!routes.has('tasks'), '路由表不应存在 tasks（证明 /manage/tasks 曾是死链）');
});

test('P0-①d：队列与详情模态不得再用后端没有的假形状字段', () => {
  // 改前原样：本地 `ActiveTaskQueueItem`（progressPercent / totalSubItems /
  // subItems / priority）——契约 TaskCenterItemRecord 里**没有**这些字段，
  // 只能靠编数据填满，假进度条 + 假子项日志。
  for (const [rel, name] of [
    [QUEUE_WIDGET, 'ActiveTaskQueueWidget'],
    [TASK_MODAL, 'TaskDetailModal'],
  ] as const) {
    const src = readCode(rel);
    assert.ok(
      /import type \{ TaskCenterItemRecord \}/.test(src) || /TaskCenterItemRecord/.test(src),
      `${name} 必须用契约真实形状 TaskCenterItemRecord（与 /manage/task-center 同一个 DTO）`,
    );
    for (const field of ['progressPercent', 'totalSubItems', 'subItems', 'priority']) {
      assert.ok(
        !src.includes(field),
        `${name} 不得再引用 \`${field}\`——后端 TaskCenterItemRecord 没有该字段，用到它只能是编数据`,
      );
    }
  }
});

// ─── P0-② 生产 UI 文案不得含粗口 ───────────────────────────────────────────

test('P0-②：命名刮削页头不得含粗口（改前「屁用没有」）', () => {
  const src = readCode(NAMING_HEADER);
  assert.ok(
    !src.includes('屁用没有'),
    'NamingRulesHeader 不得再含粗口「屁用没有」（生产 UI 文案）',
  );
  // 改后必须是「缓存 + 不依赖外链」的产品化表述（不准改成语义空话）
  assert.ok(
    /海报[^"']*本地缓存/.test(src),
    '改后文案须说明「海报落本地缓存」这一真实语义',
  );
  assert.ok(
    /不依赖[^"']*外链|外链可达性/.test(src),
    '改后文案须保留「不依赖第三方外链可达性」的原始语义（不是删词了事）',
  );
});

// ─── 回归护栏：不许「删了拉倒」 ────────────────────────────────────────────

test('护栏：组件本体仍在仓内且仍从 overview 导出（首屏不挂是 main 决策，不是删组件）', () => {
  const index = readCode(OVERVIEW_INDEX);
  assert.ok(
    /export \{ ActiveTaskQueueWidget \}/.test(index),
    'ActiveTaskQueueWidget 仍须从 manage/overview 导出（本体诚实化不能靠删文件交差）',
  );
  assert.ok(
    /export \{ TaskDetailModal \}/.test(index),
    'TaskDetailModal 仍须从 manage/overview 导出（本体诚实化不能靠删文件交差）',
  );
  assert.ok(read(QUEUE_WIDGET).length > 0, 'ActiveTaskQueueWidget.tsx 文件必须存在');
});
