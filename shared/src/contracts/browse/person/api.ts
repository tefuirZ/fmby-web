import { httpClient } from '@fmby/v2-shared/api/client';
import { asRecord, readArray, readNumber, readString } from '@fmby/v2-shared/api/mapping';
import { mapArtwork } from '@fmby/v2-shared/contracts/assets';
import type { MediaCardSummary } from '@fmby/v2-shared/contracts/browse';
import type { PersonDetail, PersonItemsPage } from './types';

/**
 * 人物面契约（V1F-10）。
 *
 * 端点路径以 **V1 考古为准**：`/api/items/people/{id}` 与
 * `/api/items/people/{id}/items`（V1 `crates/fmby-api/src/items/routes.rs:25-26`），
 * 不用 `/api/people/*`。
 *
 * ★ 分页诚实边界：后端人物关联端口 `list_nodes_for_person` **无 keyset 游标**，
 * 故作品列表为**单页硬上限**（后端 `PERSON_ITEMS_MAX = 500`）。这里**不实现
 * 分页取数**（不伪造 cursor/loadMore），`hasMore` 仅如实反映是否被上限截断。
 */

export const personApi = {
  /** 人物详情（不存在 → 后端 404，前端由 viewmodel 映射为 error 态）。 */
  async getPerson(personId: string): Promise<PersonDetail> {
    const raw = await httpClient.get<unknown>(`/api/items/people/${personId}`);
    return mapPersonDetail(raw, personId);
  },

  /** 人物关联作品（单页硬上限；无分页参数）。 */
  async getPersonItems(personId: string): Promise<PersonItemsPage> {
    const raw = await httpClient.get<unknown>(`/api/items/people/${personId}/items`);
    const record = asRecord(raw);
    const items = readArray(record.items, mapPersonItem);
    return {
      items,
      total: readNumber(record.total) ?? items.length,
      hasMore: false,
    };
  },
};

function mapPersonDetail(raw: unknown, personId: string): PersonDetail {
  const record = asRecord(raw);
  return {
    id: readString(record.id, record.person_id, record.personId) ?? personId,
    name: readString(record.name, record.primary_name, record.primaryName) ?? '未命名人物',
    posterUrl: readString(record.poster_key, record.posterKey, record.thumb_url, record.thumbUrl),
    itemCount: readNumber(record.item_count, record.itemCount) ?? 0,
  };
}

/** 人物作品条目：后端 `LibraryDetailItemDto` 形态（与库详情同构）。 */
function mapPersonItem(raw: unknown): MediaCardSummary | null {
  const record = asRecord(raw);
  const id = readString(record.id, record.item_id, record.itemId);
  if (!id) {
    return null;
  }
  const kind = readString(record.kind, record.media_type, record.mediaType) ?? 'other';
  const year = readNumber(record.year);
  return {
    id,
    title: readString(record.title, record.name) ?? '未命名',
    kind: toKind(kind),
    kindLabel: KIND_LABELS[kind] ?? '媒体',
    year: year ?? undefined,
    addedAt: readString(record.added_at, record.addedAt),
    libraryId: readString(record.library_id, record.libraryId),
    tags: [],
    artwork: mapArtwork(record.artwork ?? record, { itemId: id }),
    hasPlayableSource: record.has_playable_source === true,
  };
}

const KIND_LABELS: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  season: '季',
  episode: '集',
  music: '音乐',
  video: '视频',
  collection: '合集',
  other: '其他',
};

function toKind(kind: string): MediaCardSummary['kind'] {
  return (Object.keys(KIND_LABELS).includes(kind) ? kind : 'other') as MediaCardSummary['kind'];
}
