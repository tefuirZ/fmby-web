/**
 * 开放 API 端点目录契约层（FE-PARITY-DEVELOPER-ENDPOINTS）。
 *
 * 端点：`GET /api/manage/developer/endpoints`
 * （`crates/fmby-v2-http/src/routes/manage_developer_api.rs:165`）
 * 能力门 MANAGE_ACCESS；`require_confirmed` 0 次 → 不带 confirmed=true。
 *
 * 端口未装配时后端返回 Validation（"API 令牌服务未装配…"）→ 契约层原样抛出，
 * 由页面呈现，不吞成空目录。
 */

import { httpClient } from '@fmby/v2-shared/api/client';
import type { DeveloperApiCatalogQueryInput, DeveloperApiCatalogResponse } from './types';

interface RawCatalogResponse {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

const BASE = '/api/manage/developer/endpoints';

export const developerApi = {
  /** GET — 开放 API 端点目录（筛选 + 分页）。 */
  async listEndpoints(
    query: DeveloperApiCatalogQueryInput = {},
  ): Promise<DeveloperApiCatalogResponse> {
    const raw = await httpClient.get<RawCatalogResponse>(BASE, {
      params: {
        method: query.method,
        scope: query.scope,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return {
      items: raw.items ?? [],
      total: raw.total ?? 0,
      page: raw.page ?? 1,
      pageSize: raw.pageSize ?? 50,
    };
  },
};
