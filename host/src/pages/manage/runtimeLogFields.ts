// runtime 日志呈现：字段抽取 + 视图构建（extract*/build*/formatRuntimeTargetLabel + 视图接口）。
// 从 runtimeLogPresentation.ts 拆出（FE-COMPONENT-SPLIT-B2）；行为零变更。

import type { RuntimeLogRecord } from '@fmby/v2-shared/contracts/manage';

import { TARGET_LABELS, EVENT_LABELS, FIELD_LABELS, PRIMARY_FIELD_ORDER } from './runtimeLogLabels';
import {
  cleanupFieldValue,
  normalizeUnknown,
  formatFieldValue,
  shortenValue,
  prettifyKey,
} from './runtimeLogFormatters';
export function buildHeadline(eventLabel: string, method?: string, path?: string) {
  if (method || path) {
    return [method?.toUpperCase(), path].filter(Boolean).join(' ') || eventLabel;
  }
  return eventLabel;
}

export function buildRequestLabel(displayName?: string, username?: string, userId?: string) {
  const parts = [displayName, username, userId].filter(Boolean);
  return parts.join(' · ') || '未记录';
}

export function formatRuntimeTargetLabel(target?: string) {
  if (!target) {
    return '运行日志';
  }

  const matched = TARGET_LABELS.find((entry) => entry.pattern.test(target));
  if (matched) {
    return matched.label;
  }

  return target
    .split('::')
    .filter(Boolean)
    .slice(-2)
    .join(' / ');
}

export function normalizeEventLabel(value: string) {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized) {
    return '日志事件';
  }

  const matched = EVENT_LABELS.find((entry) => entry.pattern.test(normalized));
  return matched?.label ?? normalized;
}

export function buildResultLabel(fieldMap: Map<string, string>, status?: string, elapsedMs?: string) {
  const parts = [];
  if (status) {
    parts.push(formatFieldValue('status', status));
  } else {
    const sourceStatus = normalizeUnknown(fieldMap.get('source_status'));
    if (sourceStatus) {
      parts.push(formatFieldValue('source_status', sourceStatus));
    }
  }
  if (elapsedMs) {
    parts.push(`${elapsedMs} 毫秒`);
  }

  const error = normalizeUnknown(fieldMap.get('error'));
  if (parts.length === 0 && error) {
    return shortenValue(error, 36);
  }

  const reason = normalizeUnknown(fieldMap.get('reason'));
  if (parts.length === 0 && reason) {
    return formatFieldValue('reason', reason);
  }

  return parts.join(' · ') || '已记录';
}

export interface RuntimeLogView {
  record: RuntimeLogRecord;
  headline: string;
  eventLabel: string;
  targetLabel: string;
  resultLabel: string;
  actorLabel: string;
  requestLabel: string;
  primaryFields: RuntimeLogFieldView[];
  extraFields: RuntimeLogFieldView[];
}

export function buildRuntimeLogView(record: RuntimeLogRecord): RuntimeLogView {
  const eventLabel = normalizeEventLabel(extractLeadingText(record.message) || record.message);
  const fieldMap = extractStructuredFields(record.rawLine);
  const requestId = record.requestId ?? fieldMap.get('request_id');
  const method = fieldMap.get('method');
  const path = fieldMap.get('path');
  const status = normalizeUnknown(fieldMap.get('status'));
  const elapsedMs = normalizeUnknown(fieldMap.get('elapsed_ms'));
  const client = normalizeUnknown(fieldMap.get('client'));
  const ipAddress = normalizeUnknown(fieldMap.get('ip'));
  const username = normalizeUnknown(fieldMap.get('username'));
  const displayName = normalizeUnknown(fieldMap.get('display_name'));
  const userId = normalizeUnknown(fieldMap.get('user_id'));

  if (requestId) {
    fieldMap.set('request_id', requestId);
  }

  const primaryFields = PRIMARY_FIELD_ORDER.flatMap((key) => {
    const value = normalizeUnknown(fieldMap.get(key));
    return value
      ? [
          {
            key,
            label: FIELD_LABELS[key] ?? key,
            value: formatFieldValue(key, value),
          },
        ]
      : [];
  });

  const extraFields = Array.from(fieldMap.entries())
    .filter(([key, value]) => !PRIMARY_FIELD_ORDER.includes(key) && normalizeUnknown(value))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] ?? prettifyKey(key),
      value: formatFieldValue(key, value),
    }));

  return {
    record,
    headline: buildHeadline(eventLabel, method, path),
    eventLabel,
    targetLabel: formatRuntimeTargetLabel(record.target),
    resultLabel: buildResultLabel(fieldMap, status, elapsedMs),
    actorLabel: buildActorLabel(client, ipAddress),
    requestLabel: buildRequestLabel(displayName, username, userId),
    primaryFields,
    extraFields,
  };
}

export function buildActorLabel(client?: string, ipAddress?: string) {
  const parts = [client, ipAddress].filter(Boolean);
  return parts.join(' · ') || '未记录';
}

export interface RuntimeLogFieldView {
  key: string;
  label: string;
  value: string;
}

export function extractLeadingText(message: string) {
  const match = message.match(/(?:^|\s)([a-zA-Z_][a-zA-Z0-9_]*)=/u);
  if (!match || match.index === undefined) {
    return message.trim();
  }
  return message.slice(0, match.index).trim();
}

export function extractStructuredFields(rawLine: string) {
  const matches = Array.from(
    rawLine.matchAll(/(?:^|\s)([a-zA-Z_][a-zA-Z0-9_]*)=/g),
  );
  const fields = new Map<string, string>();

  matches.forEach((match, index) => {
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index ?? rawLine.length : rawLine.length;
    const value = cleanupFieldValue(rawLine.slice(valueStart, valueEnd).trim());
    if (value) {
      fields.set(key, value);
    }
  });

  return fields;
}
