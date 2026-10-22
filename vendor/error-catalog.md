# 错误码目录（ERR-TAXONOMY）

> **本表由代码派生，请勿手工编辑表格行。**
> 唯一真源：`crates/fmby-v2-contracts/src/error_code.rs`
> （`ErrorCode::http_status()` 与 `ErrorCode::message()`）。
> 一致性由单测 `error_catalog_matches_http_status` 锁定：
> 修改代码而不同步本表 → 单测失败。

## 契约

| 项 | 约定 |
|---|---|
| wire 字段 | `ErrorBody.error_code`（字符串），`message`（**中文**，用户可直接展示） |
| 本表稳定码形态 | SCREAMING_SNAKE（`ErrorCode::as_slug()`），前端可 `switch` |
| HTTP 状态 | 由 `ErrorCode::http_status()` 派生（见下表第 2 列） |
| 中文文案 | 由 `ErrorCode::message()` 提供默认文案；业务方可用 `AppError::coded(code, 具体中文)` 覆盖 |
| 向后兼容 | 既有 11 个泛化类（`Validation`/`NotFound`/…）继续输出原蛇形码（如 `validation`），按域迁移到 `Coded` |

### 命名空间：为什么 wire 上的 `error_code` 有两种形态（#571）

**本表只覆盖 `Coded` 族。** 同一个 wire 字段 `ErrorBody.error_code` 上，另一族也在发货：

| 族 | 形态 | 产生方式 | 举例 |
|---|---|---|---|
| **`Coded` 族（本表，192 个）** | SCREAMING_SNAKE | `AppError::coded(ErrorCode::X, "中文")` / `AppError::Coded(..)` | `PERM_DENIED`、`AUTH_INVALID_CREDENTIALS`、`VALID_FIELD_INVALID`、`MOUNT_NAME_EXISTS`、`NOT_IMPLEMENTED` |
| **分类族（不在本表）** | lowercase snake_case | `AppError::Validation(..)` / `NotFound` / `Conflict` / `Forbidden` / `Unauthorized` / `Dependency*` / `CredentialInvalid` / `RetryableStorage` / `Cancelled` / `Internal` | `forbidden`、`validation`、`not_found`、`internal` |

分流真源：`crates/fmby-v2-http/src/errors.rs` 的 `error_code_of`——
`Coded(code, _) => code.as_slug()`（SCREAMING），其余分类逐条硬编码 lowercase。
**两族同时在发货，不存在“HTTP wire 一律 lowercase”这回事。**

> 订正记录：#571 原文裁定「HTTP 响应体的 error_code 以 lowercase 为准」**过宽**——它只看了
> 分类族，漏了 `Coded` 族同样直接上 wire。`error-catalog.md` 之前只写“既有 11 个泛化类继续输出
> 原蛇形码”，未说明两族如何分辨，已被误读为“HTTP 面一律小写”⇒ 致 #512 的
> `imghost_e2e.rs:316` 断言把 403 期望值从 `PERM_DENIED` 误改成 `forbidden`。
> 本文档与 `docs/18-webui-contract.md` §5.1 已同步消歧。

**迁移纪律**：既有 `AppError::Validation(..)` 等构造点**继续可用**（1078 处不强制改）。
新增**可预见**失败应优先用 `AppError::coded(ErrorCode::X, "中文文案")`。

## 错误码表

| 错误码 | HTTP 状态 | 中文解释（用户可读） | 触发条件 | 建议动作 |
|---|---|---|---|---|
| `AUTH_REQUIRED` | 401 | 请先登录后再操作。 | 请求缺少会话令牌或令牌无效。 | 重新登录；若持续出现检查 Cookie 是否被浏览器拦截。 |
| `AUTH_EXPIRED` | 401 | 登录状态已过期，请重新登录。 | 会话超过有效期。 | 重新登录；可检查服务端会话有效期配置。 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误，请重新输入。 | 用户名或密码不匹配。 | 核对账号密码后重试；连续失败会触发账号锁定。 |
| `AUTH_CSRF_MISSING` | 401 | 请求缺少安全校验信息，请刷新页面后重试。 | 写请求缺少 CSRF 双提交头。 | 刷新页面后重试；检查反向代理是否透传 x-csrf-token。 |
| `AUTH_RATE_LIMITED` | 429 | 操作过于频繁，请稍后再试。 | 登录/敏感操作触发快闸或慢闸。 | 等待锁定窗口结束；检查是否存在爆破来源 IP。 |
| `AUTH_SESSION_LIMIT_EXCEEDED` | 403 | 登录会话数已达上限，请先在其他设备登出。 | `max_sessions` 已配置且该用户的活跃会话数已达上限（quota-sessions 闸）。 | 前端展示「已达上限」并引导在其他设备登出；或由管理员提高 `max_sessions`。未配置 = 不限（零行为变化）。 |
| `AUTH_ACCOUNT_LOCKED` | 401 | 账号已被锁定，请稍后再试或联系管理员。 | 账号因多次失败被临时锁定。 | 等待锁定自动解除，或由管理员在用户管理解锁。 |
| `AUTH_ACCOUNT_INACTIVE` | 401 | 账号未启用，请联系管理员开通。 | 账号状态为未启用。 | 管理员在「用户管理」启用该账号。 |
| `AUTH_ACCOUNT_NOT_YET_VALID` | 401 | 账号尚未生效，请联系管理员。 | 账号生效时间未到。 | 管理员调整账号生效时间。 |
| `AUTH_ACCOUNT_EXPIRED` | 401 | 账号已过期，请联系管理员续期。 | 账号已过有效期。 | 管理员续期或重建账号。 |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 401 | 需要修改密码后才能继续操作。 | 账号被标记为必须改密。 | 按提示修改密码后再操作。 |
| `AUTH_INTERACTIVE_LOGIN_DISABLED` | 401 | 当前账号不允许交互式登录。 | 该账号禁止交互式登录（如 API 账号）。 | 改用 API Token 或联系管理员开放登录。 |
| `PERM_DENIED` | 403 | 你没有执行该操作的权限。 | 已登录但缺少对应 capability。 | 管理员为该角色补充对应权限。 |
| `PERM_LIBRARY_FORBIDDEN` | 403 | 你没有访问该媒体库的权限。 | 用户无该媒体库访问权。 | 管理员在媒体库绑定中授权该用户。 |
| `PERM_ADMIN_REQUIRED` | 403 | 该操作需要管理员权限。 | 操作需要管理员权限。 | 改用管理员账号，或提升当前账号角色。 |
| `PERM_LICENSE_DENIED` | 403 | 当前授权版本不支持该功能，请升级后使用。 | 当前授权版本不含该功能。 | 升级授权后使用，或停用该功能。 |
| `LICENSE_LIMIT_EXCEEDED` | 403 | 已达授权上限，请联系管理员升级授权。 | 创建路径（库/挂载/用户/上游/令牌/播放并发/激活实例）在事务内判定，超过当前授权上限。 | 删除多余对象或升级授权。 |
| `LICENSE_REQUIRED` | 403 | 当前授权不可用或不含该能力，请先激活授权或升级套餐。 | 授权闸门（license feature/limit）拒绝。 | 激活授权或升级套餐。 |
| `VALID_FIELD_REQUIRED` | 400 | 必填项不能为空，请补全后重试。 | 必填字段为空。 | 补全标红字段后重试。 |
| `VALID_FIELD_INVALID` | 400 | 填写的内容格式不正确，请检查后重试。 | 字段格式/取值非法。 | 按字段提示修正后重试。 |
| `VALID_FIELD_TOO_LONG` | 400 | 填写的内容过长，请精简后重试。 | 字段超出长度上限。 | 精简内容后重试。 |
| `VALID_ENTITY_CONFLICT` | 409 | 该数据已存在或已被修改，请刷新后重试。 | 目标已存在或与当前状态冲突。 | 刷新页面确认最新状态后重试。 |
| `VALID_ENTITY_NOT_FOUND` | 404 | 找不到对应的数据，可能已被删除。 | 目标实体不存在或已删除。 | 返回列表刷新，确认对象是否仍存在。 |
| `SOURCE_UNREACHABLE` | 502 | 远程存储无法连接，请检查网络或稍后重试。 | 远程存储连接失败或超时。 | 检查网络与远端服务状态；确认挂载配置未变。 |
| `SOURCE_AUTH_EXPIRED` | 401 | 远程存储的授权已失效，请重新授权。 | 远端存储授权过期或被吊销。 | 在挂载凭据处重新授权（如 115 重新扫码）。 |
| `SOURCE_UNSUPPORTED` | 400 | 暂不支持该存储类型。 | 暂不支持该存储类型。 | 改用受支持的存储类型。 |
| `SOURCE_NOT_PLAYABLE` | 502 | 该文件无法直接播放，请检查文件格式。 | 文件无法直接播放（编码/容器不支持）。 | 改用转码播放或更换片源。 |
| `SOURCE_VALIDATION_FAILED` | 400 | 远程存储配置校验未通过，请检查配置。 | 远端配置校验未通过。 | 核对挂载配置项（endpoint/密钥/路径）。 |
| `SOURCE_READ_TOO_LARGE` | 400 | 文件过大，超出单次读取上限，请改用播放或分段读取。 | 单次读超字节上限（无界读防线）。 | 改用播放或 Range 分段读取；确认目标是否为旁路大文件。 |
| `PLAYBACK_NOT_DIRECT_PLAYABLE` | 400 | 该视频需要转码后才能播放，当前暂不支持。 | 片源需转码，当前不支持直连。 | 等待转码能力上线或更换片源。 |
| `PLAYBACK_STREAM_UNAVAILABLE` | 502 | 视频流暂不可用，请稍后重试。 | 视频流获取失败。 | 稍后重试；持续失败检查挂载与网络。 |
| `PLAYBACK_SUBTITLE_UNAVAILABLE` | 502 | 字幕暂不可用，请稍后重试。 | 字幕流获取失败。 | 稍后重试，或检查字幕文件是否存在。 |
| `PLAYBACK_SESSION_LIMIT_EXCEEDED` | 429 | 播放并发会话已达上限，请先停止其他播放。 | `max_concurrent_playbacks` 已配置且该用户并发播放数已达上限（quota-playbacks 闸，超限直接拒绝，不撤销最旧）。 | 前端提示先停止其他播放；或由管理员提高 `max_concurrent_playbacks`。 |
| `PLAYBACK_SESSION_EXPIRED` | 404 | 播放会话已结束，请重新开始播放。 | 播放会话已过期或被清理。 | 重新播放即可。 |
| `TASK_ALREADY_RUNNING` | 409 | 该任务正在运行中，请等待完成后再操作。 | 同一任务正在运行。 | 等待当前任务结束；勿重复提交。 |
| `TASK_FAILED` | 409 | 任务执行失败，请查看详情后重试。 | 任务执行失败。 | 在任务中心查看失败原因后重试。 |
| `TASK_NOT_FOUND` | 404 | 找不到该任务，可能已结束或被清理。 | 任务不存在或已被清理。 | 刷新任务列表。 |
| `SYSTEM_CONFLICT` | 409 | 数据状态冲突，请刷新页面后重试。 | 并发写入导致状态冲突。 | 刷新后重试；高频出现需排查并发来源。 |
| `SYSTEM_DEPENDENCY_FAILED` | 504 | 依赖服务响应超时，请稍后重试。 | 依赖服务响应超时。 | 稍后重试；持续超时检查依赖服务健康。 |
| `SYSTEM_INTERNAL` | 500 | 服务器内部错误，请稍后重试或联系管理员。 | 未分类内部错误。 | 记录 trace_id 并提交反馈；管理员查日志定位。 |
| `SYSTEM_DATABASE_ERROR` | 503 | 数据库暂时不可用，请稍后重试。 | 数据库暂时不可用。 | 稍后重试；持续出现检查数据库连接与磁盘。 |
| `COMPAT_UNSUPPORTED_CLIENT` | 400 | 当前客户端版本不受支持，请更新客户端。 | 客户端版本不受支持。 | 更新客户端到受支持版本。 |
| `COMPAT_PROTOCOL_MISMATCH` | 400 | 客户端协议版本不匹配，请更新客户端。 | 客户端协议版本不匹配。 | 更新客户端，或改用兼容端点。 |
| `MOUNT_PROVIDER_NOT_CREATABLE` | 400 | 该存储类型不允许手动创建，请选择其他类型。 | 所选存储类型为系统内部类型或未知类型。 | 改用受支持的存储类型（系统内部类型不可手动创建）。 |
| `MOUNT_NAME_EXISTS` | 409 | 该名称的挂载已存在，请换一个名称。 | 同名挂载已存在。 | 更换挂载名称后重试。 |
| `MOUNT_ROOT_PATH_INVALID` | 400 | 挂载根目录路径不合法，请检查是否包含非法字符。 | 根目录为空、超长或含 `..` 上级跳转。 | 填写真实存在的绝对路径，去掉 `..` 段。 |
| `MOUNT_CONFIG_FIELD_REQUIRED` | 400 | 挂载配置缺少必填项，请补全后重试。 | 缺少该 provider 的必填配置项。 | 按表单提示补全必填项（如 endpoint / bucket / url）。 |
| `MOUNT_BROWSE_UNSUPPORTED` | 400 | 该存储类型不支持目录浏览，请手动填写路径。 | 该 provider 不支持目录浏览。 | 手动填写路径，或改用支持目录浏览的存储类型。 |
| `MOUNT_NOT_FOUND` | 404 | 找不到该挂载，可能已被删除。 | 挂载不存在或已被删除。 | 刷新挂载列表确认。 |
| `MOUNT_STATE_CONFLICT` | 409 | 挂载当前状态不允许该操作，请刷新后重试。 | 挂载当前状态不允许该操作。 | 先停用挂载再操作，或刷新后重试。 |
| `MOUNT_CONFIG_SENSITIVE_EMPTY` | 400 | 挂载配置的凭据项不能为空，请填写后重试。 | 敏感键（密码/令牌等）值为空。 | 填写该凭据项后重试；若不想修改凭据请勿提交该字段。 |
| `MOUNT_SECRET_BOX_UNAVAILABLE` | 500 | 挂载凭据加密服务未就绪，请联系管理员检查服务端配置。 | 服务端 SecretBox 密料（`FMBY_SECRET_BOX_KEY`）缺失或过短。 | 运维配置合法的 `FMBY_SECRET_BOX_KEY`（≥ 32 字符）后重试。 |
| `MOUNT_CONFIG_SEALED_REF_ON_CREATE` | 400 | 创建挂载时凭据项不能携带已密封的引用值，请填写明文凭据后重试。 | Create 请求携带 `__sealed:` 前缀值（创建态没有可继承的密封体）。 | 在凭据字段填写明文；若想复用既有凭据请改用编辑（PATCH）。 |
| `COLLECTION_TITLE_REQUIRED` | 400 | 合集标题不能为空，请填写后重试。 | 合集标题为空（trim 后）。 | 填写合集标题后重试。 |
| `COLLECTION_FIELD_TOO_LONG` | 400 | 合集字段内容过长，请精简后重试。 | 标题/简介/封面地址超出长度上限（512/2000/512 字符）。 | 精简对应字段后重试。 |
| `COLLECTION_VISIBILITY_INVALID` | 400 | 合集可见性取值不合法，请选择有效选项。 | visibility 取值非法。 | 使用受支持的可见性取值（如 public/private）。 |
| `COLLECTION_NOT_FOUND` | 404 | 找不到该合集，可能已被删除。 | 合集不存在或已被删除。 | 刷新合集列表确认。 |
| `COLLECTION_MEMBER_NOT_FOUND` | 404 | 找不到该合集成员，可能已被移除。 | 成员不存在或已被移除。 | 刷新合集详情后重试。 |
| `COLLECTION_MEMBER_ID_INVALID` | 400 | 合集成员 id 格式不合法，请传入十进制数字。 | 成员 id 非十进制整数。 | 使用条目详情返回的数字 id。 |
| `COLLECTION_MEMBER_NOT_OWNED` | 400 | 该成员不属于当前合集，无法排序。 | 排序列表含不属于该合集的成员 id。 | 仅对该合集内的成员排序。 |
| `COLLECTION_RULE_EMPTY` | 400 | 请至少配置一条合集规则。 | 规则集合为空。 | 至少添加一条规则后重试。 |
| `COLLECTION_RULE_EMPTY_VALUES` | 400 | 每条合集规则至少需要一个值。 | 某条规则没有任何有效值（或超预算）。 | 为该规则填写至少一个值。 |
| `COLLECTION_RULE_YEAR_NOT_INTEGER` | 400 | 年份/年代规则值必须是整数。 | year/decade 规则值非整数。 | 填写整数年份（如 2010）或年代起点（如 2010 表示 2010-2019）。 |
| `COLLECTION_RULE_RATING_NOT_NUMERIC` | 400 | 评分规则值必须是数字。 | rating 规则值非数字。 | 填写数字评分下限。 |
| `COLLECTION_RULE_RATING_UNSUPPORTED` | 400 | 评分规则暂不可用：当前无评分数据源。 | V2 无社区评分数据链（评分列/同步链缺口，另立 MEDIA-RATING 卡）。 | 暂不使用 rating 规则；或等待评分数据链落地。 |
| `COLLECTION_RULE_KIND_MISMATCH` | 400 | 该操作仅支持规则合集。 | 对非规则合集调用「编辑规则/手动同步」。 | 仅对 `collection_kind=rule` 的合集执行；人工合集请直接改成员。 |
| `COLLECTION_CANDIDATE_KEYWORD_TOO_SHORT` | 400 | 至少输入 2 个字符再搜索媒体条目。 | 成员候选搜索关键字去空白后 < 2 字符。 | 输入至少 2 个字符的关键字。 |
| `COLLECTION_PRESET_NOT_FOUND` | 404 | 合集预置不存在，请刷新预置列表。 | `POST /api/manage/collections/presets/create` 的 `preset_key` 无匹配模板（预置是服务端静态清单，key 拼错或已下线）。 | 刷新预置列表后选择有效项。 |
| `COLLECTION_PRESET_ALREADY_EXISTS` | 409 | 该预置已创建过合集，请直接使用已有合集。 | `POST /api/manage/collections/presets/create` 的 `preset_key` 已有对应合集（幂等锚 `ux_collections_preset_key` 拒绝重复创建）。 | 直接使用已有合集；不产生第二个副本。 |
| `MFA_TOTP_ALREADY_ENABLED` | 400 | TOTP 已启用，无需重复确认。 | 对已启用的 TOTP 凭据再次调用 `POST /api/auth/mfa/totp/confirm`（重复确认会作废旧恢复码）。 | 已是启用态；如需换绑请先 `DELETE /api/auth/mfa/totp` 关闭，或用自助「重生成恢复码」。 |
| `NAMING_SCRAPE_POSTER_UNSUPPORTED` | 400 | 海报补刮尚未接通（V2 暂无海报落库链路），请只选「补刮缺失元数据」。 | 只勾选了「补刮海报」而海报落库链路未启用。 | 改选「补刮缺失元数据」；海报链路接通后本错误码退役。 |
| `REPROCESS_MODE_UNSUPPORTED` | 400 | 该重处理模式在当前版本没有对应的执行链（V2 未实现），请改用其它模式。 | `POST /api/manage/operations/media-reprocess` 传入 V1 有但 V2 无对位链的 6 个模式之一（LocalNormalize / ReconcileDuplicates / RevalidateInheritedExternalIdValidation / BackfillInheritedChildMetadata / RefreshTmdbBoundChildMetadata / StructureReplay）。 | 改用 V2 已接通的模式（DryRun / StructureReplayDryRun / IncrementalIdentify / IncrementalScrape）；线宽照 V1 全收是刻意保留，不是未知输入。 |
| `REPROCESS_CHAIN_NOT_WIRED` | 400 | 该重处理模式的执行链当前未装配，请联系管理员完成装配后重试。 | 模式在 V2 有链（IncrementalIdentify / IncrementalScrape）但 worker 侧未装配对应 use case。 | 联系管理员完成装配；与「V2 无该链」区分（前者装配缺失，后者永久不支持）。 |
| `AUTH_MFA_UNAVAILABLE` | 503 | 二因子登录验证服务暂时不可用，请稍后重试或联系管理员。 | 登录二因子校验链未就绪（如服务端密料缺失），该账号已启用 TOTP，拒绝登录（fail-closed，不静默跳过二因子）。 | 稍后重试；若持续出现，联系管理员检查服务端 `FMBY_SECRET_BOX_KEY` 配置。 |
  批量补刮只勾选了 `include_missing_poster`（未勾选 `include_missing_metadata`）。 |
  勾选「补刮缺失元数据」；海报补刮待 SCRAPE-ARTWORK 卡（asset_reference('poster') + 图床落库）。 |
| `MEDIA_ITEM_NOT_FOUND` | 404 | 找不到该媒体条目，可能已被删除。 | 媒体条目不存在或已被删除。 | 刷新条目列表确认。 |
| `MEDIA_ITEM_ID_INVALID` | 400 | 媒体条目 id 必须是十进制无符号整数。 | id 串非十进制无符号整数。 | 使用条目列表返回的数字 id。 |
| `MEDIA_ITEM_TYPE_INVALID` | 400 | 媒体类型仅支持 movie/series/season/episode。 | media_type 取值不在白名单。 | 使用受支持的媒体类型过滤。 |
| `MEDIA_ITEM_SORT_BY_INVALID` | 400 | 排序字段仅支持 updated_at/created_at/title。 | sort_by 取值不在白名单。 | 使用受支持的排序字段。 |
| `MEDIA_ITEM_SORT_ORDER_INVALID` | 400 | 排序方向仅支持 asc/desc。 | sort_order 取值不在白名单。 | 使用 asc 或 desc。 |
| `MEDIA_ITEM_SOURCE_NOT_FOUND` | 404 | 找不到该条目的媒体源，可能已被移除。 | 条目媒体源不存在或已被解绑。 | 刷新条目详情确认。 |
| `MEDIA_ITEM_SCAN_CONFLICT` | 409 | 该条目正在扫描中，请等待完成后再操作。 | 条目级扫描正在进行，重复触发。 | 等待当前扫描结束后重试。 |
| `USER_NOT_FOUND` | 404 | 找不到该用户，可能已被删除。 | 用户不存在或已被删除。 | 刷新用户列表确认。 |
| `USER_STATUS_INVALID` | 400 | 用户状态取值不合法。 | 用户状态串不在白名单。 | 使用受支持的用户状态（active/disabled/suspended）。 |
| `USER_SELF_DISABLE_FORBIDDEN` | 400 | 不能停用或挂起当前登录账号。 | 目标账号即当前会话账号且目标状态非 active。 | 改用其他管理员账号操作。 |
| `USER_SELF_DELETE_FORBIDDEN` | 400 | 不能删除当前登录账号。 | 目标账号即当前登录账号。 | 由其他管理员执行删除。 |
| `USER_LAST_ADMIN_PROTECTED` | 409 | 不能停用或删除最后一个管理员账号。 | 操作会使 active 管理员数量降为 0。 | 先指定另一名管理员后再操作。 |
| `USER_PASSWORD_TOO_SHORT` | 400 | 新密码长度不能少于 8 个字符。 | 新密码 trim 后少于 8 字符。 | 设置至少 8 个字符的密码。 |
| `USER_BATCH_EMPTY` | 400 | 请至少选择一个用户。 | 批量请求 user_ids 为空。 | 勾选至少一个用户后重试。 |
| `USER_BATCH_NO_CHANGE` | 400 | 请至少选择一种批量更新项（状态或角色）。 | 批量请求既无状态也无角色。 | 选择要更新的状态或角色。 |
| `USER_BATCH_DISABLE_WRONG_ENDPOINT` | 400 | 批量停用请使用批量停用接口。 | 批量更新接口传入了 disabled 状态。 | 改用「批量停用」专用接口。 |
| `USER_MULTI_ROLE_UNSUPPORTED` | 400 | 当前版本为单角色模型，批量改角色只接受一个角色。 | 批量请求 roles 传入多于一个角色。 | 只提交一个角色名。 |
| `USER_ROLE_NOT_FOUND` | 400 | 指定的角色不存在。 | 角色名在角色表中不存在。 | 使用角色列表中的有效角色名。 |
| `USER_SOURCE_GRANTS_UNSUPPORTED` | 400 | 当前版本不支持来源路径授权（无对应数据表）。 | 批量请求携带 source_grants。 | 移除 source_grants 字段后重试。 |
| `USER_ACCOUNT_KIND_FILTER_UNSUPPORTED` | 400 | 当前版本不支持按账号类型过滤。 | 列表查询携带非空 accountKind。 | 移除 accountKind 过滤条件。 |
| `USER_IP_INVALID` | 400 | 来源 IP 必须是合法的 IPv4 或 IPv6 地址。 | IP 串无法解析为合法地址。 | 填写合法的 IPv4/IPv6 地址。 |
| `USER_ELEVATED_ACTION_FORBIDDEN` | 403 | 操作管理员账号需要管理员权限。 | 非管理员尝试操作管理员账号。 | 使用具备管理员权限的账号操作。 |
| `USER_ROLE_TEMPLATE_UNSUPPORTED` | 400 | 当前版本不支持角色模板（无 role_templates 表）。 | Create/Update 请求携带 role_template_id。 | 移除 role_template_id，改用 role/roles。 |
| `USER_LIBRARY_IDS_UNSUPPORTED` | 400 | 当前版本不支持按库授权指定 library_ids（无写端口）。 | Create/Update 请求携带非空 library_ids。 | 移除 library_ids（库授权走后续卡）。 |
| `UPSTREAM_SOURCE_TYPE_INVALID` | 400 | 上游源类型不合法，请使用受支持的源类型。 | source_type 取值不在白名单（含别名）。 | 改用受支持的源类型（如 AppleCMS/Emby）。 |
| `UPSTREAM_AUTH_METHOD_INVALID` | 400 | 上游鉴权方式不合法，请使用受支持的鉴权方式。 | auth_method 取值不在白名单（含别名）。 | 使用受支持的鉴权方式（用户名密码 / API Key）。 |
| `UPSTREAM_STATUS_INVALID` | 400 | 上游源状态过滤值不合法。 | status 过滤值非白名单。 | 使用受支持的状态过滤值。 |
| `UPSTREAM_SOURCE_NOT_FOUND` | 404 | 找不到该上游源，可能已被删除。 | 上游源不存在或已被删除。 | 刷新上游列表确认。 |
| `UPSTREAM_CATEGORY_KIND_INVALID` | 400 | 上游分类类型不合法。 | category kind 取值不在白名单。 | 使用受支持的分类类型。 |
| `UPSTREAM_SOURCE_TYPE_MISMATCH` | 400 | 该操作与上游源类型不匹配。 | 对该源用了不匹配的源类型端点（如对 AppleCMS 源用 Emby 操作）。 | 对 AppleCMS 源用 AppleCMS 操作，Emby 源用 Emby 操作。 |
| `UPSTREAM_NO_CATEGORIES` | 502 | 上游未返回任何可用的分类或媒体库。 | 上游发现调用返回空分类集。 | 检查上游服务与凭据后重试。 |
| `UPSTREAM_CREDENTIAL_REJECTED` | 503 | 上游拒绝了当前凭据，请重新填写。 | 上游以凭据拒绝响应（401/403）。 | 更新上游源凭据后重试。 |
| `UPSTREAM_CREDENTIAL_BLOCKED` | 503 | 上游凭据已被停用或封禁，请更换凭据或联系管理员。 | 上游凭据被停用/封禁（TMDB 10 Suspended API key / 豆瓣 `apikey_is_blocked`）。 | 该错误**绝不静默回落**：在管理面显式告警，引导用户更换或解封凭据后再试。 |
| `UPSTREAM_CHANNEL_CLOSED` | 503 | 上游该接口面已关闭，请稍后重试或等待恢复。 | 上游接口面已关闭（豆瓣 `invalid_request_997`）：属上游维护/瞬时，非用户频率问题。 | 稍后重试；持续出现检查上游服务状态（与限流区分，不要按 429 退避）。 |
| `UPSTREAM_MAPPING_EMPTY` | 400 | 没有可保存的映射项，请先选择要映射的分类。 | 映射保存请求无可选中的映射项。 | 勾选至少一个分类后保存。 |
| `UPSTREAM_MAPPING_CONFLICT` | 400 | 映射预览存在冲突，请修正后再保存。 | 映射预览含 Conflict 项却尝试保存。 | 解决预览中的冲突项后重试。 |
| `UPSTREAM_MAPPING_PRESET_NOT_FOUND` | 404 | 找不到该映射预设。 | 映射预设不存在或已被删除。 | 刷新预设列表确认。 |
| `UPSTREAM_MAPPING_TARGET_INVALID` | 400 | 映射目标媒体库不合法（不存在或缺少建库计划）。 | 目标媒体库不存在、未提供，或建库计划缺失。 | 选择已存在的媒体库，或补全建库计划。 |
| `UPSTREAM_LIBRARY_TYPE_UNSUPPORTED` | 400 | 当前版本不支持该媒体库类型。 | 请求的库类型（如 Music）V2 不支持。 | 改用受支持的媒体库类型。 |
| `MICROSOFT_DEPLOYMENT_INVALID` | 400 | Microsoft 认证只支持国际版或中国版。 | provider_type 非 MicrosoftGlobal/MicrosoftChina。 | 使用 MicrosoftGlobal 或 MicrosoftChina。 |
| `MICROSOFT_SERVICE_KIND_INVALID` | 400 | 服务类型只能是 OneDrive 或 SharePoint。 | service_kind 取值不在白名单。 | 使用 onedrive 或 sharepoint。 |
| `MICROSOFT_ACCOUNT_NOT_FOUND` | 404 | 找不到该 Microsoft 账号。 | 账号或授权记录不存在。 | 刷新账号列表确认。 |
| `MICROSOFT_AUTH_NOT_PENDING` | 400 | 当前授权记录不是待完成状态。 | 授权记录已完成/过期，重复完成。 | 重新发起授权后再完成。 |
| `MICROSOFT_CALLBACK_URL_INVALID` | 400 | 回调地址不是合法 URL。 | callback_url 无法解析为绝对 URL。 | 使用回调服务返回的完整 URL。 |
| `MICROSOFT_CALLBACK_MISSING_STATE` | 400 | 回调地址中缺少 state 参数。 | callback_url 无 state query 参数。 | 使用完整回调 URL（含 state）。 |
| `MICROSOFT_AUTH_STATE_MISMATCH` | 400 | 授权 state 校验失败，请重新发起授权。 | 回调 state 与授权记录不匹配。 | 重新发起授权流程。 |
| `MICROSOFT_CALLBACK_MISSING_CODE` | 400 | 回调地址中缺少 code 参数。 | callback_url 无 code query 参数。 | 使用完整回调 URL（含 code）。 |
| `MICROSOFT_CODE_VERIFIER_MISSING` | 400 | 授权记录缺少 code_verifier。 | 授权记录未存 code_verifier（PKCE）。 | 重新发起授权流程。 |
| `MICROSOFT_REDIRECT_URI_MISSING` | 400 | 自定义 OAuth 缺少 redirect_uri。 | 自定义 OAuth 客户端未配 redirect_uri。 | 为自定义 OAuth 客户端配置 redirect_uri。 |
| `MICROSOFT_ACCOUNT_NOT_AUTHORIZED` | 400 | Microsoft 账号尚未完成授权或缺少访问令牌。 | 账号 Pending 或缺 access token 却调用 Graph。 | 重新完成授权。 |
| `MICROSOFT_NOTE_INVALID` | 400 | 备注内容不合法。 | 账号备注超长或含非法字符。 | 精简备注内容后重试。 |
| `YUN139_CREDENTIALS_EMPTY` | 400 | authorization 与 cookie 不能同时为空。 | 提交的凭据两者皆空。 | 至少填写 authorization 或 cookie。 |
| `YUN139_QR_LOGIN_UNSUPPORTED` | 503 | 139 扫码登录暂未支持。 | 段 A 未接线扫码登录。 | 直接提交 authorization 或 cookie。 |
| `YUN139_PROFILE_NOT_FOUND` | 404 | 找不到该 139 凭据档案。 | 凭据档案不存在或已被删除。 | 刷新凭据档案列表确认。 |
| `YUN139_PROFILE_IN_USE` | 409 | 该凭据档案仍被账号池引用，请先从池中移除成员。 | 删除仍被池引用的凭据档案。 | 先从账号池移除该档案成员。 |
| `YUN139_POOL_NOT_FOUND` | 404 | 找不到该 139 账号池。 | 账号池不存在或已被删除。 | 刷新账号池列表确认。 |
| `YUN139_POOL_NAME_REQUIRED` | 400 | 账号池名称不能为空。 | 池名称 trim 后为空。 | 填写账号池名称。 |
| `YUN139_POOL_STRATEGY_INVALID` | 400 | 账号池调度策略不合法。 | strategy 取值不在白名单。 | 使用受支持的调度策略。 |
| `YUN139_POOL_COOLDOWN_INVALID` | 400 | 冷却秒数不能为负。 | cooldown_seconds < 0。 | 填写非负的冷却秒数。 |
| `YUN139_POOL_MAX_CONCURRENT_INVALID` | 400 | 并发上限必须大于 0。 | max_concurrent <= 0。 | 填写大于 0 的并发上限。 |
| `YUN139_POOL_MEMBER_WEIGHT_INVALID` | 400 | 成员权重必须大于 0。 | weight <= 0。 | 填写大于 0 的权重。 |
| `YUN139_POOL_DISABLED` | 409 | 该 139 账号池已停用。 | 对已停用池发起租借。 | 启用账号池后重试。 |
| `YUN139_POOL_CONCURRENCY_LIMIT` | 409 | 账号池并发已达上限，请稍后重试。 | 在飞租借数达 max_concurrent。 | 等待在飞请求结束或提高并发上限。 |
| `YUN139_POOL_NO_AVAILABLE_ACCOUNT` | 409 | 账号池暂无可用账号（可能全部冷却、过期或停用）。 | 池内无可用成员（冷却/过期/停用）。 | 检查成员凭据状态或稍后重试。 |
| `YUN139_SCHEDULER_UNAVAILABLE` | 503 | 139 池调度服务未就绪。 | 服务端未装配池调度端口。 | 检查服务端装配后重试。 |
| `YUN139_CREDENTIALS_SEAL_FAILED` | 503 | 139 凭据加密失败。 | 凭据 SecretBox 密封失败。 | 检查服务端密钥配置后重试。 |

| `PAN115_QR_LOGIN_UNSUPPORTED` | 503 | 115 扫码登录暂未支持（115SDK 绑定层未交付）。 | 115SDK 绑定层未交付，扫码实现未接线（fail-closed）。 | 稍后重试，或改用 Cookie 绑定方式。 |
| `PAN115_QR_SESSION_REQUIRED` | 400 | 缺少扫码会话标识（session_id）。 | 轮询/换取凭据时未携带 session_id。 | 重新发起扫码并携带返回的 session_id。 |
| `PAN115_QR_SESSION_EXPIRED` | 404 | 扫码会话不存在或已过期，请重新发起扫码。 | 扫码会话已被回收或超时。 | 重新发起扫码登录。 |
| `PAN115_CREDENTIAL_MISSING` | 409 | 115 凭据尚未绑定或缺失，请先完成扫码登录。 | 挂载尚未绑定 115 凭据，或凭据被解绑。 | 先完成 115 扫码登录/凭据绑定。 |
| `PAN115_COOKIE_INVALID` | 400 | 115 Cookie 不能为空或格式非法。 | 提交的 115 Cookie 为空或无法解析出用户标识。 | 重新扫码，或提交有效的 115 Cookie。 |
| `PAN115_PATH_TRAVERSAL` | 400 | 115 路径越界（超出挂载根目录）。 | 目标路径逃出挂载根目录。 | 改用挂载根目录内的路径。 |
| `PAN115_PATH_NOT_FOUND` | 404 | 115 路径不存在。 | 115 云端不存在该路径。 | 核对路径，必要时触发重新扫描。 |
| `PAN115_ACCOUNT_NOT_ACTIVATED` | 409 | 115 账号尚未完成扫码激活。 | 115 账号未完成扫码激活。 | 完成扫码激活后重试。 |
| `PAN115_CREDENTIAL_MODULE_UNAVAILABLE` | 503 | 115 凭据管理服务未就绪。 | 凭据服务未装配或实例密钥不可用。 | 检查服务端凭据模块装配与密钥文件。 |
| `PAN115_IMGHOST_UNAVAILABLE` | 503 | 115 图床服务未就绪。 | 图床模块未启用或端口未装配。 | 启用图床模块并检查密钥配置。 |
| `PAN115_IMGHOST_CREDENTIAL_INACTIVE` | 409 | 115 图床凭据未激活，请先扫码绑定。 | 图床凭据状态非 Active（Pending/Expired/Unbound）。 | 先完成图床扫码绑定。 |
| `PAN115_IMGHOST_EXTENSION_UNSUPPORTED` | 400 | 图片扩展名不在白名单内。 | 上传文件扩展名不在白名单。 | 改用白名单内图片格式（如 jpg/png/webp/gif）。 |
| `PAN115_IMGHOST_EMPTY_FILE` | 400 | 上传文件为空。 | 上传内容长度为 0。 | 选择非空文件后重新上传。 |
| `PAN115_IMGHOST_FILE_TOO_LARGE` | 413 | 图片超过 20MB 上限。 | 上传图片体积超过 20MB 上限。 | 压缩图片或改用更小体积文件。 |
| `PAN115_IMGHOST_ASSET_NOT_FOUND` | 404 | 图床资产不存在。 | 图床资产已删除或从未入库。 | 重新上传，或核对资产 ID。 |
| `PAN115_SHARE_LISTING_TOO_LARGE` | 413 | 该 115 分享目录过大，无法安全导入；请缩小分享规模后重试。 | 请求合法但分享目录条目数超过安全上限。 | 缩小分享同步规模（拆分分享或减少条目）后重试。 |
| `PAN115_SHARE_UNAVAILABLE` | 503 | 115 分享暂时无法访问（分享链接可能已失效），请稍后重试或重新配置分享。 | share_code/receive_code 失效等上游原因，可重试。 | 确认分享链接有效后重试；持续失败检查 115 分享状态。 |
| `RUNTIME_LOG_EXPORT_RANGE_TOO_LARGE` | 413 | 导出范围过大：请缩小时间窗（最长 7 天），或按级别/模块筛选后分批导出。 | 导出请求的时间窗或行数超过安全上限。 | 缩小时间窗，或增加级别/模块筛选后分批导出。 |
| `MEDIA_REQUEST_INVALID_TRANSITION` | 400 | 该求片单当前状态无法变更为目标状态，请刷新后查看最新进度。 | 状态机不允许的跃迁（含非法回退）。 | 刷新查看求片单最新状态后按可跃迁路径操作。 |
| `REWARD_QUOTA_INSUFFICIENT` | 409 | 求片额度不足：可先兑换求片券或联系管理员补充额度。 | 当前配额余额低于本次消耗。 | 兑换求片券或联系管理员补充额度后重试。 |
| `LIBRARY_NOT_FOUND` | 404 | 媒体库不存在，可能已被删除。 | 按 ID 查询/更新/删除媒体库时其不存在。 | 刷新媒体库列表后重试。 |
| `LIBRARY_NO_FIELDS_TO_UPDATE` | 400 | 没有需要更新的媒体库字段。 | 更新请求既无 name 也无 kind。 | 至少提供一个待更新字段。 |
| `INSTALL_BAD_REQUEST` | 400 | 安装请求参数不合法。 | 安装请求缺少必填项或取值非法。 | 按安装向导要求补全参数后重试。 |
| `INSTALL_CONFLICT` | 409 | 当前安装状态与请求冲突，无法继续。 | 重复初始化或安装阶段不允许该操作。 | 刷新安装状态，按当前阶段操作。 |
| `INSTALL_FORBIDDEN` | 403 | 当前不允许访问安装接口。 | 未授权访问或实例已安装后调用安装面。 | 已安装实例勿调用安装接口；核对来源。 |
| `INSTALL_INTERNAL_ERROR` | 500 | 安装过程发生内部错误，请查看服务端日志。 | 依赖安装、落盘或数据库初始化失败。 | 查看服务端日志定位具体失败步骤。 |
| `INSTALL_RATE_LIMITED` | 429 | 安装接口请求过于频繁，请稍后再试。 | 安装面 IP 固定窗口限流命中。 | 等待限流窗口结束再重试。 |
| `INSTALL_NOT_CONFIGURED` | 503 | 安装服务未就绪。 | 安装子系统端口未装配。 | 检查服务端安装模块装配。 |
| `PERSON_NOT_FOUND` | 404 | 人物不存在。 | 人物详情/关联作品查询的对象不存在或已删除。 | 刷新人物列表后重试。 |
| `REWARD_LEDGER_LIMIT_INVALID` | 400 | 积分流水查询条数必须为正整数。 | 流水查询 limit = 0（无界拉取）。 | 传入 ≥1 的条数后重试。 |
| `SECRETS_OVERRIDES_EMPTY` | 400 | 密钥覆盖请求不能为空，至少提供一个键。 | 覆盖请求 overrides 为空。 | 至少提供一个待覆盖键后重试。 |
| `SECRETS_OVERRIDE_KEY_INVALID` | 400 | 密钥覆盖键不在允许列表内。 | 覆盖键不在白名单（含只读/未知键）。 | 使用受支持的配置键。 |
| `SECRETS_FILE_READ_FAILED` | 503 | 读取密钥覆盖文件失败。 | 覆盖文件存在但解析/读取失败。 | 检查覆盖文件权限与格式。 |
| `SECRETS_FILE_WRITE_FAILED` | 503 | 写入密钥覆盖文件失败。 | 覆盖文件原子写盘失败。 | 检查磁盘与目录权限。 |
| `SECRETS_AUDIT_UNAVAILABLE` | 503 | 审计端口未装配，已拒绝密钥覆盖。 | 审计端口缺失，fail-closed 拒绝。 | 装配审计端口后重试。 |
| `SECRETS_AUDIT_WRITE_FAILED` | 500 | 审计写入失败，已拒绝密钥覆盖。 | 审计写盘失败，fail-closed 拒绝。 | 排查审计写路径后重试。 |
| `TELEGRAM_SEARCH_QUERY_REQUIRED` | 400 | 搜索关键词不能为空。 | Telegram 搜索 query 为空。 | 输入关键词后重试。 |
| `TELEGRAM_SEARCH_UNAVAILABLE` | 503 | Telegram 搜索索引未就绪，请稍后再试。 | 搜索运行时未就绪。 | 等待索引就绪后重试。 |
| `TELEGRAM_WEBHOOK_UNAVAILABLE` | 503 | Telegram webhook 未就绪（机器人未启用或密钥未配置）。 | webhook 端口未装配。 | 启用机器人并配置 webhook 密钥。 |
| `TELEGRAM_WEBHOOK_SECRET_MISSING` | 403 | 请求缺少 Telegram webhook 校验密钥。 | 入站请求缺 secret 头。 | 由 Telegram 平台投递（自动携带）。 |
| `TELEGRAM_WEBHOOK_SECRET_MISMATCH` | 403 | Telegram webhook 校验密钥不匹配。 | secret 头与配置不符。 | 核对 webhook 密钥配置。 |
| `TELEGRAM_UPDATE_ID_INVALID` | 400 | Telegram 更新标识缺失或无效。 | payload 缺 update_id 或非有效数值。 | 由 Telegram 平台投递（自动携带）。 |
| `TELEGRAM_CHALLENGE_NOT_FOUND` | 404 | 身份挑战不存在或已失效。 | challenge_id 无对应记录。 | 重新发起身份绑定。 |
| `TELEGRAM_CHALLENGE_CONSUMED` | 400 | 身份挑战已被使用或不可用。 | challenge 状态非 Pending。 | 重新发起身份绑定。 |
| `TELEGRAM_CHALLENGE_EXPIRED` | 400 | 身份挑战已过期。 | challenge 超过有效期。 | 重新发起身份绑定。 |
| `TELEGRAM_CHALLENGE_WRONG_PROVIDER` | 400 | 身份挑战并非来自 Telegram 渠道。 | challenge.provider_type ≠ Telegram。 | 使用对应渠道完成绑定。 |
| `LICENSE_DEVICE_FLOW_NOT_STARTED` | 400 | 尚未发起设备授权流程。 | 轮询时无 device_code。 | 先发起设备授权流程。 |
| `LICENSE_ACTIVATION_TOKEN_REQUIRED` | 400 | 激活令牌不能为空。 | activation_token 为空。 | 填写激活令牌后重试。 |
| `LICENSE_NOT_ACTIVATED` | 400 | 当前实例尚未激活。 | 心跳时无有效激活/租约。 | 先完成实例激活。 |
| `LICENSE_HEARTBEAT_UNAVAILABLE` | 400 | 当前授权不可用，无法续租。 | 租约状态不允许业务访问。 | 重新激活或联系服务支持。 |
| `LICENSE_LEASE_VERIFY_FAILED` | 500 | 授权租约校验失败，请联系服务支持。 | SignedLease 验签/字段不匹配。 | 联系服务支持核对授权信任根。 |
| `LICENSE_DEVICE_REPLACED` | 409 | 授权已被转移到其他设备，本设备已下线。 | 本设备激活被另一台设备顶掉（服务端 `activations.status='replaced'`）。 | 确认是否为本人换机；是则在新设备使用，本设备需重新激活（会把对方顶掉）。 |
| `LICENSE_DEVICE_REPLACED_COOLDOWN` | 409 | 换机过于频繁，请稍后再试。 | 换机被服务端风控判定冷却（短时高频换机）。 | 等待冷却窗口结束后重试；持续出现请联系服务支持。 |
| `LICENSE_DEVICE_REPLACED_REVIEW` | 409 | 换机操作需人工复核，请联系服务支持。 | 换机被服务端风控判定需人工复核。 | 联系服务支持完成复核。 |
| `LICENSE_ACTIVATION_LIMIT_EXCEEDED` | 409 | 当前授权已达可激活设备上限。 | 活跃设备数达上限且无法自动挑选被顶替者。 | 在授权平台解绑不再使用的设备后重试。 |
| `NOT_IMPLEMENTED` | 501 | 该功能尚未实现。 | 端点/功能为产品有意不实现（V1 stub 面），非服务端故障。 | 无需重试（重试不会变好）；关注该功能的产品进度，勿当故障报警。 |
| `PG_DNS_UNRESOLVED` | 503 | 无法解析 PostgreSQL 主机地址（DNS 解析失败）。 | 连接预检阶段无法将 host 解析为 IP（#645 结构化预检）。 | 检查 `FMBY_DATABASE_URL` 主机名拼写与 DNS 可达性；网络恢复后重试。 |
| `PG_TCP_UNREACHABLE` | 503 | 无法连接到 PostgreSQL 服务（TCP 不可达或端口无响应）。 | 主机已解析但端口无响应/连接被拒/网络不可达（#645）。 | 检查 PG 实例是否启动、端口/防火墙、`depends_on` 健康状态；网络恢复后重试。 |
| `PG_AUTH_FAILED` | 503 | PostgreSQL 认证失败（用户名或密码错误）。 | 凭据被拒（SQLSTATE 28P01）（#645）。 | 核对 `FMBY_DATABASE_URL` 中的用户名/密码；确认角色已建且未被封禁。 |
| `PG_DATABASE_MISSING` | 503 | PostgreSQL 目标数据库不存在。 | 连接目标库不存在（SQLSTATE 3D000）（#645）。 | 确认 `FMBY_DATABASE_URL` 的库名正确；先 `CREATE DATABASE` 或授权该角色建库。 |
| `PG_SCHEMA_NOT_WRITABLE` | 503 | PostgreSQL schema 不可写（权限不足或无法创建）。 | schema 不存在且不可建，或无 CREATE/USAGE 权限（SQLSTATE 3F000/42501）（#645）。 | 确认 `FMBY_PG_SCHEMA` 合法且角色有该 schema 的 CREATE/USAGE 权限；或预先 `CREATE SCHEMA`。 |

## 域覆盖进度

| 域 | 状态 | 说明 |
|---|---|---|
| 认证 / 权限 / 校验 / 来源 / 播放 / 任务 / 系统 / 兼容 | ✅ 已有（旧 38 码） | 已有码 + 中文文案补齐 |
| **挂载（mounts）** | ✅ 本批补齐（10 码） | 域样例：`MOUNT_*`（MOUNT-CRED-SEAL 追加 2 码 + §3.3③ sealed-ref 1 码） |
| **合集 / 媒体条目 / 用户** | ✅ 第 2 批补齐（29+2 码） | `COLLECTION_*` 7 + `MEDIA_ITEM_*` 7 + `USER_*` 17（ERR-TAXONOMY-B2 + USER-CRUD 追加 2 码；仅建字典，handler 迁移留待各域卡） |
| **上游源 / Microsoft / 139 云盘** | ✅ 第 3 批补齐（40 码） | `UPSTREAM_*` 13 + `MICROSOFT_*` 12 + `YUN139_*` 15（ERR-TAXONOMY-B3；仅建字典，handler 迁移留待各域卡；pan115 待 PAN115-ERRNO(dsh) 合并后追加） |
| **115 网盘（pan115）** | ✅ 第 4 批补齐（15 码） | `PAN115_*` 15（ERR-TAXONOMY-B4；仅建字典，handler 迁移留待域卡；errno 语义仍由 PAN115-ERRNO 的 `Source*` 码承担，不重复造码） |
| **媒体库（libraries）** | ✅ B5a 部分（2 码） | `LIBRARY_*` 2（其余名称/类型校验复用 `VALID_FIELD_*`：`parse_library_kind`/`require_field`/`check_bounded` 为跨域共享，不挂域前缀） |
| **安装面（install）** | ✅ B5a（6 码） | `INSTALL_*` 6（对齐 V1 `installer/types.rs` 稳定码 + V2 新增未装配码） |
| **人物（people）** | ✅ B5b（1 码） | `PERSON_*` 1 |
| **积分（rewards）** | ✅ B5b（1 码） | `REWARD_*` 1（账户不存在设计为 `account:null` 非错误） |
| **密钥链（secrets）** | ✅ B5b（6 码） | `SECRETS_*` 6 |

| **Telegram（telegram）** | ✅ B5c（10 码） | `TELEGRAM_*` 10 |
| **授权（license）** | ✅ B5c（9 码） | `LICENSE_*` 9（「授权不含能力」复用既有 `PERM_LICENSE_DENIED`，不新造——裁决 #5） |
| **协议面（未实现）** | ✅ ADMIN-V1-STUBS-501（1 码） | `NOT_IMPLEMENTED` 1（501；V1 stub 面此前误用 `AppError::Internal`⇒500 冒充内部错误） |

## 相关

- 代码：`crates/fmby-v2-contracts/src/error_code.rs`、`crates/fmby-v2-contracts/src/error.rs`
- wire：`crates/fmby-v2-http/src/errors.rs`（`error_code_of` / `client_message`）
- 状态：`crates/fmby-v2-http/src/routes/auth.rs`（`status_of`）
- 门禁：`scripts/check-error-catalog.mjs`
