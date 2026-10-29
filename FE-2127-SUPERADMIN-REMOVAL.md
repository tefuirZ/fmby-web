# FE-2127-SUPERADMIN-REMOVAL —— 前端 super_admin V1 残留全链删除（交付报告）

> 席位 rv3-frontend ｜ 分支 `seat/rv3/fe-2127-superadmin`（base = origin/main `99acc73`）
> 规格来源：取证席报告 `ISSUE-2127-ROLES-EVIDENCE.md` @ `3d8c6609cb`（分支
> `seat/fixp1e-authgaps/issue-2127-roles-evidence`）。**本席逐点复核原文后执行**，
> 未采信任何未复核结论。裁定：A 档（直接删；部署库若有残留行属惰性数据，不阻塞）。

## ① 8 点逐点处置（全部复核原文 ✓）

| # | 位置 | 处置 | 复核所见 |
|---|---|---|---|
| 1 | `shared/src/contracts/manage/types.ts:4-7` | **删** `| "super_admin"` | union 原文与报告一致；删后 = 后端 `BUILTIN_ROLES` 三名逐值一致 |
| 2 | `shared/src/contracts/auth/user.ts:8` | **删** `'SuperAdmin'` | 消费面扫描（字面量全仓 26 处逐条过）：无任何 `=== 'SuperAdmin'` 比较，纯类型面消费 ⇒ 安全 |
| 3 | `host/src/pages/manage/registration-codes/constants.ts` | **删** 下拉项 `{value:'super_admin', label:'超级管理员'}` | `ROLE_OPTIONS` 类型是 `ManageUserRole` ⇒ union 删除使该字面量编译错误，删选项是**被迫且必然**的连带 ✓ |
| 4 | `shared/src/contracts/manage/labels.ts` | **删** `case "super_admin"` | default 已兜底「普通用户」 |
| 5 | `shared/src/contracts/manage/mapping/shared.ts` | **删** `case "super_admin"` | default 已兜底 `user`（fail-closed 显示） |
| 6 | `shared/src/contracts/manage/mapping/records.ts` | **删** super 分支（`includes("super")/"超级"` ⇒ `"super_admin"`） | ⚠ 取证席标注的连带已裁定：历史 label「超级管理员/superadmin」落 admin 臂 —— **迁移语义延续**（`20260601090000_single_admin_role.sql` 把 SuperAdmin 并入 Admin），已在代码注释与测试里显式钉死，非静默形似匹配 |
| 7 | `shared/src/contracts/auth/capabilityCheck.ts` | **删** `ADMIN_ROLE_ALIASES` 的 `'superadmin'`/`'super_admin'` ⇒ 集合仅 `'admin'` | 注释原文自带授权：「若将来确认前端不再产出该字面量，可直接删这两项（单点）」—— 本卡即该确认。三段注释同步改写为删除后的真话 |
| 8 | 测试 | **正例反转为负例**（见②） | `shared/tests/capability-union.test.ts:54` 的 'SUPER_ADMIN' 是**能力侧**负例（`parseCapability`），与本卡角色面无关 ⇒ 不动 ✓ |

**复核增补（报告之外发现的连带）**：
- `ROLE_OPTIONS` 消费面共 **4 个下拉**：注册码表单 + 用户创建/编辑/批量抽屉
  （`RegistrationCodeForm` / `UserCreateForm` / `UserEditForm` / `BatchUserEditDrawer`）
  ——删常量一处，四处全部收敛，无代码改动需要。
- `capabilityCheck.ts` 注释三段（真值分层 / 防御性冗余 / normalizeRole 例证）引用
  super_admin 的旧叙事已同步改写 —— 注释必须说删除后的真话。
- `host/tests/session-capability-match.test.ts:85-92` 的注释块（自审补充叙事）一并改写，
  保留「上一版漏 super_admin」的历史教训并标注本卡反转。

## ② RED→GREEN（删枚举不删测试 = 假绿陷阱 ⇒ 正例全部反转）

**RED（源码未删时，负例应红）**：`shared` 3 红 / `host` 5 红 ——
```
✖ mapRole("super_admin") 不回显（落 default ⇒ user）
✖ mapRoleToLabel("super_admin") 不再产出「超级管理员」
✖ mapRoleLabelToApi 任何 super 形态 label 都不得产出 "super_admin"
✖ role_template 下拉不得提供 super_admin    ✖ 下拉收敛恰好三内置角色
✖ V1 残留 SuperAdmin 不再视为管理员          ✖ super_admin 不是管理员
✖ SuperAdmin / Super_Admin / SUPER_ADMIN 变体一律不命中
```
（反转自既有正例：「SuperAdmin 同样具备」「super_admin 是管理员」「大小写变体是管理员」——
枚举残留时代的断言，随第 7 点删除同步反转，防假绿。）

**GREEN（删除后）**：`shared/tests/manage-roles-contract.test.ts` **4/4** ·
`host/tests/session-capability-match.test.ts` + `registration-role-options.test.ts` **15/15** ·
shared 全量 **161/161** · `form-validation-a11y` 3/3。

**新钉子**（负例常驻，防复活）：
- `manage-roles-contract.test.ts`：union 与后端逐值一致 / mapRole 不回显 /
  mapRoleToLabel 不伪造 / mapRoleLabelToApi 永不产出 "super_admin"（并钉死 admin 归并语义）
- `registration-role-options.test.ts`：下拉**恰好**三内置角色（深比较，不多不少）+ 无空选项/空标签

## ③ 下拉核验（判据③）

删后 `ROLE_OPTIONS` 恰好 = `user(普通用户) / restricted_user(受限用户) / admin(管理员)`，
全部 ∈ 后端 `BUILTIN_ROLES`，无空选项/空分组/空标签（测试深比较钉死）。
消费该列表的 4 个下拉同步收敛。

## ④ 本机验证门

- targeted 套件全绿（见②）；shared 全量 161/161；form-validation-a11y 3/3
- **typecheck 等价验证**：本机重活队列闸不放行 `pnpm typecheck`（rc=3），按脚本本体
  直接调 tsc：`shared tsc rc=0` · `host (tsconfig.app) tsc rc=0`（themes 无角色字面量
  引用，全链仍以 web-verify 为准）
- 字面量复扫：生产代码 **0 处** super_admin/SuperAdmin/superadmin 残留；余下命中全部
  是注释与负例测试（记录删除事实）

## ⑤ V2 侧

零改动（正典三名 + 400 fail-closed 即应有语义；本仓单仓纪律）。
同族待办（取证席 ponytail 已登记，非本卡）：SessionStatus idle/revoked 待对、
合同面 union 全量对拍另卡。

---
family: glm ｜ model: magpie/auto/glm-5.3-flash ｜ 席位 rv3-frontend
