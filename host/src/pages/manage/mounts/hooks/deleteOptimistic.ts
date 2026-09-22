/**
 * 挂载删除的乐观更新纯逻辑（FE-DELETE-UX-OPTIMISTIC）。
 *
 * 与 B2 的 `moveMemberIds` 同范式：把 react-query 缓存变换抽成纯函数，便于 node:test
 * 断言「mutation 返回后该 id 不在列表」与「失败回滚」两条，而不依赖 jsdom 渲染。
 */

export interface MountListResponse {
  items: { id: string }[];
  [key: string]: unknown;
}

/** 乐观移除：返回不含目标 id 的列表副本（原列表不变）。 */
export function optimisticRemoveMount(
  old: MountListResponse | undefined,
  mountId: string,
): MountListResponse | undefined {
  if (!old || !Array.isArray(old.items)) return old;
  return { ...old, items: old.items.filter((entry) => entry.id !== mountId) };
}

/** 失败回滚：直接还原为 previous 快照（保持引用稳定，react-query setQueryData 接受）。 */
export function rollbackMountList(
  _failed: MountListResponse | undefined,
  previous: MountListResponse | undefined,
): MountListResponse | undefined {
  return previous;
}
