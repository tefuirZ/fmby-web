#!/usr/bin/env node
/**
 * check-license-ui-coverage.mjs —— 前端「授权入口 ↔ 能力键」覆盖检查（零依赖，照 scripts/farm.sh 思路）。
 *
 * 为什么需要：后端 37 个授权键里已挂门仅 7（2026-10-19 实测），但前端**没有任何映射表**，
 * 无法回答「未授权时该不该显示这个入口」。本脚本把三件事固化：
 *   1) 扫 `host/src` + `shared/src`，列出所有**引用 surface 名**（PAID_MANAGE_SURFACES）的位置；
 *   2) 对照 `docs/前端授权入口映射.md` 的映射表，列出**表中声明但代码里没人引用**的 surface
 *      （= 映射表过期 / 死条目）；
 *   3) 列出**代码里引用了但映射表没登记**的 surface（= 覆盖缺口）。
 *
 * 用法：
 *   node scripts/check-license-ui-coverage.mjs            # 门禁（rc≠0 表示有缺口）
 *   node scripts/check-license-ui-coverage.mjs --list     # 只打印代码侧引用点
 *
 * 退出码：0 = 映射表与代码一致；1 = 有缺口；2 = 环境不满足（缺文件）。
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_DIRS = ["host/src", "shared/src"];
const MAP_DOC = "docs/前端授权入口映射.md";

// surface 名单与 shared/src/contracts/manage/license/summary.ts 的 PAID_MANAGE_SURFACES 同源
// （该文件是唯一事实源；此处硬拷贝以便零依赖跑，若源变更请同步本数组）。
const SURFACES = [
  "pan115",
  "pan115-share",
  "pan115-imghost",
  "microsoft",
  "microsoft-account-pool",
  "upstream-emby",
  "upstream-apple-cms",
  "upstreams",
  "registration-codes",
  "registration-window",
  "user-expiration",
  "identity-telegram",
  "identity-google",
  "poster-imghost",
  "internal-imghost",
];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(p);
  }
  return out;
}

const LIST_ONLY = process.argv.includes("--list");
const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d)));

/** @type {Record<string, {file:string;line:number}[]>} */
const found = {};
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    for (const s of SURFACES) {
      // 只认字符串字面量引用（避免把 providerType === 'pan115' 这类业务判断误算成门禁）
      const escaped = s.replace(/-/g, "\\-");
      const re = new RegExp("[\"\x27\`]" + escaped + "[\"\x27\`]");
      if (re.test(line)) {
        (found[s] ??= []).push({
          file: relative(ROOT, file),
          line: idx + 1,
          text: line.trim().slice(0, 100),
        });
      }
    }
  });
}

console.log(`[scan] 源码文件 ${files.length} 个；引用 surface 的 surface 数 ${Object.keys(found).length}/${SURFACES.length}`);
for (const s of SURFACES) {
  const hits = found[s] ?? [];
  console.log(`  ${s.padEnd(26)} ${String(hits.length).padStart(3)} 处`);
  if (LIST_ONLY) {
    for (const h of hits.slice(0, 8)) console.log(`      ${h.file}:${h.line}  ${h.text}`);
  }
}
if (LIST_ONLY) process.exit(0);

// ── 与映射表交叉校验 ────────────────────────────────────────────────
const docPath = join(ROOT, MAP_DOC);
if (!existsSync(docPath)) {
  console.error(`[FAIL] 缺映射表 ${MAP_DOC}（先补文档再跑本门）`);
  process.exit(2);
}
const doc = readFileSync(docPath, "utf8");
const declared = SURFACES.filter((s) => doc.includes(`\`${s}\``));
const undeclared = SURFACES.filter((s) => !declared.includes(s));

const codeOnly = Object.keys(found).filter((s) => !declared.includes(s));
const docOnly = declared.filter((s) => !(s in found));

console.log("──────────────────────────────");
console.log(`[doc ] 映射表声明 surface ${declared.length}/${SURFACES.length}`);
if (docOnly.length) {
  console.log("[FAIL] 映射表声明但代码零引用（死条目 / 表过期）：");
  for (const s of docOnly) console.log(`       ${s}`);
}
if (codeOnly.length) {
  console.log("[FAIL] 代码引用但映射表未登记（覆盖缺口）：");
  for (const s of codeOnly) console.log(`       ${s}`);
}
if (undeclared.length) {
  console.log("[warn] 未在映射表出现的 surface（可能本就不该有 UI 入口）：");
  for (const s of undeclared) console.log(`       ${s}`);
}
if (docOnly.length === 0 && codeOnly.length === 0) {
  console.log("[GREEN] 映射表与代码引用一致。");
  process.exit(0);
}
process.exit(1);
