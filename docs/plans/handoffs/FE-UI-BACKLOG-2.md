# 交接 · FE-UI-BACKLOG-2（管理面 API 令牌 UI）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-ui-backlog-2`，
worktree `/data/wt-w5/fe-ui-backlog-2`（`git worktree add` 自 `origin/main` 新建）。

> 主签出当时有 **6 个非我改动**（他人 in-flight WIP）⇒ 按硬纪律**未提交他人 WIP**，
> 直接新建独立 worktree 从 `origin/main` 开工，主签出原样未动。

---

## 1. 取了哪个面（先说清，避撞车）

**取：管理面 API 令牌（`adminApiTokens`：list / create / revoke）**，挂在高级设置页。

三个可选面的逐一核查（**均避开**）：
| 候选 | 核查结果 | 结论 |
|---|---|---|
| ① 迁移向导 | `/data/wt-yun-fe-migration` = 分支 `w/w/fe-migration-wizard` **正在做**（且已有 `FE-MIGRATION-WIZARD.md` + `host/tests/migration-wizard.contract.test.ts`）；另契约只有 `inspect`/`export`（`import` 是 501） | **避让** |
| ② 日志归档 | `/data/wt-w2-fe-logarchive`（`w/w2/fe-log-archive`）**与** `/data/wt-zcode/fe-log-archive` **两席在做**；且已有 `RuntimeLogArchivesSection.tsx` | **避让** |
| ③ 139 段 A 剩余交互 | 10 个契约方法中 **9 个已有 UI**；仅 `getAccountPool`（单池读取）未用 —— 但列表 `listAccountPools` 已返回完整池字段，单读属**冗余请求** | **不做**（ponytail：不为凑量加无用请求） |

**所取面的严格判据**：
- 契约 `shared/src/contracts/manage/adminApiTokens/{api,types}.ts` **已合入 origin/main**（3 个文件）；
- 后端 `crates/fmby-v2-http/src/routes/admin.rs`：`admin_list_api_tokens` /
  `admin_create_api_token` / `admin_revoke_api_token` —— 实测**均非 501 占位**
  （能力门 `MANAGE_ACCESS`；端口未装配 ⇒ 后端 `Validation`）；
- 前端**零 UI**（无任何 `adminApiTokens` 引用）；
- 无他人正在做：原属 `w/w/fe-admin-surface` 的契约**已合入 main**，该 worktree **0 commits ahead 且干净**。

## 2. 先 read 契约确认字段（不凭记忆）

`shared/src/contracts/manage/adminApiTokens/types.ts`：
```
AdminApiToken{ id:number, name:string, scopes:string[], createdAtMs:number,
               expiresAtMs:number|null }   // wire snake_case: created_at_ms / expires_at_ms
AdminApiTokenCreateInput{ name, scopes, expiresAtMs? }
```
- `adminApiTokensApi.list()` / `create(input)` / `revoke(id)`；路径 `/api/manage/admin/api-tokens`。
- ★`expiresAtMs === null` ⇒ **长期有效**，本页如实显示「长期有效」，**不伪造日期**。

UI 原件真实 props（实测）：`ConfirmDialog` 需 **`onOpenChange`**（+ `open/title/description/
impact?/confirmLabel?/pending?/onConfirm`）；`StatusBadge{ label, variant }`；
`InlineBanner{ variant, title, … }`（title 必填）；`FeedbackState{ variant, title, description, action? }`。

## 3. 改动清单

| 文件 | 内容 |
|---|---|
| `host/src/pages/manage/AdminApiTokensSection.tsx`（新） | API 令牌面：列表 + 创建 + 吊销（确认弹窗） |
| `host/src/pages/manage/ManageAdvancedPage.tsx` | 挂载 `<AdminApiTokensSection />`（高级设置页） |

## 4. ★语义要点

- **revoke 不可逆** ⇒ `ConfirmDialog` 二次确认，`impact` 明示「使用该令牌的外部脚本将立即失效」；
- **空列表** ⇒ 显式空态（「暂无 API 令牌」），**不伪造占位令牌**；
- `expiresAtMs=null` ⇒ 「长期有效」；有值 ⇒ 显示到期时间；
- scope 为空 ⇒ 显示「（无显式 scope）」，不谎报权限；
- 错误一律经既有 `getErrorMessage` 出后端原文，不本地臆造。

## 5. 形态（复用既有，未新造）

`ManageSectionCard` + `FeedbackState` + `InlineBanner` + `StatusBadge` + `ConfirmDialog`
+ `ManageShared.module.css`，挂在既有 `ManageAdvancedPage`（高级设置）。

## 6. 自纠 / 自检

写完即做两项自检，提交前归零：
- `styles.*` 与 `ManageShared.module.css` 差集 = **0**（12 个类全部存在：
  activityItem/activityList/activityTime/activityTitle/buttonRow/dangerButton/
  fieldGroup/fieldHint/input/label/primaryButton/secondaryButton）；
- 无臆造 props（`StatusBadge` 用 `label+variant`、`InlineBanner` 用 `variant+title`、
  `ConfirmDialog` 用 `onOpenChange`）。
`tsc` 双包**一次通过**。

## 7. 当次验证（rebase 后复跑 + 删除侧核查）

```
git fetch && git rebase origin/main          → up to date（无冲突）
git diff --numstat origin/main HEAD
   204  0  host/src/pages/manage/AdminApiTokensSection.tsx
   3    0  host/src/pages/manage/ManageAdvancedPage.tsx
   total deletions = 0                        ← 纯新增，未删任何人代码
shared: ./node_modules/.bin/tsc -p . --noEmit → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit → exit 0（0 错）
host:   npm test                              → tests 413 / pass 413 / fail 0
                                                （node --test，非 vitest；较基线 +4）
node scripts/check-frontend-component-size.mjs → PASS
node scripts/check-contract-mappers.mjs        → PASS
styles 差集自检                                 → MISSING classes: []
```

## 8. 跳过项 / 待裁

- **无 UI 单测**：本仓**无** jsdom / testing-library（三个 `package.json` 均无），
  引入属**新依赖**、违反 ponytail ⇒ 不引。正确性由 **tsc 类型检查 + 契约层测试** 兜底；
  浏览器交互（Tab/焦点归还/读屏）需人工或 CI 复跑。
- **`check-frontend-size` 未跑（登记跳过）**：读 `host/dist/.vite/manifest.json`
  （`pnpm build` 产物）；新 worktree 从未构建 ⇒ 环境问题非回归，建议 CI 复跑。
- scope 输入按「逗号/空白分隔」解析；若后端要求固定枚举的 scope 多选，可另开卡改为下拉多选。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、
  未用 `git stash`、未用 `cargo fmt --all`。验证时临时软链的 `node_modules` 提交前已移除。

## 9. 提交

一原子项一提交：API 令牌 UI 组件 + 高级设置页挂载 + 本 handoff。

`Reviewed-by: pending-non-author-review`
