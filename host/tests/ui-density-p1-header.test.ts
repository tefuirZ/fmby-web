// 卡①（UI 密度 P1 批量收口）DOM 断言：管理页头收敛统一组件、只保留必要层级。
//
// 审计依据：FE-UI-DENSITY-AUDIT.md（branch lovely-skunk @ 47907b8）
//   §2-S3：ManagePageHeader = eyebrow「管理中心」+ title + 长描述 + meta + actions，
//          38+ 文件使用；eyebrow 与侧栏「管理工作台」同义 = 每页多一行无效层级。
//   §2-S4：页头描述是 changelog/工单口吻，且有内部票号直出（#658 / #42-N5）。
//   §0 P1 汇总行：「38 页重复 eyebrow」。
//
// 本卡改法（ponytail：改共享组件一处，覆盖全部 46 个调用点，不去 38 个文件逐页动）：
//   1. 两份 ManagePageHeader（manage/components.tsx 与 longtail-shared/components.tsx）
//      删除硬编码 eyebrow「管理中心」——层级收敛为 title（+meta/actions）；
//   2. description 由必填转可选、条件渲染——描述成为「有话才说」的次要层级；
//   3. S4 点名的票号直出 / changelog 口吻描述就地改写为人话（6 处）。
//
// 为什么用文本断言：本仓前端测试无 jsdom/RTL（见 ui-density-p1-8.test.ts 同款理由）；
// 页头结构与文案是结构不变量，文本判定足够且稳定。
//
// 运行：node --import ./host/tests/register-aliases.mjs --test host/tests/ui-density-p1-header.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..'); // 与 ui-density-p1-8 同基准：host/
const read = (p) => readFileSync(join(repoRoot, p), 'utf8');

/** 截取 ManagePageHeaderProps 接口体。 */
function headerPropsSource(src) {
  const start = src.indexOf('interface ManagePageHeaderProps');
  assert.ok(start >= 0, '应存在 ManagePageHeaderProps 接口');
  const end = src.indexOf('}', start);
  assert.ok(end > start, '接口应有闭花括号');
  return src.slice(start, end);
}

/** 截取 ManagePageHeader 函数体（到 ManageSectionCardProps 接口声明前）。 */
function headerSource(src) {
  const start = src.indexOf('export function ManagePageHeader');
  assert.ok(start >= 0, '应存在 ManagePageHeader 组件');
  const end = src.indexOf('interface ManageSectionCardProps');
  assert.ok(end > start, 'ManagePageHeader 后应接 ManageSectionCardProps');
  return src.slice(start, end);
}

test('卡①: manage/components.tsx 的 ManagePageHeader 不再渲染硬编码 eyebrow', () => {
  const src = headerSource(read('src/pages/manage/components.tsx'));
  assert.ok(
    !src.includes('styles.eyebrow'),
    '页头组件不应再渲染 eyebrow 层级（与侧栏同义的第四层级）'
  );
});

test('卡①: longtail-shared/components.tsx 的 ManagePageHeader 同样收敛', () => {
  const src = headerSource(read('src/pages/manage/longtail-shared/components.tsx'));
  assert.ok(
    !src.includes('styles.eyebrow'),
    '页头组件不应再渲染 eyebrow 层级（与侧栏同义的第四层级）'
  );
});

test('卡①: description 转可选并条件渲染（有话才说，无话不占行）', () => {
  for (const p of [
    'src/pages/manage/components.tsx',
    'src/pages/manage/longtail-shared/components.tsx',
  ]) {
    const full = read(p);
    assert.match(
      headerPropsSource(full),
      /description\?:\s*string/,
      `${p}: ManagePageHeaderProps.description 应为可选`
    );
    assert.match(
      headerSource(full),
      /\{description \? <p/,
      `${p}: description 应条件渲染（{description ? <p/> : null}）`
    );
  }
});

const copyCases = [
  {
    file: 'src/pages/manage/ManageCasPage.tsx',
    gone: '多盘扇出配置与状态（后端 #42-N5）。未启用时不会显示成空列表。',
    now: '多盘扇出配置与状态；未启用时不会显示成空列表。',
  },
  {
    file: 'src/pages/manage/CasPublishOrchestrationPage.tsx',
    gone: '进度与失败原因（#658 第 2 页；发起扇出写面待后端接线）。',
    now: '查看进度与失败原因。',
  },
  {
    file: 'src/pages/manage/CasContentListPage.tsx',
    gone: 'lease 状态（#658 第 1 页；发布编排/分享转存另卡）。',
    now: 'lease 状态。',
  },
  {
    file: 'src/pages/manage/ManageEventsPage.tsx',
    gone: '运行日志源缺失时诚实降级（runtimeSourceAvailable=false）。',
    now: '运行日志源缺失时诚实降级。',
  },
  {
    file: 'src/pages/manage/registration-codes/components/RegistrationCodeHeader.tsx',
    gone: '批次化发码、共享码入口和单码明细都收在一个工作台里，窄屏也别再靠横向滚动硬撑。',
    now: '批次化发码、共享码入口与单码明细的统一工作台。',
  },
  {
    file: 'src/pages/manage/users/components/UsersHeaderAndTable.tsx',
    gone: '补齐账号详情、创建、编辑和批量软删除闭环，删除语义先明确收口为停用账号并吊销活跃会话。',
    now: '账号的创建、编辑、停用与批量管理；删除语义为停用账号并吊销其活跃会话。',
  },
];

for (const { file, gone, now } of copyCases) {
  test(`卡①: 页头文案去 changelog/票号口吻 —— ${file.split('/').pop()}`, () => {
    const src = read(file);
    assert.ok(!src.includes(gone), `不应再出现工单口吻描述：「${gone}」`);
    assert.ok(src.includes(now), `应改写为面向用户的描述：「${now}」`);
  });
}
