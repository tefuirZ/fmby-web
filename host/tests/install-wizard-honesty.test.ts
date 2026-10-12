import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * fe01：安装向导的**能力契约**断言。
 *
 * ★本文件被后续卡改写过一次，这里记录清楚以免后人误读：
 *   · 裁决 D（诚实化）时：本页只消费 status + probe ⇒ 断言「必须显式列出
 *     做不到的事 / 探活不得声称写入配置」。
 *   · 裁决 E（补齐）后：本页**已能** apply（落配置+bootstrap+建管理员+自动登录）
 *     与 complete（落锁）⇒ 上述 4 条断言的**前提消失**，按新能力改写为
 *     「能力完整性 + 危险操作确认」。不是放宽，是跟随真值。
 *
 * ★诚实说明（不假装是浏览器测试）：本仓无 jsdom / testing-library，引入属新依赖
 *   （ponytail 纪律）。故此处断言的是**源码/文案契约**——真实行为已在安装模式
 *   进程上端到端实证（status→probe→apply→complete，见 PR 正文 §三）。
 */

const ROOT = new URL('../../', import.meta.url).pathname; // host/tests/ → 仓根

function read(rel: string): string {
  return readFileSync(`${ROOT}${rel}`, 'utf8');
}

/**
 * 去掉注释，避免本文件自己的说明文字造成自指误命中。
 *
 * ★只剥「整行都是注释」的行（行首 `//`）与**行首起始**的块注释块，
 *   不做跨行通配剥除 —— 源文件里出现块注释结束标记之类的字符会让通配
 *   正则把中间的真实代码一起吞掉（实测：整文件被剥掉 27%，连
 *   `status.refetch()` 都丢了 ⇒ 断言假红）。
 */
function rendered(rel: string): string {
  const lines = read(rel).split('\n');
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (inBlock) {
      if (t.startsWith('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true;
      continue;
    }
    if (t.startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

const INSTALL_PAGE = 'host/src/pages/install/InstallPage.tsx';
const AUTH_API = 'shared/src/contracts/auth/api.ts';

test('① 标题须说明这是「安装向导」（不再是 D 阶段那个只能探活的检查页）', () => {
  const src = rendered(INSTALL_PAGE);
  assert.equal(/安装向导/.test(src), true, '补齐后标题应写明是安装向导');
  // D 阶段的旧标题（暗示只探活）不得残留。
  assert.equal(
    /安装状态检查\s*·\s*数据库连接探活/.test(src),
    false,
    '不得再使用 D 阶段的「安装状态检查 · 数据库连接探活」标题',
  );
});

test('② 三组选择齐备：数据库 / 缓存 / 管理员（apply 契约要求一次收全）', () => {
  const src = rendered(INSTALL_PAGE);
  for (const kw of ['数据库', '缓存', '管理员']) {
    assert.equal(src.includes(kw), true, `向导应包含「${kw}」分组`);
  }
});

test('③ 探活仍须标注「只探活，不写配置」（探活本身确实不落盘）', () => {
  const src = rendered(INSTALL_PAGE);
  assert.equal(
    /只探活/.test(src),
    true,
    '探活按钮文案须说明只探活（后端 probe 确实不写配置）',
  );
});

test('④ 完成后须说明会落锁并需重启（complete 语义）', () => {
  const src = rendered(INSTALL_PAGE);
  assert.equal(
    /fmby-install\.lock|重启/.test(src),
    true,
    '完成步骤须说明落 fmby-install.lock 且重启后由主应用接管',
  );
});

test('⑤ complete 必须走精确确认串（防误触，后端强校验）', () => {
  const src = rendered(INSTALL_PAGE);
  // 前端必须有「输入确认串才启用完成按钮」的闸门
  assert.equal(
    /completeConfirm\s*!==\s*INSTALL_COMPLETE_CONFIRM_ACTION/.test(src),
    true,
    'complete 按钮必须校验输入 === INSTALL_COMPLETE_CONFIRM_ACTION（防误触）',
  );
});

test('⑥ 状态读取以后端 state 为准，缺失时才按旗标推导', () => {
  const src = rendered(INSTALL_PAGE);
  assert.equal(/status\?\.state/.test(src), true, '必须优先读后端 status.state');
  assert.equal(
    /status\?\.completed/.test(src) && /status\?\.database_configured/.test(src),
    true,
    'state 缺失时才回退到 completed / database_configured 旗标推导',
  );
});

test('⑦ apply 后必须重拉 status（否则页面停在旧 state）', () => {
  const src = rendered(INSTALL_PAGE);
  assert.equal(
    /status\.refetch\(\)/.test(src),
    true,
    'apply/complete 成功后必须 refetch status（实测：不重拉会仍显示 needs_database）',
  );
});

test('⑧ 契约层安装端点 = status + probe/db + probe/redis + apply + complete', () => {
  const api = read(AUTH_API);
  const paths = [...new Set([...api.matchAll(/'(\/api\/install[^']*)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(
    paths,
    [
      '/api/install/apply',
      '/api/install/complete',
      '/api/install/probe/database',
      '/api/install/probe/redis',
      '/api/install/status',
    ],
    '契约层应正好是 V2 的 5 条安装端点（新增/删除须同步更新本断言）',
  );
});

test('⑨ 不得再发 V1 的四步端点（V2 后端没有，发必 404）', () => {
  const api = read(AUTH_API);
  for (const legacy of [
    '/api/install/database/initialize',
    '/api/install/config',
    '/api/install/setup',
    '/api/install/site-settings',
    '/api/install/dependencies/install',
  ]) {
    assert.equal(api.includes(legacy), false, `不得出现 V1 端点 ${legacy}`);
  }
});
