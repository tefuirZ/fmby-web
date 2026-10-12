# 真实 E2E 所需外部输入清单

> 范围：`host/e2e/*.spec.ts`（18 个 spec 文件 / 79 处顶层 `test(` 声明；`a11y.spec.ts` 与
> `a11y-report.spec.ts` 各含一个页面清单循环，按清单展开后运行块更多）与 `pnpm e2e-gate` 的真实栈链路。
> 目的：在**补齐全部输入后**，`pnpm e2e` 必须能跑出真绿，而不是靠整组 `SKIP` 假绿。
>
> 归因纪律：每一条“外部输入”都必须在仓内找到**真实读取点**（前端 spec / 启动器 / 后端配置装配）。
> 只有页面里出现关键词、或后端存在某个字段，**不等于**真实 E2E 消费它。
> 仓内无读取点的条目一律标记“仓内无前端 E2E 引用”，不得伪装成必填输入。

---

## 0. 总览：真正阻塞 10/20 完整 E2E 的输入

| # | 输入 | 是否必填 | 缺失表现 | 归因 |
|---|---|---|---|---|
| 1 | `fmby-v2-server` / `fmby-e2e-seed` 二进制 | **必填** | 全组 `test.skip(!E2E_ENABLED)` → 80 个测试块全 skip | `host/e2e/fixtures/helpers.ts`、`host/e2e/binaryResolver.mjs` |
| 2 | Playwright Chromium 浏览器 | **必填** | `check-e2e.mjs` 判基建缺件 → `exit 3` | `scripts/check-e2e.mjs:114-128` |
| 3 | `host/dist` 构建产物（且不比源码旧） | **必填** | 产物缺失 → `start.mjs` 自动 build；产物**比源码旧** → 门禁 `exit 3` | `host/e2e/start.mjs:197`、`scripts/check-e2e.mjs:136-152` |
| 4 | `themes/*/dist` 主题构建产物 | **必填** | 全部缺失 → `start.mjs` 自动 `pnpm build:themes`；build 失败 → 启动失败 | `host/e2e/start.mjs:113-163` |
| 5 | seed 固定账号 `admin/admin` | **自动**（无需提供） | — | `host/e2e/fixtures/helpers.ts` `login()`；后端 `seed_initial_admin` |
| 6 | 媒体样本 | **自动**（无需提供） | — | 后端 `e2e_seed.rs` 从嵌入资产生成 |
| 7 | `FMBY_E2E_MFA_CODE` | 条件性（当前默认不需要） | `test.skip` 二因子正腿 | `host/e2e/mfa-capabilities.spec.ts:38-39` |
| 8 | 审计证据输出目录 `EVIDENCE_DIR` | 可选 | 默认写 `docs/evidence/fe-opt-02/full/` | `host/e2e/mobile-audit.spec.ts:26-31` |
| 9 | 环境隔离（`FMBY_SECRETS_FILE` / `FMBY_DATABASE_KIND`） | **必做防护**，非“提供凭据” | 外层环境变量被 `start.mjs` 原样继承，可能污染真实栈 | `host/e2e/start.mjs` `env: process.env` |
| 10 | License 服务地址 / TMDB Key / PostgreSQL 连接串 / 外部 Cookie | **不是前端 E2E 输入** | — | 见第 6 节，逐条给证据 |

**结论先说**：完整真实 E2E **不需要用户提供的业务凭据**。真正要补的是 ①②③④ 四条**基础设施**
＋第 9 条**环境隔离**。任何“10/20 跑不全是因为缺 TMDB Key / License 地址 / PG 实例”的说法，
在当前源码里都找不到读取点。

---

## 1. 服务端 / seed 二进制（必填）

### 1.1 用途
真实 E2E 禁 mock：启动真实 `fmby-v2-server` + 真实 SQLite（seed 造三库、挂载、媒体、用户）。
没有二进制就没有被测对象。

### 1.2 读取位置
- 唯一真源：`host/e2e/binaryResolver.mjs`（`resolveServerBinary` / `resolveSeedBinary` / `describeSearchPaths`）。
- 消费方四处同源：`host/e2e/fixtures/helpers.ts`、`host/e2e/start.mjs`、
  `host/playwright.config.ts`、`scripts/check-e2e.mjs`。
- 门禁判定：`host/e2e/fixtures/helpers.ts` 中
  `E2E_ENABLED = resolveServerBinary() !== null`。

### 1.3 解析优先级（真实实现，按序）
1. `FMBY_E2E_SERVER_BIN` / `FMBY_E2E_SEED_BIN`（显式绝对路径覆盖）
2. `FMBY_E2E_TARGET_DIR`
3. `CARGO_TARGET_DIR`
4. `FMBY_CARGO_TARGET_DIR`
5. `/data/fmby-build/local-target`
6. `/data/fmby-target/*` —— **默认不扫描**；需显式 `FMBY_E2E_SCAN_BRANCH_TARGETS=1` 开启
   （`binaryResolver.mjs:57-58`；默认不扫的注释理由：避免逐个 profile 探测导致诊断输出过长）
7. 前端仓历史 `target`
8. 主仓 `target`（`FMBY_E2E_MAIN_REPO` 覆盖根目录）

> 注意：本机强制 `CARGO_TARGET_DIR` 的布局下，`<前端仓>/target` 永远不存在。
> 只在前端仓内找 target 是历史口径，`playwright.config.ts` 注释已明确记为阻断项 ①。

### 1.4 缺失时行为（不假绿）
- `resolveServerBinary()` 返回 `null` ⇒ `E2E_ENABLED=false` ⇒ 每个 spec 顶部
  `test.skip(!E2E_ENABLED, E2E_SKIP_REASON)` 生效，**整组 skip 而非失败**。
  `host/e2e/start.mjs:77-88` 同样在缺二进制时走 `skip()` 分支 `process.exit(0)`。
- `scripts/check-e2e.mjs`：缺二进制时逐个列出未跑 spec 与估算用例数，
  默认 `exit 0`（并打印 `[PASS] … 但已显式登记 SKIP 数`），
  **设 `FMBY_E2E_REQUIRED=1` 时 `exit 3`**（基建缺件）。
- 退出码契约：`0` 通过 / `1` 产品失败 / `3` 基建缺件。

- **seed 失败**（另一条容易误判为输入缺失的红）：`host/e2e/start.mjs:92-104`，
  seed 以 `[dbPath, dataDir]` 启动，退出码非 0 ⇒ 打印 `explicit E2E seed failed`、
  清理临时目录、`exit 1`。此时**不是产品缺陷也不是浏览器验证失败**，而是后端装配未成；
  若外层误设 `FMBY_DATABASE_KIND=postgres`（见 7.2）就会命中这条。

### 1.5 能否显式 SKIP
能，且**设计如此**。但 `SKIP` 只在无二进制时合法；CI 要求真跑时必须设
`FMBY_E2E_REQUIRED=1`，否则“全 skip”会被记为 `exit 0`。

### 1.6 获取步骤
```bash
# 方式 A：用本机真实 target 目录（已存在，无需重建）
export FMBY_E2E_TARGET_DIR=/data/fmby-build/local-target
# 或直接指定二进制
export FMBY_E2E_SERVER_BIN=/data/fmby-build/local-target/debug/fmby-v2-server
export FMBY_E2E_SEED_BIN=/data/fmby-build/local-target/debug/fmby-e2e-seed

# 方式 B：从 Rust 主仓现场构建
cd /home/tefuir/rustproject/FMBY-V2
cargo build -p fmby-v2-server --bin fmby-v2-server --bin fmby-e2e-seed
```
`release` profile 注意：`/data/fmby-build/local-target/release/` 当前不存在；
release 版 seed 走默认管理员时需显式 `FMBY_ALLOW_DEFAULT_ADMIN_SEED=1`（debug 版不需要）。

### 1.7 存放位置
构建产物落在 `$CARGO_TARGET_DIR/{debug,release}/`（本机为 `/data/fmby-build/local-target/debug/`）。
**不入仓**。

### 1.8 注入方式
环境变量（`FMBY_E2E_SERVER_BIN` / `FMBY_E2E_SEED_BIN` / `FMBY_E2E_TARGET_DIR` / `CARGO_TARGET_DIR`）。
`scripts/check-e2e.mjs` 解析后会把两个绝对路径回写进子进程 env 传给 Playwright。

### 1.9 安全边界
二进制不入仓；`describeSearchPaths()` 打印的只是路径列表，不含凭据。

---

## 2. Playwright 浏览器（必填）

### 2.1 用途
真实浏览器执行 a11y、播放、主题、移动端等断言。

### 2.2 读取位置
`scripts/check-e2e.mjs:114-128`：
```js
const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(homedir(), '.cache', 'ms-playwright');
```
另 `check-e2e.mjs` 校验 `host/node_modules/.bin/playwright` 存在。

### 2.3 默认/缺失行为
- 未设 `PLAYWRIGHT_BROWSERS_PATH` ⇒ 回退 `${homedir()}/.cache/ms-playwright`。
- 浏览器缺失 ⇒ **基建缺件 `exit 3`**，明确“不冒充产品缺陷”。

### 2.4 能否显式 SKIP
不能也不应。浏览器缺失是基建问题，门禁直接 `exit 3`；不可用 skip 掩盖。
（另有 `host/tests/*.test.ts` 里因 Chromium 不可用而 `t.skip(...)` 的**单测**用例，
那是 node:test 层，与 E2E 门禁分开。）

### 2.5 获取步骤
```bash
cd host && npx playwright install chromium
# 装到自定义位置时：
PLAYWRIGHT_BROWSERS_PATH=/data/pw-browsers npx playwright install chromium
```

### 2.6 存放位置
默认 `~/.cache/ms-playwright/`；或 `PLAYWRIGHT_BROWSERS_PATH` 指定目录。不入仓。

### 2.7 注入方式
环境变量 `PLAYWRIGHT_BROWSERS_PATH`。

### 2.8 备注
`host/playwright.config.ts` 定义两个 project：
- `chromium`（Desktop Chrome）—— 零回归对照；
- `mobile-chrome`（Pixel 5，`hasTouch` + `isMobile`）—— 让
  `@media (hover:none) and (pointer:coarse)` 下的 `--touch-min: 44px` 规则真正生效。
  `mobile-audit.spec.ts:154-157` 对触屏断言做项目分流：非 `mobile-chrome` 时显式
  `test.skip` 并写明“pointer 非 coarse”，**不假装通过，也不留红**。

---

## 3. 前端构建产物 `host/dist`（必填，且必须新鲜）

### 3.1 用途
E2E 默认服务**已构建产物**（对齐卡面真实栈口径）。用 dev server 会触发 React StrictMode
双调用，暴露 `VideoPlayer` 异步挂载竞态（实测 dev 下播放页 `<video>` 不挂载）。

### 3.2 读取位置
- `host/e2e/start.mjs:197`：产物不存在 → 打印「host/dist 缺失，先执行 vite build …」并自动 build，
  build 失败或产物仍缺失 ⇒ 启动失败。
- `host/playwright.config.ts`：`webServer.command` 默认 `node e2e/start.mjs`；
  仅当 `FMBY_E2E_REBUILD=1` 时才 `pnpm build && node e2e/start.mjs`。
- `scripts/check-e2e.mjs:136-152`：**产物新鲜度机械判定**——
  若 `host/dist/index.html` 的 mtime 早于最新源码 ⇒ 判红并 `exit 3`
  （“陈旧产物下的 e2e 结果不可信，故此处一律置 exit 3、不继续跑”）。

### 3.3 默认/缺失行为
- 缺失 ⇒ 自动构建（首次较慢）。
- 存在但比源码旧 ⇒ 门禁 `exit 3`，不继续跑。

### 3.4 能否显式 SKIP
不能。旧产物会被门禁直接挡住；这是刻意的“验证对象必须是当前源码”纪律。

### 3.5 获取步骤
```bash
cd host && pnpm build            # 或设 FMBY_E2E_REBUILD=1 让 webServer 强制先建
```
> 本机 `fmby-queue` 会把 `pnpm build` 判为重活（实测 exit 3 / 180s 超时），
> 故 `playwright.config.ts` 已把 build 从 `webServer.command` 移出，改由 `start.mjs` 的
> child_process 执行，避开 pnpm 脚本层。

### 3.6 存放位置
`host/dist/`（`.gitignore` 覆盖 Playwright 产物 `test-results/`、`playwright-report/`、`blob-report/`）。

### 3.7 注入方式
无需注入；由构建 + `FMBY_E2E_REBUILD` 控制是否强制重建。

---

## 4. 主题构建产物 `themes/*/dist`（必填）

### 4.1 用途
THEME-BUILD-01 起主题改为运行时外挂：host registry 从 `/themes/<id>/*` 拉取，
后端静态面映射 `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`。
`start.mjs` 负责把仓内 `themes/<dir>/dist/**` 组装到临时数据目录。

### 4.2 读取位置
`host/e2e/start.mjs:114-144`（`assembleThemes()`）：
- 只收录存在 `themes/<dir>/dist/index.js` 的主题（`index.js` 是硬门槛）；
- 运行时 id 取 `dist/theme.manifest.json` 的 `id`，manifest 缺失/不可解析时回退目录名；
- 复制到 `${workDir}/data/themes/<runtimeId>/dist/`；
- 一个都没收录到（`assembled === 0`）⇒ 打印「themes/*/dist 缺失，先执行 pnpm build:themes …」
  并自动构建；构建失败 ⇒ 清理临时目录并 `exit 1`（`start.mjs:146-165`）。

### 4.3 当前实际状态（本席已核对 `find` 输出）
| 主题 | 仓内名 → 运行时 id | `dist/index.js` | `dist/tokens.css` | `dist/theme.manifest.json` | `dist/skins/` |
|---|---|---|---|---|---|
| `themes/darkroom` | `darkroom` → `darkroom` | ✅ | ✅ | ✅ | ✅（`item.css`、`library.css`） |
| `themes/_template` | `_template` → **`template`** | ✅ | ✅ | ✅（`id=template`） | ✅（`item.css`） |

`themes/darkroom/dist` 另有 `aurora.css`（模板主题无此文件，`theme-template-skin.spec.ts` 也未要求它）。

`host/e2e/theme-template-skin.spec.ts:34-40` 明确要求以下路径 200 且 content-type 正确：
```
/themes/template/theme.manifest.json  application/json
/themes/template/index.js            javascript
/themes/template/tokens.css           css
/themes/template/skins/item.css       css
```
⇒ `tokens.css` 是运行时必需文件。**当前两个主题的必需文件均齐备**。

⚠️ 但 `dist/` 被 `.gitignore:2 dist/` 覆盖（`git check-ignore` 已确认）⇒ **这是本地构建产物，
不是仓内可依赖的文件**。换一台干净机器 / CI runner 上必然缺失 ⇒ 必须先跑 `pnpm build:themes`。

### 4.4 能否显式 SKIP
- **主题 dist 整体缺失**：`start.mjs` 会自动构建，构建失败则启动失败（不 skip）。
- **单个主题某个必需文件缺失**（如 `tokens.css`）：`assembleThemes()` **不会**发现，
  该主题照样被组装进临时目录，主题 spec 在运行期拿到 404/SPA 回退 ⇒ 表现为**产品红**，不会被静默放过。

### 4.5 获取步骤
```bash
pnpm build:themes    # 顶层脚本，内部为 pnpm -r --filter './themes/*' build
```

### 4.6 存放位置
源码侧 `themes/<name>/dist/`；运行时组装到**启动器临时目录**
（`mkdtempSync(tmpdir()/fmby-e2e-real-*)` 下的 `data/themes/<id>/dist/`），退出时 `rmSync` 清理。

### 4.7 注入方式
无需注入；由构建产物 + 临时组装完成。

---

## 5. 账号 / 会话 / 媒体（均**不需要**用户提供）

### 5.1 固定测试账号 `admin/admin`
- **用途**：所有 spec 的登录入口。
- **读取位置**：`host/e2e/fixtures/helpers.ts` 的 `login(page)` 硬编码
  `/login` → 用户名 `admin` → 密码 `admin` → 点「登录」→ 等 URL 为 `/` → 等首个 heading。
- **来源**：真实 seed 阶段 `fmby-v2-server FMBY_E2E_SEED=1` → `seed_initial_admin(...)`
  （Rust `crates/fmby-v2-server/src/bin/fmby_e2e_seed.rs`）。
- **默认/缺失行为**：seed 每次运行建全新临时 SQLite（`mkdtempSync` 下的 `e2e.db`），
  账号总是存在；不存在则登录等待超时 ⇒ 测试红。
- **能否 SKIP**：否。这是所有正腿的前提。
- **存放位置**：临时 DB `${workDir}/e2e.db`，退出即删。
- **注入方式**：无需注入。
- **条件输入**：`release` profile 的默认管理员 seed 可能需 `FMBY_ALLOW_DEFAULT_ADMIN_SEED=1`。

### 5.2 Cookie / 会话
- **用途**：登录态保持。
- **读取位置**：**无** `storageState` / `addCookies` / 手工注入 Cookie 的代码。
  会话完全由浏览器端真实登录（`/api/auth/login` 401→200）建立；
  `batch-operations.spec.ts` 从 `document.cookie` 读 CSRF token 并发 `x-csrf-token` 头，
  但这是**读取运行时 Cookie**，不是外部输入。
- **默认/缺失行为**：每个 spec 自行登录；`resetBackend()` 在真实后端下是空实现。
- **能否 SKIP**：否。不存在“需要外部 Cookie / 已登录 storageState”的前置。
- **结论**：**不需要用户提供 Cookie、登录态或第三方会话票据。**

### 5.3 媒体样本
- **用途**：浏览 / 播放 / 详情页的真数据。
- **读取位置**：`host/e2e/playback.spec.ts` 走 `/play/101` → `POST /api/playback/sessions`
  （断言 `200`、`item_id === '101'`）→ 页面内
  `fetch(stream_url, { credentials: 'include' })` 断言 `200` 且字节数 `> 0`；
  暂停时 `/progress` 断言 `204`，导航离开时 session 停止。
- **来源（后端 seed，非外部输入）**：Rust `crates/fmby-v2-server/src/e2e_seed.rs`
  从嵌入资产 `../assets/e2e_valid.mp4` 的字节生成文件，写到
  `${FMBY_DATA_DIR}/e2e-media/`，至少含
  `interstellar.mp4`、`s01e01.mp4`、`s01e02.mp4`、`s01e03.mp4`。
  文件头注释明确“真实 HTTP + 真实 SQLite（非 mock），播放直接读真实本地文件”。
- **默认/缺失行为**：`FMBY_DATA_DIR` 由 `start.mjs` 设为临时目录；
  若媒体缺失，浏览可能通过但取流会失败。
- **能否 SKIP**：否，但**不需要用户提供**——seed 自动生成。
- **存放位置**：临时 `${workDir}/data/e2e-media/`。
- **结论**：`docs/evidence/**/samples/**` 是审计截图证据，**不是**播放媒体 fixture；
  前端仓内不存在媒体 fixture 目录。

---

## 6. 逐项否决：以下**不是**当前前端 E2E 的外部输入

以下是本任务点名要核查的项。每条都给出“为什么不成立”的仓内证据，避免把关键词命中
或后端字段误写成前端 E2E 输入。

### 6.1 License 服务端地址 —— 后端内置，前端零注入点
- 后端 `crates/fmby-v2-license/src/authority.rs:73-79`
  `built_in_license_authorities()` 返回两条内置 authority：
  主 `https://fmby.tefuir0829.cn`、备 `https://oauth.fmby.cn`（域名以混淆字节数组存储，
  解码掩码 `0x5a`；`authority.rs` 内的测试直接断言解码结果，且注明主=tefuir0829 存活、
  备=oauth 已无 DNS）。因此**地址由后端内置，无需用户提供**。
- 前端 `host/src` 中 `server_base_url` / `serverBaseUrl` 只命中
  `host/src/pages/manage/license/components/LicenseStatusOverview.tsx:88`，
  用途是**展示后端状态 DTO 里的地址**，不是配置项、不是浏览器请求目标、不是 E2E 注入点。
- `crates/fmby-v2-http/src/state/license.rs:208` 的 `LicenseStatusDto.server_base_url: String`
  是**响应字段**，只证明后端向前端暴露该值。
- E2E 侧：`host/e2e/manage-pages.spec.ts:115-116` 的 license 用例仅
  `expectPage(page, '/manage/site/license', /授权与订阅/)`，即页头真实渲染；
  未配置、未访问任何远端 License server。
- **结论**：License 地址 = backend-only 且已内置；**不列为前端 E2E 外部输入**。

### 6.2 TMDB API Key —— 后端 secret/config，非前端 E2E 输入
- 前端仓内 `tmdb` / `api_key` 关键词只出现在管理页实现与契约
  （`ManageMediaReviewsPage.tsx`、`ManageMediaReviews` components、
  `ManageNamingRulesPage.tsx`、`naming-rules/ai-intervention/.../AiInterventionProviderPanel.tsx`、
  `upstreams/SourceFormDialog.tsx`、`upstreams/shared.ts`、
  `shared/src/contracts/manage/upstreams/api.ts`）——即**页面上有配置表单**。
- Key 的真实载体是后端配置 `providers.tmdb.api_key`（TOML / secrets 文件），
  不是浏览器环境变量。
- 对 `host/e2e/*.spec.ts` 的字面量扫描**未发现 TMDB 环境变量读取**。
- **结论**：关键词命中 ≠ 现有 E2E 依赖。**不列为前端 E2E 必填输入**。

### 6.3 PostgreSQL 实例 —— 当前链路是 SQLite
- `host/e2e/start.mjs` 显式设置 `FMBY_DB_PATH=<tmp>/e2e.db` 并调用
  `fmby-e2e-seed <sqlite-db-path> <data-dir>`；seed 二进制内部直接
  `bootstrap_multi(&db_path).await`（SQLite 入口）。
- 后端配置 `FMBY_DATABASE_KIND` 默认 `sqlite`，`FMBY_DATABASE_URL` 才是 PostgreSQL 通道。
- `host/e2e/*.spec.ts` 中**无** `DATABASE_URL` / `POSTGRES*` / `PGHOST` 读取。
- ⚠️ 反向风险：若外层 shell 已导出 `FMBY_DATABASE_KIND=postgres`，
  `start.mjs` 用 `env: process.env` 启动 server/seed，该变量会被继承，
  seed 可能因缺 `boot.sqlite_pool` 失败。**对策见 7.2**。
- **结论**：PG 连接信息**不是**前端 E2E 必填输入，且在当前链路上是**污染源**而非依赖。

### 6.4 外部媒体目录 —— 不存在
见 5.3。媒体由后端 seed 从嵌入资产生成。

### 6.5 外部账号 / 第三方会话 —— 不存在
见 5.1 / 5.2。

---

## 7. 环境隔离要求（**必做**，但不需要用户提供凭据）

### 7.1 `FMBY_SECRETS_FILE` / `config/secrets.local.toml` 污染
- 后端装配逻辑：设了 `FMBY_SECRETS_FILE` 则要求文件存在且可解析；
  **未设**时会尝试 `config/secrets.local.toml` —— 不存在则空配置（可接受），
  存在但解析失败则 fail-fast。
- `host/e2e/start.mjs` 未覆盖该变量，且用 `env: process.env` 启动 server/seed
  ⇒ **hermetic 性取决于调用者的 cwd**。
- **要求**：跑真实 E2E 前显式清空该变量或指向受控空文件。
  ```bash
  unset FMBY_SECRETS_FILE
  # 或
  FMBY_SECRETS_FILE=/dev/null   # 仅当后端允许空内容；更稳的是指向受控临时文件
  ```
  注意：前端仓根当前**不存在** `config/` 目录，因此默认路径在本仓不会命中；
  风险来自“以别处为 cwd 启动”或未来新增该文件。

### 7.2 数据库类型污染
```bash
unset FMBY_DATABASE_KIND FMBY_DATABASE_URL   # E2E 走 SQLite 临时库
```

### 7.3 端口避让（多 worktree 并行）
- `FMBY_E2E_BACKEND_PORT`（默认 `18099`）、`FMBY_E2E_WEB_PORT`（默认 `5180`）。
- `FMBY_TRUSTED_ORIGINS` 由 `start.mjs` 自动派生为前端 origin
  `http://127.0.0.1:${webPort}` ⇒ **通常无需用户设置**；
  改 `FMBY_E2E_WEB_PORT` 后 origin 会同步变化（由启动器自行处理）。
- 端口变量属于运行配置，**不是业务凭据**。

### 7.4 产品特性开关（可选，默认关闭）
- `VITE_FEATURE_PAN115_IMGHOST`（读取位置 `host/src/featureFlags.ts:5,11`；
  路由注释 `host/src/app/router/index.tsx:78`）。
- 默认 `undefined` ⇒ `PAN115_IMGHOST_ENABLED === false` ⇒ 图床工具页不进 bundle。
- 当前 18 个 spec **无一条**导航到 Pan115/139 页面 ⇒ 该开关对现有 E2E **无影响**。
- 如需覆盖 Pan115 页面，属于新增覆盖范围，需要单独规划输入（cookie / 账号等），当前**未验证**。

---

## 8. 条件性输入：`FMBY_E2E_MFA_CODE`

| 项 | 内容 |
|---|---|
| 用途 | MFA 二因子登录后的 capabilities 一致性断言（缺陷 #289 的回归卡） |
| 读取位置 | `host/e2e/mfa-capabilities.spec.ts:38`：`process.env.FMBY_E2E_MFA_CODE ?? ''` |
| 前置 | 种子账号必须**已启用 MFA**，且后端 challenge 走 `status="mfa_required"` |
| 当前状态 | 后端 seed **未启用 MFA** ⇒ 登录后看不到「两步验证」region ⇒ `mfa-capabilities.spec.ts:32` 命中 `test.skip(true, '种子账号未启用 MFA，无法走二因子路径（需 MFA 已启用的种子）')` |
| 缺失行为 | 二因子正腿 **显式 skip**，不假绿；`FMBY_E2E_MFA_CODE` 缺失时 `:39` 再 `test.skip(!code, ...)` |
| 能否 SKIP | **能，且已实现**（两道 skip 都在，理由写在代码里） |
| 获取步骤 | 前提是先有 MFA 已启用的种子账号；再由测试夹具侧提供**当前有效**的 TOTP 码（TOTP 有时间窗，一次一码，无法预置静态值） |
| 存放位置 | 仅环境变量，**禁止**写入仓内任何文件 |
| 注入方式 | `FMBY_E2E_MFA_CODE=<当前码> pnpm e2e`（单次运行内有效） |
| 安全边界 | TOTP 码 / 共享密钥属敏感凭据，**禁止明文进仓**、禁止进日志与 evidence |

> 因此在“当前默认 seed”口径下，`FMBY_E2E_MFA_CODE` **不是**必填输入；
> 只有把 seed 改成 MFA 已启用时，它才成为条件必填。

---

## 9. 审计证据输出目录（可选）

| 项 | 内容 |
|---|---|
| 用途 | 移动端审计截图与无障碍树快照的落地位置 |
| 读取位置 | `host/e2e/mobile-audit.spec.ts:26-31`：`EVIDENCE_DIR`（绝对路径直接用，相对路径按仓库根解析），默认 `docs/evidence/fe-opt-02`，截图写 `<root>/full/` |
| 另一处 | `host/e2e/a11y-report.spec.ts:23-28`：**已修**（#19）为读同一个 `EVIDENCE_DIR`，与 `mobile-audit.spec.ts` 同口径（绝对路径直接用、相对路径按仓库根解析），默认仍 `docs/evidence/fe-opt-03/`（`aria-snapshot/<device>/*.yml` + `report-<device>.md`） |
| 缺失行为 | 不设置即用默认值，不影响测试判定（截图与快照不参与断言） |
| 能否 SKIP | 不适用（不是运行前提） |
| 注意 | `.gitignore` 已忽略 `docs/evidence/**/full/`，但 `aria-snapshot/**` 与 `report-*.md` **未忽略**。**#19 后可用 `EVIDENCE_DIR=<仓外绝对路径>` 让两个 spec 都不落仓内**，从而零污染；不设时仍会污染工作树（产物含实时时间戳与「N 分钟前」相对时间，属瞬态，不应入库） |
| 安全边界 | 截图不得包含真实凭据；本套 E2E 用的是 seed 测试账号与本地媒体，天然不含敏感数据 |

---

## 10. Skip 分类台账：哪些是“显式 SKIP”，哪些是“基建缺件”，哪些是“产品红”

| 类别 | 触发点 | 判定口径 |
|---|---|---|
| **显式 SKIP（合法）** | ① 无二进制：每个 spec 顶部 `test.skip(!E2E_ENABLED, E2E_SKIP_REASON)`<br>② MFA 未启用：`mfa-capabilities.spec.ts:32`<br>③ MFA 码缺失：`mfa-capabilities.spec.ts:39`<br>④ 非移动 profile 的触屏断言：`mobile-audit.spec.ts:154-157`<br>⑤ 页面无创建入口：`mobile-audit.spec.ts:276` | 都在代码里写明原因，**不冒充通过**。`E2E_SKIP_REASON` 文本包含构建命令、`FMBY_E2E_SERVER_BIN` 与 `describeSearchPaths()` |
| **基建缺件（`exit 3`）** | 无二进制 + `FMBY_E2E_REQUIRED=1`；Playwright 浏览器缺失；`host/node_modules/.bin/playwright` 缺失；`host/dist` 比源码旧 | `scripts/check-e2e.mjs` 的 `EXIT_INFRA = 3`，全部明确输出“不冒充产品绿/产品缺陷” |
| **产品红（`exit 1`）** | 页面未渲染；断言漂移；主题必需文件缺失导致的 404；CAS 阴性对照变异 | `EXIT_FAILED = 1`。已知红台账 `scripts/e2e-known-red.txt` **当前为空**（只有格式注释）；已修绿却不删登记会判 STALE 红，台账不是永久豁免 |
| **不能冒充** | “全部 skip 但 `exit 0`” | 门禁会打印 `[PASS] … 但已显式登记 SKIP 数`，**要求真跑时必须 `FMBY_E2E_REQUIRED=1`** |

### 当前已知的实现缺口（补输入也解决不了）
- **CAS-only 正腿**：`host/e2e/cas-admin.spec.ts` 头部 45 行已把现状锁写清——
  ① `cas_content_drive.present` 的生产写点只在 `CasPublish::publish_one` 的 `record_present`，
     而 `CasPublish::publish` 的调用点只落在测试装配 ⇒ 前端**没有任何请求**能造出 present 行；
  ② `.cas` 旁路（`CasSidecarIngest::ingest_batch`）只写内容、不写副本盘 `present` 行；
  ③ 唯一生产还原实现 `Yun139RestorePort` 需要 139 owned 挂载的
     `config_json.provider_secret.sealed_credentials`，`yun189pc` 取流面被显式排除。
  ⇒ 当前 `cas-admin.spec.ts` 采用**阴性对照**（真实栈无 CAS 行下播放照常出流，且播放页不得触碰 CAS 管理面）。
  正腿解锁条件 = **139 测试凭据 + `CasPublish` 的 HTTP/worker 触发点**，二者都在 fmby-v2 侧（后端缺口，非前端输入问题）。
- **`/api/manage/users`、`/api/manage/sessions` 端点 501**：`manage-pages.spec.ts` 对这两页用**诚实降级断言**
  （接受“加载失败”标题），不是产品绿。

---

## 11. 一句话执行清单（补齐后应全绿）

```bash
# 1) 后端产物（二选一）
export FMBY_E2E_TARGET_DIR=/data/fmby-build/local-target
# export FMBY_E2E_SERVER_BIN=.../debug/fmby-v2-server
# export FMBY_E2E_SEED_BIN=.../debug/fmby-e2e-seed

# 2) 浏览器（缺件会 exit 3）
cd host && npx playwright install chromium && cd ..

# 3) 主题产物（dist/ 被 gitignore ⇒ 干净机器必然缺）
pnpm build:themes

# 4) 环境隔离
unset FMBY_SECRETS_FILE FMBY_DATABASE_KIND FMBY_DATABASE_URL

# 5) 前端产物新鲜（比源码旧会被门禁挡）
cd host && pnpm build && cd ..

# 6) 真跑（不设 REQUIRED 时全 skip 也会 exit 0，务必设）
FMBY_E2E_REQUIRED=1 pnpm e2e-gate
```

**不需要**提供：TMDB Key、License 服务地址、PostgreSQL 连接串、Cookie/登录态、外部媒体目录、
第三方账号密码。这些在本仓当前真实 E2E 链路上没有读取点。

---

## 12. 未决 / 需验证项（诚实登记）

1. `themes/*/dist` 是 **gitignored 本地产物**（`.gitignore:2 dist/`）。本机当前两套主题产物齐备，
   但该状态**不可从仓内推断**；干净环境/CI 上的真实缺件清单**需主代理在干净 worktree 上跑一次确认**。
   本席按约束未执行构建与测试。
2. ~~`EVIDENCE_DIR` 只影响 `mobile-audit.spec.ts`；`a11y-report.spec.ts` 输出目录硬编码，
   是否应统一为可注入，**未处理**。~~ **已处理（#19）**：`a11y-report.spec.ts` 现读同一
   `EVIDENCE_DIR`。**仍未处理**：两个 spec 各写一份解析规则，可抽共享 helper
   （`host/e2e/fixtures/evidenceDir.ts`）以防再次漂移；另 `docs/evidence/fe-opt-03/**`
   是否整体 gitignore 属「仓内保留多少证据」的口径决策，需先定口径。
3. `host/tests/*.test.ts` 中因 Chromium / host 依赖不可用而 `t.skip(...)` 的**单测**用例
   （`episode-navigation.security.test.ts:55,94`；`mount-drawer-prefill.test.ts:86`；
   `player-recreate.test.ts:64`；`skin-realtime-rerender.test.ts` 多处）不在本清单的 E2E 门禁范围内，
   但同样存在“skip 掩盖”的风险，需独立收口。
4. README 写 `pnpm frontend:verify`，顶层实际脚本名为 `verify` —— 命名不一致，**未修**。
5. CAS-only 正腿解锁需要 fmby-v2 侧的 `CasPublish` 触发点改造，前端无法单方面解决。
6. Pan115 图床页（`VITE_FEATURE_PAN115_IMGHOST=1`）当前无 E2E 覆盖，其外部凭据需求**未验证**。
---

## 13. E2E Bootstrap Runbook（10/20 完整 E2E 的可执行前提）

本节把 §0 的 5 条真阻塞拆成「准备命令 → 验证判据」，可直接照抄执行。

### 13.1 前置假设

```bash
cd /data/fmby-seats/fe01        # 前端仓（任意 worktree）
cd /home/tefuir/rustproject/FMBY-V2   # Rust 主仓（仅当需要现场构建时）
```

依赖已装：前端仓根 `pnpm install`、`host/node_modules/.bin/playwright` 存在。

### 13.2 阻塞 1 —— server / seed 二进制

```bash
# 优先：复用已有产物（无需重建，最快路径）
export FMBY_E2E_TARGET_DIR=/data/fmby-build/local-target
test -x "$FMBY_E2E_TARGET_DIR/debug/fmby-v2-server" \
  && test -x "$FMBY_E2E_TARGET_DIR/debug/fmby-e2e-seed" \
  && echo "✅ 二进制就位" || echo "❌ 缺二进制，走现场构建"
```

```bash
# 兜底：现场构建（Rust 主仓内）
cd /home/tefuir/rustproject/FMBY-V2
cargo build -p fmby-v2-server --bin fmby-v2-server --bin fmby-e2e-seed
# 若用 release profile：默认管理员 seed 需额外 FMBY_ALLOW_DEFAULT_ADMIN_SEED=1
```

**为什么不能只 export 二进制路径而不看 target 目录**：resolver 优先级是
显式 BIN > `FMBY_E2E_TARGET_DIR` > `CARGO_TARGET_DIR` > …，
而 `/data/fmby-target/*`（如 `w06`）**默认不扫**，需 `FMBY_E2E_SCAN_BRANCH_TARGETS=1`。

**验证判据**：
- `node -e "import('./host/e2e/binaryResolver.mjs').then(m=>console.log(m.resolveServerBinary()))"`
  打出绝对路径 ⇒ 阻塞解除。
- 仍为 `null` ⇒ `FMBY_E2E_REQUIRED=1` 下门禁会 `exit 3` 并打印
  `已搜索：<describeSearchPaths()>`——按那行提示核对变量，**不要**改代码绕过。

### 13.3 阻塞 2 —— Playwright 浏览器

```bash
cd host && npx playwright install chromium && cd ..
# 自定义位置时：
# export PLAYWRIGHT_BROWSERS_PATH=/data/pw-browsers
#   && cd host && PLAYWRIGHT_BROWSERS_PATH=/data/pw-browsers npx playwright install chromium && cd ..
```

**验证判据**：
- `node -e "import('./scripts/check-e2e.mjs')"` 不合适（会真跑）。改用存在性检查：
  `ls "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" | grep chromium`
  有输出 ⇒ 阻塞解除。
- 无输出 ⇒ 门禁 `exit 3`，明确「不冒充产品缺陷」。

### 13.4 阻塞 3 —— `host/dist` 新鲜度

```bash
cd host && pnpm build && cd ..
# 或让 webServer 强制先建：FMBY_E2E_REBUILD=1（会走 `pnpm build && node e2e/start.mjs`）
```

**验证判据**（可脱离门禁自查）：
```bash
test -f host/dist/index.html && \
  [ "$(stat -c %Y host/dist/index.html)" -ge \
    "$(find host/src shared/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.mjs' -o -name '*.js' -printf '%T@\n' | sort -rn | head -1 | cut -d. -f1)" ] \
  && echo "✅ dist 比源码新" || echo "❌ 缺失或陈旧，会被门禁 exit 3"
```
判定逻辑与 `scripts/check-e2e.mjs:276-299 newestSourceMtime()` 一致
（只扫 `host/src` 与 `shared/src` 的 `.ts/.tsx/.css/.mjs/.js`）。

⚠️ 本机 `fmby-queue` 会把 `pnpm build` 判为重活（实测 `exit 3` / 180s 超时）。
若命中，**改用农场产物**（`/data/fmby-build/local-target/...` 同理适用于前端产物，
或手工 `vite build` 绕过 pnpm 脚本层），**不要**把 build 塞回 `webServer.command`。

### 13.5 阻塞 4 —— `themes/*/dist`

```bash
pnpm build:themes    # = pnpm -r --filter './themes/*' build
```

校验（两个主题都必须满足，且 `_template` 以 `id=template` 装配）：
```bash
for d in themes/*/; do
  id=$(python3 -c "import json,sys;print(json.load(open('$d/dist/theme.manifest.json'))['id'])" 2>/dev/null || basename "$d")
  for f in index.js tokens.css theme.manifest.json skins/item.css; do
    test -f "$d/dist/$f" && echo "✅ $id/$f" || echo "❌ $id/$f 缺"
  done
done
```

**验证判据**：上表 8 行全 `✅`。
`start.mjs` 只把 `dist/index.js` 当门槛，`assembled === 0` 时才自动 `build:themes`；
**单个文件缺失不会被发现**，会在运行期变成 404 ⇒ 表现为产品红（不是基建缺件）。
`dist/` 被 `.gitignore:2` 覆盖 ⇒ 干净机器/CI 上必然需要这一步。

### 13.6 阻塞 5 —— 环境隔离

```bash
unset FMBY_SECRETS_FILE FMBY_DATABASE_KIND FMBY_DATABASE_URL
# 顺手确认没有残留的可信来源覆盖（start.mjs 会自己派生，一般不用管）
unset FMBY_TRUSTED_ORIGINS
# 多 worktree 并行时避让端口（默认 18099 / 5180）
# export FMBY_E2E_BACKEND_PORT=18199 FMBY_E2E_WEB_PORT=5181
```

**为什么是必做**：`start.mjs` 用 `env: process.env` 启动 server/seed，
外层变量**会被继承**：
- `FMBY_SECRETS_FILE` 未设 ⇒ 后端回退读 `config/secrets.local.toml`
  （存在但解析失败 ⇒ fail-fast；不存在 ⇒ 空配置可接受）。
  本仓根当前无 `config/`，但**换 cwd 启动就会踩到**。
- `FMBY_DATABASE_KIND=postgres` ⇒ seed（SQLite 专用装配工具）会失败，
  `start.mjs:92-104` 报 `explicit E2E seed failed` 并 `exit 1`。

**验证判据**：`env | grep -E '^FMBY_' | grep -v 'FMBY_E2E'` 无输出。

### 13.7 真跑与判据

```bash
FMBY_E2E_REQUIRED=1 pnpm e2e-gate
```

| 现象 | 含义 | 下一步 |
|---|---|---|
| `exit 3` | **仍有基建缺件**（回看上面 5 节的提示行） | 按提示补输入，**不要**改代码或台账绕过 |
| `exit 1` | 产品失败 | 看 list/json 报告；若是已知红，登记 `scripts/e2e-known-red.txt`（已修绿必须删登记，否则判 STALE 红） |
| `exit 0` + 打印「已显式登记 SKIP 数」 | **假绿**，没真跑 | 检查 `FMBY_E2E_REQUIRED=1` 是否真的传到了子进程 |
| `exit 0` + 跑出 passed/failed 明细 | 真结论 | 失败项按产品缺陷归因 |

**核心判据**：`FMBY_E2E_REQUIRED=1` 下**不再出现 exit 3**，
即 5 条基础设施阻塞全部解除；此后任何红都是产品问题，不再是环境问题。

### 13.8 谁在什么时候跑（建议）

| 场景 | 谁跑 | 命令 | 备注 |
|---|---|---|---|
| 前端日常改动自验 | fe01 写手本人 | `pnpm e2e-gate`（不设 REQUIRED） | 快速反馈；**接受全 skip** |
| 提交前 / 合并前 | 前端写手 | `FMBY_E2E_REQUIRED=1 pnpm e2e-gate` | 必须真跑，禁止 skip 假绿 |
| **10/20 全量验收** | **主代理** | 先按 §13.2–13.6 逐条 prepare，再 `FMBY_E2E_REQUIRED=1 pnpm e2e-gate` | 本席按约束不执行编译/测试 |
| 夜间全量 / CI | CI | 同上，另建议 `FMBY_E2E_SCAN_BRANCH_TARGETS=1` + 缓存 target 目录 | `FMBY_E2E_SKIP=1` 仅用于**验证报数逻辑**，不得当验收 |
| 换机器 / 干净 worktree |  whoever | §13.5 + §13.6 必做（`dist/` 被 gitignore） | 阻塞 1/2 也要重做 |

**成本提示**：真跑一次 E2E 会刷新 `docs/evidence/fe-opt-03/**`
（`a11y-report.spec.ts` 输出目录硬编码，每次必脏工作树——见 #19），
以及写 `docs/evidence/fe-opt-02/full/`（已被 `.gitignore` 忽略）。
建议真跑后先 `git status` 看脏了哪些，再决定是否随分支提交快照。
