/**
 * B2 运营看板展示层（纯函数，零 DOM 依赖）——活跃快照 / 数据源负载两卡的
 * 渲染输入准备。抽成纯函数的原因：host 单测走 `node:test`（无 jsdom/RTL
 * 依赖），两卡的**有数据/空态**行为由此可在纯逻辑层断言。
 *
 * 诚实口径（FE-HONESTY）：后端 Option 字段（positionTicks/durationTicks）
 * 缺值 → `EM_DASH`（—），**不回落 0 或编造进度**；百分比仅在两个 tick
 * 都有效且 duration > 0 时计算。
 */

import type {
  OperationsActiveSession,
  OperationsActiveSnapshot,
  OperationsDataSourceLoadItem,
} from "./types";

export const EM_DASH = "—";

/** 活跃快照卡的一行（渲染输入）。 */
export interface ActiveSessionRow {
  key: string;
  username: string;
  title: string;
  /** paused → 暂停；否则播放中。 */
  state: "playing" | "paused";
  /** 进度文本：百分比（可算时）或 `—`（tick 缺值/时长非正）。 */
  progress: string;
  /** 开始时间（epoch ms；渲染侧格式化）。 */
  startedAt: number;
}

/** 数据源负载卡的一行（渲染输入）。 */
export interface DataSourceLoadRow {
  key: string;
  mountName: string;
  providerType: string;
  activeSessionCount: number;
  playingCount: number;
  pausedCount: number;
}

/** 活跃快照卡的渲染输入（含表头计数）。 */
export interface ActiveSnapshotView {
  activeSessionCount: number;
  runningTasks: number;
  rows: ActiveSessionRow[];
}

/** tick → 进度文本；不可算时返回 `—`。 */
export function formatProgressText(
  positionTicks: number | null,
  durationTicks: number | null,
): string {
  if (
    positionTicks === null ||
    durationTicks === null ||
    !Number.isFinite(positionTicks) ||
    !Number.isFinite(durationTicks) ||
    durationTicks <= 0
  ) {
    return EM_DASH;
  }
  const pct = (positionTicks / durationTicks) * 100;
  if (!Number.isFinite(pct) || pct < 0) {
    return EM_DASH;
  }
  return `${Math.min(100, Math.round(pct))}%`;
}

/** 会话快照 → 渲染行（缺值诚实，不编造）。 */
export function buildActiveSnapshotRows(
  snapshot: OperationsActiveSnapshot | undefined,
): ActiveSnapshotView {
  if (!snapshot) {
    return { activeSessionCount: 0, runningTasks: 0, rows: [] };
  }
  const rows: ActiveSessionRow[] = (Array.isArray(snapshot.sessions) ? snapshot.sessions : []).map(
    (s: OperationsActiveSession) => ({
      key: s.sessionId,
      username: s.username,
      title: s.title,
      state: s.paused ? "paused" : "playing",
      progress: formatProgressText(s.positionTicks, s.durationTicks),
      startedAt: s.startedAt,
    }),
  );
  return {
    activeSessionCount: Number.isFinite(snapshot.activeSessionCount)
      ? snapshot.activeSessionCount
      : rows.length,
    runningTasks: Number.isFinite(snapshot.runningTasks) ? snapshot.runningTasks : 0,
    rows,
  };
}

/** 数据源负载 → 渲染行（原样透传计数，不做推断）。 */
export function buildDataSourceLoadRows(
  items: OperationsDataSourceLoadItem[] | undefined,
): DataSourceLoadRow[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((l) => ({
    key: l.mountId,
    mountName: l.mountName,
    providerType: l.providerType,
    activeSessionCount: Number.isFinite(l.activeSessionCount) ? l.activeSessionCount : 0,
    playingCount: Number.isFinite(l.playingCount) ? l.playingCount : 0,
    pausedCount: Number.isFinite(l.pausedCount) ? l.pausedCount : 0,
  }));
}
