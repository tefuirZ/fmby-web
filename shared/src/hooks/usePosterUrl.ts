import { useCallback, useEffect, useState } from 'react';
import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';

type FallbackStage = 'primary' | 'thumb' | 'backdrop' | 'done';
type BackdropStage = 'banner' | 'backdrop' | 'thumb' | 'poster' | 'done';

function getPosterInitialStage(artwork: ArtworkSet): FallbackStage {
  if (artwork.posterUrl) return 'primary';
  if (artwork.thumbUrl) return 'thumb';
  if (artwork.backdropUrl) return 'backdrop';
  return 'done';
}

function getNextPosterStage(stage: FallbackStage, artwork: ArtworkSet): FallbackStage {
  switch (stage) {
    case 'primary':
      return artwork.thumbUrl ? 'thumb' : artwork.backdropUrl ? 'backdrop' : 'done';
    case 'thumb':
      return artwork.backdropUrl ? 'backdrop' : 'done';
    default:
      return 'done';
  }
}

function getBackdropInitialStage(artwork: ArtworkSet): BackdropStage {
  if (artwork.bannerUrl) return 'banner';
  if (artwork.backdropUrl) return 'backdrop';
  if (artwork.thumbUrl) return 'thumb';
  if (artwork.posterUrl) return 'poster';
  return 'done';
}

function getNextBackdropStage(stage: BackdropStage, artwork: ArtworkSet): BackdropStage {
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

/**
 * 海报图片智能降级 hook
 *
 * 优先级：poster -> thumb -> backdrop -> null（文字占位）
 * 原生由 <img> 的 onError 触发下级切换，避免由于 pre-fetch 失败导致整链截断。
 */
export function usePosterUrl(artwork: ArtworkSet): {
  url: string | null;
  isLoading: boolean;
  onError: () => void;
} {
  const [stage, setStage] = useState<FallbackStage>(() => getPosterInitialStage(artwork));

  const artworkKey = `${artwork.posterUrl ?? ''}|${artwork.thumbUrl ?? ''}|${artwork.backdropUrl ?? ''}`;
  useEffect(() => {
    setStage(getPosterInitialStage(artwork));
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

  return {
    url,
    isLoading: stage !== 'done' && url !== null,
    onError,
  };
}

/**
 * 背景大图智能降级 hook
 *
 * 优先级：banner -> backdrop -> thumb -> poster -> null
 */
export function useBackdropUrl(artwork: ArtworkSet): {
  url: string | null;
  onError: () => void;
} {
  const [stage, setStage] = useState<BackdropStage>(() => getBackdropInitialStage(artwork));

  const artworkKey = `${artwork.bannerUrl ?? ''}|${artwork.backdropUrl ?? ''}|${artwork.thumbUrl ?? ''}|${artwork.posterUrl ?? ''}`;
  useEffect(() => {
    setStage(getBackdropInitialStage(artwork));
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

  return { url, onError };
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

