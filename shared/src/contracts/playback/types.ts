import type { ArtworkSet } from '@/domains/assets';

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
