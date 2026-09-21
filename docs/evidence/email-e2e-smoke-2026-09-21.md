# EMAIL-E2E-SMOKE 证据（真栈冒烟，2026-09-21）

脚本：`scripts/e2e/email_channel_smoke.py`（`pnpm email-smoke`）
方式：真 bin + 真服务器 + 隔离端口(18095+)/数据目录；复用后端 `scripts/e2e/harness.py`
（seed + admin 登录 + session/CSRF 双工件）。

## 真跑过并证实的项

### ① GET /api/settings/server/email —— 12 字段 snake_case 全存在 ✅
实际响应字段（真服务器回显，逐字）：
```
['code_len','code_ttl_minutes','configured','from_address','host',
 'html_template','link_ttl_minutes','port','reset_delivery',
 'secret_fields_configured','security','username']
```
- 证实**wire 全 snake_case**（后端 DTO 裸派生 serde 无 rename_all）。
- 实际值：`configured=False security='starttls' reset_delivery='code'
  username='' html_template=''`
- 证实 `username`/`html_template` 是 Rust `String`（**空串而非 null**）——
  即 EMAIL-WEB-UI 卡修掉的那个类型隐患，真栈确认。

### ② PUT /api/settings/server/email —— 空串原样发 + password 留空不改 ✅
- 空串 `username`/`html_template` 原样发 → 后端接受（无反序列化错），回显仍为空串。
- `password` 省略 → `secret_fields_configured` 保持 `[]`（未改写凭据）。

## SKIP 项（不可验证，非绿）

### ③ start / ④ A 形态 complete —— SKIP
- 真服务器返回 **503 `dependency_unavailable`**（fail-closed，符合要求）。
- 原因（已核源码，非配置问题）：`TelegramPasswordResetBridge.email` 默认 `None`
  （`bridges/password_reset.rs:93`），`with_email_channel()`（:109-115）
  **在生产装配路径上无任何调用点** —— 仅有单测用 Fake 注入（:1248 附近）。
  ⇒ 邮件端口在生产未接线，③④ 在真服务器上**当前结构上不可验证**。
  属后端接线缺口，非前端问题。

### 补充证据（非 mock）：后端既有真单测 11 passed / 0 failed
`cargo test -p fmby-v2-server --lib password_reset::`（真 Fake 仓储 + 真
EmailChannelParts + 真 Argon2）：
- `email_start_does_not_leak_user_existence` ✅（防枚举）
- `email_complete_rejects_unknown_code_with_uniform_error` ✅（A 三元组校验 + 统一文案）
- `email_start_unconfigured_is_500_not_fake_success` ✅（fail-closed 不假成功）
- `email_complete_short_password_is_rejected` ✅（新密码 ≥8）
- 另有 ticket 面 7 项（expired/used/malformed/foreign_created_by/short_password/
  changes_password_and_revokes_sessions）全过。

## 仍未被执行验证（诚实登记）
- 真实 SMTP 投递（无 SMTP 环境）→ 未验证，也不 mock。
- `delivery` 三种形态的**实际取值**（code/link/password）：真栈拿不到（503），
  故脚本只打印实际值、不断言是哪个形态。
- A 形态"拿到非空 challenge"路径：真栈走不到，仅在单测层被 `email_complete_*`
  间接覆盖（challenge 由 Fake 路径产生）。

## 退出码纪律（已实测）
- 无 bin → `SKIP ... exit 0`（不假红）
- bin 过旧（w1 debug 编译于路由合并前）→ `GET 404` → SKIP 并提示换 `--target`
- 真断言失败（注入不存在字段）→ `FAIL: 缺字段 [...]`，**exit 1**（不假绿）
