import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * fe01（裁决 D）：安装向导**文案诚实化**的契约断言。
 *
 * 背景：/install 页此前标题为「首次安装 · 配置数据库」，但它只消费了
 * `/api/install/status` 与 `/api/install/probe/database` 两条端点
 * （`shared/src/contracts/auth/api.ts:258,262`）——**只能看状态与探活，
 * 不能完成安装**（建管理员 / bootstrap / 落配置 / complete 均未接）。
 * 文案与能力不符 ⇒ 用户会以为走完这页就装好了。
 *
 * ★诚实说明（不假装是浏览器测试）：本仓**无** jsdom / testing-library，引入属
 *   新依赖（ponytail 纪律）。故此处断言的是**源码/文案契约**——真正的行为验证
 *   （页面渲染、按钮 disabled 态）需在浏览器上人工或 CI 复跑，见 handoff 跳过项。
 */

const ROOT = new URL('../../', import.meta.url).pathname; // host/tests/ → 仓根

function read(rel: string): string {
  return readFileSync(`${ROOT}${rel}`, 'utf8');
}

const INSTALL_PAGE = 'host/src/pages/install/InstallPage.tsx';
const AUTH_API = 'shared/src/contracts/auth/api.ts';

test('① 标题不得再声称本页可完成安装（原误导文案）', () => {
  const src = read(INSTALL_PAGE);
  // 只取**渲染内容**（去掉注释），否则本文件自己的注释会造成自指误命中。
  const rendered = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // 原副标题形如「首次安装 · 配置数据库」，暗示走完本页即完成安装。
  assert.equal(
    /首次安装\s*·\s*配置数据库/.test(rendered),
    false,
    '渲染文案不得再出现「首次安装 · 配置数据库」（本页只能探活，不能完成安装）',
  );
  // 同时保证新标题确实说明了「只探活」。
  assert.equal(
    /探活/.test(rendered),
    true,
    '新标题必须说明本页是「状态检查 + 探活」',
  );
});

test('② 必须显式列出本页**做不到**的四件事（如实标注能力边界）', () => {
  const src = read(INSTALL_PAGE);
  for (const kw of ['写入数据库配置', '管理员账号', 'Redis', '安装完成']) {
    assert.equal(src.includes(kw), true, `能力说明条应显式提到「${kw}」属本页做不到的事`);
  }
});

test('③ 探活结果不得声称已写入配置（成功文案须带「不会写入任何配置」）', () => {
  const src = read(INSTALL_PAGE);
  assert.equal(
    /不会写入任何配置/.test(src),
    true,
    '探活成功提示必须说明「仅表示地址可用，不会写入配置」——否则是假成功暗示',
  );
});

test('④ 提交按钮文案须说明「只探活，不写配置」', () => {
  const src = read(INSTALL_PAGE);
  assert.equal(
    /只探活，不写配置/.test(src),
    true,
    '按钮文案必须写明只探活（原「检查数据库连接」未澄清副作用）',
  );
});

test('⑤ 安装已完成（state=completed）时不得再允许探活', () => {
  const src = read(INSTALL_PAGE);
  // canProbe 必须以 state !== 'completed' 为条件之一
  assert.equal(
    /canProbe\s*=\s*[^;]*state\s*!==\s*'completed'/.test(src),
    true,
    'completed 态必须禁用探活（后端已下线除 status 外的安装路由）',
  );
});

test('⑥ 状态读取必须以后端 state 为准，缺失时才按旗标推导（不可只推导）', () => {
  const src = read(INSTALL_PAGE);
  assert.equal(
    /status\?\.state/.test(src),
    true,
    '必须优先读后端 status.state（V2 install_flow.rs 返回的四态）',
  );
  assert.equal(
    /status\?\.completed/.test(src) && /status\?\.database_configured/.test(src),
    true,
    'state 缺失时才回退到 completed / database_configured 旗标推导',
  );
});

test('⑧ 探活被禁用时必须给出原因（不得只留一个点不动的按钮）', () => {
  const src = read(INSTALL_PAGE);
  assert.equal(
    /probeBlockedReason/.test(src),
    true,
    'can_probe=false / completed 时必须输出原因文案（实测：已安装实例下按钮恒 disabled）',
  );
});

test('⑦ 契约层只接了 status + probe 两条安装端点（不得臆造更多）', () => {
  const api = read(AUTH_API);
  const installPaths = [...api.matchAll(/'(\/api\/install[^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(installPaths)].sort(),
    ['/api/install/probe/database', '/api/install/status'],
    '契约层当前只应存在 status + probe 两条（新增端点须同步更新本断言）',
  );
});
