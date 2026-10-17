# FE-UI 农场验收 · node62 真栈实测（按 FE-UI-DENSITY-AUDIT §0 P0/P1）

> 卡面：UI 农场验收（用户已批：在 node62 起服务测）。断言源：`docs/evidence/FE-UI-DENSITY-AUDIT.md` §0 的 P0/P1 + 卡面新增「二维码三档尺寸」。
> 结论先行：**断言 6 组，5 组不通过**（P0×3 实锤、P1×2 运行时实锤、P2×1 实测），1 组通过（二维码下限），另发现 **3 条审计盲区新问题**（darkroom 皮肤层）与 **1 条勘误**（P1-1 在默认主题下不触达用户）。
> 验收对象：前端仓 `lovely-skunk` @ `47907b8`（审计报告 commit）+ 农场后端二进制 `/data/fmby-e2e-bin/fmby-v2-server`（2026-10-16 构建）。

---

## §1 node62 起栈完整命令（可复现）

node62 = 本席运行节点（hostname `tefuir-dev-servier`）。全栈 = 农场后端二进制 + 真实 SQLite 种子 + vite 产物前端，**禁 mock**。

```bash
# 0) 前置：node62 上已有产物
#    后端+种子：/data/fmby-e2e-bin/{fmby-v2-server, fmby-e2e-seed}   （调试构建，过 F-09 默认口令守卫）
#    前端仓：本 worktree（lovely-skunk）
export FMBY_QUEUE_DISABLE=1            # 绕过 fmby-queue 重活闸（仅本次 harness 自身构建用）

# 1) 装依赖 + 主题产物 + 前端构建（start.mjs 也会自动做，这里显式分开便于复现）
pnpm install --frozen-lockfile          # 170 包全热缓存复用，2.8s
pnpm build:themes                       # themes/*/dist → 运行时外挂主题产物（darkroom ~0.2s）
cd host && node node_modules/vite/bin/vite.js build   # host/dist（实测 7.3s）

# 2) 起栈 + 跑验收（playwright webServer 拉起 e2e/start.mjs：seed → 组装主题 → server → vite preview）
#    端口显式指定避让其他席位；不设则自动挑空闲口。
cd host
FMBY_E2E_SERVER_BIN=/data/fmby-e2e-bin/fmby-v2-server \
FMBY_E2E_SEED_BIN=/data/fmby-e2e-bin/fmby-e2e-seed \
FMBY_E2E_WEB_PORT=15180 \
FMBY_E2E_BACKEND_PORT=18199 \
FMBY_QUEUE_DISABLE=1 \
node node_modules/@playwright/test/cli.js test e2e/farm-accept-ui2.spec.ts \
  --project=chromium --reporter=list --timeout=90000
```

种子数据口径（`e2e/start.mjs` 固化，无手工步骤）：
- `fmby-e2e-seed <db> <dataDir>`：真实迁移建三库 + **admin/admin** + 电影库 + 《星际穿越》（含可播放媒体源）；
- 主题：`themes/*/dist/**` → `${workDir}/data/themes/<id>/dist/**`（运行时外挂，darkroom 默认激活）；
- 后端 env：`FMBY_BIND=127.0.0.1:18199`、`FMBY_DB_PATH/FMBY_DATA_DIR`（mkdtemp 临时目录，跑完即焚）、`FMBY_TRUSTED_ORIGINS=http://127.0.0.1:15180`；
- 前端：vite preview 服务 `host/dist`，`/api` 代理到 18199。

## §2 断言清单 × 结果

| # | 断言 | 口径 | 结果 | 级别 |
|---|---|---|---|---|
| A1 | 二维码三档尺寸 ≥180px（桌面 1440 / 平板 820 / 手机 375） | 真实 DOM `boundingBox` | **✅ 通过**（MFA TOTP 三档全过）；运营商面 3 个中 2 个入口不可见（环境）、1 个首跑出码后复跑入口消失（环境抖动） | — |
| A2 | 空态不得谎报（审计 P0-1） | DOM 全文 + 死链 href 计数 | **❌ 不通过**（谎报文案 + 死链各 1 处实锤） | **P0** |
| A3 | 生产文案无粗口（审计 P0-2） | DOM 全文 | **❌ 不通过**（「屁用没有」在页头 DOM） | **P0** |
| A4 | 留白抽查 5 页间距阶梯（0-2px 白名单） | `getComputedStyle` 全量 padding/gap | **❌ 5/5 不通过**（脱梯 5–14 种/页，与审计 P2-1 完全对上） | **P2**（按审计分级） |
| A5 | 条目详情首屏主行动（真渲染面 = darkroom ItemSkin） | `data-darkroom` DOM 探针 | **❌ 不通过**（0 个可点元素 + 装饰海报墙 + meta 重复） | **P0（新）** |
| A6 | 历史页同屏双计数（审计 P1-4） | 真实播放造历史后 DOM 文本 | **❌ 不通过**（两处同值计数同屏） | **P1** |

跑次：3 次（第 1 次暴露 spec 自身 2 处缺陷已修；第 3 次为取证跑，`9 failed / 2 passed / 1 skipped→0`，见 §3）。

## §3 证据原文（DOM 实测 / 截图）

### A1 二维码三档尺寸 —— ✅

MFA TOTP（`/manage/site/settings` → 「开始绑定」→ 后端本地生成 otpauth QR），真实渲染尺寸（`/tmp/farm-accept-ui2/a1-totp-qr-sizes.json` 原文）：

```json
{
  "desktop": { "width": 1014, "height": 1006 },
  "tablet":  { "width": 721,  "height": 713 },
  "phone":   { "width": 309,  "height": 301 }
}
```

三档最小边 301/713/1006 均 ≥180 → **下限断言通过**。但桌面档 1014px 系「无宽度上限、按图片内禀尺寸渲染」（`.readonlyField` 无 max-width，靠 `max-width:100%` 随容器收缩）→ 新增 P2（见 §4）。

运营商面（`a1-carrier-summary.json` 原文）：

```json
{
  "yun139": "入口按钮不可见（面未渲染或能力面限制）",
  "imghost": "入口按钮不可见（付费守卫/能力面限制，环境受限）",
  "pan115-share": "入口按钮不可见（面未渲染或能力面限制）"
}
```

> 第 1 跑 yun139 面真实出码 **1014×1006**（同款无宽度约束问题，桌面档截图留存于跑次记录），第 3 跑入口消失——139 运营商会话存在抖动，三档量测未完成，标「部分取证」。
> 115 图床被付费守卫挡住（`ManagePaidFeatureGuard`，种子无 license）、115 分享预览同因入口不可见 → **环境受限，不计缺陷**。

### A2 空态谎报 + 死链 —— ❌ P0

`/manage` 首屏 DOM 全文摘录（`a2-manage-body.txt` 原文）：

```
正在运行的任务队列
（0 个执行中 · 共 0 项）
任务中心 ➔
任务队列空闲

所有挂载目录、海报与元数据已完成最新刮削与入库。
```

死链实测（`a2-dead-link.json` 原文）：

```json
{ "deadLinkCount": 1, "deadLinkHref": "/manage/tasks" }
```

`a2-problems.json` 原文（验收器输出的两句话）：

```json
[
  "空态谎报：任务队列 0 项却渲染「所有挂载目录、海报与元数据已完成最新刮削与入库」（审计 P0-1，ManageOverviewPage.tsx:35 tasks 恒 []）",
  "死链：存在 1 个 href=\"/manage/tasks\"，路由表只有 /manage/task-center（审计 P0-1）"
]
```

截图：`samples/desktop/manage-cockpit.png`（整页，可数出 13 块）。
顺带实锤（同屏新证据）：「服务器与系统脉搏」面板四项全部「不可用」（CPU 负载/内存占用/媒体存储池/实时网络推流吞吐），整块面板只有占位——列为 P2（见 §4）。

### A3 粗口文案 —— ❌ P0

`/manage/media/naming-scrape` 页头 DOM 全文检索：`含粗口: True`（`a3-naming-body.txt`）。页头原文与审计一致：`…海报会落本地缓存，不再只存一条屁用没有的外链。`（`NamingRulesHeader.tsx:35`）。截图：`samples/desktop/naming-header.png`。

### A4 留白抽查 5 页 —— ❌ 5/5（P2）

每页全量 computed padding/gap 与阶梯 `{4,8,12,16,20,24,32,40,48,64}` 的差集（0–2px 白名单；完整 JSON 在 `/tmp/farm-accept-ui2/a4-*.json`，已随 spec 入库可复跑）：

| 页 | 脱梯种类 | px 分布 | 代表样本（选择器 → 现值） |
|---|---|---|---|
| /manage | 14 | 3×2, 5×2, 6×5, 10×2, 14×2, 36 | `span._badge_` padding 3px；`a._navLink_` padding 6px（TopBar）；gap 6px（`._vitalItem_`）；`._mountListItem_` padding 10px |
| /manage/media/items | 9 | 3×2, 5×2, 6×2, 7, 36, 42 | 同上 badge/navLink；42px（ManageMediaItemsPage.module.css:26，审计已点名） |
| /manage/site/users/accounts | 8 | 3×2, 5×2, 6×2, 7, 36 | 同上 |
| /history | 9 | 5×2, 6×2, 10×2, 18×2, 36 | `a._primaryButton_` padding **10px/18px**（shared.module.css:86，审计 P2-1 点名） |
| /login | 5 | 10×2, 14×2, 36 | 卡片 36px（LoginPage.module.css:217，审计 P2-5 点名）；secondaryButton 10/14px |

结论：**审计 P2-1 的静态扫描在运行时全部复现**，五个抽查页无一达标；高频肇事者集中在 badge(3px)、kbd(5px)、TopBar navLink(6px)、主按钮(10/18px)、登录卡(36px) 五个组件，修 5 个组件即可消掉 5 页大部分脱梯。

### A5 条目详情首屏主行动 —— ❌ P0（新）

真渲染面勘定：darkroom 主题激活时 `/item/:id` 由主题皮肤接管——DOM 实测 `<section data-darkroom="item-skin" data-state="ready">`，**host 的 ItemDetailPage 结构（detailHero 等）一个类都没出现**（chunk 虽加载但未渲染）。探针原文（`a5-item-skin-probe.json`）：

```json
{
  "url": "/item/101",
  "skinState": "ready",
  "playControls": [],
  "clickableCount": 0,
  "posterWall": { "left": 433, "width": 220 },
  "posterWallHasImg": false,
  "metaLeft": 677,
  "metaLine": "2014 · 电影 · 2014 · 电影",
  "metaLineDup": true
}
```

- `clickableCount: 0` —— ready 态**没有任何可点元素**：无播放/继续播放、无「查看完整详情」回退入口（`themes/darkroom/src/skins/ItemSkin.ts` ready 分支只渲染 badge/h1/meta/描述/类型/演员 + 装饰海报墙；`primary-button` 只存在于 loading/empty/error 反馈态）。
- `posterWallHasImg: false` —— 左栏 220px 宽的「海报墙」是 `aria-hidden` 纯渐变占位（源码注释自认「纯装饰性占位」），海报契约数据不缺却没渲染。
- `metaLineDup: true` —— 「2014 · 电影」出现两次：skin 拼 `runtimeLabel/ratingLabel + item.meta`，而 contract 的 meta 数组已含 year+kindLabel，两层各拼一遍。

截图：`samples/desktop/item-skin-no-cta.png`。

### A6 历史页双计数 —— ❌ P1

以 admin 真实播放《星际穿越》（直连 `/play/101`，皮肤无播放钮只能直连——恰是 A5 的 P0）10s 造出历史后，`/history` DOM 全文（`a6-history-body.txt` 摘录）：

```
共整理出 1 条记录      ← 页头（HistoryPage.tsx:71）
…
当前结果：1 条         ← 工具条（HistoryPage.tsx:126）
```

同一数值「1 条」同屏两处 → 审计 P1-4 运行时实锤。

## §4 达不到项（按级别，验收口径）

| 级别 | 项 | 一句话结论 | 修法落点 |
|---|---|---|---|
| **P0** | 空态谎报 | 0 任务渲染「所有…已完成最新刮削与入库」 | 移除/接真 `ActiveTaskQueueWidget`；空态改「暂无任务数据」 |
| **P0** | 死链 | `href="/manage/tasks"`（路由只有 /manage/task-center） | `ActiveTaskQueueWidget.tsx:73` 支链接 |
| **P0** | 粗口文案 | 「屁用没有」在生产页头 | `NamingRulesHeader.tsx:35` 重写一句 |
| **P0（新）** | ItemSkin 无播放主行动 | 详情页 0 可点元素，无法开始播放 | 主题 `ItemSkin.ts` ready 分支补 host 注入的播放主行动（或 host 注入 actions.play） |
| **P1** | 历史页双计数 | 「共整理出 N 条」+「当前结果：N 条」同屏 | 删工具条一处（HistoryPage.tsx:126） |
| **P1（新）** | ItemSkin 海报墙纯装饰 | 220px 占位无海报，半屏浪费 | skin 渲染 `posterUrl`，无图退渐变 |
| **P2** | 间距阶梯 5/5 页脱梯 | 5–14 种/页，集中于 5 个组件 | 照审计 P2-1 映射表逐组件收敛（badge 3→4、kbd 5→4、navLink 6→8、primaryButton 10/18→8/16、登录卡 36→32） |
| **P2（新）** | QR 无宽度上限 | TOTP/yun139 QR 桌面档 1014×1006 内禀渲染 | `.readonlyField` 上的 QR img 加 `width: min(280px, 100%)` |
| **P2（新）** | ItemSkin meta 行重复 | 「2014 · 电影 · 2014 · 电影」 | skin 不再前置拼 contract meta 已含字段 |
| **P2（新）** | 服务器脉搏面板整块「不可用」 | CPU/内存/存储/吞吐四项全占位仍占一整块 | 数据不可用时折叠面板为一行（照审计 P1-9 的收敛建议） |
| **P2（勘误）** | 审计 P1-1 双重 `.page` | darkroom 皮肤下用户不可达（仅主题回退路径触达） | 降级：仍建议修（回退面），但不阻塞 |

环境受限（不计缺陷）：115 图床扫码面（付费守卫无 license）、115 分享预览扫码面（同因）、139 扫码复跑抖动（首跑已出码 1014×1006）、TOTP 首两跑入口未就绪（第 3 跑正常，status query 竞态，建议另开 flaky 卡）。

## §5 审计报告勘误（本卡实测修正 FE-UI-DENSITY-AUDIT）

1. **覆盖盲区**：审计的「深读」是 host 源码层；真栈默认主题（darkroom）下 `/item/:id`、`/libraries/:id` 由主题皮肤 `ItemSkin`/`LibrarySkin`（WEB-C2/C3）接管，host 结构仅为回退面。受影响条目：审计 P1-1（双重 .page，降级 P2 勘误）、P1-5（库详情 loaded×3，需在 LibrarySkin 面复核）、P2-9（评分×2，同前）。其余 manage/浏览列表/播放/设置页不受影响（无皮肤接管）。
2. **新增正主**：皮肤层的问题（无主行动、装饰海报墙、meta 重复）比被接管的 host 问题更重——后续修复卡应先修皮肤面。
3. 其余 P0/P1 结论经真栈运行时复现**全部成立**（A2/A3/A6 实锤；A4 与静态扫描一致）。

## §6 样本索引与复现

样本（4 张，共 404KB，符合 evidence-policy R1/R2 ≤8 张/≤1MiB）：

| 文件 | 内容 |
|---|---|
| `samples/desktop/totp-qr-desktop.png` | TOTP QR 出码（1014×1006 桌面档，无宽度上限证据） |
| `samples/desktop/manage-cockpit.png` | 管理首屏整页：谎报任务队列 + 13 块密度 + 服务器脉搏全占位 |
| `samples/desktop/naming-header.png` | 命名刮削页头粗口文案 |
| `samples/desktop/item-skin-no-cta.png` | ItemSkin ready 态：无任何可点元素 + 装饰海报墙 |

全量 DOM 证据（JSON/txt）：`/tmp/farm-accept-ui2/`（a1–a6 共 17 个文件，含逐页脱梯全列表）；复现命令见 §1，spec 入库于 `host/e2e/farm-accept-ui2.spec.ts`（证据落 `/tmp/farm-accept-ui2/`，playwright 不清理）。


---

## §7 P0 复验（修复后第二轮真栈，2026-10-17）

修复 commits：`99a171a`（A2）→ `21060d8`（A3）→ `dbbf096`（A5，含 spec 判定口径对齐 §4 分级）。
复验命令与 §1 完全一致（dist/主题产物均按新源重建，start.mjs 走新鲜产物）。结果：**三条 P0 全部转绿**。

| 断言 | 修前 | 修后 | 修后 DOM 原文 |
|---|---|---|---|
| A2 空态不谎报 | ❌ 谎报文案 + 死链×1 | **✅** | 见 §7.1 |
| A3 文案无粗口 | ❌「屁用没有」 | **✅** | 见 §7.2 |
| A5 首屏主行动 | ❌ clickableCount=0 | **✅** | 见 §7.3 |

复验全量：`5 passed / 6 failed`——仍红的 6 条全部是**非本卡范围**：A4×5（P2 间距阶梯，对应审计 B4 批次）、A6×1（P1 历史页双计数，对应 B2 批次）；另有 A5 的 P1/P2 后续项（海报墙装饰化、meta 重复）按 §4 分级降为注记。

### §7.1 A2 修复后 DOM 原文

`a2-problems.json` → `[]`；`a2-dead-link.json` → `{"deadLinkCount": 0, "deadLinkHref": null}`；`a2-manage-body.txt` 摘录（谎报文案已不存在，全页检索 False）：

```
正在运行的任务队列
任务中心 ➔
暂无任务数据

运行中任务的数据面尚未接入，这里不展示猜测值；全量任务请到任务中心查看。
```

修法：`ActiveTaskQueueWidget.tsx`——空态改「暂无任务数据」（图标 CheckCircle2 绿√ → 中性 ListTodo）；0 项时不再渲染「0 个执行中 · 共 0 项」副标题；死链 `/manage/tasks` → `/manage/task-center`。

### §7.2 A3 修复后 DOM 原文

`a3-naming-body.txt`：`含粗口: False`。页头现文案：

```
命名刮削设置
这页收口命名清洗、识别后自动刮削、主元数据来源、元数据语言和缺失海报补刮。
数据库是元数据真相源，海报落本地缓存，播放不依赖第三方外链可达性。
```

修法：`NamingRulesHeader.tsx:35` 重写；全仓粗口扫描（20 词）确认无同源漏网入口（此前修复轮未盖到该文件）。

### §7.3 A5 修复后 DOM 原文

`a5-item-skin-probe.json`（修后）：

```json
{
  "url": "/item/101",
  "skinState": "ready",
  "playControls": ["立即播放"],
  "clickableCount": 1,
  "metaLine": "2014 · 电影 · 2014 · 电影",
  "metaLineDup": true
}
```

`a5-item-skin-problems.json`：`{"p0": [], "deferred": ["P1（后续卡）：海报墙纯装饰占位 220px 无 img", "P2（后续卡）：meta 行重复「2014 · 电影 ×2"]}`。
修法（跨三层，`dbbf096`）：
1. shared `SkinActions` 增语义键 `playItem`/`playHref`（openItem/itemHref 同模式孪生键，旧 skin 忽略不崩）；
2. host `loaders.ts` 注入 `navigate(/play/:id)`，并把播放目标归一后下发（契约 `playbackTargetId` 缺省时 `canPlay ? item.id : undefined`，与 host 回退页同口径——首跑实测后端不下发 playbackTargetId，这正是首轮修复后 clickableCount 仍为 0 的根因）；
3. darkroom `ItemSkin` ready 分支渲染主行动：有 `playHref` → 真实 `<a href="/play/101">立即播放</a>`，仅 `playItem` → `<button>`，无注入/无可播目标不伪造；label 用契约 `primaryActionLabel`。
主题单测：ItemSkin 12/12（新增 3 例先红后绿）、LibrarySkin 10/10 无回归。样本：`samples/desktop/item-skin-play-cta.png`（修后）/ `item-skin-no-cta.png`（修前对照）。

### §7.4 遗留（非本卡，按级别排队）

- **P1**：A6 历史页双计数（HistoryPage.tsx:71/126）→ B2 批次；
- **P1（新）**：ItemSkin 海报墙纯装饰占位（海报契约数据在、不渲染）→ 皮肤卡；
- **P2**：A4 间距阶梯 5/5 页（badge 3px / kbd 5px / navLink 6px / primaryButton 10·18px / 登录卡 36px 五个组件收敛）→ B4 批次；
- **P2（新）**：ItemSkin meta 行重复；QR 无宽度上限（TOTP 桌面档 1014px）；服务器脉搏面板整块「不可用」仍占一屏块。
