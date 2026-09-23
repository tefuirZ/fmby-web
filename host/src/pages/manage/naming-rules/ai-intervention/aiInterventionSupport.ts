/**
 * AI 干预区共享辅助（FE-AI-INTERVENTIONS，照 V1 `aiInterventionSupport.ts` 对位）。
 */

import type {
  AiInterventionMessageRole,
  AiInterventionRunKind,
  AiInterventionSessionState,
  AiInterventionSkillKey,
} from '@fmby/v2-shared/contracts/manage/aiInterventions';

export const SKILL_OPTIONS: Array<{ value: AiInterventionSkillKey; label: string }> = [
  { value: 'naming_cleanup', label: '命名清理' },
  { value: 'candidate_rerank', label: '候选重排' },
  { value: 'scrape_repair', label: '刮削修复' },
  { value: 'conflict_explainer', label: '冲突解释' },
];

const SKILL_LABELS: Record<AiInterventionSkillKey, string> = {
  naming_cleanup: '命名清理',
  candidate_rerank: '候选重排',
  scrape_repair: '刮削修复',
  conflict_explainer: '冲突解释',
};

export function skillLabel(value?: AiInterventionSkillKey | null): string {
  return value ? (SKILL_LABELS[value] ?? value) : '—';
}

export function runKindLabel(value: AiInterventionRunKind | string): string {
  switch (value) {
    case 'AutoRun':
      return '自动运行';
    case 'AdminSessionTurn':
      return '管理员会话轮次';
    case 'AdminApply':
      return '管理员确认应用';
    default:
      return value;
  }
}

export function sessionStateLabel(value: AiInterventionSessionState | string): string {
  return value === 'Open' ? '会话进行中' : value === 'Closed' ? '会话已关闭' : value;
}

export function messageRoleLabel(value: AiInterventionMessageRole | string): string {
  switch (value) {
    case 'System':
      return '系统';
    case 'User':
      return '管理员';
    case 'Assistant':
      return 'AI';
    default:
      return value;
  }
}

/** 短 id（前 8 位）；空 → '—'。 */
export function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 8);
}

/** JSON 文本美化；非法/空 → 原样或占位。 */
export function formatJsonForDisplay(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 从 URL 读 `?aiMediaItemId=`（照 V1，轻量分享/深链）。 */
export function readAiMediaItemIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('aiMediaItemId');
}

/** 同步 `?aiMediaItemId=` 到 URL（replaceState，不产生历史）。 */
export function syncAiMediaItemIdToUrl(mediaItemId: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (mediaItemId) url.searchParams.set('aiMediaItemId', mediaItemId);
  else url.searchParams.delete('aiMediaItemId');
  window.history.replaceState(window.history.state, '', url.toString());
}
