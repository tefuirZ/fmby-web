# USEPOSTERURL-CYCLE · 「降级器成环」证伪报告 + 调用方清点 + 真发现

> 席位 `/data/fmby-seats/rv3-frontend` ｜ 分支 `seat/rv3/fe-red`
> 本卡 commit：**`8b89fac`**（导出纯函数 + 穷举终止性锁 + 注释修正）
> 签名：`rv3-frontend` · glm · magpie/auto/glm-5.3-flash

---

## 结论（先说最重要的）

**「usePosterUrl 在 thumb↔backdrop 间成环」是我上一卡（FE-posterUrl）的误诊，现正式撤回。**
两个降级状态机的 next 函数**严格沿有序链下行、default→done**，对**任意 URL 组合 × 任意 error 序列**都在有限步（poster 机 ≤3、backdrop 机 ≤4）内到达 done —— 已用**穷举测试**（16 组合 × 两机，共享套件内可复跑）钉死。因此：
- 卡面要求的「RED：传四档应红/超时」**不会红** —— 前提被证伪，本卡**没有修任何环**（不存在的东西不修，ponytail）。
- 真正值得留下的：**穷举终止性锁**（防将来有人真把状态机改出环）+ 两个真发现（§4）。

---

## 1. 逐条证据：为什么「成环」不存在（card 第 1 条）

| 档 | next（file:line = `shared/src/hooks/usePosterUrl.ts`，export 后行号 ±0） | 终止性 |
|---|---|---|
| poster 机 `primary` | `thumbUrl ? 'thumb' : backdropUrl ? 'backdrop' : 'done'`（getNextPosterStage） | 下行 ✓ |
| poster 机 `thumb` | `backdropUrl ? 'backdrop' : 'done'` | 下行 ✓ |
| poster 机 `backdrop` | `default → 'done'` | **终** ✓ |
| backdrop 机 `banner` | `backdrop → thumb → poster → done` | 下行 ✓ |
| backdrop 机 `backdrop` | `thumb → poster → done` | 下行 ✓ |
| backdrop 机 `thumb` | `poster → done` | 下行 ✓ |
| backdrop 机 `poster` | `default → 'done'` | **终** ✓ |

两机的档位序都是**全序**（poster 机：poster>thumb>backdrop>done；backdrop 机：banner>backdrop>thumb>poster>done），next 只**严格下行**或入 done ⇒ 对任意输入、任意 error 序列，至多走完链长即终止。**触发「成环」的参数组合：不存在。**

**穷举测试（GREEN，本卡新增）**：`shared/tests/artwork-stage-termination.test.ts`
- 2^4 = 16 种存在性组合 × poster/backdrop 两机：每组合模拟「当前档 URL 失败 → next」直至 done，断言 ≤ 链长步、无重访。**3/3 PASS（当次输出：tests 3 / pass 3 / fail 0）**。
- 附「四 URL 全给的组合（mapArtwork{itemId} 形态）3 步内到 done」的链序锁（primary→thumb→backdrop→done）。

**RED 为何不存在（如实）**：卡面预期「现状应红/超时」—— 实测 GREEN。我在 FE-posterUrl 卡的「成环（DOM 实测）」结论是**误诊**：当时的 DOM 观察是 ①合成 error 首派发不生效（React `createRoot().render()` 异步提交，派发早于监听器挂载——本卡用「等 img attached 再派发」复现并排除了该因素）②blank 页上相对 URL 的 img 请求**挂起**（不产生 error 事件，`[REQFAIL]`/`[REQOK]` 捕获 0 条——诊断当次输出在案）。两者叠加让我把「测试基建假象」误读成「hook 成环」。

---

## 2. 调用方清点与「是否已踩」判定（card 第 2 条）

**usePosterUrl / useBackdropUrl 消费方（codegraph explore：18 家；逐个输入形态抽查）**：

| 调用方 | 输入 | 会否「成环」 |
|---|---|---|
| `browse/api.ts:232`、`person/api.ts:77`、`search/api.ts:30`、`item/api.ts:109`、`playback/api.ts:194` | `mapArtwork(…, { itemId })` ⇒ **四 URL 全兜底形态**（正是卡面点名的组合） | **否** —— 穷举已证该形态 3 步内 done（§1 链序锁）。副作用仅「请求放大」：无图条目每海报位最多 3 个必 404 请求（进浏览器缓存，browse 海报墙正常形态） |
| PosterMediaCard / HeroSpotlight / LandscapeMediaCard / CinemaFilmstrip / ItemDetailHero / PlayPanels×3 / FilmThumb / HeroSlideThumb 等（全部 browse） | `item.artwork` / 构造器产物（上行的 mapArtwork 集） | **否**（同上，终止性与输入无关） |
| `manage/.../MediaItemOverviewSection.tsx:45`（FE-posterUrl 本卡新增） | **二档字面量**（poster/thumb 投机链） | **否**；且把无图情形请求数 3→1 |

**判定：无任何调用方「已踩」现网环** —— 因为环不存在。卡面「任何传四 URL 的调用方 = 页面挂死/请求风暴」不成立（挂死的真机制见 §4，与 URL 数量无关）。

---

## 3. 既有二档行为不变（card 第 4 条的回归锁）

- 我**没有改**任何状态机逻辑（唯一 diff = 4 个纯函数加 `export`）⇒ 二档调用方行为逐字不变。
- 既有锁：`host/tests/artwork-fallback-stage.test.ts`（真渲染 + hook 调用断言）✓ 仍在跑。
- 新锁：`shared/tests/artwork-stage-termination.test.ts` 3/3（穷举）+ FE-posterUrl DOM 测试 2/2（渲染 URL + 降级到占位）。

---

## 4. 真发现（报你裁，未擅动）

1. **降级器对「请求挂起」无防御**：blank 页实测复现 —— img 请求既不成功也不失败（挂起）时，`onError` 不触发 ⇒ 海报位**永不降级**（本卡 DOM 测试的 ② 曾经 10s+ 停在该态）。生产对应「资产服务挂起/慢响应」⇒ 海报位停在最前档。
   - 修法建议（报裁）：hook 加**每档看门狗**（如 `isLoading` 超 8s 强制 onNext）—— 改 18 家消费方的降级时序，属产品可见行为，**不擅动**。
2. **`mapArtwork{itemId}` 的请求放大**：无图条目每海报位 3 个必 404 投机请求（browse 海报墙现状）。FE-posterUrl 已用二档规避（manage 概览）；browse 侧是否同样收窄 = 产品/性能裁定，**未动**。
3. FE-posterUrl 卡里错误的原因注记已在本卡修正（`8b89fac`：成环 → 请求放大 + 穷举锁指引）。

---

## 5. ponytail 段
- **加了什么**：4 个 `export` + 1 个穷举测试文件（57 行）+ 1 条注释改口。**没改**任何状态机逻辑。
- **跳过**：watchdog（§4.1，需你裁）；mapArtwork 请求放大的 browse 侧收窄（§4.2，同）。
- **跳过**：DOM ② 的「恰一档」断言（blank 页时序下不稳定，③ 的终止断言已覆盖该语义）。
