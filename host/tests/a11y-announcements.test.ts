// FE-A11Y-KEYBOARD-AUDIT：可播报性/label 对拍（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 审计结论（面 A 检索列表 / B 139 抽屉 / C 挂载配置抽屉 / D 错误态）：
// - 键盘面零改动：Radix Dialog（SideDrawer）自带 Esc/焦点陷阱/焦点归还；
//   <details>（高级选项）原生展开语义无需 aria-expanded；按钮/输入原生可聚焦。
// - 修 3 处可播报性（字符串级断言锁定；worktree 无 node_modules，react 不可 SSR）：
//   ① InlineBanner：error/warning → role="alert"（assertive），success/info 保持 status；
//   ② CollectionsListPage 检索 input 补 aria-label（placeholder 不替代 label）；
//   ③ 139 扫码轮询状态 readOnly input 补 aria-live="polite"（自动变化需播报）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

test('① InlineBanner：error/warning → role="alert"，success/info → role="status"', () => {
  const src = read('../../shared/src/ui/common/InlineBanner.tsx');
  // role 为变体条件表达式（源码级断言）：error/warning → alert（assertive），其余 status。
  assert.ok(
    src.includes("variant === 'error' || variant === 'warning' ? 'alert' : 'status'"),
    'InlineBanner 需按变体切换播报角色',
  );
});

test('② CollectionsListPage：检索 input 有 aria-label', () => {
  const src = read('../../host/src/pages/browse/CollectionsListPage.tsx');
  assert.ok(/aria-label="[^"]*检索/.test(src), '检索 input 需 aria-label');
});

test('③ 139 扫码状态 input 补 aria-live="polite"', () => {
  const src = read('../../host/src/pages/manage/yun139/Yun139QrLoginSection.tsx');
  assert.ok(src.includes('aria-live="polite"'), '轮询状态自动变化需可播报');
});

test('④ 键盘面零改动留痕：SideDrawer 走 Radix Dialog（Esc/陷阱/归还内建）', () => {
  const src = read('../../shared/src/ui/common/SideDrawer.tsx');
  assert.ok(src.includes('@radix-ui/react-dialog'));
  assert.ok(src.includes('onOpenChange'));
  assert.ok(src.includes('aria-label="关闭详情面板"'));
});
