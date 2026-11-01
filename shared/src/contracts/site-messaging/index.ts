/**
 * 公告 + 站内信契约门面（卡 fmby-v2#2437）。
 *
 * 端点真源见 `api.ts` 头注释（后端 `routes/notifications.rs` 用户面 +
 * `routes/manage_announcements.rs` / `routes/manage_notifications.rs` 管理面）。
 *
 * 拆件纪律（照 `contracts/settings` 的 raw-types / mappers 分法）：
 * - `types.ts`：wire 类型 + 防御式 mapper + `isSafeInternalHref`（纯函数，无 http 依赖）；
 * - `api.ts`：仅端点调用与默认参数，不写业务规则。
 * 页面禁止直接消费 raw wire 类型，一律走本门面导出的 camelCase 模型。
 */

export * from './types';
export { siteMessagingApi } from './api';
export type {
  AnnouncementListQuery,
  CreateAnnouncementInput,
  NotificationListQuery,
  SendNotificationInput,
  UpdateAnnouncementInput,
} from './api';
