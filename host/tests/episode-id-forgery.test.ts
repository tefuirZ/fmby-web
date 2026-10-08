// F-28（fmby-web#2）：episode-200 魔法数 —— 邻居 id 伪造回归锁（可证伪）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 缺陷（PlayPage.tsx:93-108）：`makeFallback` 用 `episode-${200 + n}` **凭空合成**
// 前后集 id。该编码在前端/后端均无任何出处：
//   - 后端 FMBY-V2 全 crates/ 无 `+200`/`-200` 集数偏移逻辑；
//   - `"episode-N"` 字面量仅见于 fmby-v2-search/src/runtime_tests.rs 的测试夹具；
//   - 前端真实 id 形如 `e-s02e01` / `ch-1` / `9001`，从不是 `episode-201`。
// ⇒ 点「下一集」会导航到不存在的条目（死链 / 错集号）。
//
// 本测试只锁一条**与修法无关**的不变量：凡是被当作邻居给出的条目，其 id 必须
// 真实存在于列表中。选项 A（拿不到就禁用）/ 按季邻接 / 任何保真方案都必然满足；
// 只有「合成 id」违反它。故无论主代理最终裁定哪个方案，此测试都应保持绿。
//
// ⚠️ 现状 RED：makeFallback 合成的 `episode-202` 不在列表中 ⇒ 断言失败。

import test from 'node:test';
import assert from 'node:assert/strict';

// F-28 已把相邻集解析下沉契约层（卡面要求）⇒ 生产函数改从 shared 取；
// sortEpisodeCards 仍是 host 侧的展示层排序，纯测试用途，仍走相对路径。
import { resolveAdjacentEpisodes } from '@fmby/v2-shared/contracts/browse';
import { sortEpisodeCards } from '../src/pages/browse/play/playbackPresentation.ts';

type Card = Parameters<typeof sortEpisodeCards>[0][number];

const card = (id: string, seasonNumber: number, episodeNumber: number, seasonId?: string): Card =>
  ({
    id,
    title: `S${seasonNumber}E${episodeNumber}`,
    kind: 'episode',
    playbackTargetId: id,
    seasonNumber,
    episodeNumber,
    seasonId,
    tags: [],
    artwork: {},
    hasPlayableSource: true,
  }) as unknown as Card;

/**
 * 直接调用**生产代码** `resolveAdjacentEpisodes`（F-28 从 PlayPage 内联原样搬出的
 * 纯函数），不再在测试里复刻一份。
 *
 * 为什么要这样：先前版本在测试内重写了一遍逻辑，那样即便生产代码修好了，
 * 测试也不会转绿——它锁的是测试自己的副本，不是真实缺陷。改为直调生产函数后，
 * 「修法落地 ⇒ 4 条 RED 转绿」才是可信的。
 */
function currentNeighbors(
  itemId: string | undefined,
  list: Card[],
  opts?: { seasonId?: string },
) {
  return resolveAdjacentEpisodes({
    currentItemId: itemId,
    siblings: list,
    isEpisodeView: true,
    seasonId: opts?.seasonId,
  });
}

/** 邻居 id 必须真实存在于列表（死链判据）。 */
function assertNoForgedId(neighbor: Card | undefined, list: Card[], label: string) {
  if (!neighbor) return; // 禁用/fail-closed 是合法结果
  assert.ok(
    list.some((c) => c.id === neighbor.id || c.playbackTargetId === neighbor.id),
    `${label} 指向不存在的条目（死链）：${neighbor.id}`,
  );
}

test('F-28：邻居不得合成 id —— 当季无相邻集时不得凭空造 episode-2xx', () => {
  const list = sortEpisodeCards([
    card('e-s01e01', 1, 1, 'season-a'),
    card('e-s02e01', 2, 1, 'season-b'),
  ]);
  const { previous, next } = currentNeighbors('e-s02e01', list, { seasonId: 'season-b' });

  assertNoForgedId(previous, list, 'previous');
  assertNoForgedId(next, list, 'next');
});

test('F-28：邻居不得合成 id —— 首集也必须给出真实或禁用，不得造 id', () => {
  const list = sortEpisodeCards([
    card('e-s01e01', 1, 1, 'season-a'),
    card('e-s01e02', 1, 2, 'season-a'),
  ]);
  const { previous, next } = currentNeighbors('e-s01e01', list, { seasonId: 'season-a' });

  // 首集本就没有上一集 ⇒ previous 只能是 undefined（禁用），不能是合成的 episode-200。
  assertNoForgedId(previous, list, 'previous');
  assertNoForgedId(next, list, 'next');
});

test('F-28：跨季时不得把下一季首集误判为相邻集', () => {
  // S01E03 之后紧接 S02E01。只按 episodeNumber 比较会误判「下一集 = 第 1 集」。
  const list = sortEpisodeCards([
    card('e-s01e01', 1, 1, 'season-a'),
    card('e-s01e02', 1, 2, 'season-a'),
    card('e-s01e03', 1, 3, 'season-a'),
    card('e-s02e01', 2, 1, 'season-b'),
  ]);
  const { next } = currentNeighbors('e-s01e03', list, { seasonId: 'season-a' });

  if (next) {
    // 若给出 next，它必须是本季真实存在的相邻集，且不得是另一季的第 1 集。
    assert.ok(
      next.seasonNumber === 1,
      `跨季误判：S01E03 的下一集被指到 S${next.seasonNumber}E${next.episodeNumber}`,
    );
    assertNoForgedId(next, list, 'next');
  }
});

test('F-28：「真实 id 但错季」也必须被抓（死链判据盖不住这一类）', () => {
  // 关键区分：这一档邻居的 id **确实存在**于列表，死链判据完全抓不到。
  // 只按 episodeNumber 邻接的错误实现会把 S02E03 当成 S01E02 的下一集：
  //   current = S01E02 ⇒ 「下一集 = 第 3 集」⇒ 命中 S02E03（id 真实、但错季）。
  // 实测该错误实现产出：S2E3，id 真实存在 = true。
  // 故只有 seasonNumber 判据能拦住它，本条专门锁这一点。
  const list = sortEpisodeCards([
    card('e-s01e01', 1, 1, 'season-a'),
    card('e-s01e02', 1, 2, 'season-a'),
    card('e-s02e02', 2, 2, 'season-b'),
    card('e-s02e03', 2, 3, 'season-b'),
  ]);
  const current = { seasonNumber: 1, episodeNumber: 2 };
  const onlyByEpisodeNumber = list.find((c) => c.episodeNumber === current.episodeNumber + 1);

  // 先确认这个错误实现确实能产出「真 id 但错季」的邻居（否则本测试是假阳性）。
  assert.ok(onlyByEpisodeNumber, '前提：只按 episodeNumber 邻接应命中一个条目');
  assert.ok(
    list.some((c) => c.id === onlyByEpisodeNumber!.id),
    '前提：该条目 id 真实存在（所以死链判据抓不到它）',
  );
  assert.notEqual(
    onlyByEpisodeNumber!.seasonNumber,
    current.seasonNumber,
    '前提：它属于另一季（所以只有 seasonNumber 判据能抓）',
  );

  // 任何合法实现都不得把错季条目当作邻居。
  const { previous, next } = currentNeighbors('e-s01e02', list, { seasonId: 'season-a' });
  for (const [label, neighbor] of [['previous', previous], ['next', next]] as const) {
    if (!neighbor) continue; // 禁用是合法结果
    assert.equal(
      neighbor.seasonNumber,
      current.seasonNumber,
      `${label} 指向了另一季：S${neighbor.seasonNumber}E${neighbor.episodeNumber}`,
    );
    assertNoForgedId(neighbor, list, label);
  }
});

test('F-28：无 seasonId 时退回整剧平铺，且仍不伪造 id', () => {
  // 后端 detail/卡片都可能拿不到 seasonId（browse bridge 季号硬编码 None）。
  // 此时必须退回原有「整剧平铺」邻接语义，而不是禁用，也不是伪造。
  const list = sortEpisodeCards([
    card('e-s01e01', 1, 1),
    card('e-s01e02', 1, 2),
    card('e-s01e03', 1, 3),
  ]);
  const { previous, next } = currentNeighbors('e-s01e02', list, { seasonId: undefined });

  assert.equal(previous?.id, 'e-s01e01', '无季号时 previous 应仍可用（保持既有行为）');
  assert.equal(next?.id, 'e-s01e03', '无季号时 next 应仍可用（保持既有行为）');
  assertNoForgedId(previous, list, 'previous');
  assertNoForgedId(next, list, 'next');
});
