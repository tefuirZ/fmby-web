#!/usr/bin/env node
/**
 * scripts/lib/e2e-known-red.selftest.mjs — E2E 已知红判定逻辑的**判据自测**。
 *
 * 为什么必须有：判定逻辑是「唯一真源」，但它此前**没有任何测试**（模块文档承诺了
 * 四条路径回归，测试文件却从未落地）。本次补齐并覆盖 @project 语义：
 *   ① 命中台账 ⇒ knownRed（不置红）；
 *   ② 未登记失败 ⇒ unknown（置红）；
 *   ③ 格式非法登记 ⇒ malformed（置红，防台账写成匹配不上的形状后静默失守）；
 *   ④ 台账条目未被命中 ⇒ STALE 反噬（台账不是永久豁免）；
 *   ⑤ @project 命中：`spec@mobile-chrome:片段` 吸收 mobile-chrome 失败；
 *   ⑥ @project 排他：`spec@chromium:片段` **不**吸收 mobile-chrome 失败
 *      （每个 project 是独立失败身份——把移动端特有红错记到桌面条目上 = 掩盖）；
 *   ⑦ 不带 @project ⇒ 匹配任意 project（兼容存量 chromium 时代登记）；
 *   ⑧ 同 spec 同片段、@project 各异的两行 ⇒ 各吸收一次命中
 *      （旧解析器 used 判重按 raw 行文本 ⇒ 两行文本相同即被吞，「写两行」不可能——本例钉住修复）。
 *
 * 跑法：node scripts/lib/e2e-known-red.selftest.mjs
 */
import { judgeKnownRed, parseKnownRed, nonPassingTests } from './e2e-known-red.mjs';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ` ｜ ${detail}`}`);
};

const mobileFailure = {
  project: 'mobile-chrome',
  file: '/abs/root/e2e/grid-keynav.spec.ts',
  title: 'FE-LIST-KEYNAV — 网格方向键漫游 › 焦点可见',
  status: 'failed',
  error: 'expect(received).toBe(expected)',
};
const desktopFailure = {
  project: 'chromium',
  file: '/abs/root/e2e/grid-keynav.spec.ts',
  title: 'FE-LIST-KEYNAV — 网格方向键漫游 › 焦点可见',
  status: 'failed',
  error: 'expect(received).toBe(expected)',
};

// ① 命中 ⇒ knownRed
{
  const r = judgeKnownRed('grid-keynav.spec.ts:焦点可见 | 42 | 存量', [desktopFailure]);
  check('① 台账命中 ⇒ knownRed（不置红）', r.ok && r.knownRed.length === 1 && r.unknown.length === 0);
}
// ② 未登记 ⇒ unknown
{
  const r = judgeKnownRed('', [desktopFailure]);
  check('② 未登记失败 ⇒ unknown（置红）', !r.ok && r.unknown.length === 1);
}
// ③ 格式非法
{
  const r = judgeKnownRed('这一行没有竖线分隔符', [desktopFailure]);
  check('③ 格式非法 ⇒ malformed（置红）', !r.ok && r.malformed.length === 1);
}
// ④ STALE 反噬
{
  const r = judgeKnownRed('grid-keynav.spec.ts:焦点可见 | 42 | 已修绿但没删', []);
  check('④ 条目未命中 ⇒ STALE（置红）', !r.ok && r.stale.length === 1);
}
// ⑤ @project 命中
{
  const r = judgeKnownRed('grid-keynav.spec.ts@mobile-chrome:焦点可见 | 42 | 移动端', [mobileFailure]);
  check('⑤ @mobile-chrome 条目吸收 mobile 失败', r.ok && r.knownRed.length === 1);
}
// ⑥ @project 排他
{
  const r = judgeKnownRed('grid-keynav.spec.ts@chromium:焦点可见 | 42 | 桌面', [mobileFailure]);
  check('⑥ @chromium 条目不得吸收 mobile 失败（项目独立身份）', !r.ok && r.unknown.length === 1);
}
// ⑦ 无限定 = 任意 project
{
  const r = judgeKnownRed('grid-keynav.spec.ts:焦点可见 | 42 | 兼容存量', [mobileFailure]);
  check('⑦ 不带 @project 匹配任意 project（兼容存量）', r.ok && r.knownRed.length === 1);
}
// ⑧ 两行 @project 各异 ⇒ 各吸收一次（修复「写两行不可能」）
{
  const ledger = [
    'grid-keynav.spec.ts@chromium:焦点可见 | 42 | 桌面已知红',
    'grid-keynav.spec.ts@mobile-chrome:焦点可见 | 43 | 移动端已知红',
  ].join('\n');
  const r = judgeKnownRed(ledger, [desktopFailure, mobileFailure]);
  check(
    '⑧ 两行 @project 各异 ⇒ 两失败各自吸收（旧解析器不可能）',
    r.ok && r.knownRed.length === 2 && r.unknown.length === 0,
  );
}
// ⑨ nonPassingTests 保留 project（回归钉：解析层不得丢 project）
{
  const report = {
    suites: [
      {
        specs: [
          {
            title: 'T',
            file: 'e2e/x.spec.ts',
            tests: [{ title: 'T', projectName: 'mobile-chrome', status: 'failed', results: [{ status: 'failed' }] }],
          },
        ],
      },
    ],
  };
  const np = nonPassingTests(report);
  check('⑨ nonPassingTests 保留 project 字段', np.length === 1 && np[0].project === 'mobile-chrome');
}

console.log(`\n${failures === 0 ? 'SELFTEST PASS' : 'SELFTEST FAIL'} （9 条判据，失败 ${failures}）`);
process.exit(failures === 0 ? 0 : 1);
