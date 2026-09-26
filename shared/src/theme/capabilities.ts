/**
 * 主题能力面契约（WEB-GOV ④，继承 V1 能力机制裁剪版）。
 *
 * 目的：主题声明了某个 PageDomain 的 skin，就必须覆盖该 domain 要求的**能力面**，
 * 由 `scripts/check-theme-parity.mjs` 在 CI 强制（声明即负责，未声明则静默回落
 * host 默认页面——功能永不缺失）。
 *
 * 四项必须能力（ADR-001 §3 + WEB-C1 ④）：
 * - `realtime`：实时显示（host 注入 SkinRealtime，主题不得自建定时器/连接）；
 * - `mobile`：移动端布局（响应式/媒体查询）；
 * - `timezone`：时区显示（统一走 Asia-Shanghai 基线的时间派生，不得自行偏移）；
 * - `authorization`：授权状态（SkinState 的 forbidden 态必须有 DOM 输出）。
 *
 * **危险确认框不做**（用户裁决）：G-06 遗留项已裁决删除——危险操作统一由 host
 * 以 `?confirmed=true` 后端口径处理，前端不再造确认串，故不列入能力面
 * （见下方 `DANGER_CONFIRM_DECISION` 说明，供后续卡追溯）。
 */

import type { PageDomain } from './pageDomain';

/** 能力面键（四项必须）。 */
export type ThemeCapabilityKey = 'realtime' | 'mobile' | 'timezone' | 'authorization';

/** 全部能力键（顺序稳定，供门禁遍历）。 */
export const THEME_CAPABILITIES = [
  'realtime',
  'mobile',
  'timezone',
  'authorization',
] as const satisfies readonly ThemeCapabilityKey[];

/**
 * 各 PageDomain 要求的能力面。
 *
 * 当前四项对**所有** domain 均为必须（裁剪版口径：先全量覆盖，后续按 domain
 * 差异化时在此表收口，避免门禁规则散落）。
 */
export const REQUIRED_CAPABILITIES_BY_DOMAIN: Record<PageDomain, readonly ThemeCapabilityKey[]> = {
  'browse.home': THEME_CAPABILITIES,
  'browse.library': THEME_CAPABILITIES,
  'browse.item': THEME_CAPABILITIES,
  'browse.play': THEME_CAPABILITIES,
  manage: THEME_CAPABILITIES,
  settings: THEME_CAPABILITIES,
  observability: THEME_CAPABILITIES,
};

/**
 * G-06 裁决记录（危险操作确认口径）：
 *
 * 用户已裁决**不要**危险确认框 → 本契约**删除**「危险确认」能力项，危险操作统一
 * 保持 `?confirmed=true` 后端口径，前端不再造确认串。此常量为裁决留痕，供后续卡
 * 追溯（勿重新引入确认框能力面）。
 */
export const DANGER_CONFIRM_DECISION = {
  decision: 'no-danger-confirm-dialog',
  rationale:
    '危险操作由后端以 ?confirmed=true 口径权威处理；前端不复制确认串，避免双份确认逻辑与口径漂移。',
  /** 若未来重新引入，需在此说明并同步 REQUIRED_CAPABILITIES_BY_DOMAIN。 */
  reintroduceRequires: '主代理重新裁决 + 本常量更新 + 门禁同步',
} as const;

/**
 * 主题在其入口模块中声明的能力覆盖（供门禁读取）。
 *
 * 主题通过导出 `capabilities` 常量声明自己已实现的能力面（按 domain 或全局）。
 * 未声明 domain 的 skin → 不校验（回落 host，不视为缺失）。
 */
export interface ThemeCapabilitiesDeclaration {
  /** 全局能力（对所有声明的 domain 生效）。 */
  global?: readonly ThemeCapabilityKey[];
  /** 按 domain 覆盖（与 global 取并集）。 */
  byDomain?: Partial<Record<PageDomain, readonly ThemeCapabilityKey[]>>;
}

/** 取某主题对某 domain 已声明的能力集合（global ∪ byDomain）。 */
export function declaredCapabilitiesFor(
  declaration: ThemeCapabilitiesDeclaration | undefined,
  domain: PageDomain,
): ReadonlySet<ThemeCapabilityKey> {
  const set = new Set<ThemeCapabilityKey>();
  for (const key of declaration?.global ?? []) {
    set.add(key);
  }
  for (const key of declaration?.byDomain?.[domain] ?? []) {
    set.add(key);
  }
  return set;
}

/** 校验某 domain 的能力面是否齐备；返回缺失项（空数组 = 齐备）。 */
export function missingCapabilitiesFor(
  declaration: ThemeCapabilitiesDeclaration | undefined,
  domain: PageDomain,
): ThemeCapabilityKey[] {
  const declared = declaredCapabilitiesFor(declaration, domain);
  return REQUIRED_CAPABILITIES_BY_DOMAIN[domain].filter((key) => !declared.has(key));
}
