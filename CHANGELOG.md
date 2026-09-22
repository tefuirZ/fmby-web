## [0.5.1] - 2026-09-23

**本版提交**：1 个 ｜ **改动**：2 files changed, 10 insertions(+), 15 deletions(-)

### 本版做了什么

#### host（应用壳/页面）（1）

- fix(mounts): 详情面补接观察面处置建议（W5-A 遗漏项）（`48f9631`）

### 相对上版

- 上版 tag：v0.5.0
- 2 files changed, 10 insertions(+), 15 deletions(-)

### 验证

- pnpm verify 日志：`/tmp/fe-verify12.log`（mtime 2026-09-22T23:09:08.103Z）
- [PASS] 33 项 / [FAIL] 0 项（本版交付前最近一次全量 verify）

### 下版计划

# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。


## [0.5.0] - 2026-09-23

**本版提交**：1 个 ｜ **改动**：2 files changed, 25 insertions(+), 2 deletions(-)

### 本版做了什么

#### host（应用壳/页面）（1）

- feat(mounts): 详情面也接观察面补充（W5-A 收尾）（`8957c70`）

### 相对上版

- 上版 tag：v0.4.0
- 2 files changed, 25 insertions(+), 2 deletions(-)

### 验证

- pnpm verify 日志：`/tmp/fe-verify10.log`（mtime 2026-09-22T22:50:58.408Z）
- [PASS] 33 项 / [FAIL] 0 项（本版交付前最近一次全量 verify）

### 下版计划

# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。


## [0.4.0] - 2026-09-23

**本版提交**：1 个 ｜ **改动**：13 files changed, 556 insertions(+), 5 deletions(-)

### 本版做了什么

#### host（应用壳/页面）（1）

- feat(mounts): 消费 credential_status 四态（W5-A / CRED-EXPIRY-WIRE）（`6c20771`）

#### shared（契约/域映射/组件）（1）

- feat(mounts): 消费 credential_status 四态（W5-A / CRED-EXPIRY-WIRE）（`6c20771`）

### 相对上版

- 上版 tag：v0.3.0
- 13 files changed, 556 insertions(+), 5 deletions(-)

### 验证

- pnpm verify 日志：`/tmp/fe-verify9.log`（mtime 2026-09-22T22:44:17.969Z）
- [PASS] 33 项 / [FAIL] 0 项（本版交付前最近一次全量 verify）

### 下版计划

# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。


## [0.3.0] - 2026-09-23

**本版提交**：1 个 ｜ **改动**：3 files changed, 182 insertions(+), 9 deletions(-)

### 本版做了什么

#### host（应用壳/页面）（1）

- feat(yun139): 凭据过期引导改用后端 AuthExpired 词表（FE-PARITY-YUN139-EXPIRY-GUIDE）（`c351aae`）

### 相对上版

- 上版 tag：v0.2.0
- 3 files changed, 182 insertions(+), 9 deletions(-)

### 验证

- pnpm verify 日志：`/tmp/fe-verify8.log`（mtime 2026-09-22T21:55:27.193Z）
- [PASS] 33 项 / [FAIL] 0 项（本版交付前最近一次全量 verify）

### 下版计划

# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。


## [0.2.0] - 2026-09-23

**本版提交**：257 个 ｜ **改动**：257 个提交（首个版本，无上版对照）

### 本版做了什么

#### host（应用壳/页面）（201）

- feat(operations): 数据源负载与活跃播放明细端点接入（FE-PARITY-OPERATIONS-EXTRA）（`6a50f3f`）
- feat(developer-api): 开放 API 端点目录接入（FE-PARITY-DEVELOPER-ENDPOINTS）（`878f7fd`）
- feat(auth-providers): 登录提供方配置与自检接入（FE-PARITY-AUTH-PROVIDERS）（`3120784`）
- feat(yun139): 扫码绑定与凭据档案接入（FE-PARITY-YUN139）（`756d4df`）
- feat(pan115): 分享下载预览凭据（扫码/轮询/创建）接入（FE-PARITY-PAN115-SHARE-DL）（`bade8e3`）
- feat(mounts): 数据源 CRUD 旧值回填 + name 不上抛 + 凭据过期引导（DATASOURCE-CRUD-BACKFILL-UI）（`ad594d2`）
- feat(microsoft): OAuth/token 流与账号操作接入（FE-PARITY-MICROSOFT）（`32da414`）
- feat(rewards): 版本化规则与积分调整/统计接入（FE-PARITY-REWARDS-EXTRA）（`baee49a`）
- feat(upstreams): 采集与同步 UI 接入（FE-PARITY-UPSTREAMS-SYNC）（`a6ee5a5`）
- feat(pan115): 分享下载预览/分享项浏览/同步 UI 接入（FE-PARITY-PAN115-SHARE）（`8042ff7`）
- feat(mounts): 批量刷新异常挂载按钮 + 危险闸 confirmed=true（FE-PARITY-MOUNTS-REFRESH）（`782cb3c`）
- feat(media-items): 详情补全 visibility/manual-match/identify/provider-search（FE-PARITY-MEDIA-ITEMS-DETAIL）（`37e5c72`）
- …另有 189 条（完整：`git log --oneline ..v0.2.0`）

#### shared（契约/域映射/组件）（174）

- feat(operations): 数据源负载与活跃播放明细端点接入（FE-PARITY-OPERATIONS-EXTRA）（`6a50f3f`）
- feat(mounts): 契约登记 credential_status（后端 CRED-EXPIRY-WIRE；UI 消费见后续卡）（`c271a83`）
- feat(developer-api): 开放 API 端点目录接入（FE-PARITY-DEVELOPER-ENDPOINTS）（`878f7fd`）
- feat(auth-providers): 登录提供方配置与自检接入（FE-PARITY-AUTH-PROVIDERS）（`3120784`）
- feat(yun139): 扫码绑定与凭据档案接入（FE-PARITY-YUN139）（`756d4df`）
- feat(pan115): 分享下载预览凭据（扫码/轮询/创建）接入（FE-PARITY-PAN115-SHARE-DL）（`bade8e3`）
- feat(mounts): 数据源 CRUD 旧值回填 + name 不上抛 + 凭据过期引导（DATASOURCE-CRUD-BACKFILL-UI）（`ad594d2`）
- feat(microsoft): OAuth/token 流与账号操作接入（FE-PARITY-MICROSOFT）（`32da414`）
- feat(rewards): 版本化规则与积分调整/统计接入（FE-PARITY-REWARDS-EXTRA）（`baee49a`）
- feat(upstreams): 采集与同步 UI 接入（FE-PARITY-UPSTREAMS-SYNC）（`a6ee5a5`）
- feat(pan115): 分享下载预览/分享项浏览/同步 UI 接入（FE-PARITY-PAN115-SHARE）（`8042ff7`）
- feat(mounts): 批量刷新异常挂载按钮 + 危险闸 confirmed=true（FE-PARITY-MOUNTS-REFRESH）（`782cb3c`）
- …另有 162 条（完整：`git log --oneline ..v0.2.0`）

#### themes（主题）（114）

- Merge FE-OPT-05: _template 升级为第三方主题完整样板（w3——真实 L3 ItemSkin 275 行 + 完整 manifest + vite library 构建 + README 248 行全流程 + e2e 验证 spec；替代空骨架 ExampleSkin。主代理验收：verify 11 闸全绿 + 能力面齐备）（`a19e240`）
- feat(FE-OPT-03): 无障碍（a11y）系统化——全站 WCAG AA + 键盘导航（`db54841`）
- fix(BUG-SKIN-NAV-01): darkroom library/item cards are now navigable（`4a5ea5d`）
- FE-OPT-01: 前端体感优化第一批（预取 + 乐观更新 + 主题零闪烁，全指标 before/after 采样）（`c9c84a7`）
- feat(version): 四层独立版本 + 契约对齐 + 主题 JS/TS 支持（用户裁定）（`b970f6f`）
- chore(release): v0.1.111 版本对齐（`ea70ada`）
- chore(release): v0.1.110 版本对齐后端 + 构建产物 gitignore（tsbuildinfo）（`e56aa4b`）
- THEME-BUILD-01: 主题独立产物构建链（L3 外挂命门收口）（`39e001e`）
- feat(WEB-C3): darkroom browse.item L3 skin (ItemSkin) + template starter kit（`fabd885`）
- chore(release): v0.1.109 版本号统一升版（8 文件）+ CHANGELOG（ADR-001 阶段 C 完结：WEB-GOV/C2/PERF-01/D1/FIX-02/P7-05R1 六卡）（`8e1dad1`）
- WEB-PERF-01: L3 主题首屏性能与产物隔离（`b9933ab`）
- feat(WEB-C2): darkroom browse.library L3 skin - Kodi-style rearrangement proof（`c90c990`）
- …另有 102 条（完整：`git log --oneline ..v0.2.0`）

#### docs（文档/证据）（51）

- chore(release): 前端发布链 —— cut-web.mjs（升位 + CHANGELOG 本版条目 + tag + gh release）+ 下版计划单一来源（`0012593`）
- docs(audit): FE-REPO-DOC-CLAIM-AUDIT + 5 历史 handoff 加 banner（`95b2125`）
- docs(audit): FE-V1-PARITY-SWEEP 对位扫描（V1有/V2后端有/V2前端零消费 41 真缺口）（`8cbed72`）
- docs(audit): FE-CRUD-SECURITY-AUDIT 前端只读数审计(写操作对位表+三敏感面+真问题卡草案)（`caa26df`）
- docs(handoff): FE-DELETE-UX-OPTIMISTIC + FE-LIBRARY-ORDER-UI 交付说明(含诚实边界)（`3004bcf`）
- docs(handoff): FE-DELETE-UX-OPTIMISTIC + FE-LIBRARY-ORDER-UI 交付说明(含诚实边界)（`f863afc`）
- docs(FE-COLLECTIONS-CONSUME-B2): handoff —— 纠正卡面DELETE误登记/补boundItemId断链/选型理由/诚实边界（`2f20468`）
- docs(FE-COLLECTIONS-CONSUME-B1): handoff —— 逐条核实/新增/登记未做/诚实边界（`10a2979`）
- docs(FE-LIST-KEYNAV): handoff —— 模型理由/已存在/新增/边界/未做项（`9a52dff`）
- chore(evidence): 刷新 fe-opt-03 逐页报告（最终全量跑产物）（`b5ae422`）
- docs(FE-OPT-03-ROUND2): handoff —— 已存在/新增/诚实边界/未做项（`1a1f47e`）
- feat(a11y): 逐页 a11y 报告（playwright 内建 ariaSnapshot，不引 axe）（`4649ba7`）
- …另有 39 条（完整：`git log --oneline ..v0.2.0`）

#### 其它（20）

- feat(e2e): EMAIL-E2E-SMOKE 真栈冒烟（scripts/e2e/email_channel_smoke.py）（`a699421`）
- feat(FE-COMPONENT-SPLIT): 补前端组件行数门禁（棘轮）+ 拆 PlayPage/工单页（`3bcc9d3`）
- chore: gitignore .codegraph/（索引不入库）（`f34b8dd`）
- Merge FE-OPT-04: 管理面批量操作体感（w1——批量选择 + 逐条进度 + 失败重试：shared/batch/{selection,runner} + useBatchOperation hook 223 行 + BatchProgressPanel 组件（逐条 pending/ok/fail 状态）+ 192 行测试；2002 行。主代理验收：verify 11 闸全绿。**三板块（前端优化/架构、契约、其他）至此全部完成**）（`e399fda`）
- Merge REPO-HYGIENE-01: 截图抽样入库 + 全量外置 + 体积门禁（w3——① 76 张截图（3.9MB）→ 8 张代表样本（800KB），-80% ② 新增 check-repo-size.mjs 门禁（单次提交二进制产物预算，接入 verify）③ docs/evidence-policy.md 定义入库/外置边界 ④ 存量清理（68 张删除，保留 samples + 索引 README）。主代理验收：verify 全绿 + 门禁 PASS + 旧路径清零）（`86756bd`）
- chore(REPO-HYGIENE-01): 审计截图抽样入库 + 全量外置 + 仓库体积门禁（`21c20f9`）
- feat(FE-OPT-03): 无障碍（a11y）系统化——全站 WCAG AA + 键盘导航（`db54841`）
- Merge FE-OPT-02: 移动端适配打磨（w2——三断点 375/768/1280 × 25 页 playwright 真跑 6/6 + 76 张截图归档：手机档横向溢出 +69→+45px 修复（TopBar 收窄/图标化/横滚）至全站 0 溢出；触控目标 ≥44px（Button/Switch/close，WCAG 2.5.5）；管理面表格横滚+抽屉 375 内 0 越界；播放页进度条可拖。修复全收在手机/触屏 media，桌面零影响。主代理验收：verify 11 闸全绿 + mobile-audit 6/6。注：76 截图 3.9MB 入库，后续卡改抽样策略）（`f329c8b`）
- test(e2e): WEB-E2E-FULL 阶段 1 真实浏览器全功能遍历验收（`45e4177`）
- feat(version): 四层独立版本 + 契约对齐 + 主题 JS/TS 支持（用户裁定）（`b970f6f`）
- chore(release): v0.1.110 版本对齐后端 + 构建产物 gitignore（tsbuildinfo）（`e56aa4b`）
- THEME-BUILD-01: 主题独立产物构建链（L3 外挂命门收口）（`39e001e`）
- …另有 8 条（完整：`git log --oneline ..v0.2.0`）

#### scripts（门禁/工具）（15）

- chore(release): 前端发布链 —— cut-web.mjs（升位 + CHANGELOG 本版条目 + tag + gh release）+ 下版计划单一来源（`0012593`）
- fix(e2e): 冒烟冷启动稳健性 + 开放项文档化（`9a43f43`）
- feat(e2e): EMAIL-E2E-SMOKE 真栈冒烟（scripts/e2e/email_channel_smoke.py）（`a699421`）
- feat(FE-COMPONENT-SPLIT ②): 门禁加显式豁免清单 + 工具模块判定（`b9adb3d`）
- feat(FE-COMPONENT-SPLIT): 补前端组件行数门禁（棘轮）+ 拆 PlayPage/工单页（`3bcc9d3`）
- Merge FE-OPT-04: 管理面批量操作体感（w1——批量选择 + 逐条进度 + 失败重试：shared/batch/{selection,runner} + useBatchOperation hook 223 行 + BatchProgressPanel 组件（逐条 pending/ok/fail 状态）+ 192 行测试；2002 行。主代理验收：verify 11 闸全绿。**三板块（前端优化/架构、契约、其他）至此全部完成**）（`e399fda`）
- Merge REPO-HYGIENE-01: 截图抽样入库 + 全量外置 + 体积门禁（w3——① 76 张截图（3.9MB）→ 8 张代表样本（800KB），-80% ② 新增 check-repo-size.mjs 门禁（单次提交二进制产物预算，接入 verify）③ docs/evidence-policy.md 定义入库/外置边界 ④ 存量清理（68 张删除，保留 samples + 索引 README）。主代理验收：verify 全绿 + 门禁 PASS + 旧路径清零）（`86756bd`）
- chore(REPO-HYGIENE-01): 审计截图抽样入库 + 全量外置 + 仓库体积门禁（`21c20f9`）
- FE-OPT-01: 前端体感优化第一批（预取 + 乐观更新 + 主题零闪烁，全指标 before/after 采样）（`c9c84a7`）
- feat(version): 四层独立版本 + 契约对齐 + 主题 JS/TS 支持（用户裁定）（`b970f6f`）
- THEME-BUILD-01: 主题独立产物构建链（L3 外挂命门收口）（`39e001e`）
- fix(theme-gate): 体量红线改为质量门禁（用户裁定）（`f4368dd`）
- …另有 3 条（完整：`git log --oneline ..v0.2.0`）

### 相对上版

- 上版 tag：（无，首个版本）
- 257 个提交（首个版本，无上版对照）

### 验证

- pnpm verify 日志：`/tmp/fe-verify7.final.log`（mtime 2026-09-22T21:40:07.329Z）
- [PASS] 33 项 / [FAIL] 0 项（本版交付前最近一次全量 verify）

### 下版计划

# 下版计划（前端仓 · 单一来源）

> 每次发布由 `scripts/release/cut-web.mjs` 整段嵌入 `CHANGELOG.md` 当版 `### 下版计划` 节。

## 本版之后立刻要做

- **credential_status 消费**（W5-A）：列表/详情展示 `bound | unbound | expired | not_required`，
  `expired` 给醒目标识 + 重绑/重新授权入口，`not_required` 不显示凭据 UI；
  与既有 `MountHealthDto.last_fault_kind == "credential_expired"` **去重**（同一事实一个入口）。
- **FE-PARITY-OPERATIONS-EXTRA 的真栈核验**：本版只做了静态映射 + 单测（无真栈），
  等后端 V2 服务可跑真栈后补 e2e（`progress_percent` / `cache_status` / `supported_commands` /
  `client_info` 的实际取值需按真响应校准）。
- **snake_case / camelCase 分裂收口**：`manage/operations` 同目录内既有 `/overview` 是 camelCase、
  新接的两条专用端点是 snake_case。已在测试里逐条钉死，但属于长期坑，需在一次**破坏性契约整理**中统一。
- **contract-sync 直跑注意**：仓外还有一份陈旧 checkout `/home/tefuir/rustproject/fmby-web`，
  直跑 `check-contract-sync.mjs` 必须带 `FMBY_WEB_DIR=/home/tefuir/rustproject/fmby-web-main`，
  否则会读到旧副本并误报 `FRONTEND_FIELD_MISSING`。

## 欠账

- 前端仓在此之前**完全没有版本链**（0 tag / 无 CHANGELOG，package.json 停在 0.1.0）——
  本版是首个正式版本，历史提交一次性归入 `0.2.0`。之后应**每次合并一批就发一版**。
- `docs/evidence-policy.md` 的二进制预算闸已接 `pnpm verify`；后续新增截图证据注意预算。


