// P1-10（FE-UI-DENSITY-AUDIT §4）断言：设置中心 sticky 让位魔数 token 化。
//
// 审计原文建议（§4 P1-10）：
//   SettingsCenter.module.css:155 padding-bottom: 88px 与 :485 移动端 120px
//   ⇒ 注册 --stickybar-clearance: 88px（mobile 120px）；stickyBar 高度变化时
//   只改一处（每个断点一行，不再有裸魔数散落）。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-10.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // host/
const css = readFileSync(join(repoRoot, 'src/pages/settings/SettingsCenter.module.css'), 'utf8');

test('P1-10: --stickybar-clearance 变量注册（桌面 88 / 移动 120）', () => {
  assert.match(css, /--stickybar-clearance:\s*88px/, '桌面让位值应注册为变量');
  assert.match(css, /--stickybar-clearance:\s*120px/, '移动端让位值应注册为变量');
});

test('P1-10: 裸魔数 padding 退场，统一走变量', () => {
  assert.ok(!css.includes('padding-bottom: 88px'), '不再有裸 88px padding');
  assert.ok(!css.includes('padding-bottom: 120px'), '不再有裸 120px padding');
  const uses = css.match(/padding-bottom:\s*var\(--stickybar-clearance\)/g) ?? [];
  assert.ok(uses.length >= 2, `桌面与移动两处都应引用变量；实测 ${uses.length} 处`);
});
