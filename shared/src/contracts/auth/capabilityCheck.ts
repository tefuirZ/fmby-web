/**
 * 能力判定（capability check）——**全前端唯一事实源**。
 *
 * #289 背景：`SessionProvider.hasCapability` 原用
 * `roles.some(r => r.toLowerCase().includes('admin'))` **子串放行**：
 * `admin_readonly` / `super-admin` / `xadminx` / `not-an-admin` 这类
 * **含 admin 子串但不是管理员**的角色会被放行成管理员（越权视图）。
 *
 * 纪律：
 * - **角色侧全等枚举**（大小写不敏感），不做子串、不剥 `:/_/-`；
 * - **能力侧**保留大小写/分隔符归一（`ManageAccess` ↔ `manage:access`），
 *   因为后端 `capability_to_str`（fmby-v2 bridges/access.rs）发的是
 *   PascalCase，而前端查询面是 colon 风格 —— 这层归一是**契约必需**，
 *   一并废除会把真管理员也误禁；
 * - 归一**只在能力侧**：`ManageAccessXxx` 与 `manage:access` 归一后不等，
 *   不得放行（能力面同样不做子串匹配）。
 */

import type { User } from './user';

/** 后端内置管理员角色名（小写规范名）。角色匹配与它全等（大小写不敏感）。 */
export const ADMIN_ROLE = 'admin';

/**
 * 管理员角色字面量的**全等集合**（非子串）。
 *
 * ★真值分层（2026-10-08 核到后端源码，别再凭前端类型猜）：
 * - **后端内置角色只有 3 个**：`admin` / `user` / `restricted_user`
 *   （`fmby-v2 crates/fmby-v2-domain/src/access/policies.rs:38-52` `BUILTIN_ROLES`，
 *   内含 `BUILTIN_ADMIN_ROLE = "admin"`；`bridges/database.rs:519` 种子只 ensure 这三个）。
 *   V1 曾有 `SuperAdmin`，已被迁移 `20260601090000_single_admin_role.sql` **删除**。
 * - #2127：前端 `ManageUserRole` 曾多出的 `"super_admin"` 已全链删除（union /
 *   注册码下拉 / labels / mapping），本集合收敛到唯一真实生效项 `admin`。
 *
 * 角色面只管「视图是否按管理员呈现」，命中与否都不改变安全语义
 * （真实权限由 capabilities 决定；见 `hasCapabilityIn` 的能力侧判定）。
 */
const ADMIN_ROLE_ALIASES: ReadonlySet<string> = new Set([
  'admin',
]);

/** 归一：小写 + 去掉 `: _ -`（仅用于**能力字面量**，角色侧禁用）。 */
function normalizeCapability(value: string): string {
  return value.toLowerCase().replace(/[:_-]/g, '');
}

/**
 * 角色名归一：**仅 trim + 小写**，绝不剥分隔符。
 *
 * 剥分隔符在角色侧是危险的：它会把**形似串**归一成枚举内字面量（历史例：
 * `super-admin` → `superadmin`；#2127 之前 `superadmin` 曾在管理员枚举里 ⇒
 * 形似放行）。角色判定必须**集合内全等**（trim + 小写后），形似串一律不命中。
 * （实测：上一版我剥了分隔符，既有用例「super-admin 不命中」立刻转红，已回退。）
 */
function normalizeRole(value: string): string {
  return value.trim().toLowerCase();
}

/** 角色是否管理员枚举值之一（全等，非子串）。 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLE_ALIASES.has(normalizeRole(role));
}

/**
 * 用户是否具备指定能力。
 *
 * 无 user / 无角色 / 无能力 ⇒ `false`（fail-closed，绝不从用户名推断）。
 */
export function hasCapabilityIn(user: User | null | undefined, capability: string): boolean {
  if (!user || !capability) return false;

  // 角色侧：全等枚举命中即放行（后端角色模板把 capability 挂在角色上，
  // 前端拿到的 roles 是枚举名，不是能力串）。
  if (Array.isArray(user.roles) && user.roles.some(isAdminRole)) return true;

  if (!Array.isArray(user.capabilities)) return false;

  const target = normalizeCapability(capability);
  return user.capabilities.some(
    (c) => typeof c === 'string' && normalizeCapability(c) === target,
  );
}
