export type NamingCleanupMatchMode = 'token' | 'contains';
export type NamingCleanupLibraryType = 'movie' | 'series' | 'music' | 'mixed';
export type NamingCleanupReplayScope = 'all' | 'library';
export type NamingMetadataSource = 'tmdb' | 'douban';
export type NamingPosterLanguageMode = 'metadata' | 'original' | 'any';
export type SourceAccessVisibilityMode = 'hidden' | 'visible_blocked';

export interface NamingCleanupCustomTerm {
  id: string;
  term: string;
  matchMode: NamingCleanupMatchMode;
  category: string;
  enabled: boolean;
  note?: string;
}

export interface NamingCleanupSettings {
  rulePackVersion: string;
  defaultTerms: string[];
  activeDefaultTerms: string[];
  customTerms: NamingCleanupCustomTerm[];
  disabledDefaultTerms: string[];
  protectedTerms: string[];
}

export interface SourceAvailabilitySettings {
  enabled: boolean;
  failureThreshold: number;
  autoRecoverOnSuccess: boolean;
}

export interface SourceAccessSettings {
  unauthorizedVisibilityMode: SourceAccessVisibilityMode;
}

export interface UpdateNamingCleanupSettingsRequest {
  customTerms: NamingCleanupCustomTerm[];
  disabledDefaultTerms: string[];
  protectedTerms: string[];
}

export interface NamingScrapeSettings {
  metadataLanguage: string;
  metadataRegion: string;
  subtitleLanguage?: string;
  metadataSource: NamingMetadataSource;
  posterLanguageMode: NamingPosterLanguageMode;
  scrapeAfterIdentify: boolean;
  imghostAutoUpload: boolean;
  sourceAvailability: SourceAvailabilitySettings;
  sourceAccess: SourceAccessSettings;
  cleanup: NamingCleanupSettings;
}

export interface UpdateNamingScrapeSettingsRequest {
  metadataLanguage: string;
  metadataRegion: string;
  subtitleLanguage?: string;
  metadataSource: NamingMetadataSource;
  posterLanguageMode: NamingPosterLanguageMode;
  scrapeAfterIdentify: boolean;
  imghostAutoUpload: boolean;
  sourceAvailability: SourceAvailabilitySettings;
  sourceAccess: SourceAccessSettings;
  cleanup: UpdateNamingCleanupSettingsRequest;
}

export interface NamingCleanupExternalId {
  provider: string;
  id: string;
}

export interface NamingCleanupPreviewRequest {
  rawPath: string;
  libraryType: NamingCleanupLibraryType;
  settings?: UpdateNamingCleanupSettingsRequest;
}

export interface NamingCleanupPreviewResponse {
  rulePackVersion: string;
  titleGuess?: string;
  originalTitleGuess?: string;
  yearGuess?: number;
  mediaTypeGuess?: string;
  seasonGuess?: number;
  episodeGuess?: number;
  explicitIds: NamingCleanupExternalId[];
  tags: string[];
  confidence: number;
  trace: string[];
  removedTokens: string[];
  matchedDefaultTerms: string[];
  matchedCustomTerms: string[];
}

export interface NamingCleanupReplayIdentifyRequest {
  scope: NamingCleanupReplayScope;
  libraryId?: string;
}

export interface NamingCleanupReplayIdentifyResponse {
  scope: NamingCleanupReplayScope;
  libraryId?: string;
  libraryName?: string;
  rulePackVersion: string;
  totalItems: number;
  queuedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface NamingScrapeBatchRepairRequest {
  scope: NamingCleanupReplayScope;
  libraryId?: string;
  includeMissingMetadata: boolean;
  includeMissingPoster: boolean;
}

export interface NamingScrapeBatchRepairResponse {
  scope: NamingCleanupReplayScope;
  libraryId?: string;
  libraryName?: string;
  totalCandidates: number;
  queuedCount: number;
  updatedCount: number;
  skippedCount: number;
}
