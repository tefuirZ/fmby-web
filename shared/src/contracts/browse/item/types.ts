import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';
import type { MediaCardSummary, MediaProgressSummary } from '@fmby/v2-shared/contracts/browse';

export interface ItemTechnicalInfo {
  resolutionLabel?: string;
  containerLabel?: string;
  videoCodecLabel?: string;
  audioCodecLabel?: string;
  dynamicRangeLabel?: string;
  audioTrackCount?: number;
  subtitleCount?: number;
  embeddedSubtitleCount?: number;
  externalSubtitleCount?: number;
  bitrateLabel?: string;
  sourceStatusLabel?: string;
  releaseGroup?: string;
  videoStreams: ItemStreamInfo[];
  audioStreams: ItemStreamInfo[];
  subtitleStreams: ItemStreamInfo[];
}

export interface ItemVersion {
  id: string;
  label: string;
  summary?: string;
  sourceLabel?: string;
  statusLabel?: string;
  selected: boolean;
  directPlay: boolean;
}

export interface AdminShortcut {
  label: string;
  to: string;
}

export interface ItemActor {
  id?: string;
  name: string;
  role?: string;
  thumbUrl?: string;
  profileUrl?: string;
}

export interface ItemStreamInfo {
  index?: number;
  codecName?: string;
  codecTag?: string;
  title?: string;
  language?: string;
  channels?: number;
  channelLayout?: string;
  width?: number;
  height?: number;
  profile?: string;
  bitRate?: number;
  bitDepth?: number;
  pixelFormat?: string;
  colorPrimaries?: string;
  colorSpace?: string;
  colorTransfer?: string;
  aspectRatio?: string;
  averageFrameRate?: number;
  realFrameRate?: number;
  dynamicRangeLabel?: string;
  deliveryUrl?: string;
  subtitleLocationType?: string;
  isExternal?: boolean;
  isTextSubtitleStream?: boolean;
  isDefault: boolean;
  isForced: boolean;
}

export interface ItemDetailResponse {
  id: string;
  playbackTargetId?: string;
  title: string;
  kind: 'movie' | 'series' | 'season' | 'episode' | 'music' | 'video' | 'collection' | 'other';
  originalTitle?: string;
  tagline?: string;
  description: string;
  kindLabel: string;
  year?: number;
  ratingLabel?: string;
  communityRating?: number;
  premiered?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  itemCount?: number;
  runtimeSeconds?: number;
  progress?: MediaProgressSummary;
  artwork: ArtworkSet;
  meta: string[];
  genres: string[];
  tags: string[];
  directors: string[];
  directorPeople: ItemActor[];
  actors: ItemActor[];
  studios: string[];
  library?: {
    id: string;
    name: string;
  };
  series?: {
    id: string;
    name: string;
  };
  season?: {
    id: string;
    name: string;
  };
  technical: ItemTechnicalInfo;
  children: MediaCardSummary[];
  related: MediaCardSummary[];
  versions: ItemVersion[];
  adminShortcuts: AdminShortcut[];
  canPlay: boolean;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  lastPlayedAt?: string;
  addedAt?: string;
  sourceStatusLabel?: string;
}
