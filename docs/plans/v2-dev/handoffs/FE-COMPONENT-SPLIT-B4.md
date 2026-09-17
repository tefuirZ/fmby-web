# FE-COMPONENT-SPLIT-B4 交接（w1 · 前端仓 w/zcode/writer1-fe-split-b4）

> B4：继续拆基线 5 个 + 顺手清 2 个小的；**并把三条铁律固化进拆法模板**。

- 基线：`origin/main` @ `e4b7a01`
- 提交：单一 green commit
- 门禁：`pnpm verify` **12 闸全绿**（34 PASS）
- **基线 9 → 2**（本卡清 7 条）

---

## 1. 拆法模板固化（本卡附加项）

`docs/plans/v2-dev/handoffs/FE-COMPONENT-SPLIT.md` §4 升为 **§4.0 三条铁律**（违一条必返工）：

> **① 子组件类型必须从既有模块 `import` 真实类型，禁止自造窄类型。**
> props 上每个类型（回调签名/枚举/返回结构）都要指向已存在类型；
> 先 `grep` 找权威类型（`PendingCodeAction`、`DangerousActionRequest`、
> `Dispatch<SetStateAction<T>>`、`ReturnType<typeof fn>`）直接复用；
> 报错即证据，改回真实类型。
>
> **② JSX 块按【行号切片】抽取，禁止靠字符串匹配定位边界。**
> 多分支页面 `index('</Dialog>')`/「找下一个 `}}`」会切错或提前收尾；
> 先 `grep -n` 定位行号 → `lines[i:j]` 切片 → 切完立刻 `wc -l` + typecheck。
>
> **③ 抽状态 hook 时，页面 early-return 不能进 hook。**
> `if (q.isPending) return <FeedbackState/>` 属组件渲染逻辑，留页面；
> 只抽 useState/派生/处理器；hook 内不得有 JSX 返回。

## 2. `.tsx` 无 JSX 扫描（卡面要求）

扫了剩余 9 条（含 `scrape-sections`）：**全部含 JSX**（用门禁同一 `hasJsx()` 判据），
**无一可按工具模块豁免**。`scrape-sections.tsx`(533) 确认含 JSX → 须按组件拆分，
**不适用豁免**（它是 `.tsx` 但内容是组件 + 展示片段，不是纯函数集合）。

---

## 3. 拆分结果（7 个，纯结构搬迁、行为零变更）

| 文件 | 拆前 → 拆后 | 抽出 |
|---|---:|---|
| `ManageOverviewPage.tsx` | 496 → **371** | `overview/OverviewKpiCapsules.tsx`（KPI 胶囊横幅）· `overview/OverviewSetupGuide.tsx`（首配引导视图） |
| `ManageMediaItemsPage.tsx` | 484 → **351** | `media-items/components/MediaItemsListSection.tsx`（列表/空态/分页 + 批量条 + 两个危险确认框） |
| `media-item-detail/.../MediaItemSubtitleSection.tsx` | 463 → **236** | `SubtitleOverrideRow.tsx`（单条字幕行 + 草稿工具） |
| `ManageNamingRulesPage.tsx` | 448 → **361** | `NamingRulesCleanupPanel.tsx`（清洗规则折叠面板）· `NamingRulesHeader.tsx`（头部 + 横幅） |
| `media-item-detail/.../MediaItemMetadataSection.tsx` | 448 → **348** | `MetadataSourcePanel.tsx`（来源对照卡 + 原始文本） |
| `ManageRewardsPage.tsx` | 417 → **359** | `rewards/RewardsLedgerSection.tsx`（积分流水 + 时间/增量格式化） |
| `ManageLicensePage.tsx` | 403 → **388** | `license/LicenseUnwiredPanel.tsx`（授权未装配引导态） |

后两条（Rewards/License）**不在卡面 5 条内**，因只超线 17/3 行、成本极低顺手清掉。

---

## 4. 本卡踩坑（新，供后人）

1. **CSS module 相对路径 `tsc` 不校验，`vite build` 才报**——本卡
   `NamingRulesCleanupPanel.tsx` 写成 `../ManageNamingRulesPage.module.css`
   （目录层级少一级），`pnpm typecheck` 全绿但 `pnpm build` 报
   `Could not resolve`。**教训：拆到子目录后，CSS/静态资源相对路径必须跟着改层级；
   拆完要跑 `pnpm build`，不能只看 typecheck。**（门禁里 build 在 typecheck 之后，
   所以 typecheck 过 ≠ 提交安全。）
2. **切片时不要把相邻 JSDoc 一起带走**——本卡 `MetadataSourcePanel` 生成时
   把原组件尾部的 JSDoc 带进新文件，造成 `*/` 未闭合的语法错（TS1010）。
   按铁律 ② 切片后**扫一眼边界两侧的注释**。
3. **切 `{cond ? ( … ) : ( … )}` 时注意闭合 `)}`**——`MediaItemMetadataSection`
   的原始文本块尾部 `)}` 在切片边界外，丢一次才补齐。
4. **`ReturnType<typeof useXxx>` 是铁律 ① 的实用解法**——需要「页面状态 hook 的
   字段类型」时，直接 `type PageState = ReturnType<typeof useNamingRulesPageState>`
   再 `PageState['draft']`，比自造 interface 稳（本卡 NamingRules 两处用它一次性过）。

---

## 5. 剩余 2 条基线（均已登记理由，非遗漏）

| 行 | 文件 | 处置 |
|---:|---|---|
| 587 | `login/LoginPage` | **按裁决后置**：会话/CSRF/多因素风险面大、非管理高频路径，收益/风险比低。建议单独一卡（拆时重点保行为） |
| 533 | `manage/naming-rules/scrape-sections` | 含 JSX（已实测）→ 须按组件拆；建议 B5 |

**建议 B5**：`scrape-sections`(533) + `LoginPage`(587，谨慎/单独)，
拆完基线可清零（`EXEMPT_FILES` 里的 router 是唯一显式豁免，属设计豁免非债务）。

---

## 6. 待办 / 需裁决

1. **`MOUNT-CRED-SEAL` 已并入主仓 main（`fc3f653`）**，但据主代理：后端 create 对
   `__sealed:` 的放行违反契约 §3.3③（跨挂载凭据引用），**w2 正在修（create 拒绝 `__sealed:`）**。
   **等其修完合并后**再做 WEB-S4C 裁决 2/3 的收尾（AK/SK 编辑态「已设置凭据，留空不修改」占位）
   —— 届时 PATCH 语义才完全确定。**本卡未动 mounts。**
2. **`scrape-sections` 拆分可能牵出「巨型条件渲染」**：拆前需先看是否适合按
   「策略区 / 预览区 / 补刮区」切；若内部高度耦合，建议先补一条 e2e 再拆（保行为）。
3. 无新增豁免、无规则改动需求；棘轮仍双向生效，基线只降不升。
