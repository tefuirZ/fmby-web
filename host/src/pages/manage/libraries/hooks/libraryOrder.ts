/**
 * 媒体库排序纯逻辑（FE-LIBRARY-ORDER-UI）。
 *
 * 选「上/下移按钮」而非 HTML5 拖拽（照 B2 成员排序先例）：
 *  - 键盘可达：<button> 天然可 Tab 聚焦，配合全局 :focus-visible 焦点环；
 *  - 零新依赖（卡面禁止引 dnd 库）；鼠标也能点。
 *
 * 后端 PUT /api/manage/libraries/order 收 `library_ids`，顺序即目标展示顺序。
 * 这里操作的是**完整**列表顺序（含筛选隐藏项），因为后端要求全量顺序。
 */

/** 把 id 在完整顺序中上移（-1）/下移（+1）一位；边界或越界返回原序副本，不环绕。 */
export function moveLibraryIds(ids: string[], id: string, step: -1 | 1): string[] {
  const n = ids.length;
  if (n === 0) return [...ids];
  const index = ids.indexOf(id);
  if (index < 0) return [...ids];
  const target = index + step;
  if (target < 0 || target >= n) return [...ids];
  const next = [...ids];
  const tmp = next[index];
  next[index] = next[target];
  next[target] = tmp;
  return next;
}
