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
const ADMIN_FIELDSET = 'host/src/pages/install/AdminFieldset.tsx';
const COMPLETION_PANEL = 'host/src/pages/install/InstallCompletionPanel.tsx';
const DATABASE_FIELDSET = 'host/src/pages/install/DatabaseCacheFieldset.tsx';
const SERVER_SUMMARY = 'host/src/pages/install/ServerConfigSummary.tsx';
const WIZARD_STEPS = 'host/src/pages/install/installWizard.ts';
const AUTH_API = 'shared/src/contracts/auth/api.ts';

/**
 * 安装向导现已拆为多个文件（#640）：
 *   InstallPage.tsx          —— 编排（status / probe / apply / complete + 翻页）
 *   DatabaseCacheFieldset.tsx —— ① 数据库 / 缓存（PG 拆分表单 + 连接测试）
 *   ServerConfigSummary.tsx   —— ② 服务器配置（生效值摘要）
 *   AdminFieldset.tsx         —— ③ 管理员（强度 / 二次确认 / 一键生成 / 显隐）
 *   InstallCompletionPanel.tsx —— ④ 完成（凭据回显 + 落锁防误触）
 *   installWizard.ts           —— 三页门控纯函数
 * ⇒ 「页面应当包含 X」类断言须看**拼接后的整体**，否则把代码拆开会误报红。
 */
const ALL_INSTALL_FILES = [
  INSTALL_PAGE,
  DATABASE_FIELDSET,
  SERVER_SUMMARY,
  ADMIN_FIELDSET,
  COMPLETION_PANEL,
  WIZARD_STEPS,
];

function renderedAll(): string {
  return ALL_INSTALL_FILES.map(rendered).join('\n');
}

/**
 * 安装向导现已拆为三个文件（#640）：
 *   InstallPage.tsx        —— 编排（status / probe / apply / complete）
 *   AdminFieldset.tsx      —— ③ 管理员区（强度 / 二次确认 / 一键生成 / 显隐）
 *   InstallCompletionPanel.tsx —— ④ 完成区（凭据回显 + 落锁防误触）
 * 故除编排页外，断言需同时看三个文件的**拼接**（拼接后再剥注释）。
 */
/**
 * 向后兼容：旧断言里的 `renderedInstall('')` = 三文件拼接（#640 拆分前）。
 * 现在统一指向全量拼接。
 */
function renderedInstall(_legacy: string): string {
  return renderedAll();
}

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
  // #640 拆页后三段内容分属三个组件 ⇒ 看拼接整体（实质不变：三组都必须在页上出现）。
  const src = renderedAll();
  for (const kw of ['数据库', '缓存', '管理员']) {
    assert.equal(src.includes(kw), true, `向导应包含「${kw}」分组`);
  }
});

test('③ 探活仍须标注「只探活，不写配置」（探活本身确实不落盘）', () => {
  const src = renderedAll();
  assert.equal(
    /只探活/.test(src),
    true,
    '探活按钮文案须说明只探活（后端 probe 确实不写配置）',
  );
});

test('④ 完成后须说明会落锁并需重启（complete 语义）', () => {
  const src = renderedInstall('');
  assert.equal(
    /fmby-install\.lock|重启/.test(src),
    true,
    '完成步骤须说明落 fmby-install.lock 且重启后由主应用接管',
  );
});

test('⑤ complete 必须走精确确认串（防误触，后端强校验）', () => {
  // 确认串的**比较**现在在完成面板里（完成区已从编排页抽出）。
  const src = renderedInstall('');
  // 前端必须有「输入确认串才启用完成按钮」的闸门
  assert.equal(
    /confirmValue\s*!==\s*confirmAction/.test(src),
    true,
    'complete 按钮必须校验输入 === 精确确认串（防误触）',
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

/* ────────────────────────────────────────────────────────────────
 * #640 管理员口令卡：以下为**源码/文案契约**断言，非浏览器行为测试。
 * 口令规则本体（强度/弱口令/确认/生成器）另有**纯函数实测**：
 *   host/tests/install-password-policy.test.ts（7 例，node:test 真跑）。
 * ──────────────────────────────────────────────────────────────── */

test('⑩ 管理员口令必须走已实测的策略函数，不得在组件里重写规则', () => {
  const admin = rendered(ADMIN_FIELDSET);
  for (const fn of ['assessPassword', 'confirmPasswordProblem', 'generateStrongPassword']) {
    assert.equal(admin.includes(fn), true, `管理员区应调用已实测的 ${fn}，不得重写规则`);
  }
});

test('⑪ 提交前 fail-closed：任一门控不过就不发 apply（不只是事后报错）', () => {
  const page = rendered(INSTALL_PAGE);
  // #640 三页化后，门控本体在 installWizard.stepProblem；编排页必须：
  //   (a) 提交前整体拦截（allDone = 每一页都 stepDone）；
  //   (b) 不过就 return，不发 apply；
  //   (c) 提交按钮同时禁用。
  assert.equal(
    /if\s*\(!allDone\)/.test(page) && /return;/.test(page),
    true,
    'apply 前必须先查整体门控并 return（后端不校强度，弱口令一旦 apply 就成可登录凭据）',
  );
  assert.equal(
    /disabled=\{anyPending\s*\|\|\s*!allDone\}/.test(page),
    true,
    '提交按钮必须在门控未过时禁用',
  );
  // 实质不能因为改名而变松：allDone 必须覆盖**每一页**，且管理员页的门控
  // 必须包含二次确认/强度（委托 passwordPolicy，不重写）。
  assert.equal(
    /WIZARD_STEPS\.every\(\(meta\)\s*=>\s*stepDone\(meta\.id,\s*values\)\)/.test(page),
    true,
    'allDone 必须是“全部页都达标”，不能只查当前页',
  );
  const wizard = rendered(WIZARD_STEPS);
  assert.equal(
    /confirmPasswordProblem\(values\.adminPassword,\s*values\.adminConfirm\)/.test(wizard),
    true,
    '管理员页门控须继续走已实测的 confirmPasswordProblem',
  );
});

test('⑫ 一键生成必须用密码学安全随机源，且不得用 Math.random()', () => {
  const policy = read('host/src/pages/install/passwordPolicy.ts');
  assert.equal(/crypto\.getRandomValues/.test(policy), true, '生成器须用 CSPRNG');
  for (const f of [ADMIN_FIELDSET, COMPLETION_PANEL, 'host/src/pages/install/passwordPolicy.ts']) {
    assert.equal(read(f).includes('Math.random'), false, `${f} 不得使用 Math.random() 生成口令`);
  }
});

test('⑬ 口令明文不得落 URL / 日志 / 持久化存储', () => {
  for (const f of [INSTALL_PAGE, ADMIN_FIELDSET, COMPLETION_PANEL]) {
    const src = read(f);
    for (const leak of ['localStorage', 'sessionStorage', 'console.log']) {
      assert.equal(src.includes(leak), false, `${f} 不得把明文口令写入 ${leak}`);
    }
  }
});

test('⑭ 完成页回显口令：默认隐藏 + 可显隐（裁定 ④）', () => {
  const panel = rendered(COMPLETION_PANEL);
  assert.equal(/type=\{visible\s*\?\s*'text'\s*:\s*'password'\}/.test(panel), true,
    '完成页口令框须在 text / password 间切换');
  assert.equal(/useState\(false\)/.test(panel), true,
    '显隐状态初值必须是 false（即默认隐藏）');
  assert.equal(/PasswordToggle/.test(panel), true, '须复用既有 PasswordToggle 而非自造控件');
});

test('⑮ 用户名不得加 ASCII-only 白名单（中文等 Unicode 必须可用）', () => {
  const admin = rendered(ADMIN_FIELDSET);
  assert.equal(/pattern=/.test(admin), false, '不得用 HTML pattern 限定 ASCII 用户名');
  assert.equal(/maxLength=/.test(admin), false, '不得加会截断 Unicode 的长度上限');
  assert.equal(
    /replace\(\s*\/\[\\x00-\\x7F\]/.test(admin) || /\[\^\\x00-\\x7F\]/.test(admin),
    false,
    '不得用正则过滤掉非 ASCII 字符',
  );
});
