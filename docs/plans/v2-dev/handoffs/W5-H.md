# W5-H 交付说明 · 契约声明文件对齐

**仓库**：`ws-zcode-writer1-web`　**分支**：`w/zcode/writer1-w5h-contract-fields`（自 `origin/main` = `72f6bf8`）
**commit**：`ccf9acb`
**判据**：`pnpm verify` **EXIT=0**（shared 99 / host 308 / component-size 0 违规）；`check-contract-sync` **PASS**。

---

## ① 两处 `.d.ts` 改了什么

### A. `shared/src/contracts/manage/raw-types.d.ts`
1. 新增 `export type MountCredentialStatusWire = 'bound' | 'unbound' | 'expired' | 'not_required';`（对齐 `.ts:244`）。
2. `RawManagedMountRecord` 补 `credential_status?: MountCredentialStatusWire | null;`（对齐 `.ts:272`）。
3. `RawManagedMountDetailResponse` 补 `credential_status?: MountCredentialStatusWire | null;`（对齐 `.ts:470`）。

### B. `shared/src/contracts/manage/raw-types.d.ts`（scan 触发）
把陈旧接口 `RawManageScanTriggerResponse { library_id?, libraryId?, task_type?, tasks, skipped_source_ids?, skippedMountIds? }`
**对齐为 `.ts` 真实名与形状**：

```ts
export interface RawManageLibraryScanTriggerResponse {
    libraryId: string;
    tasks: RawScanTriggerTask[];
    skippedMountIds: string[];
}
```

### C. `shared/src/contracts/manage/mapping/scans.d.ts`
import 与函数签名同步改用 `RawManageLibraryScanTriggerResponse`（否则重命名后悬空引用 → tsc 报错）。**这是 B 的必要连带修改，非额外改动。**

> 未动任何 `.ts` 源（`.ts` 在 `origin/main` 上本已正确）。

---

## ② scan 那两个字段的消费点 · codegraph 结论

**结论：`task_type` / `skipped_source_ids` 是陈旧残留，前端无任何真实消费点 → 已从 `.d.ts` 移除。**

- `codegraph callers "RawManageScanTriggerResponse" -p .` → 仅 `shared/src/contracts/manage/mapping/scans.d.ts:1`（即 **`.d.ts` 镜像自身**，无 `.ts` 调用者）。
- `codegraph callers "mapManageScanTriggerResponse" -p .` → 仅 `scans.d.ts:1`（同上；`.ts` 真实函数是 `mapManageLibraryScanTriggerResponse`，见 `shared/src/contracts/manage/mapping/scans.ts:38`）。
- 字面量逃生阀（`FMBY_ALLOW_SYMBOL_GREP=1`，理由：查具体字面量字段名）：
  - `skipped_source_ids` / `skippedSourceIds`：`shared/src` + `host/src` **零消费点**（仅 `types.d.ts:615` 一处陈旧域名残留，属另一处镜像陈旧，不在本卡范围）。
  - 消费点 file:line：真实库级扫描映射在 `shared/src/contracts/manage/mapping/scans.ts:38-46`，字段为 `raw.libraryId / raw.tasks / raw.skippedMountIds`（camelCase，对位后端 `LibraryScanTriggerResponse` serde camelCase）。

---

## ③ ⚠️ 重要：门禁真实状态（必须回报，否则会产生假绿）

**本卡前提「门禁读 `.d.ts`」与实际不符，且 `origin/main` 上门禁本已绿。** 证据如下。

1. **门禁读 `.ts`，不读 `.d.ts`**：`scripts/check-contract-sync.mjs` 的
   `walkFiles(dir, ext)` 明确排除 `.d.ts` ——
   `... else if (entry.name.endsWith(ext) && !entry.name.endsWith(".d.ts")) out.push(full);`（脚本内该行）。
   前端侧对账在 `extractFrontend()` 里只遍历 `shared/src/contracts` 下的 `.ts`。
   `scripts/check-query-params.mjs` 同样排除 `.d.ts`（同款守卫）。
   ⇒ **改 `.d.ts` 不会改变门禁结果。**

2. **对 `origin/main` 复跑门禁 = 绿**：
   ```bash
   cd FMBY-V2
   FMBY_WEB_DIR=<frontend @ origin/main> FMBY_CONTRACT_DIR=.../fmby-ui-contract-v2 \
     node scripts/check-contract-sync.mjs
   # → CONTRACT SYNC PASSED / EXIT=0
   ```
   `origin/main`（`72f6bf8`）的 `raw-types.ts` **已含** `credential_status`（5 处，含 `RawManagedMountDetailResponse` 内），
   且**不含** `RawManageScanTriggerResponse` —— 由 W5-A `6c20771` 落盘并已随 v0.2.x 发布。

3. **6 条违规只在「陈旧前端 worktree」复现**：默认 `FMBY_WEB_DIR=../fmby-web` 指向的是
   `/home/tefuir/rustproject/fmby-web`（branch `w/zcode/writer2-fe-ai-review`，tip `5a1c612`，`frontend eps: 157` vs 主线的 220）。
   该 worktree 的 **`.ts` 本身**缺 `credential_status`、且仍定义 `RawManageScanTriggerResponse`，
   因此门禁报出与卡面完全一致的 6 条：
   ```
   FRONTEND_FIELD_EXTRA  POST /api/manage/libraries/{*}/scan 前端类型 RawManageScanTriggerResponse 含清单外字段: library_id, task_type, skipped_source_ids
   FRONTEND_FIELD_MISSING GET   /api/manage/mounts/{*}         前端类型 RawManagedMountDetailResponse 缺清单字段: credential_status
   FRONTEND_FIELD_MISSING POST  /api/manage/mounts
   FRONTEND_FIELD_MISSING PATCH /api/manage/mounts/{*}
   FRONTEND_FIELD_MISSING POST  /api/manage/mounts/{*}/validate
   FRONTEND_FIELD_MISSING POST  /api/manage/mounts/{*}/refresh-access
   ```

**⇒ 建议**：CI 的 `contract-sync` job checkout 的是 `tefuirZ/fmby-web @ main`（=`72f6bf8`，已绿）。
若你本地复跑仍见 6 条红，是 `FMBY_WEB_DIR` 落到了那个陈旧 worktree —— 请把该目录更新到 `main`
（或改指 `origin/main` 的 checkout）。**合并本卡 `.d.ts` 改动对门禁结果无影响（它是死镜像的卫生对齐）；
真正解锁的是「让门禁跑在 `main` 上」。**

> 另注：`.d.ts` 与 `.ts` 同名并存的镜像文件是**大量陈旧**的（如 `RawManagedMountRecord` 的 `note/rate_config/visibility_rule/sidecar_*` 也缺），
> 本卡只按卡面补 `credential_status` 与 scan 触发两处。彻底方案应由生成/校验脚本统一，建议单独开卡。

---

## ponytail 一句

「跳过了什么/何时再加」：只补了卡面点名的两处声明字段，未顺势重写整份陈旧 `.d.ts` 镜像（会牵动 `types.d.ts`/多处 `mapping/*.d.ts`，需单独卡）；
未改 `.ts`（主线已正确）；`.d.ts.map` 未同步（仅 sourcemap，无功能影响）。
