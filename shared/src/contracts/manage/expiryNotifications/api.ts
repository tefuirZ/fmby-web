import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError, getErrorMessage } from "@fmby/v2-shared/errors";
import {
  DEFAULT_EXPIRY_THRESHOLD_DAYS,
  type RawUserExpiryNotificationSettings,
  type UserExpiryNotificationSettings,
  type UserExpiryNotificationSettingsInput,
} from "./types";

// 与后端 `router_manage.rs:79-84` 逐字一致（**单一事实源**，不另起常量）。
const SETTINGS_PATH = "/api/manage/users/expiry-notifications/settings";

/// snake_case → camelCase（缺字段 ⇒ 诚实缺省，不伪造）。
export function mapExpiryNotificationSettings(
  raw: Partial<RawUserExpiryNotificationSettings> | null | undefined,
): UserExpiryNotificationSettings {
  return {
    enabled: raw?.enabled ?? true,
    thresholdDays: raw?.threshold_days ?? [...DEFAULT_EXPIRY_THRESHOLD_DAYS],
  };
}

/// camelCase → snake_case（后端逐字字段）。
function toRaw(
  input: UserExpiryNotificationSettingsInput,
): RawUserExpiryNotificationSettings {
  return {
    enabled: input.enabled,
    threshold_days: input.thresholdDays,
  };
}

export const expiryNotificationsApi = {
  /// `GET` —— 返回设置真值（未持久化 ⇒ 后端诚实缺省）。
  async getSettings(): Promise<UserExpiryNotificationSettings> {
    const raw = await httpClient.get<RawUserExpiryNotificationSettings>(
      SETTINGS_PATH,
    );
    return mapExpiryNotificationSettings(raw);
  },

  /// `PUT` —— 全量替换，返回落库后真值（后端 PUT 语义）。
  async putSettings(
    input: UserExpiryNotificationSettingsInput,
  ): Promise<UserExpiryNotificationSettings> {
    const raw = await httpClient.put<RawUserExpiryNotificationSettings>(
      SETTINGS_PATH,
      { body: toRaw(input) },
    );
    return mapExpiryNotificationSettings(raw);
  },
};

// 错误面复用 `shared/src/errors` 既有口径（不新造错误分类）：调用方直接用这两个 helper
// 对拍后端错误码（`isApiError` 判定 + `getErrorMessage` 取文案），与 manage 面其它契约同形。
export { isApiError, getErrorMessage };
