// FE-ADMIN-SURFACE：`/api/manage/admin/api-tokens` 契约（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端（FMBY-V2 origin/main 实证）：
// - 路由 router_manage.rs:625-629：POST/GET `/admin/api-tokens`、DELETE `/admin/api-tokens/{id}`；
//   handler routes/admin.rs：admin_create_api_token / admin_list_api_tokens / admin_revoke_api_token。
// - 能力门 MANAGE_ACCESS；端口未装配 ⇒ Validation("api token service unavailable")。
// - DTO dto/api_token.rs:33 = { id, name, scopes, created_at_ms, expires_at_ms? }（snake_case wire）。
// 前端取证：全仓 `admin/api-tokens` 仅命中 shared/src/contracts/manage/developerApi/types.ts 的
// **注释**（提及闸门），`developerApi/api.ts` 无任何 /api/ 路径 ⇒ **真零调用**，缺口成立。
// 同族处置（登记）：site-settings 前端已接；tasks/audit/media 后端为 not_implemented 501 占位
// （产品有意不实现）⇒ 前端接亦无实效，不做。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const API = '../../shared/src/contracts/manage/adminApiTokens/api.ts';

test('① 契约文件存在且复用 httpClient', () => {
  const src = read(API);
  assert.ok(src.includes('@fmby/v2-shared/api/client'), '须复用既有 httpClient');
});

test('② 三个方法打到后端真实路径', () => {
  const src = read(API);
  assert.ok(
    src.includes('/api/admin/api-tokens'),
    '路径须与后端真路由一致（router_core nest /api + add_admin_routes 无 manage 段）',
  );
  assert.ok(/httpClient\.get</.test(src), 'list 走 GET');
  assert.ok(/httpClient\.post</.test(src), 'create 走 POST');
  assert.ok(/httpClient\.delete</.test(src), 'revoke 走 DELETE');
});

test('③ snake_case → camelCase 映射（createdAtMs / expiresAtMs 可空）', () => {
  const src = read(API);
  assert.ok(src.includes('created_at_ms'), 'wire 字段 created_at_ms');
  assert.ok(src.includes('createdAtMs'), '域字段 createdAtMs');
  assert.ok(src.includes('expires_at_ms'), 'wire 字段 expires_at_ms');
  assert.ok(src.includes('expiresAtMs'), '域字段 expiresAtMs（可空）');
});

test('④ 错误面复用 shared/src/errors（不新造）', () => {
  const src = read(API);
  assert.ok(
    src.includes('@fmby/v2-shared/errors') || src.includes('isApiError'),
    '须复用既有错误口径',
  );
});
