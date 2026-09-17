# WEB-S4C 收尾 + FE-COMPONENT-SPLIT-B5 交接（w1 · 前端仓 w/zcode/writer1-web-s4c-final）

> 两件事一张卡：① WEB-S4C 凭据收尾（MOUNT-CRED-SEAL 语义确定后）；
> ② B5 拆剩余 2 条 → **组件行数基线清零**。

- 基线：`origin/main` @ `946c38f`
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS）
- **组件行数基线 2 → 0**（`files: []` → 门禁真正生效）

---

## ① WEB-S4C 凭据收尾（MOUNT-CRED-SEAL）

### 后端语义（已核 `crates/fmby-v2-server/src/bridges/mount_cred.rs`）

| 场景 | 行为 |
|---|---|
| **Create 明文** | 服务端 SecretBox 密封 → 落库 `__sealed:sb.mount.{id}` |
| **Create `__sealed:`** | **400** `MountConfigSealedRefOnCreate`（防跨挂载凭据引用） |
| **Update `__sealed:`** | 原样透传 = **不改凭据** |
| **Update 明文** | 重新密封 |
| **敏感键空值** | **400** `MountConfigSensitiveEmpty`（**不能发空串**） |

**关键结构事实**：`update_mount` 是 `Some(patch) => storage_config_json(patch)`——
即 **PATCH 整表替换 config_json**，不是 merge。故「留空则不修改」**必须回传原
`__sealed:` 引用**；若省略该键，凭据会被抹掉。

### 前端实现

1. **记忆位（types.ts）**：`passwordSealedRef` / `tokenSealedRef` /
   `accessKeySealedRef` / `secretKeySealedRef`（`string | null`）。
2. **读（`extractRemoteConfigState`）**：值为 `__sealed:` 时**不进输入框**，
   存入记忆位；输入框留空。明文才回填输入框。
   → 修掉「编辑态把 `__sealed:sb.mount.7` 显示成密码框内容」的 bug 面。
3. **写（`resolveSensitiveValue`）**：统一三条判定
   - 重填明文 → 用明文（后端重新密封）；
   - 留空且有存量引用 → **回传引用**（Update=不改；PATCH 替换语义下不可省略）；
   - 误粘 `__sealed:` → 回传存量引用（Create 场景则不发，避免 400）。
4. **UI 占位（裁决 3）**：`STORED_CREDENTIAL_PLACEHOLDER = '已配置凭据，留空则不修改'`
   —— WebDAV password、S3 access_key/secret_key、AList password/token 四处。
5. **防御（卡面要求）**：`collectSealedRefInputErrors` —— 用户把 `__sealed:`
   粘进输入框时给字段级报错 `SEALED_REF_INPUT_ERROR`（Create 分支更是绝不能提交引用）。

**逻辑交叉验证 7 条全通过**（含两条防御）：Create 明文→明文 / Create 留空→不发 /
Edit 留空+存量→回传引用 / Edit 重填→明文 / Edit 误粘引用→回传存量 /
Create 误粘引用→不发（不 400）/ Edit 留空无存量→不发。

---

## ② FE-COMPONENT-SPLIT-B5（基线清零）

| 文件 | 拆前 → 拆后 | 抽出 |
|---|---:|---|
| `manage/naming-rules/scrape-sections.tsx` | 533 → **删除** | `components/NamingScrapeStrategySection.tsx`(310) · `components/NamingScrapeBatchRepairSection.tsx`(188)（+ `posterLanguageModeLabel` 随策略件） |
| `login/LoginPage.tsx` | 587 → **175** | `login/forms/fields.tsx`（Field/PasswordToggle/SubmitButton 三原语，74）· `forms/LoginForm.tsx`(89) · `forms/RegisterForm.tsx`(160) · `forms/SetupForm.tsx`(136) |

- `scrape-sections.tsx` **整文件删除**（三块各归其位），页面改从 `components/` barrel 导入。
- `LoginPage` 保留 `LoginShell` + `LoginPage`（编排层），三个表单纯搬。
- **基线 2 → 0**：`fe-component-size-baseline.json` 的 `files: []`，
  唯一豁免是 `EXEMPT_FILES` 里的路由表（设计豁免，非债务）。

**门禁已实测「真咬」**：新建 401 行文件 → 立即
`[New Over-Limit Component] ... 401 行超 400 红线，且不在基线清单内` FAIL。

---

## ③ 备注 / 待办

1. **基线清零后的新语义**：任何**新增**超线 `.tsx` 立即 FAIL，不再有「存量债务」缓冲。
   后续若确需临时放宽，只能动 `EXEMPT_FILES`（带理由）或走 `--update-baseline`
   （且只许对**已下降**的文件回收，新增仍 FAIL）。
2. **`LoginPage` 拆分风险已控**：纯结构搬迁，未动会话/CSRF/多因素逻辑；
   typecheck + build + 14 单测全绿。若后续要做登录链路 e2e，建议补在 `login/forms/*`。
3. **挂载凭据的 e2e 仍待补**：本次是逻辑级交叉验证 + 门禁，**未跑真实后端**
   （无运行中实例）。建议后续补「创建带凭据 WebDAV/S3 → 编辑留空 → 凭据不变」
   的集成用例（需后端起来）。
4. 无新增豁免、无规则改动；棘轮仍双向生效。
