// fmby-web#8：CAS 编排面契约（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 后端权威（FMBY-V2 `origin/main`，N5 = PR #378 / `c0ef6a381`）：
// - 路由 `routes/admin_cas.rs`：GET/PUT `/admin/cas/drives`、GET `/admin/cas/fanout/{content_id}`、
//   GET `/admin/cas/reconcile`；
// - DTO `state/cas_admin.rs`：
//     CasDriveConfigDto  = { provider_type, drive_ref, enabled, priority }
//     CasFanoutStatusDto = { content_id, drives: CasDriveStatusDto[] }
//     CasDriveStatusDto  = { drive_id, provider_type, drive_ref, copy_state,
//                           size_bytes?, last_verified_at? }
//     CasReconcileReportDto = { report_id, source, identified, reconciled, generated_at_ms }
//   （**snake_case wire**，`size_bytes` / `last_verified_at` 可缺省）
//   PUT 入参 `UpsertCasDriveConfigRequest` = 同 CasDriveConfigDto 四字段。
// - 能力门 MANAGE_LIBRARY；端口未装配 ⇒ fail-closed 500（不回落空值/假状态）。
//
// 前端取证（卡面判据 1 的反向判据）：本仓审计 `Cas[A-Z]\w*` / RapidUpload /
// RestoreLease / cas_content|cas_restore|cas_meta / .cas / 秒传 / 扇出|CAS 编排 全 0 命中 ⇒ 缺口成立。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const API = '../../shared/src/contracts/manage/casAdmin/api.ts';
const TYPES = '../../shared/src/contracts/manage/casAdmin/types.ts';

test('① 契约文件存在且复用 httpClient（不新起 fetch）', () => {
  const src = read(API);
  assert.ok(src.includes('@fmby/v2-shared/api/client'), '须复用既有 httpClient');
  assert.ok(read(TYPES).length > 0, 'types.ts 须存在');
});

test('② 三个方法打到后端真实路径（router_core nest /api + add_admin_routes 无 manage 段）', () => {
  const src = read(API);
  assert.ok(src.includes('/api/admin/cas/drives'), '盘配置路径须与后端一致');
  assert.ok(src.includes('/api/admin/cas/fanout'), '扇出状态路径须与后端一致');
  assert.ok(src.includes('/api/admin/cas/reconcile'), '对账报告路径须与后端一致');
  assert.ok(/httpClient\.get</.test(src), '读走 GET');
  assert.ok(/httpClient\.put</.test(src), '盘配置保存走 PUT（后端是 PUT 不是 POST）');
});

test('③ snake_case → camelCase 映射字段齐全', () => {
  const src = read(API);
  for (const wire of [
    'provider_type',
    'drive_ref',
    'copy_state',
    'size_bytes',
    'last_verified_at',
    'generated_at_ms',
    'content_id',
  ]) {
    assert.ok(src.includes(wire), `wire 字段 ${wire} 须显式处理`);
  }
  for (const domain of ['providerType', 'driveRef', 'copyState', 'contentId']) {
    assert.ok(src.includes(domain), `域字段 ${domain} 须存在`);
  }
});

test('④ 可空字段保持 null，不伪造 0（size_bytes / last_verified_at）', () => {
  const src = read(API);
  assert.ok(src.includes('sizeBytes'), 'sizeBytes 域字段');
  assert.ok(src.includes('lastVerifiedAt'), 'lastVerifiedAt 域字段');
  // 绝不可用 `|| 0` 把「未验证」压成 0 —— 那会让 UI 显示「0 字节 / 1970 年已核验」。
  assert.ok(
    !/lastVerifiedAt[^;\n]*\|\|\s*0/.test(src),
    'lastVerifiedAt 不得用 || 0 伪造（未核验 ≠ 1970 年）',
  );
  assert.ok(
    !/sizeBytes[^;\n]*\|\|\s*0/.test(src),
    'sizeBytes 不得用 || 0 伪造（未知大小 ≠ 0 字节）',
  );
});

test('⑤ PUT 入参回 snake_case（不得把 camelCase 直接发给后端）', () => {
  const src = read(API);
  assert.ok(/toRaw|toWire/.test(src), '须有显式 wire 序列化函数');
  assert.ok(/provider_type:/.test(src), '出参须写 provider_type');
  assert.ok(/drive_ref:/.test(src), '出参须写 drive_ref');
});

test('⑥ 不伪造扇出完成度：copy_state 原样透出，不在前端推断 present/absent', () => {
  const src = read(API);
  assert.ok(src.includes('copyState'), 'copy_state 须原样透出到域形态');
  // 前端若把 copy_state 归一成布尔「已复制」，就会在后端新增第三态时静默丢信息。
  assert.ok(
    !/copyState\s*[=:][^;\n]*(===|!==)\s*['"]present['"]/.test(src),
    '不得在映射层把 copy_state 折叠成 present 判定',
  );
});