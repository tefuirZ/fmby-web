// fmby-web#658：对账区块**渲染态**的行为断言（空态 / 错误态 / 未装配态）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/manage-cas-reconcile-section.test.ts
//
// 为什么需要这份（上一版 6/6 只覆盖纯逻辑 `resolveReconcileView`，
//   没覆盖「区块该显示什么」）：
//   「服务未启用」被显示成「0 条报告」是本页**最危险的假空态**——运维会以为
//   「配好了但一条报告都没有」。同理，请求失败若被 count=0 掩盖成「暂无报告」，
//   故障就长期隐身。这两条必须能被 node:test 直接打红。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReconcileSectionState,
  type CasReconcileSectionState,
} from '../src/pages/manage/cas/reconcilePresentation';

test('① 未装配（unwired）⇒ unwired 档，**绝不**回落成 empty（防假空态）', () => {
  // ★核心不变量：即使 count=0、isPending=false、isError=false，
  //   只要 unwired 就必须判为 unwired（区块**完全不渲染**）。
  assert.equal(
    resolveReconcileSectionState({ unwired: true, count: 0 }),
    'unwired',
    '未装配不得显示成「0 条报告」——那是把「服务没启用」伪装成「没有数据」',
  );
  assert.equal(
    resolveReconcileSectionState({ unwired: true, isPending: false, isError: false, count: 5 }),
    'unwired',
    'unwired 优先级最高，压过其它所有输入',
  );
});

test('② 错误态 ⇒ error，且**不被 count=0 掩盖**成 empty', () => {
  assert.equal(
    resolveReconcileSectionState({ isError: true, count: 0 }),
    'error',
    '请求失败而列表为空时，必须是「载入失败」，不得显示「暂无报告」',
  );
  assert.equal(resolveReconcileSectionState({ isError: true, count: 3 }), 'error');
});

test('③ 空态 ⇒ empty（端口装配了但确实没有报告，与未启用区分）', () => {
  assert.equal(
    resolveReconcileSectionState({ unwired: false, isPending: false, isError: false, count: 0 }),
    'empty',
  );
  // 缺省入参（只给 count=0）也必须是 empty，不是 error/loading。
  assert.equal(resolveReconcileSectionState({ count: 0 }), 'empty');
});

test('④ loading 优先于 empty：首屏未就绪不得显示「暂无报告」', () => {
  assert.equal(
    resolveReconcileSectionState({ isPending: true, count: 0 }),
    'loading',
    '数据未到而 count=0 时，必须是 loading，不得提前判成空态',
  );
});

test('⑤ list 档：有数据且无错无 pending', () => {
  assert.equal(resolveReconcileSectionState({ count: 1 }), 'list');
  assert.equal(
    resolveReconcileSectionState({ unwired: false, isPending: false, isError: false, count: 12 }),
    'list',
  );
});

test('⑥ 五态互斥且完备：每个输入组合必落在五档之一', () => {
  const valid: CasReconcileSectionState[] = ['unwired', 'loading', 'error', 'empty', 'list'];
  for (const unwired of [true, false]) {
    for (const isPending of [true, false]) {
      for (const isError of [true, false]) {
        for (const count of [0, 1]) {
          const got = resolveReconcileSectionState({ unwired, isPending, isError, count });
          assert.ok(
            valid.includes(got),
            `组合 ${JSON.stringify({ unwired, isPending, isError, count })} 落在非法档 ${got}`,
          );
        }
      }
    }
  }
});
