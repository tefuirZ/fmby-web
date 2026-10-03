# 交接 · FE-REWARDS-UI（给已合的 rewardsApi 补用户面 UI）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-rewards-ui`，
worktree `/data/wt-w5/fe-rewards-ui`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **6 个非我改动**（他人 in-flight WIP）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 先 read 确认（不凭记忆）

**契约层**（`shared/src/contracts/manage/peripherals/{types,api}.ts` + `contracts/rewards/index.ts`）：
| 方法 | 返回 |
|---|---|
| `getMySummary` | `RewardsMySummary` |
| `getCurrentRule` | `RewardsRuleVersionRecord` |
| `checkIn` | `RewardsCheckinResult` |
| `redeemServerDays` / `redeemMediaRequestCredits` | `RewardsRedemptionResult` |

- `RewardsMySummary`：`userId` / `account`（**null = 从未产生积分记录**）/ `totalCheckinDays` /
  `currentStreakDays` / `latestLedger`（**null = 无流水**）。
- `RewardsCheckinResult`：`created` / `awardedPoints`（**幂等命中为 0**）/ … 
- `RewardsRedemptionResult`：`applied`（**false = 幂等命中未重复扣减**）/ `balance` /
  `validUntilAfter`（**null = 非该类型或幂等未续期**）。

**UI 原件真实 props**（实测，非记忆）：
- `ManageSectionCardProps{ title, description?, actions?, children }`
- `FeedbackStateProps{ variant, title, description, action? }`
- `StatusBadgeProps{ label, variant }`，`variant: success|warning|danger|info|neutral`
- `InlineBannerProps{ variant, title, description?, actions? }`（**title 必填**）
- `SettingsPageHeader{ title, description, meta? }`；`SettingsSectionCard{ title, description?, children }`

## 2. 改动清单

| 文件 | 内容 |
|---|---|
| `host/src/pages/settings/RewardsSettingsPage.tsx`（新） | 用户自助积分/签到页：概览 + 规则 + 签到 + 兑换 |
| `host/src/pages/settings/settingsNavigation.ts` | 「个人」组新增 `/settings/rewards` 导航项 |
| `host/src/app/router/index.tsx` | `settings` 子路由新增 `rewards`（lazy，照 `playback`/`appearance` 同款） |

## 3. UI 形态（**复用既有，未新造**）

照 `IdentityBindingsSettingsPage.tsx`（同为设置中心自助面）：
`SettingsPageHeader` + `SettingsSectionCard` + `SettingsCenter.module.css`；
组件取 `@fmby/v2-shared/ui` 的 `Button` / `Input` / `InlineBanner` / `FeedbackState` / `StatusBadge`。

## 4. ★诚实口径（契约已定，本页不改）

- `account === null` ⇒ 显示「暂无积分账户」+ 引导首次签到，**不伪造 0 余额**；
- 重复签到（`created=false` / `awardedPoints=0`）⇒ 提示「今日已签到（本次未重复发放积分）」，
  **不谎报签到成功并发分**；
- `latestLedger === null` ⇒ 「暂无流水」；
- 兑换 `applied=false` ⇒ 「该兑换请求已处理过（本次未重复扣减）」；
- `validUntilAfter` 为 null ⇒ **不显示**有效期行。
- 错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造文案。
- 兑换带**幂等键**（`newIdempotencyKey()`），重复提交不重复扣减。

## 5. 自纠 / 验证手段（吸取今天「凭印象写 props 全错」的教训）

写完即做两项自检，**均在提交前归零**：
- `styles.*` 与 `SettingsCenter.module.css` 差集 = **0**（用到的 10 个类全部存在）；
- 所有原件 props 按 §1 实测签名书写（未出现 `tone` 这类臆造 prop）。
`tsc` 双包一次通过（shared 0 错 / host 0 错）。

## 6. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   npm test                               → tests 409 / pass 409 / fail 0
                                                 （node --test，非 vitest）
node scripts/check-frontend-component-size.mjs  → PASS
node scripts/check-contract-mappers.mjs         → PASS
styles 差集自检                                  → MISSING classes: []
```

## 7. 跳过项 / 待裁

- **无 UI 单测**：本仓**无** jsdom / testing-library（三个 `package.json` 均无），
  引入属**新依赖**、违反 ponytail ⇒ 不引。正确性由 **tsc 类型检查 + 契约层测试
  （`shared/tests/rewards-self.test.ts` 3 例，已在 main 且绿）** 兜底；
  浏览器交互（Tab/焦点/读屏）需人工或 CI 复跑。
- **`check-frontend-size` 未跑（登记跳过）**：读 `host/dist/.vite/manifest.json`
  （`pnpm build` 产物）；新 worktree 从未构建 ⇒ 环境问题非回归，建议 CI 复跑。
- **兑换数量用 DOM 读取**（`readQuantity` 走 `getElementById`）：为避开受控输入样板；
  若你偏好受控 `useState` 写法，可另开小卡改为受控（当前实现类型安全且 tsc 绿）。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。验证时临时软链的 `node_modules` 提交前已移除。

## 8. 提交

一原子项一提交：积分/签到页 + 导航项 + 路由注册 + 本 handoff。

`Reviewed-by: pending-non-author-review`
