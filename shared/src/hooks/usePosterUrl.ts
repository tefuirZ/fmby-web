import { useCallback, useEffect, useState } from 'react';
import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';

type FallbackStage = 'primary' | 'thumb' | 'backdrop' | 'done';
type BackdropStage = 'banner' | 'backdrop' | 'thumb' | 'poster' | 'done';

export function getPosterInitialStage(artwork: ArtworkSet): FallbackStage {
  if (artwork.posterUrl) return 'primary';
  if (artwork.thumbUrl) return 'thumb';
  if (artwork.backdropUrl) return 'backdrop';
  return 'done';
}

export function getNextPosterStage(stage: FallbackStage, artwork: ArtworkSet): FallbackStage {
  switch (stage) {
    case 'primary':
      return artwork.thumbUrl ? 'thumb' : artwork.backdropUrl ? 'backdrop' : 'done';
    case 'thumb':
      return artwork.backdropUrl ? 'backdrop' : 'done';
    default:
      return 'done';
  }
}

export function getBackdropInitialStage(artwork: ArtworkSet): BackdropStage {
  if (artwork.bannerUrl) return 'banner';
  if (artwork.backdropUrl) return 'backdrop';
  if (artwork.thumbUrl) return 'thumb';
  if (artwork.posterUrl) return 'poster';
  return 'done';
}

export function getNextBackdropStage(stage: BackdropStage, artwork: ArtworkSet): BackdropStage {
  switch (stage) {
    case 'banner':
      return artwork.backdropUrl
        ? 'backdrop'
        : artwork.thumbUrl
          ? 'thumb'
          : artwork.posterUrl
            ? 'poster'
            : 'done';
    case 'backdrop':
      return artwork.thumbUrl ? 'thumb' : artwork.posterUrl ? 'poster' : 'done';
    case 'thumb':
      return artwork.posterUrl ? 'poster' : 'done';
    default:
      return 'done';
  }
}

/** 每档加载看门狗缺省时长（请求挂起时强制前进；0 = 关闭）。 */
export const DEFAULT_WATCHDOG_MS = 8_000;

export interface FallbackWatchdogOptions {
  /**
   * 每档加载看门狗（毫秒）：该档 URL 迟迟不加载成功/失败时强制前进到下一档。
   * 0/缺省 = 关闭（既有调用方行为零变化）。看门狗在 已确认成功 / 降级前进 /
   * 换图 / 卸载 时都会被清除 —— 不会误伤已成功的图。
   */
  watchdogMs?: number;
}

/**
 * 海报图片智能降级 hook
 *
 * 优先级：poster -> thumb -> backdrop -> null（文字占位）
 * 原生由 <img> 的 onError 触发下级切换，避免由于 pre-fetch 失败导致整链截断。
 * 可选每档看门狗：请求**挂起**（既不成功也不失败）时 onError 永不触发 ⇒
 * 海报位永不降级 —— 看门狗到点强制走与 error 相同的下一档路径。
 */
export function usePosterUrl(artwork: ArtworkSet, options?: FallbackWatchdogOptions): {
  url: string | null;
  isLoading: boolean;
  onError: () => void;
  /** 当前档 img 成功加载时由调用方回调（解除本档看门狗；不回调则到点强制前进）。 */
  markLoaded: () => void;
} {
  const watchdogMs = options?.watchdogMs ?? 0;
  const [stage, setStage] = useState<FallbackStage>(() => getPosterInitialStage(artwork));
  const [loadedStage, setLoadedStage] = useState<string | null>(null);

  const artworkKey = `${artwork.posterUrl ?? ''}|${artwork.thumbUrl ?? ''}|${artwork.backdropUrl ?? ''}`;
  useEffect(() => {
    setStage(getPosterInitialStage(artwork));
    setLoadedStage(null);
  }, [artworkKey]);

  const getUrl = (currentStage: FallbackStage): string | null => {
    switch (currentStage) {
      case 'primary':
        return artwork.posterUrl ?? null;
      case 'thumb':
        return artwork.thumbUrl ?? null;
      case 'backdrop':
        return artwork.backdropUrl ?? null;
      case 'done':
        return null;
    }
  };

  const url = getUrl(stage);

  const onError = useCallback(() => {
    setStage((prev) => getNextPosterStage(prev, artwork));
  }, [artwork]);

  // 本档 img 成功加载 ⇒ 记录「该档已确认」，看门狗解除。
  const markLoaded = useCallback(() => setLoadedStage(stage), [stage]);

  // 每档看门狗（FE-WATCHDOG）：请求挂起时 onError 永不触发 ⇒ 海报位永不降级。
  // 仅在看门狗开启、URL 在飞、该档未确认成功时武装；前进/成功/换图/卸载即清。
  useEffect(() => {
    if (!watchdogMs || watchdogMs <= 0) return;
    if (stage === 'done') return;
    if (loadedStage === stage) return;
    const timer = setTimeout(() => {
      setStage((prev) => getNextPosterStage(prev, artwork));
      setLoadedStage(null);
    }, watchdogMs);
    return () => clearTimeout(timer);
  }, [stage, artworkKey, watchdogMs, loadedStage, artwork]);

  return {
    url,
    isLoading: stage !== 'done' && url !== null,
    onError,
    markLoaded,
  };
}

/**
 * 背景大图智能降级 hook
 *
 * 优先级：banner -> backdrop -> thumb -> poster -> null
 */
export function useBackdropUrl(
  artwork: ArtworkSet,
  options?: FallbackWatchdogOptions,
): {
  url: string | null;
  onError: () => void;
  markLoaded: () => void;
} {
  const watchdogMs = options?.watchdogMs ?? 0;
  const [stage, setStage] = useState<BackdropStage>(() => getBackdropInitialStage(artwork));
  const [loadedStage, setLoadedStage] = useState<string | null>(null);

  const artworkKey = `${artwork.bannerUrl ?? ''}|${artwork.backdropUrl ?? ''}|${artwork.thumbUrl ?? ''}|${artwork.posterUrl ?? ''}`;
  useEffect(() => {
    setStage(getBackdropInitialStage(artwork));
    setLoadedStage(null);
  }, [artworkKey]);

  const getUrl = (): string | null => {
    switch (stage) {
      case 'banner':
        return artwork.bannerUrl ?? null;
      case 'backdrop':
        return artwork.backdropUrl ?? null;
      case 'thumb':
        return artwork.thumbUrl ?? null;
      case 'poster':
        return artwork.posterUrl ?? null;
      case 'done':
        return null;
    }
  };

  const url = getUrl();

  const onError = useCallback(() => {
    setStage((prev) => getNextBackdropStage(prev, artwork));
  }, [artwork]);

  const markLoaded = useCallback(() => setLoadedStage(stage), [stage]);

  // 每档看门狗（同 usePosterUrl）：请求挂起时 onError 永不触发 ⇒ 永不降级。
  useEffect(() => {
    if (!watchdogMs || watchdogMs <= 0) return;
    if (stage === 'done') return;
    if (loadedStage === stage) return;
    const timer = setTimeout(() => {
      setStage((prev) => getNextBackdropStage(prev, artwork));
      setLoadedStage(null);
    }, watchdogMs);
    return () => clearTimeout(timer);
  }, [stage, artworkKey, watchdogMs, loadedStage, artwork]);

  return { url, onError, markLoaded };
}

/**
 * 根据标题生成无封面条目的占位底色。
 */
export function generatePlaceholderColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsl(${hue}, 22%, 11%), hsl(${(hue + 24) % 360}, 16%, 5%))`;
}

