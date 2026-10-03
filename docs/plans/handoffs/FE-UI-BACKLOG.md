# 交接 · FE-UI-BACKLOG（补账号池「段 B」调度运维 UI）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-ui-backlog`，
worktree `/data/wt-w5/fe-ui-backlog`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **6 个非我改动**（他人 in-flight WIP）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 面选择（先说清，避撞车）

三个候选中取 **① 段 B（lease/report）UI**：
- **① 段 B**：契约 `leaseFromPool` / `reportLease` **已合入且无页面**（139 页面此前只挂了段 A 的池管理面）⇒ **取**。
- **② 迁移向导**：另一席 `/data/wt-lib/gap-sweep-2` 在做 migration wizard ⇒ **避让**。
- **③ 日志归档 / 存储占用**：已有 `host/src/pages/manage/runtime-logs/RuntimeLogArchivesSection.tsx`
  ⇒ **已有 UI，不需补**。

## 2. 先 read 契约确认字段（不凭记忆）

`shared/src/contracts/manage/yun139/types.ts`（origin/main 实测）：
- `Yun139LeaseInput{ stickyKey? }` → `Yun139LeaseResult{ poolId?, leaseId, profileId,
  displayName, expiresAt }`，`expiresAt` 为 **epoch 毫秒**（过期自动归还）。
- `Yun139ReportLeaseInput{ profileId, leaseId?, success, cooldownSeconds? }` → **ok 布尔**。

UI 原件真实 props（实测）：`ConfirmDialog` 需 **`onOpenChange`**（另有 `open/title/description/
impact?/confirmLabel?/pending?/onConfirm`）；`StatusBadge{ label, variant }`；
`InlineBanner{ variant, title, … }`（title 必填）；`FeedbackState{ variant, title, description, action? }`。

## 3. 改动清单

| 文件 | 内容 |
|---|---|
| `host/src/pages/manage/yun139/Yun139PoolLeaseSection.tsx`（新） | 段 B 运维面：选池 + 试租借 + 结果回写（成功/失败） |
| `host/src/pages/manage/yun139/index.tsx` | 挂载 `<Yun139PoolLeaseSection />`（在池管理面之后） |

## 4. ★语义要点（诚实口径，契约已定未改）

- `poolId === null` ⇒ 显示「—」，**不伪造**池 ID；
- `stickyKey` 留空 ⇒ **不发送**（后端 `Option`）；
- 冷却秒数留空 ⇒ **不发送**，由账号池配置决定；
- **回写失败会冷却该账号** ⇒ 走 `ConfirmDialog` 二次确认，并在 `impact` 展示冷却影响
  （填了秒数显示「冷却 N 秒」，留空显示「由池配置决定（本次不传）」）；
- 错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造文案；
- 未取得租借时禁用回写并提示「尚未租借」。

## 5. 形态（复用既有，未新造）

照同目录 `Yun139AccountPoolsSection.tsx`：`ManageSectionCard` + `FeedbackState` +
`InlineBanner` + `StatusBadge` + `ConfirmDialog` + `ManageShared.module.css`。

## 6. 自纠 / 自检（吸取「凭印象写 props」教训）

写完即做两项自检，提交前归零：
- `styles.*` 与 `ManageShared.module.css` 差集 = **0**（用到 13 个类全部存在：
  activityTitle/batchDetailPanel/batchHeaderRow/batchMetaRow/buttonRow/dangerButton/
  fieldGroup/input/label/mono/primaryButton/secondaryButton/tableHint）；
- 无臆造 props（`StatusBadge` 用 `label+variant`、`InlineBanner` 用 `variant+title`、
  `ConfirmDialog` 用 `onOpenChange`）。
`tsc` 双包**一次通过**。

## 7. 当次验证（rebase 到最新 main 后复跑）

```
shared: ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit  → exit 0（0 错）
host:   npm test                               → tests 409 / pass 409 / fail 0
                                                 （node --test，非 vitest）
node scripts/check-frontend-component-size.mjs  → PASS
node scripts/check-contract-mappers.mjs         → PASS
styles 差集自检                                  → MISSING classes: []
git rebase origin/main                          → up to date（无冲突）
```

## 8. 跳过项 / 待裁

- **无 UI 单测**：本仓**无** jsdom / testing-library（三个 `package.json` 均无），
  引入属**新依赖**、违反 ponytail ⇒ 不引。正确性由 **tsc 类型检查 + 契约层测试
  （`shared/tests/yun139-pool-lease.test.ts` 2 例，已在 main 且绿）** 兜底；
  浏览器交互（Tab/焦点归还/读屏）需人工或 CI 复跑。
- **`check-frontend-size` 未跑（登记跳过）**：读 `host/dist/.vite/manifest.json`
  （`pnpm build` 产物）；新 worktree 从未构建 ⇒ 环境问题非回归，建议 CI 复跑。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。验证时临时软链的 `node_modules` 提交前已移除。

## 9. 提交

一原子项一提交：段 B 运维 UI 组件 + 页面挂载 + 本 handoff。

`Reviewed-by: pending-non-author-review`
