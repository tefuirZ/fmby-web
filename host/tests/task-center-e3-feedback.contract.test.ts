// E3 前端断言（fmby-web）· 任务中心 ≤300ms 出内容 + 空态 + 禁白屏契约。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 卡面 5 条里**本条文件只覆盖可静态/纯函数判定的部分**，逐条标注：
//   ① 点开 ≤300ms 必出内容（禁白屏/无限转圈）  —— 本文件测（见下）
//   ② 每批 append 计数正确                    —— ❌ 载体不存在（E3 WS 未落地），
//                                                  见 BLOCKER 报告 §2
//   ③ 人为 5s 延迟仍 ≤300ms 出内容             —— ❌ 无 delay 注入点，见 §3
//   ④ 3s 无数据 ⇒ 降级文案+重试+「仍在后台执行」 —— ❌ 任务中心无「后台」文案，见 §4
//   ⑤ 空态明确写「当前没有运行中的任务」        —— ⚠️ 部分：现有文案是
//                                                  「当前筛选下没有任务」，与卡面
//                                                  要求的措辞不同，见 §5
//
// 为什么用「读源码 + 纯函数」而不是渲染断言：本仓前端测试**无 jsdom/RTL**
// （既有 20+ 个 contract test 全是这个形态，见 cas-admin-page.contract.test.ts），
// 引一个渲染库只为这几条断言违反 ponytail。时间类断言（①③）单测里 sleep 3s
// 只会让 CI 变慢且仍测不出「用户感知」——那需要 Playwright 真栈（见 §6）。
//
// ★纪律：不把「没测」写成「测过」。覆盖不到的条目标 ❌ 并指向 BLOCKER 报告。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const PAGE = '../../host/src/pages/manage/ManageTaskCenterPage.tsx';
const LIST = '../../host/src/pages/manage/task-center/components/TaskCenterList.tsx';
const HOOKS = '../../host/src/pages/manage/task-center/hooks/useTaskCenterQueries.ts';
const FEEDBACK = '../../shared/src/ui';

// ─────────────────────────────────────────────────────────────────────────────
// ① 点开 ≤300ms 必出内容（禁白屏 / 禁无限转圈）
// ─────────────────────────────────────────────────────────────────────────────

test('①a 首屏有 loading 兜底（不得白屏）', () => {
  const page = read(PAGE);
  // 必须有 isPending 兜底分支：数据未回时渲染 FeedbackState 而不是空 div。
  assert.ok(
    /isPending\s*&&\s*!overviewQuery\.data/.test(page) && /isPending\s*&&\s*!listQuery\.data/.test(page),
    ' overview/list 都必须有 isPending && !data 的兜底判定（缺一个就白屏）'
  );
  assert.ok(
    /variant="loading"/.test(page),
    '兜底必须是可见的 loading 态（FeedbackState variant=loading），不是 null/空 div'
  );
  assert.ok(
    /正在装配任务中心/.test(page),
    'loading 必须有文案（无限转圈无文案 = 用户不知道在发生什么）'
  );
});

test('①b 翻页不清空（keepPreviousData ⇒ 旧内容仍在，禁白屏）', () => {
  const hooks = read(HOOKS);
  assert.ok(
    /placeholderData:\s*keepPreviousData/.test(hooks),
    'list query 必须用 placeholderData: keepPreviousData —— 否则翻页瞬间旧数据被清空 = 白屏'
  );
});

test('①c 错误态可重试（不得死循环转圈）', () => {
  const page = read(PAGE);
  assert.ok(
    /isError\s*&&\s*!overviewQuery\.data/.test(page),
    '必须有 isError 兜底（否则请求失败时停在 loading 永远转圈）'
  );
  assert.ok(
    /任务中心加载失败/.test(page),
    '错误态必须有明确文案'
  );
  // 重试按钮：onClick 里必须真的调 refetch（不是空 onClick）
  assert.ok(
    /onClick=\{\(\)\s*=>\s*\{[\s\S]{0,120}refetch\(\)/.test(page),
    '错误态必须提供可点的重试（真的调 refetch）'
  );
});

test('①d 局部刷新不打断列表（isFetching 只做弱提示）', () => {
  const list = read(LIST);
  assert.ok(
    /isFetching\s*\?\s*'\s*·\s*正在刷新'/.test(list),
    '刷新中应在表头给弱提示（· 正在刷新），而不是替换掉整个列表'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 空态明确（卡面要求「当前没有运行中的任务」）
// ─────────────────────────────────────────────────────────────────────────────

test('⑤a 空态有明确文案（不是空白表格）', () => {
  const list = read(LIST);
  assert.ok(
    /当前筛选下没有任务/.test(list),
    '空态必须有明确文案'
  );
  assert.ok(
    /换个时间窗口或状态试试/.test(list),
    '空态应给下一步指引（不是干巴巴一句「无数据」）'
  );
});

test('⑤b 空态两态分开（产品裁决：筛空 ≠ 真·无任务，不许混用）', () => {
  const list = read(LIST);
  // 产品裁决①：两态各自有专属文案。
  //  - 筛空（有筛选条件）→「当前筛选下没有任务」+ 指引放宽；
  //  - 真·无任务（无筛选条件）→「当前没有运行中的任务」+ 系统空闲说明。
  //  两态都钉成断言；缺任一 = 谎报（把「真没任务」说成「你筛空了」或反之）。
  assert.ok(
    /当前筛选下没有任务/.test(list),
    '筛空态（有筛选条件）必须有专属文案「当前筛选下没有任务」'
  );
  assert.ok(
    /当前没有运行中的任务/.test(list),
    '真·无任务态（无筛选条件）必须有专属文案「当前没有运行中的任务」'
  );
  // 两态判据：hasActiveFilters 必须存在且被消费（否则两态无从区分）。
  assert.ok(
    /hasActiveFilters\s*\?/.test(list),
    '空态两态必须由 hasActiveFilters 区分（缺失 = 两态混用）'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 附：把「没覆盖」也钉成断言（防后人误以为已覆盖）
// ─────────────────────────────────────────────────────────────────────────────

test('②③④ 未覆盖：E3 WS 推送 / 延迟注入 / 3s 降级文案在任务中心均不存在', () => {
  const hooks = read(HOOKS);
  const page = read(PAGE);

  // ② 每批 append：需要 WS 事件 + batch_seq —— 现在零 WS。
  assert.ok(
    !/WebSocket|realtime|batch_seq/.test(hooks),
    '任务中心 hooks 不应出现 WS/realtime/batch_seq（E3 后端未落地；若出现了说明有未接线的死代码）'
  );

  // ③ 人为延迟注入：需要 delay/sleep 控制点。
  assert.ok(
    !/delay|setTimeout|sleep\(/.test(hooks),
    'hooks 无延迟注入点 ⇒ ③「人为 5s 延迟」无法在前端单测里构造'
  );

  // ④ 「仍在后台执行」文案：任务中心页面/组件里没有。
  for (const f of [PAGE, LIST, HOOKS]) {
    assert.ok(
      !read(f).includes('仍在后台执行'),
      `${f} 不应出现「仍在后台执行」（任务中心当前无此文案）`
    );
  }
  // ↑ 这条是**反向断言**：它证明「这三条没被覆盖」，而不是「覆盖了」。
  // 详见 docs/evidence 里的 BLOCKER 报告。
});
