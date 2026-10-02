# HANDOFF — FE-MOUNT-CONFIG-UI：前端挂载配置面（R2.3–R2.6 六字段）

- 仓库 `/home/tefuir/rustproject/fmby-web`，分支 `w/fe/mount-config-ui`（基线 = origin/main `a1c13f9`）
- 卡面：`/root/fmby-orchestra/cards/FE-MOUNT-CONFIG-UI.md`
- 状态：**本卡完成**（提交 `dae33f8` 契约穿透 + `1612e8a` UI 输入面；工作树剩余改动仅为既有 evidence 快照/`host/dist.bak` 遗留，非本卡产出、未触碰）
- 纪律：ponytail + codegraph-only + TDD；不跑 cargo / 不碰农场 / 不改契约仓 `fmby-ui-contract-v2` / 不改 mirror

## 1. codegraph 实证（先证伪：缺什么）

| 层 | 实证（codegraph + 源码实读） | 结论 |
|---|---|---|
| 后端真源 | `crates/fmby-v2-http/src/dto/manage/mount.rs`：`ManagedMountCreateRequest` 与 `ManagedMountUpdateRequest` 均已实装 `note` / `rate_config` / `sidecar_nfo/subtitle/poster` / `visibility_rule`（R2.3–R2.6 注释在字段上），且 `deny_unknown_fields` | 后端已就绪，前端不发即功能不存在 |
| 表单状态层 | `mountFormState.ts`：`createEmptyMountForm`/`buildMountFormState`（回填，DATASOURCE-CRUD-BACKFILL-UI 先例）与 `buildUpdateMountPayload` 已含六字段；**`buildCreateMountPayload` 不含** | 状态层半就绪 |
| 契约层 | `shared/src/contracts/manage/types.ts` `Create/UpdateManageMountRequest` **无六字段**；`mapping/payloads.ts` `mapCreate/UpdateMountPayloadToApi` **静默丢弃** | **断层 ①**：payload 值到不了后端 wire |
| 校验层 | `mountValidation.ts` `validateMountForm` 不校验 `rateConfigText/visibilityRuleText` JSON 合法性；非法 JSON 在 mutation 内 `JSON.parse` 抛出 ⇒ 泛化 banner、无字段定位 | **断层 ②**：不诚实错误 |
| UI 层 | `host/src/pages/manage/mounts/` 全目录扫描：六字段仅在 `types.ts`/`mountFormState.ts` 出现，MountDrawer/sections 零 input/textarea/checkbox | **断层 ③**：功能不可达 |

```
codegraph query "MountDrawer" / "ManageSectionCard" / "useMountDrawerHandlers"
codegraph status（fmby-web 索引就绪）
grep 使用记录：仅字面量/目录清单扫描（python3 为主）；找符号全走 codegraph；
  本会话 grep 垫片拦截 2 次（`MountConfigSection`/`note\|rate_config` 纯标识符形态），
  均立即改正，未用 FMBY_ALLOW_SYMBOL_GREP 逃生阀。
```

## 2. RED → GREEN（两原子项，TDD 全环）

### 提交 `dae33f8`（层1：契约穿透 + 校验）

- **RED**：`host/tests/mount-config-ui.test.ts` 8 条，实测 **7 失败/1 通过**——
  ①a-d fetch 桩捕获真实 wire 体：六字段被 mapper 丢弃（`note: undefined`）；
  ②a/b 非法 JSON 无字段级错误；③ 描述符模块不存在（`ERR_MODULE_NOT_FOUND`，功能缺失形态）。
  ①c 额外锁「留空 ⇒ rate_config 显式 `null`」——后端 `undefined`=保留存量，与输入框「清空=清除」语义对齐。
- **GREEN**：`types.ts` 两契约补六字段；`payloads.ts` 两 mapper 穿透（snake_case 对位）；
  `mountFormState.ts` Create payload 补六字段 + Update 留空 ⇒ 显式 `null`；
  `mountValidation.ts` 补 `rateConfig`/`visibilityRule` 字段级 JSON 校验（错误键入 `MountFormErrors`）。

### 提交 `1612e8a`（层2：UI 输入面）

- `mountConfigFields.ts`（新）：六字段**纯函数描述符**（kind/text-toggle、formKey、label、
  placeholder、取值函数、errorKey）——node:test（strip-types 不支持 .tsx）可直接断言，
  .tsx 渲染与单测同源（先例：FE-IDENTITY-BINDINGS-EMAIL 的纯函数绑定形态）。
- `MountConfigSection.tsx`（新）：3 文本框（备注/速率/可见性，字段级错误 + placeholder 示例）
  + 3 开关（NFO/字幕/海报，`selectionCard` 既有样式）；isSaving 全停用。
- `MountDrawer.tsx`：create/edit 两个高级区（`AdvancedSectionWrapper` 内、PathPolicies 之后）各挂一节；
  `sections/index.ts` 导出。

## 3. 契约对位表（wire 三方一致）

| 前端契约（types.ts） | wire（payloads.ts） | 后端（dto/manage/mount.rs） | R# |
|---|---|---|---|
| `note?: string` | `note` | `note: Option<String>`（Some=替换） | R2.4 |
| `rateConfig?: Record \| null` | `rate_config` | `rate_config: Option<Value>`（null=清除） | R2.3 |
| `visibilityRule?: Record` | `visibility_rule` | `visibility_rule: Option<Value>`（{}/缺省=全可见） | R2.5 |
| `sidecarNfo/Subtitle/Poster?: boolean` | `sidecar_nfo/subtitle/poster` | 同名 `Option<bool>` | R2.6 |

后端响应面 `RawManagedMountRecord` 六字段早已在（回填数据源），本卡未改任何响应映射。

## 4. 当次验证（原文）

```
$ cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
ℹ tests 356  ℹ suites 12  ℹ pass 356  ℹ fail 0  ℹ duration_ms 12872
（新增 8 条全绿；既有 mount-datasource-backfill 13 条 / mount-formutils-exports 5 条无回归）

$ npx tsc -p tsconfig.app.json --noEmit（host）   → EXIT=0
$ npx tsc -p tsconfig.json --noEmit（shared）     → EXIT=0
$ node scripts/check-contract-mappers.mjs
[PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
```

农场侧待跑（本机不跑）：`pnpm verify`（含 build/e2e/size/dupes/theme 系门禁）。

## 5. 跳过项与诚实边界

1. **spec 覆盖是 6 条核心 + `/api/v1/*` 7 条，非 350 条全量**——全量反射提取（axum Router 遍历/utoipa）属大改 + 需契约仓对齐评审，前人登记与 perf 评审（docs/19:190 schemars/utoipa 停用）均指向不做；spec 顶部已加 SAMPLE 边界声明防误导。
2. **Create 面六字段为可选不强制**：后端语义「缺省=未配置」，创建后随时可编辑补配，UI 不加必填门槛（ponytail：不为「可能想配」的选项造两步流程）。
3. **未做 e2e（playwright）**：抽屉表单交互归既有 e2e 形态；本卡单测已锁描述符/校验/wire 三层，e2e 建议随下一张 mounts e2e 卡合并覆盖。
4. **未动 evidence 快照与 host/dist.bak 遗留**（工作区已有脏文件，非本卡产出，保持原样）。
5. **`openapi.rs` 三方版本漂移（`2.0.0` vs workspace `0.1.160`）不在本仓**：属 FMBY-V2 后端，前卡 OPENAPI-EXTRACT-DRIFT 已建门禁（`scripts/check-openapi-drift.mjs`，因写手碰撞移交主代理裁处），本卡不越仓修。

Reviewed-by: pending-non-author-review
