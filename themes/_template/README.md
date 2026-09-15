# 模板主题（`_template`）—— 第三方主题完整样板

> **这是「从零做一个第三方主题」的可跑起手工程**，不只是一个空壳。
> 它包含一个**真实可用**的 L3 域皮肤（`browse.item`，见
> [`src/skins/ItemSkin.ts`](./src/skins/ItemSkin.ts)），以及一套完整的
> token / manifest / 构建 / 安装接线。复制本目录，改三处名，即可产出你自己的主题。

配套文档（按顺序读）：
- [`docs/theme-guide/getting-started.md`](../../docs/theme-guide/getting-started.md) —— 概念与字段逐条对照
- [`docs/theme-guide/l3-skin.md`](../../docs/theme-guide/l3-skin.md) —— L3 域皮肤契约（SkinProps / 五态 / 能力面）
- [`docs/theme-guide/testing.md`](../../docs/theme-guide/testing.md) —— node:test 断言模式 + verify 门禁排查表
- 契约仓 [`fmby-ui-contract-v2 / skin-package`](https://github.com/tefuirZ/fmby-ui-contract-v2/tree/main/skin-package) —— 主题包规范（权威）

---

## 0. 本样板包含什么

```text
themes/_template/
├── package.json            # 包名 @fmby/v2-theme-template（workspace 成员）+ build/test 脚本
├── theme.manifest.json     # 主题清单（红线 < 2KB）
├── tokens.css              # 设计 token（换肤根基；变量语言同 host defaults.css）
├── vite.config.ts          # library 构建（IIFE + external react/shared）
├── tsconfig.json           # TS 配置
├── README.md               # 本文件
├── skins/
│   └── item.css            # 域皮肤样式（挂在 [data-template~=…] 属性钩子上）
├── src/
│   ├── index.ts            # 入口：默认导出 ThemeEntryModule（manifest + domainSkins + capabilities）
│   └── skins/
│       └── ItemSkin.ts     # ★ 真实可用的 browse.item 皮肤（五态 + dossier 版式 + 导航）
└── tests/
    └── ItemSkin.test.ts    # node:test：五态 / 版式 / 导航注入 / 实时契约
```

`ItemSkin` 演示了 L3 皮肤的全部要点：**五态全覆盖、只吃 SkinProps、禁取数、
响应式（CSS 媒体查询）、实时订阅、经 host 注入的 `openItem`/`itemHref` 做导航**
（主题不自建路由字面量）。

---

## 1. 从复制到起步（3 步）

```bash
# 在前端仓（fmby-web）根目录
cp -r themes/_template themes/mytheme
```

然后改**三处名**（保持 package name 与 manifest id 一致）：

| 位置 | 改成 | 说明 |
|---|---|---|
| `themes/mytheme/package.json` 的 `name` | `@fmby/v2-theme-mytheme` | workspace 包名 |
| `theme.manifest.json` 的 `id` | `"mytheme"` | host 注册表按 id 登记 |
| `theme.manifest.json` 的 `label` | `"我的主题"` | 切换器里的显示名 |

---

## 2. 写你自己的皮肤（可选）

`_template` 自带 `browse.item` 皮肤。若你要**接管别的页面域**（见下表），或换一套版式：

**七个 PageDomain**（键 = manifest `skins` 的键 = 入口 `domainSkins` 的键）：

| domain | 路由 | 说明 |
|---|---|---|
| `browse.home` | `/`、`/history`、`/libraries` | 首页/历史/库列表（粗粒度归并） |
| `browse.library` | `/libraries/:id` | 库详情 |
| `browse.item` | `/item/:id` | 条目详情（本样板已实现） |
| `browse.play` | `/play/:id` | 播放 |
| `manage` | `/manage` | 管理面 |
| `settings` | `/settings` | 设置 |
| `observability` | `/observability` | 可观测 |

**两处声明（缺一不可，`check-theme-parity` 门禁校验）**：

```jsonc
// theme.manifest.json —— ① 声明接管哪个域
{ "skins": { "browse.item": "ItemSkin" } }
```

```ts
// src/index.ts —— ② 挂组件 + 声明能力面
import { ItemSkin } from './skins/ItemSkin';
const capabilities = { global: ['realtime', 'mobile', 'timezone', 'authorization'] };
const theme: ThemeEntryModule = {
  manifest,
  domainSkins: { 'browse.item': ItemSkin },
  capabilities,
};
```

若皮肤有独立样式：写 `skins/<域>.css`，并**同时**登记三处（样板里
`skins/item.css` 已演示全流程）：
1. `theme.manifest.json` 的 `tokens.extraCssFiles`；
2. `package.json` 的 `exports`；
3. host 的 `host/src/theme/registry.ts`（生产接线，见下节）。

> **未声明的 domain 自动回落 host 默认页**——功能永不缺失；**声明即负责**
> （四项能力面必须齐备，否则 parity 门禁红）。

---

## 3. 构建

```bash
pnpm build:themes                 # 构建所有主题（含本主题）
# 或只构建本主题：
pnpm --filter @fmby/v2-theme-template build
```

产物落在 `themes/_template/dist/`：

```text
dist/
├── index.js                # IIFE（var FmbyTheme = …），react/shared 外部化
├── theme.manifest.json     # 拷贝自源
├── tokens.css              # 拷贝自源
└── skins/item.css          # 拷贝自源（build 脚本自动搬运静态资源）
```

**为什么是 IIFE？** 浏览器无 importmap，ESM 裸说明符（`import "react"`）无法解析。
IIFE 产物由宿主以 `<script>` 注入执行，`react` / `react-dom` / `@fmby/v2-shared`
由**宿主全局**提供（`window.React` / `window.ReactDOM` / `window.FmbyShared`）——
既零外部依赖，又杜绝第二份 react 实例。`external` 纪律由 `check-frontend-size.mjs`
反查产物字节守住（打包了 react 会被抓）。

---

## 4. 安装到 host（两种路径）

### 4A. 仓内主题（开发/官方主题）：登记注册表

在 `host/src/theme/registry.ts` 加一项：

```ts
template: makeRegistration('template', ['tokens.css', 'skins/item.css']),
```

`makeRegistration(id, cssFiles)` 会按运行时路径 `/themes/<id>/<file>` 组装资源 URL +
IIFE 入口加载器。**host 只登记，不打包主题源码**（首屏零主题字节，`check-frontend-size` 强制）。

### 4B. 第三方主题（外挂）：放进 `data/themes/<id>/`

第三方主题**无需重建 host**——后端静态面把
`GET /themes/<id>/<rest>` 映射到 `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`。
故把构建产物按下列结构放进后端的数据目录即可：

```bash
# 后端数据目录（FMBY_DATA_DIR 指向的目录）
FMBY_DATA_DIR=/path/to/data
mkdir -p "$FMBY_DATA_DIR/themes/mytheme"
cp -r themes/mytheme/dist "$FMBY_DATA_DIR/themes/mytheme/dist"
```

```text
$FMBY_DATA_DIR/
└── themes/
    └── mytheme/
        └── dist/            # 即上一步的 dist/ 内容
            ├── index.js
            ├── theme.manifest.json
            ├── tokens.css
            └── skins/item.css
```

> **目录名 = manifest `id`**（运行时路由按 id 取）。若目录名与 id 不一致
>（如仓库里 `_template` 目录 → `template` id），以 manifest 的 `id` 为准。

后端发现链：`/api/site/themes` 列出安装的主题（含 `installed`/`origin`），
前端 `ThemeProvider` 经 `/themes/<id>/theme.manifest.json` 拉清单、
`/themes/<id>/*` 拉 tokens/入口。装好后在「设置 → 外观 → 界面皮肤」即可切换。

---

## 5. 验证（提交前必跑）

```bash
# 全链门禁（在 fmby-web 根目录）
pnpm verify
```

与本主题直接相关的闸：

| 门禁 | 检查什么 |
|---|---|
| `pnpm typecheck` | 四包 tsc 全绿（含本主题） |
| `pnpm test` | 本主题 `tests/*.test.ts`（五态/版式/导航） |
| `pnpm build:themes` | 产出 `dist/`（IIFE + 静态资源） |
| `node scripts/check-theme-parity.mjs` | 声明了 domain → 四项能力面齐备 |
| `node scripts/check-theme-budget.mjs` | 单文件 God File 分级（不限总量） |
| `node scripts/check-frontend-dupes.mjs` | 主题纯度（禁 API/取数/路由/query key） |
| `node scripts/check-frontend-size.mjs` | 首屏零主题字节 + 产物 IIFE/react 外部化 |

---

## 6. L3 硬约束（违反即门禁红 / 评审打回）

- **只接收 `SkinProps`**：`{ data, state, actions, realtime }` 全部 host 注入；
- **禁取数 / 禁路由**：`useQuery` / api client / contracts 裸 DTO / 自建 query key /
  路由字面量一律禁止（`check-frontend-dupes.mjs` 扫描强制）。导航只经 host 注入的
  `actions.openItem(id)` / `actions.itemHref(id)`；
- **五态全覆盖**：`loading / ready / empty / error / forbidden` 都要有 DOM 输出；
- **移动端必须有**：CSS 媒体查询单列分支（`<768px`，与 shared 断点口径一致）；
- **实时显示**：挂载即 `props.realtime.subscribe(...)`（host 轮询兜底），
  主题不得自建定时器/连接；
- **质量门禁**：单文件禁 God File（>1000 行必拆）；主题**不限总量**（禁的是屎山，不是大）。

---

## 7. 一分钟清单

- [ ] `cp -r themes/_template themes/mytheme`，改三处名（package name / manifest id / label）
- [ ] `tokens.css` 改画布色（让 `--bg-base` 与默认主题拉开差距，切换时立辨）
- [ ] 要用 L3 皮肤：写 `src/skins/<域>Skin.ts`，manifest `skins` + 入口 `domainSkins` 双声明
- [ ] 皮肤有样式：写 `skins/<域>.css`，登记 manifest `extraCssFiles` + `package.json` exports + host registry
- [ ] `pnpm verify` 全绿
- [ ] 安装到 `data/themes/<id>/dist/`（外挂）或登记 host registry（仓内），切换器可见
