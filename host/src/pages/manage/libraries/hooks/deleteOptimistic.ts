/**
 * 媒体库删除的乐观更新纯逻辑（FE-DELETE-UX-OPTIMISTIC）。
 *
 * 与挂载删除、B2 `moveMemberIds` 同范式：把 react-query 缓存变换抽成纯函数，
 * 便于 node:test 断言「mutation 返回后该库 id 不在列表」与「失败回滚」两条。
 *
 * 媒体库列表响应形态（ManageLibrariesResponse）：`{ items: ManageLibraryRecord[] }`。
 * 注：原 FE-OPT-01 ② 的实现误用 `libraries` 字段，乐观移除实际未命中缓存（no-op）；本卡修正为 `items`。
 */

export interface LibraryListResponse {
  items: { id: string }[];
  [key: string]: unknown;
}

/** 乐观移除：返回不含目标库 id 的列表副本（原列表不变）。 */
export function optimisticRemoveLibrary(
  old: LibraryListResponse | undefined,
  libraryId: string,
): LibraryListResponse | undefined {
  if (!old || !Array.isArray(old.items)) return old;
  return {
    ...old,
    items: old.items.filter((entry) => entry.id !== libraryId),
  };
}

/** 失败回滚：直接还原为 previous 快照。 */
export function rollbackLibraryList(
  _failed: LibraryListResponse | undefined,
  previous: LibraryListResponse | undefined,
): LibraryListResponse | undefined {
  return previous;
}
