import { useQuery } from '@tanstack/react-query';
import { itemApi } from '@/domains/item';
import { queryKeys } from '@/shared/query-keys';
import { shouldLoadTechnicalFallback } from '../formUtils';
import type { ItemDetailResponse } from '@/domains/item';

export function useItemDetailQueries(
  itemId: string | undefined,
  selectedSeasonId: string | undefined,
  item: ItemDetailResponse | undefined,
) {
  const itemQuery = useQuery({
    queryKey: queryKeys.item.detail(itemId ?? ''),
    queryFn: () => itemApi.getDetail(itemId ?? ''),
    enabled: Boolean(itemId),
  });

  const selectedSeasonQuery = useQuery({
    queryKey: queryKeys.item.seasonEpisodes(selectedSeasonId ?? ''),
    queryFn: () => itemApi.getDetail(selectedSeasonId ?? ''),
    enabled: item?.kind === 'series' && Boolean(selectedSeasonId),
  });

  const technicalFallbackQuery = useQuery({
    queryKey: queryKeys.item.technicalFallback(item?.playbackTargetId),
    queryFn: () => itemApi.getDetail(item?.playbackTargetId ?? ''),
    enabled: Boolean(item && shouldLoadTechnicalFallback(item)),
    staleTime: 60_000,
  });

  return {
    itemQuery,
    selectedSeasonQuery,
    technicalFallbackQuery,
  };
}
