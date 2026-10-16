// fmby-web#658 第 2 页：CAS 发布编排页 UI 契约（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 页面定位（选源内容 → 选目标盘 → 发起扇出 → 进度与失败原因）：
// 后端写面考古结论（照后端、不臆造）：
//   - 后端 CAS 管理面现有 4 端点全是读面 + 单盘配置写（GET/PUT drives、
//     GET fanout/{content_id}、GET reconcile）——**无「发起扇出」写端点**。
//   - 「扇出已存在内容的重试」= #671 写面 retryFanoutCopy（rb01 PR #678，503 unwired）。
//   - 「选源内容」= listCasContents（后端读面**已实现**：v2 `admin_cas.rs::cas_list_contents`）。
//     ⇒ `unwired:true` = **本实例**没给出数据（端口未装配 503 / 版本过旧 404），不是「端点没做」。
//   ⇒ 「发起扇出」核心写面后端**完全没有** ⇒ 本页 fixme（按钮禁用 + 显式提示待后端），
//     **不得**调用不存在的端点、**不得**伪造扇出成功。
//
// 纪律（承 #40 / cas-admin-page 契约层）：
//   1. 数据面不可用（本实例 CAS 端口未装配 / 路由 404）⇒ fail-closed 空态 + 显式提示，
//      **不造假数据**；
//   2. copy_state 是后端开放字符串 ⇒ 原样透出不折叠（复用 formatCasDrive 纯函数）；
//   3. 失败原因 reason_code/reason_detail 原样透出（#671），未知码显示原文不静默归「无」。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCopyStateLabel } from '../src/pages/manage/cas/formatCasDrive';
import { isCasAdminUnwired } from '../../shared/src/contracts/manage/casAdmin/api';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const PAGE = '../../host/src/pages/manage/CasPublishOrchestrationPage.tsx';

test('① 发布编排页存在且注册进 manage 路由', () => {
  assert.ok(read(PAGE).length > 0, '发布编排页须存在');
  const router = read('../../host/src/app/router/index.tsx');
  // ★必须真的作为 Component 被返回（不是仅 import ⇒ 死代码）。
  assert.ok(
    /const\s*{\s*CasPublishOrchestrationPage\s*}\s*=\s*await\s*import\([^)]*CasPublishOrchestrationPage[^)]*\);\s*\n\s*return\s*{\s*Component:\s*CasPublishOrchestrationPage\s*}/.test(router),
    '须在 lazy 路由里真正 return { Component: CasPublishOrchestrationPage }（不是仅 import）',
  );
  assert.ok(/path:\s*['"]cas\/publish['"]/.test(router), '须有 cas/publish 路由路径');
});

test('② 页面走 queryKeys.cas.*（不得内联字符串键 —— F-27 同族缺陷）', () => {
  const page = read(PAGE);
  assert.ok(page.includes('queryKeys.manage.cas'), '须用 queryKeys.manage.cas.*');
  assert.ok(
    !/queryKey:\s*\[\s*['"]manage['"]/.test(page),
    '不得内联 queryKey 数组（F-27：invalidate 永远打不中）',
  );
});

test('③ 选源内容走 listCasContents + 数据面不可用 fail-closed 空态（不造假数据）', () => {
  const page = read(PAGE);
  assert.ok(page.includes('listCasContents'), '选源内容须走 listCasContents');
  assert.ok(
    page.includes('unwired'),
    '须据 listCasContents 的 unwired 标记区分「数据面不可用」与「真空列表」',
  );
  // ★fail-closed：本实例取不到数据 ⇒ 显式提示「数据面不可用」，不渲染成「0 条内容」的假空态。
  // ★#78 文案更正：旧判据里的「尚未接线 / 等待后端」是**对后端的错误断言**（端点早已实现），
  //   所以判据同步换成如实表述；行为要求不变（仍须显式提示、仍须与真空分两态）。
  assert.ok(
    /数据面不可用|数据面在本实例不可用/.test(page),
    '数据面不可用须显式提示（不伪装成正常空列表，也不谎称「后端没做」）',
  );
});

test('④ 选目标盘走 listDriveConfigs + N 盘复选', () => {
  const page = read(PAGE);
  assert.ok(page.includes('listDriveConfigs'), '选目标盘须走 listDriveConfigs');
  // N 盘复选：受控 checkbox（多选）。
  assert.ok(
    /<input[\s\S]*?type=["']checkbox["'][\s\S]*?checked=\{/.test(page),
    '目标盘须有受控 checkbox（N 盘复选）',
  );
});

test('⑤ 发起扇出 fixme：后端无端点 ⇒ 按钮禁用 + 显式提示待后端，不调不存在端点', () => {
  const page = read(PAGE);
  // ★「发起扇出」写面后端没有（admin_cas.rs 无 POST fanout）⇒ 不得调不存在的端点。
  assert.ok(
    !/casAdminApi\.(startFanout|triggerFanout|createFanout|fanout\()/.test(page),
    '不得调用后端不存在的「发起扇出」端点（写面缺口，不臆造）',
  );
  // 发起扇出按钮必须禁用（未就绪），并显式提示待后端。
  assert.ok(
    /disabled/.test(page),
    '发起扇出按钮须禁用（后端写面未就绪）',
  );
  assert.ok(
    /待后端|后端未提供|发起扇出.*未|尚未接线/.test(page),
    '须显式提示「发起扇出」待后端接线（不伪造可用）',
  );
});

test('⑥ 进度与失败原因走 fanoutStatus + reason 透传 + retryFanoutCopy 重试', () => {
  const page = read(PAGE);
  assert.ok(page.includes('fanoutStatus'), '进度与失败原因须走 fanoutStatus(contentId)');
  assert.ok(page.includes('retryFanoutCopy'), '失败盘重试须走 retryFanoutCopy（#671 写面）');
  // 失败原因 reason_code/reason_detail 原样透出（#671），不折叠成布尔。
  assert.ok(
    /reasonCode|reasonDetail/.test(page),
    '失败原因 reason_code/reason_detail 须透出（#671）',
  );
});

test('⑦ 未知 copy_state 不得被当成「已复制」（行为断言，复用 formatCasDrive）', () => {
  // 发布编排页的盘副本徽章复用同一纯函数 ⇒ 行为约束同 #40/cas-admin-page。
  assert.equal(resolveCopyStateLabel('present'), '已复制');
  assert.notEqual(
    resolveCopyStateLabel('weird-new-backend-state'),
    '已复制',
    '后端新增未知状态时绝不能显示「已复制」',
  );
  assert.equal(resolveCopyStateLabel('tombstoned'), '上游已删');
  assert.equal(resolveCopyStateLabel('failed'), '实体丢失');
});

test('⑧ fail-closed 判定对 500/501/503 成立且不误吃 404（行为断言）', () => {
  const mk = (code: string, status: number) => ({
    code,
    message: 'x',
    retryable: false,
    status,
  });
  assert.equal(isCasAdminUnwired(mk('dependency_unavailable', 503)), true, '503 端口未装配');
  assert.equal(isCasAdminUnwired(mk('internal', 500)), true, '500 internal');
  assert.equal(isCasAdminUnwired(mk('not_implemented', 501)), true, '501 未实现');
  assert.equal(isCasAdminUnwired(mk('not_found', 404)), false, '404 是路由错误，不得算未装配');
});
