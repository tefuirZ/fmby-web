# FE-CONTRACT-REAUDIT2 交付说明 · 契约复核第二轮（后端本轮新合入）

> 卡号：FE-CONTRACT-REAUDIT2（口径同 FE-CONTRACT-REAUDIT）· 分支：`w/fe1/fe-contract-reaudit2`
> 结论：**三域零漂移，零代码改动**
> 日期：2026-10-03 · 写手：zcode · `Reviewed-by: pending-non-author-review`

---

## 闸原文

```
node scripts/check-contract-mappers.mjs  → [PASS] 0 contract violations
node scripts/check-frontend-component-size.mjs → [PASS] 0 违规，无超线组件
```

## 对拍矩阵（三域）

| 域 | 后端新合入（origin/main 取证） | 前端现状 | 判定 |
|---|---|---|---|
| ① `0092 playback_stream_tokens` | `realtime.rs` 的 `stream_token` 判定属 **compat WS 面**（`fmby-v2-compat/routes/websocket.rs`，Emby/Jellyfin 客户端敏感信息脱敏词表）；HTTP 前端面无新增/变更路由（`/playback/stream/{variant_id}` 系播放链路，前端经既有 PlayPage 面消费） | 前端无 WS/token 新契约义务 | ✅ 不涉前端 WebUI 契约 |
| ② ERROBODY 新映射（pan115 凭据/归档 IO） | 双层词表并存：`errors.rs` AppError 分类 14 码（`credential_invalid`/`unauthorized`/…，lowercase）**未变**；`error_code/slug.rs` 的 `PAN115_COOKIE_INVALID` 等 SCREAMING slug 属 ErrorCode 直通面。`pan115_accounts.rs` 的 `Coded(Pan115CookieInvalid/Pan115CredentialMissing)` 走 AppError 分类映射 ⇒ 前端收到的仍是 lowercase 词表 | `Pan115CredentialsSection`/`DirectoryBrowserSection` 判定 `code === 'credential_invalid'/'not_found'` —— 仍在新词表内 | ✅ 无漂移 |
| ③ workers 名册 | `router_core.rs` admin 面**无任何 worker 状态路由**（rewards/watch/token-gc 等 worker 均无 HTTP 暴露） | 前端 admin 面无 worker 状态消费 | ✅ 两侧一致（无能力=无消费，不属漂移） |

## 附带发现（登记，非本卡修复）

- 后端 `dc7adc9e1`（regwin）：管理端**写入校验纯函数 + KV/形状公开单源**已落，但**路由/DTO 待续**（提交信息自述）⇒ 前端注册窗口 UI 仍等 REGISTRATION-WINDOW-ADMIN-API 路由面，与上轮结论一致。

## 跳过项

- tsc 双包全量（无 node_modules，既有登记）；本轮零改动，无新增类型面。
- check-contract-sync（后端仓脚本，不跨仓跑）。
