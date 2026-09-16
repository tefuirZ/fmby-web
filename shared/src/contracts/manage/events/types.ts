/** 事件种类（V1F-07）。 */
export type EventKind = string;

/** 事件严重级别。 */
export type EventSeverity = "info" | "warning" | "critical";

/** 事件列表项（V1F-07 wire，camelCase）。 */
export interface EventListItem {
  id: string;
  kind: EventKind;
  timestamp: number;
  severity: EventSeverity;
  title: string;
  module: string;
  summary: string;
  requestId: string;
}

/** 事件列表响应。 */
export interface EventListResponse {
  events: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** V2 无文件日志设施时为 false（方向 B 诚实降级，不静默空冒充有数据）。 */
  runtimeSourceAvailable: boolean;
}

/** 事件列表查询参数。 */
export interface EventListQuery {
  kind?: string;
  requestId?: string;
  actor?: string;
  action?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** 事件详情时间线节点。 */
export interface EventTimelineEntry {
  step: number;
  label: string;
  status: string;
  timestamp: number;
  detail: string | null;
}

/** 事件详情审计记录。 */
export interface EventAuditRecord {
  timestamp: number;
  actor: string;
  action: string;
  target: string;
  result: string;
  traceId: string | null;
  fields: { key: string; value: string }[];
}

/** 事件详情诊断。 */
export interface EventDiagnosis {
  humanTitle: string;
  moduleLabel: string;
  possibleCauses: string[];
  troubleshootingSteps: string[];
}

/** 事件详情。 */
export interface EventDetailRecord {
  requestId: string;
  timeline: EventTimelineEntry[];
  result: string | null;
  errorCode: string | null;
  diagnosis: EventDiagnosis | null;
  auditRecords: EventAuditRecord[];
  runtimeRecords: unknown[];
  runtimeSourceAvailable: boolean;
}
