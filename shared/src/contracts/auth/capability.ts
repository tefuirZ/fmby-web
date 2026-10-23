/**
 * 能力（Capability）的**类型真源**（F1）。
 *
 * 后端权威：`fmby-v2 crates/fmby-v2-domain/src/access/models.rs:197-252`
 *   `pub enum Capability { Browse, Play, ManageAccess, ManageLibrary,
 *                         ManageMount, ManageSettings, DangerousAction, ViewAudit }`
 *   带 `as_str()`（唯一 string 真源，#890 Stage 1）与 `parse()`（fail-closed）。
 *
 * ★为什么本文件单独存在（不并进 user.ts）：
 *   `User` 与 `capabilityCheck` 都要引 `Capability`，而 `capabilityCheck` 又依赖
 *   `User` ⇒ 类型放在 user.ts 会形成 contracts/auth 内部的循环导入面。抽出来是
 *   「类型真源唯一 + 无环」的唯一解（ponytail：不多加抽象，只为断环）。
 *
 * ★为什么是字面量联合而不是 enum：
 *   TS `enum` 生成运行时对象；字面量联合在类型面等价、在 wire 面天然对齐后端
 *   `as_str()` 的字符串形态（后端发的就是这些串），零转换。
 *
 * ★联合类型本身**不是**安全保证：能力串仍从 wire 进来，必须在边界 parse
 *   （见 `parseCapability` 的 fail-closed 与 `mapMeResponse` 的过滤）。
 *   本文件与后端枚举的一致性由 `shared/tests/capability-union.test.ts` 钉住。
 */

/** 能力字面量（与后端 `Capability::as_str()` 逐值对齐，顺序无关）。 */
export type Capability =
  | 'Browse'
  | 'Play'
  | 'ManageAccess'
  | 'ManageLibrary'
  | 'ManageMount'
  | 'ManageSettings'
  | 'DangerousAction'
  | 'ViewAudit';

/**
 * 全部能力字面量（运行时数组；供遍历/断言/UI 能力表用）。
 *
 * ★单一真源：`as const` 推导出的元组，与上面的联合类型**同源**（改一处另一处编译红），
 *   不存在「类型说 8 项、数组给 7 项」的漂移。
 */
export const CAPABILITIES = [
  'Browse',
  'Play',
  'ManageAccess',
  'ManageLibrary',
  'ManageMount',
  'ManageSettings',
  'DangerousAction',
  'ViewAudit',
] as const satisfies readonly Capability[];

/**
 * wire 串 → 能力；**fail-closed**（未知串 ⇒ `null`，绝不回落默认值，
 * 与后端 `Capability::parse` 同口径）。
 *
 * 只认后端 `as_str()` 的精确字面量 —— **不做**大小写/分隔符归一：
 * 归一是**查询侧**的事（`capabilityCheck.normalizeCapability`），边界侧必须严格，
 * 否则 `managee:access` 这类错拼会被静默收下。
 */
export function parseCapability(value: unknown): Capability | null {
  if (typeof value !== 'string') return null;
  return (CAPABILITIES as readonly string[]).includes(value)
    ? (value as Capability)
    : null;
}

/**
 * wire 字符串数组 → 能力数组；**未知项丢弃**（fail-closed）。
 *
 * 用于 `/api/auth/me` 等响应的边界收口：后端将来新增能力而前端还没跟 ⇒
 * 该能力在前端「不存在」而不是「当成某个默认值」——宁可少给权限，不可错给。
 */
export function parseCapabilities(values: unknown): Capability[] {
  if (!Array.isArray(values)) return [];
  const out: Capability[] = [];
  for (const v of values) {
    const c = parseCapability(v);
    if (c !== null) out.push(c);
  }
  return out;
}
