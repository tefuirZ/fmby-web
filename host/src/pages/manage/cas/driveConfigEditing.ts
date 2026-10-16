/**
 * CAS 盘配置的编辑态逻辑（抽出以便**行为断言**）。
 *
 * 为什么抽出：留在组件里就只能靠「读源码里有没有某串」断言，那种断言对本文件
 * 的三个变异全部恒绿（详见 PR #9 评论）：
 *   M14 保存后不清草稿 / M15 dirty 恒 false / M16 优先级回退失效发 NaN
 * —— 源码里照样有 `savedKey`、`dirty`、`Number.isNaN` 这些字样。
 * 抽出纯函数后才能真正 import 调用、直接验行为。
 */

import type { CasDriveConfig } from '@fmby/v2-shared/contracts/manage/casAdmin';

export function casDriveKey(config: CasDriveConfig): string {
  return `${config.providerType}:${config.driveRef}`;
}

/**
 * 该行是否有**未保存的真实改动**。
 *
 * @param savedKey 最近一次保存成功的盘键；该行的草稿已作废（否则刷新后仍被判脏）。
 */
export function isDriveDirty(
  config: CasDriveConfig,
  draft: CasDriveConfig | undefined,
  savedKey: string | null,
): boolean {
  if (!draft) return false;
  if (casDriveKey(config) === savedKey) return false;
  return draft.enabled !== config.enabled || draft.priority !== config.priority;
}

/**
 * 优先级输入解析。后端 `priority` 是 `i32`
 * （`fmby-v2-contracts/src/dto/cas_admin.rs:27`），非法输入回退到**原值**，
 * 绝不把 `NaN` 发给后端（否则 serde 反序列化 400，且 UI 会显示「NaN」）。
 */
export function parsePriorityInput(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  // i32 边界外直接夹取，避免后端 400。
  if (parsed > 2147483647) return 2147483647;
  if (parsed < -2147483648) return -2147483648;
  return parsed;
}

/**
 * #658 G1（FIX-CAS-G1+G2）· 盘配置**写面可用性**裁决：未接线就不给出会失败的按钮。
 *
 * ★事实依据（不猜，可复跑）：`PUT /api/admin/cas/drives` 的 handler 存在
 *   （fmby-v2 `crates/fmby-v2-http/src/routes/admin_cas.rs::cas_upsert_drive_config`），
 *   但桥层 `crates/fmby-v2-bridges/src/bridges/cas_admin.rs` **没有实现** `upsert_drive_config`
 *   ⇒ 命中 `CasAdminService` 的 trait 默认体 `Err(AppError::Internal)`（`ERR-500-allow`）
 *   ⇒ **点即 500**。核实：`codegraph query upsert_drive_config -p <v2>` 只给 trait 声明与 http 调用点。
 *
 * ★为什么不是"点了没反应"、也不是"假装保存成功"：那都是把失败藏起来（违 #42 纪律 / RB-4）。
 *   渲染期就置灰 + 说明原因 ⇒ 用户知道改动不会生效，运维知道缺的是后端哪一块。
 *   后端补上实现后把 `DRIVE_CONFIG_WRITE_WIRED` 翻 true（一处）即恢复可写，页面无需再改。
 */
export const DRIVE_CONFIG_WRITE_WIRED = false;

export interface DriveWriteAffordance {
  /** true ⇒ 编辑控件（开关/优先级）与「保存」一律禁用。 */
  disabled: boolean;
  /** 禁用时对用户说明的原因；可写时为 null（不占位、不冗余）。 */
  note: string | null;
}

/** 写面可用性（纯函数 ⇒ 可被契约测试**直接调用**，不靠源码字符串断言）。 */
export function resolveDriveWriteAffordance(
  wired: boolean = DRIVE_CONFIG_WRITE_WIRED,
): DriveWriteAffordance {
  if (wired) return { disabled: false, note: null };
  return {
    disabled: true,
    note: '盘配置写面未接线：后端 upsert_drive_config 仍是 fail-closed 默认体（保存会返回 500），故本页只读——修改不会被保存。',
  };
}

