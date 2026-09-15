# FE-OPT-05 主题开发体验 + 第三方主题样板（w3 交付 · 前端仓 w/fe-opt-05）

> 基线：fmby-web main @ `edb41d6`。分支 `w/fe-opt-05`。
> 动机：主题外挂链路（独立产物 + 运行时加载 + JS/TS 支持）已通，但缺一个
> 「从零做第三方主题」的**完整可跑样板**——多主题生态的关键起点。

## 八行报告

- **任务结论**：① `themes/_template` 从「CSS-only 空壳」升级为**第三方主题完整样板**——含一个**真实可用**的 `browse.item` L3 皮肤（编辑档案/dossier 版式，五态全覆盖 + 响应式 + 实时 + 导航）；② 完整 manifest（contract_version/tokens/skins/nav）+ IIFE library 构建 + 三处改名起步流程；③ **真实栈验证**：构建产物装进 `data/themes/template/dist/` 后，后端静态面伺服、host 运行时 IIFE 加载、`browse.item` 皮肤真实渲染（4/4 e2e 通过）；④ README 给出「复制→构建→安装到 data/themes」全流程；⑤ 同步修正 theme-guide 两处过时内容（registry 接线 / verify 闸数）。
- **修改范围**：`themes/_template/`（新增 `src/skins/ItemSkin.ts`、`skins/item.css`、`tests/ItemSkin.test.ts`；改写 `src/index.ts`、`theme.manifest.json`、`package.json`、`README.md`；删 `src/skins/ExampleSkin.ts` 空骨架）、`host/src/theme/registry.ts`（template 增 item.css 资源）、`host/e2e/theme-template-skin.spec.ts`(新)、`docs/theme-guide/getting-started.md`。
- **测试**：`pnpm verify` 11 闸全绿；**Playwright 全量 87 passed / 0 failed**（新增 `theme-template-skin.spec` 4 测试）；`_template` node:test 9/9（五态/版式/导航/实时）；darkroom 19、shared 49、host 14。
- **门禁**：theme-parity（`browse.item` 四项能力面齐备）PASS；size `[3c]`（IIFE 产物 + react 外部化）PASS；theme-budget PASS；dupes（主题纯度）PASS。
- **Review**：样板用 `createElement` 形态（与仓库既有主题一致，node:test strip-types 可直接断言）；导航经 host 注入的 `openItem`/`itemHref`（主题不自建路由字面量，保持禁路由纯度）。
- **风险登记**：① `manifest.nav` 目前 host 未消费（既有面，非本卡）；② 样板只示范 `browse.item` 一个域；③ `ExampleSkin` 空骨架已删除（被真实 `ItemSkin` 取代）。
- **对主代理依赖**：无。
- **兼容性确认**：`template` 主题**未**声明 `browse.library` skin → 既有「回落 host 默认页」路径与 a11y 筛选器断言零影响（真实栈已验）；`theme-switch` 2/2 仍绿。

## 一、交付：`_template` 升级为完整样板

| 交付项 | 内容 |
|---|---|
| **真实 L3 皮肤** | `src/skins/ItemSkin.ts` —— `browse.item` 域「编辑档案（dossier）」版式：导语头 + 事实带 + 双栏（叙述/事实）+ 剧集横滑带。五态全覆盖（loading/ready/empty/error/forbidden），与 host 默认页、与 darkroom 均**实质不同** |
| **样式层** | `skins/item.css` —— 挂在 `[data-template~=…]` 属性钩子，消费 token（带兜底值），`<768px` 单列响应式 |
| **完整 manifest** | `contract_version: "0.1"` + `tokens.{cssFile,extraCssFiles}` + `skins.{browse.item}` + `nav.items` + `preload:false`（331 B < 2KB 红线） |
| **IIFE 构建** | `vite.config.ts`（library 模式，IIFE + external react/react-dom/react/jsx-runtime/@fmby/v2-shared；参考 darkroom）→ `dist/{index.js,tokens.css,theme.manifest.json,skins/item.css}` |
| **入口 + 能力面** | `src/index.ts` —— 导出 `ThemeEntryModule`（manifest + `domainSkins` + `capabilities`），注释含起步三改 + 五态指引 |
| **单测** | `tests/ItemSkin.test.ts` —— 9 测试（五态 / dossier 版式 / 响应式无内联列 / 导航注入与回退 / 实时契约） |
| **README** | 6 节全流程：包含什么 → 复制起步 → 写皮肤 → 构建 → **安装到 data/themes** → 验证门禁 → 硬约束 |

## 二、验证：样板真实可跑（真实栈）

`host/e2e/theme-template-skin.spec.ts`（真实 `fmby-v2-server` + 真实 SQLite，
非 skip）——**4 passed / 0 failed**：

| # | 断言 | 结果 |
|---|---|---|
| 1 | 主题产物经后端静态面可达：`/themes/template/{theme.manifest.json,index.js,tokens.css,skins/item.css}` 全 200 且 content-type 正确；manifest `skins['browse.item']='ItemSkin'` | ✅ |
| 2 | 切到 `template` 主题 → `data-theme="template"`、`skins/item.css` 样式层注入、`/item/101` 上 `[data-template="item-dossier"]` 真实渲染（`data-state="ready"` + 导语头/双栏 + 标题「星际穿越」） | ✅ |
| 3 | 导航面：host 注入的 `itemHref` 产出真实 `<a href="/item/...">`（主题不自建路由） | ✅ |
| 4 | 未声明 `browse.library` → 回落 host 默认页（4 筛选组合框 + 条目锚点在场），不出现皮肤钩子 | ✅ |

**验证链**：`build:themes` → `start.mjs` 组装 `data/themes/template/dist/` →
后端静态面 `/themes/template/*` → host registry 运行时 **IIFE** 加载
（`window.React` 由 `themeGlobals.ts` 注入）→ `DomainSkinOutlet` 调度渲染。

### 产物（`themes/_template/dist/`）

```
index.js              4,897 B   # IIFE：var FmbyTheme=(function(e){…})(React)；react 未打包
theme.manifest.json     331 B   # < 2KB 红线
tokens.css            1,528 B
skins/item.css        8,118 B
```

> size 闸实测：`[PASS] themes/_template/dist/index.js IIFE 产物且 react 外部化`；
> `[PASS] Theme [_template] total assets within 400KB limit`。

## 三、从复制到安装（README 摘要，全流程）

```bash
# 1. 复制 + 三处改名（package name / manifest id / manifest label）
cp -r themes/_template themes/mytheme

# 2. 构建（IIFE + 静态资源搬运）
pnpm --filter @fmby/v2-theme-mytheme build      # → themes/mytheme/dist/

# 3A. 仓内主题：host/src/theme/registry.ts 登记一行
#     makeRegistration('mytheme', ['tokens.css', 'skins/item.css'])
# 3B. 第三方外挂（推荐，免重建 host）：装进后端数据目录
mkdir -p "$FMBY_DATA_DIR/themes/mytheme"
cp -r themes/mytheme/dist "$FMBY_DATA_DIR/themes/mytheme/dist"

# 4. 验证
pnpm verify
```

后端静态面：`GET /themes/<id>/<rest>` → `${FMBY_DATA_DIR}/themes/<id>/dist/<rest>`
（目录名 = manifest `id`；路径穿越防护见后端 `themes.rs`）。

## 四、门禁记录

| 闸 | 结果 |
|---|---|
| `pnpm versions` | PASS |
| `pnpm typecheck`（shared/host/darkroom/**_template**） | PASS |
| `pnpm build` / `pnpm build:themes` | PASS |
| `pnpm test`（shared 49 / darkroom 19 / **_template 9** / host 14） | PASS |
| `pnpm size`（含 [3c] IIFE + react 外部化） | PASS |
| `pnpm repo-size` | PASS |
| `pnpm dupes`（主题纯度） | PASS |
| `pnpm contracts` / `theme-budget` / `theme-parity` | PASS |
| Playwright 全量（真实栈，非 skip） | **87 passed / 0 failed** |

## 五、未覆盖 / 登记

1. **`manifest.nav` 未消费**：host 侧尚无主题导航合并点（既有面，非本卡引入）；样板 `nav.items` 留空并注释。
2. **样板只示范一个域**：`browse.item`。其余 6 个域的接入方式在 README 表格 + l3-skin 指南中说明（同模式）。
3. **`ExampleSkin` 空骨架移除**：其「五态 + 硬约束」示范职责由真实 `ItemSkin` 承接（后者更完整）。
4. **契约仓 `skin-package/`**：README 声明该目录为「主题包规范」权威源，但当前为空
   （`fmby-ui-contract-v2/skin-package/` 无文件）。本卡只**链接**它（不越仓写入）；
   建议后续卡（DOC-THEME 系列）填充该目录——登记。
