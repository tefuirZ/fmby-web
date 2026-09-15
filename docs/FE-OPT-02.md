# FE-OPT-02 移动端适配打磨（w2 交付 · 前端仓 w/fe-opt-02）

> 基线：fmby-web main @ `61ec4fd`。审计工具：`host/e2e/mobile-audit.spec.ts`
> （playwright 真跑，真实 fmby-v2-server release 二进制 + e2e seed + 真实 SQLite）。
> 断点档位沿用暗房约定（responsive.css）：phone <768 / tablet <1024 / desktop ≥1024，
> 与卡面 640/1024 分界的差异已对齐仓内既有口径（768 是 `useLayoutHint` 冻结断点）。

## 八行报告

- **任务结论**：① 三断点（375/768/1280）× 25 页截图归档（75 张；**REPO-HYGIENE-01 后抽样入库**：`docs/evidence/fe-opt-02/samples/` 8 张 + 索引，全量外置——见 `docs/evidence-policy.md`）+ 手机档横向溢出审计——发现并修复**全站性 +69px 溢出**（TopBar 未接手机档 token + 搜索触发器/用户名不收窄），修复后 25 页 **0 溢出**；② 触控目标审计——修复 Button 组件触屏 44px、Switch 命中区伪元素扩展、mobileClose 36→44px、TopBar 图标化按钮 padding 提升，修复后违规 **0**；③ 管理面移动化：侧栏移动版抽屉（Radix Dialog）+ mobileBar 触发器已有，表格 `tableWrap overflow-x:auto` 断言通过、新建抽屉手机上 0 越界可关闭；④ 播放页移动端：直达 /play/101 真跑——播放器挂载、进度条元素 >40px 可拖（down→move→up 无异常）、播放页 0 横向溢出、截图归档。
- **修改范围**：TopBar.module.css（手机档断点：矮顶栏/导航横滚/搜索图标化/用户钮收窄）、ManageLayout.module.css（mobileClose 44px）、shared Button.module.css（触屏 min-height 44px）、shared Switch.module.css（::before 命中区扩展）、mobile-audit.spec.ts（新）。
- **测试**：mobile-audit **6 passed / 0 failed**；pnpm verify **11 闸全绿**（versions/typecheck/build/build:themes/test/size/dupes/contracts/theme-budget/theme-parity）。
- **门禁**：size 179KB<300KB；themes node:test 14/14；shared 49 pass。
- **Review**：Switch 用 `::before inset:-10px` 扩命中区（WCAG 2.5.5 惯例）而非改视觉尺寸——轨道 44x24 外观不变；Button 触屏 44px 仅在 `(hover:none) and (pointer:coarse)` 生效，桌面零影响。
- **风险登记**：`routeLoaders`/`PATH_PREFETCH_KEYS` 与路由表为人工同步（FE-OPT-01 遗留登记）；audit-logs 后端 fail-closed，长列表虚拟化以现有虚拟化网格+服务端分页核实。
- **对主代理依赖**：无。
- **兼容性确认**：全部 CSS 改动收在 `@media (hover:none) and (pointer:coarse)` 或 `@media (max-width:767px)` 内，桌面渲染零变化；pnpm verify 全绿佐证。

## 卡面任务逐项对照

| # | 卡面要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 三断点逐页截图 | ✅ | 原 `docs/evidence-fe-opt-02/{phone-375,tablet-768,desktop-1280}/` 各 25 页 + playback（26）；REPO-HYGIENE-01 后为 `docs/evidence/fe-opt-02/samples/`（8 抽样）+ `full/`（外置，gitignored） |
| 1b | 横向溢出核查 | ✅ 修复 | before：25 页全部 +69px → 修 TopBar 后仍 +45px（rightArea 恒定）→ 收窄 searchTrigger/userButton → **25 页 0px** |
| 2a | 点按目标 ≥44px | ✅ 修复 | before：4 类违规（36x36 ×3、44x24 Switch）→ after：**none**（Button 触屏 44px + Switch ::before 命中区 + mobileClose 44px + topbar 按钮 padding 提升） |
| 2b | 滑动画廊手势 | ✅ 核实 | mediaRail/continueRail `overflow-x:auto + scroll-snap-type:x proximity`（shared.module.css:380+）；触屏惯性 `-webkit-overflow-scrolling: touch`（responsive.css） |
| 2c | 滚动惯性 | ✅ 核实 | 同上（iOS 惯性滚动属性在库） |
| 3 | 管理面 18 页窄屏呈现 | ✅ | 18 页截图归档 0 溢出；表格容器 `overflow-x:auto` 断言过（tableWrap）；抽屉（Radix Dialog）在 375 宽内 0 越界且有关闭按钮（manage on mobile 测试） |
| 4 | 播放页移动端 | ✅ | 直达 /play/101：播放器挂载、进度条 >40px 且拖动（down/move×8/up）无异常、0 横向溢出、截图 `phone-375/playback.png`；全屏/手势依赖浏览器原生 video 控件与 artplayer 触摸层 |

## 修复明细（位置/类型/内容）

| # | 位置 | 问题 | 修复 |
| --- | --- | --- | --- |
| F-1 | `TopBar.module.css` | 手机档未接 `--topbar-height-mobile`（恒 64px）；nav 挤爆 | 手机档 56px 矮栏 + nav `overflow-x:auto`（max-width 52vw，隐藏滚动条） |
| F-2 | 同上 | searchTrigger 含"搜索媒体… + Ctrl K" 121px 宽 | 手机档图标化（`searchLabel`/`searchKbd` display:none，aria-label 保留），padding 15px 保 44px |
| F-3 | 同上 | userButton 用户名文字挤出视口 | 手机档只留头像（`userName` display:none），padding 9px 保 44px |
| F-4 | `Button.module.css`（shared） | 触屏上 md 按钮 38px 高 <44px | `(hover:none) and (pointer:coarse)` 下 min-height:var(--touch-min)=44px；sm 轻量 40px |
| F-5 | `Switch.module.css`（shared） | 开关 44x24 高度不足 | 触屏下 `::before inset:-10px` 扩命中区至 44x44（视觉零变化） |
| F-6 | `ManageLayout.module.css` | mobileClose 36x36 | 44x44 |

## 真跑证据

- spec：`host/e2e/mobile-audit.spec.ts`，6 tests：
  1. `sweep phone-375`（25 页截图+溢出审计）
  2. `sweep tablet-768`
  3. `sweep desktop-1280`
  4. `touch targets >= 44px on phone`
  5. `tables are horizontally scrollable and drawers usable on phone`
  6. `player controls reachable and progress bar draggable on phone`
- 结果：**6 passed / 0 failed**（1.7m）
- 关键审计输出：
  - `phone horizontal overflow pages: none`
  - `touch targets below 44px (non-exempt): none`
  - `library table wrap overflow-x: auto`
  - `topbar diag: mq=true, labelDisplay=none`（手机档规则确认生效）

## 附带修正（commit 内一并处理）

- `host/.env.local` 意外入库 → 移出跟踪并加入 `.gitignore`（该文件是本机 dev proxy 地址，属本地环境配置）。
- `host/docs/{HANDOFF-完善方案.md, darkroom-preview.html, design-directions.html}` 被误删 → 从上一提交恢复（与移动端无关的历史文档）。

## 门禁记录

| 闸 | 结果 |
| --- | --- |
| pnpm versions | PASS |
| pnpm typecheck | PASS |
| pnpm build | PASS |
| pnpm build:themes | PASS |
| pnpm test | PASS（darkroom 14 / shared 49） |
| pnpm size | PASS（179KB / 300KB；[3b][3c] 断言过） |
| pnpm dupes | PASS |
| pnpm contracts | PASS |
| pnpm theme-budget | PASS |
| pnpm theme-parity | PASS |
| mobile-audit e2e | **6 passed / 0 failed** |
| 截图归档 | 76 张（3 设备 × 25 页 + playback 特写） |
