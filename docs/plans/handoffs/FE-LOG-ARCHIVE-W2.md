# FE-LOG-ARCHIVE（W2 交付）

分支 `w/w2/fe-log-archive`（worktree `/data/wt-w2-fe-logarchive`，基于 origin/main `b092741`）。

## 1. 卡面目标 vs 实际

卡面：接后端 `GET /api/manage/runtime-log-archives`（清单，能力门 `VIEW_AUDIT`）
+ `GET /api/manage/runtime-log-archives/{archiveId}/download`（zip，`id=sha256(file_name)`），
接进既有日志页（复用既有外壳，不新造），错误码按 `shared/src/errors/*` 对拍。

**前端原先零引用已核实**（对 `mapRuntimeLogArchives*` / `runtime-log-archives` / `RuntimeLogArchive`
四种写法全仓扫描 = 0 命中；后端 DTO 注释里那句「前端 `mapRuntimeLogArchivesQuery` 发 page/pageSize」
是 **V1 语境**，不是 V2 前端已有实现）。

## 2. 交付内容（3 提交）

| 提交 | 面 |
|---|---|
| `6f91e57` | 契约层：`types.ts` / `raw-types.ts` / `mapping/records.ts` / `mapping/query-params.ts` / `api.ts` / `index.ts` / `query/keys.ts` |
| `4c77de6` | UI：`runtime-logs/RuntimeLogArchiveSection.tsx`（新）+ `runtime-logs/archive.ts`（新）+ 页面接线 2 行 |
| `ef3cbfe` | 对拍测试 `host/tests/runtime-log-archives.contract.test.ts`（4 例） |

**对拍矩阵（域 × 状态）**：

| 面 | 后端真实 wire | 前端契约 | 状态 |
|---|---|---|---|
| 清单端点 | `GET /api/manage/runtime-log-archives` | `manageApi.getRuntimeLogArchives` | ✅ 一致 |
| 清单 query | 主名 `pageSize`（+snake 别名 `page_size`） | 发 `pageSize` | ✅ 一致（测试锁定） |
| 清单响应 | `items/total/log_dir/retention_days` | `items/total/logDir/retentionDays` | ✅ 映射锁定 |
| 条目 8 字段 | `id/file_name/log_date/compressed_size_bytes/original_size_bytes/compression_ratio/created_at/expires_at` | 同名 camelCase | ✅ 全字段断言 |
| 可空性 | `log_date`/`expires_at` `Option` | `undefined`（**不造假值**） | ✅ 测试锁定 |
| 下载端点 | `GET …/{archiveId}/download`，`id=sha256(file_name)` | `buildRuntimeLogArchiveDownloadUrl(id)` 按路径段转义 | ✅ 测试锁定 |
| 能力门 | `VIEW_AUDIT`（同 runtime-logs） | 前端不另加门（后端权威） | ✅ |

**设计取舍（ponytail）**：下载用**原生 `<a href download>`** —— 客户端鉴权是 Cookie
（`shared/src/api/client/core.ts`: `credentials:'same-origin'`），GET 无需 CSRF 回显
⇒ 不必自造 blob/`createObjectURL` 管道（全仓亦无此先例）。错误码走既有
`getErrorMessage`（`@fmby/v2-shared/errors`），**未自造文案**。

外壳复用：`ManageSectionCard` / `EmptyTableRow` / `InlineBanner` / `ManageShared.module.css`
既有类（`table`/`tableWrap`/`desktopOnly`/`mobileOnly`/`mobileRecordCard`/`secondaryButton`…全部实测存在）。
自页面抽出的原因：`ManageRuntimeLogsPage.tsx` 已 394 行，逼近组件体积闸 400 warn（本卡只接线 2 行）。

## 3. RED → GREEN 原文

```
RED   : node --import ./tests/register-aliases.mjs --test tests/runtime-log-archives.contract.test.ts
        ⇒ ERR_MODULE_NOT_FOUND runtime-logs/archive/index.ts（实现前）
GREEN : 同命令 ⇒ tests 4 / pass 4 / fail 0
        ✔ ① GET … query camelCase pageSize，响应映射 camelCase
        ✔ ①b 不传 query ⇒ 不带任何查询串
        ✔ ①c log_date / expires_at 缺失 ⇒ undefined（不造假值）
        ✔ ② 下载 URL：/{id}/download，id 需转义
```

## 4. 当次验证输出

```
cd shared && ./node_modules/.bin/tsc -p . --noEmit            ⇒ EXIT=0（include:["src"]，真编译 210 文件）
cd host   && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit ⇒ EXIT=2，22 错 —— 全为 main 既有（见 §5）
cd host   && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                              ⇒ tests 401 / pass 401 / fail 0（EXIT=0）
node scripts/check-frontend-component-size.mjs                ⇒ EXIT=0
node scripts/check-contract-mappers.mjs                       ⇒ EXIT=0（7 域全 PASS）
node scripts/check-frontend-dupes.mjs                         ⇒ EXIT=1（1 例，main 既有，见 §5）
node scripts/check-frontend-size.mjs                          ⇒ EXIT=1（缺 vite manifest，见 §5）
```

## 5. ⚠⚠ 两个 main 既有红 + 一条**卡面命令修正**（都非本卡引入，附硬证据）

### 5a. main 前端本来就 **typecheck 不过、build 失败**（P1）

```
cd host && tsc -p tsconfig.app.json --noEmit   ⇒ 22 errors
  13  src/pages/login/LoginPage.tsx        （TS2451 重复声明 mfaChallenge / TS2300 重复标识符
                                            AuthResponse / MfaVerifyPanel / TS2393 重复函数实现）
   5  src/pages/login/forms/MfaVerifyPanel.tsx
   2  src/pages/browse/CollectionsListPage.tsx
   1  src/pages/login/forms/LoginForm.tsx
   1  src/pages/manage/mounts/components/MountDrawer/sections/Pan115DirectoryBrowserSection.tsx
本卡文件命中数 = 0。
```
`vite build` 同因失败：`[vite:esbuild] The symbol "mfaChallenge" has already been declared`
@ `LoginPage.tsx:71`。

**硬证据**：在**干净 `origin/main`** 临时 worktree（`git worktree add --detach /tmp/… origin/main`）跑同一命令
⇒ **同样 22 错、逐文件计数完全一致**。成因看形态是 FE-MFA-TOTP-UI（`9409c1c`）合并时**块被复制**（重复 import/状态/函数）。
⇒ 需**专门的修复卡**（`LoginPage.tsx` 去重 + `useCollectionsList` 导出缺失 + mounts 那条），
在此之前 main 前端 build 不可能绿。

### 5b. `check-frontend-dupes` 红（1 例，main 既有）

```
[Unique Implementation Violation (queryKeys Factory)] shared/src/viewmodels/useCollectionsList.ts:14
```
该文件属他人卡 `30b646c`（`git diff origin/main -- <file>` 为空 = 我未改）；
干净 `origin/main` 复算 ⇒ **同样 1 例**（硬证据同上方法）。

### 5c. ★卡面命令修正：`cd host && npx tsc -p . --noEmit` 是**虚绿**

`host/tsconfig.json` 是 **solution 文件**（`"files": []` + 仅 `references`）——
`tsc -p .` 不带 `-b` **不编译任何文件** ⇒ 恒 EXIT=0（我先跑它也得到 0，差点假绿）。
仓内 `package.json` 的 `typecheck`/`build` 用的是 **`-p tsconfig.app.json`**（`include: ["src", "../shared/src/**/*"]`），
**这才是权威口径**。建议后续 FE 卡面统一写 `-p tsconfig.app.json`。
（`shared/tsconfig.json` 有 `include:["src"]` ⇒ 其 `-p .` 是真的，绿有效。）

### 5d. `check-frontend-size`（体积闸）本分支**无法出结论**

该闸要求 `host/dist/.vite/manifest.json`（即先 `vite build`）；而 build 被 §5a 的 main 既有错误卡死
⇒ **不是本卡的体积问题，是 main 编译不过**。待 §5a 修复卡落地后可跑。

## 6. 跳过项 / 何时再加（ponytail）

- 未做分页 UI（后端收 `page`/`pageSize`，本卡固定 `page:1,pageSize:50`；归档量到几十个以上再加翻页）。
- 未做「删除归档 / 立即打包」写操作（后端本卡只提供清单 + 下载两个 GET；无端点可接）。
- 未自造 blob 下载管道、未新造卡片/表格外壳、未引新依赖。
- 未动 `useCollectionsList.ts` / `LoginPage.tsx`（他人卡文件，避免撞车）⇒ §5a/§5b 请派专门卡。
- 未改契约仓 / mirror（前端仓无该 mirror 面）。

## 7. codegraph / 取证记录

```
（后端仓）codegraph query "runtime_log_archive" -p .
  → http/src/routes/manage/runtime_log_archives.rs（路由）
  → contracts/src/dto/manage.rs:296 RuntimeLogArchiveDto / :315 RuntimeLogArchivesQuery
  → state/manage_runtime_log_archive.rs:20 list_runtime_log_archives
codegraph query "RuntimeLogArchive" → ManagedRuntimeLogArchivesResponse / RuntimeLogArchiveDownload
```
前端侧（FE 仓 codegraph 索引未覆盖，按字面量 python3 扫描）：
确认 `mapRuntimeLogArchives*` / `runtime-log-archives` / `RuntimeLogArchive` **全仓 0 命中**；
`ManageShared.module.css` 的 15 个复用类逐个实测存在；
`buildUrl` 实测 `undefined` 值被丢弃（`core.ts`）⇒ 不传 query 时不带查询串（测试①b 锁定）。