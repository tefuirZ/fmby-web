/**
 * 用户类型定义
 */

/** 用户角色 */
export type UserRole = 'SuperAdmin' | 'Admin' | 'User' | 'RestrictedUser';

/** 用户能力标识（与后端 capability.rs 对齐） */
export type Capability = string;

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
  capabilities: string[];
}
