# 交接 · FE-YUN139-POOLS-UI（给已合契约补段 A 的池/成员管理 UI）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-yun139-pools-ui`，
worktree `/data/wt-w5/fe-yun139-pools-ui`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **6 个非我改动**（他人 in-flight WIP）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 先 read 契约确认字段与解包键（不凭记忆）

读 `origin/main:shared/src/contracts/manage/yun139/{types,api}.ts` 实测：

| 方法 | 返回 | 解包键 |
|---|---|---|
| `listAccountPools` | `Yun139AccountPool[]` | **items** |
| `createAccountPool` | `Yun139AccountPool` | **pool** |
| `getAccountPool` | `Yun139AccountPool` | **pool** |
| `updateAccountPool` | `Yun139AccountPool` | **pool**（PATCH：只发传入字段） |
| `deleteAccountPool` | `boolean` | **ok** |
| `listAccountPoolMembers` | `Yun139AccountPoolMember[]` | **items** |
| `addAccountPoolMember` | `Yun139AccountPoolMember` | **member** |
| `removeAccountPoolMember` | `boolean` | **ok** |

- Pool **10 字段**（`id/name/description?/strategy/cooldownSeconds/maxConcurrent/
  isEnabled/memberCount/createdAt/updatedAt`）；Member **11 字段**。
- 建池除 `name` 外均可省；**改池 PATCH**；加成员 `weight` 可省 ⇒ 不传。

## 2. 改动清单

| 文件 | 内容 |
|---|---|
| `host/src/pages/manage/yun139/Yun139AccountPoolsSection.tsx`（新） | 池管理面：列表 + 建/改名/删除 + 成员增删 |
| `host/src/pages/manage/yun139/index.tsx` | 挂载 `<Yun139AccountPoolsSection />`（在凭据档案区之后） |
| `shared/src/query/keys.ts` | 新增 `yun139.pools()` / `yun139.poolMembers(poolId?)`（照既有 `profiles()` 形态） |

## 3. UI 形态（**复用既有外壳/样式，未新造**）

照 `Yun139ProfilesSection.tsx` 同款，全部复用既有件：
- 外壳 `ManageSectionCard`（`longtail-shared/components.tsx`）、样式 `ManageShared.module.css`；
- 三态 `FeedbackState`（loading/error/empty）+ `InlineBanner`（成功/失败提示）+ `StatusBadge`；
- 删除 `ConfirmDialog`（**不可逆 ⇒ 确认弹窗**，`pending` 禁用 + 失败透传）；
- 数据面 `useQuery`/`useMutation` + `queryKeys`（页面不直调 API）。

## 4. ★语义要点

- **删除需确认**：`ConfirmDialog` 文案点名池名与「成员关系一并移除」。
- **weight 留空 ⇒ 不传**（交后端缺省），不臆造 0。
- **改名为 PATCH**：只发 `{ name }`，不整体覆盖其它字段。
- **错误文案走既有 `getErrorMessage`** 出后端原文，不本地臆造。
- a11y（沿用 FE-A11Y-KEYBOARD-AUDIT 口径）：每个输入框 `aria-label`；
  「管理成员」按钮 `aria-expanded` 与展开态一致；错误态经 `FeedbackState`
  （其 `role/aria-live` 已在上张卡补齐）。

## 5. 过程中的自纠（如实记）

我第一版**凭印象**写了 UI 原件的 props 与 class，实测后纠正（未迁就实现）：
- `StatusBadge` 实际是 `{ label, variant }`（我误写成 `tone` + children）
  ⇒ `variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'`；
- `InlineBanner` 需 `variant` + **必填 `title`**（我误写成 `tone`）；
- `ConfirmDialog` 需 `onOpenChange`（我误写成 `onCancel`）；
- CSS 类 `cardTitle` / `cardMeta` **不存在** ⇒ 改用既有 `activityTitle` / `tableHint`。
纠正后 `styles.*` 缺失项 = **0**。

## 6. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   npm test                               → tests 409 / pass 409 / fail 0
                                                 （node --test，非 vitest）
node scripts/check-frontend-component-size.mjs  → PASS
node scripts/check-contract-mappers.mjs         → PASS
```

## 7. 跳过项 / 待裁

- **无 UI 单测**：本仓**无** jsdom / testing-library（三个 `package.json` 均无），
  引入属**新依赖**、违反 ponytail ⇒ 不引。UI 正确性由 **tsc 类型检查 + 契约层测试
  （段 A 6 例 / 段 B 2 例，均已在 main 且绿）** 兜底；浏览器交互（Tab 顺序、
  焦点归还、读屏播报）需人工或 CI 复跑。
- **`check-frontend-size` 未跑（登记跳过）**：读 `host/dist/.vite/manifest.json`
  （`pnpm build` 产物）；新 worktree 从未构建、`host/dist` 不存在 ⇒ 环境问题非回归，
  建议 CI 复跑。
- **段 B（lease/report）UI 未做**：本卡范围是段 A；段 B 属调度运维，若需页面另开卡。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。验证时临时软链的 `node_modules` 提交前已移除。

## 8. 提交

一原子项一提交：池管理 UI 组件 + 页面挂载 + 2 个 queryKey + 本 handoff。

`Reviewed-by: pending-non-author-review`
