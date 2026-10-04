import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError, getErrorMessage } from "@fmby/v2-shared/errors";
import type {
  AdminApiToken,
  AdminApiTokenCreateInput,
  CreatedApiToken,
  RawAdminApiToken,
  RawCreatedApiToken,
} from "./types";

// 与 `router_manage.rs:625-629` 逐字一致（单一事实源，不另起常量）。
const TOKENS_PATH = "/api/admin/api-tokens";

/// snake_case → camelCase（可空 `expires_at_ms` ⇒ null，不伪造时间）。
export function mapAdminApiToken(
  raw: Partial<RawAdminApiToken> | null | undefined,
): AdminApiToken {
  return {
    id: raw?.id ?? 0,
    name: raw?.name ?? "",
    scopes: raw?.scopes ?? [],
    createdAtMs: raw?.created_at_ms ?? 0,
    expiresAtMs: raw?.expires_at_ms ?? null,
  };
}

/// 签发响应 → 域形态（★保留一次性明文 token，绝不丢弃）。
function mapCreatedApiToken(raw: RawCreatedApiToken): CreatedApiToken {
  return {
    id: raw.id,
    name: raw.name,
    token: raw.token,
    scopes: raw.scopes ?? [],
  };
}

function toRaw(input: AdminApiTokenCreateInput) {
  return {
    name: input.name,
    scopes: input.scopes,
    expires_at_ms: input.expiresAtMs ?? null,
  };
}

export const adminApiTokensApi = {
  /// `GET` —— 列出令牌。
  async list(): Promise<AdminApiToken[]> {
    const raw = await httpClient.get<RawAdminApiToken[]>(TOKENS_PATH);
    return (raw ?? []).map(mapAdminApiToken);
  },

  /// `POST` —— 创建令牌。
  ///
  /// ★返回签发结果（含一次性明文 `token`）：后端 `CreateApiTokenResponse` 与列表项
  /// **形状不同**（无 `created_at_ms`，有 `token`）——不得复用列表映射器，否则
  /// token 被丢弃、createdAtMs 被伪造成 0。调用方应提示用户立即保存。
  async create(input: AdminApiTokenCreateInput): Promise<CreatedApiToken> {
    const raw = await httpClient.post<RawCreatedApiToken>(TOKENS_PATH, {
      body: toRaw(input),
    });
    return mapCreatedApiToken(raw);
  },

  /// `DELETE` —— 吊销令牌（按 id）。
  async revoke(id: number | string): Promise<void> {
    await httpClient.delete<void>(`${TOKENS_PATH}/${id}`);
  },
};

// 错误面复用 `shared/src/errors` 既有口径（端口未装配 ⇒ 后端 Validation，由调用方对拍）。
export { isApiError, getErrorMessage };
