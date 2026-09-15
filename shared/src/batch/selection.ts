/**
 * 列表多选（FE-OPT-04）——全选 / 反选 / 范围选（shift 锚点）纯函数内核。
 *
 * 与 `runner.ts` 同属"批量操作体感"共享内核：把选择集的演进收敛为纯函数，
 * 便于 node:test 直接断言；React 侧只需 `useState` + 这些函数。
 */

export interface ToggleRangeArgs {
  /** 当前选中集（顺序无关）。 */
  selected: readonly string[];
  /** 当前页可选项 id（顺序 = 视觉顺序，范围选依赖）。 */
  visibleIds: readonly string[];
  /** 本次点击的项 id。 */
  id: string;
  /** shift 点击时的锚点 id（上一次无 shift 点击的项）；无锚点退化为单点 toggle。 */
  anchorId?: string | null;
  /** 勾选（true）/ 取消（false）。 */
  checked: boolean;
}

/** 单点 toggle：勾选加入、取消移除（保持原顺序，幂等）。 */
export function toggleOne(
  selected: readonly string[],
  id: string,
  checked: boolean,
): string[] {
  const has = selected.includes(id);
  if (checked && !has) return [...selected, id];
  if (!checked && has) return selected.filter((value) => value !== id);
  return [...selected];
}

/**
 * 全选：把 `visibleIds` 全部并入选中（保留已选的不可见项——分页/筛选切换
 * 不应丢失跨页选择）。
 */
export function selectAll(
  selected: readonly string[],
  visibleIds: readonly string[],
): string[] {
  const set = new Set(selected);
  for (const id of visibleIds) set.add(id);
  return [...set];
}

/** 清空：移除 `visibleIds`（当前页），保留其余（跨页选择语义）。 */
export function clearVisible(
  selected: readonly string[],
  visibleIds: readonly string[],
): string[] {
  const drop = new Set(visibleIds);
  return selected.filter((id) => !drop.has(id));
}

/** 反选：当前页内取反（不可见项不变）。 */
export function invertVisible(
  selected: readonly string[],
  visibleIds: readonly string[],
): string[] {
  const set = new Set(selected);
  for (const id of visibleIds) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return [...set];
}

/**
 * 范围选（shift 点击）：锚点与目标在 `visibleIds` 之间的所有项按 `checked`
 * 置值；锚点缺失/不在可见集时退化为单点 [toggleOne]。
 */
export function toggleRange({
  selected,
  visibleIds,
  id,
  anchorId,
  checked,
}: ToggleRangeArgs): string[] {
  const targetIndex = visibleIds.indexOf(id);
  const anchorIndex = anchorId ? visibleIds.indexOf(anchorId) : -1;
  if (targetIndex < 0 || anchorIndex < 0) {
    return toggleOne(selected, id, checked);
  }
  const [from, to] = anchorIndex <= targetIndex
    ? [anchorIndex, targetIndex]
    : [targetIndex, anchorIndex];
  const range = visibleIds.slice(from, to + 1);
  const set = new Set(selected);
  for (const value of range) {
    if (checked) set.add(value);
    else set.delete(value);
  }
  return [...set];
}

/** 表头三态：全选 / 半选（有选中但不全）/ 未选。 */
export function headerCheckState(
  selected: readonly string[],
  visibleIds: readonly string[],
): 'checked' | 'indeterminate' | 'unchecked' {
  if (visibleIds.length === 0) return 'unchecked';
  let chosen = 0;
  for (const id of visibleIds) if (selected.includes(id)) chosen++;
  if (chosen === 0) return 'unchecked';
  if (chosen === visibleIds.length) return 'checked';
  return 'indeterminate';
}

/** 清理失效选择（列表刷新后剔除不存在的 id）——避免批量作业打空 id。 */
export function pruneSelection(
  selected: readonly string[],
  knownIds: readonly string[],
): string[] {
  const known = new Set(knownIds);
  return selected.filter((id) => known.has(id));
}
