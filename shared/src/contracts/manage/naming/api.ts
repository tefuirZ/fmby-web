import { httpClient } from '@fmby/v2-shared/api/client';
import type {
  NamingCleanupCustomTerm,
  NamingCleanupPreviewRequest,
  NamingCleanupPreviewResponse,
  NamingCleanupReplayIdentifyRequest,
  NamingCleanupReplayIdentifyResponse,
  NamingScrapeBatchRepairRequest,
  NamingScrapeBatchRepairResponse,
  NamingScrapeSettings,
  NamingCleanupSettings,
  SourceAvailabilitySettings,
  SourceAccessSettings,
  UpdateNamingScrapeSettingsRequest,
  UpdateNamingCleanupSettingsRequest,
} from './types';

interface RawNamingCleanupCustomTerm {
  id: string;
  term: string;
  match_mode: string;
  category: string;
  enabled: boolean;
  note?: string | null;
}

interface RawNamingCleanupSettingsResponse {
  rule_pack_version: string;
  default_terms: string[];
  active_default_terms: string[];
  custom_terms: RawNamingCleanupCustomTerm[];
  disabled_default_terms: string[];
  protected_terms: string[];
}

interface RawSourceAvailabilitySettingsResponse {
  enabled: boolean;
  failure_threshold: number;
  auto_recover_on_success: boolean;
}

interface RawSourceAccessSettingsResponse {
  unauthorized_visibility_mode: string;
}

interface RawNamingScrapeSettingsResponse {
  metadata_language: string;
  metadata_region: string;
  subtitle_language?: string | null;
  metadata_source?: string | null;
  title_source?: string | null;
  poster_language_mode: string;
  scrape_after_identify: boolean;
  imghost_auto_upload: boolean;
  source_availability?: RawSourceAvailabilitySettingsResponse | null;
  source_access?: RawSourceAccessSettingsResponse | null;
  cleanup: RawNamingCleanupSettingsResponse;
}

interface RawNamingCleanupPreviewResponse {
  rule_pack_version: string;
  title_guess?: string | null;
  original_title_guess?: string | null;
  year_guess?: number | null;
  media_type_guess?: string | null;
  season_guess?: number | null;
  episode_guess?: number | null;
  explicit_ids?: Array<[string, string]> | null;
  tags?: string[] | null;
  confidence?: number | null;
  trace?: string[] | null;
  removed_tokens?: string[] | null;
  matched_default_terms?: string[] | null;
  matched_custom_terms?: string[] | null;
}

interface RawNamingCleanupReplayIdentifyResponse {
  scope: string;
  library_id?: string | null;
  library_name?: string | null;
  rule_pack_version: string;
  total_items: number;
  queued_count: number;
  updated_count: number;
  skipped_count: number;
}

interface RawNamingScrapeBatchRepairResponse {
  scope: string;
  library_id?: string | null;
  library_name?: string | null;
  total_candidates: number;
  queued_count: number;
  updated_count: number;
  skipped_count: number;
}

function mapCustomTerm(raw: RawNamingCleanupCustomTerm): NamingCleanupCustomTerm {
  return {
    id: raw.id,
    term: raw.term,
    matchMode: raw.match_mode === 'contains' ? 'contains' : 'token',
    category: raw.category,
    enabled: raw.enabled,
    note: raw.note ?? undefined,
  };
}

function mapSettings(raw: RawNamingCleanupSettingsResponse): NamingCleanupSettings {
  return {
    rulePackVersion: raw.rule_pack_version,
    defaultTerms: raw.default_terms ?? [],
    activeDefaultTerms: raw.active_default_terms ?? [],
    customTerms: (raw.custom_terms ?? []).map(mapCustomTerm),
    disabledDefaultTerms: raw.disabled_default_terms ?? [],
    protectedTerms: raw.protected_terms ?? [],
  };
}

function mapSourceAvailability(
  raw?: RawSourceAvailabilitySettingsResponse | null,
): SourceAvailabilitySettings {
  return {
    enabled: raw?.enabled ?? true,
    failureThreshold: raw?.failure_threshold ?? 3,
    autoRecoverOnSuccess: raw?.auto_recover_on_success ?? true,
  };
}

function mapSourceAccess(
  raw?: RawSourceAccessSettingsResponse | null,
): SourceAccessSettings {
  return {
    unauthorizedVisibilityMode:
      raw?.unauthorized_visibility_mode === 'visible_blocked'
        ? 'visible_blocked'
        : 'hidden',
  };
}

function mapScrapeSettings(raw: RawNamingScrapeSettingsResponse): NamingScrapeSettings {
  return {
    metadataLanguage: raw.metadata_language,
    metadataRegion: raw.metadata_region,
    subtitleLanguage: raw.subtitle_language ?? undefined,
    metadataSource:
      (raw.metadata_source ?? raw.title_source) === 'douban' ? 'douban' : 'tmdb',
    posterLanguageMode:
      raw.poster_language_mode === 'original'
        ? 'original'
        : raw.poster_language_mode === 'any'
          ? 'any'
          : 'metadata',
    scrapeAfterIdentify: raw.scrape_after_identify,
    imghostAutoUpload: raw.imghost_auto_upload ?? false,
    sourceAvailability: mapSourceAvailability(raw.source_availability),
    sourceAccess: mapSourceAccess(raw.source_access),
    cleanup: mapSettings(raw.cleanup),
  };
}

function mapUpdatePayload(payload: UpdateNamingCleanupSettingsRequest) {
  return {
    custom_terms: payload.customTerms.map((item) => ({
      id: item.id,
      term: item.term,
      match_mode: item.matchMode,
      category: item.category,
      enabled: item.enabled,
      note: item.note,
    })),
    disabled_default_terms: payload.disabledDefaultTerms,
    protected_terms: payload.protectedTerms,
  };
}

function mapScrapeUpdatePayload(payload: UpdateNamingScrapeSettingsRequest) {
  return {
    metadata_language: payload.metadataLanguage,
    metadata_region: payload.metadataRegion,
    subtitle_language: payload.subtitleLanguage?.trim() || null,
    metadata_source: payload.metadataSource,
    poster_language_mode: payload.posterLanguageMode,
    scrape_after_identify: payload.scrapeAfterIdentify,
    imghost_auto_upload: payload.imghostAutoUpload,
    source_availability: {
      enabled: payload.sourceAvailability.enabled,
      failure_threshold: payload.sourceAvailability.failureThreshold,
      auto_recover_on_success: payload.sourceAvailability.autoRecoverOnSuccess,
    },
    source_access: {
      unauthorized_visibility_mode: payload.sourceAccess.unauthorizedVisibilityMode,
    },
    cleanup: mapUpdatePayload(payload.cleanup),
  };
}

function mapPreviewResponse(raw: RawNamingCleanupPreviewResponse): NamingCleanupPreviewResponse {
  return {
    rulePackVersion: raw.rule_pack_version,
    titleGuess: raw.title_guess ?? undefined,
    originalTitleGuess: raw.original_title_guess ?? undefined,
    yearGuess: raw.year_guess ?? undefined,
    mediaTypeGuess: raw.media_type_guess ?? undefined,
    seasonGuess: raw.season_guess ?? undefined,
    episodeGuess: raw.episode_guess ?? undefined,
    explicitIds: (raw.explicit_ids ?? []).map(([provider, id]) => ({ provider, id })),
    tags: raw.tags ?? [],
    confidence: raw.confidence ?? 0,
    trace: raw.trace ?? [],
    removedTokens: raw.removed_tokens ?? [],
    matchedDefaultTerms: raw.matched_default_terms ?? [],
    matchedCustomTerms: raw.matched_custom_terms ?? [],
  };
}

function mapReplayIdentifyResponse(
  raw: RawNamingCleanupReplayIdentifyResponse,
): NamingCleanupReplayIdentifyResponse {
  return {
    scope: raw.scope === 'library' ? 'library' : 'all',
    libraryId: raw.library_id ?? undefined,
    libraryName: raw.library_name ?? undefined,
    rulePackVersion: raw.rule_pack_version,
    totalItems: raw.total_items ?? 0,
    queuedCount: raw.queued_count ?? 0,
    updatedCount: raw.updated_count ?? 0,
    skippedCount: raw.skipped_count ?? 0,
  };
}

function mapBatchRepairResponse(
  raw: RawNamingScrapeBatchRepairResponse,
): NamingScrapeBatchRepairResponse {
  return {
    scope: raw.scope === 'library' ? 'library' : 'all',
    libraryId: raw.library_id ?? undefined,
    libraryName: raw.library_name ?? undefined,
    totalCandidates: raw.total_candidates ?? 0,
    queuedCount: raw.queued_count ?? 0,
    updatedCount: raw.updated_count ?? 0,
    skippedCount: raw.skipped_count ?? 0,
  };
}

export const namingCleanupApi = {
  async getScrapeSettings(): Promise<NamingScrapeSettings> {
    const raw = await httpClient.get<RawNamingScrapeSettingsResponse>('/api/manage/naming-scrape');
    return mapScrapeSettings(raw);
  },

  async updateScrapeSettings(
    payload: UpdateNamingScrapeSettingsRequest,
  ): Promise<NamingScrapeSettings> {
    const raw = await httpClient.put<RawNamingScrapeSettingsResponse>(
      '/api/manage/naming-scrape',
      {
        body: mapScrapeUpdatePayload(payload),
      },
    );
    return mapScrapeSettings(raw);
  },

  async getSettings(): Promise<NamingCleanupSettings> {
    const raw = await httpClient.get<RawNamingCleanupSettingsResponse>(
      '/api/manage/naming-cleanup',
    );
    return mapSettings(raw);
  },

  async updateSettings(
    payload: UpdateNamingCleanupSettingsRequest,
  ): Promise<NamingCleanupSettings> {
    const raw = await httpClient.put<RawNamingCleanupSettingsResponse>(
      '/api/manage/naming-cleanup',
      {
        body: mapUpdatePayload(payload),
      },
    );
    return mapSettings(raw);
  },

  async preview(
    payload: NamingCleanupPreviewRequest,
  ): Promise<NamingCleanupPreviewResponse> {
    const raw = await httpClient.post<RawNamingCleanupPreviewResponse>(
      '/api/manage/naming-cleanup/preview',
      {
        body: {
          raw_path: payload.rawPath,
          library_type: payload.libraryType,
          settings: payload.settings ? mapUpdatePayload(payload.settings) : undefined,
        },
      },
    );
    return mapPreviewResponse(raw);
  },

  async replayIdentify(
    payload: NamingCleanupReplayIdentifyRequest,
  ): Promise<NamingCleanupReplayIdentifyResponse> {
    const raw = await httpClient.post<RawNamingCleanupReplayIdentifyResponse>(
      '/api/manage/naming-cleanup/replay-identify',
      {
        body: {
          scope: payload.scope,
          library_id: payload.libraryId,
        },
      },
    );
    return mapReplayIdentifyResponse(raw);
  },

  async batchRepair(
    payload: NamingScrapeBatchRepairRequest,
  ): Promise<NamingScrapeBatchRepairResponse> {
    const raw = await httpClient.post<RawNamingScrapeBatchRepairResponse>(
      '/api/manage/naming-scrape/batch-repair',
      {
        body: {
          scope: payload.scope,
          library_id: payload.libraryId,
          include_missing_metadata: payload.includeMissingMetadata,
          include_missing_poster: payload.includeMissingPoster,
        },
      },
    );
    return mapBatchRepairResponse(raw);
  },
};
