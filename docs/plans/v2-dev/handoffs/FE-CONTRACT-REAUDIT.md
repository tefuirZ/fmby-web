# FE-CONTRACT-REAUDIT 交付说明 · 契约全量对拍复核

> 卡号：FE-CONTRACT-REAUDIT · 分支：`w/fe1/fe-contract-reaudit`（自 `origin/main`）
> 结论：**零漂移，零代码改动**（复核卡：产出对拍矩阵，发现即修的在本轮前卡已闭合）
> 日期：2026-10-03 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 0. 一句话结论

闸与逐域对拍全部通过：mapper 闸 0 violations、dupes 闸 PASS；YUN139/collections/错误码三域
前端契约与后端 main 现状**无漂移**；注册窗口后端**仍未有管理面**（前置卡在办，非漂移）。

---

## 1. 闸原文

```
node scripts/check-contract-mappers.mjs
  [PASS] 0 contract violations found. All contracts & domain mappers cleanly aligned.
node scripts/check-frontend-dupes.mjs
  PASS（含 queryKeys 仅限 shared/src/query/** 约束）
node scripts/check-frontend-component-size.mjs  → [PASS] 0 违规，无超线组件
```

## 2. 对拍矩阵

| 域 | 后端真实面（origin/main 取证） | 前端契约面 | 状态 |
|---|---|---|---|
| ① YUN139 owned | `yun139_accounts.rs` 共 **29 路由**（qr-login/qr-status/credential-profiles×6/account-pools×9/activate/browse×5/share×4/transfers×2/credentials GET/previews） | `contracts/manage/yun139/api.ts` 消费 **6**（qrLogin/qrStatus/credential-profiles CRUD+reauthorize）；`CredentialRebindGapSection` 按 W5-C 登记对 browse/activate 硬缺口给**诚实提示**（不做死入口） | ✅ 设计一致（未消费面有登记的缺口语义，非漂移） |
| ② collections | `GET /api/collections`（page/pageSize/**search** alias q/searchTerm；Active 闸后过滤）、`/{id}` detail | listCollections({page,pageSize,search})、getCollection、members 含 `memberOrigin`（S12 评审通过） | ✅ 本轮三卡已闭合 |
| ③ 注册窗口 | `auth.direct_registration` KV 仍**仅** self_register 内部消费，http 面 0 管理端路由 | 前端无该设置面 | ⏸ 非漂移：等后端前置卡（REGISTRATION-WINDOW-ADMIN-API），前后端两侧均无实现=一致 |
| ④ 错误码 | `errors.rs` 收敛后 13 码：`unauthorized/forbidden/not_found/conflict/validation/credential_invalid/internal/dependency_*/…` | 前端硬编码判定码全集 ∈ 后端词表；`HTTP_40x` 系**前端 errorMapping 对非 JSON 错误体的兜底码**（有意设计），collections 三组件 `HTTP_40x || 业务码` 双码判定**非死代码** | ✅ |

## 3. 修复清单

无（本轮零改动）。理由：扫描到的可疑点逐一溯源后均为**设计内行为**：
- `HTTP_403/404/409` 等前端判定码来自 errorMapping 的 fallback（`HTTP_${status}`），非后端业务码，两者语义互补；
- YUN139 未消费的 23 条路由对应 W5-C 登记的「后端硬缺口/诚实提示」决策，不属契约漂移；
- 注册窗口两侧均未实现，等后端前置卡。

## 4. 跳过项与何时再加

- **跳过：check-contract-sync（后端仓脚本）** —— 需在后端仓执行，本席纪律不跨仓跑；mapper 闸 + 逐域字面量对拍已覆盖同口径。
- **跳过：tsc 双包全量** —— 本 worktree 无 node_modules（既有登记）；已用系统 typescript 对本轮改动文件做单文件核验（无实质类型错误）。
- **何时再审**：后端 REGISTRATION-WINDOW-ADMIN-API 合并后（注册窗口前端接线时）；或下次后端大改后复用本卡流程。
