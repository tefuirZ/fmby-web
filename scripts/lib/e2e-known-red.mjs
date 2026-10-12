/**
 * scripts/lib/e2e-known-red.mjs — E2E 已知存量失败台账的**判定逻辑**（唯一真源）。
 *
 * 为什么独立成模块：`check-e2e.mjs` 是顶层 `process.exit()` 的 CLI 脚本，
 * 无法被 `node --test` import。把判定逻辑抽出来才有回归测试能覆盖四条路径：
 *   1. 命中台账 ⇒ SKIP，不置红；
 *   2. 未登记失败 ⇒ 置红；
 *   3. 格式非法登记 ⇒ 置红（防止台账被写成无法匹配的形状后静默失守）；
 *   4. 台账条目本次未被命中（已修绿却没删）⇒ STALE 反噬置红。
 *
 * 台账**必须真的参与判定**。若只打印路径后放行，台账就退化成 allowlist，
 * 与「诚实化」裁定相悖（静默放行 = 把 known-red 变成 skip）。
 *
 * 台账格式（见 scripts/e2e-known-red.txt）：
 *   <spec文件>:<用例名片段> | <issue号> | <登记原因>
 *
 * 匹配语义：
 *   · spec 文件按 **basename 双向**匹配：台账里可写 `mobile-audit.spec.ts`、
 *     也可写 `host/e2e/mobile-audit.spec.ts` 或 playwright 报的任意相对前缀
 *     （`spec.file` 相对 rootDir 而变，逐字比会因前缀不同而漏匹配）；
 *   · 用例名片段按子串匹配（空片段 = 该文件下任意失败都算命中，慎用）；
 *   · 一个 spec 可在多个 project（chromium / mobile-chrome…）各跑一次，
 *     每个 project 是**独立的失败身份**，故一条台账只能吸收一次命中；
 *     需要登记两个 profile 就写两行。
 */

/** 从 playwright json 报告里抽出所有「真失败」的用例。 */
export function nonPassingTests(report) {
  if (!report || !Array.isArray(report.suites)) return [];
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const testCase of spec.tests ?? []) {
        const results = testCase.results ?? [];
        const last = results[results.length - 1];
        const status = last?.status ?? 'unknown';
        if (status !== 'failed' && status !== 'timedOut' && status !== 'interrupted') continue;
        // spec.title 与 testCase.title 通常同值，去重后只留一份，
        // 否则匹配键会变成 `responsive sweep › responsive sweep`。
        const title =
          spec.title === testCase.title ? spec.title : `${spec.title} › ${testCase.title}`;
        out.push({
          project: testCase.projectName ?? 'unknown',
          file: spec.file ?? spec.location?.filePath ?? 'unknown',
          title: title ?? '',
          status,
          error: (last?.error?.message ?? '').split('\n')[0],
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites) walk(suite);
  return out;
}

/** 解析台账文件内容（不碰 fs，便于测试直接喂字符串）。 */
export function parseKnownRed(raw) {
  const entries = [];
  const malformed = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('|').map((s) => s.trim());
    const ok =
      parts.length >= 3 &&
      parts[0].includes(':') &&
      /^#?\d+$/.test(parts[1]) &&
      parts.slice(2).join('|').trim().length > 0;
    if (!ok) {
      malformed.push(trimmed);
      continue;
    }
    const idx = parts[0].lastIndexOf(':');
    entries.push({
      file: parts[0].slice(0, idx).trim(),
      titleFragment: parts[0].slice(idx + 1).trim(),
      issue: parts[1],
      reason: parts.slice(2).join('|').trim(),
      raw: trimmed,
    });
  }
  return { entries, malformed };
}

/**
 * 判定：台账命中 / 未登记失败 / 格式非法 / STALE 反噬。
 * @param raw 台账文件文本
 * @param failures nonPassingTests() 的结果
 * @returns {{ok: boolean, knownRed: object[], unknown: object[], stale: object[], malformed: string[]}}
 */
export function judgeKnownRed(raw, failures) {
  const { entries, malformed } = parseKnownRed(raw ?? '');

  const used = new Set();
  const knownRed = [];
  const unknown = [];

  for (const failure of failures) {
    // 两侧都取 basename：台账可带 host/e2e/ 前缀，playwright 的 spec.file
    // 相对 rootDir 变化（e2e/xxx vs /abs/path/e2e/xxx），逐字比必漏。
    const base = failure.file.split('/').pop();
    const hit = entries.find(
      (e) =>
        !used.has(e.raw) &&
        e.file.split('/').pop() === base &&
        (!e.titleFragment || failure.title.includes(e.titleFragment)),
    );
    if (hit) {
      used.add(hit.raw);
      knownRed.push({ failure, entry: hit });
    } else {
      unknown.push(failure);
    }
  }

  // 台账里没被本轮命中 = 已修绿（或不再执行）却没删登记 ⇒ STALE 反噬。
  const stale = entries.filter((e) => !used.has(e.raw));

  return {
    ok: malformed.length === 0 && unknown.length === 0 && stale.length === 0,
    knownRed,
    unknown,
    stale,
    malformed,
  };
}
