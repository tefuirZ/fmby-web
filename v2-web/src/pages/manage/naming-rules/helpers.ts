import type {
  NamingCleanupCustomTerm,
  NamingCleanupLibraryType,
  NamingCleanupMatchMode,
  NamingCleanupPreviewResponse,
  NamingCleanupReplayIdentifyResponse,
  NamingCleanupReplayScope,
  NamingCleanupSettings,
  UpdateNamingCleanupSettingsRequest,
} from '@/domains/manage/naming';

export const LIBRARY_OPTIONS: Array<{ value: NamingCleanupLibraryType; label: string }> = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'music', label: '音乐' },
  { value: 'mixed', label: '混合库' },
];

export const MATCH_MODE_OPTIONS: Array<{
  value: NamingCleanupMatchMode;
  label: string;
  hint: string;
}> = [
  { value: 'token', label: 'Token', hint: '按单个切分词命中，适合 2160p / WEB-DL / AAC 这类词。' },
  { value: 'contains', label: 'Contains', hint: '按连续片段命中，适合字幕组、片源尾巴、批量标识。' },
];

export const REPLAY_SCOPE_OPTIONS: Array<{
  value: NamingCleanupReplayScope;
  label: string;
  hint: string;
}> = [
  {
    value: 'library',
    label: '指定媒体库',
    hint: '先拿单库试刀，别一上来就把全站 identify 队列打爆。',
  },
  {
    value: 'all',
    label: '全部媒体库',
    hint: '按当前已保存规则对所有媒体重排，适合规则包大改后的集中回灌。',
  },
];

export function createDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyCustomTerm(): NamingCleanupCustomTerm {
  return {
    id: createDraftId(),
    term: '',
    matchMode: 'token',
    category: 'custom',
    enabled: true,
    note: '',
  };
}

export function toDraft(
  settings: NamingCleanupSettings,
): UpdateNamingCleanupSettingsRequest {
  return {
    customTerms: settings.customTerms.map((item) => ({ ...item })),
    disabledDefaultTerms: [...settings.disabledDefaultTerms],
    protectedTerms: [...settings.protectedTerms],
  };
}

export function createEmptyDraft(): UpdateNamingCleanupSettingsRequest {
  return {
    customTerms: [],
    disabledDefaultTerms: [],
    protectedTerms: [],
  };
}

export function normalizeCleanupToken(value: string) {
  const normalized = Array.from(value.trim())
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join('')
    .toLocaleLowerCase('zh-CN');
  return normalized || undefined;
}

export function normalizeDraftForSubmit(
  draft: UpdateNamingCleanupSettingsRequest,
): UpdateNamingCleanupSettingsRequest {
  const seenCustomTerms = new Set<string>();
  const customTerms = draft.customTerms
    .map((item) => {
      const term = item.term.trim();
      const note = item.note?.trim();
      return {
        ...item,
        term,
        category: item.category.trim() || 'custom',
        note: note || undefined,
        matchMode: item.matchMode === 'contains' ? ('contains' as const) : ('token' as const),
      };
    })
    .filter((item) => item.term.length > 0)
    .filter((item) => {
      const normalized = normalizeCleanupToken(item.term);
      if (!normalized) {
        return false;
      }
      const dedupeKey = `${normalized}:${item.matchMode}`;
      if (seenCustomTerms.has(dedupeKey)) {
        return false;
      }
      seenCustomTerms.add(dedupeKey);
      return true;
    });

  const normalizeList = (values: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const normalized = normalizeCleanupToken(value);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  };

  return {
    customTerms,
    disabledDefaultTerms: normalizeList(draft.disabledDefaultTerms),
    protectedTerms: normalizeList(draft.protectedTerms),
  };
}

export function buildDraftKey(
  draft: UpdateNamingCleanupSettingsRequest | null,
) {
  if (!draft) {
    return '';
  }
  return JSON.stringify(normalizeDraftForSubmit(draft));
}

export function formatConfidence(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return '0%';
  }
  return `${Math.round(value * 100)}%`;
}

export function buildPreviewHeadline(preview: NamingCleanupPreviewResponse) {
  const suffix = [
    preview.yearGuess ? `${preview.yearGuess}` : undefined,
    preview.seasonGuess ? `S${String(preview.seasonGuess).padStart(2, '0')}` : undefined,
    preview.episodeGuess ? `E${String(preview.episodeGuess).padStart(2, '0')}` : undefined,
  ].filter(Boolean);
  return suffix.length > 0
    ? `${preview.titleGuess} · ${suffix.join(' · ')}`
    : preview.titleGuess;
}

export function buildReplayResultSummary(result: NamingCleanupReplayIdentifyResponse) {
  const scopeLabel =
    result.scope === 'all'
      ? '全部媒体库'
      : (result.libraryName ?? '指定媒体库');
  return `${scopeLabel} 已处理 ${result.totalItems} 条媒体，新增入队 ${result.queuedCount}，刷新 ${result.updatedCount}，跳过 ${result.skippedCount}。`;
}
