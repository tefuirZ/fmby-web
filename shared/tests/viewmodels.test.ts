/**
 * view-model 状态机与派生单测（WEB-B1 交付物 4）。
 *
 * 复用 `apps/shared/tests` 既有 `node:test` 约定（无 vitest/jsdom）：
 * 断言**纯函数**的状态迁移与展示派生——viewmodel 的状态判定全部收敛在
 * `deriveViewState` / `isForbiddenError` 中，hook 只做编排，故测纯函数即覆盖
 * 各 viewmodel 的 state 迁移语义（loading→ready / →empty / →error / →forbidden）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveViewState,
  isForbiddenError,
  isEmptyGroups,
  isEmptyList,
} from '../src/viewmodels/types.ts';
import { layoutForViewport, MOBILE_BREAKPOINT_PX } from '../src/viewmodels/useLayoutHint.ts';
import {
  buildCardProgressLabel,
  buildMediaMeta,
  formatCompactDuration,
  resolvePlayableTargetId,
} from '../src/viewmodels/mediaMeta.ts';
import {
  matchesHistoryFilters,
  timeRangeToMs,
} from '../src/viewmodels/useHistory.ts';
import { shouldLoadTechnicalFallback } from '../src/viewmodels/useItemDetail.ts';

// ---------------------------------------------------------------------------
// deriveViewState：五态迁移
// ---------------------------------------------------------------------------

test('deriveViewState: 无数据且 pending → loading', () => {
  assert.equal(
    deriveViewState({ data: undefined, isPending: true, isError: false }, false),
    'loading',
  );
});

test('deriveViewState: 有数据且非空 → ready', () => {
  assert.equal(
    deriveViewState({ data: [1, 2], isPending: false, isError: false }, false),
    'ready',
  );
});

test('deriveViewState: 有数据但为空 → empty', () => {
  assert.equal(
    deriveViewState({ data: [], isPending: false, isError: false }, true),
    'empty',
  );
});

test('deriveViewState: 通用错误 → error', () => {
  assert.equal(
    deriveViewState(
      { data: undefined, isPending: false, isError: true, error: { code: 'internal', message: 'boom', retryable: true } },
      false,
    ),
    'error',
  );
});

test('deriveViewState: 403/权限码 → forbidden（优先于 error）', () => {
  const forbidden = { code: 'forbidden', message: 'no permission', retryable: false };
  assert.equal(
    deriveViewState({ data: undefined, isPending: false, isError: true, error: forbidden }, false),
    'forbidden',
  );
  // 携带 HTTP 403 的错误对象同样归 forbidden
  assert.equal(
    deriveViewState(
      { data: undefined, isPending: false, isError: true, error: { code: 'other', message: 'x', retryable: false, status: 403 } },
      false,
    ),
    'forbidden',
  );
});

test('deriveViewState: 错误优先于数据（既有 data 也报错 → 仍为 error/forbidden）', () => {
  assert.equal(
    deriveViewState(
      { data: [1], isPending: false, isError: true, error: { code: 'internal', message: 'x', retryable: true } },
      false,
    ),
    'error',
  );
});

test('deriveViewState: 既无数据也无错误且非 pending → loading（防白屏）', () => {
  assert.equal(
    deriveViewState({ data: undefined, isPending: false, isError: false }, false),
    'loading',
  );
});

// ---------------------------------------------------------------------------
// isForbiddenError
// ---------------------------------------------------------------------------

test('isForbiddenError: 权限码与 403 命中，其余不命中', () => {
  assert.equal(isForbiddenError({ code: 'forbidden' }), true);
  assert.equal(isForbiddenError({ code: 'permission_denied' }), true);
  assert.equal(isForbiddenError({ status: 403 }), true);
  assert.equal(isForbiddenError({ statusCode: 403 }), true);
  assert.equal(isForbiddenError({ code: 'internal' }), false);
  assert.equal(isForbiddenError(undefined), false);
  assert.equal(isForbiddenError('boom'), false);
});

// ---------------------------------------------------------------------------
// 空判定
// ---------------------------------------------------------------------------

test('isEmptyList / isEmptyGroups', () => {
  assert.equal(isEmptyList(undefined), true);
  assert.equal(isEmptyList([]), true);
  assert.equal(isEmptyList([1]), false);
  assert.equal(isEmptyGroups([[], []]), true);
  assert.equal(isEmptyGroups([[], [1]]), false);
});

// ---------------------------------------------------------------------------
// 布局提示
// ---------------------------------------------------------------------------

test('layoutForViewport: 断点分界', () => {
  assert.equal(layoutForViewport(MOBILE_BREAKPOINT_PX - 1), 'mobile');
  assert.equal(layoutForViewport(MOBILE_BREAKPOINT_PX), 'desktop');
  assert.equal(layoutForViewport(375), 'mobile');
  assert.equal(layoutForViewport(1920), 'desktop');
});

// ---------------------------------------------------------------------------
// 展示派生
// ---------------------------------------------------------------------------

test('buildMediaMeta: 电影走时长，剧集走集数', () => {
  const movie = {
    id: '1', kind: 'movie', kindLabel: '电影', year: 2014,
    durationSeconds: 8100, resolutionLabel: '1080P', ratingLabel: 'PG',
  } as never;
  const meta = buildMediaMeta(movie);
  assert.deepEqual(meta, ['2014', '电影', '2小时15分', '1080P', 'PG']);

  const series = {
    id: '2', kind: 'series', kindLabel: '剧集', itemCount: 12,
  } as never;
  assert.ok(buildMediaMeta(series).includes('12 集'));
});

test('formatCompactDuration', () => {
  assert.equal(formatCompactDuration(3600), '1小时');
  assert.equal(formatCompactDuration(8100), '2小时15分');
  assert.equal(formatCompactDuration(2700), '45分');
  assert.equal(formatCompactDuration(undefined), undefined);
});

test('buildCardProgressLabel: 已完成 / 未完成', () => {
  const completed = { progress: { completed: true, progressPercent: 100 } } as never;
  assert.equal(buildCardProgressLabel(completed), '已看完');
  const partial = { progress: { completed: false, progressPercent: 42 } } as never;
  assert.equal(buildCardProgressLabel(partial), '已观看 42%');
  assert.equal(buildCardProgressLabel({} as never), undefined);
});

test('resolvePlayableTargetId: 不可播放时 undefined', () => {
  assert.equal(
    resolvePlayableTargetId({ id: 'a', hasPlayableSource: true } as never),
    'a',
  );
  assert.equal(
    resolvePlayableTargetId({ id: 'a', availabilityNotice: '缺源' } as never),
    undefined,
  );
  assert.equal(
    resolvePlayableTargetId({ id: 'a', playbackTargetId: 'b' } as never),
    'b',
  );
});

// ---------------------------------------------------------------------------
// 历史筛选（useHistory 的纯过滤）
// ---------------------------------------------------------------------------

test('matchesHistoryFilters: 类型/状态/时间窗组合', () => {
  const now = Date.parse('2026-01-30T00:00:00Z');
  const recent = {
    kind: 'movie',
    progress: { completed: false, progressPercent: 10 },
    playedAt: '2026-01-29T00:00:00Z',
  };
  const old = {
    kind: 'series',
    progress: { completed: true, progressPercent: 100 },
    completedAt: '2025-01-01T00:00:00Z',
  };

  const f = { typeFilter: 'all', stateFilter: 'all' as const, timeRange: 'all' as const };
  assert.equal(matchesHistoryFilters(recent as never, f, now), true);
  assert.equal(matchesHistoryFilters(old as never, f, now), true);

  // 类型过滤
  assert.equal(
    matchesHistoryFilters(recent as never, { ...f, typeFilter: 'series' }, now),
    false,
  );
  // 状态过滤
  assert.equal(
    matchesHistoryFilters(old as never, { ...f, stateFilter: 'unfinished' }, now),
    false,
  );
  // 时间窗 7d 排除一年前的记录
  assert.equal(
    matchesHistoryFilters(old as never, { ...f, timeRange: '7d' }, now),
    false,
  );
  assert.equal(
    matchesHistoryFilters(recent as never, { ...f, timeRange: '7d' }, now),
    true,
  );
  // 无时间戳且要求时间窗 → 保留（与原页面语义一致）
  assert.equal(
    matchesHistoryFilters({ kind: 'movie' } as never, { ...f, timeRange: '30d' }, now),
    true,
  );
});

test('timeRangeToMs: all 不限制，其余按天', () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(timeRangeToMs('7d'), 7 * day);
  assert.equal(timeRangeToMs('30d'), 30 * day);
  assert.equal(timeRangeToMs('365d'), 365 * day);
  assert.equal(timeRangeToMs('all'), undefined);
});

// ---------------------------------------------------------------------------
// itemDetail 兜底判定
// ---------------------------------------------------------------------------

test('shouldLoadTechnicalFallback: 仅剧集/季且缺技术信息且目标不同才加载', () => {
  assert.equal(shouldLoadTechnicalFallback(undefined), false);
  // 电影：直接 false
  assert.equal(
    shouldLoadTechnicalFallback({ kind: 'movie', id: 'a', playbackTargetId: 'b' } as never),
    false,
  );
  // 剧集 + 目标不同 + 无技术信息 → true
  assert.equal(
    shouldLoadTechnicalFallback({ kind: 'series', id: 'a', playbackTargetId: 'b' } as never),
    true,
  );
  // 目标等于自身 → false
  assert.equal(
    shouldLoadTechnicalFallback({ kind: 'series', id: 'a', playbackTargetId: 'a' } as never),
    false,
  );
  // 已有丰富技术信息 → false
  assert.equal(
    shouldLoadTechnicalFallback({
      kind: 'series', id: 'a', playbackTargetId: 'b',
      technical: { resolutionLabel: '1080P' },
    } as never),
    false,
  );
});
