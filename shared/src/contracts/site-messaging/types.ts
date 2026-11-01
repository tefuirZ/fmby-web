/**
 * 公告 + 站内信 wire 类型与展示映射（卡 fmby-v2#2437）。
 *
 * ★口径：**公告 ≠ 站内信**（与后端 `dto::announcements` / `dto::notifications` 同源）
 * - 公告：管理员人工发布 + 发布窗口 + 可见范围；**不扇出**（一份行，读回执稀疏）；
 * - 站内信：系统事件/管理员定向，**每收件人一行**，各自独立已读状态。
 *
 * 依赖方向：本文件仅类型 + 纯映射，不引 http（调用面见 `api.ts`）——与
 * `contracts/settings/raw-types.ts` + `mappers.ts` 的拆法同纪律。
 *
 * wire 形态：响应体字段为 **snake_case**（后端 DTO 无 `rename_all`）；
 * 请求体为 **camelCase**（后端 `#[serde(rename = "camelCase")]` + snake alias）。
 * 展示层统一 camelCase，页面不出现 snake_case。
 */

import { safeInAppPath } from '../../utils/safe-url';

/** 公告严重度五档（wire 小写字面量；与 DB CHECK 逐字一致）。 */
export type AnnouncementLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'critical'
  | 'maintenance';

/** 可见范围（与严重度正交）。 */
export type AnnouncementAudienceKind = 'all' | 'role' | 'user' | 'library';

/** 生命周期。`draft` **对用户不可见**。 */
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

// ── raw（wire 原样）──────────────────────────────────────────────────

export interface RawAnnouncement {
  id: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  body_format: string;
  audience_kind: AnnouncementAudienceKind;
  audience_ref: unknown | null;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
  pinned: boolean;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  read_count: number;
  audience_count: number;
}

export interface RawAnnouncementPage {
  items: RawAnnouncement[];
  next_cursor: string | null;
}

export interface RawActiveAnnouncement {
  id: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  body_format: string;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  read_at: string | null;
}

export interface RawNotification {
  id: string;
  /** 前向兼容：新增类别不阻塞老前端（后端同样用 String）。 */
  kind: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  payload: unknown | null;
  link_href: string | null;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
}

export interface RawNotificationPage {
  items: RawNotification[];
  next_cursor: string | null;
}

export interface RawUnreadCount {
  total: number;
  by_kind: Record<string, number>;
  /** 公告未读（= 生效公告数 − 我的已读；不进计数表）。铃铛总数 = total + 本字段。 */
  announcement_unread: number;
}

export interface RawSendNotificationResponse {
  delivered: number;
  skipped: number;
}

// ── 展示模型（camelCase）──────────────────────────────────────────────

export interface Announcement {
  id: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  bodyFormat: string;
  audienceKind: AnnouncementAudienceKind;
  audienceRef: unknown | null;
  status: AnnouncementStatus;
  startsAt: string | null;
  endsAt: string | null;
  pinned: boolean;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readCount: number;
  audienceCount: number;
}

export interface AnnouncementPage {
  items: Announcement[];
  nextCursor: string | null;
}

export interface ActiveAnnouncement {
  id: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  bodyFormat: string;
  pinned: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** null = 未读。 */
  readAt: string | null;
}

export interface Notification {
  id: string;
  kind: string;
  level: AnnouncementLevel;
  title: string;
  body: string;
  payload: unknown | null;
  /** 后端只写同源相对路径（`/...`）；前端渲染前仍需 `isSafeInternalHref` 兜底。 */
  linkHref: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
}

export interface UnreadCount {
  total: number;
  byKind: Record<string, number>;
  announcementUnread: number;
  /** 铃铛徽标值（站内信 + 公告）。 */
  badge: number;
}

export interface SendNotificationResult {
  delivered: number;
  skipped: number;
}

// ── mapper（防御式：缺字段回落，不抛）──────────────────────────────────

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const readString = (r: Record<string, unknown>, k: string): string =>
  typeof r[k] === 'string' ? (r[k] as string) : '';

const readNullableString = (r: Record<string, unknown>, k: string): string | null =>
  typeof r[k] === 'string' ? (r[k] as string) : null;

const readNumber = (r: Record<string, unknown>, k: string): number =>
  typeof r[k] === 'number' && Number.isFinite(r[k] as number) ? (r[k] as number) : 0;

const readBool = (r: Record<string, unknown>, k: string): boolean => r[k] === true;

const LEVELS: readonly AnnouncementLevel[] = [
  'info',
  'success',
  'warning',
  'critical',
  'maintenance',
];

/** 非法 level 回落 `info`（与后端 CHECK 值域一致；不把非法值带进配色映射）。 */
export function toLevel(v: unknown): AnnouncementLevel {
  return LEVELS.includes(v as AnnouncementLevel) ? (v as AnnouncementLevel) : 'info';
}

const AUDIENCES: readonly AnnouncementAudienceKind[] = ['all', 'role', 'user', 'library'];
const STATUSES: readonly AnnouncementStatus[] = ['draft', 'published', 'archived'];

function toAudience(v: unknown): AnnouncementAudienceKind {
  return AUDIENCES.includes(v as AnnouncementAudienceKind)
    ? (v as AnnouncementAudienceKind)
    : 'all';
}

function toStatus(v: unknown): AnnouncementStatus {
  return STATUSES.includes(v as AnnouncementStatus) ? (v as AnnouncementStatus) : 'draft';
}

export function mapAnnouncement(v: unknown): Announcement {
  const r = asRecord(v);
  return {
    id: readString(r, 'id'),
    level: toLevel(r.level),
    title: readString(r, 'title'),
    body: readString(r, 'body'),
    bodyFormat: readString(r, 'body_format') || 'text',
    audienceKind: toAudience(r.audience_kind),
    audienceRef: r.audience_ref ?? null,
    status: toStatus(r.status),
    startsAt: readNullableString(r, 'starts_at'),
    endsAt: readNullableString(r, 'ends_at'),
    pinned: readBool(r, 'pinned'),
    publishedBy: readNullableString(r, 'published_by'),
    publishedAt: readNullableString(r, 'published_at'),
    createdAt: readString(r, 'created_at'),
    updatedAt: readString(r, 'updated_at'),
    readCount: readNumber(r, 'read_count'),
    audienceCount: readNumber(r, 'audience_count'),
  };
}

export function mapAnnouncementPage(v: unknown): AnnouncementPage {
  const r = asRecord(v);
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    items: items.map(mapAnnouncement),
    nextCursor: readNullableString(r, 'next_cursor'),
  };
}

export function mapActiveAnnouncement(v: unknown): ActiveAnnouncement {
  const r = asRecord(v);
  return {
    id: readString(r, 'id'),
    level: toLevel(r.level),
    title: readString(r, 'title'),
    body: readString(r, 'body'),
    bodyFormat: readString(r, 'body_format') || 'text',
    pinned: readBool(r, 'pinned'),
    startsAt: readNullableString(r, 'starts_at'),
    endsAt: readNullableString(r, 'ends_at'),
    readAt: readNullableString(r, 'read_at'),
  };
}

export function mapNotification(v: unknown): Notification {
  const r = asRecord(v);
  return {
    id: readString(r, 'id'),
    kind: readString(r, 'kind') || 'system',
    level: toLevel(r.level),
    title: readString(r, 'title'),
    body: readString(r, 'body'),
    payload: r.payload ?? null,
    linkHref: readNullableString(r, 'link_href'),
    createdAt: readString(r, 'created_at'),
    readAt: readNullableString(r, 'read_at'),
    archivedAt: readNullableString(r, 'archived_at'),
  };
}

export function mapNotificationPage(v: unknown): NotificationPage {
  const r = asRecord(v);
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    items: items.map(mapNotification),
    nextCursor: readNullableString(r, 'next_cursor'),
  };
}

export function mapUnreadCount(v: unknown): UnreadCount {
  const r = asRecord(v);
  const rawByKind = asRecord(r.by_kind);
  const byKind: Record<string, number> = {};
  for (const [k, n] of Object.entries(rawByKind)) {
    if (typeof n === 'number' && Number.isFinite(n)) byKind[k] = n;
  }
  const total = readNumber(r, 'total');
  const announcementUnread = readNumber(r, 'announcement_unread');
  return { total, byKind, announcementUnread, badge: total + announcementUnread };
}

export function mapSendNotificationResult(v: unknown): SendNotificationResult {
  const r = asRecord(v);
  return { delivered: readNumber(r, 'delivered'), skipped: readNumber(r, 'skipped') };
}

/**
 * 站内跳转**净化**（与后端 `check_link_href` 同口径的**前端兜底**）。
 *
 * 直接复用共享 `safeInAppPath`（单一事实源）：只放行同源相对路径 `/...`；
 * `//host`、`/\host`、ASCII 控制字符（`java\nscript:` 式伪装）、`javascript:` /
 * `data:` / `vbscript:`、绝对外链一律 `null`。返回**已 trim** 的串，调用方直接渲染。
 *
 * ★评审 2026-11-01：本函数最初手写实现，漏了控制字符检查 ⇒ `/<TAB>/evil.com` 会被
 *   浏览器按 WHATWG 规则解析成外站（开放重定向）。改为委托 `safeInAppPath`。
 */
export function safeInternalHref(href: string | null | undefined): string | null {
  const path = safeInAppPath(href);
  if (!path) return null;
  const lower = path.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('data:') || lower.includes('vbscript:')) {
    return null;
  }
  return path;
}

/** 布尔谓词版（只为调用点可读性；判定与 [`safeInternalHref`] 同源）。 */
export function isSafeInternalHref(href: string | null | undefined): href is string {
  return safeInternalHref(href) !== null;
}
