# THEME-BUILD-01 主题独立产物构建链（w2 交付 · 前端仓 + 主仓后端半）

> 性质：主代理亲验真缺口收口——主题 LibrarySkin/ItemSkin 被内联进 host 主
> bundle（`grep LibrarySkin host/dist/assets/index-*.js` 命中），themes/darkroom/dist
> 不存在，主题无法外挂、首屏混主题代码、size 闸隔离断言假绿。

## 八行报告

- **任务结论**：① 每主题 vite library 构建（external react/react-dom/@fmby/v2-shared）→ `themes/<id>/dist/{index.js,tokens.css,theme.manifest.json,skins/*.css}` 真实产出（darkroom 8.63KB ESM / template 0.31KB）；② host registry 改运行时外挂——`loadEntry` 用 `import(/* @vite-ignore */ \`/themes/<id>/index.js\`)` 动态加载，host package.json 主题包降为 devDependencies，host bundle 零主题字节（grep 断言 4 特征串全 0 命中）；③ size 闸加 [3b] 逐 chunk 内容反查（LibrarySkin/ItemSkin/DomainSkinOutlet/data-darkroom 特征 → FAIL）与 [3c] 主题 dist 产物存在性检查，故意内联实证 FAIL；④ 真实 server 外挂链路 curl 全过（/api/site/themes 列出 + /themes/darkroom/* 9 资源全 200 + 穿越全 404）。
- **修改范围**（前端仓 w/theme-build）：themes/{darkroom,_template}/vite.config.ts 新增、package.json build 脚本、host/src/theme/registry.ts 重写、host/package.json、scripts/check-frontend-size.mjs（3b/3c）、scripts/check-frontend-dupes.mjs（vite.config.ts 排除）、pnpm-lock、docs/e2e-theme-build-raw.txt。
- **后端半**（主仓 62fede2）：extract_theme_archive dist/ 归入 + zip-slip 绝对路径稀释洞修复 + D3（LocalManifest.skins Vec→BTreeMap，/api/site/themes 恒空真缺陷）。
- **测试**：themes/darkroom node:test 14/14、shared 49 pass、typecheck 全过；pnpm verify（typecheck+build+size+dupes+contracts）全绿。
- **门禁**：size 闸 300KB 红线 179.04KB PASS；[3b]/[3c] 新闸 PASS；反例注入实证 [3b] 抓内联。
- **Review**：真链路 evidence `docs/e2e-theme-build-raw.txt`（[A]~[F] 六段原文）。
- **风险登记**：D3 远程清单 skins 数组落盘转 map（值=domain 自身）为保守形态；discover_local dist/ 内 manifest 优先、顶层兼容读取保留（迁移期双布局）。
- **对主代理依赖**：无。

## 4+1 自审

- **OO**：主题产物单源（vite library dist/），host 只持注册表元数据（id + 运行时 URL 拼接），无第二份主题代码。
- **RB**：size 闸 [3b] 内容级反查 fail-closed（特征串命中即 exit 1）；[3c] dist 缺失即 FAIL（历史假绿根源）；后端 zip-slip 绝对路径在归入**前**显式拒绝（format!("dist/{rel}") 会把 "/etc/passwd" 稀释成 "dist//etc/passwd" 绕过 starts_with('/')——已堵）。
- **FM**：registry 复用 ThemeRegistration 契约（manifestUrl/assets/loadEntry 形状不变，ThemeProvider 零改动）；后端 ThemeEntry.skins 保持 Vec<String>（API 面契约不变，map 键 = domain 输出）。
- **MD**：dupes 闸 walkFiles 排除 vite.config.ts（构建配置非主题运行时代码，纯度闸只约束 src/）。
- **Security**：穿越防护实证（../db、dist/../../etc/passwd、%2e%2e 全 404）；主题入口 external react（无第二份 react 执行体）。

## 真链路验证结论（evidence/docs/e2e-theme-build-raw.txt）

| 断言 | 结果 |
| --- | --- |
| host bundle LibrarySkin/ItemSkin/data-darkroom/DomainSkinOutlet 命中 | 全 0（修复前 LibrarySkin 内联命中） |
| /api/site/themes 列出 darkroom(skins=[browse.item,browse.library]) + template | ✅（D3 修复前恒空） |
| /themes/darkroom/{theme.manifest.json,tokens.css,aurora.css,skins/*.css,index.js} | 全 200 |
| /themes/template/{theme.manifest.json,tokens.css,index.js} | 全 200 |
| /themes/darkroom/index.js 为 ESM + `import ... from "react"` external | ✅ |
| /themes/darkroom/../fmby-v2.db、dist/../../etc/passwd、%2e%2e | 全 404 |

## 卡面任务逐项对照

| # | 卡面要求 | 状态 |
| --- | --- | --- |
| 1 | 主题 vite library 构建（external react/shared）→ dist 真实产出；build:themes 可用 | ✅ `pnpm build:themes` 两主题均产出 |
| 2 | host 运行时 /themes/<id>/index.js 动态加载，bundle 不含主题代码 | ✅ registry.ts 重写 + 4 特征串 0 命中 |
| 3 | size 闸真检查（内联 → FAIL） | ✅ [3b] 内容反查 + [3c] 产物存在性；反例注入实证 FAIL |
| 4 | 真实 server 外挂链路 curl 全过 | ✅ [C]/[D]/[F] 段 |
| 5 | evidence docs/plans/v2-dev/evidence/theme-build-e2e.md | 📌 本文 + docs/e2e-theme-build-raw.txt（原始终证）；主仓侧若需归档 evidence/ 目录由主代理合并时搬运 |
