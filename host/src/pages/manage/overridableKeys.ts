// ★G-13 / FE-1（#642）：原硬编码 OVERRIDABLE_KEYS 常量已彻底删除。
// 可写键完全由后端 `SecretsStatusDto.overridable_keys` 单一真源驱动。
//
// REWORK-FE1 必修 2：ManageSecretsPage 原 fallback（从 entries 推导
// `e.overridable !== false`）恒真 —— 后端 SecretStatusEntryDto 无 overridable 字段
// ⇒ e.overridable 恒 undefined ⇒ `undefined !== false` 恒 true
// ⇒ 不可覆盖键（如 telegram.webhook_secret）漏进可写下拉。
// 删 fallback，只认真源；缺失/空时 fail-closed（空列表，不提供误导入口）。
//
// ponytail: 一行 fail-closed 足够，不造 filter 抽象；抽成独立纯模块便于契约测试
// （页面是 .tsx 无法被测试 loader 解析）。若后端将来真的下发 entries.overridable
// 字段且要前端本地过滤，再回来加（届时需先补 BE 契约 + 契约测试）。

/** 可写键单一真源：只认后端 `SecretsStatusRecord.overridableKeys`，缺失=空列表 fail-closed。 */
export function resolveOverridableKeys(
  status: { overridableKeys?: string[] } | undefined,
): string[] {
  return status?.overridableKeys ?? [];
}
