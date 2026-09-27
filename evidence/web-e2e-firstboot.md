# E2E-FIRSTBOOT-1 —— 空库首启（安装向导）端到端 spec

前端仓 `/home/tefuir/rustproject/fmby-web`，分支 `w/zcode/s1-e2e-firstboot`，**基点 `origin/main` = `1cfab4b5e6e36f12ab68b64a27568abedb556774`（v0.2.14）**。
补上 `evidence/web-e2e-full.md` §3.4 显式登记的缺口：**`/install` 与「空库首启」从未被端到端跑过**
（既有 16 个 spec 全跑在预置 seed 的完成安装栈上）。

> 基点订正：首次落码时误从当时的工作分支 `w/zcode/fe-fix-build-ts`（`da23e87cb`，与 `origin/main`
> 的 merge-base 为 `5a1c612e`，**非后代**）起，`git diff --stat origin/main..HEAD` 出现 453 文件 /
> 31k 删除 ⇒ 已重建：`git format-patch` 存提交 → 切回 → `git branch -D` → `git checkout -b
> w/zcode/s1-e2e-firstboot origin/main` → `git apply`（`start.mjs` 在两基点逐字相同，patch 干净落地）。
> 本文件所有数字均为**新基点**上重跑所得。

## 1. 结论与判据

| 项 | 值 |
|---|---|
| **真首启判别器** | `GET /api/auth/entry/status` 的 `needs_setup`：空库 `true` / 已 seed `false` |
| **不是判别器** | `GET /api/install/status` —— 生产装配下空库与已 seed **都**返回 `{"state":"configured",…}`（见 §6 E1） |
| spec 默认行为 | **跳过**（`pnpm e2e` 用 seed 栈，本 spec 断言在 seed 栈上不成立，不能拖红既有 16 spec） |
| 显式开启 | `FMBY_E2E_FIRSTBOOT=1`（空库态再加 `FMBY_E2E_NO_SEED=1`） |

## 2. 改动面

```
 M host/e2e/start.mjs        （+17/-7：新增 FMBY_E2E_NO_SEED=1 空库首启模式）
?? host/e2e/firstboot.spec.ts（新增 spec，4 用例）
?? evidence/web-e2e-firstboot.md（本文件）
```

- 0 产品码（`host/src/**` 未动）、0 新依赖、0 锁文件改动；既有 **16 个 spec**、`playwright.config.ts`
  （含 `chromium` + `mobile-chrome` 两个 project）、`host/e2e/fixtures/**` **全部未动**。
- 前后端仓边界：只在前端仓自己的分支上动手，**后端仓零文件改动**（仅只读查证，见 §8）。

## 3. 启动模式（`FMBY_E2E_NO_SEED=1`）

`host/e2e/start.mjs` 原流程恒为 `seed → themes → server → vite`；本卡加一条分支：
空库态下**跳过 `fmby-e2e-seed`**，只由 server 自身 bootstrap 建库（迁移建 schema、不种数据），
且**不要求 seed 二进制存在**。其余（临时空目录 / 端口 / 代理 / 就绪等待）复用原实现。

```js
// ponytail: 只加一个 env 开关，不做 mode/profile 抽象；天花板＝「种 / 不种」二元，
// 若将来还要「预置半装状态」再抽参数。
const noSeed = process.env.FMBY_E2E_NO_SEED === '1';
```

## 4. 用例（4 条 × 2 project = 8）

| 用例 | 断言 | 性质 |
|---|---|---|
| **A** | `GET /api/auth/entry/status` ⇒ `needs_setup === true` | **判别器**（空库真绿 / seed 真红） |
| **B** | `/login` 渲染「创建管理员账户以开始使用」+「创建管理员」按钮，且**无**「登录」按钮 | **判别器**（同上） |
| **C** | `/install`：选 SQLite → 填路径 → 「检查数据库连接」⇒ **成功横幅**「数据库连接检查通过」 | `test.fail()`：E1/E2 已知缺陷 |
| **D** | `SetupForm` 提交 ⇒ 「管理员 … 创建成功，请登录」→ 刷新后可用新账号登录（`/api/auth/me`=200） | `test.fail()`：E3 已知缺陷 |

C/D 用 `test.fail(true, '<缺陷编号>')` **断言期望的正确行为**（形态对齐本仓 `evidence/web-e2e-full.md`
§4 PRODUCT-DEFECT-01：当前因缺陷失败 ⇒ 计入通过；缺陷修好后「意外通过」转红 ⇒ 自动提醒摘除标注）。
D 另有 5s 前置可见性断言（非空库态快速失败，不靠 30s 超时）。

A 用 `expect.poll`（非单发）：preview 代理的**首个** `/api` 请求会撞启动竞态——实测原文
`9:35:08 AM [vite] http proxy error: /api/auth/entry/status`，紧随其后后端 `GET /auth/entry/status -> 200`；
页面类用例天然容忍（等 SPA），纯 API 请求需自行重试。

## 5. 当次验证原文（两向 + 默认跳过，均为新基点重跑）

### 5.1 空库首启（期望绿）—— `rc=0`

```bash
cd /home/tefuir/rustproject/fmby-web/host
FMBY_E2E_FIRSTBOOT=1 FMBY_E2E_NO_SEED=1 FMBY_E2E_BACKEND_PORT=18155 \
FMBY_E2E_SERVER_BIN=/data/tg-release/debug/fmby-v2-server \
./node_modules/.bin/playwright test firstboot.spec.ts --reporter=list
```
```text
  ✓  1 [chromium]      › A. 首启判据：/api/auth/entry/status 报 needs_setup=true (41ms)
  ✓  2 [chromium]      › B. /login 进入 needs_setup 分支：渲染「创建管理员」表单而非登录表单 (507ms)
  ✘  3 [chromium]      › C. /install 向导：选 SQLite → 检查数据库连接 → 出现成功提示 (5.8s)
  ✘  4 [chromium]      › D. /login needs_setup 分支：建管理员成功 → 可用新账号登录 (5.9s)
  ✓  5 [mobile-chrome] › A. … (37ms)
  ✓  6 [mobile-chrome] › B. … (836ms)
  ✘  7 [mobile-chrome] › C. … (6.7s)
  ✘  8 [mobile-chrome] › D. … (6.3s)
  8 passed (54.9s)
rc=0
```
（C/D 的 ✘ 是 `test.fail` 期望失败 ⇒ 计入 passed；终判 `rc=0`。）

### 5.2 反事实：已 seed 完成安装栈（期望 A/B 真红）—— `rc=1`

```bash
FMBY_E2E_FIRSTBOOT=1 FMBY_E2E_BACKEND_PORT=18156 \
FMBY_E2E_SERVER_BIN=/data/tg-release/debug/fmby-v2-server \
FMBY_E2E_SEED_BIN=/data/tg-release/debug/fmby-e2e-seed \
./node_modules/.bin/playwright test firstboot.spec.ts --reporter=list
```
```text
  ✘  1..2 [chromium]      › A. / B.        ← 真红
  ✘  3..4 [chromium]      › C. / D.        ← test.fail 期望失败
  ✘  5..6 [mobile-chrome] › A. / B.        ← 真红
  ✘  7..8 [mobile-chrome] › C. / D.        ← test.fail 期望失败
  4 failed
  4 passed (4.0m)
rc=1
```
A 的红原文（证明「空库 vs 已装」被测到，不是搭便车假绿）：
```text
  1) … › A. 首启判据：/api/auth/entry/status 报 needs_setup=true
    Error: 空库首启：/api/auth/entry/status 应报 needs_setup=true
    expect(received).toBe(expected) // Object.is equality
    Expected: true
    Received: false
    Call Log: - Timeout 15000ms exceeded while waiting on the predicate
      > 52 |       .toBe(true);
```
B 的红原文：
```text
  2) … › B. …
    Error: expect(locator).toBeVisible() failed
    Locator: getByText('创建管理员账户以开始使用')
    Expected: visible
    Timeout: 5000ms
```

### 5.3 默认（不设 `FMBY_E2E_FIRSTBOOT`）—— `rc=0`，既有套件不受影响

```text
  8 skipped
rc=0
```

### 5.4 `pnpm verify` —— `rc=0`

```text
【typecheck / build / build:themes / test / size / repo-size / dupes / contracts / theme-budget / component-size / theme-parity 全绿】
[PASS] All declared domain skins satisfy required capabilities.
rc=0
```

## 6. 已知缺陷登记（回主代理立卡；本卡**不改后端**）

| 编号 | 现象（实测原文） | 归属 |
|---|---|---|
| **E1** | `GET /api/install/status` 在**空库与已 seed 上完全相同**：`{"state":"configured","database_configured":true,"can_probe":true}`。根因：生产装配 `InstallRuntime::new(true)`（`crates/fmby-v2-server/src/factory/interfaces.rs:464`），状态由该 bool 派生（`crates/fmby-v2-bridges/src/runtime.rs:190-201`） | 后端卡 `INSTALL-WIZARD-APPLY-1` |
| **E2** | `POST /api/install/probe/database` **恒 404** `{"error_code":"not_found"}`（`crates/fmby-v2-http/src/routes/install.rs:303-306`：`database_configured` 为真即整面下线）⇒ `/install` 的成功横幅不可达 | 后端卡 `INSTALL-WIZARD-APPLY-1` |
| **E3** | 空库（仅迁移）`POST /api/auth/setup` → `400 USER_ROLE_NOT_FOUND`「指定的角色不存在」；DB 实测 `access_role` count=0（迁移不种默认角色），seed 后 `access_role` count=1('admin') + `access_role_capability` count=8 | 主代理 2026-09-27 另立后端卡 |

补充（非缺陷，登记）：`/install` 是**孤立路由** —— `codegraph callers InstallPage` 仅 1 个引用
（`host/src/app/router/index.tsx:81`），全仓无跳转/守卫指向它（用户需手动访问 URL）。

## 7. ponytail

- **跳过了什么**：没有把「空库/已装」做成 profile/配置抽象（一个 `FMBY_E2E_NO_SEED` env 开关即可）；
  没有新写启动器、没有复制 `start.mjs`（复用原流程 + 一条分支）；没有为 C/D 另造 mock 或后端桩
  （`test.fail` + 真栈是既有仓内做法）；没有顺手改既有 16 spec / `playwright.config.ts` / 旧 evidence 文档。
- **何时再加**：① 后端 `INSTALL-WIZARD-APPLY-1` 落地 ⇒ 移除 C 的 `test.fail`，并追加「落盘 + 重启后
  `configured`」一步；② E3 修好 ⇒ 移除 D 的 `test.fail`；③ 若将来要「预置半装状态」再抽 launcher mode 参数。

## 8. codegraph 查证（前端仓）

```text
$ codegraph query "InstallPage"
function InstallPage   host/src/pages/install/InstallPage.tsx:8
$ codegraph query "SetupForm"
function SetupForm     host/src/pages/login/forms/SetupForm.tsx:20   ({ onSetupCompleted }: SetupFormProps)
$ codegraph callers "InstallPage"
Callers of "InstallPage" (1):  route /install   host/src/app/router/index.tsx:81
```
（后端侧只读查证：`codegraph query "install_status"` → `crates/fmby-v2-http/src/routes/install.rs:373`；
`codegraph query "install"` → `trait InstallService` `crates/fmby-v2-http/src/state/install.rs:17`、
`impl InstallService for InstallRuntime` `crates/fmby-v2-bridges/src/runtime.rs:189`。）

## 9. 复现命令（两向）

```bash
cd /home/tefuir/rustproject/fmby-web/host
# 空库首启（绿）
FMBY_E2E_FIRSTBOOT=1 FMBY_E2E_NO_SEED=1 FMBY_E2E_BACKEND_PORT=18155 \
  FMBY_E2E_SERVER_BIN=/data/tg-release/debug/fmby-v2-server \
  ./node_modules/.bin/playwright test firstboot.spec.ts --reporter=list
# 反事实（A/B 红）
FMBY_E2E_FIRSTBOOT=1 FMBY_E2E_BACKEND_PORT=18156 \
  FMBY_E2E_SERVER_BIN=/data/tg-release/debug/fmby-v2-server \
  FMBY_E2E_SEED_BIN=/data/tg-release/debug/fmby-e2e-seed \
  ./node_modules/.bin/playwright test firstboot.spec.ts --reporter=list
```

踩坑记录（复现时注意）：两条命令**不能并发**——`webServer.reuseExistingServer=false`，前一次的
`vite preview` 若未随 playwright 退出会占住 5180，第二次直接报
`Error: http://127.0.0.1:5180 is already used`（本卡踩到一次，手工 kill 残留 vite 即可）。

## 10. 依赖与后续（本卡不做）

1. `INSTALL-WIZARD-APPLY-1`（S16 车道）落地后：C 去掉 `test.fail`，追加「apply 落盘 → 重启 → `configured`」。
2. E3 后端卡落地后：D 去掉 `test.fail`。
3. `/install` 完成态前端页面（缺「下一步/完成」）由后端 apply 落地后另开前端卡。
