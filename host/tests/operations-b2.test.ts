import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EM_DASH,
  buildActiveSnapshotRows,
  buildDataSourceLoadRows,
  formatProgressText,
} from '@fmby/v2-shared/contracts/manage/operations';
import type {
  OperationsActiveSnapshot,
  OperationsDataSourceLoadItem,
} from '@fmby/v2-shared/contracts/manage/operations';

/** 有数据的活跃快照（两条：一条暂停 + tick 齐全，一条 tick 全 null）。 */
function snapshotWithSessions(): OperationsActiveSnapshot {
  return {
    activeSessionCount: 2,
    runningTasks: 3,
    sessions: [
      {
        sessionId: 'sess-1',
        userId: '101',
        username: 'alice',
        itemId: '9001',
        title: '电影 A',
        paused: true,
        positionTicks: 3_000_000,
        durationTicks: 6_000_000,
        startedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_060_000,
      },
      {
        sessionId: 'sess-2',
        userId: '102',
        username: 'bob',
        itemId: '9002',
        title: '剧集 B',
        paused: false,
        // 后端 Option → null：不得回落 0，必须显示 —。
        positionTicks: null,
        durationTicks: null,
        startedAt: 1_700_000_100_000,
        updatedAt: 1_700_000_160_000,
      },
    ],
  };
}

function loadItems(): OperationsDataSourceLoadItem[] {
  return [
    {
      mountId: 'm1',
      mountName: '本地影视',
      providerType: 'Local',
      activeSessionCount: 2,
      playingCount: 1,
      pausedCount: 1,
    },
  ];
}

test('活跃快照卡：有数据 → 2 行 + 计数透传，tick 齐全算百分比', () => {
  const view = buildActiveSnapshotRows(snapshotWithSessions());
  assert.equal(view.activeSessionCount, 2);
  assert.equal(view.runningTasks, 3);
  assert.equal(view.rows.length, 2);

  assert.deepEqual(
    view.rows[0],
    {
      key: 'sess-1',
      username: 'alice',
      title: '电影 A',
      state: 'paused',
      progress: '50%',
      startedAt: 1_700_000_000_000,
    },
    '暂停 + 3M/6M tick → 50%',
  );
  assert.equal(view.rows[0].state, 'paused');
});

test('活跃快照卡：tick 缺值显示 —（不回落 0 / 不编造进度）', () => {
  const view = buildActiveSnapshotRows(snapshotWithSessions());
  assert.equal(view.rows[1].progress, EM_DASH);
  assert.equal(view.rows[1].state, 'playing');
  // 单侧缺值同样 —（诚实口径）。
  assert.equal(formatProgressText(1_000, null), EM_DASH);
  assert.equal(formatProgressText(null, 1_000), EM_DASH);
  assert.equal(formatProgressText(1, 0), EM_DASH, '时长非正 → —');
});

test('活跃快照卡：空态 / 缺段 → 零行零计数，不崩溃', () => {
  const empty = buildActiveSnapshotRows({
    activeSessionCount: 0,
    runningTasks: 0,
    sessions: [],
  });
  assert.deepEqual(empty, { activeSessionCount: 0, runningTasks: 0, rows: [] });

  // 后端未装配 / 老版本响应缺该段（mapper 回落空快照后传入 undefined 也不崩）。
  const missing = buildActiveSnapshotRows(undefined);
  assert.deepEqual(missing, { activeSessionCount: 0, runningTasks: 0, rows: [] });
});

test('数据源负载卡：有数据 → 计数原样透传；空态 → 零行', () => {
  const rows = buildDataSourceLoadRows(loadItems());
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    key: 'm1',
    mountName: '本地影视',
    providerType: 'Local',
    activeSessionCount: 2,
    playingCount: 1,
    pausedCount: 1,
  });

  assert.deepEqual(buildDataSourceLoadRows([]), []);
  assert.deepEqual(buildDataSourceLoadRows(undefined), []);
});
