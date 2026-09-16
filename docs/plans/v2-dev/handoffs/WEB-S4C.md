# WEB-S4C 交接（w1 · 前端仓 w/zcode/writer1-web-s4c）

> WEBDAV-S3-FE：WebDAV / S3 兼容来源的**结构化创建表单 + 目录浏览**。
> 后端 w2 `WEBDAV-S3-ENABLE` 已放行 `is_creatable()` / `supports_directory_browser()`。

- 基线：`origin/main` @ `ce0122b`
- 提交：`50faa4d`（单一 green commit）
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS）
- 口径依据：w2 handoff `docs/plans/v2-dev/handoffs/WEBDAV-S3-ENABLE.md` §3

---

## 1. 交付内容

### ① 结构化表单（此前 webdav/s3 落在「手填 config_json」回落分支）

新增 `sections/WebDavS3ConnectionSection.tsx`，create / edit 两分支均接入：

| provider | 必填 | 可选 |
|---|---|---|
| **WebDAV** | 服务地址（→ `configJson.url`） | username、password |
| **S3 兼容** | 服务地址（→ `endpoint`）、**bucket** | region、key 前缀、access_key、secret_key |

字段级提示：缺地址 / 缺 bucket / 根路径非法，均在对应字段下方具名报错。

### ② root_path 归一（§3.2）

| 输入 | WebDAV | S3 |
|---|---|---|
| `movies/2024` | `/movies/2024` | `movies/2024` |
| `/movies/2024` | `/movies/2024` | `movies/2024` |
| 空 / `/` | `/` | `/` |
| 含 `..` | **报错**（不静默剔除） | **报错** |

**为什么 `..` 报字段错而不是过滤掉**：后端 §3.2 明确 `..` 一律 400（穿越防线）。
若前端静默改成 `/a/b`，用户会以为自己填的值被接受——实际被后端拒，且拿不到提示。
按 RB-4「不伪造」口径，返回空值 + 字段级错误。

> **注**：既有的 `normalizeRemoteMountPath`（AList/OpenList）**仍有同样的静默 `..` 过滤**
> （`.filter(segment => segment !== '..')`）。本卡**未改既有行为**（避免动到存量挂载兼容面），
> 仅在新增的 WebDAV/S3 路径上按后端新口径处理。**建议后续单卡统一**，见 §4。

### ③ 目录浏览

`supportsDirectoryBrowser()` 放行 `webdav` / `s3-compatible`；复用既有
`POST /api/manage/mounts/browse-directories` 与 `MountDirectoryBrowserCard`。
**创建态为内联 config、不落库、不过 `validate_mount`**（已实证），故浏览时明文凭据可用。

### ④ 顺带清掉一条基线

抽 `sections/MountProviderFields.tsx`：create / edit 两个分支此前**逐行重复**整段
连接配置分派，合并后 `MountDrawer.tsx` **406 → 365**，从基线移除。
**基线 13 → 12。**

---

## 2. 消费端点

| Method | Path | 用途 |
|---|---|---|
| `POST` | `/api/manage/mounts` | 创建挂载（`providerType: "WebDAV" \| "S3Compatible"`） |
| `PATCH` | `/api/manage/mounts/{id}` | 更新挂载（同结构化字段） |
| `POST` | `/api/manage/mounts/browse-directories` | 目录浏览 |

---

## 3. ⚠️ 未闭环：凭据依赖后端 `MOUNT-CRED-SEAL`

**问题**：`password` / `access_key` / `secret_key` 属后端敏感键
（`ConfigJsonValue::validate` 敏感名单），值必须是 `__sealed:<key_id>`，否则 400。
但**前端无法取得该引用**：

1. HTTP 层**无 seal 端点**（220 端点真值全查过；`credentials.rs` 只有 115 的 qr_login/activate）；
2. SecretBox 是**服务端内部组件**，仅 `bridges/*` 可见；
3. 挂载的密封键 `sb.mount.{id}` 由服务端**创建时派生**（`bridges/manage.rs:86-89`），
   `id` 提交前不存在。

**裁决 B**：后端 `create_mount` 入站收明文 → bridge 侧 SecretBox 密封后落库 → 回显仍是
`__sealed:<key>`；前端零改动。

**本卡处理**：凭据字段**照做**（password / AK / SK 输入框齐全），以明文提交，
并在 `formUtils.buildWebDavS3Config` 上方留注释标明依赖。
**在 `MOUNT-CRED-SEAL` 合并前，带凭据创建会被后端 400**——
非敏感路径不受影响（WebDAV 匿名、S3 公开桶 / IAM role）。

**合并顺序**：w2 的 `MOUNT-CRED-SEAL` 先合，本卡后合（或同批），表单即真能创建成功。

**附带发现（已单开 `MOUNT-CRED-SEAL`，不属本卡）**：这**不只是新功能问题**——
既有 **AList/OpenList 带账号密码或 token 创建同样 400**（`buildStructuredRemoteConfig`
明文提交 password/token，同在敏感名单）。即**所有带凭据的挂载创建都走不通**。

---

## 4. 待办 / 需裁决

1. **`normalizeRemoteMountPath`（AList/OpenList）的静默 `..` 过滤**——与新增口径不一致
   （新增为报错，既有为静默剔除）。是否统一为报错？**建议是**（同为穿越防线），
   但属既有行为变更，需确认存量挂载兼容面。**未在本卡做。**
2. **编辑态 S3 的 prefix 回填**：`extractRemoteConfigState` 里 prefix 目前回填空串
   （S3 的 root_path 即 key 前缀，理论上可从 `detail.rootPath` 回填）。
   当前编辑 S3 挂载时前缀框为空、但保存会用既有 rootPath —— 不丢数据，
   但表单显示与实际不同源。**建议后续补一行回填。**
3. **AK/SK 输入框为 `type="password"`**：编辑态后端回显的是 `__sealed:<key>`
   （永不回明文），前端把它放进密码框展示成引用串，用户可能困惑。
   是否改成「已设置凭据，留空则不修改」的占位提示？**待 MOUNT-CRED-SEAL 落地再定**
   （届时才知道后端 PATCH 对敏感键的语义）。
4. **`can_random_read=false` 的播放影响**（w2 §7-S3 登记）：S3/WebDAV 按保守口径置 false，
   若前端需要 seek 播放需回溯。**不在本卡**，登记备查。

---

## 5. 验证记录

- `pnpm verify` **12 闸全绿**（exit 0，34 PASS）
- 归一规则用独立脚本交叉验证 10 条（/ 前缀、去前导 /、`..` 拒绝、空根、`.` 剔除）全通过
- 构建产物确认 wire 字段就位：`bucket` / `access_key` / `secret_key` / Key 前缀 / 服务地址
- `component-size` 闸：0 违规；`MountDrawer` 达标回收，基线 13 → 12
