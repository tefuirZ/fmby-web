/**
 * 用户自助「积分 / 签到」契约门面（FE-POINTS-CHECKIN）。
 *
 * ★为何是独立门面但**不复制实现**：用户面与管理面**共用同一批 DTO 与 mapper**
 *   （账户/流水/规则配置 wire 完全相同）⇒ 这里只做**再导出**，单一真源，零重复。
 *   实现位于 `contracts/manage/peripherals`（管理面 rewards 端点也在那里）。
 *
 * 端点真源（origin/main）：`crates/fmby-v2-http/src/routes/router_core.rs`
 *   GET  /api/rewards/me
 *   GET  /api/rewards/rule
 *   POST /api/rewards/checkins
 *   POST /api/rewards/redemptions/server-days
 *   POST /api/rewards/redemptions/media-request-credits
 */

export { rewardsApi } from '../manage/peripherals/api';
export type {
  RewardsMySummary,
  RewardsCheckinResult,
  RewardsRedemptionResult,
  RewardsRuleVersionRecord,
  RewardsPointAccountRecord,
  RewardsLedgerEntryRecord,
  RewardsRuleConfigRecord,
} from '../manage/peripherals/types';
