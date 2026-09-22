/**
 * 成员排序纯逻辑（FE-COLLECTIONS-CONSUME-B2）。
 *
 * 选「上/下移按钮」而非 HTML5 拖拽的理由：
 *  - 键盘可达：<button> 天然可 Tab 聚焦，配合全局 :focus-visible 焦点环（FE-LIST-KEYNAV
 *    已建立纪律），不依赖鼠标；HTML5 drag 原生无键盘路径，要补 a11y 需额外实现，收益低。
 *  - 鼠标也能点，零新依赖（卡面禁止引 dnd 库）。
 *  - POST /{id}/members/reorder 收 `member_ids`，顺序即目标 release_order 递增。
 */

/** step=+1 下移、step=-1 上移；越界或已在边界时返回原序副本，**不环绕**。 */
export function moveMemberIds(ids: string[], index: number, step: -1 | 1): string[] {
  const n = ids.length;
  if (n === 0) return [...ids];
  if (index < 0 || index >= n) return [...ids];
  const target = index + step;
  if (target < 0 || target >= n) return [...ids];
  const next = [...ids];
  const a = next[index];
  next[index] = next[target];
  next[target] = a;
  return next;
}
