import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type {
  EventAuditRecord,
  EventDetailRecord,
  EventDiagnosis,
  EventListQuery,
  EventListItem,
  EventListResponse,
  EventTimelineEntry,
} from "./types";

interface RawEventListItem {
  id: string;
  kind: string;
  timestamp: number;
  severity: string;
  title: string;
  module: string;
  summary: string;
  requestId: string;
}

interface RawEventList {
  events: RawEventListItem[];
  total: number;
  page: number;
  pageSize: number;
  runtimeSourceAvailable: boolean;
}

interface RawEventTimelineEntry {
  step: number;
  label: string;
  status: string;
  timestamp: number;
  detail: string | null;
}

interface RawEventAuditRecord {
  timestamp: number;
  actor: string;
  action: string;
  target: string;
  result: string;
  traceId: string | null;
  fields: { key: string; value: string }[];
}

interface RawEventDiagnosis {
  humanTitle: string;
  moduleLabel: string;
  possibleCauses: string[];
  troubleshootingSteps: string[];
}

interface RawEventDetail {
  requestId: string;
  timeline: RawEventTimelineEntry[];
  result: string | null;
  errorCode: string | null;
  diagnosis: RawEventDiagnosis | null;
  auditRecords: RawEventAuditRecord[];
  runtimeRecords: unknown[];
  runtimeSourceAvailable: boolean;
}

/** 后端端口未装配 / 能力未实现时的 fail-closed 判定。 */
export function isEventsUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  const code = error.code;
  if (
    code === "not_found" ||
    code === "NOT_FOUND" ||
    code === "HTTP_404" ||
    code === "not_implemented" ||
    code === "NOT_IMPLEMENTED" ||
    code === "HTTP_501" ||
    code === "internal" ||
    code === "HTTP_500"
  ) {
    return true;
  }
  const status = (error as { status?: unknown }).status;
  return status === 404 || status === 501 || status === 500;
}

function fromItem(r: RawEventListItem): EventListItem {
  return {
    id: r.id,
    kind: r.kind,
    timestamp: r.timestamp,
    severity: r.severity as EventListItem["severity"],
    title: r.title,
    module: r.module,
    summary: r.summary,
    requestId: r.requestId,
  };
}

function fromTimeline(r: RawEventTimelineEntry): EventTimelineEntry {
  return {
    step: r.step,
    label: r.label,
    status: r.status,
    timestamp: r.timestamp,
    detail: r.detail,
  };
}

function fromAuditRecord(r: RawEventAuditRecord): EventAuditRecord {
  return {
    timestamp: r.timestamp,
    actor: r.actor,
    action: r.action,
    target: r.target,
    result: r.result,
    traceId: r.traceId,
    fields: Array.isArray(r.fields) ? r.fields : [],
  };
}

function fromDiagnosis(r: RawEventDiagnosis): EventDiagnosis {
  return {
    humanTitle: r.humanTitle,
    moduleLabel: r.moduleLabel,
    possibleCauses: Array.isArray(r.possibleCauses) ? r.possibleCauses : [],
    troubleshootingSteps: Array.isArray(r.troubleshootingSteps) ? r.troubleshootingSteps : [],
  };
}

/** 事件中心 API（V1F-07，capability ViewAudit）。 */
export const eventsApi = {
  async list(query: EventListQuery): Promise<EventListResponse> {
    const raw = await httpClient.get<RawEventList>("/api/manage/events", {
      params: {
        kind: query.kind || undefined,
        requestId: query.requestId || undefined,
        actor: query.actor || undefined,
        action: query.action || undefined,
        q: query.search || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
      },
    });
    return {
      events: raw.events.map(fromItem),
      total: raw.total,
      page: raw.page,
      pageSize: raw.pageSize,
      runtimeSourceAvailable: raw.runtimeSourceAvailable,
    };
  },

  async get(requestId: string): Promise<EventDetailRecord> {
    const raw = await httpClient.get<RawEventDetail>(
      `/api/manage/events/${encodeURIComponent(requestId)}`,
    );
    return {
      requestId: raw.requestId,
      timeline: raw.timeline.map(fromTimeline),
      result: raw.result,
      errorCode: raw.errorCode,
      diagnosis: raw.diagnosis ? fromDiagnosis(raw.diagnosis) : null,
      auditRecords: raw.auditRecords.map(fromAuditRecord),
      runtimeRecords: Array.isArray(raw.runtimeRecords) ? raw.runtimeRecords : [],
      runtimeSourceAvailable: raw.runtimeSourceAvailable,
    };
  },
};
