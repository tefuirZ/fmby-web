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

  // F-48：poster（detail 迟到约 1s）与 resumePosition（渲染期读 localStorage，
  // 随播放进度每次 timeupdate 都变）都不是**媒体身份**——把它们放进建引擎的
  // 依赖里，会让每次抖动都 destroy + recreate 整个引擎，表现为「video 从头
  // 重启、进度跳动」。故与 episodeNavigationRef / callbackRefs 同款处理：捕获
  // 挂载初值，只让真正决定「换一条媒体」的 url 触发重建。
  //
  // ponytail: 捕获初值 = 首次构造即生效。副作用：同一 url 上后到的 poster 不会
  // 补显示、resumePosition 后到不会补 seek。升级路径：引擎加
  // setPoster()/seek() 增量 API 后改为「首帧后按需增量更新」，避免重建。
  const initialPosterRef = useRef(poster);
  const initialResumePositionRef = useRef(resumePosition);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    let disposed = false;
    let currentEngine: PlayerEngine | null = null;

    void createPlayerEngine({
      container,
      url,
      poster: initialPosterRef.current,
      subtitleUrl,
      subtitleLabel,
      theme,
      autoplay,
      resumePosition: initialResumePositionRef.current,
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
    // F-48：poster / resumePosition 移出依赖（见上方 initial*Ref 注释）——它们
    // 不是媒体身份，每次抖动重建会让 video 从头重启。其余（字幕/主题/自动播）
    // 仍是建引擎参数，保留。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, subtitleUrl, subtitleLabel, theme, autoplay]);

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
