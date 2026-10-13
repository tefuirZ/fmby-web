# fe02 · #640 安装向导前端（半边）· handoff

分支 `feat/640-install-wizard-fe`　席位 fe02　生成 2026-10-14

## 一、提交序列（每原子项一 commit）

| # | commit | 内容 | 测试 |
|---|--------|------|------|
| C1 | `50e28cb` | `pgConnection.ts` PG 连接纯函数（拆分表单→URL、必填门控、五类失败归类） | 9 例真跑 |
| C2 | `7b8d8e7` | `installWizard.ts` 三页步骤门控纯函数 | 10 例真跑 |
| C3 | `fd8cef9` | 三页接线：`DatabaseCacheFieldset`（① PG 拆分表单 + 连接测试五类原因）、`ServerConfigSummary`（②）、`InstallPage` 重排 | 32 例（含源码契约） |
| C4 | `c337c3c` | `InstallProgressScreen` 动态配置 Loading 过渡页 | 7 例 |
| C5 | `b104acf` | `installStatus.ts` 安装面拒访（404/401/403）专属提示 | 6 例 |

## 二、RED → GREEN 原文（当次实跑，非回忆）

```
# C1 RED
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../install/pgConnection.ts'
✖ tests/install-pg-connection.test.ts  → pass 0 / fail 1
# C1 GREEN
ℹ tests 9  ℹ pass 9  ℹ fail 0

# C2 RED
✖ tests/install-wizard-steps.test.ts → pass 0 / fail 1（installWizard.ts 不存在）
# C2 GREEN
ℹ tests 10 ℹ pass 10 ℹ fail 0

# C3 RED
[Error: ENOENT: no such file or directory, open '.../DatabaseCacheFieldset.tsx']
SyntaxError: The requested module '../src/pages/install/pgConnection.ts'
  does not provide an export named 'probeFailureText'
# C3 GREEN
tests/install-pg-form|wizard-steps|pg-connection → ℹ tests 32 ℹ pass 32 ℹ fail 0
install 全套 → ℹ tests 61 ℹ pass 61 ℹ fail 0

# C4 RED
✖ ①②③④⑤⑥（6 挂 / 1 过）→ InstallProgressScreen.tsx 不存在
  注：⑦ 首版锚点被 anyPending 行误命中而「假绿」，已收紧为 if (...) { return ... } 形状
# C4 GREEN
tests/install-progress.test.ts → ℹ tests 7 ℹ pass 7 ℹ fail 0；install 全套 68/68

# C5 RED
✖ tests/install-status.test.ts（ENOENT）；接线断言 ⑥ 在实现后仍挂（写了不接=死代码）
# C5 GREEN
ℹ tests 6 ℹ pass 6 ℹ fail 0；install 全套 ℹ tests 74 ℹ pass 74 ℹ fail 0
```

## 三、当次验证原文

```
cmd: node --import ./tests/register-aliases.mjs --test tests/install-*.test.ts
ℹ tests 74 ℹ pass 74 ℹ fail 0

cmd: npx tsc -p tsconfig.app.json --noEmit --tsBuildInfoFile /tmp/fe02-ti.json
TSC_EXIT=0

cmd: node --import ./tests/register-aliases.mjs --test tests/*.test.ts   （全量宿主，见 fe02-640-fullhost.log）
ℹ tests 609 ℹ pass 609 ℹ fail 0
EXIT=0

门禁：check-css-module-usage [PASS] 0 未定义类引用
      check-contract-mappers  [PASS] 0 contract violations
      check-frontend-dupes    [PASS] 0 violations
      check-frontend-component-size：install 目录 355/251/69/87/140/46/59 行
        （InstallPage / DatabaseCacheFieldset / ServerConfigSummary / installWizard /
         pgConnection / installStatus / InstallProgressScreen），全部 < 400
        （该脚本另有 3 个 manage/* 存量 FAIL：MountTable 408 / MediaItemArtworkSection 405 /
         ManageRuntimeLogsPage 401，本会话未触碰这些文件，非本次引入）
```

## 四、ponytail 段：跳过了什么 / 何时再加

- **② 服务器配置页做成只读生效值摘要，不做表单**。V2 `InstallApplyRequest` 只有
  `database / cache / admin`，没有任何服务器字段 ⇒ 造输入框只能骗用户（填了也没通道写）。
  何时再加：后端在 apply 里开出 server 段（监听地址/站点名等）之后，本页换表单，
  门控仍走 `installWizard.stepProblem`。
- **不做百分比/分步进度条**。apply 是单请求、后端无分步回执，任何百分比都是编的。
  何时再加：后端出 SSE 或轮询进度端点。
- **不做可点的步骤页签**（跳页要判「哪些页可达」= 一堆无测分支）。只留 上一步/下一步，
  与卡片「三页」等价且更小。何时再加：确有「自由跳页」需求并接受相应测试成本。
- **五类失败原因靠 message 关键词归类**（`DatabaseProbeResponse` 只有 `message`，无 code）。
  认不出 ⇒ `unknown` 且**原样显示后端 message**，不编造。
  何时再加：后端补 `code` 字段后直接读 code，删 `FAILURE_PATTERNS` 关键词表。
- **缓存只给「内置（内存+文件）/ Redis」两档**，没有把「内存」「文件」拆成两个可选项：
  契约 `InstallCacheChoice.kind` 只有 `builtin | redis`，拆开即造假选项。
  何时再加：后端支持独立选择时。
- 未新增任何依赖、未新增 CSS（复用 `Loader2` + `LoginPage.module.css` 既有类）。

## 五、codegraph 查证记录（找符号只用 codegraph）

- `codegraph explore install wizard` → `InstallPage:74` / `InstallCompletionPanel:34` /
  `readInstallState:46` 均 **⚠️ no covering tests**（现状登记，honesty 测试是源码契约非行为测试）
- `codegraph query CacheKind` → 仅 `InstallPage.tsx:72` 本地 type_alias，契约层无此符号
- `codegraph query probe_database` → 契约侧只有 `InstallRedisProbeRequest`；
  **`crates/` 不在本仓**（本席是纯前端仓），`install_flow.rs` 无法实读 ⇒ G1 后端契约未知项
  只能按前端尽力处理（见第四节第 4 条）
- `codegraph explore api error status code class` → `ApiError{code,message,retryable}`
  (`shared/src/errors/error.ts:6`)、`mapResponseToApiError → withHttpMetadata` 附 `status`
  ⇒ 据此判定 `installStatus.ts` 只读 `code/status` 两字段
- `codegraph query Stepper` → 无结果 ⇒ 仓内无既有步进组件可复用，故不造页签（ponytail）

## 六、遗留 / 要卡

1. **`pnpm build` 在本席被环境阻塞**：`vite` 在 `resolveConfig → loadConfigFromFile →
   loadConfigFromBundledFile` 写 `host/node_modules/.vite-temp/*.mjs` 报 EACCES（两次复现）。
   同一进程内手工 `node -e fs.promises.writeFile` 到**同一路径**成功，目录可写、无 ACL、无 immutable。
   ★失败发生在读取任何源码之前 ⇒ 与 #640 改动无关，但**产物构建未经独立见证**。
   需在农场 node62 或权限正常的宿主跑一次 `pnpm build` 补见证。
2. **honesty 测试被本会话改写**（`install-wizard-honesty.test.ts` ②③⑪）：内容搬到子组件后
   原断言读 `InstallPage` 单文件必然红。②③ 改为看拼接整体；⑪ **实质加严**（`allDone`
   必须「每页都 stepDone」且管理员页仍走 `confirmPasswordProblem`）。
   ⇒ 请 fe01/rv01 复核这处改写是否可接受。
3. **真实浏览器实证缺失**：本仓无 jsdom/testing-library，③④⑤ 是源码接线断言；
   判定本体（1+2 节的纯函数）是真跑。逐交互实证属 e2e 后续工作。
4. 未推远端、未开 PR（无 upstream，`gh pr list` 该 head 为空）——等指示。
5. fe02.md 的 a11y 段仍挂 4 个 declared 阻塞项（rv01 复评 / treegrid 裁决 /
   17 提交入 main / 17 张表实证用例），非本会话可自主推进。
