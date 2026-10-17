# 前端留白 + 文案收口（执行台账，2026-10-18 · rebase 到 main `591eb0a` 后重扫）

> 依据：docs/evidence/FE-UI-DENSITY-AUDIT.md（44 页面 + 4 布局壳；P0×2 / P1×11 / P2×10）
> 与 FE-UI-ACCEPT-NODE62.md。本文件 = **逐条复核台账**（已修 / 未修 / 证据），不粉饰。
>
> ★本版与初版（`slim-unicorn` 基线 `ddc1a4c`）的差别：main 的 `591eb0a`
> 「UI 密度 P1 批量收口」把本台账里几条「未修」自己修掉了，初版台账因此过期。
> 本版按 **rebase 后的真实代码** 重扫、重算数字、重标状态。

## 一、已修（按当前 main 实况）

| 条目 | 状态 | 证据 |
|---|---|---|
| P0-1 空任务队列谎报 + 死链 | ✅ 已修（两段） | 首屏拔除 = main `591eb0a`（P1-9 ①）；组件本体去假字段 + 空态/死链 = 本分支 `51c5e71` |
| P0-2 生产粗口文案 | ✅ 已修 | 本分支 `51c5e71` |
| P1-4 历史页同值计数两次 | ✅ 已修（main） | main `591eb0a`；本分支 `8f86553` 只加防回归钉 |
| P1-5 库详情「已加载 x/y」三处 | ✅ 已修（main） | main `591eb0a`；同上 |
| P2-4 登录页 mfa 死代码 | ✅ 已修 | 本分支 `8f86553` |
| P1-8 用户表 10 列 | ✅ 已修（main） | main `591eb0a`「用户表 10→6 列」 |
| P1-9 中控首屏块数 | 🟡 部分修（main） | main `591eb0a`「中控 13→10 块」；审计目标 8 块，差 2 块 |
| 38 处 ManagePageHeader eyebrow | ✅ 已清 | main `591eb0a` |

## 二、本轮独立复扫（真实行号 + 可复跑命令，口径写死在命令里）

口径：
- **非 token 字号** = `.css` 里 `font-size: Npx` 而 N ∉ `--text-*` 的 px 值集合
  `{40,30,23,18,17,15,13,12}`（真源 `host/src/styles/defaults.css`）。
- **阶梯外间距** = `gap/row-gap/column-gap/margin*/padding*` 里出现的 `Npx` 而
  N ∉ `--space-*` 的 px 值集合 `{4,8,12,16,20,24,32,40,48,64}`。

复跑（在仓根执行，只读）：

```bash
python3 - <<'PY'
import os,re,collections
SCALE={4,8,12,16,20,24,32,40,48,64}; FONT={40,30,23,18,17,15,13,12}
space=collections.Counter(); where=collections.defaultdict(list)
pat=re.compile(r'(?<![\w-])(?:gap|row-gap|column-gap|margin|margin-top|margin-right|margin-bottom|margin-left|padding|padding-top|padding-right|padding-bottom|padding-left)\s*:\s*([^;]+);')
val=re.compile(r'(?<![\w.-])([0-9.]+)px')
font=collections.Counter(); fwhere=collections.defaultdict(list)
fpat=re.compile(r'font-size:\s*([0-9.]+)px')
for dp,dn,fn in os.walk('host/src'):
    for f in fn:
        if not f.endswith('.css'): continue
        p=os.path.join(dp,f)
        for i,l in enumerate(open(p,encoding='utf8'),1):
            m=pat.search(l)
            if m:
                for v in val.findall(m.group(1)):
                    if float(v) not in SCALE: space[v]+=1; where[v].append(f"{p}:{i}")
            m=fpat.search(l)
            if m and float(m.group(1)) not in FONT: font[m.group(1)]+=1; fwhere[m.group(1)].append(f"{p}:{i}")
print('阶梯外间距', sum(space.values()), '处 /', len(space), '档')
for v,c in space.most_common(): print(f'  {v}px × {c}  首例 {where[v][0]}')
print('非 token 字号', sum(font.values()), '处 /', len(font), '档')
for v,c in font.most_common(): print(f'  {v}px × {c}  首例 {fwhere[v][0]}')
PY
```

### P2-1 间距脱梯：**128 处 / 24 档**（未修）

| 值 | 处数 | 首例 |
|---|---|---|
| 2px | 31 | manage/longtail-shared/ManageShared.module.css:484 |
| 6px | 26 | manage/ManageNamingRulesPage.module.css:143 |
| 10px | 16 | manage/ManageNamingRulesPage.module.css:366 |
| 5px / 14px / 3px | 7 / 6 / 6 | overview/ManageOverviewCockpit.module.css:635 / :566 / :1078 |
| 1px / 7px / 28px / 9px | 5 / 5 / 4 / 4 | Cockpit:624 / :946；browse/PlayPage.module.css:93；browse/styles/cards.module.css:101 |
| 18px / 36px / 11px | 3 / 2 / 2 | PlayPage.module.css:93 / login/LoginPage.module.css:217 / PlayPage:957 |
| 42/44/13/30/26/15px 等 | 各 1-2 | 见复跑输出 |

集中面：`ManageNamingRulesPage` / `ManageShared` / `ManageOverviewCockpit` 三个 manage 面
占比 90+ 处；`browse/PlayPage` 的 28/18/76/104px 多为**版式固定量**（播放器/海报尺寸），
不是间距阶梯欠账 ⇒ 修的时候要按「是不是间距语义」分桶，不能机械替换。

### P2-2 非 token 字号：**85 处 / 16 档**（未修）

| 值 | 处数 | 首例 |
|---|---|---|
| 11px | 29 | overview/ManageOverviewCockpit.module.css:357 |
| 11.5px / 12.5px / 10.5px | 9 / 9 / 9 | Cockpit:89 / :487 / :623 |
| 13.5px / 10px | 6 / 6 | Cockpit:613 / :634 |
| 20px / 14px / 16px / 22px | 4 / 3 / 2 / 2 | ManageMediaItemsPage:100 / Cockpit:454 / styles/base.css:19 / ManageNamingRulesPage:316 |
| 24/28/32/14.5/9.5/9px | 各 1 | ManageNamingRulesPage:88 / Cockpit:75 / cards.module.css:378 / Cockpit:308 / cards:387 / hero:305 |

与初版台账（37 处 / 9 档）差异原因：初版只扫了**小于 16px 且非整数或与相邻档疑似**的子集，
本版按上面写死的集合口径全量扫 ⇒ 数字更大、口径可复跑。**不是新引入的债**（同文件同一批值）。

### 文案粗口复核（审计未列，本轮补扫）

全仓 `host/src/**/*.{ts,tsx}` 扫「屁用/他妈的/妈的/傻逼/垃圾/狗屎/靠」：**唯一命中 = a11y
注释里的「停靠点」**（useTableRowRoving.ts:26/28/96/143/229、useGridRovingFocus.ts:9）
⇒ **误报，无真实粗口**。生产文案粗口已由本分支 `51c5e71` 清零。

## 三、未修项（如实，本轮未动）

| 条目 | 状态 | 原因 |
|---|---|---|
| P2-1 间距 128 处脱梯 | ❌ 未修 | 需逐文件对照 token 阶梯改值 + **真栈截图比对**，且要先分「间距语义 vs 版式固定量」两桶（盲改 CSS 视觉回归风险高，卡面要求真栈验证） |
| P2-2 字号 85 处 16 档 | ❌ 未修 | 同上（相邻档合并需视觉确认，如 11.5→11 还是 12） |
| P1-1 条目详情双 gutter / P1-2 双类别控件 / P1-3 total×3 / P1-6 播放三入口 / P1-7 资源详情 8 节无导航 / P1-10 sticky 魔数 / P1-11 侧栏三层树 | ❌ 未修 | 结构性改动，每条需独立卡 + 真栈验收 |
| P1-9 中控 10 块 → 审计目标 8 块（差 2 块） | 🟡 未收口 | main 已做 13→10，剩余两块要动布局分组，属结构改动 |
| P2-3/5/6/7/8/9/10 | ❌ 未修 | 同上 |

## 四、为什么本轮不出「已修」数字

卡面要求「每条给改前/改后证据（截图或 DOM 断言原文）」。本机纪律（.58 禁重活、node62 限流
load<25）下，**Playwright 真栈跑不了**；无真栈证据的 CSS 改动属于「未验证修改」，比不改更危险
（视觉回归无人发现）。故本轮只交付**精确实测清单**（上表 + 可复跑命令），不做盲改。

★这条同样适用于 P0/P1 的「已修」标签：本台账只标**代码级已改 + 有源码/DOM 断言证据**的条目；
「看起来变好看了」不在证据范围内。

## 五、复跑命令（下一轮真栈可用）

```bash
# ① 清单复扫（只读，秒级）：见 §二 的 python 块，在仓根直接跑
# ② 真栈截图（需 node62 空窗或本机允许 Playwright）：
cd host && node node_modules/@playwright/test/cli.js test e2e/manage-pages.spec.ts --project=chromium
# ③ 前端单测（轻活，本机可跑）：
cd host && node --import ./tests/register-aliases.mjs --test tests/*.test.ts
```

## ponytail

- 不做：盲改字号/间距（无真栈比对不下手）；P1 结构性 7 条 + P1-9 剩余 2 块（各自独立卡）。
- 不做：把 browse/PlayPage 的 76/104px 这类版式固定量塞进 `--space-*`（那不是间距债，
  塞进去反而语义错）。
- 何时再加：node62 load<25 或本机解禁 Playwright 后，按 §二 清单**分桶**逐文件改 +
  逐页截图比对，完成后再声称「留白收口」。
