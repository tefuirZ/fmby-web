import type { Capability } from './capability';

/**
 * 用户类型定义
 */

/** 用户角色（V1 形态；#2127：'SuperAdmin' 已删 —— 后端迁移 20260601090000 已把它并入 Admin，V2 永不下发） */
export type UserRole = 'Admin' | 'User' | 'RestrictedUser';

/** 用户能力标识（与后端 `Capability` 枚举逐值对齐；真源见 ./capability） */
export type { Capability } from './capability';

/** 用户信息（与后端 UserInfo 对齐） */
export interface User {
  /** 用户 ID */
  id: string;
  /** 用户名 */
  name: string;
  /** 显示名称 */
  display_name?: string;
  /** 用户角色列表 */
  roles: string[];
  /** 用户能力集合 */
  capabilities: Capability[];
}
