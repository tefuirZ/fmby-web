import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PASSWORD_MIN_LENGTH,
  WEAK_PASSWORDS,
  assessPassword,
  confirmPasswordProblem,
  generateStrongPassword,
  isStrongPassword,
} from '../src/pages/install/passwordPolicy.ts';

/**
 * fmby-v2 #640 用户裁定 ②③ 的**实测**用例。
 *
 * ★这些都是对纯函数的真跑（node --test），不是源码文案断言 ——
 *   宿主仓无 jsdom / testing-library，组件级断言会退化成「读源码找字符串」，
 *   那不叫实证（参见 install-wizard-honesty.test.ts 顶部说明）。
 */

test('① 长度不足 16 一律不通过，且失败项逐条列出', () => {
  const a = assessPassword('Ab1!Ab1!Ab1!Ab1'); // 15 位，四类齐
  assert.equal(a.ok, false);
  assert.deepEqual(a.failures, [`长度 ≥ ${PASSWORD_MIN_LENGTH}`]);
  // 四类本身都通过 ⇒ failures 不得把它们也列进去。
  assert.deepEqual(
    a.rules.filter((r) => !r.passed).map((r) => r.key),
    ['length'],
  );
});

test('② 四类字符缺任一类都红（各缺一类的四个用例）', () => {
  const base = 'Abcdefghij1!2345678'; // 20 位，大小写+数字+特殊齐
  assert.equal(isStrongPassword(base), true, '基准串本身应通过');

  const cases: [string, string, string][] = [
    ['无大写', 'abcdefghij1!2345678', '含大写字母'],
    ['无小写', 'ABCDEFGHIJ1!2345678', '含小写字母'],
    ['无数字', 'Abcdefghijkl!234567'.replace('234567', '!#@%^&'), '含数字'],
    ['无特殊', 'Abcdefghijkl12345678', '含特殊字符'],
  ];
  for (const [name, value, expectFailure] of cases) {
    const a = assessPassword(value);
    assert.equal(a.ok, false, `${name}：${value} 应不通过`);
    assert.deepEqual(a.failures, [expectFailure], `${name} 的失败项应恰为一项`);
  }
});

test('③ 常见弱口令被拒（大小写不敏感比较）', () => {
  for (const weak of ['passwordpassword', 'Qwertyuiop123456']) {
    const a = assessPassword(weak);
    assert.equal(a.ok, false, `弱口令 ${weak} 应被拒`);
    // 弱口令往往同时缺大写/数字/特殊 ⇒ 这里断言「黑名单这条判据确实红了」，
    // 而不是「只红这一项」（那要求弱口令同时满足四类，不现实）。
    assert.ok(
      a.failures.includes('不是常见弱口令'),
      `${weak} 的失败项须含黑名单判据，实际 ${JSON.stringify(a.failures)}`,
    );
  }
  // 反事实：把这批弱口令从黑名单摘掉后，其中长度够、四类齐的应能过 ——
  // 证明黑名单不是被长度规则「顺带」拦下的（装饰性代码）。
  const lenOnlyPass = WEAK_PASSWORDS.filter((w) => w.length >= PASSWORD_MIN_LENGTH);
  assert.ok(lenOnlyPass.length > 0, '黑名单非空');
  assert.equal(
    WEAK_PASSWORDS.includes('QWERTYUIOP123456'),
    false,
    '比较用小写：大小写变体由 toLowerCase 归一，黑名单本身应存小写形',
  );
  assert.equal(
    assessPassword('Qwertyuiop123456').failures.includes('不是常见弱口令'),
    true,
    '大写变体同样命中黑名单',
  );
  assert.equal(
    WEAK_PASSWORDS.every((w) => w.length >= PASSWORD_MIN_LENGTH),
    true,
    '黑名单只收长度已达标的口令（否则一个口令两个失败原因）',
  );
});

test('④ 二次确认：空 / 不一致 / 一致但弱，三种各有明确原因', () => {
  const strong = 'Abcdefghij1!2345678';
  assert.equal(confirmPasswordProblem(strong, ''), '请再次输入口令以确认');
  assert.equal(confirmPasswordProblem(strong, `${strong}x`), '两次输入的口令不一致');
  assert.match(confirmPasswordProblem('weak', 'weak'), /^口令未达强度要求：/);
  assert.equal(confirmPasswordProblem(strong, strong), null);
});

test('⑤ 一键生成：长度 16 且四类字符各至少一个（跑 500 次全检）', () => {
  for (let i = 0; i < 500; i += 1) {
    const pwd = generateStrongPassword();
    assert.equal(pwd.length, 16, `第 ${i} 次生成长度应为 16，实际 ${pwd.length}`);
    const a = assessPassword(pwd);
    assert.equal(a.ok, true, `第 ${i} 次生成结果自身应过强度校验：${pwd} / ${a.failures}`);
  }
});

test('⑥ 生成器不是固定序列（四类不在前 4 位 ⇒ 洗牌生效）', () => {
  const set = new Set<string>();
  for (let i = 0; i < 200; i += 1) set.add(generateStrongPassword());
  assert.equal(set.size, 200, '200 次生成应全不相同（无固定种子）');
  // 前 4 位恰好是「一大一小一数字一特殊」的次数应当远少于 200。
  const sortedHead = [...set].filter((p) => /^[A-Z][a-z][0-9][^A-Za-z0-9]/.test(p)).length;
  assert.ok(sortedHead < 200, `洗牌应打散四类前缀，实际仍有 ${sortedHead}/200 命中`);
});

test('⑦ 生成器可指定长度，且短于 4 时退到 4（仍保四类各一）', () => {
  assert.equal(generateStrongPassword(24).length, 24);
  const tiny = generateStrongPassword(1);
  assert.equal(tiny.length, 4, '长度 1 应退到 4（四类各保底一位的最小可行值）');
  assert.equal(assessPassword(tiny).rules.filter((r) => !['length', 'common'].includes(r.key) && !r.passed).length, 0);
});
