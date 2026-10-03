# 交接 · FE-TSC-BASELINE-FIX（前端既有 tsc 错误）

仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/w5/fe-tsc-baseline-fix`（基于 `origin/main`）。
本卡用 **ponytail**（最小改动、不造需求）；找符号只用 **codegraph**。

---

## 0. 先证伪：卡面点名的 2 处**均已漂移消失**，真实残余是另 1 处

开工即跑双包 tsc 取证（非凭印象）：

| 卡面点名 | 当前实测 | 判定 |
|---|---|---|
| ① `shared/.../peripherals/index.ts(11,43)` TS2724 `RawManagedCollection` | `shared` tsc **0 错**，`RawManagedCollection` 已不在报错中 | **已被 main 修掉**，无需本卡改 |
| ② `host/.../CollectionsListPage.tsx(20,23)` TS6133 `setRefreshTick` | `host` 报错中**无** `setRefreshTick` | **已被 main 修掉**，无需本卡改 |
| — | 实际残余：`host/src/pages/manage/mounts/mountFormState.ts(101,5)` **TS2353**：`'note' does not exist in type 'CreateManageMountRequest'` | **真实错误**，本卡修 |

⇒ 不对照卡面硬造改动；按「先证伪」修**当前真实错误**，以达成卡面的真实目标（双包 tsc 0 错）。

## 1. 真因取证（backend 为据，非猜测）

- 前端 `buildCreateMountPayload`（`host/src/pages/manage/mounts/mountFormState.ts:92`）发送
  `note / rateConfig / visibilityRule / sidecarNfo / sidecarSubtitle / sidecarPoster`
  （注释：后端 `ManagedMountCreateRequest` 与 Update 同收，R2.3–R2.6；对齐 PATCH 口径）。
- 后端 DTO 实测（`crates/fmby-v2-http/src/dto/manage/mount.rs`）：
  `ManagedMountCreateRequest` **确有** `note`(R2.4) / `rate_config`(R2.3) /
  `sidecar_nfo|subtitle|poster`(R2.6) / `visibility_rule`(R2.5)，且均 `#[serde(default)]`。
- ⇒ **错在前端契约类型缺声明**，不在 payload（payload 是对的）。
  若反过来删 payload 字段，会回退 FE-MOUNT-CONFIG-UI 的「新建挂载能提交配置」能力 ⇒ 不可取。

## 2. 改动（1 处，最小）

`shared/src/contracts/manage/types.ts` → `CreateManageMountRequest` 补 6 个**可选**字段
（camelCase 对齐现有 wire 命名与 payload 用法）：

```
note?: string;
rateConfig?: Record<string, unknown>;
visibilityRule?: Record<string, unknown>;
sidecarNfo?: boolean;
sidecarSubtitle?: boolean;
sidecarPoster?: boolean;
```

- 类型来源：`parseOptionalJsonTextSafe` 返回 `Record<string, unknown> | undefined`；
  `sidecar*` 在 payload 中为 `form.sidecarNfo` 等布尔。
- **不新增行为**，仅让类型如实反映后端已收字段。未改契约仓 / mirror。

## 3. RED → GREEN

- **RED**（开工取证）：`host` tsc `TS2353 ... 'note' does not exist in type 'CreateManageMountRequest'`（exit 1）。
- **GREEN**（补声明后）：双包 tsc 均 **0 错**（见 §4）。

## 4. 当次验证（原文级）

```
shared: npx tsc -p . --noEmit                      → exit 0, errors: 0
host:   npx tsc -p tsconfig.app.json --noEmit      → exit 0, errors: 0
node scripts/check-frontend-size.mjs               → PASS
node scripts/check-frontend-component-size.mjs     → PASS
node scripts/check-contract-mappers.mjs            → PASS
host: node --import ./tests/register-aliases.mjs --test tests/*.test.ts
                                                   → tests 373 / pass 373 / fail 0
```

## 5. 跳过项 / 登记（不擅自扩大范围）

- **未改 `UpdateManageMountRequest`**：它同样缺这几个字段，但 `buildUpdateMountPayload`
  未标注返回类型（推断），**当前不报错**。按 ponytail 最小改动只修报错面；
  建议另开卡把 Update 一并补声明（否则 PATCH 面继续「裸类型」）。
- **未动** `peripherals/index.ts`、`CollectionsListPage.tsx`（卡面点名处已在 main 上修好，
  复核确无报错）。
- 未跑全仓重活 / 未碰农场 / 未改契约仓 / mirror；未引依赖。
- 本卡**未**处理 `shared/src/contracts/manage/peripherals` 的 `RawManagedCollectionDetail`
  语义（若后续出现，属另一卡）。

## 6. 提交

一原子项一提交：`fix(shared): CreateManageMountRequest 补后端实收的 6 个可选字段（修 host tsc TS2353）`。

`Reviewed-by: pending-non-author-review`
