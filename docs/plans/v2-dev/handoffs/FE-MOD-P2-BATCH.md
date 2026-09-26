# FE-MOD-P2-BATCH —— 四项 P2 结构债（第 0 步：只读侦察）

- 分支：`w/zcode/fe-p2-batch`（自该仓 `main`@`1cfab4b` 开）
- 基线：`pnpm typecheck` rc=0、`pnpm build` rc=0、`pnpm -r test` rc=0（320+ passed）
- 方法：只读扫描（`find` / node / python；不用 grep 找符号 —— 但本仓是 TS 仓、无 codegraph 索引，故用 python 做 AST-无关的 import 解析，仅侦察用途）。

---

## ① FE-API-AS-T —— `as T` 边界类型擦除

| 事实 | 位置/依据 |
|---|---|
| 目标断言行 | `shared/src/api/client.ts:387` `return (await response.json()) as T;` |
| 同类断言 2 处 | `client.ts:386`（204 ⇒ `undefined as T`）、`client.ts:394`（错误拦截器恢复 ⇒ `recovered as T`） |
| 校验槽位 | `RequestConfig`（`client.ts:90-110`）**无**任何运行时不变量/parse 钩子 |
| 既有工具 | `zod ^3.25.20` 已是 `shared` 的 **peerDependency**（`shared/package.json`），并在 `shared/src/contracts/**` 大量使用 |
| 调用形态 | `httpClient.get<T>/post<T>/…`（`client.ts:454-474`）⇒ `request<T>` ⇒ `executeOnce<T>` |
| 测试 | 无 `client*.test.ts`；`shared/tests/*` 用 `node --test` + 自建 resolver |

- 纯/杂：client 是**杂**（fetch / cookie / 拦截器单例），但 387 行本身是纯边界。
- 能不能做：**能**。最小改 = 在 `RequestConfig` 加**可选** `parse?: (raw: unknown) => unknown` 校验槽，`executeOnce` 在 `response.json()` 后经它产出 T；未提供时退化为历史 `as T`（零行为变更）。补一条 `node --test` 用例证明「提供校验时坏载荷抛错、不静默 cast」。
- 风险：低。不动默认路径；`parse` 需从 `restConfig` 解构剔除，避免漏进 `fetch` init。

## ② FE-BARREL-CYCLE —— barrel 循环

| 事实 | 数值 |
|---|---|
| `index.ts` 总数（host/src+shared/src+themes，排除 node_modules/dist） | **85** |
| `export *` 行数 | **54** |
| 真实循环（DFS 全量 import graph） | **2 条** |

两条真实循环（file:line）：

1. **theme barrel 循环**：`shared/src/theme/index.ts:11` `import type { ThemeCapabilitiesDeclaration } from './capabilities'` + `:13` `export * from './capabilities'` ⟷ `shared/src/theme/capabilities.ts:19` `import type { PageDomain } from './index'`。
   （纯 type-only，运行期被抹除，故 build 不炸；但结构上是环。）
2. **naming-rules 组件 barrel 自环**：`host/src/pages/manage/naming-rules/components/index.ts:9` 导出 `NamingRulesCleanupPanel`，而 `NamingRulesCleanupPanel.tsx:9` 又从 `'.'`（同 barrel）导入 3 个兄弟组件 ⇒ barrel ↔ 成员。

既有工具链：`scripts/check-frontend-dupes.mjs`、`check-contract-mappers.mjs`（fs walk + 正则，无图分析）；`typescript` 是 devDependency（可用 `ts.preProcessFile`）。**无**现成循环检测。

- 能不能做：**能**。加 `scripts/check-frontend-cycles.mjs`（零新依赖，复用 `typescript` AST 抽 import），接入 `pnpm verify`；并修掉上述 2 条既有环使其零基线绿（② 改直连导入；① 把 `PageDomain` 下沉到叶子模块）。
- 风险：中。① 涉及 `shared/src/theme` 公共 re-export 面，须保持 `@fmby/v2-shared/theme` 导出不变（typecheck 兜底）。

## ③ FE-THEME-TYPE-ERASURE —— 主题契约类型擦除

| 事实 | 位置 |
|---|---|
| `data: unknown` | `shared/src/theme/index.ts:75` |
| `SkinActions = Record<string, (...args: never[]) => void> & { openItem?; itemHref? }` | `shared/src/theme/index.ts:101` |
| 消费方 | themes 各自定义**本地**最小形状并 `data as X`：`themes/darkroom/src/skins/ItemSkin.ts:41-46`、`LibrarySkin.ts:36-41`（`_template` 同型） |
| host 侧桥 | `host/src/theme/skins/loaders.ts:21-30`（`data: SkinProps['data']`）、`:51` `Pick<SkinActions,'openItem'|'itemHref'>`；`DomainSkinOutlet.ts:50/57/86/91` |
| 主题实际取用的 action 键 | `openItem` / `itemHref` / `retry` / `loadMore` / `refresh` |
| 硬约束 | themes **禁止** import host/viewmodel/contracts 类型（`check-frontend-dupes.mjs` 主题纯度闸）⇒ `data` 无法收紧成具体 viewmodel 类型（会把主题与 host 类型耦合） |

- 能不能做：**部分能**。`SkinActions` 的开放 `Record<string,…>` 索引签名可收紧为**显式可选语义键**（openItem/itemHref/retry/loadMore/refresh，全可选 ⇒ theme 的 `?.`/`typeof` 守卫语义不变，零运行期变化）；`data: unknown` 属**有意解耦**，收紧会破坏主题纯度红线，计划仅在注释里据实登记「为何不收」。
- 风险：中低。需核对 host 侧 viewmodel 注入的全部 action 键都在显式表内（否则 typecheck 红即暴露）。

## ④ FE-MOUNT-AGGREGATE —— mounts/formUtils 聚合根

| 事实 | 数值 |
|---|---|
| 文件 | `host/src/pages/manage/mounts/formUtils.ts` = **870 行** |
| 顶层导出 | **46** 个 `export function`/`const`（纯函数为主：`build*`/`validate*`/`normalize*`/`get*`/`is*`） |
| 调用点 | 仓内 **21** 个 mounts 组件/hook + `ManageMountsPage.tsx` + `host/tests/mount-datasource-backfill.test.ts` |
| 现状 | 无类/聚合根；全部是自由函数 + `types.ts` 类型 |

- 能不能做：**不做（低收益/高风险，卡面允许）**。理由：46 个纯函数被 22 个调用点以「函数级」方式依赖；把它们收进一个 Mount 聚合根/类属于**大范围行为风险重构**，对 P2 结构债 ROI 低，且违反「每项最小改动 + 零行为变化」的硬约束。依据：本卡硬约束为 `typecheck`/`build` rc=0，聚合根改造的收益（内聚）不足以覆盖回归面。
- 风险：若强行做，22 个调用点全部需要同步改写，回归面大。

---

## 执行顺序（第 1..4 步，每项一 commit）

1. `FE-API-AS-T`（最小 seam + 测试）
2. `FE-BARREL-CYCLE`（加检测 + 修 2 条既有环）
3. `FE-THEME-TYPE-ERASURE`（收紧 `SkinActions`；`data` 留注释依据）
4. `FE-MOUNT-AGGREGATE`（**不做**，本文件已给依据）

---

# 执行记录

## ① FE-API-AS-T —— 已做（commit 2）

- 改动：`shared/src/api/client.ts`
  - `RequestConfig` 增**可选** `parse?: (raw: unknown) => unknown`（运行时不变量校验槽）；
  - `executeOnce` 解构出 `parse`（不泄漏进 `fetch` init），响应体路径改为 `(parse ? parse(raw) : raw) as T`；`204` 与错误恢复路径不经过钩子（保持原语义）。
- 新增测试：`shared/tests/api-response-parse.test.ts`（3 例：① parse 产出 T；② 坏载荷 reject；③ 无 parse 历史行为不变）。
- TDD 原文：
  - RED：`node --import ./tests/register-resolver.mjs --test tests/api-response-parse.test.ts` ⇒ `RED_RC=1`（① parse 被忽略、② 未 reject）。
  - GREEN：同命令 ⇒ `pass 3 / fail 0`，`GREEN_RC=0`。
- 为何不改变行为：`parse` 未提供时 `raw as T` 与历史逐字等价；新增字段仅在调用方显式传入时生效；已从 `restConfig` 剔除避免传给 `fetch`。
- 回归：`pnpm typecheck` rc=0、`pnpm build` rc=0、`pnpm -r test` rc=0。

## ② FE-BARREL-CYCLE —— 已做（commit 3）

- 新增门禁：`scripts/check-frontend-cycles.mjs`（零新依赖；fs walk + 正则抽模块说明符 + **注释剔除**（逐字符状态机，避免 JSDoc `@example` 假自环）+ DFS 三色找环；解析 `./`、`@/`、`@fmby/v2-shared`、`@fmby/v2-shared/*`）；带 `--selftest`。
- 接入：`package.json` 新增 `cycles` 脚本，并插入 `verify` 链。
- 修掉 4 条真环（2 根因）：
  1. **contracts/browse 子模块引父 barrel**（7 行）：`{item,person,history}/{api,types}.ts` 的 `MediaCardSummary`/`MediaProgressSummary` 改 `'../types'`、`mapMediaCard` 改 `'../api'`（不再经父 barrel `@fmby/v2-shared/contracts/browse` 绕回）。
  2. **theme barrel 环**：`PageDomain` 下沉到新叶子 `shared/src/theme/pageDomain.ts`；`index.ts` `export type { PageDomain }` 仍 re-export（对外导出面不变），`capabilities.ts` 改引 `./pageDomain`。
  3. **naming-rules 组件 barrel 自环**：`NamingRulesCleanupPanel.tsx` 的 `from '.'` 改 3 条直连 `./NamingRules*Section` 导入。
- 剔除了 2 条**假阳性**（`query/keys.ts:8`、`forms/useZodForm.ts:7` 均为 JSDoc `@example` 注释里的 `import`，非真依赖）——由 `stripComments` 处理。
- 为何不改变行为：改动均为**导入路径重定向到同一模块**（父 barrel 与 `../types`/`../api` 指向同一文件；`PageDomain` 类型 re-export 面不变）；纯类型/模块图变更，无运行期逻辑。
- TDD 原文：
  - RED：`node scripts/check-frontend-cycles.mjs` ⇒ `FAIL…4 条模块循环依赖`，`GATE_RC=1`。
  - GREEN：同命令 ⇒ `PASS(frontend-cycles)：638 个源文件依赖图无环`，`GATE_RC=0`。
  - 自测：`node scripts/check-frontend-cycles.mjs --selftest` ⇒ `SELFTEST PASSED`（相对环必检出 / 无环不误报 / `@/` 环必检出 / 跨包别名可解析），rc=0。
- 回归：`pnpm typecheck` rc=0、`pnpm build` rc=0、`pnpm -r test` rc=0（shared 104 / host 320 / themes 28）、`pnpm dupes` rc=0、`pnpm contracts` rc=0。

## ③ FE-THEME-TYPE-ERASURE —— 部分做（commit 4）

- `SkinActions`（`shared/src/theme/index.ts`）：由开放索引签名
  `Record<string, (...args: never[]) => void> & { openItem?; itemHref? }` 收紧为
  **显式可选接口** `{ openItem?; itemHref?; refresh?; retry?; loadMore? }`
  （键与签名照 host viewmodel 真实动作面；均有文档）。
- `data: unknown`：**有意保留**，补注释登记依据（主题禁止 import host/viewmodel
  类型，收紧会破坏 L3 解耦；主题在自持最小形状上做运行时守卫是契约指定消费方式）。
- **收紧真的咬住了一处隐患**：改后 typecheck 红
  `themes/darkroom/src/skins/LibrarySkin.ts(249,7) error TS2769: Type '(() => void) | undefined' is not assignable to type '() => void'`
  ——旧索引签名把 `actions.loadMore` 的 `undefined` 藏了；已将 `FloatingActionBar.onLoadMore`
  改为可选（`onLoadMore?: () => void`，纯类型面；该按钮本就由 `canLoadMore` 守卫，运行期零变化）。修后 typecheck rc=0。
- 为何不改变行为：仅类型面收紧；5 个键全可选 ⇒ 主题 `?.`/`typeof` 守卫语义不变；
  host 注入的键（loaders.ts `{...navigation, refresh, loadMore}` / `{...navigation, retry, refresh}`）
  本就全在上述 5 键内；主题实际取用也仅这 5 键（扫描确认）。
- 回归：`pnpm typecheck` rc=0、`pnpm build` rc=0、`pnpm -r test` rc=0。
