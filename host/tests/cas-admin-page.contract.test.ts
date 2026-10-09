// fmby-web#8：CAS 编排页 UI 契约（RED → GREEN）。
// 运行：node --import ./tests/register-aliases.mjs --test tests/*.test.ts
//
// 判据对应卡面目标：
// - 目标 1「CAS 编排页（多盘扇出配置/触发/状态）」⇒ 盘配置表 + 保存 + 扇出查询
// - 目标 2「扇出状态与徽章展示」⇒ 徽章组件
//
// 三条 fail-closed 纪律（承契约层，不在本层放宽）：
// 1. 端口未装配（后端 fail-closed 500 / not_implemented）⇒ 显示「未启用」，
//    **不得**渲染成「0 个盘 / 无扇出记录」这类看似正常的空态；
// 2. `copy_state` 是后端开放字符串 ⇒ 徽章对**未知值显式标注未知**，不得默认当成「已复制」；
// 3. `size_bytes` / `last_verified_at` 为 null ⇒ 显示「未知 / 未核验」，不得显示 0 / 1970 年。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// ④⑤ 走**行为断言**（直接 import 纯函数），不靠读源码字符串 ——
// 否则「把未知状态默认成已复制」这种撒谎变异也能恒绿（同 F-27 家族）。
import {
  formatSize,
  formatVerifiedAt,
  resolveCopyStateLabel,
  resolveCopyStateTone,
  KNOWN_COPY_STATES,
} from '../src/pages/manage/cas/formatCasDrive';
import {
  isDriveDirty,
  parsePriorityInput,
} from '../src/pages/manage/cas/driveConfigEditing';
import { isCasAdminUnwired } from '../../shared/src/contracts/manage/casAdmin/api';
import type { CasDriveConfig } from '../../shared/src/contracts/manage/casAdmin/types';

const read = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), 'utf-8');

const PAGE = '../../host/src/pages/manage/ManageCasPage.tsx';
const API = '../../shared/src/contracts/manage/casAdmin/api.ts';
const BADGE = '../../host/src/pages/manage/cas/CasCopyStateBadge.tsx';

test('① 编排页存在且注册进 manage 路由', () => {
  assert.ok(read(PAGE).length > 0, '编排页须存在');
  const router = read('../../host/src/app/router/index.tsx');
  // ★不只是「文件里出现过这个名字」——必须真的作为 Component 被返回，
  //    否则 import 了却返回 () => null 就是死代码（变异 M7）。
  assert.ok(
    /const\s*{\s*ManageCasPage\s*}\s*=\s*await\s*import\([^)]*ManageCasPage[^)]*\);\s*\n\s*return\s*{\s*Component:\s*ManageCasPage\s*}/.test(router),
    '须在 lazy 路由里真正 return { Component: ManageCasPage }（不是仅 import）',
  );
  assert.ok(/path:\s*['"]cas['"]/.test(router), '须有 /manage/…/cas 路由路径');
});

test('② 页面走 queryKeys.cas.*（不得内联字符串键 —— F-27 同族缺陷）', () => {
  const page = read(PAGE);
  assert.ok(page.includes('queryKeys.manage.cas'), '须用 queryKeys.manage.cas.*');
  assert.ok(
    !/queryKey:\s*\[\s*['"]manage['"]/.test(page),
    '不得内联 queryKey 数组（F-27：invalidate 永远打不中）',
  );
});

test('③ 端口未装配走 fail-closed，不渲染成正常空态', () => {
  const page = read(PAGE);
  // ★必须用 **CAS 专用**判定（能认 503），而非通用 isServiceUnwiredError（只认 500/501）。
  //   后端 admin_cas.rs 明确未装配返 503 dependency_unavailable，
  //   用通用判定会让本卡最核心的 fail-closed 在真实后端下失效。
  assert.ok(
    page.includes('isCasAdminUnwired'),
    '须用 isCasAdminUnwired 识别端口未装配（isServiceUnwiredError 不认 503，是错的）',
  );
  assert.ok(
    !page.includes('isServiceUnwiredError'),
    '不得用只认 500/501 的 isServiceUnwiredError（后端未装配返 503，会漏判）',
  );
  assert.ok(/未启用|服务未装配|不可用/.test(page), '须有明确的「未启用」文案');
  // ★结构判据：fail-closed 分支必须真的「捕获并返回 null」，
  //    不能只是 import 了函数却没有把错误转成「未启用」状态
  //    （变异：把 isServiceUnwiredError(err) 判断换成 false ⇒ query 变成真错误态，
  //    但仍显示 loading/error，而不会显示「未启用」）。
  assert.ok(
    /catch\s*\(\s*\w+\s*\)\s*{[^}]*isCasAdminUnwired\(\s*\w+\s*\)\s*\)?\s*\n?\s*return\s+null/.test(page),
    '须在 catch 里把端口未装配错误转成 return null（驱动「未启用」分支）',
  );
  // 「未启用」分支必须真的渲染提示，而不是只定义一个永不使用的变量。
  assert.ok(
    /unwired\s*\?[^:]*:\s*\(/.test(page) && page.includes('CAS 编排服务未启用'),
    '须由 unwired 条件驱动「CAS 编排服务未启用」提示渲染',
  );
});

test('④ 未知 copy_state 不得被当成「已复制」（行为断言）', () => {
  const src = read(BADGE);
  // 源码层：不得把未知状态兜成 present（守卫提醒）。
  assert.ok(
    !/copyState\s*\|\|\s*['"]present['"]/.test(src),
    '不得用 || "present" 把未知状态默认成已复制',
  );
  // 行为层：真正决定「徽章会不会撒谎」的是 resolveCopyStateLabel，
  // 它必须是纯函数且可被直接验证（未知值 ⇒ 未知文案，绝不返回「已复制」）。
  assert.equal(resolveCopyStateLabel('present'), '已复制');
  assert.notEqual(
    resolveCopyStateLabel('weird-new-backend-state'),
    '已复制',
    '后端新增未知状态时绝不能显示「已复制」',
  );
  assert.equal(resolveCopyStateLabel('weird-new-backend-state'), '状态未知');
  assert.equal(resolveCopyStateLabel(''), '状态未知', '空状态也是未知，不得谎称已复制');
  // 色调同样不能撒谎：未知态若染成 success，用户会当成已复制。
  assert.equal(resolveCopyStateTone('weird-new-backend-state'), 'neutral', '未知态色调须 neutral');
  assert.notEqual(
    resolveCopyStateTone('weird-new-backend-state'),
    'success',
    '未知态绝不能染成 success（与「已复制」同色）',
  );
  assert.equal(resolveCopyStateTone('present'), 'success');
  assert.equal(resolveCopyStateTone('failed'), 'danger');
});

test('④b copy_state 取值集合与后端 CopyState 枚举**逐一对齐**（防凭空发明状态）', () => {
  // 后端权威：crates/fmby-v2-domain/src/cas.rs:64 `enum CopyState { Pending, Present, Failed, Tombstoned }`
  // wire 由 crates/fmby-v2-bridges/src/bridges/cas_admin.rs:95 `d.copy_state.as_str()` 产生，
  // 故 wire 上的取值集合**封闭**为这四个：
  //   pending / present / failed / tombstoned
  // 这条锁的意义：前端曾凭空发明 `copying` / `missing` 两个**后端不存在**的状态，
  // 同时**漏掉**真实存在的 `tombstoned` ⇒ 真实的「上游已删/墓碑化」会被显示成
  // 「状态未知」，运维据此会误判为「数据丢了、需要重传」。
  for (const state of ['pending', 'present', 'failed', 'tombstoned']) {
    assert.notEqual(
      resolveCopyStateLabel(state),
      '状态未知',
      `后端真实状态 ${state} 不得被显示为「状态未知」（说明前端漏了这个取值）`,
    );
  }
  // 真实语义对位（取自 bridges/cas_admin.rs:40-41 的口径注释）：
  //   present   = 盘上确认存在      ⇒ reconciled
  //   failed    = 实体丢失（差异）  ⇒ danger
  //   tombstoned= 上游已删 / 墓碑化 ⇒ danger（不是 unknown！）
  assert.equal(resolveCopyStateLabel('tombstoned'), '上游已删');
  assert.equal(resolveCopyStateTone('tombstoned'), 'danger');
  assert.equal(resolveCopyStateLabel('failed'), '实体丢失');
  assert.equal(resolveCopyStateLabel('pending'), '待落位');
  assert.equal(resolveCopyStateLabel('present'), '已复制');
});

test('④c 前端不得凭空发明后端不存在的 copy_state（键集合封闭）', () => {
  // 变异 M10（凭空加 `copying`）曾**存活**：④b 只断言「四个真实值都要认识」，
  // 多出来的幽灵键不会让任何断言变红。故改为**集合级**断言：
  // 前端键集合必须与后端枚举**精确相等**，不多不少。
  assert.deepEqual(
    [...KNOWN_COPY_STATES].sort(),
    ['failed', 'pending', 'present', 'tombstoned'],
    '前端 copy_state 键集合必须与后端 CopyState 枚举精确相等（不多不少）',
  );
  // 显式点名曾被凭空发明的两个值，防止它们再回来
  assert.ok(!KNOWN_COPY_STATES.includes('copying'), 'copying 后端不存在，不得发明');
  assert.ok(!KNOWN_COPY_STATES.includes('missing'), 'missing 后端不存在，不得发明');
});

test('⑤ null 字段渲染为「未知 / 未核验」，不渲染 0 或 1970 年（行为断言）', () => {
  // 行为断言：null ⇒ 明确文案；真值 ⇒ 正常格式化。
  assert.equal(formatSize(null), '大小未知', 'sizeBytes=null 不得显示 0 字节');
  assert.equal(formatSize(0), '0 B', '真的是 0 字节时如实显示 0 B');
  assert.equal(formatSize(-1), '大小未知', '负值非法 ⇒ 未知，不得显示 0');
  assert.equal(formatSize(1536), '1.5 KB', '正常值须格式化');

  assert.equal(formatVerifiedAt(null), '未核验', 'null 不得显示 1970 年');
  assert.equal(formatVerifiedAt(0), '未核验', '0 也不是有效核验时间');
  assert.notEqual(formatVerifiedAt(1), '未核验', '真时间戳不得被误判为未核验');
  assert.equal(
    formatVerifiedAt(1).includes('1970'),
    true,
    '注意：ms=1 本身就是 1970 年，格式化后应含 1970（这是真事实，非伪造）',
  );
});

test('⑥ 保存走 PUT（与契约层一致，不在前端另发明方法）', () => {
  const page = read(PAGE);
  assert.ok(page.includes('upsertDriveConfig'), '保存须走契约层 upsertDriveConfig');
  assert.ok(
    !/httpClient\.(post|patch)/.test(page),
    '页面层不得直接发 http 请求（须经契约层）',
  );
});
test('⑦ 盘配置必须**真可编辑**（不得有「保存原对象」的假保存按钮）', () => {
  const page = read(PAGE);
  // 卡面目标 1 是「多盘扇出**配置**」。若表内无可编辑控件，
  // 「保存」按钮传的仍是原 config ⇒ PUT 回去一模一样 ⇒ 却是无操作，
  // 却给用户回「盘配置已保存」—— 那是在**撒谎**。
  assert.ok(
    /<input[\s\S]*?type=["']checkbox["'][\s\S]*?checked=\{/.test(page),
    'enabled 列须有受控 checkbox（纳入扇出开关）',
  );
  assert.ok(
    /<input[\s\S]*?type=["']number["'][\s\S]*?value=\{/.test(page),
    'priority 列须有受控 number 输入（可改优先级）',
  );
  // 保存时必须回传**编辑后**的值，而不是原对象
  // 保存须回传**草稿副本**（展开运算符），而不是把原 config 对象原样 PUT 回去。
  assert.ok(
    /onSave\(\{\s*\.\.\.draft\s*\}\)/.test(page),
    '保存须回传编辑后的草稿副本（不是把原 config 原样 PUT 回去）',
  );
  assert.ok(
    !/onSave\(config\)/.test(page),
    '不得把原始 config 直接 PUT 回去（那是无操作）',
  );
  // 「保存」按钮必须受 dirty 门控：无改动时禁用，不允许发出无意义的 PUT。
  assert.ok(
    /disabled=\{saving\s*\|\|\s*!dirty\}/.test(page),
    '保存按钮须受 dirty 门控（无改动时禁用，避免发出无意义 PUT）',
  );
});

test('⑧ 真实改动才提示成功（no-op 不得显示「已保存」）', () => {
  const page = read(PAGE);
  assert.ok(
    /setBanner\(['"]盘配置已保存['"]\)/.test(page),
    '成功文案须存在',
  );
  // 无操作时不得提示成功：须有 dirty 判定
  assert.ok(
    /dirty|isDirty|changed/.test(page),
    '须有 dirty 判定，无改动时不得提示「已保存」',
  );
});

test('⑨ 编辑态逻辑（行为断言：dirty / 优先级解析）', () => {
  const base: CasDriveConfig = {
    providerType: 'yun139',
    driveRef: 'drive-a',
    enabled: true,
    priority: 10,
  };

  // dirty：无草稿 ⇒ 无改动（M15 变异：恒 false 会在「有真实改动」这条被抓）
  assert.equal(isDriveDirty(base, undefined, null), false, '无草稿 ⇒ 不脏');

  // 有真实改动 ⇒ 脏
  assert.equal(
    isDriveDirty(base, { ...base, enabled: false }, null),
    true,
    '改了 enabled 必须判脏（否则保存按钮永远禁用，功能不可用）',
  );
  assert.equal(
    isDriveDirty(base, { ...base, priority: 20 }, null),
    true,
    '改了 priority 必须判脏',
  );
  // 草稿与原值相同 ⇒ 不脏（M13 变异：dirty 恒 true 会在此被抓）
  assert.equal(
    isDriveDirty(base, { ...base }, null),
    false,
    '草稿与原值相同 ⇒ 不脏（否则会发无意义的 PUT）',
  );
  // M14 变异：刚保存过的行，草稿须作废
  assert.equal(
    isDriveDirty(base, { ...base, enabled: false }, 'yun139:drive-a'),
    false,
    '该行刚保存成功 ⇒ 草稿作废，不得仍判脏',
  );

  // 优先级解析：非法输入回退原值，**绝不发 NaN**（M16 变异）
  assert.equal(parsePriorityInput('', 10), 10, '空串 ⇒ 原值');
  assert.equal(parsePriorityInput('abc', 10), 10, '非数字 ⇒ 原值');
  assert.equal(parsePriorityInput('3', 10), 3, '合法数字照常解析');
  for (const bad of ['', 'abc', 'x1', '  ']) {
    const r = parsePriorityInput(bad, 7);
    assert.ok(!Number.isNaN(r), `非法输入 ${JSON.stringify(bad)} 不得产出 NaN`);
    assert.equal(r, 7, `非法输入 ${JSON.stringify(bad)} 须回退原值`);
  }
  // i32 边界（后端 dto/cas_admin.rs:27 priority: i32）
  assert.equal(parsePriorityInput('99999999999', 0), 2147483647, '超 i32 上限须夹取');
  assert.equal(parsePriorityInput('-99999999999', 0), -2147483648, '低于 i32 下限须夹取');
});

test('⑩ 未装配识别必须覆盖后端真实的 503 dependency_unavailable', () => {
  // 后端权威：fmby-v2-http/src/routes/admin_cas.rs:4,29-32,285-288
  //   「端口未装配 ⇒ fail-closed **503**（DependencyUnavailable）」，
  //   且显式说明 `http_status` 对 DependencyUnavailable 返 503（**非 500**）。
  // 前端 code 字面量：shared/src/errors/error.ts:23 'dependency_unavailable'。
  //
  // ★而本席此前用的 isServiceUnwiredError **只认 500/501**（peripherals/api.ts:345-359），
  //   对 503 一律返回 false ⇒ 页面会走「载入失败」分支而**不是**「服务未启用」
  //   ⇒ 卡面最核心的 fail-closed 语义在真实后端下**根本不生效**。
  const src = read(API);
  assert.ok(
    /dependency_unavailable/.test(src) || /503/.test(src),
    'CAS 契约层必须识别 503 / dependency_unavailable（端口未装配的真实返回）',
  );
  assert.ok(
    /isCasAdminUnwired/.test(src),
    '须提供 CAS 专用的未装配判定（复用会漏 503 的 isServiceUnwiredError 是错的）',
  );
});

test('⑪ fail-closed 判定对 500/501/503 三态都成立，且不误吃 404', () => {
  const mk = (code: string, status: number) => ({
    code,
    message: 'x',
    retryable: false,
    status,
  });
  // 后端真实三态：500 internal / 501 not_implemented / 503 dependency_unavailable
  // ★只给 code、**不带 status** 的形态也要覆盖：wire 客户端可能在映射层丢掉 status，
  //   只靠 status 分支兜底会让这些形态漏判（变异 M19 即由此存活）。
  assert.equal(
    isCasAdminUnwired({ code: 'dependency_unavailable', message: 'x', retryable: true }),
    true,
    '只凭 code（无 status）也须认出 503 dependency_unavailable',
  );
  assert.equal(isCasAdminUnwired(mk('dependency_unavailable', 503)), true, '503 端口未装配');
  assert.equal(isCasAdminUnwired(mk('internal', 500)), true, '500 internal');
  assert.equal(isCasAdminUnwired(mk('not_implemented', 501)), true, '501 未实现');
  // 绝不能把业务 404 当成「未装配」⇒ 否则路由写错会被伪装成「服务未启用」
  assert.equal(isCasAdminUnwired(mk('not_found', 404)), false, '404 是路由错误，不得算未装配');
  assert.equal(isCasAdminUnwired(new Error('boom')), false, '普通异常不得算未装配');
  assert.equal(isCasAdminUnwired(null), false, 'null 不得算未装配');
});
