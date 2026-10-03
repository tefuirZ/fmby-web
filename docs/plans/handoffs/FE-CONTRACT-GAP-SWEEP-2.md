# FE-CONTRACT-GAP-SWEEP-2 handoff（契约缺口重扫 · 只出清单不改码）

> 分支：`w/lib/gap-sweep-2`（FE origin/main `135d99f`；后端同日 main ref）
> 日期：2026-10-03 · 写手：lib 席位 · 方法论：后端 `.route(...)` 全集 **439** 条 vs 前端 origin/main ref 调用面（shared/src+host/src 全部字符串与模板串 + const BASE 展开 + 同 handler 别名归并），归一（`${}`/`{id}`/`:id`→`*`）求差集

## 0. 方法论与前次误报根因

- 第一轮只扫单处字面量、漏 `const BASE` + `` `${BASE}/x` `` 模板拼接 ⇒ license 五端点被误报（实际全消费，主代理据此重复派卡）。
- 本轮清洗：双通道提取、BASE 展开、`/api/api/` 双前缀剔除、**同 handler 别名剔除**（如 `/api/admin/overview` ≡ `/api/manage/overview` 同 `admin::admin_overview`）、501 占位判定（读 handler 体找 `ErrorCode::NotImplemented`）。

## 1. 总量

> ★**增量核对（本分支 pull main 时发现）**：main 新合 `e97d3b4`（用户安全/凭据投递契约）已消费
> `POST /api/manage/users/{id}/mfa/totp/reset` 与 `POST /api/manage/users/{id}/telegram-password-reset`
> 两条 ⇒ 从 manage/users 组剔除，清单余 118 条。**教训：重扫清单是快照，合并窗口内会过时——派卡前请以本清单+当时 main 复核。**

- 后端注册 439 条 → 差集清洗后 **120 条 → pull main 增量核减后 118 条**（117 真实现 + 1 占位；双前缀/别名/外部回调已剔）。

## 2. 分组清单（路径+方法 | 真实性 | 建议卡规模）

### admin（4 条 · 规模 —）

> 与 /api/manage/* 同 handler 别名——非缺口

| 方法 | 路径 | 状态 |
|---|---|---|
| DELETE | `/api/admin/api-tokens/{id}` | 真实实现 |
| GET | `/api/admin/audit` | 真实实现 |
| DELETE | `/api/admin/media/{id}` | 真实实现 |
| GET | `/api/admin/tasks` | 真实实现 |

### assets（3 条 · 规模 —）

> 图片/字幕 GET，<img>/<track> 直连 grep 不到 fetch——待核

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/assets/collections/{collection_id}/images/{kind}` | 真实实现 |
| GET | `/api/assets/image-proxy` | 真实实现 |
| GET | `/api/assets/media-items/{item_id}/subtitles/{override_id}` | 真实实现 |

### auth（8 条 · 规模 S）

> captcha（登录页）/ change-required（改密流）/ telegram password-reset

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/auth/captcha` | 真实实现 |
| GET | `/api/auth/identity` | 真实实现 |
| POST | `/api/auth/identity/bind` | 真实实现 |
| GET | `/api/auth/identity/{provider}` | 真实实现 |
| POST | `/api/auth/identity/{provider}/login/status` | 真实实现 |
| POST | `/api/auth/password-reset/telegram/complete` | 真实实现 |
| POST | `/api/auth/password-reset/telegram/status` | 真实实现 |
| POST | `/api/auth/password/change-required` | 真实实现 |

### browse（4 条 · 规模 S-M）

> roots/resume/recently-added/items{id}（用户面首页轨道，对齐 V1 首页）

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/browse/items/{id}` | 真实实现 |
| GET | `/api/browse/recently-added` | 真实实现 |
| GET | `/api/browse/resume` | 真实实现 |
| GET | `/api/browse/roots` | 真实实现 |

### integrations（1 条 · 规模 —）

> telegram webhook（外部回调面，FE 永不调用）——剔除

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/integrations/telegram/bot/webhook` | 真实实现 |

### items（2 条 · 规模 S）

> likes/played 用户动作（播放器/详情页接入）

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/items/{id}/likes` | 真实实现 |
| POST | `/api/items/{id}/played` | 真实实现 |

### manage/collections（2 条 · 规模 S-M）

> douban 导入 preview/create

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/manage/collections/imports/douban/create` | 真实实现 |
| POST | `/api/manage/collections/imports/douban/preview` | 真实实现 |

### manage/developer（3 条 · 规模 S）

> api-tokens 列表/吊销 + subjects

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/developer/api-tokens` | 真实实现 |
| POST | `/api/manage/developer/api-tokens/{tokenId}/revoke` | 真实实现 |
| GET | `/api/manage/developer/subjects` | 真实实现 |

### manage/libraries（8 条 · 规模 M）

> 库生命周期操作面（cleanup/media-reset/purge/delete-status），需确认闸

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/libraries/deletions` | 真实实现 |
| POST | `/api/manage/libraries/{id}/cleanup` | 真实实现 |
| GET | `/api/manage/libraries/{id}/cleanup-preview` | 真实实现 |
| GET | `/api/manage/libraries/{id}/delete-status` | 真实实现 |
| POST | `/api/manage/libraries/{id}/delete/retry` | 真实实现 |
| POST | `/api/manage/libraries/{id}/media-reset` | 真实实现 |
| GET | `/api/manage/libraries/{id}/media-reset-preview` | 真实实现 |
| POST | `/api/manage/libraries/{id}/sources/{sourceId}/purge` | 真实实现 |

### manage/media-items（1 条 · 规模 S）

> ratings/backfill

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/manage/media-items/ratings/backfill` | 真实实现 |

### manage/microsoft（10 条 · 规模 M-L）

> MS 账号 drives/sites/write 管理面（含 upload-session 写路径），需设计

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/delta` | 真实实现 |
| GET | `/api/manage/microsoft/auth/accounts/{account_id}/drives` | 真实实现 |
| GET | `/api/manage/microsoft/auth/accounts/{account_id}/drives/{drive_id}/quota` | 真实实现 |
| GET | `/api/manage/microsoft/auth/accounts/{account_id}/sites` | 真实实现 |
| GET | `/api/manage/microsoft/auth/accounts/{account_id}/sites/{site_id}/drives` | 真实实现 |
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/write/create-folder` | 真实实现 |
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/write/delete` | 真实实现 |
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/write/move` | 真实实现 |
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/write/rename` | 真实实现 |
| POST | `/api/manage/microsoft/auth/accounts/{account_id}/write/upload-session` | 真实实现 |

### manage/migration（3 条 · 规模 S）

> inspect/export 真实现可接（import 是 501 占位勿接）

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/migration/export` | 真实实现 |
| POST | `/api/manage/migration/import` | 501 占位（勿接） |
| GET | `/api/manage/migration/inspect` | 真实实现 |

### manage/mounts（7 条 · 规模 M）

> 挂载操作（probe/scan/verify/绑定库），既有 mounts 页可扩展

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/mounts/{id}/libraries` | 真实实现 |
| POST | `/api/manage/mounts/{id}/libraries` | 真实实现 |
| DELETE | `/api/manage/mounts/{id}/libraries/{library_id}` | 真实实现 |
| POST | `/api/manage/mounts/{id}/probe` | 真实实现 |
| POST | `/api/manage/mounts/{id}/scan` | 真实实现 |
| GET | `/api/manage/mounts/{id}/scan` | 真实实现 |
| POST | `/api/manage/mounts/{id}/verify` | 真实实现 |

### manage/operations（4 条 · 规模 M）

> runtime 仪表 + media-visibility-governance 三条

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/operations/media-visibility-governance` | 真实实现 |
| GET | `/api/manage/operations/media-visibility-governance/{taskId}` | 真实实现 |
| POST | `/api/manage/operations/media-visibility-governance/{taskId}/cancel` | 真实实现 |
| GET | `/api/manage/operations/runtime` | 真实实现 |

### manage/pan115（6 条 · 规模 M）

> imghost raw + share-mounts 凭据/扫码/激活

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/pan115/imghost/raw/{sha1}` | 真实实现 |
| POST | `/api/manage/pan115/share-mounts/{mount_id}/activate` | 真实实现 |
| GET | `/api/manage/pan115/share-mounts/{mount_id}/credentials` | 真实实现 |
| DELETE | `/api/manage/pan115/share-mounts/{mount_id}/credentials` | 真实实现 |
| POST | `/api/manage/pan115/share-mounts/{mount_id}/qr-login` | 真实实现 |
| GET | `/api/manage/pan115/share-mounts/{mount_id}/qr-status` | 真实实现 |

### manage/rewards（2 条 · 规模 S-M）

> 管理面 media-requests 审核/transition

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/rewards/media-requests` | 真实实现 |
| POST | `/api/manage/rewards/media-requests/{requestId}/transition` | 真实实现 |

### manage/runtime-logs（1 条 · 规模 S）— ⏳ 相邻：w/zcode/fe-log-archive 已接归档，export 可顺带

> 

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/runtime-logs/export` | 真实实现 |

### manage/system（1 条 · 规模 S）— ⏳ 在途：w/zcode/fe-storage-footprint 已交付待合

> 

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/system/storage-footprint` | 真实实现 |

### manage/task-center（2 条 · 规模 S）

> pipeline-gaps + batch 动作

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/manage/task-center/actions/batch` | 真实实现 |
| GET | `/api/manage/task-center/pipeline-gaps` | 真实实现 |

### manage/upstreams（1 条 · 规模 S）

> health

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/upstreams/health` | 真实实现 |

### manage/users（8 条 · 规模 M）

> emby-import 向导 + direct-registration/expiry-notifications 设置 + 管理员 MFA/TG 重置

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/users/direct-registration/settings` | 真实实现 |
| PUT | `/api/manage/users/direct-registration/settings` | 真实实现 |
| POST | `/api/manage/users/emby-import` | 真实实现 |
| GET | `/api/manage/users/emby-import/jobs` | 真实实现 |
| GET | `/api/manage/users/emby-import/jobs/{job_id}` | 真实实现 |
| POST | `/api/manage/users/emby-import/preview` | 真实实现 |
| GET | `/api/manage/users/expiry-notifications/settings` | 真实实现 |
| PUT | `/api/manage/users/expiry-notifications/settings` | 真实实现 |

### manage/yun139（20 条 · 规模 M-L）

> 账号池/分享挂载/预览/转移管理面，一组完整 CRUD 卡

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/manage/yun139/account-pools` | 真实实现 |
| POST | `/api/manage/yun139/account-pools` | 真实实现 |
| GET | `/api/manage/yun139/account-pools/{pool_id}` | 真实实现 |
| PUT | `/api/manage/yun139/account-pools/{pool_id}` | 真实实现 |
| DELETE | `/api/manage/yun139/account-pools/{pool_id}` | 真实实现 |
| POST | `/api/manage/yun139/account-pools/{pool_id}/lease` | 真实实现 |
| GET | `/api/manage/yun139/account-pools/{pool_id}/members` | 真实实现 |
| POST | `/api/manage/yun139/account-pools/{pool_id}/members` | 真实实现 |
| DELETE | `/api/manage/yun139/account-pools/{pool_id}/members/{profile_id}` | 真实实现 |
| POST | `/api/manage/yun139/account-pools/{pool_id}/report` | 真实实现 |
| POST | `/api/manage/yun139/previews` | 真实实现 |
| POST | `/api/manage/yun139/previews/{preview_id}/browse` | 真实实现 |
| POST | `/api/manage/yun139/share-links/browse` | 真实实现 |
| POST | `/api/manage/yun139/share-mounts/{mount_id}/browse` | 真实实现 |
| GET | `/api/manage/yun139/share-mounts/{mount_id}/shares` | 真实实现 |
| PUT | `/api/manage/yun139/share-mounts/{mount_id}/shares` | 真实实现 |
| POST | `/api/manage/yun139/share-mounts/{mount_id}/shares/{share_entry_id}/browse` | 真实实现 |
| GET | `/api/manage/yun139/share-mounts/{mount_id}/transfers` | 真实实现 |
| POST | `/api/manage/yun139/share-mounts/{mount_id}/transfers/prepare` | 真实实现 |
| POST | `/api/manage/yun139/transfers/{record_id}/playback-success` | 真实实现 |

### playback（2 条 · 规模 S）

> stream 直链（FE 可能走 <video> src 直连——登记待核）

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/playback/stream/{variant_id}` | 真实实现 |
| GET | `/api/playback/stream/{variant_id}/{session}` | 真实实现 |

### recommendations（1 条 · 规模 S）

> 

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/recommendations/for-you` | 真实实现 |

### rewards（3 条 · 规模 M）

> 用户面 media-requests 申请/取消/配额

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/rewards/media-requests` | 真实实现 |
| GET | `/api/rewards/media-requests/quota` | 真实实现 |
| POST | `/api/rewards/media-requests/{requestId}/cancel` | 真实实现 |

### settings（8 条 · 规模 S）

> 

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/settings/integrations/outbound-http` | 真实实现 |
| PUT | `/api/settings/integrations/outbound-http` | 真实实现 |
| POST | `/api/settings/integrations/outbound-http/test` | 真实实现 |
| GET | `/api/settings/server/cdn-operations` | 真实实现 |
| PUT | `/api/settings/server/cdn-operations` | 真实实现 |
| POST | `/api/settings/server/cdn-operations/preheat` | 真实实现 |
| POST | `/api/settings/server/cdn-operations/refresh` | 真实实现 |
| POST | `/api/settings/server/cdn-operations/test` | 真实实现 |

### site（3 条 · 规模 S）

> themes 管理（FE 现本地主题，服务端主题面待产品裁决）

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/site/themes` | 真实实现 |
| POST | `/api/site/themes/install` | 真实实现 |
| POST | `/api/site/themes/{id}/enable` | 真实实现 |

## 3. 已证伪/剔除（逐个 grep 证据）

- **license 五端点**：`shared/contracts/manage/license/api.ts` BASE=`/api/manage/license` + `${BASE}/status|device-flow|device-flow/poll|activation-token|heartbeat` 全消费；页面 `ManageLicensePage` + 3 hooks + 5 子组件 ⇒ **假缺口**（第一轮误报源头，本席复证）。
- **/api/admin/**（4 条）**：与 `/api/manage/*` 同 handler 别名（`admin_overview` 双注册 `/admin/overview`+`/manage/overview`），FE 走 manage 面 ⇒ 非缺口。
- **/api/api/manage/migration/**：双前缀畸形注册镜像，同 handler ⇒ 剔除。
- **POST /api/manage/migration/import**：501 占位（`ErrorCode::NotImplemented`，"远程执行 DDL 本卡未实现"）⇒ 不算缺口。
- **POST /api/integrations/telegram/bot/webhook**：外部回调面，FE 永不调用 ⇒ 剔除。
- **在途**：storage-footprint（`w/zcode/fe-storage-footprint`）、runtime-logs 归档（`w/zcode/fe-log-archive`），两卡均已 push 待合。

## 4. 待核（下一张卡取证）

- `/api/playback/stream/{variant_id}`：播放器可能 `<video src>` 直连而非 fetch（现 FE 播放走 `/api/playback/resolve`）⇒ 接入前先核播放器实现。
- `/api/assets/**`：`<img>`/`<track>` 直连形态 grep 不到 fetch，但 `/api/assets/` 前缀 FE 有命中 ⇒ 半核。

---

Reviewed-by: pending-non-author-review