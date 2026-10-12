/**
 * scripts/lib/e2e-known-red 判定逻辑的回归锁（RV01 阻断项 3 的兑现路径）。
 *
 * 台账必须**真的参与门禁判定**。若它退化成「打印路径后放行」，
 * 就等于把 known-red 变成 allowlist ⇒ 与「诚实化」裁定相悖，
 * 且首次真实失败会直接打死 `pnpm verify`（比静默 skip 更糟）。
 *
 * 本测试覆盖四条判定路径：
 *   1. 命中台账 ⇒ ok=true（记 SKIP，不置红）；
 *   2. 未登记失败 ⇒ ok=false（置红）；
 *   3. 格式非法登记 ⇒ ok=false（防止台账写成无法匹配的形状后静默失守）；
 *   4. 台账条目未被命中（已修绿却没删）⇒ ok=false（STALE 反噬）。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { judgeKnownRed, nonPassingTests, parseKnownRed } from '../../scripts/lib/e2e-known-red.mjs';

/** 构造一份 playwright json 报告（只保留判定需要的字段）。 */
function makeReport(specs) {
  return {
    suites: [
      {
        title: '',
        specs: specs.map(({ file, title, projects, status = 'failed', error }) => ({
          title,
          file,
          tests: projects.map((projectName) => ({
            projectName,
            title,
            results: [{ status, ...(error ? { error: { message: error } } : {}) }],
          })),
        })),
      },
    ],
  };
}

const FAIL_MOBILE = {
  file: 'e2e/mobile-audit.spec.ts',
  title: 'responsive sweep › sweep phone-375',
  projects: ['chromium', 'mobile-chrome'],
  error: 'Error: 横向溢出页（>4px）：manage-license (+42px )\n    at ...',
};

describe('nonPassingTests', () => {
  it('只取 failed/timedOut/interrupted，passed 与 skipped 不算失败', () => {
    const failures = nonPassingTests(
      makeReport([
        { ...FAIL_MOBILE, projects: ['chromium'], status: 'passed' },
        { ...FAIL_MOBILE, projects: ['chromium'], status: 'skipped' },
      ]),
    );
    assert.equal(failures.length, 0);
  });

  it('多 project 各算一个独立失败身份', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    assert.deepEqual(
      failures.map((f) => f.project),
      ['chromium', 'mobile-chrome'],
    );
  });

  it('spec.title 与 testCase.title 同值时不产生 `a › a` 重复匹配键', () => {
    const [failure] = nonPassingTests(makeReport([FAIL_MOBILE]));
    assert.equal(failure.title, 'responsive sweep › sweep phone-375');
  });

  it('报告缺失/为空时返回空数组而不是抛错', () => {
    assert.deepEqual(nonPassingTests(null), []);
    assert.deepEqual(nonPassingTests({}), []);
  });
});

describe('parseKnownRed', () => {
  it('按最后一个冒号切分文件名与用例片段（Windows 风格路径也安全）', () => {
    const { entries } = parseKnownRed('e2e/mobile-audit.spec.ts:sweep phone-375 | 12 | 存量溢出');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].file, 'e2e/mobile-audit.spec.ts');
    assert.equal(entries[0].titleFragment, 'sweep phone-375');
    assert.equal(entries[0].issue, '12');
  });

  it('注释与空行被忽略', () => {
    const { entries, malformed } = parseKnownRed('# 注释\n\n  \n');
    assert.equal(entries.length, 0);
    assert.equal(malformed.length, 0);
  });

  it('缺 issue 号 / 缺原因 / 无冒号 → 格式非法', () => {
    const { malformed } = parseKnownRed(
      [
        'e2e/a.spec.ts:某用例', // 无 issue / 无原因
        'e2e/a.spec.ts:某用例 | 非数字 | 原因', // issue 非数字
        'e2e/a.spec.ts:某用例 | 12 |', // 缺原因
        '没有冒号 | 12 | 原因',
      ].join('\n'),
    );
    assert.equal(malformed.length, 4);
  });
});

describe('judgeKnownRed — 四条判定路径', () => {
  it('路径 1：失败全部命中台账 ⇒ ok=true，并给出 issue 号', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    const raw = ['chromium', 'mobile-chrome']
      .map((p) => `mobile-audit.spec.ts:sweep phone-375 | ${p === 'chromium' ? 101 : 102} | ${p} profile 存量溢出`)
      .join('\n');
    const verdict = judgeKnownRed(raw, failures);
    assert.equal(verdict.ok, true, JSON.stringify(verdict));
    assert.equal(verdict.knownRed.length, 2);
    assert.equal(verdict.unknown.length, 0);
    assert.equal(verdict.stale.length, 0);
  });

  it('路径 2：存在未登记失败 ⇒ ok=false', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    // 只登记 chromium ⇒ mobile-chrome 那条未登记
    const verdict = judgeKnownRed(
      'mobile-audit.spec.ts:sweep phone-375 | 101 | chromium profile 存量溢出',
      failures,
    );
    assert.equal(verdict.ok, false);
    assert.equal(verdict.unknown.length, 1);
    assert.equal(verdict.unknown[0].project, 'mobile-chrome');
  });

  it('路径 3：格式非法登记 ⇒ ok=false（不静默）', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    const verdict = judgeKnownRed('mobile-audit.spec.ts:sweep phone-375', failures);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.malformed.length, 1);
    // 非法登记行**不进 entries** ⇒ 两 profile 的失败全部落 unknown，
    // 绝不能因为台账写了行就当作已登记。
    assert.equal(verdict.unknown.length, 2, '两个 project 是独立失败身份，均未登记');
  });

  it('路径 4：台账条目本次未被命中（已修绿未删）⇒ STALE 反噬 ok=false', () => {
    // 本轮 e2e 全绿（无失败），但台账仍有两条登记
    const verdict = judgeKnownRed(
      [
        'mobile-audit.spec.ts:sweep phone-375 | 101 | 存量溢出',
        'a11y-report.spec.ts:生成逐页无障碍树 | 102 | 存量超时',
      ].join('\n'),
      [],
    );
    assert.equal(verdict.ok, false);
    assert.equal(verdict.stale.length, 2);
    assert.equal(verdict.unknown.length, 0);
  });

  it('一条台账只能吸收一次命中：第二个 profile 不算命中', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    const verdict = judgeKnownRed(
      'mobile-audit.spec.ts:sweep phone-375 | 101 | 存量溢出',
      failures,
    );
    assert.equal(verdict.ok, false);
    assert.equal(verdict.knownRed.length, 1);
    assert.equal(verdict.unknown.length, 1, '同一 profile 名在 chromium/mobile-chrome 各算一次失败');
    assert.equal(verdict.stale.length, 0, '已命中过就不算 STALE');
  });

  it('spec 文件按 basename 双向匹配（台账可带 host/e2e/ 前缀）', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    assert.equal(judgeKnownRed('host/e2e/mobile-audit.spec.ts:sweep phone-375 | 101 | x', failures).knownRed.length, 1);
    assert.equal(judgeKnownRed('mobile-audit.spec.ts:sweep phone-375 | 101 | x', failures).knownRed.length, 1);
  });

  it('用例名片段是子串匹配；不存在的片段不命中', () => {
    const failures = nonPassingTests(makeReport([FAIL_MOBILE]));
    // 'sweep' 是子串 ⇒ 命中（片段本就是子串口径）
    assert.equal(judgeKnownRed('mobile-audit.spec.ts:sweep | 101 | x', failures).knownRed.length, 1);
    // 片段不存在于任何用例名 ⇒ 不命中
    assert.equal(judgeKnownRed('mobile-audit.spec.ts:tablet-768 | 101 | x', failures).knownRed.length, 0);
    // 'sw' 也确实是子串（responsive **sw**eep）⇒ 命中，用它当反例会假红
    assert.equal(judgeKnownRed('mobile-audit.spec.ts:sw | 101 | x', failures).knownRed.length, 1);
  });

  it('空台账 + 无失败 ⇒ ok=true（当前仓库状态）', () => {
    assert.equal(judgeKnownRed('# 全是注释\n', []).ok, true);
  });
});
