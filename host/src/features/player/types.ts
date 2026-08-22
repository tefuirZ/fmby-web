export interface VideoPlayerProps {
  /** Video source URL */
  url: string;
  /** Poster / cover image */
  poster?: string;
  /** Subtitle track URL (WebVTT) */
  subtitleUrl?: string;
  /** Subtitle label for display (reserved for multi-subtitle support) */
  subtitleLabel?: string;
  /** Theme accent color */
  theme?: string;
  /** Auto play on mount */
  autoplay?: boolean;
  /** Resume position in seconds */
  resumePosition?: number;
  /** Called periodically with current playback time */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Called when video starts playing */
  onPlay?: () => void;
  /** Called when video is paused */
  onPause?: (currentTime: number, duration: number) => void;
  /** Called when video playback ends */
  onEnded?: (currentTime: number, duration: number) => void;
  /** Called when a playback error occurs */
  onError?: (error: unknown) => void;
  /** Called when seek completes */
  onSeeked?: (currentTime: number) => void;
  /** Additional CSS class for the container */
  className?: string;
}

export type PlayerEngineId = 'dplayer' | 'artplayer';

export interface PlayerEngineCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: (currentTime: number, duration: number) => void;
  onEnded?: (currentTime: number, duration: number) => void;
  onError?: (error: unknown) => void;
  onSeeked?: (currentTime: number) => void;
}

export interface PlayerEngineCreateOptions extends PlayerEngineCallbacks {
  container: HTMLDivElement;
  url: string;
  poster?: string;
  subtitleUrl?: string;
  subtitleLabel?: string;
  theme: string;
  autoplay: boolean;
  resumePosition?: number;
}

export interface PlayerEngine {
  destroy(): void;
  seek(time: number): void;
  play(): void;
  pause(): void;
  setSpeed(rate: number): void;
  setVolume(value: number): void;
}

export interface PlayerEngineAdapter {
  create(options: PlayerEngineCreateOptions): Promise<PlayerEngine>;
}