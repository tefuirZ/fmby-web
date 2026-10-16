import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * #640 卡面「动态配置：后端热加载（不重启）⇒ 个别需重建连接处用 **Loading 过渡页**掩盖」
 * 的接线契约断言。
 *
 * ★诚实口径（同 `install-wizard-honesty.test.ts`）：无 jsdom ⇒ 断言源码接线。
 *   这里真正要保证的是两件事：**pending 期间换整页**（不是只改按钮文案），
 *   以及**过渡页不谎报进度**（后端 apply 是一个请求，没有分步回执）。
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const OVERLAY = 'host/src/pages/install/InstallProgressScreen.tsx';
const PAGE = 'host/src/pages/install/InstallPage.tsx';

function read(rel: string): string {
  return readFileSync(`${ROOT}${rel}`, 'utf8');
}

test('① 过渡页组件存在，且用既有 spinner / loading 样式（不新增 CSS）', () => {
  const src = read(OVERLAY);
  assert.match(src, /Loader2/, '须复用已装的 lucide Loader2 转圈');
  assert.match(src, /styles\.loading|styles\.spinner/, '须复用 LoginPage.module.css 既有类');
});

test('② 编排页在 apply pending 时换整页，而不是只把按钮文案改成「安装中…」', () => {
  const src = read(PAGE);
  assert.match(src, /InstallProgressScreen/, '须渲染过渡页组件');
  assert.match(
    src,
    /apply\.isPending[\s\S]{0,160}return\s*[\s\S]{0,240}<InstallProgressScreen/,
    'apply 请求在飞 ⇒ 必须早退渲染过渡页（表单让位）',
  );
});

test('③ complete（落锁）pending 同样走过渡页 —— 落锁后主应用接管，也要掩盖重载', () => {
  const src = read(PAGE);
  assert.match(
    src,
    /complete\.isPending[\s\S]{0,160}return\s*[\s\S]{0,240}<InstallProgressScreen/,
    'complete 在飞 ⇒ 也须换过渡页',
  );
});

test('④ 过渡页文案砍短、无术语、不提重启（SIMPLIFY-INSTALL-WIZARD）', () => {
  // 用户裁定文案砍短删术语；后端契约 restart_required:false 不得说重启。
  const src = read(OVERLAY);
  for (const term of ['热加载', '落盘', '原子', '连接池', '装配', 'schema']) {
    assert.equal(src.includes(term), false, `过渡页文案不得含术语「${term}」`);
  }
  assert.equal(/重启/.test(src), false, '过渡页文案不得出现"重启"');
});

test('⑤ 诚实边界：apply 是单请求，不得伪装成「分步进度条」', () => {
  const src = read(OVERLAY);
  assert.equal(/%/.test(src), false, '后端没有进度回执 ⇒ 不得显示百分比');
  assert.equal(/step\s*[=}]|progress=\{|aria-valuenow/.test(src), false, '不得造假进度');
  // 允许 role="status" 播报，但文案得说「不知道还要多久」这一层实话。
  assert.match(src, /正在|请稍候|可能需要|取决于/, '须如实描述为进行中而非量化进度');
});

test('⑥ 过渡页不得出现「完成 / 成功」字样（pending 期间还没成）', () => {
  const body = read(OVERLAY).replace(/^\s*\/\*[\s\S]*?\*\//, '');
  const code = body.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/安装已完成|安装成功/.test(code), false, 'pending 页面不能提前宣告完成');
});

test('⑦ 过渡页要在状态视图之前判定（已 completed 的实例不该看到转圈）', () => {
  const src = read(PAGE);
  // 锁 `if (...) { return <InstallProgressScreen ... /> }` 这个形状；
  // 只查「apply.isPending || complete.isPending」会被 anyPending 那行误命中。
  assert.match(
    src,
    /if\s*\(apply\.isPending\s*\|\|\s*complete\.isPending\)\s*\{[\s\S]{0,240}return[\s\S]{0,200}InstallProgressScreen/,
    '过渡页必须是早退分支，且在主正文之前',
  );
});
