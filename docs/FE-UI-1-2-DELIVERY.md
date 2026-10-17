# FE-UI-1 + FE-UI-2 交付说明（含农场 UI 验收步骤）

> 分支：`feat/fe-ui-1-2-density`（PR 分支；原开发分支 `slim-unicorn` 已 rebase 到 main 后拆出）
> 基线：`origin/main` @ `591eb0a`（rebase 前基线 `ddc1a4c`，落后 10 个提交）
> 本文件是**两张卡的交付说明**：FE-UI-1（扫码二维码可缩放）+ FE-UI-2 P0/P2-4 收口。
> 每件一 commit；本文件是第 4 个 commit（纯文档，不含代码）。

---

## 0. commit 清单（一件一 commit）

| sha（rebase 后） | 卡 | 标题 | 代码文件 | 测试 |
|---|---|---|---|---|
| `625cd8b` | FE-UI-1 | `feat(ui): 扫码二维码可缩放（容器自适应 + 三档尺寸 + 180px 下限）` | 7（1 新组件 + 5 接入 + 1 css） | `qr-image-responsive.dom.test.ts` +3 |
| `51c5e71` | FE-UI-2 P0 | `fix(ui): 收掉 FE-UI-2 P0（任务队列本体诚实化 + 粗口文案）` | 5 | `manage-overview-honesty.test.ts` 6 条 |
| `8f86553` | FE-UI-2 P2-4 | `refactor(ui): FE-UI-2 P2-4 登录页 mfa 死代码分支 + 三条防回归钉` | 2 | `fe-ui2-density-mechanical.test.ts` 3 条 |
| 本 commit | 交付 | `docs(ui): FE-UI-1 + FE-UI-2 交付说明（含农场验收步骤）` | 0 | — |

`git log --oneline 591eb0a..HEAD` 应恰好 4 条（本文件 +3）。

### 0.1 rebase 后与 main 撞车的两条（如实登记）

| 条目 | 原提交 | main 侧的处置 | 本分支的最终形态 |
|---|---|---|---|
| P0-① 中控任务队列空壳 | `f6178f8` 接线 `taskCenterApi` + 挂回首屏 | main `591eb0a`（P1-9 ①）**把 widget 与详情模态整个从首屏拔除**（13→10 块） | 首屏按 main 拔除；只保留**组件本体的诚实化**（不再编造后端没有的字段），并新增「首屏不得把空壳挂回来」回归钉 |
| P1-4 历史页同值计数 / P1-5 库详情「已加载 x/y」 | `385a6ec` 删重复 | main `591eb0a` 已自行收口（保留页头那处计数） | 本分支不重做，两条降级为**防回归钉**（只钉「同屏不许有两个 N」，不钉保留哪一处） |

⇒ 因此本 PR 实际新增行为：FE-UI-1 二维码缩放、工作队列/详情模态本体去假字段、粗口文案、登录页死代码。其余是护栏。

---

## 1. FE-UI-1 · 扫码登录二维码尺寸与缩放

### 1.1 用户原话与改动面

> 「扫码登录（115、139）为啥那个二维码那么大？不能缩放一下？」

六处扫码二维码渲染点（codegraph + 源码核对），改前两种病态：

| # | 文件:行 | 场景 | 改前尺寸来源 |
|---|---|---|---|
| 1 | `mounts/components/MountDrawer/sections/Pan115CredentialsSection.tsx:299` | 115 挂载扫码（弹窗） | 固定 `width:220;height:220` inline style |
| 2 | `.../Pan115CreateCredentialsSection.tsx:186` | 115 新建数据源扫码（弹窗） | 固定 `220` |
| 3 | `pan115-imghost/components/CredentialsCard.tsx:228` | 115 图床扫码（弹窗） | 固定 `220` |
| 4 | `pan115-share/components/PreviewCredentialSection.tsx:128` | 115 分享预览扫码（页内） | `styles.readonlyField`（`width:100%` 的**只读文本框**类） |
| 5 | `yun139/Yun139QrLoginSection.tsx:114` | 139 扫码（页内） | `styles.readonlyField` |
| 6 | `site-settings/components/MfaTotpSection.tsx:157` | TOTP 绑定二维码 | `styles.readonlyField`（**本卡未动**，见 ponytail） |

### 1.2 改前/改后 DOM 尺寸断言原文

**改前**（vite 打包 + Chromium 实测，四容器 480/260/240/200px，`*{box-sizing:border-box}`）：

```
固定 220px 那三处（115 弹窗）：
  { "200": {w:220,h:220}, "240": {w:220,h:220}, "260": {w:220,h:220}, "480": {w:220,h:220} }
  ⇒ 任何容器都是 220×220：容器再窄也不缩。

readonlyField 误用那三处（115 分享预览 / 139 / TOTP）：
  { "200": {w:200,h:192}, "240": {w:240,h:232}, "260": {w:260,h:252}, "480": {w:480,h:472} }
  ⇒ 480px 容器下被拉到整行宽 480×472，比例失真（readonlyField 的 height:auto 缺席
     让高度随 padding 漂移），且无上限。
```

**改后**（同一探针、同一四容器，走新 `ScanQrImage`）：

```
kind="bitmap"（115 PNG，naturalSize=185）：
  { "200": {frameOW:185, imgOW:183, imgOH:183}, "240": {frameOW:185, imgOW:183, imgOH:183},
    "260": {frameOW:185, imgOW:183, imgOH:183}, "480": {frameOW:185, imgOW:183, imgOH:183} }
  ⇒ 钉在原生 185px（**只缩不放**，位图绝不放大致糊）；容器 <185 时等比缩。

kind="vector"（139 SVG）：
  { "200": {frameOW:200, imgOW:198, imgOH:198}, "240": {frameOW:240, imgOW:238, imgOH:238},
    "260": {frameOW:260, imgOW:258, imgOH:258}, "480": {frameOW:480→280, imgOW:278, imgOH:278} }
  ⇒ 480px 容器下钉在桌面上限 280px（不再无限撑大）；容器窄于档位时跟容器缩。
```

### 1.3 三档尺寸表

| 档 | 断点 | 上限 | 说明 |
|---|---|---|---|
| 桌面 | ≥1280 | **280px** | 不再无限撑大（治 readonlyField 的「整行拉伸」） |
| 平板 | ≤1279 | **260px** | 对齐 `ManageShared.module.css` 既有 1279 断点 |
| 手机 | ≤767 / `pointer:coarse` | **240px** | 对齐既有 767 断点 |
| **下限（任何档）** | — | **180px** | `min-width` 兜底，容器再窄不破扫码可用下限 |

### 1.4 180px 下限的证据（不拍脑袋）

- **115 图源实测**（`curl https://qrcodeapi.115.com/api/1.0/web/1.0/qrcode?uid=…`，
  uid 长度 → PNG 边长）：1→165、9→185、16→185、32→205、46→185、48→205、64→225、79→245。
  取 uid=32/46 两种典型值解出 **29-37 模块 / 每模块 ≈5px** ⇒ 典型图源 185-205px。
- 缩到 180px ⇒ 每模块 ≈6.2px，仍在「≥6px/模块」可扫区间；<150px ⇒ <5px/模块，
  手机摄像头常规距离解析失败 ⇒ 扫码失败。
- 故**手机档取 240px 而不是 40vw**：375px 视口下 `40vw=150px` < 180px 会扫不出来。
- 139 是后端自渲染 **SVG**（`crates/fmby-v2-providers/src/yun139_qr.rs:618-623`，
  `viewBox="0 0 {size} {size}" shape-rendering="crispEdges"`）⇒ 矢量任意缩放不失真，
  不受位图「只缩不放」约束。

### 1.5 清晰度与层级

- 位图：`naturalSize` 钉死原生尺寸（内联 `max-width`）+ CSS `max-width:100%` 双保险 ⇒ 无重采样模糊。
- 层级：frame 与 img 均 `position:static`、无 z-index ⇒ 不抢 `DetailModal` 的 `--z-modal` 浮层。

---

## 2. FE-UI-2 · P0×2 + P1 三条

审计源：`docs/evidence/FE-UI-DENSITY-AUDIT.md`（分支 `lovely-skunk` @ `47907b8`）。

### 2.1 P0-① 中控「正在运行的任务队列」空壳（改前/改后原文）

**改前三处病灶**：
1. `ManageOverviewPage.tsx:35` `const tasks: ActiveTaskQueueItem[] = [];`（硬编码空数组）
2. `ActiveTaskQueueWidget.tsx:86-93` 空态文案：
   ```
   任务队列空闲
   所有挂载目录、海报与元数据已完成最新刮削与入库。
   ```
   ⇒ 把「没有数据」说成「系统全绿」。
3. `ActiveTaskQueueWidget.tsx:73` `to="/manage/tasks"`（路由表只有 `/manage/task-center` ⇒ 404）

**改后（rebase 后口径）**：

- **首屏**：main `591eb0a`（P1-9 ①）已把 `ActiveTaskQueueWidget` + `TaskDetailModal`
  整个从首屏拔除（中控 13→10 块），本分支**完全对齐**——`ManageOverviewPage.tsx`
  取 main 版，不再有「接线」这回事。回归钉：`manage-overview-honesty.test.ts`
  的 P0-①a 钉死「首屏不得再渲染 `<ActiveTaskQueueWidget`」，包括
  「不得再出现 `const tasks: ActiveTaskQueueItem[] = []`」这一历史病灶。
- **组件本体**（仍从 `manage/overview` 导出）：不再编造后端没有的字段。

```diff
- interface TaskDetailModalProps { task: ActiveTaskQueueItem | null; … }
- // 假形状：progressPercent / totalSubItems / subItems / priority（后端无此字段）
+ import type { TaskCenterItemRecord } from '@fmby/v2-shared/contracts/manage/task-center';
+ interface TaskDetailModalProps { task: TaskCenterItemRecord | null; … }
```
空态文案（改后）：
```
暂无进行中的任务
当前没有扫描、刮削或识别任务在执行。任务明细与历史见任务中心。
```
链接（改后）：`to="/manage/task-center"`（真实路由）。

`TaskDetailModal` 原来用**本地假形状** `ActiveTaskQueueItem`
（`progressPercent` / `totalSubItems` / `subItems` / `priority`）——后端**没有这些字段**，
只能编数据。现改用契约真实形状 `TaskCenterItemRecord`（与任务中心页同一个 DTO）；
没有字段的块（假进度条、假子项日志）**直接不渲染**，指回任务中心真实 timeline。
断言：P0-①d 钉死两个文件都不再引用这四个假字段。

### 2.2 P0-② 生产 UI 文案含粗口（改前/改后原文）

`host/src/pages/manage/naming-rules/components/NamingRulesHeader.tsx:35`：

```diff
- description="这页收口命名清洗、识别后自动刮削、主元数据来源、元数据语言和缺失海报补刮。数据库是元数据真相源，海报会落本地缓存，不再只存一条屁用没有的外链。"
+ description="这页收口命名清洗、识别后自动刮削、主元数据来源、元数据语言和缺失海报补刮。数据库是元数据真相源，海报会落本地缓存，播放不依赖第三方外链可达性。"
```
语义不减（缓存 + 不依赖外链可达性两条都在）。另全仓扫 6 个粗口词，无其他命中。

### 2.3 P1 三条机械收口（改前/改后原文）

> ★rebase 后：P1-4 / P1-5 两条**已由 main `591eb0a` 修掉**（密度 P1 批量收口），
> 本分支不再重做，只保留为防回归钉；真改动只剩 P2-4。下面原文保留改前/改后对照，
> 但「本分支交付」栏以本节顶部说明为准。

**P2-4 登录页 mfa 分支重复（死代码）**——`LoginPage.tsx` 删掉第二个永不可达分支：
```diff
       ) : mfaChallenge ? (
         <MfaVerifyPanel … />
-      ) : mfaChallenge ? (
-        <MfaVerifyPanel … />
       ) : (
```

**P1-4 历史页同一计数两次**——`HistoryPage.tsx`：
```diff
-        meta={<span className={styles.metaText}>共整理出 {allItems.length} 条记录</span>>
...
+          {typeFilter !== 'all' || timeRange !== '30d' || stateFilter !== 'all' ? (
+            <span className={styles.metaText}>筛选生效中</span>
+          ) : null}
```
（计数只留工具条一处；删掉计数后空出的信息位换成「筛选生效中」状态，信息量更高。）

**P1-5 库详情「已加载 x/y」三处重复**——`LibraryDetailPage.tsx`：
```diff
-          <span className={styles.metaText}>
-            当前结果：{items.length} 个
-            {loadedCount < vm.totalItems ? ` · 已加载 ${loadedCount}/${vm.totalItems}` : ` · 已全部加载 ${loadedCount} 个`}
-          </span>
+          <span className={styles.metaText}>当前结果：{items.length} 个</span>
...
-              : `这个媒体库的 ${vm.totalItems} 个条目已经全部展开了`}
+              : '已经到底了，这个媒体库的全部条目都已展开'}
```
（工具条只回答筛选口径；尾部只留布尔态。加载计数只在 hero 出现一次。）

---

## 3. ★农场验收步骤（node62）

> 只写**步骤与断言点**。农场派发需主代理（`scripts/farm.sh` 护栏），
> 本节命令供主代理/农场执行体照抄。

### 3.1 前置：确认节点与代码到位

```bash
# 在 FMBY-V2 主仓（农场入口）
cd /home/tefuir/rustproject/FMBY-V2
bash scripts/farm.sh --nodes        # 确认 node62 在册（32c/15G，farm_root /mnt/build/fmby）
bash scripts/farm.sh --probe        # 看盘/内存/在跑作业；磁盘地板 30G，并发 2
```

### 3.2 起后端（fmby-v2-server，debug 构建）

```bash
# 编译（农场 32 核，别在本机跑——本机 4 核会被 fmby-queue 拒）
FMBY_ORCHESTRATOR=1 bash scripts/farm.sh <本卡分支或尖> build --node node62
# 本地等价（仅供理解农场在跑什么，本机勿跑重活）：
#   CARGO_TARGET_DIR=/data/fmby-build/local-target cargo build -p fmby-v2-server --bin fmby-v2-server
```
二进制落点：`/data/fmby-build/local-target/debug/fmby-v2-server`
（e2e 优先 debug 而非 release：F-09 守卫规定发布构建默认拒绝内置默认口令种子，
debug 才允许 ⇒ e2e 既定形态就是 debug，见 `host/e2e/binaryResolver.mjs` 注释）。

### 3.3 起前端（fmby-web，dev server）

```bash
cd /home/tefuir/rustproject/fmby-web   # 或本卡 worktree
pnpm install                            # 已装则跳过
pnpm --filter @fmby/v2-host dev         # 默认 http://127.0.0.1:5173
```
后端连本地：`host/.env.local` 里 `VITE_API_BASE_URL=http://127.0.0.1:8080`
（或 dev proxy 已配的同一 origin）。**不要** `pnpm build`（构建归主代理）。

### 3.4 起后端进程（含种子管理员）

```bash
# 种子管理员（debug 才允许默认口令 admin/admin）
FMBY_ORCHESTRATOR=1 bash scripts/farm.sh <ref> test --node node62   # 会顺带跑 seed
# 或本地起服务（脚本已封装好 env）：
bash /root/fmby-orchestra/serve-local.sh     # PORT 默认 8080，日志 /tmp/fmby-serve.log
curl -s http://127.0.0.1:8080/healthz        # 期望 200
```
登录：`admin` / `admin`（debug 种子默认口令）。

### 3.5 断言点 ①：扫码二维码三档尺寸

| 页面 | 入口 | 断言点 |
|---|---|---|
| 115 挂载扫码 | `/manage/mounts` → 任一挂载详情 → 「重新绑定凭据」 | 弹窗内二维码 ≤280px；宽度随弹窗内容宽收缩 |
| 115 新建扫码 | `/manage/mounts` → 「新建数据源」 → 扫码 tab | 同上 |
| 115 图床扫码 | `/manage/tools/pan115-imghost` → 「扫码绑定图床」 | 同上（**该路由 feature-flag 默认关**，需 `VITE_FEATURE_PAN115_IMGHOST=1` 才会出现在真实路由树） |
| 115 分享预览扫码 | `/manage/media/pan115-share` → 「发起扫码登录」 | 页内二维码不再被拉到整行宽；≤280px |
| 139 扫码 | `/manage/media/yun139` → 「发起扫码登录」 | 页内二维码 ≤280px；窄视口下等比缩 |

**DevTools 量法**（三档）：
1. 桌面：视口 ≥1280 → 选中 `img[alt*="二维码"]` → `offsetWidth` 应 ≤280。
2. 平板：视口 900-1279 → 应 ≤260 且随容器缩。
3. 手机：视口 ≤767（或 DevTools 设备模拟 iPhone 375px）→ 应 ≤240 且 **≥180**。
   重点断言：**不得 < 180px**（扫码可用下限，证据见 §1.4）。
4. 清晰度：把浏览器缩放放到 200%，115 二维码（PNG）**不得出现明显马赛克/模糊**
   （证明「只缩不放」生效：放大的是 CSS 盒，位图仍是原生 185px 渲染）。

### 3.6 断言点 ②：空态文案（不许谎报）

| 场景 | 操作 | 期望文案 | 不许出现 |
|---|---|---|---|
| 中控首屏（rebase 后口径） | `/manage` | **无任务队列卡**（main `591eb0a` P1-9 ① 已拔除；首屏 10 块）；本分支的断言是源码级：首屏**不得再渲染** `<ActiveTaskQueueWidget` | — |
| 中控任务队列本体（当前未挂载） | 仅当将来重新挂载时 | 空态「暂无进行中的任务 / 当前没有扫描、刮削或识别任务在执行。任务明细与历史见任务中心。」；链接 `/manage/task-center` | ~~「任务队列空闲」~~ ~~「所有挂载目录、海报与元数据已完成最新刮削与入库」~~ ~~`/manage/tasks`~~ |
| 命名刮削页头 | `/manage/media/naming-scrape` | 「…海报会落本地缓存，播放不依赖第三方外链可达性。」 | ~~「屁用没有」~~ |
| 历史页 | `/history` | 总条数只在 1 处（main `591eb0a` 保留页头「共整理出 N 条记录」）；筛选非默认时多一个「筛选生效中」 | 不得同屏两个 N |
| 库详情 | `/libraries/:id` | hero 一处「已加载 x/y」；工具条只有「当前结果：N 个」；尾部「已经到底了，这个媒体库的全部条目都已展开」 | 不得三处都出现 x/y |

### 3.7 断言点 ③：页面留白抽查（只抽不改）

| 页面 | 断言点 |
|---|---|
| `/manage`（中控） | 左列卡数/块数以 main 版为准（`591eb0a` 后 10 块）；任务队列卡**应不存在**（P1-9 ① 已拔除）——若看到「正在运行的任务队列」⇒ 说明挂回了旧版 |
| `/item/:id`（条目详情） | **登记未修**：嵌套 `.page` 双 gutter 仍在（P1-1，超出本卡机械改动范围）⇒ 只记录不改 |
| `/manage/media/items` | **登记未修**：指标板 3/4 是当前页瞬态值（P1-3）⇒ 只记录不改 |
| `/manage/site/users/accounts` | **登记未修**：10 列（P1-8）⇒ 只记录不改 |
| `/settings/*` | **登记未修**：sticky 让位魔数 88/120px（P1-10）⇒ 只记录不改 |

### 3.8 自动化回归（农场跑，别在本机跑重活）

```bash
# 前端单测（本机可跑：轻活）
cd /home/tefuir/rustproject/fmby-web
pnpm -r typecheck                 # 期望 EXIT=0（本会话未跑，见 §5 诚实边界）
node --import ./tests/register-aliases.mjs --test tests/*.test.ts   # rebase 后实测 824 tests / 820 pass / 4 fail（4 条均 main 存量红，见 §5）

# 前端 e2e（需后端二进制；无二进制时门禁会显式报数 exit 0，不会假绿）
FMBY_E2E_REQUIRED=1 node scripts/check-e2e.mjs        # 有二进制 ⇒ 真跑；无 ⇒ exit 3（基建缺件）
FMBY_E2E_REQUIRED=1 pnpm e2e-gate                      # 同上，走 pnpm verify 同一入口
```

---

## 4. ponytail 段（跳过了什么 / 何时再加）

### FE-UI-1
- **跳过** TOTP 绑定二维码（`MfaTotpSection.tsx:157`）换成 `ScanQrImage`：本卡只动
  115/139 扫码五点；TOTP 是纯机械替换，但**它和 FE-UI-2 的 P1 批次都碰
  `site-settings` 周边**，为避免两卡改同一文件冲突，排到下一卡（一句话改动）。
  **何时加**：下一卡顺手带，或产品再提「TOTP 二维码也太大」。
- **跳过** 主题侧覆写 `--scan-qr-max-*`：darkroom 未覆写也能得到正确档位
  （fallback 即档位值本身）。等有主题定制需求再接入 token。
- **跳过** 「点击放大预览」交互：扫码是低频确认动作，YAGNI。
- **跳过** 给 SVG/PNG 之外的新图种（WebP/JPEG）做分支：`kind` 已留
  `'bitmap' | 'vector'` 两类，位图口径覆盖 PNG/JPEG/WebP，无需第三类。

### FE-UI-2
- **跳过** 把任务队列挂回中控首屏：main `591eb0a`（P1-9 ①）已裁定首屏拔除
  （密度审计 13→10 块）。本卡只保证**本体**不再编造后端没有的字段，将来谁要
  恢复首屏队列，接 `taskCenterApi.getItems({status:'Running'})` 就能直接用。
- **跳过** 全部**动布局结构**的 P1：P1-1 双 gutter / P1-2 双类别控件 / P1-7 锚点+折叠 /
  P1-8 用户表 10→7 列 / P1-9 首屏 13→8 块 / P1-11 侧栏三层树。它们超出「最便宜的
  机械改动」范围，审计报告 §5 B3 批次已列，各自单开卡。
- **跳过** P1-3 媒体资源页指标板删除：需先裁「后端全局口径 vs 当前页瞬态值」的
  **产品口径**（数据面决策），不是机械改动。
- **跳过** P1-6 播放页三处外部播放入口合并：涉及 overlay/InfoBar/PlayerBar 职责划分。
- **跳过** P2-1 间距阶梯 111 处 / P2-2 字号 8 档收敛：量最大且需逐文件视觉核对，
  按审计报告建议「一次 commit 一文件」，属 B4 批次。
- **跳过** 中控任务队列的「刷新/暂停/取消」真动作：后端 `runAction` 已存在，但中控是
  **只读概览**，操作应发生在任务中心页（有 flash + redirect 语义）。中控这三个按钮
  仍走「任务操作不可用」banner（诚实拒绝，不假动作）。产品若要中控直接操作 ⇒
  另开卡接 `useTaskCenterMutations`。
- **跳过** widget 的 categoryFilter/分页/时间范围：首屏只要「现在在跑什么」，
  深筛是任务中心职责（YAGNI）。

---

## 5. 验证记录（本机实测，2026-10-18 rebase 后重跑）

| 项 | 结果 |
|---|---|
| `node --import ./tests/register-aliases.mjs --test tests/*.test.ts` | **824 tests / 820 pass / 4 fail**（456s）。4 条失败**全部是 main 存量红**，与本 PR 无关：`cas-admin-page.contract.test.ts` ⑦⑧（`cas-drive-write-affordance` ④）+ `tablewrap-region-audit.test.ts` A④（名单过期：`ManageCasPage.tsx::盘配置（CAS 矩阵）`）。本 PR 未触及任何 `cas*` 文件（`git diff --name-only origin/main...HEAD` 可复核） |
| `qr-image-responsive.dom.test.ts` | 3/3（真 Chromium DOM 尺寸） |
| `manage-overview-honesty.test.ts` | **6/6**（P0-①a/b/c/d + P0-② + 导出护栏；红侧：改前四条全中） |
| `fe-ui2-density-mechanical.test.ts` | 3/3（P2-4 红侧先跑必红；P1-4/P1-5 为防回归钉） |
| `tsc -p host/tsconfig.app.json --noEmit` | **本会话未跑**（席位纪律：前端构建/类型检查由编排侧执行）⇒ 交卡请求编排侧代跑，不得当作已绿 |
| `check-frontend-component-size` / `check-frontend-dupes` / `check-contract-mappers` / `check-versions` | 本会话未重跑（原分支记录为 PASS）；同上，请求编排侧随 PR 门禁复跑 |

## 6. 相关

- 审计报告：`docs/evidence/FE-UI-DENSITY-AUDIT.md`（只读审计，分支 `lovely-skunk` @ `47907b8`）
- 上一卡：FE-UI-1 二维码（`625cd8b`）
- 后端契约未动：`/api/manage/task-center/*` 端点与 DTO 全部沿用既有
  `shared/src/contracts/manage/task-center/`（本卡只消费，不改）。
