// FE-SOURCE-TYPES-CONSOLIDATE：云盘数据源入口收敛契约（用户裁定，源级可证伪）。
//
// 用户原话：「139、微软网盘等**不要在侧边栏**，应该**全部集成到"添加数据源"的数据源类型下拉选择**中」。
//
// 本文件把该裁定的**四条可判定面**钉住（只碰入口组织，**页面一个都不删**）：
//   ① 侧栏（`ManageLayout.tsx` 的 `manageNavTree`）不得再有这三条独立入口；
//   ② 「添加媒体来源」抽屉的「来源类型」下拉必须有「云盘账号」组，且值域与挂载类型**不相交**；
//   ③ 该组每个条目都指向**原页面**（路由表里真实存在的那三条）—— 即"能进入原流程"，
//      而不是新开一条无人守卫的旁路；
//   ④ 付费语义**不因收敛被绕过**：微软 / 115 分享 两个目标页仍由 `ManagePaidFeatureGuard` 门控
//      （更完整的付费面契约归 `license-gated-modules.contract.test.ts`，此处只钉"入口未绕过"）。
//
// 跑法：cd host && node --import ./tests/register-aliases.mjs --test tests/source-types-consolidate.contract.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');
const REPO_ROOT = join(HOST_ROOT, '..');
const readSrc = (rel: string) => readFile(join(HOST_ROOT, 'src', rel), 'utf8');
/** 共享契约（`ManageMountProviderType` 的真正定义处，不在 host）。 */
const readShared = (rel: string) => readFile(join(REPO_ROOT, 'shared', 'src', rel), 'utf8');

/** 收敛的三条入口：侧栏 id、原页面路径。 */
const CONSOLIDATED = [
  { navId: 'media-yun139', path: '/manage/media/yun139', label: '139 云盘' },
  { navId: 'media-microsoft', path: '/manage/media/microsoft', label: '微软账号' },
  { navId: 'media-pan115-share', path: '/manage/media/pan115-share', label: '115 分享与同步' },
];

test('① 侧栏不再有 139 / 微软 / 115 分享 的独立入口（页面仍在，只改入口组织）', async () => {
  const nav = await readSrc('app/layouts/ManageLayout.tsx');
  // ★只查**导航树条目**两种写法：id 与 `to: '<path>'`。
  //   不能粗查 `nav.includes(path)` —— 本文件另有「路径→预取键」映射（PATH_PREFETCH_KEYS），
  //   页面仍在时它**理应**继续引用这些路径（实测踩到过这条假红）。
  const offenders = CONSOLIDATED.filter(
    (c) => nav.includes(c.navId) || nav.includes(`to: '${c.path}'`),
  );
  assert.deepEqual(
    offenders.map((o) => o.navId),
    [],
    `这些入口必须已从侧栏移除（用户裁定：不要在侧边栏）：${offenders.map((o) => o.navId).join(', ')}`,
  );
  // 防「把整棵导航删空」的假绿：媒体来源（= 添加数据源入口）必须仍在侧栏。
  assert.match(nav, /'\/manage\/media\/mounts'/, '「媒体来源」（添加数据源）入口必须保留');
  assert.match(nav, /manageNavTree/, '导航树本身必须还在（本断言防真空）');
});

test('② 「添加媒体来源」类型下拉含「云盘账号」组，且与挂载类型值域不相交', async () => {
  const types = await readSrc('pages/manage/mounts/types.ts');
  const section = await readSrc(
    'pages/manage/mounts/components/MountDrawer/sections/BasicInfoSection.tsx',
  );

  // 组与三个条目都在 mount 侧常量里（单一真源）
  assert.match(types, /CLOUD_SOURCE_LINKS/, '云盘账号条目必须定义在 mounts/types.ts（单一真源）');
  assert.match(types, /CLOUD_SOURCE_VALUE_PREFIX/, '导航型条目的值前缀必须具名（与挂载类型值域隔离）');
  for (const c of CONSOLIDATED) {
    assert.ok(types.includes(c.path), `云盘账号条目必须指向原页面 ${c.path}`);
  }

  // 下拉里确实渲染了这一组（且只在**创建态**那一个 select 上）
  assert.match(section, /optgroup label="云盘账号/, '创建态下拉必须含「云盘账号」分组');
  assert.match(section, /CLOUD_SOURCE_LINKS\.map/, '分组条目必须由单一真源渲染');
  assert.match(
    section,
    /value\.startsWith\(CLOUD_SOURCE_VALUE_PREFIX\)[\s\S]{0,200}?navigate\(target\.to\)/,
    '选中该组必须**导航到原页面**（进入原流程），而不是当作挂载类型提交',
  );

  // 值域不相交：前缀不得出现在挂载类型联合里（联合定义在**共享契约**里，不在 mounts/types.ts）
  const contractTypes = await readShared('contracts/manage/types.ts');
  const union = contractTypes.match(/export type ManageMountProviderType =[\s\S]{0,300}?;/)?.[0] ?? '';
  assert.ok(union.length > 0, '未取到 ManageMountProviderType（可证伪守卫）');
  assert.ok(
    !union.includes('__cloud'),
    '导航型条目**不得**混进 ManageMountProviderType（它们不是挂载类型）',
  );
});

test('③ 三个入口目标都是路由表里真实存在的原页面（能进入原流程）', async () => {
  // ★交叉钉：**下拉里的链接目标**（`CLOUD_SOURCE_LINKS.to`，单一真源）必须与**路由表**对得上 ——
  //   只查路由会漏掉「链接写错字 ⇒ 点进 404」这一整类（本断言最初就漏了，红侧暴露出来）。
  const types = await readSrc('pages/manage/mounts/types.ts');
  const declaredTargets = [...types.matchAll(/to: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(
    declaredTargets.length,
    CONSOLIDATED.length,
    `CLOUD_SOURCE_LINKS 的 to 条目数应为 ${CONSOLIDATED.length}，实际 ${declaredTargets.length}`,
  );
  const router = await readSrc('app/router/index.tsx');
  // ★路由注册的是**相对子路径**（`path: 'yun139'`）与动态 import 说明符
  //   （`@/pages/manage/yun139`）——不是绝对 URL（实测踩到过这条假红）。
  for (const c of CONSOLIDATED) {
    // (a) 单一真源里的链接目标
    assert.ok(
      declaredTargets.includes(c.path),
      `CLOUD_SOURCE_LINKS 必须指向 ${c.path}（实际：${declaredTargets.join(', ')}）`,
    );
    // (b) 该目标在路由表里真的注册着（相对子路径 + 动态 import 说明符）
    const segment = c.path.replace('/manage/media/', '');
    assert.ok(
      router.includes(`path: '${segment}'`),
      `路由表必须仍注册 ${c.path}（相对段 '${segment}'；页面未删，收敛只动入口）`,
    );
    assert.ok(
      router.includes(`@/pages/manage/${segment}`),
      `路由表必须仍指向原页面模块 @/pages/manage/${segment}（未换成旁路）`,
    );
  }
});

test('④ 付费语义不因收敛被绕过：目标页仍由 ManagePaidFeatureGuard 门控', async () => {
  // 微软与 115 分享是付费面（见 license-gated-modules.contract.test.ts 的 Exempt 清单；
  // 139 属「其余 /manage 页面」= Exempt，故此处不要求守卫）。
  const guarded = ['pages/manage/microsoft/index.tsx', 'pages/manage/pan115-share/index.tsx'];
  for (const rel of guarded) {
    const src = await readSrc(rel);
    assert.match(
      src,
      /ManagePaidFeatureGuard/,
      `${rel} 必须保留付费守卫（收敛入口不得绕过「需要授权」语义）`,
    );
  }
});
