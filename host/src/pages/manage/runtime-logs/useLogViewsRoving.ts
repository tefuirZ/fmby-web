/**
 * 日志表的行漫游接线（FE-LIST-KEYNAV-10）。
 *
 * 单列成 hook 的唯一原因：`ManageRuntimeLogsPage.tsx` 已贴着 400 行红线，
 * 这 14 行（含 6 行解释性注释）把它顶到 410 行触发组件行数门禁 FAIL。
 * 抽出来 ⇒ 页面回到 400 以下，且**语义一字未改**（调用点位置、参数、注释全部保留）。
 */

import { useRef } from 'react';
import { useTableRowRoving } from '../../../features/a11y/useTableRowRoving';

/**
 * 日志表行内有「详情」按钮（原生 Tab 可达）⇒ 不传 `onActivate`。
 *
 * ★调用点必须位于调用组件的 `isPending` / `isError` **early return 之前**：
 *   放在其后时，pending → loaded 迁移会让 hook 数量在两次 render 之间变化，
 *   React 直接抛 “Rendered more hooks than during the previous render.”
 *   （真实实证，见 `host/tests/table-row-keynav.test.ts` 批次 C 3/N）。
 *   `rowCount` 因此直接取 `logsQuery.data`（此时 data 可能仍为 undefined ⇒ 0），
 *   而不是取 early return 之后才推导出的 `logViews` —— 后者会重新引入上面的崩溃。
 */
export function useLogViewsRoving(rowCount: number) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount });
  return tbodyRef;
}
