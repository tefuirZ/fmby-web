// #2127：注册码 role_template 下拉曾提供 super_admin —— 后端无此角色，选了必
// 400 USER_ROLE_NOT_FOUND（取证：bridges/self_register.rs:262-266）＝用户可见功能坏。
// 下拉选项必须收敛到后端 BUILTIN_ROLES（admin / user / restricted_user）。
// 跑法：node --import ./tests/register-aliases.mjs --test tests/registration-role-options.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_OPTIONS } from '@/pages/manage/registration-codes/constants';

const BACKEND_BUILTIN_ROLES = new Set(['admin', 'user', 'restricted_user']);

test('#2127 负例：role_template 下拉不得提供 super_admin（后端无此角色 ⇒ 必 400）', () => {
  const values = ROLE_OPTIONS.map((o) => String(o.value));
  assert.ok(
    !values.includes('super_admin'),
    'super_admin 是 V1 残留（前端类型已删），不得出现在任何下拉',
  );
});

test('#2127 下拉收敛：恰好后端三内置角色，无空选项/空标签', () => {
  assert.ok(ROLE_OPTIONS.length > 0, '不得出现空下拉');
  for (const o of ROLE_OPTIONS) {
    assert.ok(BACKEND_BUILTIN_ROLES.has(o.value), `${o.value} 不是后端内置角色`);
    assert.ok(o.label.trim() !== '', '选项标签不得为空');
    assert.ok(o.description.trim() !== '', '选项描述不得为空');
  }
  assert.deepEqual(
    ROLE_OPTIONS.map((o) => o.value).sort(),
    ['admin', 'restricted_user', 'user'],
    '下拉应恰好收敛到后端三内置角色（不多不少）',
  );
});
