//! FE-NOTIFICATION-PREFS：到期通知设置（USER-EXPIRY-NOTIFICATION 后端面对位）。
//!
//! 后端权威（FMBY-V2 `origin/main`）：
//! - 路由 `GET/PUT /api/manage/users/expiry-notifications/settings`
//!   （`routes/router_manage.rs:79-84`，handler `routes/manage_expiry_notifications.rs:23/41`）；
//! - DTO `dto/manage.rs:106` = `{ enabled: bool, threshold_days: Vec<i32> }`（**snake_case wire**）；
//! - KV 键 `manage.user_expiry_notification.config`，与到期提醒 worker 同键，**零迁移**；
//! - 未持久化 ⇒ 诚实缺省 `enabled=true` / `threshold_days=[7,3,1]`；
//!   端口未装配 ⇒ fail-closed 500（不伪造缺省）。

/// 前端域形态（camelCase）。
export interface UserExpiryNotificationSettings {
  enabled: boolean;
  thresholdDays: number[];
}

/// 写入入参（全量替换，与后端 PUT 语义一致）。
export type UserExpiryNotificationSettingsInput = UserExpiryNotificationSettings;

/// wire 形态（后端逐字 snake_case）。
export interface RawUserExpiryNotificationSettings {
  enabled: boolean;
  threshold_days: number[];
}

/// V1/后端 `DEFAULT_THRESHOLD_DAYS` 对位：未配置时的**诚实缺省**（不伪造空数组）。
export const DEFAULT_EXPIRY_THRESHOLD_DAYS = [7, 3, 1] as const;
