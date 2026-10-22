// E3 前端半边 · 纯函数层（无浏览器，node:test 直跑）。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/task-center-streaming.unit.test.ts
//
// 与 task-center-streaming.dom.test.ts 的分工：
//   本文件 = 纯逻辑（reduce / 文案 / 阈值 / 批次合并去重），确定性、快；
//   dom 文件 = 真计时线（≤300ms / 3s / append 计数），需要 Chromium。
//
// ★「测不出」项（诚实）：WS 真推送（§9）在本轮**测不出** —— 后端
//   `PlaybackRealtimeEventType` 只有 7 类 playback 事件（crates/fmby-v2-application/
//   src/playback/realtime.rs:37-48），**无 task-center 事件**。前端本轮只把
//   `subscribeBatches` 做成注入式 seam（真页面可接 WS、探针可注入假批次），
//   「WS 帧到达 ⇒ UI 真更新」要等后端加事件后才可测。已在交付说明登记。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BATCH_DELAY_MS,
  createPollingStream,
} from '../src/pages/manage/task-center/hooks/streamPolling';
import {
  STALL_THRESHOLD_MS,
  buildStreamStatusText,
  mergeBatch,
  nextStatusAfterBatch,
  type TaskCenterStreamState,
  type TaskCenterStreamBatch,
} from '../src/pages/manage/task-center/hooks/useTaskCenterStream';

function baseState(patch: Partial<TaskCenterStreamState> = {}): TaskCenterStreamState {
  return {
    status: 'loading',
    items: [],
    total: 0,
    hasMore: false,
    errorMessage: null,
    ...patch,
  };
}

// ─── §6 文案契约：进行中 / 完成 / 空 三态可辨 ──────────────────────────────

test('§6：进行中文案 = 「已加载 N 条 · 仍在加载…」', () => {
  assert.equal(
    buildStreamStatusText({ status: 'streaming', loaded: 1 }),
    '已加载 1 条 · 仍在加载…',
  );
  assert.equal(
    buildStreamStatusText({ status: 'streaming', loaded: 4 }),
    '已加载 4 条 · 仍在加载…',
  );
});

test('§6：完成文案 = 「共 N 条」（且不含「仍在加载」）', () => {
  const done = buildStreamStatusText({ status: 'done', loaded: 4 });
  assert.equal(done, '共 4 条');
  assert.ok(!done.includes('仍在加载'), '完成后不得残留「仍在加载…」');
});

test('§6：空态文案 = 「当前没有运行中的任务」（与完成态不同文）', () => {
  const empty = buildStreamStatusText({ status: 'empty', loaded: 0 });
  assert.equal(empty, '当前没有运行中的任务');
  assert.notEqual(
    empty,
    buildStreamStatusText({ status: 'done', loaded: 4 }),
    '空态与完成态必须是不同文案（否则用户分不清「真的没任务」与「任务已全部到手」）',
  );
});

test('★自查抓到的谎报：loading 首帧不得显示「当前没有运行中的任务」', () => {
  // 只按 loaded=0 && hasMore=false 判空 ⇒ 首帧（骨架还在跑）就说「没有任务」，
  // 与 FE-UI-2 P0-① 同一病灶（本卡实测轨迹 n=0 那一格正是这句）。
  assert.equal(
    buildStreamStatusText({ status: 'loading', loaded: 0 }),
    '正在装载任务…',
    'loading 态只能说「正在装载」，不能替后端断言「没有任务」',
  );
  assert.notEqual(
    buildStreamStatusText({ status: 'loading', loaded: 0 }),
    '当前没有运行中的任务',
  );
});

// ─── 每批 append：保序、累计、去重 ────────────────────────────────────────

const batch = (
  ids: string[],
  hasMore = false,
): TaskCenterStreamBatch => ({
  items: ids.map((id) => ({
    id,
    category: 'Scan',
    status: 'Running',
    summary: `任务 ${id}`,
    mediaTitle: null,
    updatedAt: '2026-10-17T00:00:00Z',
    retryCount: 0,
  })),
  total: ids.length,
  hasMore,
});

test('每批 append：后批接在前批之后（不覆盖）', () => {
  let state = baseState({ status: 'loading' });
  state = mergeBatch(state, batch(['b1'], true));
  state = mergeBatch(state, batch(['b2', 'b3'], true));
  state = mergeBatch(state, batch(['b4'], false));
  assert.deepEqual(
    state.items.map((i) => i.id),
    ['b1', 'b2', 'b3', 'b4'],
    'append 必须保序累计（卡面 §6 / 验收 c）',
  );
  assert.equal(state.status, 'done', '末批 hasMore=false ⇒ 状态转 done');
});

test('每批 append：同一任务重复推送不产生重复行（WS 重放/重连）', () => {
  let state = baseState();
  state = mergeBatch(state, batch(['b1', 'b2'], true));
  state = mergeBatch(state, batch(['b2', 'b3'], true)); // b2 重放
  assert.deepEqual(
    state.items.map((i) => i.id),
    ['b1', 'b2', 'b3'],
    '重复 id 必须去重（WS 重连重放是真实场景）',
  );
});

test('末批 hasMore=false ⇒ 状态转 done（顶部文案随之变「共 N 条」）', () => {
  const state = mergeBatch(baseState({ status: 'streaming' }), batch(['b1'], false));
  assert.equal(state.status, 'done');
  assert.equal(buildStreamStatusText({ status: state.status, loaded: state.items.length }), '共 1 条');
});

// ─── 三态机：loading / streaming / stalled / done / empty / error ──────────

test('三态机：首块未到 = loading（骨架期）；首块到且 hasMore = streaming', () => {
  assert.equal(nextStatusAfterBatch(baseState({ status: 'loading' }), batch(['b1'], true)), 'streaming');
  assert.equal(nextStatusAfterBatch(baseState({ status: 'streaming' }), batch(['b1'], true)), 'streaming');
});

test('三态机：首块即为空且无更多 = empty（明确无数据，不是 stalled）', () => {
  const state = mergeBatch(baseState({ status: 'loading' }), batch([], false));
  assert.equal(state.status, 'empty', '后端明确返回 0 条 ⇒ empty（不得误报卡死）');
  assert.equal(buildStreamStatusText({ status: state.status, loaded: 0 }), '当前没有运行中的任务');
});

test('§7：stall 阈值 = 3000ms（卡面给定 3s）', () => {
  assert.equal(STALL_THRESHOLD_MS, 3000, '卡面 §7 的阈值是 3s，不得私自改');
});

test('三态机：error 态带原因（不吞成空）', () => {
  const state: TaskCenterStreamState = baseState({
    status: 'error',
    errorMessage: '任务中心加载失败：503',
  });
  assert.equal(state.status, 'error');
  assert.match(state.errorMessage ?? '', /503/, 'error 态须透传后端原因');
});

// ─── §4 降级形态：分页轮询也要「按批出」，末批必须 hasMore=false ────────────

test('轮询：首批 hasMore 由「累计 < total 且本页非空」推得', async () => {
  const rows = (n: number, off = 0) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id${off + i}`,
      category: 'Scan' as const,
      status: 'Running' as const,
      summary: 's',
      updatedAt: '2026-10-17T00:00:00Z',
      retryCount: 0,
    }));
  const stream = createPollingStream({
    fetchPage: async (page) => ({ items: page === 1 ? rows(2) : [], total: 5 }),
    batchDelayMs: 1,
  });
  const first = await stream.loadFirstBatch();
  assert.equal(first.items.length, 2, '首批 2 条');
  assert.equal(first.hasMore, true, 'total=5 只拿到 2 ⇒ hasMore=true');
});

test('轮询：只有一页数据时首批即 hasMore=false（顶部不得挂「仍在加载…」）', async () => {
  const stream = createPollingStream({
    fetchPage: async () => ({
      items: Array.from({ length: 3 }, (_, i) => ({
        id: `x${i}`,
        category: 'Scan' as const,
        status: 'Running' as const,
        summary: 's',
        updatedAt: '2026-10-17T00:00:00Z',
        retryCount: 0,
      })),
      total: 3,
    }),
    batchDelayMs: 1,
  });
  const first = await stream.loadFirstBatch();
  assert.equal(first.hasMore, false, '拿满 total ⇒ 末批必须 hasMore=false（否则无限转圈）');
});

test('轮询：unsubscribe 后不再推批（页面卸载不留定时器）', async () => {
  let calls = 0;
  const stream = createPollingStream({
    fetchPage: async (page) => ({
      items: Array.from({ length: 2 }, (_, i) => ({
        id: `p${page}-${i}`,
        category: 'Scan' as const,
        status: 'Running' as const,
        summary: 's',
        updatedAt: '2026-10-17T00:00:00Z',
        retryCount: 0,
      })),
      total: 100,
    }),
    batchDelayMs: 5,
  });
  await stream.loadFirstBatch();
  const cancel = stream.subscribeBatches(() => { calls += 1; }, () => {});
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(calls > 0, `未取消前应在推批（实际 ${calls} 次）`);
  cancel();
  const before = calls;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(calls, before, `取消订阅后不得再推批（前 ${before}，后 ${calls}）`);
});

test('轮询：默认批间隔 = 600ms（增量肉眼可见，不是瞬间全到）', () => {
  assert.equal(DEFAULT_BATCH_DELAY_MS, 600);
});

test('轮询：取消订阅后重试仍会继续推（stopped 必须随重开清掉）', async () => {
  // 回归守卫：stopped 不 reset ⇒ 「取消 → 重试」后一条批也不推、UI 永远停在首块
  // —— 正是卡面「不能空」要禁的形态，且不抛错，只有真计时能发现。
  const stream = createPollingStream({
    fetchPage: async (page) => ({
      items: Array.from({ length: 2 }, (_, i) => ({
        id: `r${page}-${i}`,
        category: 'Scan' as const,
        status: 'Running' as const,
        summary: 's',
        updatedAt: '2026-10-17T00:00:00Z',
        retryCount: 0,
      })),
      total: 100,
    }),
    batchDelayMs: 5,
  });
  await stream.loadFirstBatch();
  stream.subscribeBatches(() => {}, () => {})();
  await stream.loadFirstBatch();
  let after = 0;
  stream.subscribeBatches(() => { after += 1; }, () => {});
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(after > 0, `重试后必须继续推批（实际 ${after} 次）`);
});

// ─── §5 页面接线契约：真实页面不得再「整页转圈」 ────────────────────────────
//
// ★为什么单独一组：DOM 用例测的是 board/hook 的行为；「页面有没有真的用上它」
//   是另一件事——改前的 ManageTaskCenterPage 用 isPending 整页早退成
//   FeedbackState loading（纯转圈 = 卡面 §5 明令禁止的形态），若只改组件不改页面，
//   用户点进去看到的还是一屏转圈。这组断言把「页面已接线」钉住（源码级，无需浏览器）。

test('§5 页面接线：任务中心不得再有「整页 loading 早退」', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(
    new URL('../src/pages/manage/ManageTaskCenterPage.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    /<TaskCenterStreamBoard/.test(src),
    '页面必须渲染 TaskCenterStreamBoard（骨架/逐批/降级/空态的承载面）',
  );
  assert.ok(
    /useTaskCenterStream\(/.test(src),
    '页面必须接 useTaskCenterStream（真数据装配），不能只挂个空壳组件',
  );
  // 改前的整页早退形态：isPending ⇒ 直接 return 一个 loading FeedbackState
  assert.ok(
    !/listQuery\.isPending/.test(src),
    '不得再用 listQuery.isPending 做整页早退（纯转圈 = 卡面 §5 禁止项）',
  );
});

test('§4 降级接线：WS 无 task-center 事件 ⇒ 页面用分页轮询适配器供批', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(
    new URL('../src/pages/manage/ManageTaskCenterPage.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    /createPollingStream\(/.test(src),
    '页面必须用 createPollingStream（WS 不可用时的分页降级，依然分批出）',
  );
});

test('§3 两条取数路径的失败都有明确态（不留「空壳=未知」）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(
    new URL('../src/pages/manage/ManageTaskCenterPage.tsx', import.meta.url),
    'utf8',
  );
  // 首页失败 ⇒ board 的 error 态（tc-error 由探针在 DOM 用例侧覆盖）
  assert.ok(/errorMessage=\{stream\.errorMessage\}/.test(src), '流式失败必须把原因传给 board');
  // 翻页失败 ⇒ 整页 error（我一度把它窄化成只看 overviewQuery，漏了这条 ⇒ 补守卫）
  assert.ok(
    /pagedQueryFailed/.test(src) && /isStreamingFirstPage\s*&&\s*listQuery\.isError|!\s*isStreamingFirstPage\s*&&\s*listQuery\.isError/.test(src),
    '第 2 页起的分页 REST 失败必须有明确错误态（否则只剩一张空表 = 空壳）',
  );
});

test('§6 进入动效：新行有动效，且 prefers-reduced-motion 下可关（卡面「可关闭 ✓」）', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(
    new URL('../src/pages/manage/task-center/components/TaskCenterStreamBoard.module.css', import.meta.url),
    'utf8',
  );
  assert.ok(/@keyframes tc-row-in/.test(css), '须有行进入动效的关键帧');
  assert.ok(/\.row \{\s*\n\s*animation:/.test(css), '真行 .row 须挂进入动效');
  // 可关：系统级 reduced-motion 必须把动画关掉（不另造 UI 开关，YAGNI）
  const rm = css.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
  assert.ok(/\.row \{[^}]*animation: none/.test(rm), 'reduced-motion 下 .row 动效须关闭');
});

test('★第二个谎报口子：loaded=0 但后端 total>0 不得说「没有运行中的任务」', () => {
  assert.equal(
    buildStreamStatusText({ status: 'done', loaded: 0, total: 5 }),
    '未取回任务数据（后端口径共 5 条）',
  );
  assert.notEqual(
    buildStreamStatusText({ status: 'done', loaded: 0, total: 5 }),
    '当前没有运行中的任务',
    '与后端自己报的 total 自相矛盾就是谎报',
  );
});
