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