import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';

export type MediaKind =
  | 'movie'
  | 'series'
  | 'season'
  | 'episode'
  | 'music'
  | 'video'
  | 'collection'
  | 'other';

export interface MediaProgressSummary {
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  remainingLabel?: string;
  lastPlayedAt?: string;
}

export interface MediaCardSummary {
  id: string;
  playbackTargetId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  availabilityNotice?: string;
  kind: MediaKind;
  kindLabel: string;
  year?: number;
  durationSeconds?: number;
  itemCount?: number;
  resolutionLabel?: string;
  ratingLabel?: string;
  addedAt?: string;
  lastPlayedAt?: string;
  libraryId?: string;
  libraryName?: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
  seasonName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  tags: string[];
  artwork: ArtworkSet;
  progress?: MediaProgressSummary;
  badge?: string;
  hasPlayableSource: boolean;
}

export interface BrowseHero {
  item: MediaCardSummary;
  description: string;
  meta: string[];
  primaryActionLabel: string;
  primaryActionTo: string;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
}

export interface BrowseHomeData {
  hero: BrowseHero | null;
  hotItems: MediaCardSummary[];
  recentlyAdded: MediaCardSummary[];
  continueWatching: MediaCardSummary[];
}

export interface LibrarySummary {
  id: string;
  name: string;
  typeLabel: string;
  description?: string;
  itemCount: number;
  updatedAt?: string;
  artwork: ArtworkSet;
  accentLabel?: string;
}

export interface BrowseFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface LibraryFilterSet {
  mediaTypes: BrowseFilterOption[];
  resolutions: BrowseFilterOption[];
  watchedStates: BrowseFilterOption[];
  sortOptions: BrowseFilterOption[];
}

export interface LibraryDetailResponse {
  library: LibrarySummary;
  heroSummary?: string;
  items: MediaCardSummary[];
  filters: LibraryFilterSet;
  total: number;
  nextCursor?: string;
  hasMore?: boolean;
}
