// FE-MIGRATION-WIZARD：迁移向导契约（inspect + export）RED → GREEN。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端（FMBY-V2 origin/main 实证）：
// - 路由 router_manage.rs:373-378：GET `/manage/migration/inspect`、GET `/manage/migration/export`；
//   handler routes/manage_migration.rs：migration_inspect / migration_export（均为**真实实现**，
//   体内无 not_implemented）；能力门 VIEW_AUDIT；端口未装配 ⇒ fail-closed（不返空壳）。
// - ★ `POST /manage/migration/import` 是 **ErrorCode::NotImplemented 占位**
//   （“本卡未实现；已拆独立卡单独设计鉴权/幂等/干跑校验”）⇒ **不接**（只接真缺口）。
// - DTO（manage_migration.rs）：MigrationEntryDto{version,name,checksum,appliedAtMs}、
//   MigrationInspectResponse{count,currentVersion,entries}、MigrationExportResponse{entries}
//   —— wire **已是 camelCase**（后端显式 serde rename），前端无需 snake→camel 转换，直接对拍。
// 前端取证：全仓 manage/migration / migrationInspect / migrationExport 等 **零命中** ⇒ 缺口为真。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const API = '../../shared/src/contracts/manage/migration/api.ts';

test('① 契约文件存在且复用 httpClient', () => {
  const src = read(API);
  assert.ok(src.includes('@fmby/v2-shared/api/client'), '须复用既有 httpClient');
});

test('② inspect / export 打到后端真实路径（且不含 import 占位端点）', () => {
  const src = read(API);
  assert.ok(src.includes('/api/manage/migration/inspect'), 'inspect 路径须对位');
  assert.ok(src.includes('/api/manage/migration/export'), 'export 路径须对位');
  assert.ok(
    !src.includes('/api/manage/migration/import'),
    'import 为后端 NotImplemented 占位，前端不得接线',
  );
});

test('③ 字段对拍：entry 四字段 + inspect 三字段（wire 已 camelCase，不做 snake 转换）', () => {
  const src = read(API);
  for (const f of ['version', 'name', 'checksum', 'appliedAtMs']) {
    assert.ok(src.includes(f), `entry 字段 ${f} 须对拍`);
  }
  for (const f of ['count', 'currentVersion', 'entries']) {
    assert.ok(src.includes(f), `inspect 字段 ${f} 须对拍`);
  }
  // wire 已是 camelCase ⇒ 不应出现 snake_case 的 applied_at_ms 映射逻辑
  assert.ok(
    !src.includes('applied_at_ms'),
    '后端 wire 为 appliedAtMs，前端不得再写 snake 映射',
  );
});

test('④ 错误面复用 shared/src/errors（端口未装配 ⇒ fail-closed，不返空壳）', () => {
  const src = read(API);
  assert.ok(
    src.includes('@fmby/v2-shared/errors') || src.includes('isApiError'),
    '须复用既有错误口径',
  );
});
