// #289：能力判定不得用「剥 :/_/- 的子串匹配」放行角色（越权视图）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 缺陷（基线 6816ecf，SessionProvider.tsx hasCapability）：
//   user.roles.some(r => r.toLowerCase().includes('admin'))
// ⇒ `Admin`、`admin`、`super-admin`、`not-an-admin-but`、`管理员` 之外的
// 任意**含 admin 子串**的角色（`admin_readonly`、`xadminx`…）都被放行成管理员。
// 本卡要求：角色判定改**枚举全等**，废除子串匹配。
//
// 附：capabilities 一侧的大小写/分隔符归一（`ManageAccess` ↔ `manage:access`）
// 是**契约必需**（后端发 PascalCase，见 FMBY-V2 bridges/access.rs
// capability_to_str），不得一并废除——那会把管理员也误禁。

import test from 'node:test';
import assert from 'node:assert/strict';

// #289：判定放在 shared 契约层（`shared/src/contracts/auth/capabilityCheck.ts`）——
// 本仓分层是 themes → shared ← host，host 不得自带契约目录（见 check-frontend-dupes）。
// SessionProvider 与本测试因此共用同一份实现（唯一事实源）。
import { hasCapabilityIn, ADMIN_ROLE } from '@fmby/v2-shared/contracts/auth';

const user = (roles: string[], capabilities: string[]) => ({
  id: '1',
  name: 'u',
  roles,
  capabilities,
});

test('枚举角色全等命中：ManageAccess 具备 manage:access', () => {
  const u = user(['Admin'], []);
  assert.equal(hasCapabilityIn(u, 'manage:access'), true);
});

test('枚举角色全等命中：SuperAdmin 同样具备', () => {
  const u = user(['SuperAdmin'], []);
  assert.equal(hasCapabilityIn(u, 'manage:access'), true);
});

test('角色大小写变体仍算全等（admin ≡ Admin，V2 规范名全小写但历史数据有 Admin）', () => {
  assert.equal(hasCapabilityIn(user(['admin'], []), 'manage:access'), true);
});

test('★相似名角色不误命中：admin_readonly 不具备 manage:access', () => {
  const u = user(['admin_readonly'], []);
  assert.equal(
    hasCapabilityIn(u, 'manage:access'),
    false,
    'admin_readonly 不是管理员，子串匹配曾误放行',
  );
});

test('★相似名角色不误命中：super-admin / xadminx / Admin 观察员 均不命中', () => {
  for (const role of ['super-admin', 'xadminx', 'not-an-admin', 'Admin候选', 'administrator_lite']) {
    assert.equal(
      hasCapabilityIn(user([role], []), 'manage:access'),
      false,
      `${role} 含 admin 子串但不是管理员枚举值`,
    );
  }
});

test('非管理员角色不具备 manage:access', () => {
  for (const role of ['user', 'restricted_user', 'User', 'RestrictedUser']) {
    assert.equal(hasCapabilityIn(user([role], []), 'manage:access'), false, role);
  }
});

test('无角色无能力：fail-closed 返回 false', () => {
  assert.equal(hasCapabilityIn(user([], []), 'manage:access'), false);
  assert.equal(hasCapabilityIn(null, 'manage:access'), false);
});

test('能力字面量归一仍生效：PascalCase 后端值与 colon 查询面等价', () => {
  assert.equal(hasCapabilityIn(user([], ['ManageAccess']), 'manage:access'), true);
  assert.equal(hasCapabilityIn(user([], ['manage:access']), 'manage:access'), true);
  assert.equal(hasCapabilityIn(user([], ['Manage_Access']), 'manage:access'), true);
});

test('能力面同样不做子串匹配：ManageAccessXxx 不得放行 manage:access', () => {
  assert.equal(hasCapabilityIn(user([], ['ManageAccessXxx']), 'manage:access'), false);
});

// ── 自审补充：枚举必须覆盖本仓**真实**角色字面量 ──────────────────────────────
// 值来自 shared/src/contracts/manage/types.ts:4-8 的 `ManageUserRole`
// （"user" | "restricted_user" | "admin" | "super_admin"），不凭记忆。
// 上一版漏了 `super_admin`（规范名下划连写）⇒ 超级管理员被误判为非管理员（fail-closed 过头）。
test('★枚举覆盖规范角色字面量：super_admin 是管理员', () => {
  assert.equal(hasCapabilityIn(user(['super_admin'], []), 'manage:access'), true);
});

test('★枚举覆盖大小写变体：SuperAdmin / Super_Admin 是管理员', () => {
  for (const role of ['SuperAdmin', 'Super_Admin', 'SUPER_ADMIN']) {
    assert.equal(hasCapabilityIn(user([role], []), 'manage:access'), true, role);
  }
});

test('★角色侧不剥分隔符：super-admin 不是管理员（剥了就会形似放行）', () => {
  assert.equal(
    hasCapabilityIn(user(['super-admin'], []), 'manage:access'),
    false,
    '角色侧剥分隔符会让 super-admin 归一成 superadmin 而越权放行',
  );
});

test('导出 ADMIN_ROLE 常量与后端内置管理员角色名一致', () => {
  assert.equal(ADMIN_ROLE, 'admin');
  assert.equal(hasCapabilityIn(user(['admin'], []), 'manage:access'), true);
});
