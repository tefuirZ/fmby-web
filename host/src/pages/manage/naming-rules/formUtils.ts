import type {
  NamingScrapeSettings,
  UpdateNamingScrapeSettingsRequest,
} from '@/domains/manage/naming';
import { createEmptyDraft, normalizeDraftForSubmit } from './helpers';

const DEFAULT_SCRAPE_DRAFT: UpdateNamingScrapeSettingsRequest = {
  metadataLanguage: 'zh-CN',
  metadataRegion: 'CN',
  subtitleLanguage: 'zh-CN',
  metadataSource: 'tmdb',
  posterLanguageMode: 'metadata',
  scrapeAfterIdentify: true,
  imghostAutoUpload: false,
  sourceAvailability: {
    enabled: true,
    failureThreshold: 3,
    autoRecoverOnSuccess: true,
  },
  sourceAccess: {
    unauthorizedVisibilityMode: 'hidden',
  },
  cleanup: createEmptyDraft(),
};

export function createEmptyScrapeDraft(): UpdateNamingScrapeSettingsRequest {
  return {
    metadataLanguage: DEFAULT_SCRAPE_DRAFT.metadataLanguage,
    metadataRegion: DEFAULT_SCRAPE_DRAFT.metadataRegion,
    subtitleLanguage: DEFAULT_SCRAPE_DRAFT.subtitleLanguage,
    metadataSource: DEFAULT_SCRAPE_DRAFT.metadataSource,
    posterLanguageMode: DEFAULT_SCRAPE_DRAFT.posterLanguageMode,
    scrapeAfterIdentify: DEFAULT_SCRAPE_DRAFT.scrapeAfterIdentify,
    imghostAutoUpload: DEFAULT_SCRAPE_DRAFT.imghostAutoUpload,
    sourceAvailability: { ...DEFAULT_SCRAPE_DRAFT.sourceAvailability },
    sourceAccess: { ...DEFAULT_SCRAPE_DRAFT.sourceAccess },
    cleanup: createEmptyDraft(),
  };
}

export function toScrapeDraft(
  settings: NamingScrapeSettings,
): UpdateNamingScrapeSettingsRequest {
  return {
    metadataLanguage: settings.metadataLanguage,
    metadataRegion: settings.metadataRegion,
    subtitleLanguage: settings.subtitleLanguage,
    metadataSource: settings.metadataSource,
    posterLanguageMode: settings.posterLanguageMode,
    scrapeAfterIdentify: settings.scrapeAfterIdentify,
    imghostAutoUpload: settings.imghostAutoUpload,
    sourceAvailability: {
      enabled: settings.sourceAvailability.enabled,
      failureThreshold: settings.sourceAvailability.failureThreshold,
      autoRecoverOnSuccess: settings.sourceAvailability.autoRecoverOnSuccess,
    },
    sourceAccess: {
      unauthorizedVisibilityMode: settings.sourceAccess.unauthorizedVisibilityMode,
    },
    cleanup: {
      customTerms: settings.cleanup.customTerms.map((item) => ({ ...item })),
      disabledDefaultTerms: [...settings.cleanup.disabledDefaultTerms],
      protectedTerms: [...settings.cleanup.protectedTerms],
    },
  };
}

export function normalizeScrapeDraftForSubmit(
  draft: UpdateNamingScrapeSettingsRequest,
): UpdateNamingScrapeSettingsRequest {
  return {
    metadataLanguage: draft.metadataLanguage.trim() || DEFAULT_SCRAPE_DRAFT.metadataLanguage,
    metadataRegion:
      draft.metadataRegion.trim().toUpperCase() || DEFAULT_SCRAPE_DRAFT.metadataRegion,
    subtitleLanguage: draft.subtitleLanguage?.trim() || undefined,
    metadataSource: draft.metadataSource,
    posterLanguageMode: draft.posterLanguageMode,
    scrapeAfterIdentify: draft.scrapeAfterIdentify,
    imghostAutoUpload: draft.imghostAutoUpload,
    sourceAvailability: {
      enabled: draft.sourceAvailability.enabled,
      failureThreshold: Math.min(
        20,
        Math.max(
          1,
          Number.isFinite(draft.sourceAvailability.failureThreshold)
            ? Math.round(draft.sourceAvailability.failureThreshold)
            : DEFAULT_SCRAPE_DRAFT.sourceAvailability.failureThreshold,
        ),
      ),
      autoRecoverOnSuccess: draft.sourceAvailability.autoRecoverOnSuccess,
    },
    sourceAccess: {
      unauthorizedVisibilityMode: draft.sourceAccess.unauthorizedVisibilityMode,
    },
    cleanup: normalizeDraftForSubmit(draft.cleanup),
  };
}

export function buildScrapeDraftKey(draft: UpdateNamingScrapeSettingsRequest) {
  return JSON.stringify(normalizeScrapeDraftForSubmit(draft));
}
