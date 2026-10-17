// P1-11（FE-UI-DENSITY-AUDIT §4）DOM 断言：管理侧栏去「卡片套卡片」+ 导航树压平。
//
// 审计原文建议（§4 P1-11）：
//   ① 去掉 .navCard 盒子（border+bg+shadow 套在 .rail 里再套 .subGroup）——
//      保留分组标题与间距缩进，与暗房「没有卡片」原则对齐，视觉噪音 -1 层；
//   ② 第三层叶子（邀请与用户 / 会话与日志各 3-4 项）上提一层，两层树封顶；
//   ③ 30 个叶子链接一条不少（压平 ≠ 删入口），sticky+scroll 保持。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-11.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // host/
const read = (p) => readFileSync(join(repoRoot, p), 'utf8');

/** 剔除 JSX 块注释与行注释后再断言（防实现注释里的字符串触发假红）。 */
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const tsx = stripComments(read('src/app/layouts/ManageLayout.tsx'));
const css = read('src/app/layouts/ManageLayout.module.css');

test('P1-11②: 导航树压平为两层——中间层「邀请与用户/会话与日志」退场', () => {
  for (const gone of ['邀请与用户', '会话与日志', "id: 'site-users'", "id: 'site-security'"]) {
    assert.ok(!tsx.includes(gone), `中间层 ${gone} 应退场（叶子上提一层）`);
  }
});

test('P1-11③: 7 个被上提的叶子一条不少、路径不变（压平 ≠ 删入口）', () => {
  const leaves = [
    ['site-registration-codes', '/manage/site/users/registration-codes'],
    ['site-accounts', '/manage/site/users/accounts'],
    ['site-role-templates', '/manage/site/users/role-templates'],
    ['site-rewards', '/manage/site/rewards'],
    ['site-sessions', '/manage/site/security/sessions'],
    ['site-audit-logs', '/manage/site/security/audit-logs'],
    ['site-runtime-logs', '/manage/site/security/runtime-logs'],
  ];
  for (const [id, to] of leaves) {
    assert.ok(tsx.includes(`id: '${id}'`), `叶子 ${id} 应保留`);
    assert.ok(tsx.includes(`to: '${to}'`), `叶子 ${id} 的路由 ${to} 应原样保留`);
  }
});

test('P1-11①: .navCard 去盒子（无 border/background），分组标题 accent 保留', () => {
  const block = css.slice(css.indexOf('.navCard {'), css.indexOf('}', css.indexOf('.navCard {')));
  assert.ok(!/\bborder:/.test(block), '.navCard 不应再有盒子 border');
  assert.ok(!/background:/.test(block), '.navCard 不应再有盒子 background');
  assert.match(
    css,
    /\.navCard\[data-active='true'\] \.navCardHeader/,
    '激活态的分组标题 cyan accent 应保留'
  );
});

test('P1-11: subGroup 三层结构 JSX 与 CSS 一并退场', () => {
  assert.ok(!tsx.includes('styles.subGroup'), 'NavBranch 不应再渲染 subGroup');
  assert.ok(!/\.subGroup\s*\{/.test(css), 'CSS 不应再保留 subGroup 规则');
});
