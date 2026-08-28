import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { createPlayerEngine } from './PlayerEngineFactory';
import type { PlayerEngine, VideoPlayerProps } from './types';
import { createPlayerEngineHandle } from './playerHandle';

/**
 * Engine-factory based video player wrapper for React.
 * Keeps PlayPage independent from the concrete player implementation.
 */
const VideoPlayerImpl = forwardRef<PlayerEngine | null, VideoPlayerProps>(function VideoPlayer(
  {
    url,
  poster,
  subtitleUrl,
  subtitleLabel,
  // 播放器内核只接受固定色值（不能吃 CSS 变量），暗房里进度与高亮统一用白
  theme = '#ffffff',
  autoplay = true,
  resumePosition,
  episodeNavigation,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  onError,
  onSeeked,
  className,
  }: VideoPlayerProps,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  useImperativeHandle(ref, () => createPlayerEngineHandle(() => engineRef.current), []);
  const episodeNavigationRef = useRef(episodeNavigation);
  episodeNavigationRef.current = episodeNavigation;
  const callbackRefs = useRef({ onTimeUpdate, onPlay, onPause, onEnded, onError, onSeeked });
  callbackRefs.current = { onTimeUpdate, onPlay, onPause, onEnded, onError, onSeeked };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    let disposed = false;
    let currentEngine: PlayerEngine | null = null;

    void createPlayerEngine({
      container,
      url,
      poster,
      subtitleUrl,
      subtitleLabel,
      theme,
      autoplay,
      resumePosition,
      episodeNavigation: episodeNavigationRef.current,
      onTimeUpdate: (currentTime, duration) => {
        callbackRefs.current.onTimeUpdate?.(currentTime, duration);
      },
      onPlay: () => {
        callbackRefs.current.onPlay?.();
      },
      onPause: (currentTime, duration) => {
        callbackRefs.current.onPause?.(currentTime, duration);
      },
      onEnded: (currentTime, duration) => {
        callbackRefs.current.onEnded?.(currentTime, duration);
      },
      onError: (error) => {
        callbackRefs.current.onError?.(error);
      },
      onSeeked: (currentTime) => {
        callbackRefs.current.onSeeked?.(currentTime);
      },
    })
      .then((engine) => {
        if (disposed) {
          engine.destroy();
          return;
        }
        currentEngine = engine;
        engineRef.current = engine;
      })
      .catch((error) => {
        if (!disposed) {
          callbackRefs.current.onError?.(error);
        }
      });

    return () => {
      disposed = true;
      currentEngine?.destroy();
      currentEngine = null;
      engineRef.current = null;
    };
    // Only re-create when media identity or engine input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, poster, subtitleUrl, subtitleLabel, theme, autoplay, resumePosition]);

  useEffect(() => {
    engineRef.current?.setEpisodeNavigation?.(episodeNavigation);
  }, [episodeNavigation]);

  // 剧集导航按钮由播放器内核（ArtPlayer control）在容器内渲染；
  // 此前容器外还挂过一组同名 data-testid 的游离按钮，导致测试选择器重复，已删除。
  return <div ref={containerRef} className={className} />;
});

export const VideoPlayer = VideoPlayerImpl;

/** Expose imperative API for parent components */
export function useVideoPlayerRef() {
  const ref = useRef<PlayerEngine | null>(null);
  const seek = useCallback((time: number) => ref.current?.seek(time), []);
  const play = useCallback(() => ref.current?.play(), []);
  const pause = useCallback(() => ref.current?.pause(), []);
  const setSpeed = useCallback((rate: number) => ref.current?.setSpeed(rate), []);
  const setVolume = useCallback((v: number) => ref.current?.setVolume(v), []);
  return { ref, seek, play, pause, setSpeed, setVolume };
}
