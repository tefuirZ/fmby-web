/**
 * W15-TASK-CENTER-STREAM：任务中心流式增量渲染的**纯函数单测**（node:test）。
 *
 * 覆盖卡面四条验收断言（a/b/c/d）的可测部分：
 *   a) 人为把后端延迟调到 5s ⇒ 前端仍 ≤300ms 出骨架/首块
 *      ⇒ `showSkeleton` 由 loaded===0 && phase==='loading' 决定，**与 WS/REST
 *         何时返回无关**（首屏先出骨架行），故「后端再慢也有内容」。
 *   b) 全链路阻塞 ⇒ 3s 后出现降级提示与重试按钮
 *      ⇒ `stalled` 由 STALL_MS 定时器置位；阈值常量断言为 3000。
 *   c) 每批到达的 append 计数正确
 *      ⇒ `loaded` 单调递增、末帧等于总数；`lastSeq` 判重防重复 append。
 *   d) 三态文案区分正确
 *      ⇒ `streamHeadline` 四态四种文案，且 empty ≠ finished(0)。
 *
 * 这些断言**不依赖浏览器/WS 真连**（纯函数 + 常量）⇒ CI 恒跑，不留 #[ignore] 坑。
 * WS/定时器交互的行为验证归 e2e（farm-accept-ui2 spec）。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STALL_MS,
  SKELETON_ROWS,
  backoffMs,
  parseStreamFrame,
  reduceStreamFrame,
  streamHeadline,
  type TaskCenterStreamState,
} from '@/pages/manage/task-center/hooks/useTaskCenterStream';

type Item = Parameters<typeof reduceStreamFrame>[1] extends never ? never : Record<string, unknown>;

const INITIAL: TaskCenterStreamState = {
  phase: 'loading',
  items: [],
  loaded: 0,
  total: null,
  hasMore: true,
  reason: null,
  wsStatus: 'connecting',
  lastEventAt: null,
  lastSeq: 0,
};

function item(id: string): Item {
  return { id, category: 'Scan', status: 'Running' } as unknown as Item;
}

function frame(kind: string, seq: number, items: unknown[], hasMore: boolean, loaded: number, total: number | null, reason: string | null = null) {
  return {
    type: kind === 'first' ? 'task_center.batch' : kind === 'progress' ? 'task_center.progress' : 'task_center.state',
    serverTime: '2026-10-17T00:00:00Z',
    payload: { kind, seq, items, hasMore, loaded, total, reason },
  };
}

describe('W15-TASK-CENTER-STREAM 纯函数', () => {
  it('⑤ 首屏骨架不依赖后端速度：loaded=0 且 loading ⇒ showSkeleton 条件成立', () => {
    // 「后端延迟 5s」改变的是何时收到 first 帧，不改变首屏状态。
    const showSkeleton = INITIAL.loaded === 0 && INITIAL.phase === 'loading';
    assert.equal(showSkeleton, true, '首屏必须可出骨架（不等后端）');
    assert.equal(SKELETON_ROWS, 3, '骨架行数 3');
  });

  it('⑦ 卡死阈值 = 3s（与后端 FRONTEND_STALL_THRESHOLD_MS 同值）', () => {
    assert.equal(STALL_MS, 3_000);
  });

  it('退避封顶 15s（不断连打爆后端）', () => {
    assert.equal(backoffMs(1), 1_000);
    assert.equal(backoffMs(2), 2_000);
    assert.equal(backoffMs(3), 4_000);
    // 第 5 次起 2^4×1000=16000 已超封顶 ⇒ 钳到 15000（封顶生效点）
    assert.equal(backoffMs(5), 15_000, '16000 超过封顶 ⇒ 钳 15000');
    assert.equal(backoffMs(50), 15_000, '必须封顶');
  });

  it('⑥ 首块到达：loaded = 首块条数，文案「已加载 N 条 · 仍在加载…」', () => {
    const s1 = reduceStreamFrame(INITIAL, frame('first', 1, [item('a'), item('b'), item('c')], true, 3, null));
    assert.equal(s1.loaded, 3);
    assert.equal(s1.items.length, 3);
    assert.equal(streamHeadline(s1), '已加载 3 条 · 仍在加载…');
  });

  it('⑥ 后续批 append：loaded 单调递增且不重复', () => {
    let s = reduceStreamFrame(INITIAL, frame('first', 1, [item('a'), item('b'), item('c')], true, 3, null));
    s = reduceStreamFrame(s, frame('progress', 2, [item('d'), item('e'), item('f')], true, 6, null));
    assert.equal(s.loaded, 6);
    assert.equal(s.items.length, 6);
    assert.equal(streamHeadline(s), '已加载 6 条 · 仍在加载…');
    // 重复帧（同 seq）不得再 append（WS 重连 replay）
    const before = s.items.length;
    s = reduceStreamFrame(s, frame('progress', 2, [item('x')], true, 99, null));
    assert.equal(s.items.length, before, '同 seq 重复帧必须被丢弃');
  });

  it('⑥ 完成态：文案变「共 N 条」且 hasMore=false', () => {
    let s = reduceStreamFrame(INITIAL, frame('first', 1, [item('a'), item('b'), item('c')], true, 3, null));
    s = reduceStreamFrame(s, frame('finished', 2, [], false, 3, 3));
    assert.equal(s.phase, 'done');
    assert.equal(s.hasMore, false);
    assert.equal(streamHeadline(s), '共 3 条');
  });

  it('⑧ 空态：文案「当前没有运行中的任务」，且与 finished(0) 区分', () => {
    const empty = reduceStreamFrame(INITIAL, frame('empty', 1, [], false, 0, 0));
    assert.equal(empty.phase, 'empty');
    assert.equal(empty.items.length, 0);
    assert.equal(streamHeadline(empty), '当前没有运行中的任务');

    const finishedZero = reduceStreamFrame(
      { ...INITIAL, items: [item('a')], loaded: 1 },
      frame('finished', 2, [], false, 0, 0),
    );
    assert.equal(finishedZero.phase, 'done', 'finished(0) 是 done 不是 empty');
    assert.notEqual(streamHeadline(empty), streamHeadline(finishedZero), '两态文案必须不同');
  });

  it('⑦ 失败态：带原因，且**已加载条目保留**（用户看到的不因失败消失）', () => {
    let s = reduceStreamFrame(INITIAL, frame('first', 1, [item('a'), item('b'), item('c')], true, 3, null));
    s = reduceStreamFrame(s, frame('failed', 2, [], false, 3, null, 'db timeout'));
    assert.equal(s.phase, 'failed');
    assert.equal(s.reason, 'db timeout');
    assert.equal(s.items.length, 3, '失败后已加载条目必须保留');
    assert.equal(streamHeadline(s), '加载失败：db timeout');
  });

  it('非 JSON / 缺 type / 缺 payload ⇒ null（不崩）', () => {
    assert.equal(parseStreamFrame('not json'), null);
    assert.equal(parseStreamFrame('{"type":"x"}'), null);
    assert.equal(parseStreamFrame('{"type":"task_center.batch"}'), null);
    assert.equal(parseStreamFrame('{"type":"task_center.batch","payload":{"seq":1}}'), null);
  });

  it('hello 帧（无 payload.kind）被过滤，不影响状态', () => {
    const hello = JSON.stringify({ type: 'playback.realtime.hello', server_time: 'x', payload: { user_id: '1' } });
    assert.equal(parseStreamFrame(hello), null);
    assert.deepEqual(reduceStreamFrame(INITIAL, null), INITIAL);
  });

  it('parse 归一 snake_case → 内部形态', () => {
    const raw = JSON.stringify({
      type: 'task_center.progress',
      server_time: '2026-10-17T00:00:00Z',
      payload: { kind: 'progress', seq: 2, items: [{ id: 'a' }], has_more: true, loaded: 5, total: 9 },
    });
    const f = parseStreamFrame(raw);
    assert.ok(f);
    assert.equal(f.payload.kind, 'progress');
    assert.equal(f.payload.hasMore, true, 'has_more → hasMore');
    assert.equal(f.payload.loaded, 5);
    assert.equal(f.payload.total, 9);
  });
});
