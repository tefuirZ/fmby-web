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

/** 历史/V2 变体：与 `ADMIN_ROLE` 同义的角色字面量（全等集合，非子串）。 */
const ADMIN_ROLE_ALIASES: ReadonlySet<string> = new Set(['admin', 'superadmin']);

/** 归一：小写 + 去掉 `: _ -`（仅用于**能力字面量**，角色侧禁用）。 */
function normalizeCapability(value: string): string {
  return value.toLowerCase().replace(/[:_-]/g, '');
}

/** 角色名归一：仅小写（**不**剥分隔符，`admin_readonly` 必须仍是 `admin_readonly`）。 */
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
