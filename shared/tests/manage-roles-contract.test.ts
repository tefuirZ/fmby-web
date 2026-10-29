// #2127：ManageUserRole 的 super_admin 是 V1 残留 —— 后端 BUILTIN_ROLES 仅
// admin / user / restricted_user（fmby-v2 crates/fmby-v2-domain/src/access/policies.rs:37-41；
// V1 SuperAdmin 已被迁移 20260601090000_single_admin_role.sql 删除，171 个 V2 迁移
// 0 条 access_role 种子）。本钉子锁「删干净」：union / labels / mapRole /
// mapRoleLabelToApi 全链**不再产出或回显** super_admin。
// 判据形态：传入 super_admin（或其 label 形态）⇒ 被拒 / 落默认，绝不原样通过。
//
// 跑法：node --import ./tests/register-resolver.mjs --test tests/manage-roles-contract.test.ts

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ManageUserRole } from '../src/contracts/manage/types';
import { mapRoleToLabel } from '../src/contracts/manage/labels';
import { mapRole } from '../src/contracts/manage/mapping/shared';
import { mapRoleLabelToApi } from '../src/contracts/manage/mapping/records';

/** 后端正典三角色（policies.rs:37-41 BUILTIN_ROLES；取证席 3d8c6609cb 判据②）。 */
const BACKEND_BUILTIN_ROLES = ['admin', 'user', 'restricted_user'] as const;

test('#2127 union 钉子：ManageUserRole 与后端 BUILTIN_ROLES 逐值一致', () => {
  const all: ManageUserRole[] = ['user', 'restricted_user', 'admin'];
  assert.deepEqual(
    [...all].sort(),
    [...BACKEND_BUILTIN_ROLES].sort(),
    'ManageUserRole 与后端内置角色不一致 ⇒ wire 对不上（#2127 同型漂移）',
  );
});

test('#2127 负例：mapRole("super_admin") 不回显（落 default ⇒ user）', () => {
  // 上一版此处 case "super_admin" 会原样回显；删除后只能落 default。
  assert.equal(mapRole('super_admin'), 'user');
});

test('#2127 负例：mapRoleToLabel("super_admin") 不再产出「超级管理员」', () => {
  assert.notEqual(mapRoleToLabel('super_admin'), '超级管理员');
  assert.equal(mapRoleToLabel('super_admin'), '普通用户', '未知角色落 default（不伪造标签）');
});

test('#2127 负例：mapRoleLabelToApi 任何 super 形态 label 都不得产出 "super_admin"', () => {
  // ⚠ 语义口径（#2127 裁定）：V1→V2 的 single_admin_role 迁移把 SuperAdmin 并入了
  // admin，故历史 label「超级管理员 / superadmin」显式归 admin —— 这不是静默形似
  // 匹配，是迁移语义的延续；唯「super_admin」这个**角色名**永不产出。
  for (const label of ['超级管理员', 'superadmin', 'Super Admin', ' 超级管理员 ']) {
    const mapped = mapRoleLabelToApi(label);
    assert.notEqual(mapped, 'super_admin', label);
    assert.equal(mapped, 'admin', label);
  }
});
