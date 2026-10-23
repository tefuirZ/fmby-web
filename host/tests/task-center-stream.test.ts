/**
 * W15-TASK-CENTER-STREAM：任务中心流式**纯函数单测**（node:test）。
 *
 * ★v2 重写（F4 期「陈旧断言对齐」卡）：本文件原测 v1 实现的纯函数
 * （parseStreamFrame/reduceStreamFrame/streamHeadline/backoffMs/STALL_MS），
 * 该代 API 已整体重设计为 batch/merge/status 模型（现导出面：
 * mergeBatch / nextStatusAfterBatch / buildStreamStatusText / STALL_THRESHOLD_MS /
 * SKELETON_ROWS），State 形状也从 phase/loaded/wsStatus/lastSeq 换成
 * status/hasMore/errorMessage ⇒ 旧文件在 import 处即 ERR_MODULE_NOT_FOUND
 * （文件级红）。本版按**现实现**重写，保留卡面四条验收（a/b/c/d）的意图映射：
 *   a) 首屏不依赖后端速度 ⇒ loading 态文案不谎报空 + SKELETON_ROWS 就位；
 *   b) 3s 卡死阈值 ⇒ STALL_THRESHOLD_MS === 3000（常量断言，原 b 保留）；
 *   c) 批次 append 计数与判重 ⇒ mergeBatch 保序 append + category:id 去重
 *      （WS 重连重放场景）+ 形状 fail-loud + status 迁移（nextStatusAfterBatch）；
 *   d) 三态文案区分 ⇒ buildStreamStatusText 六态分支 + done(0)≠empty 的诚实分支。
 *
 * 断言不依赖浏览器/WS 真连（纯函数 + 常量）；定时器交互归 e2e。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STALL_THRESHOLD_MS,
  SKELETON_ROWS,
  buildStreamStatusText,
  mergeBatch,
  nextStatusAfterBatch,
  type TaskCenterStreamBatch,
  type TaskCenterStreamState,
} from '@/pages/manage/task-center/hooks/useTaskCenterStream';

function item(id: string, category = 'Scan'): { id: string; category: string } {
  return { id, category };
}

const EMPTY: TaskCenterStreamState = {
  status: 'loading',
  items: [],
  total: 0,
  hasMore: true,
  errorMessage: null,
};

function batch(ids: Array<[string, string]>, total: number, hasMore: boolean): TaskCenterStreamBatch {
  return {
    items: ids.map(([id, category]) => item(id, category) as never),
    total,
    hasMore,
  };
}

describe('W15-TASK-CENTER-STREAM 纯函数（v2）', () => {
  // ------------------------------------------------------------------
  // a) 首屏不依赖后端速度：loading 态文案不得谎报「没有任务」，骨架行数就位
  // ------------------------------------------------------------------
  it('⑤ loading 态（首批未到）文案是「正在装载」而非空态断言；骨架行数就位', () => {
    assert.equal(buildStreamStatusText({ status: 'loading', loaded: 0 }), '正在装载任务…');
    assert.ok(SKELETON_ROWS > 0, '骨架行数必须 >0（首屏先出骨架 = 卡面 a 条）');
  });

  // ------------------------------------------------------------------
  // b) 3s 卡死阈值（原 b 断言保留，常量随 v2 改名 STALL_THRESHOLD_MS）
  // ------------------------------------------------------------------
  it('卡死阈值常量为 3000ms（卡面 §7）', () => {
    assert.equal(STALL_THRESHOLD_MS, 3000);
  });

  // ------------------------------------------------------------------
  // c) 批次合并：保序 append + category:id 判重 + 形状 fail-loud + status 迁移
  // ------------------------------------------------------------------
  it('mergeBatch：首批保序 append，total/hasMore 透传，状态迁移 streaming', () => {
    const next = mergeBatch(EMPTY, batch([['t1', 'Scan'], ['t2', 'Scan']], 5, true));
    assert.deepEqual(
      next.items.map((i) => i.id),
      ['t1', 't2'],
      '首批按序 append',
    );
    assert.equal(next.total, 5, 'total 取批次后端口径');
    assert.equal(next.hasMore, true);
    assert.equal(next.status, 'streaming', '有新增且仍有更多 ⇒ streaming');
    // 再来一批：继续追加
    const next2 = mergeBatch(next, batch([['t3', 'Scan']], 5, true));
    assert.deepEqual(
      next2.items.map((i) => i.id),
      ['t1', 't2', 't3'],
    );
    assert.equal(next2.status, 'streaming');
  });

  it('mergeBatch：WS 重连重放判重（category:id 同键不重复 append）', () => {
    const seeded = mergeBatch(EMPTY, batch([['t1', 'Scan'], ['t2', 'Scan']], 5, true));
    // 重放整批 + 一条新数据：重放项不重复计入，新项照常追加
    const replayed = mergeBatch(seeded, batch([['t1', 'Scan'], ['t2', 'Scan'], ['t3', 'Scan']], 5, false));
    assert.deepEqual(
      replayed.items.map((i) => i.id),
      ['t1', 't2', 't3'],
      '重放项按 category:id 判重，不得重复 append',
    );
    assert.equal(replayed.status, 'done', 'hasMore=false 且已有数据 ⇒ done');
  });

  it('mergeBatch：同名 id 不同 category 视为不同任务（判重键含 category）', () => {
    const seeded = mergeBatch(EMPTY, batch([['t1', 'Scan']], 2, true));
    const next = mergeBatch(seeded, batch([['t1', 'Publish']], 2, false));
    assert.deepEqual(
      next.items.map((i) => `${i.category}:${i.id}`),
      ['Scan:t1', 'Publish:t1'],
    );
    assert.equal(next.status, 'done');
  });

  it('mergeBatch：非法批次形状 fail-loud（不静默当空批吞掉）', () => {
    assert.throws(
      () => mergeBatch(EMPTY, [item('t1')] as never),
      /非法批次形状/,
      '裸数组/缺 items 必须抛错（仓内踩过的探针形状坑）',
    );
  });

  it('nextStatusAfterBatch：流尽且零新增 ⇒ empty（三态可辨：empty ≠ done）', () => {
    const stillLoading = nextStatusAfterBatch(EMPTY, batch([], 0, true));
    assert.equal(stillLoading, 'loading', 'hasMore 且零新增 ⇒ 继续 loading（等下一批）');
    const drained = nextStatusAfterBatch(EMPTY, batch([], 0, false));
    assert.equal(drained, 'empty', '流尽且零数据 ⇒ empty');
  });

  // ------------------------------------------------------------------
  // d) 三态（六态）文案区分：loading/stalled/error/empty/streaming/done
  // ------------------------------------------------------------------
  it('buildStreamStatusText：六态文案两两可辨', () => {
    const texts = new Set([
      buildStreamStatusText({ status: 'loading', loaded: 0 }),
      buildStreamStatusText({ status: 'stalled', loaded: 0 }),
      buildStreamStatusText({ status: 'error', loaded: 0 }),
      buildStreamStatusText({ status: 'empty', loaded: 0 }),
      buildStreamStatusText({ status: 'streaming', loaded: 7 }),
      buildStreamStatusText({ status: 'done', loaded: 12 }),
    ]);
    assert.equal(texts.size, 6, '六态文案必须互不相同（可辨识）');
    assert.equal(buildStreamStatusText({ status: 'streaming', loaded: 7 }), '已加载 7 条 · 仍在加载…');
    assert.equal(buildStreamStatusText({ status: 'done', loaded: 12 }), '共 12 条');
  });

  it('buildStreamStatusText：done 且 loaded=0 时不得谎报「没有任务」（后端 total>0 = 如实说未取回）', () => {
    // ★卡面 a 条的变体：首页空但后端口径有数 ⇒ 不能替后端断言「没有运行中的任务」
    assert.equal(
      buildStreamStatusText({ status: 'done', loaded: 0, total: 9 }),
      '未取回任务数据（后端口径共 9 条）',
    );
    assert.equal(
      buildStreamStatusText({ status: 'done', loaded: 0, total: 0 }),
      '当前没有运行中的任务',
    );
  });
});
