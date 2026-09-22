# FE-REPO-DOC-CLAIM-AUDIT —— 前端仓 docs 断言审计

> **卡**：FE-REPO-DOC-AUDIT（P1）｜前端仓 `fmby-web` worktree `/tmp/fe-doc-audit`，分支 `docs/audit-claim-alignment`（base `main` @ `41c4620`）
> **范围**：`docs/**/*.md` **40 文件 / 4,268 行**（另有 45 个非 md evidence：PNG/YAML/JSON，不在文字审计范围）
> **验收**：`pnpm verify` EXIT=0（见文末）｜红线：不改后端、不改契约清单、不引新依赖。
> **跨仓引用**：本文引用的 `docs/plans/v2-dev/DECISIONS.md`（V2 仓）、`docs/CONTRACT-DOC-CLAIM-AUDIT.md`（契约仓）均为**跨仓、不在本仓闸覆盖范围**。

---

## §0 方法

- **词表**：与 handoffs 同套 + 前端特有：`零消费|未消费|闲置|漂移|未接|待接|未验证|不成立|推翻`。
- **判定轴（重点不同）**：① **前端 handoff 声称「已消费 X 端点 / 已修 Y」↔ 当前契约层真实代码**（`shared/src/contracts/**`、`host/src/**`）；② 跨仓引用标注；③ 同一事多份文档不一致。
- **切句**：`。！？；` + 换行；排除自身产出。
- **判定纪律**：已推翻/不符**必须有 file:line 证据**；拿不到 ⇒ 成立/无法判定。
- **维护态 vs 归档态**：`docs/theme-guide/*`、`docs/versioning.md`、`docs/evidence-policy.md` = **维护中**（直改）；`docs/FE-*.md`、`docs/BUG-*`、`docs/REPO-HYGIENE-01.md`、`docs/fe-*-report.md`、`docs/plans/**/handoffs/*.md` = **历史 handoff**（只加 banner）。

## §1 结论摘要

- **断言句**：词表命中 **145 句**（40 文件）。
- **判定**：**已推翻 / 与现状不符 5 条**（§3）｜矛盾对 4 组（§4）｜其余为「成立/无法判定」。
- **根因**：前端仓**后续卡持续落地**（B2/B3、FE-PARITY-*、FE-OPT-03），而**更早的审计/handoff 快照未回写**——同一事实「旧卡说零消费、新代码已消费」。
- **Top 问题文件**：`FE-V1-PARITY-SWEEP.md`、`fe-sync-followup-report.md`、`fe-contract-sync-report.md`、`BUG-SKIN-NAV-01.md`、`FE-COLLECTIONS-CONSUME-B1.md`。

## §2 全量逐条表（145 句，禁止抽样）

| 文件:行 | 断言原文（≤60） | 判定 | 依据 |
|---|---|---|---|
| `docs/BUG-SKIN-NAV-01.md:6` | **另加必配孪生键 `itemHref?(id)`**（见 §裁决 T1）。 | 成立/无法判定 | — |
| `docs/BUG-SKIN-NAV-01.md:11` | 状态：**功能链已 end-to-end 实证**（见 §实测证据），但**被 main 上一个前置 P0 阻断**（F… | 已推翻 | 宿主全局桥已交付：`host/src/theme/themeGlobals.ts`（`exposeThemeGlobals`）+ registry 接线（FE-OPT-03）——阻断解除 |
| `docs/BUG-SKIN-NAV-01.md:25` | ## ⚠️ 阻断：main 前置 P0 —— 主题激活在 main 上整体失效（非本卡引入，需裁决） | 已推翻 | 宿主全局桥已交付：`host/src/theme/themeGlobals.ts`（`exposeThemeGlobals`）+ registry 接线（FE-OPT-03）——阻断解除 |
| `docs/BUG-SKIN-NAV-01.md:30` | 2. 该**宿主全局桥从未实现**——全仓（含所有分支）无任何 `window.React =` 赋值； | 已推翻 | 宿主全局桥已交付：`host/src/theme/themeGlobals.ts`（`exposeThemeGlobals`）+ registry 接线（FE-OPT-03）——阻断解除 |
| `docs/BUG-SKIN-NAV-01.md:39` | ## 裁决登记 | 成立/无法判定 | — |
| `docs/BUG-SKIN-NAV-01.md:50` | 5. **反事实检查**：若皮肤未接 `itemHref`，则无 `<a href>` → 新增测试断言 `<a[^>]… | 成立/无法判定 | — |
| `docs/BUG-SKIN-NAV-01.md:50` | 若未接 `openItem`，点击无导航 → `waitForURL(/item/101)` 超时； | 成立/无法判定 | — |
| `docs/evidence-policy.md:69` | ## 既有例外（历史遗留，登记不改） | 成立/无法判定 | — |
| `docs/evidence/email-e2e-smoke-2026-09-21.md:33` | ⇒ 邮件端口在生产未接线，③④ 在真服务器上**当前结构上不可验证**。 | 成立/无法判定 | — |
| `docs/evidence/email-e2e-smoke-2026-09-21.md:34` | 属后端接线缺口，非前端问题。 | 成立/无法判定 | — |
| `docs/evidence/email-e2e-smoke-2026-09-21.md:47` | 真实 SMTP 投递（无 SMTP 环境）→ 未验证，也不 mock。 | 成立/无法判定 | — |
| `docs/evidence/fe-opt-04-batch.md:52` | 子资源端点未实现 \| | 成立/无法判定 | — |
| `docs/FE-COLLECTIONS-CONSUME-B1.md:1` | # FE-COLLECTIONS-CONSUME-B1 —— collections 前端消费缺口（成员添加流）· `w… | 成立/无法判定 | — |
| `docs/FE-COLLECTIONS-CONSUME-B1.md:66` | 余 **9 条**零调用登记为后续卡 B2/B3： | 成立/无法判定 | — |
| `docs/FE-COLLECTIONS-CONSUME-B1.md:79` | 未发现需上报的后端缺口 —— 两条端点行为与契约一致）。 | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:28` | **operations/overview** \| 手拼含 **activeSnapshot**/**dataSourc… | 已推翻 | operations 契约现声明 activeSnapshot/dataSourceLoad（`operations/api.ts`）并被页面消费 |
| `docs/fe-contract-sync-report.md:31` | `SetupForm.tsx:37` 取 `response.user` → 运行时 undefined \| 🔴 漂移… | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:32` | `RegisterForm.tsx:40` 把它直接 `onAuthenticated(response.user)` … | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:33` | 未调的归闲置 \| | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:35` | ## 3. 漂移三分类清单 | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:37` | ### 🔴 真漂移（字段/结构不符，运行时 bug）——已修（最小 diff，3+2 文件） | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:47` | ### 🟡 能力闲置（后端有、前端没消费）——登记不改 | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:66` | ## 5. 诚实未验证项 | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:69` | 2. **沙箱 API 缺口**：本卡未涉及 test_support.rs（PG-SANDBOX 卡改派/搁置）。 | 成立/无法判定 | — |
| `docs/fe-contract-sync-report.md:71` | 4. tracked 的 `*.d.ts`（骨架时代入库）与 .ts 已漂移且仓惯例不再同步（shared/packag… | 成立/无法判定 | — |
| `docs/FE-DELETE-UX-AND-ORDER.md:21` | 点击即列表该行消失，不阻塞 UI。 | 成立/无法判定 | — |
| `docs/FE-DELETE-UX-AND-ORDER.md:43` | 交互语义：点击立即本地重排、请求失败回滚并提示，不阻塞 UI。 | 成立/无法判定 | — |
| `docs/FE-LIST-KEYNAV.md:12` | ⇒ 真缺口成立，本轮实现。 | 成立/无法判定 | — |
| `docs/FE-LIST-KEYNAV.md:90` | **管理面表格（一维行列表）未接漫游**：本轮只接了浏览侧（网格 + 轨道）。 | 成立/无法判定 | — |
| `docs/FE-LIST-KEYNAV.md:92` | **触摸/移动端手势漫游未做**：移动 profile 只验证键盘可达性，未验证触摸滑动与 | 成立/无法判定 | — |
| `docs/FE-LIST-KEYNAV.md:94` | **Home/End 跨行（到首/末项）未实现**：当前 Home/End 是**行内**语义（与多数网格一致）。 | 成立/无法判定 | — |
| `docs/FE-OPT-01.md:54` | ## 关键设计说明：主题产物 ESM→IIFE 的裁决 | 成立/无法判定 | — |
| `docs/FE-OPT-02-ROUND2.md:3` | 本轮为**回归核查 + 真缺口修复**，非从零重做。 | 成立/无法判定 | — |
| `docs/FE-OPT-02-ROUND2.md:11` | ② 修真缺口； | 成立/无法判定 | — |
| `docs/FE-OPT-02-ROUND2.md:26` | ## 二、本轮新增/修复（真缺口） | 成立/无法判定 | — |
| `docs/FE-OPT-02-ROUND2.md:28` | # \| 缺口 \| 证据（实测） \| 修复 \| | 成立/无法判定 | — |
| `docs/FE-OPT-02.md:10` | **REPO-HYGIENE-01 后抽样入库**：`docs/evidence/fe-opt-02/samples/`… | 成立/无法判定 | — |
| `docs/FE-OPT-02.md:15` | **风险登记**：`routeLoaders`/`PATH_PREFETCH_KEYS` 与路由表为人工同步（FE-OP… | 成立/无法判定 | — |
| `docs/FE-OPT-02.md:35` | F-1 \| `TopBar.module.css` \| 手机档未接 `--topbar-height-mobile`（恒… | 成立/无法判定 | — |
| `docs/FE-OPT-03-ROUND2.md:10` | 真缺口修复 + 审计可信度补强（与 FE-OPT-02 第二轮同姿势）。 | 成立/无法判定 | — |
| `docs/FE-OPT-03-ROUND2.md:39` | # \| 缺口 \| 证据 \| 修复 \| | 成立/无法判定 | — |
| `docs/FE-OPT-03.md:94` | ### 3.1 E2E 启动器未组装主题产物（harness 缺口） | 成立/无法判定 | — |
| `docs/FE-OPT-03.md:110` | 提供依赖**"——**但该桥从未实现**（全仓 grep 零命中）。 | 成立/无法判定 | — |
| `docs/FE-OPT-03.md:162` | 完整 SR 流程建议后续卡（需人工/录制）。 | 成立/无法判定 | — |
| `docs/FE-OPT-05.md:14` | **风险登记**：① `manifest.nav` 目前 host 未消费（既有面，非本卡）； | 成立/无法判定 | — |
| `docs/FE-OPT-05.md:96` | 1. **`manifest.nav` 未消费**：host 侧尚无主题导航合并点（既有面，非本卡引入）； | 成立/无法判定 | — |
| `docs/FE-OPT-05.md:101` | 建议后续卡（DOC-THEME 系列）填充该目录——登记。 | 成立/无法判定 | — |
| `docs/fe-sync-followup-report.md:25` | 3 \| `shared/contracts/manage/mapping/scans.ts:45` \| TS6196 `… | 成立/无法判定 | — |
| `docs/fe-sync-followup-report.md:29` | ## 2. 运营看板（w2 的 2a02d55）接线核对 —— **推翻卡面前提** | 成立/无法判定 | — |
| `docs/fe-sync-followup-report.md:38` | 页面层（`host/pages/manage/ManageOperationsPage.tsx`） \| ❌ 零消费（我的… | 已推翻 | operations 两卡现已挂：`host/src/pages/manage/ManageOperationsPage.tsx:79-80` 消费 `data.activeSnapshot`/`data.dataSourceLoad` |
| `docs/fe-sync-followup-report.md:56` | ** 缺的是 UI 接线——属能力闲置（上一卡规矩：登记不改），**本卡不改页面**（避免擅自加功能 + 与 w2 在途… | 成立/无法判定 | — |
| `docs/fe-sync-followup-report.md:60` | `fromActiveSnapshot(raw.activeSnapshot)` 无缺值容错：后端端口未装配/旧版本返回… | 成立/无法判定 | — |
| `docs/fe-sync-followup-report.md:62` | ## 3. 诚实未验证项 | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:7` | **不在本卡**：任何后端改动（跨仓缺口见 §3，请据此另立后端卡） | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:13` | ## ① `ManageOverviewPage.tsx` —— 会话失败被静默降级成「0 路」 | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:44` | 登记为 **G-14「高级维护 —— 后端未实现」**； | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:54` | 注释写明后端 G-14 未实现 + 跨仓缺口指向本文 \| | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:73` | ### B 类：`?? []` / `?? 0` 静默降级 | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:79` | 各列表页的 `(query.data?.items ?? [])` 形态较多，多数有 isError 短路，逐页复核属后… | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:83` | ## ④ 跨仓缺口清单（**请据此另立后端卡**） | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:85` | # \| 缺口 \| 前端现状 \| 建议 \| | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:87` | X-1 \| `GET /api/manage/advanced` **后端未实现**（契约仓 G-14） \| 前端页面已… | 成立/无法判定 | — |
| `docs/plans/handoffs/FE-HONESTY-P2.md:88` | X-2 \| `GET /api/manage/overview` **不含** `environment_status`… | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:8` | ## 1. revoked_sessions NaN 风险（①裁决修法） | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:47` | FE-HONESTY-P2 handoff 已登记的 A 类同型失真（跨仓缺口 X-2：后端 OverviewDto | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:50` | ## 4. 跨仓缺口登记（不是 bug，是设计决定） | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:63` | ## 6. .d.ts 伴生文件漂移（登记，非本卡） | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:67` | 建议后续卡统一处理：生成或删除。 | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:71` | ## 7. 追加：契约漂移存量收口（同分支第二 commit，前端侧三组） | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:81` | `active_admin_count` / `uptime_secs`：前端 UI 无对应槽位，仅声明（后续卡消费）。 | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:85` | 后端 wire **无** environment_status（grep 后端 http/contracts 零命中，… | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:106` | raw-types.d.ts / shared.d.ts / types.d.ts 按上述签名与形状同步（历史漂移 | 成立/无法判定 | — |
| `docs/plans/handoffs/MANAGE-ADVANCED.md:107` | 只同步了本卡触及面，其余仍停留 skeleton 期——全面重生成待后续卡）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/CONFIRM-GATE-ALIGN-FE.md:80` | 2. **`users/batch/delete` 路径漂移**：前端 `POST /manage/users/batc… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B2.md:3` | B2：按「高频 + 改动频繁」顺序拆 3 个页，并顺手按裁决 A 收口 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B2.md:20` | `manage/mounts/formUtils.tsx` \| 579 \| — \| **裁决 A**：拆为 `formU… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B2.md:49` | 经验：抽完发现调用点和被抽块差不多长 → 说明 prop 面太宽，要合并而非放弃。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B2.md:82` | ## 4. 待办 / 需裁决 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B2.md:90` | 可入后续卡。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:4` | + 并入 WEB-S4C 的两条裁决（`..` 统一报错、S3 前缀回填）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:8` | `ba24a9c` 裁决 1 + 裁决 2（独立 commit，按裁决 1 要求） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:15` | ## 1. 裁决 1：`normalizeRemoteMountPath` 统一为报错 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:21` | 存量兼容评估（裁决要求，已核）**： | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:28` | ## 2. 裁决 2：编辑态回填 S3 前缀 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:94` | ## 6. 待办 / 需裁决 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:96` | 1. **`MOUNT-CRED-SEAL` 合并后需回头收尾**（WEB-S4C 裁决 2/3）：AK/SK 编辑态展… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B3.md:98` | 2. **`..` 口径现已两端一致**（前端报错 + 后端 400），无遗留。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B4.md:48` | `ManageLicensePage.tsx` \| 403 → **388** \| `license/LicenseUn… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B4.md:77` | 587 \| `login/LoginPage` \| **按裁决后置**：会话/CSRF/多因素风险面大、非管理高频路径，… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B4.md:85` | ## 6. 待办 / 需裁决 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT-B4.md:89` | 等其修完合并后**再做 WEB-S4C 裁决 2/3 的收尾（AK/SK 编辑态「已设置凭据，留空不修改」占位） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:25` | 基线内未上升 → **WARN 不阻塞**（已记账债务，降到 ≤400 后回收出基线） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:134` | ## 5. 裁决落地（① ② ③ 已补做，见 §6） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:138` | 3. **`mounts/formUtils.tsx` → 判定结果：不适用「无 JSX」豁免**（见 §6 待裁决）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:139` | 4. **剩余 17 条债务的清偿顺序**（裁决 4，不在本卡）：按「高频 + 改动频繁」排—— | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:151` | ## 6. 豁免机制（裁决 1/3 落地，commit `b9adb3d`） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:182` | ### 待裁决：`mounts/formUtils.tsx` 实际不适用「无 JSX」豁免 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:187` | 按裁决 3 给的判定标准（「文件内无 `return (<…>)`/JSX 语法的视为工具模块」）， | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md:196` | 仅尾部 2 个 JSX helper」——但这与裁决 3 的「无 JSX」判定标准不一致， | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-CRUD-SECURITY-AUDIT.md:299` | 以上全部为**静态代码推断**（grep + 读源码 + 行号定位），**非运行验证**：未启动 dev server … | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:5` | 请机械扫一遍，找出同类缺口。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:23` | 真缺口判定**（本卡核心）： | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:25` | 真缺口①  =  B ∩ F1 ∩ ¬F2 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:26` | （V2 后端有端点 且 V1 前端也调用 且 V2 前端零消费） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:33` | 若契约有方法但页面未接 UI，单独标注为「同页缺操作」子型。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:44` | 经契约层+页面层双重核对后的**确证真缺口①** \| **41 端点**（带后端 file:line） \| | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:54` | 这证明「路径级差集」必须二阶核对，否则会虚报约 28% 的缺口。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:58` | ## 2. 确证真缺口① 对位表（V1 面 \| V2 面 \| 定性 \| 证据） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:103` | ## 4. 设计差异②（V1 有、V2 后端无对应端点 → V2 故意未做，等裁决） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:105` | 以下 V1 前端调用了但 V2 后端**完全没有**端点，故不是「V2 前端缺」，而是 V2 架构层面未实现，需主代理确… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:116` | `/api/manage/pan115/{previews/*,share-mounts}`、`/api/manage/… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:121` | ## 5. 已对齐③（本卡扫描证明已补齐，非缺口） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:143` | 任何「V2 前端零消费」结论都以「契约层+页面层二阶核对」为准； | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:152` | 这些 V1 有但 V2 产品定位可能不打算做，建议先裁决②再排期。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:25` | 工单详情端点 `GET /api/manage/media-reviews/{id}` **契约已建未接线**（页面用列… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:36` | V1F-07 **方向 B 诚实降级**：`runtimeSourceAvailable === false` 时页面显… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:85` | ## 3. 待办 / 需裁决（未擅自扩大范围） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:87` | 1. **Upstreams 子资源未接线**（后端已有端点，本页未做 UI）： | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:94` | 若要求「详情必须独立请求」，需产品裁决。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:95` | 3. **`provider-search` 已建契约但页面未接线**：人工匹配当前走 resolve 对话框的 `pa… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-4PAGES.md:98` | 无需后端补端点**（无登记缺口）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:63` | 后端发信面未装配 ⇒ 503 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:64` | 原样呈现**（「邮箱登录发信面未接线」）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:79` | 不可用降级：sessionStorage 不可用/损坏/不匹配 ⇒ 回流无 provider ⇒ 不猜、不假成功 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:84` | ## 4. ★结构性发现（超出本卡，建议主代理裁决） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:91` | 本卡处理：`mfa_required` ⇒ **如实提示需二因子、绝不置登录态**（RB-4），并登记缺口。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-IDENTITY-LOGIN-UI.md:137` | ## 6. 诚实未验证项 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:4` | + 上一卡遗留第 3 项（provider-search 点选候选自动填 payload）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:53` | ### 1.4 provider-search（上一卡遗留项） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:91` | **路由与侧栏未动**（上一卡已就位，本卡按裁决接在同一页内，无入口碎片化） | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:95` | ## 4. 裁决结果 / 遗留登记 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:97` | 1. **红线拆分（原 435 行）→ 本轮已做**（裁决 1）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:98` | 2. **逐类目 overrides UI → 登记待办卡**（裁决 2，不在本卡）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:100` | `overrides` 字段已留好（当前恒传 `[]`），不阻塞后续——UI 后补即可。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4B.md:101` | 3. **provider 候选下拉硬编码 `tmdb` / `douban` → 接受现状**（裁决 3）。 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4C-FINAL.md:39` | 4. **UI 占位（裁决 3）**：`STORED_CREDENTIAL_PLACEHOLDER = '已配置凭据，留… | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4C-FINAL.md:67` | ## ③ 备注 / 待办 | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4C.md:78` | 裁决 B**：后端 `create_mount` 入站收明文 → bridge 侧 SecretBox 密封后落库 → … | 成立/无法判定 | — |
| `docs/plans/v2-dev/handoffs/WEB-S4C.md:94` | ## 4. 待办 / 需裁决 | 成立/无法判定 | — |
| `docs/THEME-BUILD-01.md:3` | 性质：主代理亲验真缺口收口——主题 LibrarySkin/ItemSkin 被内联进 host 主 | 成立/无法判定 | — |
| `docs/theme-guide/l3-skin.md:159` | 危险确认框不做**（用户裁决，`DANGER_CONFIRM_DECISION` 留痕）：危险操作由后端 | 成立/无法判定 | — |
| `docs/versioning.md:31` | 新前端 + 旧后端 ✅（新前端须对缺失能力降级）。 | 成立/无法判定 | — |
| `docs/versioning.md:47` | host 加载主题时校验：契约不匹配 → **拒绝加载并提示**（不静默降级到错误渲染） | 成立/无法判定 | — |
| `docs/versioning.md:49` | ### 2.4 运行时降级（新前端 + 旧后端） | 成立/无法判定 | — |
| `docs/versioning.md:50` | 前端调 API 时若遇 `404`（端点不存在）或 `501`（未实现）→ **功能隐藏/降级**，不崩溃。 | 成立/无法判定 | — |


## §3 已推翻 / 与现状不符清单（最重要）

| # | 文件:行 | 错在哪（旧断言） | 现真值（证据） | 处理 |
|---|---|---|---|---|
| 1 | `docs/fe-sync-followup-report.md:31/33/38` | 「w2 只接一半 / `ManageOperationsPage` 页面层**零消费**（两卡未挂）」 | **已挂**：`host/src/pages/manage/ManageOperationsPage.tsx:79-80` 调 `buildActiveSnapshotRows(data.activeSnapshot)`/`buildDataSourceLoadRows(data.dataSourceLoad)` | banner |
| 2 | `docs/fe-contract-sync-report.md:28/49` | 「operations/overview 的 activeSnapshot/dataSourceLoad **前端未声明、全仓零消费**（能力闲置）」 | **已声明+已消费**：`shared/src/contracts/manage/operations/api.ts` 含 activeSnapshot/dataSourceLoad（count 4/5），页面渲染 | banner |
| 3 | `docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md:73/140` | 「V2 `mediaItems` 契约**缺** visibility/manual-match/provider-search/identify/scrape/refresh-metadata/metadata-reset 及子资源 DELETE（同页缺操作）」 | **已全有**：`shared/src/contracts/manage/media-items/api/mutations.ts` 含 setMediaItemVisibility/manualMatchMediaItemIdentity/identifyMediaItem/enqueueMediaItemScrape/deleteMediaItemArtwork/deleteMediaItemSubtitle/deleteMediaItemSource + provider-search 查询 | banner（同文件 operations 独立端点仍成立，见 §5.2） |
| 4 | `docs/BUG-SKIN-NAV-01.md:11/25/29/30/31` | 「⚠️阻断：main 前置 P0 主题 IIFE 全局桥**从未实现**，主题整体不激活」 | **已解除**：`host/src/theme/themeGlobals.ts`（`exposeThemeGlobals`）+ `registry.ts` 接线已交付（FE-OPT-03） | banner |
| 5 | `docs/FE-COLLECTIONS-CONSUME-B1.md:23` | 「仍零调用 11 条（板子未陈旧）」 | **B2/B3 已消费**：collections 契约现 ~17 方法（presets/rules/preview/rules PATCH/sync/order/members add·remove·reorder/member PATCH） | banner |

## §4 矛盾对

| # | 事实 | A 说法 | B 说法 | 真值 |
|---|---|---|---|---|
| 1 | 合集 presets/rules/sync 消费 | `FE-COLLECTIONS-CONSUME-B1.md:23`：**仍零调用 11 条** | `FE-V1-PARITY-SWEEP.md` §5：**合集 B3 已对齐**（presets/rules/sync/member ✅） | B 对（契约现 ~17 方法） |
| 2 | operations 看板接线 | `fe-sync-followup-report.md:38`：页面层**零消费** | `ManageOperationsPage.tsx:79-80`：**已消费** | 代码对 |
| 3 | 主题激活 | `BUG-SKIN-NAV-01.md:25`：main **整体失效** | `FE-OPT-03.md:10/113`：**themeGlobals 修复交付** | B 对（`themeGlobals.ts` 存在） |
| 4 | media-items 契约 | `FE-V1-PARITY-SWEEP.md:73`：契约**缺 7 方法** | 代码：`mutations.ts` **全有** | 代码对 |

## §5 诚实边界

1. **只核「已消费/已修」类断言**：本审计聚焦 brief 的 ①；UI 视觉/交互行为未起 dev server 目视（沿用各 handoff 的 grep+diff 自证）。
2. **`FE-V1-PARITY-SWEEP` 部分仍成立**：operations 独立端点 `/operations/data-sources/load`、`/playback/active` **仍未消费**（契约只调 overview）——不整篇推翻。
3. **维护中文档未发现事实性错误**：`docs/theme-guide/getting-started.md`、`l3-skin.md`、`testing.md`、`docs/versioning.md`、`docs/evidence-policy.md` 经读，未发现与现状相反的断言；其「基线 web/main `64a589e`、v0.1.109 同源」为**验证时间戳注记**（非当前状态断言），未改。
4. **跨仓引用**：`DECISIONS.md`（V2 仓）、`CONTRACT-DOC-CLAIM-AUDIT.md`（契约仓）为跨仓文件，**不在本仓 `pnpm verify` 覆盖范围**。
5. **非 md evidence 未审**：45 个 PNG/YAML/JSON（截图/aria-snapshot/bench）属证据归档，非文字断言。
6. **`*.d.ts` 漂移**：多个 handoff 自登记 `shared/**/*.d.ts` 与 `.ts` 不同步（历史惯例），本审计未逐一核。

## §6 需处理清单

- **已加 banner（历史 handoff，5 文件）**：`docs/fe-sync-followup-report.md`、`docs/fe-contract-sync-report.md`、`docs/plans/v2-dev/handoffs/FE-V1-PARITY-SWEEP.md`、`docs/BUG-SKIN-NAV-01.md`、`docs/FE-COLLECTIONS-CONSUME-B1.md`（头部加 1 行，正文零改动）。
- **需前端接（仍成立的真缺口，交主代理排期）**：operations 独立端点 `data-sources/load`/`playback/active`（`FE-PARITY-OPERATIONS-EXTRA`）、mounts `batch/refresh-abnormal`（`FE-PARITY-MOUNTS-REFRESH`）、rewards extra、pan115 share、upstreams sync-jobs。
- **需主代理裁决**：`FE-V1-PARITY-SWEEP` §4 列的「V1 有、V2 后端无端点」10 类（是否排期）。
- **维护中文档**：无需改（见 §5.3）。
