// scripts/check-issue-close-evidence.mjs —— ★关账证据机械闸（ISSUE-CLOSE-EVIDENCE）
//
// 防什么（实测 2026-10-21，一次 5 个 P0 perf Issue 的关账建议 4 个是错的）：
//   有人（w06 席）对 #1091/#1078/#1056/#1042/#1126 贴「目标产物 <BUFFER-N>.md 已在 origin/main ⇒ 可关」，
//   但 perf 卡的 BUFFER 编号与 Issue 的「续N」编号**并非同一序列** ⇒ 大量**编号撞名**：
//     docs/evidence/perf/BUFFER-16.md  实际主题 = 「缓存面端点原始数字」
//     Issue #1091 要求                 = 「farm.sh --probe ×10 判最差 + 注册表演进」
//   同名文件里 `--probe` / `farm.sh` / `cloud1` **各出现 0 次** —— 它根本没回答那个 Issue。
//   ⇒ **「文件在 main」≠「Issue 被回答」**。5 个里只有 #1042 是真回答（内容命中 4/4）。
//
// 为什么必须机械：这类判断靠人逐条读会**反反复复**（主代理当天手工过了 5 个才发现 4 个错），
//   而且每个新席都会重复犯。判据可完全静态化 ⇒ 上闸。
//
// 判定（纯静态，不需编译、不联网除 gh 取 issue/comment）：
//   1. 取该 Issue 的全部评论，挑出「关账建议」类评论
//      （正则：CLOSE-WITH-EVIDENCE / 关账 / 已在 origin/main / 已在main / 可关 / Superseded）；
//   2. 从这些评论里抽引用路径（docs|scripts|crates|perf|migrations 下的 *.md/*.mjs/*.rs/*.sql/*.json/*.sh）；
//   3. 从 Issue **标题 + 正文**抽关键术语（编号 / 「」引文 / CJK 词组 / 标识符 / 文件路径）；
//   4. 每条引用路径必须：① 在 origin/main 存在 ② 内容命中 ≥ max(2, ceil(术语数×0.2)) 个不同术语；
//   5. **引用文件若在头部自声明未完成（PARTIAL/部分完成/未完成）⇒ 不成立**
//      （实测 2026-10-21：INSTALL-TO-1M.md 首行「本轮 PARTIAL 取证」却 3/3 命中过闸）；
//      出口 = 关账评论写 `CLOSE-ON-PARTIAL: <缺口 + 裁决依据>`；
//   6. 关账评论若**一条路径都抽不出** ⇒ 视为 fail-closed 失败，
//      除非评论显式带 `NO-FILE-EVIDENCE:` 说明（用于「重复/被取代/裁定不做」这类无文件证据的关账）。
//
// 退出码：0=PASS（所有关账建议都有主题匹配的证据），1=FAIL，2=判据不可用（gh 失败等）。
// --json 输出机器可读。

import { execFileSync } from "node:child_process";

const JSON_OUT = process.argv.includes("--json");

/** 关账建议类评论的识别正则（宽松：宁可多抓，由下游路径/术语判定）。 */
// ★正面判据：必须**显式主张关闭**才算关账建议。
//   只「提到关账」不算 —— 实测 2026-10-21 假绿：w06 的**认账/作废**评论里「关账」出现 5 次，
//   被旧判据当成新的关账建议去评它引用的文件，于是 4 个本该红的 Issue 全部报 PASSED。
const CLOSE_HINT =
  /(CLOSE-WITH-EVIDENCE|可关(?:闭)?\b|建议关闭|建议关账|请关闭|应予关闭|可以关闭|Superseded[_ ]by|Superseded by|已在\s*origin\/main[^\n]{0,40}(?:⇒|->|，|,)\s*可关)/;

/** 显式声明「本关账无文件证据」的出口（重复/被取代/裁定不做）。 */
const NO_FILE_EVIDENCE = /NO-FILE-EVIDENCE:/;

/**
 * 反对/推翻关账的评论 —— 必须从「关账建议」里剔除。
 * 不剔除会误判：主代理自已在 #1091 等四个 Issue 上贴的**更正评论**同样含「关账/不应关闭」字样，
 * 拿它当「建议关闭」去评 ⇒ 闸会把正确的更正行为报成红，于是没人再愿跑它。
 */
const CLOSE_REJECT =
  /(不应关闭|不该关闭|不予关闭|不成立|判据不成立|判据不对|判据错误|保持\s*open|保持\s*OPEN|KEEP-OPEN|勿关|推翻|错误归因|不关账|作废|认账|更正|本 Issue\s*\*{0,2}保持|零命中)/i;

/**
 * 从评论列表里挑出**真正的**关账建议（剔除推翻/更正类）。
 * @param {{body:string}[]} comments
 * @returns {{body:string}[]} 按时间升序
 */
export function pickCloseComments(comments) {
  return (comments ?? [])
    .filter((c) => CLOSE_HINT.test(c.body || "") && !CLOSE_REJECT.test(c.body || ""))
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

/** 从评论文本抽引用路径。 */
export function extractCitedPaths(text) {
  const out = new Set();
  const re =
    /(?:^|[\s`（("'\[=])((?:docs|scripts|crates|perf|migrations|\.github)\/[\w\-./%]+\.(?:md|mjs|rs|sql|json|sh|yml|yaml|ts|tsx))/g;
  for (const m of text.matchAll(re)) out.add(m[1].replace(/[),.;:]+$/, ""));
  return [...out];
}

/**
 * 从 Issue 标题/正文抽**判别性**术语。
 *
 * ★自测首版假阴性教训：不能把「编号 token」（BUFFER-16 / 续16 / 裸数字 16）计入命中集 ——
 *   撞名文件的头一行就写着「BUFFER-16 · …（续16 …）」，而且几乎所有 perf 文档都引用自己的
 *   卡面套话（判最差/交叉复算/落本档）。编号与套话**不具判别力**，会让假证据蒙混过关。
 *   ⇒ 只收：命令（--x）、含 . / _ 的标识符、≥4 字 CJK 词组、「」引文、数字对（61→51）。
 */
export function extractTerms(title, body = "") {
  const text = `${title}\n${body}`;
  const terms = new Set();

  // ① 「」/“” 引文（≥4 字才算判别性）
  for (const m of text.matchAll(/[「“]([^」”]{4,40})[」”]/g)) terms.add(m[1].trim());

  // ② 数字对：61→51 / 74->71（强判别）
  for (const m of text.matchAll(/\d{2,4}\s*(?:→|->)\s*\d{2,4}/g)) terms.add(m[0].replace(/\s+/g, ""));

  // ③ 命令行/路径/标识符（必须含 . / _ 或 -- 才算判别性；裸数字与裸单词不算）
  for (const m of text.matchAll(/(--[a-z][\w-]{2,}|[a-z][a-z0-9_]{2,}(?:[./][a-z0-9_\-]+)+|[a-z]{3,}_[a-z0-9_]{3,})/g)) {
    const t = m[1];
    if (t.length >= 5) terms.add(t);
  }

  // ④ CJK 词组：≥4 字才算判别性（「判最差」「演进」这类 2-3 字在套话里太常见）
  const STOP = new Set(["验证", "证据", "文档", "目标", "产物", "要求", "判定", "结论", "问题", "影响", "建议"]);
  for (const m of text.matchAll(/[\u4e00-\u9fa5]{4,10}/g)) {
    const t = m[0];
    if (!STOP.has(t)) terms.add(t);
  }
  return [...terms];
}

/**
 * **自声明未完成**的取证卡 —— 不得作为关账证据。
 *
 * 实测（2026-10-21，w01/w03 各自撞到）：`docs/evidence/e2e/INSTALL-TO-1M.md` 的**第一行**就写着
 * 「本轮 **PARTIAL** 取证」，正文还有 `SKIPPED(no-binary)` / 「未取得完成数字」，
 * 但旧闸只比「标题术语命中数」—— 一份**自己说没做完**的卡照样 3/3 命中 ⇒ PASS = 假绿。
 *
 * 只认**头部自声明**（前 6 行）：正文中段的「早期一版曾标 PARTIAL，后补齐」这类**历史提及**
 * 不该误判（自测里钉了这条）。
 *
 * 出口：确需「带缺口关账」时，在关账评论里写 `CLOSE-ON-PARTIAL: <缺口 + 裁决依据>`。
 */
const PARTIAL_DECL = /\bPARTIAL\b|部分完成|未完成|未取得完成数字/;
const PARTIAL_WAIVER = /CLOSE-ON-PARTIAL:/;

/**
 * 取证卡是否在**头部区**自声明未完成。
 *
 * 头部区 = 文件开头到**第一个二级标题（`## `）之前**（且最多 8 行）：
 * 自声明通常写在标题行（`# … 本轮 PARTIAL 取证`）或紧随的 `>` 引用块里；
 * 而「早期一版曾标 PARTIAL，后补齐」这类**历史提及**都在正文小节内（`## 过程` 之后）
 * ⇒ 不触发（自测 `PARTIAL 只出现在正文中段（非头部）⇒ 不误判` 钉住这条）。
 */
export function selfDeclaresPartial(content) {
  const head = [];
  for (const line of String(content ?? "").split("\n")) {
    if (/^##\s/.test(line)) break; // 进入正文小节 ⇒ 头部区结束
    head.push(line);
    if (head.length >= 8) break;
  }
  return PARTIAL_DECL.test(head.join("\n"));
}

/**
 * 纯逻辑：判定一组「Issue 要求 + 引用证据文件」是否匹配。
 * 入参 body 只为兼容保留，**判据不依赖它**（见函数内注释）。
 * @param {{title:string, body?:string, issueNumber?:number, paths:string[], loadFile:(p:string)=>string|null}} input
 * @returns {{pass:boolean, failures:string[], terms:string[], checked:number}}
 */
export function assessEvidence({ title, body = "", issueNumber, paths, loadFile, closeBody = "" }) {
  // ★只用**标题**建术语集，正文不参与（实测决定闸能不能用）：
  //   正文带卡面模板套话，而几乎每个 BUFFER 文档都引用自己卡面的同样短语。
  //   拿正文建术语集 ⇒ #1091/#1056/#1078 三个**真撞名**的会被「收原始数字」「交叉复算」
  //   两个套话洗成命中 ⇒ 假绿。只拿标题 ⇒ 四个假全红、#1042 真回答全绿（标题命中 3/3）。
  const terms = extractTerms(title, "");
  // 阈值：术语 ≥2 个 ⇒ 要求命中 ≥2；只有 1 个 ⇒ 要求命中该个；
  //   **0 个 ⇒ 阈值必须是 1（不能是 0）**：否则 `0 < 0` 恒假 ⇒ 空题面永远放行 = 假绿。
  //   此时靠「引用本 Issue 号」兜底，仍无则红（fail-closed）。
  const threshold = terms.length === 0 ? 1 : Math.min(2, terms.length);
  const failures = [];
  let checked = 0;
  for (const p of paths) {
    const content = loadFile(p);
    if (content === null) {
      failures.push(`引用路径在 origin/main 不存在：${p}`);
      continue;
    }
    checked++;
    // ★自声明 PARTIAL ⇒ 直接不成立（即使术语命中达标）。旧闸在此处只看命中数 ⇒ 假绿。
    if (selfDeclaresPartial(content) && !PARTIAL_WAIVER.test(closeBody)) {
      failures.push(
        `证据文件自声明未完成（PARTIAL）：${p} —— 头部含 PARTIAL/部分完成/未完成 ⇒ 不得作为关账证据；` +
          `如确要带缺口关账，请在关账评论写 \`CLOSE-ON-PARTIAL: <缺口 + 裁决依据>\``,
      );
      continue;
    }
    const hits = terms.filter((t) => content.includes(t));
    // 兜底：判别性术语不足时，文件里引用了**本 Issue 号本身**（`#1042`）也算回答
    const selfRef = issueNumber != null && new RegExp(`#${issueNumber}\\b`).test(content);
    if (hits.length < threshold && !selfRef) {
      failures.push(
        `主题不符（疑似编号撞名）：${p} —— 标题术语命中 ${hits.length}/${terms.length} 个 ` +
          `(阈值 ${threshold}) ` +
          `${terms.length ? `标题术语=[${terms.join(", ")}]` : "（标题无可判术语，只能靠引用 Issue 号）"}` +
          `${hits.length ? `，已命中=[${hits.join(", ")}]` : ""}，且未引用本 Issue 号`,
      );
    }
  }
  return { pass: failures.length === 0, failures, terms, checked };
}

// ───────────────────────── CLI ─────────────────────────

function ghJson(args, { allowFail = false } = {}) {
  try {
    const out = execFileSync("gh", args, { encoding: "utf8", timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    if (allowFail) return null;
    throw new Error(`gh 调用失败（判据不可用，fail-closed）: gh ${args.join(" ")} :: ${String(e.message).split("\n")[0]}`);
  }
}

function gitShow(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function checkIssue(n, repo, ref) {
  const issue = ghJson(["api", `repos/${repo}/issues/${n}`]);
  if (issue.pull_request) return { n, skip: "是 PR 不是 Issue" };
  const comments =
    ghJson(["api", `repos/${repo}/issues/${n}/comments?per_page=100`], { allowFail: true }) ?? [];

  const closes = pickCloseComments(comments);
  if (closes.length === 0) return { n, skip: "无有效关账建议（已剔除推翻/更正类评论）" };

  // ★审「所有」有效关账建议，不是只审最新一条。
  //   实测 2026-10-21 第二种假绿：只审最新 ⇒ 作者贴一条「认账/作废」评论后，
  //   原先那条**错误**的关账建议被整体跳过，Issue 反而报 PASSED。
  //   正确语义：一条错误的关账建议贴出去了就是错的，不会因为后来认账而消失。
  const failures = [];
  let checkedPaths = 0;
  const allPaths = [];
  for (const c of closes) {
    const body = c.body || "";
    const paths = extractCitedPaths(body);
    if (paths.length === 0) {
      if (NO_FILE_EVIDENCE.test(body)) continue;
      failures.push(
        `关账建议未引用任何证据文件（fail-closed）：${(body.split("\n")[0] || "").slice(0, 60)}… ` +
          "—— 如确无文件证据（重复/被取代/裁定不做），请在评论里显式写 `NO-FILE-EVIDENCE: <原因>`",
      );
      continue;
    }
    allPaths.push(...paths);
    const r = assessEvidence({
      title: issue.title,
      body: issue.body || "",
      issueNumber: n,
      paths,
      loadFile: (p) => gitShow(ref, p),
      closeBody: body,
    });
    checkedPaths += r.checked;
    failures.push(...r.failures);
  }
  if (failures.length === 0 && checkedPaths === 0) {
    return { n, skip: "所有关账建议均显式声明 NO-FILE-EVIDENCE（放行）" };
  }
  return { n, title: issue.title, pass: failures.length === 0, failures, paths: allPaths };
}

function main() {
  const repo = process.env.FMBY_REPO_SLUG ?? "tefuirZ/fmby-v2";
  const ref = process.env.FMBY_EVIDENCE_REF ?? "origin/main";
  const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const all = process.argv.includes("--all");

  let targets = argv.map((a) => Number(a)).filter((x) => Number.isFinite(x));
  if (all) {
    const issues = ghJson([
      "issue", "list", "--state", "open", "--limit", "60", "--json", "number",
    ]);
    targets = issues.map((i) => i.number);
  }
  if (targets.length === 0) {
    // ★无参数 ⇒ SKIP（rc=0）而不是报错。
    //   `scripts/run-node-gates.sh` 会枚举全部 check-*.mjs 并**无参**跑；
    //   本闸需要显式 Issue 号 + 联网取 gh，不适合当全量 PR 门禁 ⇒ 只能报 SKIP（不假绿，也不假红）。
    console.log(
      "ISSUE-CLOSE-EVIDENCE SKIP —— 本闸需显式给 Issue 号（不是全量 PR 门禁）。\n" +
        "用法：node scripts/check-issue-close-evidence.mjs <issue...>  或  --all 扫 open Issue。\n" +
        "【执行点】关掉任何 Issue 前必须先跑本闸并见 PASSED。",
    );
    process.exit(0);
  }

  const results = [];
  for (const n of targets) {
    try {
      results.push(checkIssue(n, repo, ref));
    } catch (e) {
      results.push({ n, pass: false, failures: [String(e.message)] });
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ ref, results }, null, 2));
  } else {
    for (const r of results) {
      if (r.skip) {
        console.log(`  ○ #${r.n} 跳过：${r.skip}`);
      } else if (r.pass) {
        console.log(`  ✓ #${r.n} 关账证据成立（引用 ${r.paths.length} 个文件，术语命中达标）`);
      } else {
        console.log(`  ✗ #${r.n} 关账证据不成立：${r.title ?? ""}`);
        for (const f of r.failures) console.log(`      - ${f}`);
      }
    }
    const failed = results.filter((r) => !r.skip && !r.pass);
    console.log(`\nISSUE-CLOSE-EVIDENCE ${failed.length === 0 ? "PASSED" : "FAILED"}  (${results.length} 个 Issue，${failed.length} 个关账建议不成立)`);
  }
  process.exit(results.some((r) => !r.skip && !r.pass) ? 1 : 0);
}

// 仅在被直接执行时跑 CLI（被 import 时只导出纯函数）。
// ★不能用 `argv[1].endsWith(<本文件名>)` 判断：脚本被复制/改名后该条件为假 ⇒
//   main() 根本不跑 ⇒ **静默 rc=0 无任何输出 = 假绿**（实测 2026-10-21：复制到 /tmp 改名跑，rc=0）。
//   正确判据 = 「本模块就是被 node 直接执行的那个入口」⇒ 比较 `import.meta.url` 与 `argv[1]` 的解析路径。
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
const isEntrypoint =
  process.argv[1] != null &&
  pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url;
if (isEntrypoint) main();
