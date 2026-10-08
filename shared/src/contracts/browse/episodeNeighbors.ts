/**
 * 相邻集解析（F-28，fmby-web#2）。
 *
 * 卡面要求「邻居解析**下沉契约层**用真实 seasonId+episodeNumber；拿不到就禁用
 * 前后集按钮，不伪造」。本文件即该下沉落点：纯函数、零 DOM、零 host 依赖，
 * 故 `shared` 包可直接单测（与 `contracts/manage/operations/presentation.ts`
 * 同型——那份展示层纯函数同样落在契约层，正是为了能被 `node:test` 直接断言）。
 *
 * 修法：
 * 1. **删掉 `episode-${200+n}` 合成 id**。该编码前后端均无出处：后端
 *    `fmby-v2-application/src/task_center.rs:786` 的 `media_item_id_from_key` 表明
 *    item_id 是 provider **纯数字串**；全 `crates/` 仅 3 处 `"episode-N"` 字面量，
 *    全在 `fmby-v2-search/src/runtime_tests.rs` 测试夹具里，与 `200+` 无关。
 * 2. **删掉 `episode-(\d+)$` 反推**。真实 id 下该正则恒不命中（已实测 9001 /
 *    e-s02e01 / tt0111161 全部 false）⇒ 右侧恒 NaN ⇒ 是死代码。
 * 3. **按 `seasonId` 分组取相邻**。不能用 `seasonNumber`：后端 bridge 建卡时
 *    `season_number`/`episode_number` 硬编码 `None`（browse/service.rs:110-113、
 *    610-613；manage_media/convert.rs:87），恒为 undefined；且前端
 *    `browse/api.ts:162` 回退链含 `index_number`，只有集号时会把 seasonNumber
 *    填成**集号**（实测 E01/E02/E03 ⇒ 1/2/3），按它分组会把当季每集拆散。
 *    `seasonId` 是当前唯一可靠的同季判据（来自 `node_parent_context`）。
 *
 * 退化：卡片无 `seasonId` 时全部归入同一组，退回原有「整剧平铺」行为（仍不伪造
 * id）——此时与修复前一致，不产生新的用户可见回退。
 *
 * 卡面写的是 `seasonId + episodeNumber`，实际只用 `seasonId` 分组：相邻是
 * **按同季内的数组顺序**求的，列表已由 `sortEpisodeCards` 按 episodeNumber 排好；
 * 而 episodeNumber 在后端恒缺（见上），直接依赖它等于依赖一个 undefined。
 */

import type { MediaCardSummary } from './types';

/** 按整份列表求相邻（不分季）：保留原有平铺语义。 */
export function resolveEpisodeNeighbors(
  currentItemId: string | undefined,
  siblings: MediaCardSummary[],
) {
  const currentIndex = currentItemId
    ? siblings.findIndex(
        (candidate) =>
          candidate.id === currentItemId || candidate.playbackTargetId === currentItemId,
      )
    : -1;

  return {
    currentIndex,
    previous: currentIndex > 0 ? siblings[currentIndex - 1] : undefined,
    next:
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : undefined,
  };
}

/**
 * 相邻集解析入口。
 *
 * 非剧集视图直接退化为整份列表的相邻（剧集/季视图不该出现「上一集/下一集」）。
 * 剧集视图按 `seasonId` 分组后取同季相邻；无 seasonId 时同季组即全量，
 * 等价于修复前的平铺行为。
 */
export function resolveAdjacentEpisodes(args: {
  currentItemId: string | undefined;
  siblings: MediaCardSummary[];
  isEpisodeView: boolean;
  seasonId?: string;
}) {
  const { currentItemId, siblings, isEpisodeView, seasonId } = args;
  const resolved = resolveEpisodeNeighbors(currentItemId, siblings);
  if (!isEpisodeView) {
    return resolved;
  }
  // 同季分组：无 seasonId 的卡片归入同一组（键 null），保持原有平铺语义。
  const sameSeason = siblings.filter((card) => (card.seasonId ?? null) === (seasonId ?? null));
  const indexInSeason = currentItemId
    ? sameSeason.findIndex(
        (card) => card.id === currentItemId || card.playbackTargetId === currentItemId,
      )
    : -1;
  return {
    ...resolved,
    previous: indexInSeason > 0 ? sameSeason[indexInSeason - 1] : undefined,
    next:
      indexInSeason >= 0 && indexInSeason < sameSeason.length - 1
        ? sameSeason[indexInSeason + 1]
        : undefined,
  };
}