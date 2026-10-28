# W-FE-RED · fmby-web 测试红清点与定性（shared 6 + host 2 + 存量 tsc 红）

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fe-red`（基线 origin/main `99acc73`，farm3 实测基线 a50117e 与本分支在 shared/host 测试面上同源）
> 本分支 commit 链（按序）：**55c8c6a**（W-A-RESUME live bug 修复+钉测试）→ **91debe0**（tablewrap 名单修复）→ **188f8cb**（keynav 探针修复）→ **52347e1**（a11y 名单行号同步）→ 本报告
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论

1. **农场报的 shared 6 红：在本机两个提交（99acc73 / a50117e）上均不可复现**（161/161 绿，复跑稳定），且 157≠161 的用例数差证明**农场那次跑的不是这份 shared/tests** —— 定性为**农场工作树陈旧/混态**，非实现缺陷、非测试陈旧。**请求农场带环境取证复跑**（§5）。
2. **但「CI 从不跑测试」的洞是真的，而且比 6 条更深**：我在核 verify job 时实测 origin/main 干净树上还有 **2 条 host 存量红**（1 条确定性断言漂移 + 1 条测试陈旧超时）和 **1 条 tsc 存量红** —— verify job 一旦生效会**当天就红**，这 3 条本分支已全部修复（RED→GREEN 见 §3/§4）。
3. **顺带修掉一个比「筛选失效」更伤的 live bug**（站长追加卡）：媒体条目列表**每行**显示「状态缺失/元数据缺失/挂载缺失」—— 后端二元真值 mounted/identified/configured… 全落进旧 V1 词表 mapper 的 default 分支。已按「真实值补齐 + default 保留 fail-soft」修复（§2），同族扫出 **mount_status 也是同病**（一并修）。

---

## 1. shared 6 红：逐条定性（**全部「非缺陷」，且非测试陈旧**）

### 1.0 本机取证（站长要求，2026-10-27 当次原文）

```text
$ node -v
v24.15.0
$ git rev-parse HEAD        # seat/rv3/fe-red
ce393ba360ffa475e8db162246daa43fee6e447d
$ git status --porcelain
（空 —— 工作树干净）
$ shared/tests 逐文件 test() 计数（预期 166）：
   6 api-client-boundaries / 12 auth-failure / 9 auth-session / 15 batch-operation /
   5 capability-union / 16 contract-mappers / 5 csrf-echo / 14 identity-bindings /
  13 identity-login / 5 license-contract / 1 manage-batch-delete /
   4 manage-media-items-detail-wire.contract / 5 media-item-status-mappers(本卡新增) /
   4 media-reprocess / 6 mfa-session-capabilities / 3 rewards-self / 2 scans-query-params /
   6 theme-capabilities / 4 theme-domain / 2 user-security-ops / 18 viewmodels /
   3 yun139-owned-browse / 2 yun139-pool-lease / 6 yun139-pools-seg-a
TOTAL 166
```
**用途**：农场复跑（已排队 seat/rv3/fe-red test --node farm3）若再报非 166/0，用本表逐文件对账即可定位缺了哪个文件/哪几条。

### 1.0b ★主代理裁定确认：状态词表病灶是 **main 存量 live bug（P1）**，非本卡引入

`git show origin/main:<path>` 直读 main（99acc73）原文，两个文件都只有 V1 词表：

```text
$ git show origin/main:shared/src/contracts/manage/media-items/api/mappers-enum.ts
export function mapSourceStatus(raw?…) {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'pendingvalidation' / 'pending_validation' / 'pending-validation' → 'pending-validation'
    case 'playable' → 'playable' … case 'auth-expired' → 'auth-expired'
    default: return 'missing'          ← mounted 落这里
  }
}
export function mapMetadataStatus(…) { case 'pending'/'success'/'failed'/'failure' …
    default: return 'missing' }        ← identified 落这里
export function mapMountStatus(…)   { case 'active'/'unreachable'/'disabled' …
    default: return 'missing' }        ← configured/verified/maintenance 落这里
mounted in file: False | identified: False | configured: False

$ git show origin/main:host/src/pages/manage/media-items/formUtils.ts
getSourceStatusLabel: case 'playable'→'可播放' … default: return '状态缺失'
mounted in file: False
```

⇒ **main 上每行「状态缺失/元数据缺失/挂载缺失」成立**；修复 = 本卡 commit `55c8c6a`（含 host 显示层、下拉二值化、mount 同族）。合并时按 P1 登记为 main live bug 的修复，非本卡新引入。
另：`ec08e65`（W-METAFAMILY①，前端活）经主代理查清为派卡错位、**留在本分支正确位置**，不拆。

| # | 用例（农场原文） | 测试位置 | 被测实现（file:line） | 实现是否诚实 | 本机结果 |
|---|---|---|---|---|---|
| 55 | operations overview：activeSnapshot 会话行全字段映射（ticks null 原样透传，不伪造 0） | `shared/tests/contract-mappers.test.ts:242` | `shared/src/contracts/manage/operations/api.ts:325-326`（`positionTicks: r.positionTicks` 直传，无 `?? 0`） | ✅ 诚实 | ✅ PASS |
| 56 | operations overview：空快照（不伪造观测） | `:321` | `operations/api.ts:334-345`（缺段 → `{activeSessionCount:0, runningTasks:0, sessions:[]}`，与断言逐字一致） | ✅ | ✅ PASS |
| 57 | media-reviews list：18 字段逐字段映射（null 不归一 0/空串） | `:378` | `media-reviews/api.ts:93-100`（candidatesJson/claimedByUserId/… **直传**，全文件无一个 `?? 0/?? ''`） | ✅ | ✅ PASS |
| 58 | media-reviews claim/release/resolve：响应是 {item} 包装 | `:412` | `media-reviews/api.ts:152/159/167`（三处都 `raw.item` 解包） | ✅ | ✅ PASS |
| 59 | media-reviews providerSearch：candidates 9 字段映射 + q 别名发参 | `:431` | `media-reviews/api.ts:186`（`q: query.query`）+ `:195`（candidates 映射） | ✅ | ✅ PASS |
| 60 | operations overview：B2 段整段缺失 → 空快照兜底 | `:479` | `operations/api.ts:334-345`（同一兜底分支） | ✅ | ✅ PASS |

**判据（可复现）**：
```
cd shared && node --import ./tests/register-resolver.mjs --test tests/*.test.ts
→ ℹ tests 166  ℹ pass 166  ℹ fail 0      （W-A-RESUME 钉测试 +5 后；改前同树 161/161）
node --import ./tests/register-resolver.mjs --test tests/contract-mappers.test.ts
→ 16/16 PASS（复跑稳定）
```
**农场读数自相矛盾的证据**：farm3 报「shared 包 157 tests」—— 该提交的 shared/tests 实际含 **161** 个用例（26 文件逐文件计数，`contract-mappers` 16 个）。**4 条用例的差额只能来自「跑的不是这份测试集」**；6 条红恰好是「新严格断言 vs 旧归一化实现」的形态（见 §4.3 的 family 分析），最自洽的解释是**农场工作树混态**（新测试 + 旧实现，或旧测试 + 新实现——两种都能产生这个读数）。

**⇒ 需主代理投农场复跑取证**（§5），拿到 6 条的 assert 原文后再终审；在取证到来前，本报告按「不可复现 + 实现逐行诚实」定性为**非缺陷**，不改实现、不改这 6 条断言。

---

## 2. 追加卡：W-A-RESUME live bug（已修，commit `55c8c6a`）

### 2.1 病灶（两层都中，「前端跨仓两处」对应如下）
| 层 | 位置 | 病 |
|---|---|---|
| wire→domain | `shared/src/contracts/manage/media-items/api/mappers-enum.ts`（旧 `mapSourceStatus/mapMetadataStatus/mapMountStatus`） | 只认 V1 词表（playable/success/active/…）；后端真值 `mounted/identified/configured/verified/maintenance` **全部落 default** ⇒ domain 值直接被改成 `missing` |
| domain→文案 | `host/src/pages/manage/media-items/formUtils.ts`（旧 getSource/MetadataStatusLabel）+ `media-item-detail/formatters.ts getMountStatusLabel` | default → 「状态缺失/元数据缺失/挂载缺失」⇒ **每行说假话** |

**后端真值（当次核对，fmby-v2 main `7058761b30`）**：
- `source ∈ {mounted, missing}`（`catalog_repo/read.rs:195`、pg `catalog_repo.rs:251`）
- `metadata ∈ {identified, missing}`（`read.rs:202`、pg `:253`）
- `mount ∈ {configured, unavailable, maintenance, verified}`（**单一真源** `http/src/dto/manage.rs:188-202`；未挂载 wire=null → `convert.rs` 诚实缺省 missing）
- `/api/search` 筛选白名单：source=mounted|missing、mount=四值、metadata=identified|missing（`browse/query_mapping.rs:49-66`），**V1 值 400 fail-closed**（`search_route_tests.rs:532`）

### 2.2 修法（照卡：真实值补齐、default 保留 fail-soft、**顺带同族扫出 mount_status 同病一并修**）
- 三个 union 换成后端真值（`shared/.../media-items/types.ts`，附真源注释）；V1 死词表删除（tsc 强制全量迁移，杜绝残留）。
- fromWire：补 `mounted/identified/configured/unavailable/maintenance/verified` 各 case；default → `missing`（fail-soft）。
- 文案：`mounted→已挂载(success)`、`identified→已识别(success)`、`configured→已配置/verified→已验证(success)`、`unavailable→挂载不可用(danger)`、`maintenance→维护中(warning)`、`missing→来源缺失/元数据缺失/挂载缺失(neutral)`；default 仅对未知值 fail-soft。
- 下拉：来源/元数据状态各 **2 个真实选项**（全部状态 + mounted/missing、identified/missing）—— card 第 3 条 ✓。
- ToApi：`mapSourceStatusToApi('missing')` **不再吞成 undefined**（旧实现连「筛选缺失」都不发）；mount 的 missing 仍不发（/api/search mount 白名单无 missing，发了 400）。
- 钉测试：`shared/tests/media-item-status-mappers.test.ts`（5 条：已知值/未知值 fail-soft/ToApi）+ `host/tests/media-item-status-labels.test.ts`（4 条：文案+variant+mount 四值）。**9/9 PASS**。

### 2.3 同族扫结果（card 第 5 条）
| 发现 | 定性 | 处置 |
|---|---|---|
| `mount_status` 同病（FE 只认 active/disabled，后端四值全不认识） | **live bug 同族**（每行「挂载缺失」） | 本批已修 |
| `IdentityGovernancePanel` 仍收集并上送 `reason` —— 后端 `ManualMatchRequest` 无此字段（`application/media_identity.rs:35`），W-METAFAMILY 删了 FE 类型没清调用点 ⇒ **origin/main tsc 红 TS2353**（§4.1）+ 一个「填了也没用」的输入框 | 静默丢弃同族 + 类型红 | 本批已修（删输入框+字段，`52347e1` 同步 a11y 行号名单） |
| `mapping/records.ts:85` `usageLimit: raw.max_uses ?? 0` —— 0=「不限」的产品语义，缺失≠不限 | 待核（可能有意对齐 V1） | **未动**，报你裁 |
| `adminApiTokens/api.ts:19-22` `raw?.id ?? 0`（整对象缺失仍伪造 id=0 记录） | 可疑 | 未动（无测试无 UI 消费证据），建议下卡 |
| `identity/mappers.ts:57` `expiresAtMs ?? 0`（0=1970）| 有测试钉（identity-login:111,137）但钉的是「0」本身 | 登记观察 |
| `upstreams/api.ts:571` `total ?? items.length`（用本页行数伪造总数） | 可疑（分页语义失真） | 未动，建议下卡 |
| 正面样本：`casAdmin`（`types.ts:55/73` 明文「不得 ?? '' 渲染」） | 纪律已有先例 | —— |

---

## 3. host 2 条存量红（本机 origin/main 干净树实测，已修）

### 3.1 `tablewrap-region-audit`：名单漂移（**确定性，非负载**）
```
✖ FE-WEB-UI-A④：aria-label 名单（57 处…）— tableWrap 总数不符：实测 58 / 名单 57
```
干净差集（按 EXPECTED 数组精确解析）：**EXTRA** = `cas/DriveConfigTable.tsx::盘配置（CAS 矩阵）`（FE-CAS-G1 文件搬移，名单没跟）+ `task-center/components/AsyncJobsSection.tsx::后台任务`（死组件未登记表）；**MISSING** = `ManageCasPage.tsx::盘配置（CAS 矩阵）`（旧路径）。
**修**（`91debe0`）：名单跟随搬移 + 登记 AsyncJobsSection（注明 fedead 删卡合入后随删）+ 标题 57→58。**实跑 5/5 PASS**。

### 3.2 `table-row-keynav`：syncjobs 探针超时（**测试陈旧，非实现缺陷**）
```
✖ 契约改造（选项 2）：UpstreamSyncJobsSection 真实 Tab 起步…（page.waitForFunction 超时 20s）
```
- **两次确定性复现**（全量跑一次 + 单文件复跑一次，均 ~24s 超时）⇒ 排除负载偶发。
- 根因：组件的 Emby 导入块由 license visibility『upstream-emby』**付费闸**门控（W5-D/#2032，`UpstreamSyncJobsSection.tsx:74-88,212-218`）；探针 stub 没接 `/license/status` ⇒ `{}` → `mapStatus` 对缺失字段 throw（`runtime_state` 未知值 / `entitlements.map` / `usage.user_count`）→ 免费基线 fail-closed ⇒ 第二张 tbody 永不挂载。
- **修**（`188f8cb`）：探针补最小合法 license stub（`runtime_state:'active'` + `usage:{}` + `entitlements:[]` + `summary.visibility.upstream_emby:true`）。**实跑 65/65 PASS**。

---

## 4. verify job 核查（card 第 4 条）+ 一个必须更正的旧结论

### 4.1 ★勘误与真相：TS2353 是**分支内瞬态**，main 本身 tsc 绿
- 时间线：本分支在 18:37 被写入了一个**非本卡提交** `ec08e65`（W-METAFAMILY：删 `ManualMatchMediaItemIdentityRequest` 的幻觉字段 `reason?` + mapper 容错化 + 契约测试扩展；作者身份=本席，非本会话所做 —— ★报主代理： fe-red 分支携带了该卡工作，是否拆分由你裁）。它删了类型字段但没清 `IdentityGovernancePanel` 调用点 ⇒ 分支内 TS2353（EXIT=2）。
- 本卡已修：删调用点死字段 + 死输入框（`52347e1` + a11y 名单行号同步），分支终态 **EXIT=0**。
- **撤回我此前的怀疑**：用临时 worktree 实证 `99acc73` 的 tsc = **EXIT=0**（干净），故 W-FEDEAD 报的 EXIT=0 **可信**，非 tsbuildinfo 假绿。教训仍保留：关键绿要能复跑。
- 工作树终态健康实证：shared 166/166、host 895/895、themes 22+9、tsc 0。

### 4.2 verify job 会拦住什么
- 根 `package.json`：`verify` 链含 `pnpm test`；`test` = `pnpm -r test` = **shared(166) + host(895) + darkroom(22) + _template(9)** 四包（themes 也有 test 脚本，已实测）。
- ⇒ ① farm 报的 6 条（若在任何树上是真红）会拦 PR；② 我实测的 host 2 红在修复前也会拦 PR；③ tsc 在 verify 链第 2 位 ⇒ main 的 TS2353 也会拦 —— **本分支把这 3 条全修了，verify 落地当天不应红**（以农场复跑为准）。
- job 配置无漏：`pnpm -r` 覆盖全部 4 个含 test 脚本的包，无「只跑部分包」问题。

### 4.3 同族排查：映射类用例「只测 happy path / 断言过弱」清单（card 第 3 条）
| 文件 | 用例数 | 评价 |
|---|---|---|
| `shared/tests/contract-mappers.test.ts` | 16 | **强**（逐字段 + null 语义 + 缺段兜底 + ToApi 别名），是全包范本 |
| `shared/tests/media-reprocess.test.ts` | 4 | **强**（18 字段对拍、null 保留、枚举 PascalCase 保留、RED→GREEN 注记） |
| `shared/tests/manage-media-items-detail-wire.contract.test.ts` | 4 | **强**（BE 真实 wire 冻结 + 幻觉字段删除登记） |
| `shared/tests/rewards-self.test.ts` | 3 | 强（account=null 不伪造 0） |
| `host/tests/a11y-static-contract.test.ts` | 行号锚定名单 | **脆**（行号漂移即红，本卡已遇；建议改「按 aria-label 文本锚定」——已登记建议，未动） |
| `host/tests/tablewrap-region-audit.test.ts` | 5 | 强（双向 diff + total 反逃逸），但名单需随文件搬移维护（本卡已修一次） |
| 其余映射面（`mapping/mounts.ts:44,96`、`mapping/records.ts:85,155`、`adminApiTokens/api.ts:19-22`、`identity/mappers.ts:57`） | **无 null 语义钉测试** | 见 §2.3 表 —— 这些归一化写入无对拍，是下一批「同族缺口」 |

---

## 5. 需主代理投农场

「**需主代理投农场**：建议命令 `FMBY_ORCHESTRATOR=1 bash scripts/farm.sh seat/rv3/fe-red test --node farm3`」
判据与取证要求：
1. **先取证再跑**：`node -v`、`git rev-parse HEAD`、`git status --porcelain`、`git -C . diff --stat HEAD -- shared/ | tail -3`（钉死上次 157≠161 的混态来源）。
2. `pnpm -r test`：期望 **shared 166/0 fail、host 895+/0 fail、darkroom 22、_template 9**；若 shared 那 6 条再现 ⇒ 贴 6 条的 assert 原文（actual/expected），我按证据终审。
3. `pnpm repo-size`：**exit 0**（837.2 KiB，本机已验）。
4. `pnpm --filter @fmby/v2-host typecheck`：**exit 0**（本分支已修 main 的 TS2353 存量红）。

---

## 6. 本机验证汇总（当次原文要点）

- shared：`161/161 → 166/166`（+5 钉测试）绿。
- host：首跑 `891/889/2 fail`（tablewrap + keynav，均本报告 §3）→ 修后全量 `895/894/1 fail`（a11y 行号名单，我删输入框的行号漂移，已修）→ **终跑 `895/895/0 fail，EXIT=0`**（含新增 4 条状态文案钉测试）。
- themes：darkroom 22/22、_template 9/9（先前红为本席缺 node_modules 链接，环境性）。
- `tsc -p tsconfig.app.json --noEmit`：main 上 **EXIT=2（存量 TS2353）→ 本分支 EXIT=0**。
- `node scripts/check-repo-size.mjs`：PASS 837.2 KiB（fedead 分支成果，本分支未动 PNG）。

## 7. 未做 / 边界

- farm 那 6 条的最终定论**等复跑取证**（本报告先按不可复现+实现诚实定性，未改那 6 条的任何代码/断言）。
- §2.3 的三个 UNPINNED 归一化（usageLimit/adminApiTokens/upstreams total）**未改**（无产品裁定，怕修错语义）；建议下卡。
- `host/tests/a11y-static-contract` 的行号锚定脆性**未重构**（只修了行号）；重构属测试基建卡。
- 本机 `pnpm verify` 全链未跑（含 build，58 禁）；农场/CI 判据见 §5。
