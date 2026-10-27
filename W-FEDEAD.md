# W-FEDEAD · 前端死码删除 + repo-size 处置 + 闸误报判定

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fedead`（基线 origin/main `99acc73`）
> 本卡授权范围：只读 + 删死码。**生产代码改动 = 4 个删除提交**（见 §1），其余全部是方案/判定。
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论

4 处零调用死码**全部复核为真死码并已删**（4 个原子 commit，能力均有活代码覆盖或前提过时，无一属于「预留待接线」）；repo-size 给出**压缩+外置组合方案**（保证据、不删图）；fmby-web CI 补跑 verify 的 YAML 已给；3 条闸误报**判定成立**，推荐「删 FE 死声明」而非改闸（待你裁）。

---

## 1. 缺陷 A：4 处死码复核与删除（已执行）

复核手段（本卡纪律内）：`codegraph explore`×4 + 桶文件/页面装配直接 read；无 `find`/`grep -r`/`blame`。

| # | 模块 | 复核结论 | 删除 commit | 「能力去哪了」对照 |
|---|---|---|---|---|
| 1 | `host/src/pages/_placeholder/PlaceholderPage.tsx`（43 行） | **真死码**：explore 显示仅同文件 `createPlaceholderPage`/`NamedPlaceholderPage` 内部互调；router/tests 零引用；无覆盖测试 | `35dea41` | 无能力可丢（占位机制已废，路由 50 条全部真页面） |
| 2 | `shared/src/utils/imageProbe.ts`（63 行） | **真死码且前提过时**：`needsProbe` 唯一调用方是同文件 `probeImage`；零测试。它为「后端缺图回 204 ⇒ `<img>` 无 onload/onerror」而写；V2 资产读侧现对缺图一律 **404**（fmby-v2 `asset/image.rs` 全 `NOT_FOUND` 分支），404 正常触发 `onError`（`ArtImage.tsx:58` 已接降级） | `beb4b8a` | 裂图降级由 `<img onError>` + e2e `asset-fallback.spec`（naturalWidth===0 断言）承担 |
| 3 | `host/src/pages/manage/mounts/components/MountCredentialGuidance.tsx`（72 行） | **真死码**：`mounts/components/index.ts` 桶不导出、无页面渲染（explore blast radius 无任何消费方）。**不是「预留」**：其能力（凭据过期「管理员看得见」）已被三处活代码覆盖 | `6541004` | ① `ManageMountsPage` + `MountDrawer` 消费 `useMountHealthFaultMap`（4 个活调用点）② 概览页 `MountsHealthMatrix` ③ yun139 域 `credentialExpiry.ts`（`CredentialExpiryGuidance`） |
| 4 | `host/src/pages/manage/task-center/components/AsyncJobsSection.tsx`（139 行） | **真死码，过时而非预留**：task-center 桶不导出、`ManageTaskCenterPage`（装配 = Metrics/CategoryGroups/DetailDrawer）不渲染。它自述「等服务端异步任务契约（E1 202+job_id）接入」——该契约最终由 **task-center items API + `TaskCenterStreamBoard`** 另行落地 ⇒ 等待对象已不存在 | `cebd051` | 「后台任务可见」由 AppShell `AsyncJobsProvider`（会话级反馈）+ `UserDrawer`（useAsyncJobs 列表）+ 任务中心自身承担 |

**净效果**：-317 行生产码，4 commit，`git status` 干净。

### 1.1 遗留一项待你裁（本卡未动）
`resolveCredentialGuidance`（`host/src/pages/manage/mounts/mountPresentation.ts:154`）——它唯一的生产消费者就是刚删的组件，现由 **2 个测试文件**（`mount-formutils-exports.test.ts:64`、`mount-datasource-backfill.test.ts:183-205`）单独养着 =「测试养死码」。选项：(a) 连同 2 个测试一起删；(b) 保留（若你打算日后在 MountDrawer 里接凭据过期提示）。**未删，等你裁。**

---

## 2. 缺陷 B：repo-size 处置（15 张 PNG = 评测证据，不删）

现状实测：**1332.0 KiB / 1024 KiB（130%）**，15 张，全部 `docs/evidence/**/samples/`。
最大 3 张占 **49%**（648.7 KiB）：`fe-opt-02/tablet-768/home.png` 296.2K、`fe-ui-accept-node62/desktop/naming-header.png` 210.1K、`fe-ui-accept-node62/desktop/manage-cockpit.png` 142.5K。

| 方案 | 做法 | 预期 | 代价 |
|---|---|---|---|
| ① 压缩（推荐，立即） | 15 张过一遍无损/近无损压缩（`oxipng -o2` 或 `pngquant --quality 72-92`）；桌面档 3 张大图可再降采样到 1280 宽（截图文字仍可读） | 按 -40% 估 ⇒ **≈799 KiB**，闸绿；R1/R2 语义不变 | 需一次人工执行（58 无 oxipng ⇒ 放农场/任一有 imagemagick 的机器；`pnpm repo-size` 复跑验收） |
| ② 外置超预算张（策略原意） | 按 `docs/evidence-policy.md` R1「抽样 ≤8 张」：仓内留 8 张代表（建议按「卡×断点×页面类」各留一：fe-opt-02 的 desktop manage-site-settings、phone manage-naming-scrape/home、tablet manage-site-settings + node62 的 totp-qr、item-skin×2、libraries），其余 7 张（=上面 Top3 + 124K/91K/131.5K/101.8K 中的落选者）挂发布仓/CI artifact | 仓内 ≈420-540 KiB | 需要你指定外置位置（现状无 evidence bucket：GitHub Release asset 或独立 evidence 仓，二选一） |
| ③ 上调预算 | CI 设 `REPO_SIZE_MAX_TOTAL=1.5M` | 闸绿 | 把债合法化，且与 policy R2「≤1 MiB」冲突 ⇒ 需你明示裁定 + 同步改 policy 文档 |

**推荐 ①（可叠加 ②）**：证据一张不丢、预算闸语义不变、改动只在图片字节。验收判据：`pnpm repo-size` exit 0。

### 2.1 fmby-web CI 补跑 verify（具体改法）

现状：`.github/workflows/gates.yml` 只有 identity / evidence(仅 PR) / contract(错误码目录) 三个 job —— **typecheck/build/test/size/repo-size/dupes/contracts 全都不在前端仓 CI 里**（只有后端 `ci.yml frontend` job 代跑，这就是 repo-size 红了没人看见的原因）。

在 `gates.yml` 追加（workflow 已有 `on: push main + pull_request`，job 自动生效）：

```yaml
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4          # 版本读 package.json 的 packageManager
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify                    # 12+闸：versions/typecheck/build/build:themes/theme-dist/test/size/repo-size/dupes/contracts/theme-budget/theme-parity/component-size/css-usage/e2e-gate
      - run: pnpm test
```

两点说明：① `verify` 含 `e2e-gate`（`check-e2e.mjs`：无服务端二进制 ⇒ 显式报数 exit 0；只有 `FMBY_E2E_REQUIRED=1` 才 exit 3）⇒ CI 不会因 e2e 缺件假红，也不会静默 skip。② 时长预估 install+build ≈ 4-6 min，可接受；若嫌 verify 全链太重，最小集 = `typecheck + test + repo-size + size + dupes + contracts`。

---

## 3. 三条「闸误报」判定（browse/libraries 的 resolution/watched/sort）

**判定：是误报（成立）**。证据链（RV-D 实测，本卡复核未变）：
- FE 唯一调用方 `shared/src/viewmodels/useLibraryDetail.ts:87-101` 只传 `cursor/pageSize/mediaType`；
- `LibraryDetailParams` 的 `resolution/watched/sort` 在 `shared/src/contracts/browse/api.ts:129-138` 的 params 对象里恒为 `undefined`，而 HTTP 客户端 `buildUrl` **跳过 undefined**（`shared/src/api/client/core.ts:78-88`）⇒ 不上 wire；
- 同仓另一闸 `check-query-params` 的 `KNOWN_GAPS` 已把这 3 键按「前端死声明，不构成 wire 缺口」ack —— **两闸对同一事实给出相反结论**，这才是要修的病。

**两条修法（scripts 归你，我不动）**：
1. **推荐：删 FE 死声明**（不改闸）：删 `browse/api.ts` 的 `LibraryDetailParams` 三字段 + params 对象三行（:134-136，:36-38）。闸自然转绿、两闸一致、顺手消灭死码。属契约类型改动，**待你点头我再做**（一个 commit 的事）。
2. 改闸（若你想保留「字面量键即算发参」的保守口径）：给 `check-fe-be-query-parity.mjs` 加一条与它自己处理 `mapQueryParams` 相同的规则——值表达式为 `params.x` 直传形态 ⇒ 静态不可判，记 dynamic 不判漂移；**并让两个闸共用同一份豁免台账**（否则矛盾还会再生）。

---

## 4. 需主代理投农场

「**需主代理投农场**：建议命令 `FMBY_ORCHESTRATOR=1 bash scripts/farm.sh seat/rv3/fedead test --node node62`」
期望判据：
1. `pnpm -r test` **0 fail**（host 132 文件 / 981 用例 + shared 26 文件）。重点关注：`ui-density-p1-header`（断言注册码页头文案）、`mount-datasource-backfill`（`resolveCredentialGuidance` **未删**，应仍绿）。
2. 若采纳 §2 方案①：农场跑图片压缩后 `pnpm repo-size` **exit 0**（≤1024 KiB）。

本机已做：`tsc -p tsconfig.app.json --noEmit`（卡面允许的轻量项）—— 见 §5。

---

## 5. 本机已跑的验证

- `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`（4 个删除提交之后）：**EXIT=0**（首次运行 ~9 分钟被环境中断无输出；重跑 `EXIT=0` —— 删除改变了输入文件清单会强制重查，非 stale no-op）。四处理除无任何断链。
- `git status --porcelain` 在每个原子 commit 后为空。

---

## 6. 复现命令

```bash
cd /data/fmby-seats/rv3-frontend && git log --oneline -6   # 4 个删除 commit + 本报告
git show --stat 35dea41 beb4b8a 6541004 cebd051           # -317 行
# 死码复核（explore，≤10 次纪律内用了 4 次）
codegraph explore "PlaceholderPage _placeholder" -p .
codegraph explore "imageProbe needsProbe" -p .
codegraph explore "MountCredentialGuidance credential expired guidance" -p .
codegraph explore "AsyncJobsSection TaskCenterPage" -p .
codegraph explore "useMountHealthFaultMap MountsHealthMatrix" -p .   # 证明能力有活消费者
# repo-size 现状
node scripts/check-repo-size.mjs                           # FAIL 1332.0/1024 KiB（15 张）
git ls-files | python3 -c "…按字节排序…"（见卡面交付对话记录）
# 闸误报
#   FE 唯一调用方：shared/src/viewmodels/useLibraryDetail.ts:87-101（只发 cursor/pageSize/mediaType）
#   buildUrl 跳过 undefined：shared/src/api/client/core.ts:78-88
#   另一闸已 ack：fmby-v2 scripts/check-query-params.mjs KNOWN_GAPS「前端死声明」
```

## 7. 未做 / 边界

- 未删 `resolveCredentialGuidance` 及其 2 个测试（§1.1，待裁）。
- 未改任何闸脚本（scripts 侧归你）、未改 `.github/workflows/`（§2.1 是提案 YAML，等你确认再落）。
- 未动 15 张 PNG（本卡明令不删；压缩执行放农场）。
- 本机未跑前端单测（纪律：报农场）；`pnpm size` 需要 dist（本机禁构建），其预算核验随农场。
