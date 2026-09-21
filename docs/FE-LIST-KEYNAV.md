# FE-LIST-KEYNAV —— 列表方向键漫游（A11Y 收口）· `w/zcode/writer1-fe-list-keynav`

> 基线：fmby-web `main` @ `d4289e5`（含 FE-OPT-03 成果）。
> 本卡是我上一轮自己标出的「未做项」：列表方向键导航。

## 开工前机械核实（卡面真假）

先查仓内是否已有方向键漫游：
- 字面量扫描：仅 `CinemaFilmstrip.tsx` 有 ←/→ —— 但它是 **`role="tablist"` 的横向胶片条**，
  切换的是「选中项」（onSelect）**而非移动 DOM 焦点**，且无 ↑↓。属**局部特例**，非通用漫游。
- 全局：无 `role="grid"` / `role="row"` / roving tabindex；主列表（媒体网格、管理表格）**无漫游**。
- ⇒ 真缺口成立，本轮实现。

### codegraph 查证记录（卡要求）

| 查询 | 结果 |
| --- | --- |
| `codegraph query "roving\|tabIndex\|keynav\|focus" -p host/src` | **No results** |
| `codegraph query "Grid\|List\|Card" -p host/src` | **No results** |
| `codegraph node "CinemaFilmstrip"` | 命中 `host/src/pages/browse/components/CinemaFilmstrip.tsx:58`（含签名） |

**结论**：codegraph 对 `host/src` 索引覆盖仍弱（与 FE-OPT-03 同一观察，已连续两轮登记）。
本轮主要靠字面量扫描 + 读文件定位。索引问题不在本卡范围，未修。

## 一、开工前已存在（不重做）

| 项 | 位置 |
| --- | --- |
| `CinemaFilmstrip` 的 ←/→ 切换选中项 | `browse/components/CinemaFilmstrip.tsx:70` |
| 键盘导航（Tab 顺序/焦点可见/Esc/Ctrl+K） | `e2e/a11y.spec.ts`（FE-OPT-03，全绿） |
| 全局 `:focus-visible` 白环 | `host/src/styles/base.css:142` |

## 二、交互模型选定（卡要求写明理由）

**选 roving tabindex，不用 grid role。**

1. 卡片本身是**链接**（`<Link>` → `<a href>`）。roving 保留其原生语义与 Enter 打开能力；
   `role="grid"` 需把 DOM 改成 row/gridcell 包裹，与现有**虚拟化按行渲染**结构冲突，
   且读屏器下 grid 语义会盖掉「链接」可听性。
2. roving 让容器成为 Tab 的**单一停靠点**（容器内仅活动项 `tabindex=0`，其余 `-1`），
   方向键在内部移动 —— 正是本卡目标，且长列表下避免 Tab 次数爆炸。
3. 已用 MutationObserver 在虚拟化行挂载/卸载时保持 roving 状态。

## 三、本次新增

| # | 内容 | 位置 |
| --- | --- | --- |
| N-1 | `useGridRovingFocus`：方向键二维移动 + Home/End + roving tabindex + 虚拟化滚动触发挂载后聚焦 + 分页边界语义 | `host/src/features/a11y/useGridRovingFocus.ts`（新） |
| N-2 | 接 `VirtualizedLibraryDetailGrid`（二维 + 服务端分页，卡片加 `data-grid-item-index` + cell 包裹层） | `browse/library-detail/VirtualizedLibraryDetailGrid.tsx`、`styles/library.module.css` |
| N-3 | 接 `BrowseRail`（一维横滚轨道，覆盖首页继续观看/最近入库/媒体库入口） | `browse/components/BrowseRail.tsx` |
| N-4 | 单测 14 项（含**组合不变量**：任意 itemCount/columns/activeIndex 下结果不越界） | `host/tests/grid-keynav.test.ts`（新） |
| N-5 | e2e 真跑断言 7 项（两 profile） | `host/e2e/grid-keynav.spec.ts`（新） |

### 边界/分页语义（卡要求 4，明确 + 已断言）

- 首/末项方向键**停在边界**（不环绕、不跳到不存在项）；
- 末行不满时 ↓ 落到**末项**（不越界）；
- 走到**已加载末尾**且 `hasMore` → 调用 `onReachTail()` 请求加载更多，但**焦点仍停在边界**
  （不假造「下一项」）。该分支由单测 `shouldRequestMore` 覆盖（可证伪）。

## 四、本轮踩到并修掉的真 bug（3 个，均由断言抓出）

| # | bug | 谁抓到 |
| --- | --- | --- |
| B-1 | `activeIndex` 过期（虚拟化项数减少）时返回**越界索引** | 单测「组合不变量」→ 修为先钳制到合法范围 |
| B-2 | `activeRef` 只在 hook 内部 focus 时更新；用户**点击**卡片后按方向键，索引从 -1 算起 → 永远回首项 | e2e「→ 移动到右邻项」→ 修为从 `activeElement` 所在 slot 推导索引 |
| B-3 | `columns=1`（一维轨道）时 ←/→ 因 `col < cols-1` 恒假而**完全不动** → 漫游失效 | e2e → 修为单列时 ←/→ 逐项移动（同步**修正**单测断言：原「单列 ←→ 停住」是二维思维的错误断言，不是放宽） |

### 附带修掉的 a11y 缺陷（WCAG 2.4.7）

`cards.module.css:329` `.posterLink:focus-visible { outline: none }` **显式移除**了全局焦点环
→ 键盘漫游到卡片时**完全没有可见焦点指示**（实测 `outline-style: none`）。
改为可见白环（与 hover 发光并存，仅键盘聚焦出现，不影响鼠标视觉）。

## 五、真跑证据

- `grid-keynav.spec.ts`：**7 passed**（chromium）+ 7（mobile-chrome）。
- 合并跑 `grid-keynav + a11y + a11y-keyboard`（两 profile）：**90 passed / 0 failed**
  （含焦点环改动后的既有 a11y 回归全绿 —— 无对比度/aria 回归）。
- 单测：host node:test **58 pass / 0 fail**（本卡 14 项）。
- `pnpm verify` **exit 0**。

## 六、诚实边界 / 未做项（ponytail：跳过了什么 · 何时再加）

- **分页边界未做 e2e 真跑**：唯一带服务端分页的二维网格落点（`/libraries/1`）在
  当前 e2e 数据集下**后端恒 500**（`bridge::browse browse_projection.missing_5xx`，
  library 1 投影缺失）；`/history` 为空态。故 e2e 落点改用首页 `BrowseRail`（真渲染）。
  ⇒ 分页边界语义**仅由单测覆盖**（`shouldRequestMore` 可证伪），**未**在真实分页列表上跑过。
  **何时再加**：后端补上 browse projection（或换有效库 id）后，补一条 e2e。
- **管理面表格（一维行列表）未接漫游**：本轮只接了浏览侧（网格 + 轨道）。
  表格行漫游需另定「行内可聚焦单元」语义，避免与行内按钮冲突 → 建议独立卡。
- **触摸/移动端手势漫游未做**：移动 profile 只验证键盘可达性，未验证触摸滑动与
  键盘漫游的一致性（本卡是键盘漫游卡）。
- **Home/End 跨行（到首/末项）未实现**：当前 Home/End 是**行内**语义（与多数网格一致）。
  跨行跳首尾可作为增强，本轮按最小可行未做。
- **读屏器播报未真机验证**：同 FE-OPT-03 边界（无 NVDA/VoiceOver）。
- **未引新依赖**（playwright 内建 + 仓内既有 axe；roving 为自研，无第三方）。

## 七、门禁

`pnpm verify` **exit 0**：typecheck ✓ / build ✓ / themes build ✓ /
test（host 58 + shared 94 + themes 28，0 fail）✓ / size ✓ / dupes ✓ / contracts ✓ /
theme-budget ✓ / component-size ✓ / theme-parity ✓ / repo-size ✓。
本轮**无截图入库**（不占 repo-size 预算）。
