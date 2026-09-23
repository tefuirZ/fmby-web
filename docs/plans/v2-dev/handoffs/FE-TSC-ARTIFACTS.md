# FE-TSC-ARTIFACTS 交付说明 · 前端 tsc 产物入库 + `.ts` 体积门禁

**仓库**：`ws-zcode-writer1-web`　**分支**：`w/zcode/writer1-fe-tsc-artifacts`（自 `origin/main` = `34947d0`，已含 W5-H v0.2.11）
**commits**：`8f91b21`（删产物 + `.gitignore`）· `ed2ee43`（`.ts` 体积门禁 + 契约硬顶）

## ponytail 段

- **阶梯**：第 1/4 阶「不需要存在的东西删掉」→ 删 156 个 tsc 声明产物；门禁改动**复用既有棘轮脚本**（不另写新闸、不引新依赖）。
- **点名天花板 + 升级路径**：契约 `.ts` 不再「无门禁」——**400 warn + 硬上限 1200 fail**。`api.ts` 1005 行现在 warn 通过，再涨必卡，逼着按端点/域拆分契约模块。
- **跳过了什么/何时再加**：**本卡不拆任何业务文件**（3 个非契约超线 `.ts` 只 seed 进棘轮基线 + 登记待拆，避免与在途卡撞车）；`--update-baseline` 的「只许减不许增」语义保持不变；`.d.ts.map` 的 sourcemap 未另作处理（随产物一并删除）。**升级路径**：契约密度口径（是否按端点数另设阈值）见文末待裁决项。

## 变更清单

### ① 删 156 个 tsc 产物 + `.gitignore`
- 删除：`shared/src` 下 **78 个生成 `.d.ts` + 78 个 `.d.ts.map`**。
- **保留**：`shared/src/global.d.ts`（手写、无 `.map`，声明 `*.module.css`，shared 自身 typecheck 依赖——shared 有 `.tsx` import CSS module）；`host/src/vite-env.d.ts`、`host/src/types/dplayer.d.ts`（手写，被 `tsconfig.app.json` 的 `files` 引用）。
- `.gitignore`（限定 `shared/src` + 负向保留）：
  ```gitignore
  shared/src/**/*.d.ts
  shared/src/**/*.d.ts.map
  !shared/src/global.d.ts
  ```

### ② `.ts` 纳入体积门禁
`scripts/check-frontend-component-size.mjs`：
- 新增 `walkTs()`（扫 `.ts`，排除 `.d.ts`）。
- **非契约 `.ts`**：沿用 400 warn / 500 fail + 棘轮（与 `.tsx` 同口径）。
- **契约 `.ts`（`shared/src/contracts/**`）**：400 warn（**不** fail）+ **硬上限 1200 fail**（绝对，不进棘轮）。
- 修一处既有 bug：`stale`（基线回收提示）原用只含 `.tsx` 的 `measured` 判定 → 会误报「已降到红线以下」；改用 `enforced`。

## codegraph 查证记录

- `codegraph callers "RawManagedMountDetailResponse" -p .` → 3 处，**全为 `.ts`**：`shared/src/contracts/manage/api.ts:1`、`mapping/mounts.ts:1`、`mapManagedMountDetailResponse`（`mapping/mounts.ts:50`）。
- `codegraph callers "RawManageLibraryScanTriggerResponse" -p .` → 3 处，**全为 `.ts`**：`mapping/scans.ts:1`、`api.ts:1`、`mapManageLibraryScanTriggerResponse`。
- 结论：**无任何消费点指向 `.d.ts`**（模块解析优先 `.ts`）；删除产物不改变任何调用链。
- 字面量逃生阀（`FMBY_ALLOW_SYMBOL_GREP=1`，理由：查字面量路径/后缀）：源码零 `.d.ts` 显式 import；`shared/package.json` `exports`/`types` 全指 `./src/*.ts`；`.d.ts.map` 的 `sources: ['api.ts']` 证实是 tsc 产物。

## RED → GREEN 原文

### RED1（删产物前 `pnpm verify`）
```
> fmby-web@0.2.11 verify
> pnpm versions && pnpm typecheck && pnpm build && pnpm build:themes && pnpm test && pnpm size && pnpm repo-size && pnpm dupes && pnpm contracts && pnpm theme-budget && pnpm component-size && pnpm theme-parity
...
EXIT=0
[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
shared test: ℹ pass 99 / ℹ fail 0
host test: ℹ pass 308 / ℹ fail 0
[PASS] 0 contract violations found.
[PASS] 0 违规，无超线组件。
[PASS] All declared domain skins satisfy required capabilities.
```

### GREEN（删 156 产物后 `pnpm verify`）
```
> fmby-web@0.2.11 verify
...
EXIT=0
[PASS] 版本门禁通过（四层独立版本 + 契约对齐）。
shared test: ℹ pass 99 / ℹ fail 0
host test: ℹ pass 308 / ℹ fail 0
[PASS] 0 contract violations found.
[PASS] 0 违规，无超线组件。
[PASS] All declared domain skins satisfy required capabilities.
```
> 删前删后完全一致 ⇒ **无任何路径隐式依赖这些产物**。

### 独立 `vite build`（删产物后）
```
> fmby-web@0.2.11 build
> pnpm --filter @fmby/v2-host build
...
dist/assets/index-D8uqbG4o.js      278.38 kB │ gzip: 84.10 kB
✓ built in 6.76s
EXIT=0
```

### RED2（新门禁能报红 · 临时探针，验后即删）
非契约 `.ts` 探针 `host/src/__probe_over_limit.ts`（502 行）：
```
[1] 扫描 host/src + shared/src 的 .tsx 与非组件 .ts（.tsx/非契约 .ts > 400 warn / > 500 fail；契约 .ts > 400 warn / > 1200 fail）...
  [FAIL] host/src/__probe_over_limit.ts: 502 行（新增）
  - [New Over-Limit Component] host/src/__probe_over_limit.ts
    502 行超 400 红线，且**不在基线清单内**（新增组件必须干净）。
GATE_EXIT=1
```
契约 `.ts` 探针 `shared/src/contracts/__probe_contract.ts`（1252 行）：
```
  [FAIL] shared/src/contracts/__probe_contract.ts: 1252 行（超契约硬上限 1200）
  - [Contract File Over Hard Ceiling] shared/src/contracts/__probe_contract.ts
    1252 行超契约硬上限 1200 行。...请按端点/域拆分为多个契约模块，勿堆单文件。
GATE_EXIT=1
```
两探针已删除。

### GREEN（门禁改动后 `pnpm verify`，当次原文）
```
> fmby-web@0.2.11 verify
...
EXIT=0
shared test: ℹ pass 99 / ℹ fail 0
host test: ℹ pass 308 / ℹ fail 0
[PASS] 0 违规；3 个存量超线文件在基线内且未上升（棘轮允许，须有拆分计划）。
[PASS] All declared domain skins satisfy required capabilities.
```

### `.gitignore` 双向实证（`git check-ignore -v`）
```
-- global.d.ts（应 NOT ignored）--   未被忽略 ✓
-- 新建 foo.d.ts（应 ignored）--     .gitignore:24:shared/src/**/*.d.ts	shared/src/contracts/__probe__.d.ts
-- 新建 foo.d.ts.map（应 ignored）-- .gitignore:25:shared/src/**/*.d.ts.map	shared/src/contracts/__probe__.d.ts.map
```

## 待拆清单（本卡不拆，登记）

| 文件 | 行数 | 归属 |
|---|---|---|
| `host/src/pages/manage/mounts/formUtils.ts` | 870 | 已另开卡 **FE-MOUNT-AGGREGATE**（评审 FE-OOP-03：过程式纯函数 → Mount 聚合根） |
| `shared/src/api/client.ts` | 506 | 与待派卡 **FE-API-AS-T**（`client.ts:387` 的 `as T` → 边界运行时不变量校验）**同文件**，避免撞车 |
| `host/src/pages/manage/runtimeLogPresentation.ts` | 506 | 登记待拆 |

三者已 seed 进棘轮基线 `docs/plans/v2-dev/evidence/fe-component-size-baseline.json`（不阻塞后续提交；降到 ≤400 后 `--update-baseline` 回收）。

## 待裁决项

1. **契约 `.ts` 是否应按端点密度另设口径**：现为「400 warn + 硬上限 1200」。当前 14 个契约 `.ts` 超 400（最大 `contracts/manage/api.ts` 1005）均在硬顶内 warn 通过。若希望更早逼拆，可下调硬顶或按端点数/行比设阈值——本卡不做，登记交主代理。
2. 本卡分支自 `origin/main`（已含 W5-H）起；删除的产物正是 W5-H 曾修补的同名 `.d.ts`，故**本卡须在 W5-H 之后合并**（已按此排序）。
