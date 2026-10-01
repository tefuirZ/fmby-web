# FE-USABILITY-FIX-1 · handoff（S18 · 2026-10-01）

用户口径：**前端要修到"可用"**（他只做打磨）。本卡把 demo 前端修到可用：崩点 + 寻址 + 产物重建部署。
仓：`fmby-web`（pnpm monorepo；源码 `host/`、`shared/`）。**dist 不入库**（`git ls-files host/dist` = 0）。
支：`w/zcode/s18-fe-usability-fix`（基点 `1cfab4b`）。

## 1. 四处修复（源码 → 部署产物逐条坐实）
| # | 问题 | 源码改动 | 部署产物证据（`/home/tefuir/rustproject/fmby-web/host/dist`） |
|---|---|---|---|
| 1 | 详情页崩 `Cannot read properties of null (reading 'title')`：父级只守 `!detail`，子组件直读 `detail.item.*` | `host/src/pages/manage/ManageMediaItemDetailPage.tsx:142` → `if (!detail \|\| !detail.item)` | `assets/ManageMediaItemDetailPage-CHeJImNR.js` 逐字：`if(!o||!o.item)return e.jsxs("div",…` |
| 2 | **detail 缓存被污染**：5 个 mutation 的 `onSuccess` 无条件 `setQueryData(detail(id), detail)`（唯一写点 `host/src/pages/manage/media-items/hooks/useMediaItemMutations.ts:27-29`，5 处调用） | 加**信封形状校验**（`item` 非空 + `id` 非空串 + `title` 是 string）；不合格 ⇒ 不写缓存、改 `invalidateQueries(detail(itemId))` | 同 chunk：`l=u=>{const f=!!(u?.item)&&typeof(u?.item?.id)=="string"&&u.item.id!==""&&typeof u.item.title=="string";if(!u\|\|!f){a&&s.invalidateQueries({queryKey:K.manage.mediaItems.detail(a)});return}s.setQueryData(…detail(u.item.id),u)}` |
| 3 | **字幕寻址不一致**：旧实现把非 `/` 开头 id 拼成 V1 `/api/assets/subtitles/{id}`（V2 无该路由 ⇒ **路由级 404**） | 新增 `host/src/pages/browse/subtitleUrl.ts::resolveSubtitleUrl`（V2 成形；非路径且非数字 ⇒ 不发出），替换 `PlayPage.tsx:278-281` | `assets/PlayPage-D4E3-qoa.js`：`Zr(e,t){if(e){if(e.startsWith("/"))return e;if(/^\d+$/.test(e))return '/api/assets/media-items/${t??""}/subtitles/${e}'}}`；**旧串 `/assets/subtitles/` 在 dist 中 0 命中**（部署前 1 命中） |
| 4 | 候选元素空值防护（用户点名） | `IdentityGovernancePanel.tsx`（`setCandidates((res.candidates ?? []).filter(Boolean))`）、`CollectionMemberAdder.tsx`（`(candidates ?? []).filter(Boolean).map`） | 随构建进产物（防御性，minified 后无独立可读证据） |

## 2. 单测（TDD）
`host/tests/subtitle-url.test.ts`（node:test，镜像仓内约定）⇒ **pass 4 / fail 0**：
路径原样用 / 裸 id ⇒ V2 成形且断言**不含** `/assets/subtitles/` / 非路径非数字 ⇒ `undefined` / 无轨 ⇒ `undefined`。
（改前实现为 `'/api/assets/subtitles/'` 前缀拼接 ⇒ 第 2 条必红。）

## 3. 构建与部署（已执行）
- `pnpm --filter @fmby/v2-host typecheck` ⇒ **rc=0**；`… build`（tsc + vite）⇒ **rc=0**（dist 135 文件 / 3.0M）。
- 构建走本机逃生阀 `FMBY_QUEUE_ALLOW_HEAVY_LOCAL=1`（垫片留痕 `~/.fmby-orchestra/log/queue.log`）：farm 只支持 cargo，无 FE 通道。
- 部署：`host/dist` → 备份 **`host/dist.bak-20261001-112148`**；新产物就位。**未动任何进程配置**。
- 已生效证据：demo 首页引用 `assets/index-BIHnGCK2.js` 且 `GET /api/assets/index-BIHnGCK2.js ⇒ 200`；PlayPage 新 chunk 名 `PlayPage-D4E3-qoa.js`。

## 4. 验收原文（demo `192.168.100.58:18099`）
```
# 回归（部署后）
node scripts/demo-smoke.mjs ⇒ rc=0
== demo-smoke（期望表 148 条）⇒ pass=109 skip=115 xfail=1 xpass=0 FAIL=0 ==

# 字幕端到端：自建覆盖 → 读回 → 双寻址对照 → 软删复原
POST /api/manage/media-items/363611985151016960/subtitles
     （multipart + Origin + x-csrf-token + x-requested-with: FMBY-Web）⇒ 200（响应即完整 detail 信封）
读回 detail：subtitle_overrides = [('1','zh',True)]，item.has_local_subtitle_override=true
GET /api/assets/media-items/363611985151016960/subtitles/1 ⇒ 200 text/plain bytes=45   ← 新寻址可用 ✓
GET /api/assets/subtitles/1                               ⇒ 404 {"error":{"code":"not_found"}}（路由级）← 旧寻址不可用 ✓
DELETE …/subtitles/1?confirmed=true ⇒ 200/204 语义 = **软删**：DB `media_item_subtitle_overrides(1, is_active=0)`
  ⇒ 再 DELETE ⇒ 404 {"error_code":"not_found","message":"subtitle override not found"}（已非活动）✓

# 详情面（curl 同路径）
GET /api/manage/media-items/363611985151016960 ⇒ 200（item 28 字段，flat library_name）
```

## 5. 未验 / 观察项 / 残留
- **播放会话的 `subtitle_tracks` 装配未验**：demo 该条目无可播源 ⇒ `POST /api/playback/sessions` ⇒ `502 PLAYBACK_STREAM_UNAVAILABLE`。装配代码侧为正（`bridges/playback/session_service.rs:401-419` 发完整 serve 路径 + 前端"以 `/` 开头原样用"）⇒ 待有可播源实例再验。
- **浏览器手点未做**（预算内为 curl 同路径 + 产物静态证据）；仓内可跑 `pnpm --filter @fmby/v2-host test:e2e`。
- **观察项（供 CRUD 卡）**：字幕覆盖**软删后** `item.has_local_subtitle_override` 仍为 `true`（活动数 0）。若契约意"是否有本地覆盖记录"则正确；若意"是否有**生效**覆盖"则前后端口径需对位 ⇒ 记入 `DEMO-CRUD-CONFORMANCE-1` 形状断言。
- **期望表副作用**：`/api/assets/subtitles`（`backend:null` 的 xfail 行）是**旧产物**的产物；新前端已不发出该 URL ⇒ 建议 S27 侧重建期望表（本卡不动它的表）。
- **残留**：仅 1 行**非活动**字幕覆盖（软删语义，等同上卡 `hidden=0` 行先例）；无活动残留。

## 6. 回滚
```bash
cd /home/tefuir/rustproject/fmby-web/host
mv dist dist.fixed-$(date +%s) && mv dist.bak-20261001-112148 dist
```
