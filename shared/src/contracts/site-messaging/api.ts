/**
 * 公告 + 站内信 API 门面（卡 fmby-v2#2437）。
 *
 * 端点真源（fmby-v2 分支 `feat/site-messaging-schema`，阶段②-10 路由）：
 * 用户面：
 *   GET  /api/notifications                  keyset（limit/cursor/unreadOnly/kind）
 *   GET  /api/notifications/unread-count     铃铛徽标（含公告未读）
 *   POST /api/notifications/{id}/read        单条已读（幂等，204）
 *   POST /api/notifications/read             批量已读（204）
 *   POST /api/notifications/read-all         全读（可带 kind，204）
 *   GET  /api/announcements/active           生效公告（带我的读回执）
 *   POST /api/announcements/read             公告批量已读（204）
 * 管理面：
 *   GET    /api/manage/announcements             列表（含草稿，游标不透明）
 *   POST   /api/manage/announcements             新建（**恒为 draft**，201）
 *   GET    /api/manage/announcements/{id}        详情
 *   PATCH  /api/manage/announcements/{id}        局部更新（三态；全空 400）
 *   POST   /api/manage/announcements/{id}/publish 发布
 *   POST   /api/manage/announcements/{id}/archive 下线
 *   POST   /api/manage/notifications/send        定向发信（写时扇出 + dedupe）
 *
 * ★付费面：全部端点挂 `feature.site_messaging`（未授权 403）；管理面另需 `manage` 能力。
 * ★204 类端点返回 `void`：`httpClient` 对空体不应做 JSON 解析，故统一 `post<void>`。
 */

import { httpClient } from '@fmby/v2-shared/api/client';

import {
  mapActiveAnnouncement,
  mapAnnouncement,
  mapAnnouncementPage,
  mapNotificationPage,
  mapSendNotificationResult,
  mapUnreadCount,
  type ActiveAnnouncement,
  type Announcement,
  type AnnouncementAudienceKind,
  type AnnouncementLevel,
  type AnnouncementPage,
  type AnnouncementStatus,
  type NotificationPage,
  type SendNotificationResult,
  type UnreadCount,
} from './types';

export interface NotificationListQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
  kind?: string;
}

export interface AnnouncementListQuery {
  status?: AnnouncementStatus;
  cursor?: string;
  limit?: number;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  level: AnnouncementLevel;
  /** `text` | `markdown`；缺省 text。★markdown 渲染必须禁用原始 HTML。 */
  bodyFormat?: 'text' | 'markdown';
  audienceKind: AnnouncementAudienceKind;
  audienceRef?: unknown;
  startsAt?: string;
  endsAt?: string;
  pinned?: boolean;
}

/**
 * 局部更新入参（**三态**）：字段不出现 = 不改；显式 `null` = 清空；给值 = 设置。
 *
 * ★`level` / `audienceKind` / `bodyFormat` 是 NOT NULL 列：后端对它们的 `null` 回 400，
 *   这里在类型上就禁止（`undefined` = 不改），避免前端写出"清空枚举"的非法请求。
 */
export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  bodyFormat?: 'text' | 'markdown';
  level?: AnnouncementLevel;
  audienceKind?: AnnouncementAudienceKind;
  audienceRef?: unknown | null;
  startsAt?: string | null;
  endsAt?: string | null;
  pinned?: boolean;
}

export interface SendNotificationInput {
  /** 缺省 `system`。★`announcement` 是保留类别（公告不扇出），后端 400。 */
  kind?: string;
  audienceKind: AnnouncementAudienceKind;
  audienceRef?: unknown;
  level: AnnouncementLevel;
  title: string;
  body: string;
  /** 同源相对路径（`/...`）；外链/`javascript:` 后端 400。 */
  linkHref?: string;
  payload?: unknown;
  /** 缺省由后端按内容哈希生成（同内容重复发送只送达一次）。 */
  dedupeKey?: string;
}

export const siteMessagingApi = {
  // ── 用户面 ─────────────────────────────────────────────────────────
  async listNotifications(query: NotificationListQuery = {}): Promise<NotificationPage> {
    const raw = await httpClient.get<unknown>('/api/notifications', {
      params: {
        cursor: query.cursor,
        limit: query.limit,
        unreadOnly: query.unreadOnly,
        kind: query.kind,
      },
    });
    return mapNotificationPage(raw);
  },

  async unreadCount(): Promise<UnreadCount> {
    const raw = await httpClient.get<unknown>('/api/notifications/unread-count');
    return mapUnreadCount(raw);
  },

  async markNotificationRead(id: string): Promise<void> {
    await httpClient.post<void>(`/api/notifications/${encodeURIComponent(id)}/read`);
  },

  async markNotificationsRead(ids: string[]): Promise<void> {
    await httpClient.post<void>('/api/notifications/read', { body: { ids } });
  },

  async markAllNotificationsRead(kind?: string): Promise<void> {
    await httpClient.post<void>('/api/notifications/read-all', { body: { kind } });
  },

  async activeAnnouncements(): Promise<ActiveAnnouncement[]> {
    const raw = await httpClient.get<unknown>('/api/announcements/active');
    const list = Array.isArray(raw) ? raw : [];
    return list.map(mapActiveAnnouncement);
  },

  async markAnnouncementsRead(ids: string[]): Promise<void> {
    await httpClient.post<void>('/api/announcements/read', { body: { ids } });
  },

  // ── 管理面 ─────────────────────────────────────────────────────────
  async listAnnouncements(query: AnnouncementListQuery = {}): Promise<AnnouncementPage> {
    const raw = await httpClient.get<unknown>('/api/manage/announcements', {
      params: { status: query.status, cursor: query.cursor, limit: query.limit },
    });
    return mapAnnouncementPage(raw);
  },

  async getAnnouncement(id: string): Promise<Announcement> {
    const raw = await httpClient.get<unknown>(
      `/api/manage/announcements/${encodeURIComponent(id)}`,
    );
    return mapAnnouncement(raw);
  },

  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    const raw = await httpClient.post<unknown>('/api/manage/announcements', { body: input });
    return mapAnnouncement(raw);
  },

  async updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<Announcement> {
    const raw = await httpClient.patch<unknown>(
      `/api/manage/announcements/${encodeURIComponent(id)}`,
      { body: input },
    );
    return mapAnnouncement(raw);
  },

  async publishAnnouncement(id: string): Promise<Announcement> {
    const raw = await httpClient.post<unknown>(
      `/api/manage/announcements/${encodeURIComponent(id)}/publish`,
    );
    return mapAnnouncement(raw);
  },

  async archiveAnnouncement(id: string): Promise<Announcement> {
    const raw = await httpClient.post<unknown>(
      `/api/manage/announcements/${encodeURIComponent(id)}/archive`,
    );
    return mapAnnouncement(raw);
  },

  async sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
    const raw = await httpClient.post<unknown>('/api/manage/notifications/send', {
      body: input,
    });
    return mapSendNotificationResult(raw);
  },
};
