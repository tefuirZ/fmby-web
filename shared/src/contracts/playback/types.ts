import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';

export interface PlaybackTrack {
  id: string;
  label: string;
  type: 'audio' | 'subtitle';
  languageLabel?: string;
  codecLabel?: string;
  selected: boolean;
  isDefault: boolean;
}

export interface PlaybackSession {
  sessionId: string;
  itemId: string;
  title: string;
  subtitle?: string;
  streamUrl?: string;
  externalStreamUrl?: string;
  externalStreamExpiresAt?: string;
  externalPlaybackUrl?: string;
  mimeType?: string;
  durationSeconds?: number;
  resumePositionSeconds?: number;
  canUseExternalPlayer: boolean;
  canDirectPlayInBrowser: boolean;
  browserPlaybackHint?: string;
  fallbackHint?: string;
  artwork: ArtworkSet;
  audioTracks: PlaybackTrack[];
  subtitleTracks: PlaybackTrack[];
}

export interface PlaybackProgressUpdate {
  positionSeconds: number;
  durationSeconds?: number;
  paused?: boolean;
  completed?: boolean;
}

export interface PlaybackResolveRequest {
  variantId: string;
}

export interface PlaybackTarget {
  urlRef: string;
  kind: 'direct' | 'hls' | 'dash' | 'external';
  format?: string;
  headers?: Record<string, string>;
}

export interface PlaybackReportRequest {
  sessionId: string;
  progress: number;
  completed?: boolean;
}

