# 交接 · FE-MEDIA-REPROCESS-SURFACE（媒体重处理作业面）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-media-reprocess-surface`，
worktree `/data/wt-w5/fe-media-reprocess-surface`（基于 `origin/main`，`git worktree add` 新建）。

> 说明：主签出 `/home/tefuir/rustproject/fmby-web` 当时有 **5 个非我改动**（他人 in-flight WIP +
> 2 个未跟踪文件）。按硬纪律我**未提交他人 WIP**，仅把 `git diff` 备份到
> `/tmp/fmby-web-wip-1791035612.patch`，然后**新建独立 worktree 从 origin/main 开工**，
> 主签出原样未动。

---

## 1. 先核实缺口为真（一律用 `origin/main` ref，不查工作区）

后端 5 端点已注册（`crates/fmby-v2-http/src/routes/router_manage.rs`）：
```
GET  /api/manage/operations/media-reprocess            → list_media_reprocess_tasks
POST /api/manage/operations/media-reprocess            → create_media_reprocess_task
GET  /api/manage/operations/media-reprocess/{id}       → get_media_reprocess_task
POST /api/manage/operations/media-reprocess/{id}/cancel → cancel_media_reprocess_task
POST /api/manage/operations/media-reprocess/{id}/resume → resume_media_reprocess_task
```
前端取证（新 worktree = origin/main）：
- `/api/.../media-reprocess*` 路径调用：**0 处**；
- 全仓 `reprocess` / `Reprocess` 等标识符命中：**0 个文件**。
⇒ **缺口为真，非重复造**。

## 2. 后端 wire（`origin/main` 实测，逐字段对拍依据）

handler：`crates/fmby-v2-http/src/routes/manage_media_reprocess.rs`
DTO：`crates/fmby-v2-http/src/dto/manage_media_reprocess.rs`

- 能力门：**`MANAGE_LIBRARY`**；未装配端口 ⇒ 500 fail-closed（不假称「无作业」）。
- 列表：`limit` 后端 clamp **1..=100**，缺省 **20**。
- 任务 DTO `MediaReprocessTaskDto`：**18 字段**；时间 **RFC3339 字符串**（存储侧 epoch-ms）。
- 创建请求 `MediaReprocessCreateRequest`：**6 字段**（`mode`、`library_id?`、
  `batch_size?`(缺省 `DEFAULT_BATCH_SIZE`)、`confirm_action?`、`session_confirmation?`、
  `current_password?`；后三者后端**接受但不二次校验**）。
- 枚举 wire = **PascalCase**（mode **10 态** / status **6 态**；单一真源在
  `fmby_v2_domain::media_reprocess`）。
- `Stats` = **39 个计数**（缺省 0）。
- ★**危险确认**：`mode_requires_dangerous_confirmation(mode)` —— **除两个 DryRun
  （`DryRun` / `StructureReplayDryRun`）外全部需要** `DANGEROUS_ACTION` 能力 + `?confirmed=true`。

## 3. 改动清单（最小，落在既有 `operations/` 子契约内）

| 文件 | 内容 |
|---|---|
| `shared/src/contracts/manage/operations/types.ts` | 新增 `MediaReprocessMode`（10 态字面量联合）、`MediaReprocessStatus`（6 态）、`MediaReprocessStats`、`MediaReprocessTask`（18 字段）、`MediaReprocessCreateInput` |
| `shared/src/contracts/manage/operations/api.ts` | 新增 `mediaReprocessApi`（listTasks/getTask/createTask/cancelTask/resumeTask）+ raw 接口 + `fromTask`/`toRawCreate`/`clampLimit` + 免确认集合 `DRY_RUN_MODES` |
| `shared/src/contracts/manage/operations/index.ts` | 导出 `mediaReprocessApi` |
| `shared/tests/media-reprocess.test.ts`（新） | 契约对拍 4 例 |

未新增子契约目录：复用既有 `operations/`（`/manage/operations/*` 本就是它的域）。

## 4. ★语义要点（已在测试钉死）

- **枚举原样透传**：wire 是 PascalCase ⇒ 前端**不自造小写映射**（避免与后端漂移）。
- **时间保持 RFC3339 串**：后端存储侧才是 epoch-ms，前端不擅自转数字。
- **危险确认不降级**：非两个 DryRun 的 mode 建作业时**必须**带 `?confirmed=true`；
  两个 DryRun **不带**（否则后端会 403/400）。前端**不静默提交**。
- **limit 夹取**：前端同后端口径 clamp 到 1..100、缺省 20，不发无效值。
- **不伪造零值**：`scopeLibraryId`/`lease*`/`lastError*`/`startedAt`/`finishedAt` 为 null 时如实呈现。
- **不造错误文案**：错误走既有 `getErrorMessage`（出后端 `message` 原文），本卡**未新增**错误码表。
- `Stats` 用宽松 `Record<string, number>` 承载 39 计数，不逐个枚举以免与后端漂移。

## 5. RED → GREEN

- **RED**：先写 4 例 → `does not provide an export named 'mediaReprocessApi'`（真红）。
- 中途 1 处是**我的测试**错：我把 import 写成了 `@fmby/v2-shared/contracts/manage`，
  但 `operations/` **并未**从 manage barrel 再导出（与 `peripherals` 同款按子路径导入）
  ⇒ 按纪律**改测试**（改为 `contracts/manage/operations`），未改实现、未弱化断言。
- **GREEN**：4/4 通过。

## 6. 当次验证（原文级）

```
shared: ./node_modules/.bin/tsc -p . --noEmit        → exit 0（0 错）
host:   ./node_modules/.bin/tsc -p . --noEmit        → exit 0（0 错）
host:   npm test                                     → tests 397 / pass 397 / fail 0
                                                       （node --test，非 vitest）
shared: node --import ./tests/register-resolver.mjs --test tests/media-reprocess.test.ts
                                                     → tests 4 / pass 4 / fail 0
shared: node --import ./tests/register-resolver.mjs --test tests/*.test.ts
                                                     → tests 132 / pass 132 / fail 0
node scripts/check-frontend-component-size.mjs        → PASS
node scripts/check-contract-mappers.mjs               → PASS
node scripts/check-frontend-size.mjs                  → FAIL（**环境缺构建产物**，非代码回归，见 §7）
```

## 7. 跳过项 / 待裁（明写）

- **`check-frontend-size` FAIL 是环境问题，非本卡回归**：该闸读
  `host/dist/.vite/manifest.json`（`pnpm build` 产物）。新 worktree **从未跑过构建**
  （`host/dist` 目录不存在），且我的改动只在 `shared/src` + 1 个 shared 测试，
  不可能产生/删除 dist 产物。跑 `pnpm build` 属重活（且本卡纪律不跑重活）⇒ **登记为跳过项**，
  **建议 CI 复跑确认**（在装好依赖并执行构建的环境里）。
- **未做页面/交互**（本卡只交付契约层）：作业列表/详情/建作业/取消/恢复的 UI 与
  危险确认弹窗需另开卡；契约已就位后可直接消费 `mediaReprocessApi`。
- 新 worktree 无 `node_modules`，我**临时软链**了主签出的 `node_modules`
  （根/shared/host 三处）以跑验证；**提交前会移除**，不进版本库。
- 未改后端、未造字段、未改契约仓/mirror、未引依赖、未跑全仓重活、不碰农场、未用 `git stash`、
  未用 `cargo fmt --all`。

## 8. 提交

一原子项一提交：类型 + `mediaReprocessApi` + barrel 导出 + 契约测试 4 例 + 本 handoff。

`Reviewed-by: pending-non-author-review`
