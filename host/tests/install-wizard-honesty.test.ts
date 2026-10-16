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

// ★rb01 I4：原本这两条合并成一条 OR（/fmby-install\.lock|重启/）⇒ 只要含 lock 就绿，
//   **放过了 C1**（当时缺的正是重启指引）。拆开后两条都得成立。
test('④a 完成段文案不得出现实现术语（SIMPLIFY-INSTALL-WIZARD：用户骂的"花里胡哨"）', () => {
  // 用户裁定文案砍短、删术语；后端契约亦不得说重启。原「落 fmby-install.lock」等已清。
  const src = renderedInstall('');
  for (const term of ['fmby-install.lock', '落盘', '原子', '哈希', '连接池', '装配', '热加载']) {
    assert.equal(src.includes(term), false, `完成段文案不得含术语「${term}」`);
  }
});

test('④b 向导文案不得出现"重启"（后端契约 complete→restart_required:false，前端不得说重启）', () => {
  // install_flow/mod.rs:753-761 complete 返 restart_required:false，后端自注"前端不得说重启"。
  const src = renderedInstall('');
  assert.equal(/重启/.test(src), false, '向导文案不得出现"重启"字样（与后端 restart_required:false 契约一致）');
});

test('⑤ complete 无用户确认门（SIMPLIFY-INSTALL-WIZARD：用户裁定"无需确认"）', () => {
  // 用户裁定删掉「输入 complete-install 以确认」门；confirm_action 仍由前端程序化发送（后端强校验），
  // 但不再要求用户手输确认串。完成面板不得再有 confirmValue !== confirmAction 闸门。
  const panel = renderedInstall(''); // renderedAll：含 InstallCompletionPanel 源码
  assert.equal(
    /confirmValue\s*!==\s*confirmAction/.test(panel),
    false,
    '完成面板不得再有「输入确认串才启用」闸门（用户裁定无需确认）',
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

// ★按 rb01 I3 同类修正：原名含「不得落 URL」但只查持久化/日志，URL 那条没查。
//   理由与处置见 install-pg-form.test.ts 用例 ⑩ 的注释（apply 契约本身要求提交
//   整串 postgres:// 连接串，那不是泄漏；不写永不转红的假断言）。
test('⑬ 口令明文不得落持久化存储 / 日志', () => {
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

/* ── rb01 C1 防回归（2026-10-14 返工）──────────────────────────────
 * 后端 complete 返回 restart_required（契约已 pin 于 install-flow-wire.test.ts ④），
 * 且安装模式进程只挂 install_flow::router + /health（不挂主应用路由）
 * ⇒ 「热加载 / 不需重启」**只能**指 apply 三步之间，落锁后必须重启。
 * 此前两组件无条件写「不需重启」，且完成态 UI 上 restart_required 出现 0 次。
 */

test('⑯ 完成态不得向用户展示 restart_required / 重启（后端返 false，说了反困惑）', () => {
  // 后端 complete → restart_required:false ⇒ 前端完成态不展示该字段、不说重启（用户裁定简单点）。
  const page = rendered(INSTALL_PAGE);
  assert.equal(/restart_required/.test(page), false, '完成态 UI 不得展示 restart_required（false 时说反困惑）');
  assert.equal(/重启/.test(page), false, '完成态 UI 不得出现"重启"');
});

test('⑰ 提到「热加载」的组件必须同时限定「落锁后须重启」', () => {
  for (const rel of [
    INSTALL_PAGE,
    'host/src/pages/install/InstallProgressScreen.tsx',
    'host/src/pages/install/ServerConfigSummary.tsx',
  ]) {
    const src = rendered(rel);
    if (/热加载/.test(src)) {
      assert.match(
        src,
        /落锁后/,
        `${rel} 提到热加载 ⇒ 必须同时写明「落锁后须重启」，不得无条件声称不需重启`,
      );
    }
  }
});
