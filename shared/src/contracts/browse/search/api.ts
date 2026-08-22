import { mapArtwork } from '@/domains/assets';
import { httpClient } from '@/shared/api/client';
import { asRecord, readArray, readNumber, readString } from '@/shared/api/mapping';
import type { SearchResultItem } from './types';

export const searchApi = {
  async search(query: string, limit = 20): Promise<SearchResultItem[]> {
    const raw = await httpClient.get<unknown>('/api/browse/search', {
      params: { q: query, limit },
    });
    const record = asRecord(raw);
    return readArray(record.items ?? raw, mapSearchResult);
  },
};

function mapSearchResult(raw: unknown): SearchResultItem | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.item_id, record.itemId);
  if (!id) return null;

  const kind = readString(record.kind, record.media_type, record.mediaType, record.type) ?? 'other';
  const artwork = mapArtwork(record.artwork ?? record.images ?? record, { itemId: id });

  return {
    id,
    title: readString(record.title, record.name) ?? '未命名',
    kind,
    kindLabel: mapKindLabel(kind),
    year: readNumber(record.year, record.production_year, record.productionYear),
    posterUrl: artwork.posterUrl ?? artwork.thumbUrl,
  };
}

function mapKindLabel(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'movie':
      return '电影';
    case 'series':
      return '剧集';
    case 'episode':
      return '单集';
    case 'season':
      return '季度';
    case 'music':
      return '音乐';
    default:
      return '内容';
  }
}