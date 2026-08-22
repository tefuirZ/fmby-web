# fmby-newui 完善方案 · 交接文档

> 生成于 2026-07-26，由云端会话调研产出。
> **给下一个会话（建议在本机运行，可同时读写 `G:\fmby-newui` 与 `Z:\tefuir\rust-project\fmby-main\fmby`）：先读这份文档，不要重新调研。**

---

## 0. 一句话结论

`fmby-newui`（包名 `aurora-glass`）是从主仓 `apps/web`（classic 主题）拷贝到 `G:\` 的独立工程。因为脱离了主仓的 pnpm workspace，它拿不到 `@fmby/shared`，于是**把主仓已有的契约层重写了一遍**。功能完成度约 90%，但架构上背了一层不该存在的重复代码。

本轮目标：**接回 `@fmby/shared`、消灭双实现、补完唯一的占位页、换一套全新视觉**。

---

## 1. 主仓共享层现状（已确认）

主仓 `apps/shared` 是 workspace 包，包名 **`@fmby/shared`**，已被 `apps/web` 和 `apps/web-gallery` 通过 `node_modules/@fmby/shared` 软链消费。

```
apps/shared/
├── package.json                    (5.4 KB，含 exports 子路径映射)
├── src/contracts/                  ~60 个契约模块
│   ├── auth/        auth · identity · identity-manage-{config,draft,ui}
│   ├── browse/      collections
│   ├── install/     install-{api,runtime,status,types}
│   ├── manage/      libraries(35KB) · users(26KB) · task-center(25KB)
│   │                media-items(23KB) · media-reviews(24KB) · yun139(22KB)
│   │                registration-codes · role-templates · probe-tasks
│   │                runtime-logs · sessions · overview · mounts/ · upstreams/
│   │                license-* · developer-api · events · client-info …
│   ├── playback/    format-timecode
│   ├── settings/    site-settings · naming-scrape · cdn-operations
│   │                site-outbound-proxy · user-playback · ai-assist
│   └── theme-capabilities.ts       (23 KB)
├── src/support/                    ~20 个工具
│   asset-image · date-time · probe · bytes · ticks · media-kind
│   directory-browser · filtered-selection · form-field · number
│   player-episode-navigation · pan115-cookie-app · sensitive-text
│   share-batch-import · manage-playback-remote · clipboard · dom-download …
└── manage|player|settings/         若干 60 字节的子路径 re-export shim
```

**主仓的分层约定：** `domains/*` = 请求编排（薄） + `@fmby/shared/contracts/*` = 类型与 mapper（共享）。
`apps/web`（classic）同时具备两者，可作为对照实现参考。

> ⚠️ 以下两点云端会话**无法读取文件内容**（Z: 盘 stat 失败），下一个会话务必先自行确认，不要照抄：
> - `apps/shared/package.json` 的 `exports` 具体子路径写法
> - 各 contract 模块实际导出的符号名
> - `pnpm-workspace.yaml` 的 packages glob（决定 newui 放哪儿才能被识别）

---

## 2. newui 里应当删除的重复实现

以下文件都是 `@fmby/shared` 已有能力的二次手写，合计约 15 万字符：

| newui 路径 | 大小 | 对应的 shared 模块 |
| --- | --- | --- |
| `src/domains/manage/raw-types.ts` | 12 KB | 各 contract 的 Raw* 类型 |
| `src/domains/manage/types.ts` | 20 KB | `contracts/manage/*` |
| `src/domains/manage/mapping/*.ts`（9 个） | 40 KB | 各 contract 的 mapper |
| `src/domains/manage/media-items/api/mappers-*.ts`（5 个） | 23 KB | `contracts/manage/media-items` |
| `src/domains/manage/media-items/types.ts` | 10 KB | 同上 |
| `src/domains/manage/naming/types.ts` | 3.6 KB | `contracts/settings/naming-scrape` |
| `src/domains/settings/{mappers,raw-types,types}.ts` | 12 KB | `contracts/settings/site-settings` |
| `src/domains/manage/ua-parser.ts` | 5.7 KB | `contracts/manage/client-info` |
| `src/domains/manage/provider-mapping.ts` | 0.9 KB | `contracts/manage/mounts` |
| `src/shared/utils/pan115-cookie-app.ts` | 0.9 KB | `support/pan115-cookie-app` |
| `src/shared/utils/date.ts` | 3.2 KB | `support/date-time` |
| `src/shared/hooks/useCredentialProbe.ts` | 5.2 KB | `support/probe`（部分） |
| `src/domains/manage/task-center/types.ts` | 1.8 KB | `contracts/manage/task-center-types` |

**改造后 `src/domains/*` 应当只剩：** `api.ts`（fetch + 端点拼接 + 调用 shared mapper）、`index.ts`（re-export）。类型与 mapper 一律从 `@fmby/shared` 引。

另外 newui 相比 classic **丢掉了 4 个 domain**，视产品范围决定是否补回：`collections`、`developer-api`、`identity`、`install`。

---

## 3. newui 内部的双实现（已决策）

### 3.1 服务器设置 —— ✅ 已定：只保留 `/manage` 一处

现状是同一批服务器级设置写了两遍：

| 用户端（删） | 管理端（留） |
| --- | --- |
| `pages/settings/ServerGeneralSettingsPage.tsx` | `pages/manage/site-settings/components/SiteSettingsBasicSection.tsx` |
| `pages/settings/ServerSecuritySettingsPage.tsx` | `.../SiteSettingsSecuritySection.tsx` |
| `pages/settings/ServerSessionPolicySettingsPage.tsx` | `.../SiteSettingsSessionSection.tsx` |
| `pages/settings/ResetIpLoginRiskPanel.tsx` | `.../ResetIpLoginRiskPanel.tsx` |

执行清单：

1. 删除上表左列 4 个文件，以及 `pages/settings/index.ts` 中对应的三行导出
2. `app/router/index.tsx` 里 `settings/server/general|security|session-policy` 三个路由，改为 `<Navigate replace to="/manage/site/settings" />`
3. `pages/settings/settingsNavigation.ts` 移除服务器分组，设置中心只留 `profile / playback / appearance` 三个用户级页面
4. 确认 `CapabilityGuard required="manage:access"` 只剩管理端一处

### 3.2 死代码 —— 直接删

- `src/pages/manage/source-governance-fields.tsx`（9.6 KB）**无任何引用**；实际在用的是 `src/pages/manage/longtail-shared/source-governance-fields.tsx`

### 3.3 布局转发壳 —— 可保留

- `pages/settings/SettingsLayout.tsx` 只是 `app/layouts/SettingsLayout` 的 re-export，属于有意为之的门面，不算重复

---

## 4. 唯一的功能空洞

`src/pages/manage/ManageMediaItemDetailPage.tsx` 仍是 `createPlaceholderPage('媒体资源详情')`，但路由 `/manage/media/items/:itemId` 已开放 —— 用户点进去看到"页面建设中"。

补完时可直接复用已有能力，不必新写数据层：
- `domains/manage/media-items/api/*`（queries / mutations 已齐全：metadata、artwork、subtitles、sources、scrape、pipeline、refresh-metadata、scan）
- `pages/browse/item-detail/components/*` 的展示型组件
- 迁移到 `@fmby/shared` 后，类型来源改为 `contracts/manage/media-items`

---

## 5. 视觉方向（进行中）

现状 aurora-glass = 深紫毛玻璃 + 横向 rail，与主仓 classic 气质接近，需要彻底换掉。
已产出三个方向的可视化样稿：`fmby-design-directions.html`

| | 方向 | 概念 | 管理页适配 |
| --- | --- | --- | --- |
| A | 暗房 Darkroom | 纯黑画布，无卡片/无边框/无玻璃；品牌色由封面主色动态提取 | 中 |
| B | 胶片档案 Archive | 编辑部排版：报头横线、栏目编号、严格网格、朱红单强调色 | 好 |
| C | 控制台 Console | 承认是自托管服务器：等宽字、直角、栅格、信号色、键盘优先 | 最好 |

**待用户确认后再动 `src/styles/tokens.css`。** 落地顺序建议：先 tokens → 再 primitives → 再 layouts → 最后逐页。

---

## 6. 其余待办（按优先级）

1. **dist 已过期** —— 构建产物早于最后一轮源码改动，需重跑 `pnpm package`（= build + verify-dist）
2. **零测试** —— 无任何 `.test/.spec`，`screenshots/` 为空。主仓 `apps/web-gallery` 有现成的 `playwright.config.ts` + `tests/` + `scripts/check-contract-mappers.mjs` + `check-request-boundaries.mjs`，接回 workspace 后可直接复用
3. **包体** —— `matchKeyword` chunk 304 KB（pinyin-pro 全量进包），建议改为动态 import；`index` 395 KB 可再拆
4. **可访问性** —— 3.1 万行代码仅 42 处 `aria-label`、1 处 `aria-live`
5. **`.spec-workflow`** —— specs / steering / archive 全空，只剩模板
6. **三处"暂未开放"** —— 二次校验 ×2、注册码↔角色模板联动
7. **UI 细节** —— 媒体库详情筛选栏用的是原生 `<select>`，与主题不符

---

## 7. 建议执行顺序

```
① 接回 workspace          把 newui 移入主仓 apps/（或加进 pnpm-workspace globs）
                          → pnpm install，确认 node_modules/@fmby/shared 软链出现
② 删双实现 + 死代码       第 3 节，改动小、无外部依赖，先做完锁一版
③ 迁移到 @fmby/shared     第 2 节，按 domain 逐个换：settings → task-center
                          → probe-tasks → media-items → manage 主体
                          每换完一个跑 tsc -b
④ 补 ManageMediaItemDetail 第 4 节
⑤ 换视觉                  第 5 节，tokens 优先
⑥ 补测试 + 重新打包       第 6 节
```
