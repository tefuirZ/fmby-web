// FE-LIAR-TEXT 契约锁：敏感操作弹窗的确认文案必须如实 ——
// 它是「提交前的防误触确认」，**不得**承诺后端会再校验
// （session_confirmation 后端接受但不校验：有意设计，2026-09-19 裁定；
//   生产代码零读取 —— fixp1e 全链路核实。谁改回承诺式措辞，本锁即红。）
//
// 形态：源码级契约（本包 UI 组件无 DOM 测试基建，照仓内
// a11y/ui-density 源码锁先例），读 shared/src/ui/common/SensitiveActionDialog.tsx 原文。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../src/ui/common/SensitiveActionDialog.tsx');
const src = readFileSync(FILE, 'utf8');

test('确认文案如实：两档都写明「提交前的防误触确认」', () => {
  const hits = src.match(/提交前的防误触确认/g) ?? [];
  assert.equal(hits.length, 2, 'session/password 两档各一句防误触说明');
  assert.ok(src.includes('不会对本输入做额外校验'), 'session 档如实声明：输入不被额外校验');
  assert.ok(src.includes('不会用本输入做身份再校验'), 'password 档如实声明：密码不做身份再校验');
});

test('禁止回归承诺式措辞（后端并不校验这些输入）', () => {
  assert.ok(!src.includes('再次校验'), '不得承诺「再次校验」');
  assert.ok(!src.includes('再次验证'), '不得承诺「再次验证」');
  assert.ok(!src.includes('只靠前端弹窗'), '不得用「不会只靠前端弹窗」暗示服务端会校验密码');
  assert.ok(!src.includes('后端会按当前管理会话'), '旧撒谎文案不得回归');
});

test('两档提示各自被策略门控（none 档不渲染任何确认输入/提示）', () => {
  assert.ok(src.includes("confirmationMode === 'session' ?"), 'session 档提示须门控');
  assert.ok(src.includes("confirmationMode === 'password' ?"), 'password 档提示须门控');
});
