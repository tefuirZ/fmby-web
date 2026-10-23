#!/usr/bin/env node
// check-agent-identity.mjs —— 席位身份落痕闸（fmby-web 移植版,源自 fmby-v2 同名脚本）
//
// 用户原话：「所有写手或者参与评审的 Agent 必须正确落地他们的身份。在 GitHub 上，
//   不管是 PR 还是 IS 的评论下，都应该有对应的身份。这样才知道谁是谁，才有迹可循；
//   后续真正需要评审的时候，才知道是谁干的。」
//
// 为什么要靠内容签名：全仓共用一个 gh token（tefuirZ），GitHub 原生 author 字段
// 永远相同 ⇒ 无法区分席位。唯一可靠办法 = 在正文/评论里写机器可解析的标记。
//
// 标准签名（**PR 正文 / PR 评论 / Issue 评论，三处都要带**）：
//   ---
//   <!-- agent: <seat> | family: <family> | model: <model> -->
//   `<seat>` · <family> · <model>
//
// 用法：
//   node scripts/check-agent-identity.mjs              # 只报新增缺口
//   node scripts/check-agent-identity.mjs --json       # 机器可读
//   node scripts/check-agent-identity.mjs --limit 50   # 限制扫描条数
//
// 退出码（**fail-closed**）：
//   0 = 无新增未签名产物（历史遗留记 LEGACY，不置红）
//   1 = 有新增未签名产物 **或闸自身无法判定**（gh 非 0 / 空返回 / JSON 坏 / fixture 坏）
//       —— 后者的意义：**拿不到数据 ≠ 通过**（#1804 必修②：旧实现 gh 失败时假绿 rc=0）
//
// 判据分级（**每条 PR/Issue 的「正文 + 全部评论 + 全部 review body」任一命中即 SIGNED**）：
//   SIGNED    命中 `<!-- agent: …` 或可见签名行，且（能推导时）**家族与模型一致**
//   MISMATCH  签名里的 `<family>` 与 `<model>` 推导出的家族不符 —— 置红
//             （2026-10-21 实测：w01/w08 签 `family: deepseek` 但 model 是 `*/glm-5.3-flash`）
//   LEGACY    无签名但号 < LEGACY_MAX（2026-10-21 之前存量）
//   MISSING   号 >= LEGACY_MAX 且三处都无签名 ⇒ 置红
//
// 家族↔模型一致性：本闸**无法**知道席位真正跑的是哪个模型（那是编排层的事），但能抓住
// 「签名**自相矛盾**」——`<model>` 里出现的厂商词必须与 `<family>` 相同，否则异族判据机械失效。
//
// 测试缝（供 `.selftest.mjs` 用，生产不设）：
//   FMBY_IDENTITY_FIXTURE=<json>   {prs:[…], issues:[…]} 直接喂数据，不碰网络
//   FMBY_IDENTITY_GH_BIN=<path>    替换 gh 可执行文件（模拟失败）
//   FMBY_WEB_GH_REPO=<owner/repo>      目标仓库（默认 tefuirZ/fmby-web）
//   FMBY_IDENTITY_LEGACY_MAX=<n>   历史遗留分界（默认 1791）

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LEGACY_MAX = Number(process.env.FMBY_WEB_IDENTITY_LEGACY_MAX || 92); // fmby-web:92 号起强制
const GH_BIN = process.env.FMBY_IDENTITY_GH_BIN || 'gh';
const REPO_SLUG = process.env.FMBY_WEB_GH_REPO || 'tefuirZ/fmby-web';
const FIXTURE = process.env.FMBY_IDENTITY_FIXTURE || '';
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 120;

const SIG = /<!--\s*agent:\s*([A-Za-z0-9_-]+)/;
/// 完整标记：seat | family | model（三段全有时才能做一致性校验）。
const SIG_FULL =
  /<!--\s*agent:\s*([A-Za-z0-9_-]+)\s*\|\s*family:\s*([A-Za-z0-9_-]+)\s*\|\s*model:\s*([^>]+?)\s*-->/;
const SIG_VISIBLE =
  /`([a-z][a-z0-9_-]{1,15})`\s*·\s*(qwen|deepseek|glm|mimo|step|hunyuan|claude|grok|gpt)\b[^\n]*?·\s*([A-Za-z0-9_./-]+)?/i;

/// 模型名 → 家族（顺序敏感：先具体后泛化）。推导不出 ⇒ null（不判定，不误红）。
const FAMILY_BY_MODEL = [
  [/deepseek/i, 'deepseek'],
  // magpie 池的 hy4 系（magpie/hy4、magpie/hy4-preview、wb2api-b/hy4-preview）
  // 归 hunyuan——判例：w04 的 `wb2api-b/hy4-preview` 签名 family=hunyuan 已过身份门。
  [/hy4/i, 'hunyuan'],
  [/glm/i, 'glm'],
  [/qwen/i, 'qwen'],
  [/mimo/i, 'mimo'],
  [/hunyuan/i, 'hunyuan'],
  [/claude|anthropic/i, 'claude'],
  [/grok/i, 'grok'],
  [/\bstep[0-9]?/i, 'step'],
  [/gpt|openai|\bo[13]\b/i, 'gpt'],
];

function familyOfModel(model) {
  const m = String(model ?? '');
  if (!m) return null;
  for (const [rx, fam] of FAMILY_BY_MODEL) if (rx.test(m)) return fam;
  return null;
}

/// 从一段文本里取签名三段（marker 优先，回落到可见行）。
function parseSig(text) {
  const s = String(text ?? '');
  const f = s.match(SIG_FULL);
  if (f) return { seat: f[1], family: f[2].toLowerCase(), model: f[3].trim(), src: 'marker' };
  const v = s.match(SIG_VISIBLE);
  if (v) return { seat: v[1], family: v[2].toLowerCase(), model: (v[3] || '').trim(), src: 'visible' };
  const only = s.match(SIG);
  if (only) return { seat: only[1], family: '', model: '', src: 'marker-seat-only' };
  return null;
}

/// 闸自身失败（**绝不能**退化成「无缺口」）。
class GateError extends Error {}

function ghJson(ghArgs, what) {
  let raw;
  try {
    raw = execFileSync(GH_BIN, ghArgs, {
      encoding: 'utf8',
      timeout: 120000,
      // 110 个 PR × (正文 + 全部评论 + review body) 轻松过 1MB；Node 默认
      // maxBuffer=1MB ⇒ 会抛 ENOBUFS（且 stderr 为空，极易被误读成"gh 没输出"）。
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const stderr = String(e.stderr ?? '').trim();
    throw new GateError(
      `${what} 调用失败：${GH_BIN} ${ghArgs.join(' ')}\n` +
        `  rc=${e.status ?? '?'}\n  stderr=${stderr || '(空)'}`,
    );
  }
  if (!String(raw).trim()) {
    throw new GateError(
      `${what} 返回空 body（gh 静默失败/被限流）⇒ 判不了，不当作通过`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new GateError(
      `${what} JSON 解析失败：${e.message}\n  原文前 200 字：${String(raw).slice(0, 200)}`,
    );
  }
}

function loadData() {
  if (FIXTURE) {
    let raw;
    try {
      raw = readFileSync(FIXTURE, 'utf8');
    } catch (e) {
      throw new GateError(`fixture 读取失败 ${FIXTURE}: ${e.message}`);
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new GateError(`fixture JSON 坏：${e.message}`);
    }
    if (!data || !Array.isArray(data.prs) || !Array.isArray(data.issues)) {
      throw new GateError('fixture 必须含 prs[] 与 issues[]');
    }
    return data;
  }
  // 一次调用取全量（含评论/review body）——PR 讨论串评论在 `comments`，
  // review（含 review body）在 `reviews`；两者都算「评论下带身份」。
  const prs = ghJson(
    [
      'pr', 'list', '-R', REPO_SLUG, '--state', 'open', '--limit', String(limit),
      '--json', 'number,title,body,headRefName,comments,reviews',
    ],
    'PR 列表',
  );
  const issues = ghJson(
    [
      'issue', 'list', '-R', REPO_SLUG, '--state', 'open', '--limit', String(limit),
      '--json', 'number,title,body,comments',
    ],
    'Issue 列表',
  );
  return { prs, issues };
}

const bodies = (x, extraKey) => [
  x.body,
  ...(x.comments ?? []).map((c) => c.body),
  ...(extraKey ? (x[extraKey] ?? []).map((c) => c.body) : []),
];

function classify(num, texts) {
  let first = null;
  for (const t of texts) {
    const sig = parseSig(t);
    if (!sig) continue;
    if (!first) first = sig;
    // 只对「新增」产物判一致性（历史遗留签名写法不一，不追溯）。
    if (num < LEGACY_MAX) return { state: 'SIGNED', seat: sig.seat, via: sig.src };
    const derived = familyOfModel(sig.model);
    if (sig.family && derived && derived !== sig.family) {
      return {
        state: 'MISMATCH',
        seat: sig.seat,
        via: sig.src,
        declaredFamily: sig.family,
        derivedFamily: derived,
        model: sig.model,
      };
    }
    return {
      state: 'SIGNED',
      seat: sig.seat,
      via: sig.src,
      ...(derived ? {} : { familyUnverified: sig.model || '(空)' }),
    };
  }
  if (num < LEGACY_MAX) return { state: 'LEGACY', seat: null };
  return { state: 'MISSING', seat: null };
}

function main() {
  const out = { generated: new Date().toISOString(), prs: [], issues: [], summary: {} };
  const data = loadData();

  for (const p of data.prs) {
    out.prs.push({
      number: p.number,
      branch: p.headRefName ?? '',
      title: String(p.title ?? '').slice(0, 60),
      ...classify(p.number, bodies(p, 'reviews')),
    });
  }
  for (const i of data.issues) {
    out.issues.push({
      number: i.number,
      title: String(i.title ?? '').slice(0, 60),
      ...classify(i.number, bodies(i)),
    });
  }

  const tally = (arr) => {
    const s = { SIGNED: 0, LEGACY: 0, MISSING: 0, MISMATCH: 0 };
    for (const x of arr) s[x.state]++;
    return s;
  };
  out.summary = {
    pr: tally(out.prs),
    issue: tally(out.issues),
    legacyMax: LEGACY_MAX,
    scanned: { pr: out.prs.length, issue: out.issues.length },
  };

  const missing = [
    ...out.prs.filter((x) => x.state === 'MISSING').map((x) => ({ ...x, kind: 'PR' })),
    ...out.issues.filter((x) => x.state === 'MISSING').map((x) => ({ ...x, kind: 'Issue' })),
  ];
  const mismatched = [
    ...out.prs.filter((x) => x.state === 'MISMATCH').map((x) => ({ ...x, kind: 'PR' })),
    ...out.issues.filter((x) => x.state === 'MISMATCH').map((x) => ({ ...x, kind: 'Issue' })),
  ];
  const unverified = [...out.prs, ...out.issues].filter((x) => x.familyUnverified);

  if (asJson) {
    console.log(JSON.stringify({ ...out, missing, mismatched }, null, 2));
    return missing.length + mismatched.length > 0 ? 1 : 0;
  }

  console.log('═══ 席位身份落痕闸 ═══');
  console.log(`  LEGACY_MAX = ${LEGACY_MAX}（号 < 此值视为历史遗留，不置红）`);
  console.log(`  扫描面：PR 正文 + PR 评论 + review body + Issue 正文 + Issue 评论（任一命中即 SIGNED）`);
  console.log('');
  console.log(
    `  PR    : SIGNED=${out.summary.pr.SIGNED}  LEGACY=${out.summary.pr.LEGACY}  MISSING=${out.summary.pr.MISSING}  MISMATCH=${out.summary.pr.MISMATCH}  （共 ${out.prs.length}）`,
  );
  console.log(
    `  Issue : SIGNED=${out.summary.issue.SIGNED}  LEGACY=${out.summary.issue.LEGACY}  MISSING=${out.summary.issue.MISSING}  MISMATCH=${out.summary.issue.MISMATCH}  （共 ${out.issues.length}）`,
  );
  if (missing.length) {
    console.log('');
    console.log(`  ✗ 新增未签名产物（${missing.length} 个，必须补）：`);
    for (const x of missing) {
      console.log(`    [${x.kind}] #${x.number}  ${x.branch ?? x.title}`);
    }
  }
  if (mismatched.length) {
    console.log('');
    console.log(`  ✗ 签名家族↔模型不一致（${mismatched.length} 个，异族判据已失效，必须改）：`);
    for (const x of mismatched) {
      console.log(
        `    [${x.kind}] #${x.number}  seat=${x.seat}  family=${x.declaredFamily}  但 model=${x.model}（推导=${x.derivedFamily}）`,
      );
    }
  }
  if (unverified.length) {
    console.log('');
    console.log(`  ⚠ 模型名推导不出家族（${unverified.length} 个，**不据此置红**，仅提示补规范模型名）：`);
    for (const x of unverified.slice(0, 8)) {
      console.log(`    #${x.number}  seat=${x.seat}  model=${x.familyUnverified}`);
    }
  }
  if (!missing.length && !mismatched.length) {
    console.log('');
    console.log('  ✅ 无新增未签名产物、无家族↔模型不一致（历史遗留已记 LEGACY）');
  }
  console.log('');
  console.log('  标准签名（追加到正文/评论末尾）：');
  console.log('    ---');
  console.log('    <!-- agent: <seat> | family: <family> | model: <model> -->');
  console.log('    `<seat>` · <family> · <model>');
  console.log(`    判据：全仓共用 gh token ⇒ GitHub author 恒同一账号，账号层分不出异族，只能靠内容签名。`);
  return missing.length + mismatched.length > 0 ? 1 : 0;
}

try {
  process.exit(main());
} catch (e) {
  if (e instanceof GateError) {
    console.error('❌ 闸无法判定（fail-closed，**不**当作通过）：');
    console.error(`   ${e.message}`);
    process.exit(1);
  }
  throw e;
}
