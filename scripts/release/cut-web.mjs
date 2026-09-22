#!/usr/bin/env node
// cut-web.mjs —— 前端仓（fmby-web）发布链：一次合并 = 一个版本
//
// 动因（用户 2026-09-22 原话）：「子模块独立小版本也要根据是否修了子模块一直往下迭代，
//   版本号不能停，否则后续不知道你们改了哪些」。实测前端仓当时 **0 tag / 无 CHANGELOG /
//   package.json 停在 0.1.0**，即使后端有完整发布链，前端改动在 GitHub 上完全不可追溯。
//
// 结构（与后端 scripts/release/cut.mjs 对齐）：
//   ## [x.y.z] - YYYY-MM-DD
//   ### 本版做了什么（按 host/shared/themes/docs 分组列提交）
//   ### 相对上版（diffstat）
//   ### 验证（pnpm verify 结果：从 FMBY_WEB_VERIFY_LOG 或最新 /tmp/fe-verify*.log 读尾行；缺则显式「未采集」）
//   ### 下版计划（承接 docs/releases/NEXT-WEB.md）
//
// 用法（在 fmby-web-main 的 main 上）：
//   node scripts/release/cut-web.mjs --dry-run
//   node scripts/release/cut-web.mjs --bump auto --push --gh-release
// 幂等：tag 已存在即拒绝（绝不覆盖已发布版本）。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DRY = has("--dry-run");
const DO_PUSH = has("--push");
const DO_GH = has("--gh-release");
const BUMP = val("--bump", "auto");
const PER_GROUP_CAP = Number(process.env.FMBY_WEB_REL_CAP || 12);

const sh = (cmd, a, opts = {}) =>
  execFileSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
const die = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const today = () => new Date().toLocaleDateString("sv-SE");

// ── 0) 前置检查
const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
if (branch !== "main") die(`必须在 main 上操作（当前 ${branch}）`);
const pkgPath = join(root, "package.json");
if (!existsSync(pkgPath)) die("缺 package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const curVer = pkg.version || "0.1.0";

let lastTag = "";
try { lastTag = sh("git", ["describe", "--tags", "--abbrev=0", "HEAD"]).trim(); } catch { lastTag = ""; }

const commits = sh("git", ["log", "--no-merges", "--pretty=format:%h%x09%s", lastTag ? `${lastTag}..HEAD` : "HEAD"])
  .trim().split("\n").filter(Boolean).map((l) => { const [sha, ...r] = l.split("\t"); return { sha, subject: r.join("\t") }; });

// ── 1) 升位
const feats = commits.filter((c) => /^feat(\(|:)/.test(c.subject)).length;
let bump = BUMP;
if (bump === "auto") bump = feats > 0 ? "minor" : "patch";
const [maj, min, pat] = curVer.split(".").map(Number);
const next = bump === "major" ? `${maj + 1}.0.0` : bump === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
if (sh("git", ["tag", "--list", `v${next}`]).trim()) die(`tag v${next} 已存在，拒绝覆盖`);

// ── 2) 分组
const files = lastTag ? sh("git", ["diff", "--name-only", `${lastTag}..HEAD`]).trim().split("\n").filter(Boolean) : [];
const diffstat = lastTag
  ? sh("git", ["diff", "--shortstat", `${lastTag}..HEAD`]).trim()
  : `${commits.length} 个提交（首个版本，无上版对照）`;
const groupOf = (f) => {
  if (f.startsWith("host/")) return "host（应用壳/页面）";
  if (f.startsWith("shared/")) return "shared（契约/域映射/组件）";
  if (f.startsWith("themes/")) return "themes（主题）";
  if (f.startsWith("docs/")) return "docs（文档/证据）";
  if (f.startsWith("scripts/")) return "scripts（门禁/工具）";
  return "其它";
};
const byGroup = new Map();
for (const c of commits) {
  let cf = [];
  try { cf = sh("git", ["show", "--name-only", "--pretty=format:", c.sha]).trim().split("\n").filter(Boolean); } catch {}
  const gs = [...new Set(cf.map(groupOf))];
  for (const g of gs.length ? gs : ["(未归类)"]) {
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(c);
  }
}

// ── 3) 验证节（诚实：读真日志，缺则明写未采集）
let verifyLines = [];
const cand = process.env.FMBY_WEB_VERIFY_LOG || "";
const logs = [];
if (cand && existsSync(cand)) logs.push(cand);
try {
  for (const f of readdirSync("/tmp")) {
    if (/^fe-verify.*\.log$/.test(f)) logs.push(join("/tmp", f));
  }
} catch {}
logs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (logs.length) {
  const log = logs[0];
  const txt = readFileSync(log, "utf8");
  const passCount = (txt.match(/\[PASS\]/g) || []).length;
  const failCount = (txt.match(/\[FAIL\]/g) || []).length;
  const fails = txt.split("\n").filter((l) => /\[FAIL\]|✖|ELIFECYCLE/.test(l)).slice(0, 5);
  verifyLines.push(`- pnpm verify 日志：\`${log}\`（mtime ${new Date(statSync(log).mtimeMs).toISOString()}）`);
  verifyLines.push(`- [PASS] ${passCount} 项 / [FAIL] ${failCount} 项${failCount ? "" : "（本版交付前最近一次全量 verify）"}`);
  if (fails.length) verifyLines.push(...fails.map((l) => `- ⚠ ${l.trim().slice(0, 160)}`));
  if (failCount > 0) verifyLines.push("- ⚠ 该日志含 FAIL —— 不得据此声称验证通过；发布前必须重跑 `pnpm verify` 至 EXIT=0");
} else {
  verifyLines.push("- ⚠ **未采集**：未找到 `pnpm verify` 日志（`FMBY_WEB_VERIFY_LOG` 或 /tmp/fe-verify*.log）——不得据此声称已验证");
}

// ── 4) 下版计划（doc 单一来源）
const nextPlanPath = join(root, "docs/releases/NEXT-WEB.md");
const nextPlan = existsSync(nextPlanPath) ? readFileSync(nextPlanPath, "utf8").trim() : "";

// ── 5) 组装 CHANGELOG 节
let entry = `## [${next}] - ${today()}\n\n`;
entry += `**本版提交**：${commits.length} 个 ｜ **改动**：${diffstat}\n\n`;
entry += `### 本版做了什么\n\n`;
if (!commits.length) entry += "- （无提交：仅版本升位）\n";
for (const [g, cs] of [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length)) {
  entry += `#### ${g}（${cs.length}）\n\n`;
  for (const c of cs.slice(0, PER_GROUP_CAP)) entry += `- ${c.subject}（\`${c.sha}\`）\n`;
  if (cs.length > PER_GROUP_CAP) entry += `- …另有 ${cs.length - PER_GROUP_CAP} 条（完整：\`git log --oneline ${lastTag || ""}..v${next}\`）\n`;
  entry += "\n";
}
entry += `### 相对上版\n\n- 上版 tag：${lastTag || "（无，首个版本）"}\n- ${diffstat}\n\n`;
entry += `### 验证\n\n${verifyLines.join("\n")}\n\n`;
entry += `### 下版计划\n\n${nextPlan || "- （缺 docs/releases/NEXT-WEB.md：下版计划待填）"}\n\n`;

if (DRY) {
  console.log(`上版 tag: ${lastTag || "(无)"} ｜ 当前版本: ${curVer} ｜ 本版: v${next}（bump=${bump}）`);
  console.log(`提交 ${commits.length} 个 ｜ 文件 ${files.length} 个`);
  console.log("--- 将生成的更新日志 ---");
  console.log(entry);
  console.log("--- 将执行（dry-run 未落盘）---");
  console.log(`  package.json: ${curVer} -> ${next}`);
  console.log(`  CHANGELOG.md: 头部插入 ${entry.split("\n").length} 行`);
  process.exit(0);
}

// ── 6) 落盘 + 提交 + tag
const clPath = join(root, "CHANGELOG.md");
const prevCL = existsSync(clPath) ? readFileSync(clPath, "utf8") : "";
writeFileSync(clPath, entry + "\n" + prevCL.replace(/^# .*\n+/, ""));
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
sh("git", ["add", "CHANGELOG.md", "package.json"]);
const msg = `chore(release): v${next} —— CHANGELOG 本版条目（${commits.length} 提交）`;
sh("git", ["-c", "user.name=fmby-orchestra", "-c", "user.email=orch@local", "commit", "-q", "-m", msg]);
sh("git", ["tag", "-a", `v${next}`, "-m", `fmby-web v${next}`]);
console.log(`✓ 已提交并打 tag：v${next}`);

if (DO_PUSH) {
  sh("git", ["push", "origin", "main"]);
  sh("git", ["push", "origin", `v${next}`]);
  console.log(`✓ 已推送 main + v${next}`);
}
if (DO_GH) {
  const notes = entry.split("### 相对上版")[0].trim();
  sh("gh", ["release", "create", `v${next}`, "--title", `fmby-web v${next}`, "--notes", notes]);
  console.log(`✓ 已建 GitHub Release v${next}`);
}
