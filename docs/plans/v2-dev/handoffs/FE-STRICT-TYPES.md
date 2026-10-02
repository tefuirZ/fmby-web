# FE-STRICT-TYPES 交付说明（FE 写手 W4）

**仓库**：`/root/.paseo/worktrees/1e9ww33s/strict-types`（workspace `wks_2d37f3defea96f90`）
**分支**：`w/fe/strict-types`（自 `1cfab4b`）　**卡**：`/root/fmby-orchestra/cards/FE-STRICT-TYPES.md`
**提交**：`c3bdf6c`（本 handoff 为同分支后续 docs 提交）

---

## 1. codegraph 查证记录

先 codegraph 定位调用链，再 `FMBY_ALLOW_SYMBOL_GREP=1`（`FMBY_GREP_REASON` 已声明：`as unknown as` 是语法模式非符号）补齐断言全量。

| 断言点 | codegraph 依据 | 处置 |
|---|---|---|
| `DPlayerEngine.ts:145` `module.default as unknown as DPlayerConstructorLike` | `ThemeEntryModule` 类似邻域；ambient `dplayer` 类型见 `host/src/types/dplayer.d.ts`（`lang/preload/video.type` 为字面量联合） | 删断言，改 `typeof DPlayer` |
| `themeGlobals.ts:39`、`registry.ts:43,49` `window as unknown as Record` | `ThemeEntryModule @ shared/src/theme/index.ts:150` ← `loadIifeThemeEntry @ registry.ts:38` | 删断言，补 `Window` 声明 |
| `DomainSkinOutlet.ts:60` `DOMAIN_SKIN_DATA_REGISTRY as unknown as Record` | `DOMAIN_SKIN_DATA_REGISTRY @ host/src/theme/skins/loaders.ts:129`（`[K in PageDomain]?` 映射）；`resolvePageDomain @ shared/src/theme/index.ts:207 → PageDomain \| null` | `domain: string → PageDomain`，删断言 |
| `client.ts:243` `AbortSignal as unknown as { any? }` | TS 5.9.3（本仓安装）lib.dom 已声明 `AbortSignal.any` | 删断言，直用 |
| `client.ts:387` `(await response.json()) as T` | 泛型信任点，~150 处 `httpClient.<verb><T>()` 调用方 | 保留 + `ponytail:` 注释（上限/升级路径） |
| `useHome.ts:289` `librariesSectionRef as unknown as (node…) => void` | `useViewportTrigger @ shared/src/hooks/useViewportTrigger.ts:10` 返回 `RefCallback<TElement>`；`HomeViewModel.librariesSectionRef` 同为 `(node: HTMLDivElement \| null) => void` | 删断言（本就同型） |
| `useItemDetail.ts:79` `technical as unknown as Record<string, unknown>` | `ItemTechnicalInfo @ shared/src/contracts/browse/item/types.ts:4`（无索引签名） | 收敛为 `as Record<keyof ItemTechnicalInfo, unknown>`（值 unknown，不丢类型） |

字面量核验：改动后 `host/src` + `shared/src` 生产代码 `as unknown as` **0 处**（仅注释里提到该词）。

---

## 2. ponytail 段（跳过什么 / 何时再加）

- 跳过：不改 themes（`themes/{darkroom,_template}/src/index.ts` 各 1 处 `as unknown as`，见 §5 豁免）、不建 `scripts/check-frontend-strict-types.mjs` 棘轮门（卡面 scope 限 host/shared 生产 + 测试）、不动枚举映射里的字段级 `as X`（非 `as unknown as`，卡面未点）。
- `client.ts` 的 `as T` 无法安全消除：强制解码器会波及 ~150 调用点，且契约层 mapper 已在收口 → 只补 1 行 `ponytail:` 注释；**升级路径**=给 `httpClient` 增可选 decoder 参数并逐域迁移（注释已写）。
- `DPlayerEngine` 用薄 `on` 包装保留 `DPlayerEventName` 联合（否则该 type 变 unused，`noUnusedLocals` 报错）；未抽更细的类型工具。

## 3. RED → GREEN 原文

**RED**（仅删断言、不加类型支撑，`tsc` 失败 = 证明断言在掩盖真实类型缺口）：

```
$ tsc -p host/tsconfig.app.json --noEmit
host/src/features/player/engines/DPlayerEngine.ts(144,5): error TS2322: Type 'Promise<typeof DPlayer>' is not assignable to type 'Promise<DPlayerConstructorLike>'.
  … Types of property 'lang' are incompatible. Type 'string' is not assignable to type '"en" | "zh-cn" | "zh-tw" | undefined'.
host/src/theme/registry.ts(43,29): error TS7015: Element implicitly has an 'any' type because index expression is not of type 'number'.
host/src/theme/registry.ts(48,28): error TS7015: ...
host/src/theme/registry.ts(53,16): error TS7015: ...
host/src/theme/registry.ts(55,16): error TS7015: ...
host/src/theme/skins/DomainSkinOutlet.ts(60,20): error TS7053: ... 'string' can't be used to index type '{ "browse.home"?: ... }'
host/src/theme/themeGlobals.ts(41,10): error TS2339: Property 'ReactJSXRuntime' does not exist on type 'Window & typeof globalThis'.
HOST_EXIT=2
```

**GREEN**（补 `theme-globals.d.ts` + `PageDomain` + `typeof DPlayer` + 选项字面量 + 精确 `as Record<keyof …>`）：

```
$ tsc -p host/tsconfig.app.json --noEmit ; echo HOST_EXIT=$?
HOST_EXIT=0
$ tsc -p shared --noEmit ; echo SHARED_EXIT=$?
SHARED_EXIT=0
```

> shared 侧 RED `EXIT=0`：`AbortSignal.any` 已随 TS 5.9.3 声明、`useHome` 断言本就多余——属"删掉即安全"，非掩盖缺口；`useItemDetail` 直接删会退化为 `Object.entries` 的 `any` 重载，故 GREEN 用精确 `Record<keyof ItemTechnicalInfo, unknown>`。

---

## 4. 当次验证原文

```
$ node --import ./tests/register-aliases.mjs --test tests/*.test.ts   # host
ℹ tests 324  ℹ pass 324  ℹ fail 0
$ node --import ./tests/register-resolver.mjs --test tests/*.test.ts # shared
ℹ tests 108  ℹ pass 108  ℹ fail 0

$ node scripts/check-frontend-component-size.mjs → [PASS] 0 违规（client.ts 506 → 506，守棘轮基线）
$ node scripts/check-contract-mappers.mjs        → [PASS] 0 contract violations
$ node scripts/check-frontend-dupes.mjs          → [PASS] 0 violations
$ node scripts/check-theme-parity.mjs            → [PASS] All declared domain skins satisfy required capabilities
```

新增负例（卡面"每个被改断言至少一个 malformed/错误响应负例"）：

- `shared/tests/api-client-boundaries.test.ts`（6）：200 非 JSON / 空 body → reject（不静默成空/成功）；500 非 JSON → reject 且 `code=HTTP_500, retryable=true`；502 后端错误体 → 透传 `error_code/message`；204 → undefined。
- `host/tests/theme-registry-entry.test.ts`（4）：全局缺失 / `null` / 对象缺 `manifest` → reject（`/missing after load/`）；合法 entry → resolve。
- `shared/tests/viewmodels.test.ts`（+1）：malformed/空 `technical`（`{}` / `''` / `[]`）→ 需兜底，不得被当作已有技术信息。

未执行：`pnpm verify` / vite build / e2e —— 本机 4 核被 `fmby-queue` 拒（重活），交农场 `check/build`。
tsc/test 用兄弟 worktree 的 node_modules（gitignore，验证后已移除，工作区干净）。

## 5. 豁免登记（确有边界理由，本卡 scope 外）

| 位置 | 为何安全 | 触发再评估 |
|---|---|---|
| `themes/darkroom/src/index.ts:19` `manifestRaw as unknown as ThemeManifest` | `theme.manifest.json` 仓内受版本控制单一事实源；宿主 `ThemeProvider.activateTheme` 经 `isValidThemeManifest @ shared/src/theme/index.ts:226` + `preload!==false` 运行时校验后才生效。改用 shared 运行时校验器会引入 `@fmby/v2-shared` 值 import，而主题 vite 将 shared external 为 `window.FmbyShared`（宿主未预绑定）→ 主题产物运行时崩溃 | 宿主扩展主题 shared 桥后 |
| `themes/_template/src/index.ts:31` 同上 | 第三方样板与 darkroom 同源，保持可复制性一致 | 同上 |

> 旁证：旧中断 worktree `/home/tefuir/rustproject/ws-zcode-writer1-fe-strict-types` 残留一套 `scripts/check-frontend-strict-types.mjs` + `fe-strict-types-baseline.json` 棘轮（含 `as any`/`@ts-ignore` token），本卡未搬运（scope 限 host/shared TS/TSX + 测试）。若要仓级棘轮，需另开独立卡并写进 `pnpm verify`。

## 6. 提交与工作区

```
$ git log --oneline -1
c3bdf6c fix(strict-types): 收口 host/shared 生产 as unknown as + 标注 client 泛型信任点（FE-STRICT-TYPES）
$ git status --short
（空）
```

尾注 `Reviewed-by: pending-non-author-review`（不代表主代理已评审）。
