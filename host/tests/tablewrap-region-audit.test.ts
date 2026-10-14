// FE-WEB-UI-A：全仓 `.tableWrap` 横向滚动区 a11y 契约（DOM 级，非正则猜）。
//
// 背景：`.tableWrap` 在 ManagePages.module.css / ManageShared.module.css 两处定义为
//   `overflow-x: auto` + `.table { min-width: 640px }`
// ⇒ 每一处都是**可横向滚动的区域**。WCAG 2.1 SC 2.1.1（键盘）+ axe `scrollable-region-focusable`
// 要求这类区域必须可被键盘触及且可被读屏器命名。
//
// 本卡前的真实状态（fe01 在本分支实测）：
//   · 存量 8 处已有 role=region + aria-label，其中全部带 tabIndex=0；
//   · **41 处缺 role / aria-label** —— PR #29（fix/a11y-tablewrap-region）只补了 39 处，
//     漏 2 处（MediaItemListTable / MediaItemArtworkSection，两者都用
//     `ManagePages.module.css` 的 tableWrap，与其余同源却未被扫到）。
//     本卡补齐这 2 处，并把全量收进契约。
//
// 口径（可证伪，逐条断言具体值）：
//   ① 每个 `<div ... tableWrap ...>` 都必须带 role="region" + 非空 aria-label；
//   ② 接了 useTableRowRoving 的文件（roving 表）一律不得给容器 tabIndex
//      —— 容器可聚焦会与行的 roving 停靠点构成「双停靠点」，Tab 先停在容器上，
//        破坏「Tab 走进行停靠点」断言（PR #29 实测回归 62/64，沿用其结论）；
//   ③ 带 tabIndex=0 的必须是显式名单内那 8 处（详见该测试内裁决注释）；
//   ④ aria-label 用显式名单钉死（49 处）—— 新增/改名一处，本测试立刻红。
//
// 跑法：node --import ./tests/register-aliases.mjs --test tests/tablewrap-region-audit.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const HOST_ROOT = join(import.meta.dirname, '..');

/** 递归收集 host/src 下所有 .tsx。 */
function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) collectTsx(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * 取出每个 `<div … tableWrap …>` 开标签的完整文本（可能跨多行）。
 * 用「从 `<div` 起到该标签的 `>`」切分，避免把后续 JSX 算进来。
 */
function tableWrapTags(src: string): Array<{ line: number; tag: string }> {
  const tags: Array<{ line: number; tag: string }> = [];
  let idx = src.indexOf('<div');
  while (idx >= 0) {
    const end = src.indexOf('>', idx);
    if (end < 0) break;
    const tag = src.slice(idx, end + 1);
    if (/tableWrap/.test(tag)) {
      tags.push({ line: src.slice(0, idx).split('\n').length, tag });
    }
    idx = src.indexOf('<div', end);
  }
  return tags;
}

const SCROLL_SUFFIX = '（可横向滚动）';

const tsxFiles = collectTsx(join(HOST_ROOT, 'src'));

test('FE-WEB-UI-A①：每个 .tableWrap 都带 role="region" + 非空 aria-label', () => {
  const offenders: string[] = [];
  let total = 0;
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8');
    for (const { line, tag } of tableWrapTags(src)) {
      total += 1;
      const hasRole = /role="region"/.test(tag);
      const labelMatch = tag.match(/aria-label=(?:"([^"]*)"|\{`([^`]*)`\})/);
      const label = labelMatch ? (labelMatch[1] ?? labelMatch[2] ?? '') : '';
      if (!hasRole || label.trim().length === 0) {
        offenders.push(`${relative(HOST_ROOT, file)}:${line} role=${hasRole} label=${JSON.stringify(label)}`);
      }
    }
  }
  assert.ok(total > 0, '未扫到任何 .tableWrap —— 扫描器本身失效（可证伪守卫）');
  assert.deepEqual(offenders, [], `缺 role/aria-label 的横向滚动区：\n${offenders.join('\n')}`);
});

test('FE-WEB-UI-A②：roving 表新补的滚动区不得带 tabIndex（③名单内的存量 8 处除外）', () => {
  // ③ 的 8 处是**存量**：既接 roving 又给容器 tabIndex=0，双停靠点已被
  // tests/table-row-keynav.test.ts 的步数断言如实钉死（裁决保留，见该文件注释）。
  // 本条的契约是**不许再新增**：PR #29 新补的 39 处 + 本卡补的 2 处一律无 tabIndex。
  const legacy = new Set([
    'src/pages/manage/ManageSecretsPage.tsx',
    'src/pages/manage/probe-tasks/components/ProbeTaskTable.tsx',
    'src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx',
    'src/pages/manage/pan115-share/components/SyncSection.tsx',
    'src/pages/manage/pan115-share/components/ShareItemBrowseSection.tsx',
    'src/pages/manage/pan115-share/components/PreviewBrowseSection.tsx',
  ]);
  const offenders: string[] = [];
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('useTableRowRoving')) continue;
    const rel = relative(HOST_ROOT, file);
    if (legacy.has(rel)) continue;
    for (const { line, tag } of tableWrapTags(src)) {
      if (/tabIndex/.test(tag)) {
        offenders.push(`${rel}:${line} roving 表的滚动区带了 tabIndex ⇒ 双停靠点`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('FE-WEB-UI-A③：带 tabIndex=0 的滚动区必须是显式名单内且非 roving', () => {
  // 背景（实测 + 既有裁决记录）：
  //   · roving 表（接了 useTableRowRoving）的容器**不能**带 tabIndex=0 —— 会与行的
  //     roving 停靠点构成双停靠点，Tab 先停在容器上（PR #29 实测回归 62/64）。
  //   · 但仓内有 6 个文件既是 roving 表、又历史上给容器 tabIndex=0，且
  //     tests/table-row-keynav.test.ts 已把「多停一跳」如实钉死在步数断言里
  //     （见该文件 3815-3818 / 3946-3952 / 4054-4059 的裁决注释）。
  //   ⇒ 本卡不擅自改这 6 处（改则 3 处步数断言全红，属契约变更，须主代理裁决），
  //     但用名单钉死范围：新增第 7 个 ⇒ 本测试红。
  // 名单（本分支实测，PR #29 与 main 均如此）：
  const TABINDEX_ALLOWED: Array<[string, string]> = [
    ['src/pages/manage/ManageSecretsPage.tsx', '密钥链状态列表'],
    ['src/pages/manage/probe-tasks/components/ProbeTaskTable.tsx', '探测任务列表'],
    ['src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx', '自动同步作业'],
    ['src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx', 'Emby 导入作业'],
    ['src/pages/manage/pan115-share/components/SyncSection.tsx', '同步来源'],
    ['src/pages/manage/pan115-share/components/SyncSection.tsx', '最近同步任务'],
    ['src/pages/manage/pan115-share/components/ShareItemBrowseSection.tsx', '浏览结果'],
    ['src/pages/manage/pan115-share/components/PreviewBrowseSection.tsx', '网盘目录浏览结果'],
  ];
  // ① 名单内必须真的还在（防「名单写了但代码已删」的假契约）
  for (const [file, labelHead] of TABINDEX_ALLOWED) {
    const src = readFileSync(join(HOST_ROOT, file), 'utf8');
    const tags = tableWrapTags(src).filter((t) => t.tag.includes(`aria-label="${labelHead}`));
    assert.ok(tags.length > 0, `${file} 未找到 aria-label 以「${labelHead}」开头的滚动区（名单过期？）`);
    for (const { line, tag } of tags) {
      assert.ok(/tabIndex/.test(tag), `${file}:${line} 应保留 tabIndex=0（存量键盘横向滚动入口）`);
      assert.ok(/role="region"/.test(tag), `${file}:${line} 应同时带 role="region"`);
    }
  }
  // ② 名单外一个都不许有（防新增第 7 个双停靠点）
  const allow = new Set(TABINDEX_ALLOWED.map(([f, l]) => `${f}::${l}`));
  const offenders: string[] = [];
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8');
    for (const { line, tag } of tableWrapTags(src)) {
      if (!/tabIndex/.test(tag)) continue;
      const lm = tag.match(/aria-label="([^"]+)"/);
      const rel = relative(HOST_ROOT, file);
      const key = lm ? `${rel}::${lm[1].replace(SCROLL_SUFFIX, '')}` : `${rel}::<无 aria-label>:${line}`;
      if (!allow.has(key)) {
        offenders.push(`${rel}:${line} 新增了带 tabIndex 的滚动区：${lm ? lm[1] : tag.slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `名单外新增 tabIndex 滚动区：\n${offenders.join('\n')}`);
});

test('FE-WEB-UI-A④：aria-label 名单（49 处，改一个就要同步改这里）', () => {
  // 为什么用名单而非「与同文件 title= 模糊匹配」：本仓大量表格位于详情面板 /
  // 跨文件卡片内（CollectionMemberPanel / AiInterventionDetailPanel /
  // RegistrationCodeDetailTable …），其语义名**有意**比所在卡片标题更精确
  // （如 card「令牌后续操作」内两张表分别叫「OneDrive 网盘列表」/「SharePoint 站点列表」）。
  // 模糊匹配会把这些合理命名误判为脱节。
  // 名单的契约价值在**反向**：任何人新增/改名一处 tableWrap，本测试立刻红，
  // 迫使同步评审命名 —— 这比宽松匹配更能防「再加一个没人核过的名字」。
  const EXPECTED: Array<[string, string]> = [
    ['src/pages/manage/ManageAuditLogsPage.tsx', '操作记录'],
    ['src/pages/manage/ManageEventsPage.tsx', '事件列表'],
    ['src/pages/manage/ManageMediaReviewsPage.tsx', '审核队列'],
    ['src/pages/manage/ManageOperationsPage.tsx', '${title}'],
    ['src/pages/manage/ManageOperationsPage.tsx', '数据源负载'],
    ['src/pages/manage/ManageOperationsPage.tsx', '活跃快照'],
    ['src/pages/manage/ManageOperationsPage.tsx', '活跃用户榜'],
    ['src/pages/manage/ManageOperationsPage.tsx', '热播榜'],
    ['src/pages/manage/ManageRuntimeLogsPage.tsx', '运行日志'],
    ['src/pages/manage/ManageSecretsPage.tsx', '密钥链状态列表'],
    ['src/pages/manage/ManageSessionsPage.tsx', '会话管理'],
    ['src/pages/manage/ManageSystemAboutPage.tsx', '运行依赖'],
    ['src/pages/manage/ManageSystemAboutPage.tsx', '运行时'],
    ['src/pages/manage/ManageSystemAboutPage.tsx', '链接'],
    ['src/pages/manage/auth-providers/AuthProvidersSection.tsx', '提供方配置'],
    ['src/pages/manage/auth-providers/ProviderDiagnosticsCard.tsx', '自检步骤'],
    ['src/pages/manage/collections/components/CollectionListTable.tsx', '合集列表'],
    ['src/pages/manage/collections/components/CollectionMemberPanel.tsx', '合集成员明细'],
    ['src/pages/manage/libraries/components/LibraryTable.tsx', '媒体库列表'],
    ['src/pages/manage/media-item-detail/components/MediaItemArtworkSection.tsx', '随文件资源'],
    ['src/pages/manage/media-items/components/MediaItemListTable.tsx', '媒体资源列表'],
    ['src/pages/manage/media-reviews/components.tsx', '候选媒体'],
    ['src/pages/manage/microsoft/MicrosoftAccountsSection.tsx', '已授权账号'],
    ['src/pages/manage/microsoft/MicrosoftAccountsSection.tsx', '应用凭据配置状态'],
    ['src/pages/manage/microsoft/MicrosoftOAuthSection.tsx', 'OneDrive 网盘列表'],
    ['src/pages/manage/microsoft/MicrosoftOAuthSection.tsx', 'SharePoint 站点列表'],
    ['src/pages/manage/mounts/components/MountTable.tsx', '来源列表'],
    ['src/pages/manage/naming-rules/ai-intervention/components/AiInterventionDetailPanel.tsx', '干预运行记录'],
    ['src/pages/manage/naming-rules/ai-intervention/components/AiInterventionThreadList.tsx', 'AI 干预线程'],
    ['src/pages/manage/operations/OperationsGapSections.tsx', '播放记录'],
    ['src/pages/manage/operations/OperationsGapSections.tsx', '数据源负载'],
    ['src/pages/manage/pan115-share/components/PreviewBrowseSection.tsx', '网盘目录浏览结果'],
    ['src/pages/manage/pan115-share/components/ShareItemBrowseSection.tsx', '浏览结果'],
    ['src/pages/manage/pan115-share/components/SyncSection.tsx', '同步来源'],
    ['src/pages/manage/pan115-share/components/SyncSection.tsx', '最近同步任务'],
    ['src/pages/manage/probe-tasks/components/ProbeTaskTable.tsx', '探测任务列表'],
    ['src/pages/manage/registration-codes/components/RegistrationCodeDetailTable.tsx', '注册码详情'],
    ['src/pages/manage/rewards/RewardsLedgerSection.tsx', '积分流水'],
    ['src/pages/manage/task-center/components/TaskCenterList.tsx', '任务列表'],
    ['src/pages/manage/upstreams/UpstreamBindingsSection.tsx', '当前生效绑定'],
    ['src/pages/manage/upstreams/UpstreamBindingsSection.tsx', '类目与绑定'],
    ['src/pages/manage/upstreams/UpstreamMappingPresetsSection.tsx', '映射预设'],
    ['src/pages/manage/upstreams/UpstreamMappingWizardSection.tsx', '预览结果'],
    ['src/pages/manage/upstreams/UpstreamSourceListSection.tsx', '上游源列表'],
    ['src/pages/manage/upstreams/UpstreamSourceListSection.tsx', '局域网发现结果'],
    ['src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx', 'Emby 导入作业'],
    ['src/pages/manage/upstreams/UpstreamSyncJobsSection.tsx', '自动同步作业'],
    ['src/pages/manage/users/components/UserTable.tsx', '账号列表'],
    ['src/pages/manage/yun139/Yun139ProfilesSection.tsx', '凭据档案'],
  ];
  // 实测全量（与名单逐一比对，双向）
  const actual: Array<[string, string]> = [];
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf8');
    for (const { tag } of tableWrapTags(src)) {
      const lm = tag.match(/aria-label=(?:"([^"]*)"|\{`([^`]*)`\})/);
      if (!lm) continue;
      const label = lm[1] ?? lm[2] ?? '';
      if (!label.endsWith(SCROLL_SUFFIX)) continue;
      actual.push([relative(HOST_ROOT, file), label.slice(0, -SCROLL_SUFFIX.length)]);
    }
  }
  const key = (pair: [string, string]) => `${pair[0]}::${pair[1]}`;
  const expKeys = new Set(EXPECTED.map(key));
  const actKeys = new Set(actual.map(key));
  const missing = EXPECTED.filter((e) => !actKeys.has(key(e))).map(key);
  const extra = actual.filter((a) => !expKeys.has(key(a))).map(key);
  assert.deepEqual(missing, [], `名单有、代码没有（名单过期）：\n${missing.join('\n')}`);
  assert.deepEqual(extra, [], `代码有、名单没有（新增未登记命名）：\n${extra.join('\n')}`);
  assert.equal(actual.length, EXPECTED.length, `总数不符：实测 ${actual.length} / 名单 ${EXPECTED.length}`);
});
