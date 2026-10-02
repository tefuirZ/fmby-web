import { httpClient } from '@fmby/v2-shared/api/client';
import {
  fromDetail,
  type ManagedCollectionDetailRecord,
  type RawManagedCollectionDetail,
} from '@fmby/v2-shared/contracts/manage/peripherals';

/**
 * 用户面合集读面（后端卡 USER-COLLECTIONS-SURFACE-BE 的信封）。
 *
 * ponytail：与 manage 面**同 DTO**（后端 `ManagedCollectionDetailDto`），仅路径与门不同
 * ——用户面 `GET /api/collections/{id}`：session + BROWSE 能力门；Active 可见性闸，
 * Hidden ⇒ 404（不泄露隐藏合集）。故直接复用 manage 的 `fromDetail` mapper，
 * 零重复映射、零新类型、零新依赖。
 *
 * ⚠ **列表（浏览页）未接**：后端用户面列表只在 compat `GET /emby/Collections`，其鉴权
 * 仅认 Emby api_key（compat `extract_api_key`，**无 session 通道**），WebUI session
 * 不可达；原生用户面列表端点不存在（USER-COLLECTIONS-SURFACE-BE 明确跳过）。见 handoff
 * 待裁决项：需后端补 session + BROWSE 的原生列表端点，本卡才可补浏览列表页。
 */
export const collectionsBrowseApi = {
  async getCollection(id: string): Promise<ManagedCollectionDetailRecord> {
    const raw = await httpClient.get<RawManagedCollectionDetail>(
      `/api/collections/${encodeURIComponent(id)}`,
    );
    return fromDetail(raw);
  },
};