// E3 前端终验 · 任务中心「媒体 / 时间 / 尝试次数」文案与后端口径对账。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/task-center-copy-truth.test.ts
//
// 为什么要有这个文件：E3 真栈终验读后端源码时发现三处**前端在撒谎**——
//   ① `mediaTitle ?? '系统级任务'`：后端 `media_title` **恒 None**（V2 task_definition
//      无媒体标题列），于是所有任务（包括明明绑了 mediaItemId 的刮削）都被说成
//      「系统级任务」；
//   ② `formatRelativeTime(updatedAt)`：后端 `updated_at` 是 `Option`，**在途任务为 null**
//      ⇒ 兜底「刚刚更新」，把「八小时前开始、至今没结束」说成「刚刚更新」；
//   ③ `retryCount` 显示成「重试 N 次」：后端这个槽位填的是 `attempt`（首次执行即 1）
//      ⇒ 从没重试过的任务也显示「重试 1 次」。
//
// 三条都不是「样式问题」，而是**说错事实**。断言目标：判据用对字段 + 没有终态时刻就照实说。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getTaskMediaLabel, getTaskTimeHint } from '../src/pages/manage/task-center/utils.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** 剥注释（注释里会引用改前的坏写法，不能算"代码里还有"）。 */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const LIST = 'host/src/pages/manage/task-center/components/TaskCenterList.tsx';
const BOARD = 'host/src/pages/manage/task-center/components/TaskCenterStreamBoard.tsx';
const DRAWER = 'host/src/pages/manage/task-center/components/TaskCenterDetailDrawer.tsx';

// ─── ① 媒体文案：判据必须是 mediaItemId，不是恒空的 mediaTitle ──────────────

test('①a：有 mediaItemId 但无 mediaTitle ⇒ 不得说成「系统级任务」', () => {
  const label = getTaskMediaLabel({ mediaItemId: 'task-media-42', mediaTitle: null });
  assert.ok(
    !label.includes('系统级任务'),
    `绑定了媒体的任务不得显示「系统级任务」（实际 "${label}"）——后端 media_title 恒 null，mediaItemId 才是判据`,
  );
  assert.ok(label.includes('task-media-42'), `媒体文案应带上 mediaItemId 以便对账（实际 "${label}"）`);
});

test('①b：两者都无 ⇒ 才是系统级任务', () => {
  assert.equal(getTaskMediaLabel({ mediaItemId: null, mediaTitle: null }), '系统级任务');
  assert.equal(getTaskMediaLabel({}), '系统级任务');
});

test('①c：有 mediaTitle ⇒ 直接用标题（后端补齐标题列后自动生效）', () => {
  assert.equal(getTaskMediaLabel({ mediaItemId: 'x', mediaTitle: '沙丘 2' }), '沙丘 2');
});

test('①d：三处组件不得再用 `mediaTitle ?? 「系统级任务」/类别名` 判类别', () => {
  // 允许 `mediaTitle ?? id`（拿 id 兜底是诚实的）；禁止的是拿**类别名/固定文案**兜底。
  const banned = [/mediaTitle\s*\?\?\s*['"]系统级任务['"]/, /mediaTitle\s*\?\?\s*getCategoryLabel\(/];
  for (const rel of [LIST, BOARD, DRAWER]) {
    const src = readCode(rel);
    for (const re of banned) {
      assert.ok(
        !re.test(src),
        `${rel}: 不得用 \`mediaTitle ?? 「系统级任务」/类别名\` 兜底——该字段后端恒 null，兜底文案会把所有任务都说成同一类`,
      );
    }
  }
});

// ─── ② 时间：没有终态时刻就照实说，不许「刚刚更新」 ─────────────────────────

test('②a：updatedAt 缺失 ⇒ 说「尚无终态时刻」，不许「刚刚更新」', () => {
  const hint = getTaskTimeHint(null);
  assert.ok(!hint.includes('刚刚'), `在途任务没有终态时刻，不得说「${hint}」`);
  assert.ok(hint.includes('尚无'), `应照实说「尚无终态时刻」（实际 "${hint}"）`);
  assert.equal(getTaskTimeHint(undefined), hint, 'undefined 与 null 同口径');
});

test('②b：updatedAt 有值 ⇒ 仍是相对时间（不改成死文案）', () => {
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.ok(/分钟|刚刚/.test(getTaskTimeHint(recent)), getTaskTimeHint(recent));
});

test('②c：契约层面 updatedAt 必须按「可能没有」声明（后端 Option）', () => {
  const types = read('shared/src/contracts/manage/task-center/types.ts');
  assert.ok(
    /updatedAt\?:\s*string/.test(types),
    'TaskCenterItemRecord.updatedAt 必须是可选（后端 `updated_at: Option<i64>`，在途任务为 null）',
  );
  const api = read('shared/src/contracts/manage/task-center/api.ts');
  assert.ok(
    /updated_at\?:\s*string\s*\|\s*null/.test(api),
    'RawTaskCenterItem.updated_at 必须允许 null（后端 Option 序列化为 null）',
  );
  assert.ok(
    /updatedAt:\s*raw\.updated_at\s*\?\?\s*undefined/.test(api),
    'mapper 必须把 null 归一成 undefined（不许把 null 硬塞进「非空」类型）',
  );
});

// ─── ③ 尝试次数：attempt ≠ 重试次数 ─────────────────────────────────────────

test('③a：列表/抽屉不得把 attempt 标成「重试」', () => {
  const list = readCode(LIST);
  const drawer = readCode(DRAWER);
  assert.ok(
    !list.includes('重试次数'),
    '列表不得出现「重试次数」（后端该槽位是 attempt，首次执行即 1）',
  );
  assert.ok(list.includes('<th>尝试</th>'), '列表列头应为「尝试」');
  assert.ok(
    !drawer.includes('重试次数'),
    '详情抽屉不得出现「重试次数」标签（同口径）',
  );
  assert.ok(drawer.includes('尝试次数'), '详情抽屉应标「尝试次数」');
});

test('③b：流式行走卡不得写「重试 N 次」（attempt 恒 ≥1 ⇒ 每行都在说没发生过的事）', () => {
  const board = readCode(BOARD);
  assert.ok(
    !/重试\s*\{/.test(board),
    '流式行走卡不得渲染「重试 {n} 次」——后端 retry_count = attempt，首次执行即 1，等于每行都谎报重试过',
  );
  assert.ok(/尝试\s*\{/.test(board), '应照实写「尝试 {n} 次」');
});

test('③c：摘要列/区块不得把 idempotency key 标成「摘要」', () => {
  const list = readCode(LIST);
  const drawer = readCode(DRAWER);
  assert.ok(!list.includes('<th>摘要</th>'), '列表列头不得是「摘要」（后端 summary 当前恒为 idempotency_key）');
  assert.ok(list.includes('<th>任务键</th>'), '列表列头应为「任务键」');
  assert.ok(!drawer.includes('摘要与动作'), '抽屉分区标题不得是「摘要与动作」');
  assert.ok(drawer.includes('任务键与动作'), '抽屉分区标题应为「任务键与动作」');
});
