// P1-8（FE-UI-DENSITY-AUDIT）DOM 断言：用户表列数收敛 + 无信息损失。
//
// 审计原文建议（§4 P1-8）：
//   ① 角色+类型+来源授权 → 合并为「权限」列（徽章组，数据已在行模型内）
//   ② 创建时间 → 移入查看抽屉（低频；抽屉已有同字段）
//   ③ 最近登录+最近设备 → 合并为一列两行文本（同单元格，零信息损失）
//   结果 10→7 列。
//
// 本卡按用户要求再收一列：**次列折叠** —— 「最近登录/最近设备」与「创建时间」
// 一并移入抽屉，表内只留 6 列（勾选/账号/权限/状态/登录设备/操作）。
// 抽屉已含 createdAt / lastLoginAt / lastDevice / roleLabel / accountKind /
// sourceGrants（UserDrawer.tsx 实测），故为**零信息损失**。
//
// 为什么用文本断言而非渲染断言：本仓前端测试无 jsdom/RTL（见 media-items-detail.test.ts），
// 引渲染库违反 ponytail；列数是结构不变量，文本判定足够且稳定。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/*.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const tablePath = join(
  repoRoot,
  'src/pages/manage/users/components/UserTable.tsx'
);
const drawerPath = join(
  repoRoot,
  'src/pages/manage/users/components/UserDrawer.tsx'
);

/** thead 里的 `<th>…</th>` 文本（去掉内部标签）。 */
function headerCells(source) {
  const thead = source.match(/<thead>([\s\S]*?)<\/thead>/);
  assert.ok(thead, '应存在 <thead>');
  const cells = [...thead[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  );
  return cells;
}

test('P1-8: 用户表收敛到 6 列', () => {
  const src = readFileSync(tablePath, 'utf8');
  const cells = headerCells(src);
  assert.equal(
    cells.length,
    6,
    `用户表应为 6 列（勾选/账号/权限/状态/登录设备/操作）；实测 ${cells.length} 列：${cells.join(' | ')}`
  );
});

test('P1-8: 被折叠的三列（角色/类型/来源授权/创建时间）不得再出现在表头', () => {
  const src = readFileSync(tablePath, 'utf8');
  const cells = headerCells(src);
  for (const gone of ['角色', '类型', '来源授权', '创建时间']) {
    assert.ok(
      !cells.includes(gone),
      `表头不应再单独出现「${gone}」列（已折叠进抽屉或合并）`
    );
  }
});

test('P1-8: 权限列合并三源且零信息损失', () => {
  const src = readFileSync(tablePath, 'utf8');
  // 权限列必须同时消费三个数据源（合并 ≠ 丢弃）
  for (const field of ['roleLabel', 'accountKind', 'describeSourceGrantSummary']) {
    assert.ok(
      src.includes(field),
      `权限列应继续消费 ${field}（合并列不得丢数据）`
    );
  }
  // 且三者在表头只占 1 列
  const cells = headerCells(src);
  const permCols = cells.filter((c) => c === '权限').length;
  assert.equal(permCols, 1, '权限列应只有 1 个');
});

test('P1-8: 登录设备列合并最近登录+最近设备', () => {
  const src = readFileSync(tablePath, 'utf8');
  const cells = headerCells(src);
  assert.ok(
    cells.some((c) => c.includes('登录') && c.includes('设备')),
    `应存在「登录/设备」合并列；实测列：${cells.join(' | ')}`
  );
  assert.ok(!cells.includes('最近登录'), '「最近登录」不应再单独成列');
  assert.ok(!cells.includes('最近设备'), '「最近设备」不应再单独成列');
  // 两个数据源都仍被消费
  assert.ok(src.includes('lastLoginAt'), 'lastLoginAt 仍应被消费');
  assert.ok(src.includes('lastDevice'), 'lastDevice 仍应被消费');
});

test('P1-8: 零信息损失 —— 抽屉已覆盖被折叠字段', () => {
  const drawer = readFileSync(drawerPath, 'utf8');
  for (const field of ['createdAt', 'lastLoginAt', 'lastDevice', 'roleLabel', 'accountKind']) {
    assert.ok(
      drawer.includes(field),
      `抽屉必须展示 ${field}，否则折叠就是信息损失而非密度优化`
    );
  }
  // 来源授权：抽屉用复数 sourceGrants
  assert.ok(
    /sourceGrants/.test(drawer),
    '抽屉必须展示来源授权明细（sourceGrants）'
  );
});

test('P1-8: colSpan 与列数一致', () => {
  const src = readFileSync(tablePath, 'utf8');
  const m = src.match(/colSpan=\{(\d+)\}/);
  assert.ok(m, '应存在 colSpan');
  assert.equal(
    Number(m[1]),
    6,
    `空态 colSpan 必须等于列数 6；实测 ${m[1]}`
  );
});
