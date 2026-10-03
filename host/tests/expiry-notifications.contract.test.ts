// FE-NOTIFICATION-PREFS：到期通知设置契约（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端（FMBY-V2 origin/main 实证）：
// - GET/PUT /api/manage/users/expiry-notifications/settings
//   （routes/router_manage.rs:79-84；handler manage_expiry_notifications.rs:23/41）
// - 能力门 MANAGE_ACCESS（manage:users）；KV `manage.user_expiry_notification.config`，零迁移
// - DTO（dto/manage.rs:106）：{ enabled: bool, threshold_days: Vec<i32> }（snake_case wire）
// - 未持久化 ⇒ 诚实缺省 enabled=true / threshold_days=[7,3,1]；端口未装配 ⇒ fail-closed 500
// 前端取证：全仓 `expiry_notification*` 零命中 ⇒ 缺口为真（本卡补契约层）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const API = '../../shared/src/contracts/manage/expiryNotifications/api.ts';

test('① 契约文件存在且走 httpClient', () => {
  const src = read(API);
  assert.ok(
    src.includes('@fmby/v2-shared/api/client'),
    '需复用既有 httpClient（不新造请求层）',
  );
});

test('② GET 打到后端真实路径', () => {
  const src = read(API);
  assert.ok(
    src.includes('/api/manage/users/expiry-notifications/settings'),
    'GET 路径须与后端 router_manage.rs:79 一致',
  );
  assert.ok(/httpClient\.get</.test(src), 'GET 需经 httpClient.get');
  assert.ok(/httpClient\.put</.test(src), 'PUT 需经 httpClient.put');
});

test('③ snake_case → camelCase 映射字段对拍（enabled / thresholdDays）', () => {
  const src = read(API);
  assert.ok(
    src.includes('threshold_days'),
    'wire 字段为 threshold_days（后端逐字）',
  );
  assert.ok(
    src.includes('thresholdDays'),
    '前端域字段为 thresholdDays（camelCase）',
  );
  assert.ok(src.includes('enabled'), 'enabled 字段须存在');
});

test('④ 诚实缺省：未配置 ⇒ enabled=true / thresholdDays=[7,3,1]', () => {
  const src = read(API);
  assert.ok(
    /\[7,\s*3,\s*1\]/.test(src),
    '缺省阈值须与后端 DEFAULT_THRESHOLD_DAYS 一致（7,3,1）',
  );
});

test('⑤ 错误码按 shared/src/errors 对拍（不新造错误面）', () => {
  const src = read(API);
  assert.ok(
    src.includes('@fmby/v2-shared/errors') || src.includes('isApiError'),
    '错误分类须复用 shared/src/errors 既有口径',
  );
});
