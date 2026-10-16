/**
 * #658 前端 CAS 编排 ④徽章 / ⑤延迟展示 —— 契约测试。
 *
 * 真源：
 *  - 盘优先级：`CasDriveConfigDto.priority`（后端 `GET /admin/cas/drives` 配置端点），
 *    前端按 `drive_ref` 关联到内容副本（`CasContentDriveCopy` 无 priority，须 join）。
 *  - 租约：`CasContentLeaseRefDto`(holder/expiresAt) —— 仅 RestoreLease **TTL 闸**部分投影。
 *
 * ★诚实登记（非缺陷，已开 issue）：
 *  - 「秒传来源」无后端字段（SourceKind 无 RapidUpload 变体 + source_kind 未进 DTO）⇒ fmby-v2 #861。
 *  - 完整「延迟删除三闸状态 / 哪闸在挡 / 宽限期剩余」无 DTO ⇒ fmby-v2 #862。
 *    前端只据实展示 TTL 闸（holder + expiresAt），**显式标注为三闸之一**，不伪造完整延迟视图。
 *  - `has_local_entity` 恒 false（无生产写入口）⇒ 前端据实呈现「无」，不伪造「有」。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDrivePriorityMap } from '@/pages/manage/cas/formatCasDrive';

test('① buildDrivePriorityMap — driveRef→priority 映射（盘优先级来自 drives 配置端点）', () => {
  const map = buildDrivePriorityMap([
    { driveRef: 'quark:A', priority: 10 },
    { driveRef: 'ali:B', priority: 5 },
  ]);
  assert.equal(map.get('quark:A'), 10);
  assert.equal(map.get('ali:B'), 5);
});

test('①b 未配置的盘 ⇒ priority 缺失（undefined，不伪造优先级）', () => {
  const map = buildDrivePriorityMap([{ driveRef: 'quark:A', priority: 10 }]);
  // 内容副本里有盘但 drives 配置没配 ⇒ get 返回 undefined，前端显示「—」不编造
  assert.equal(map.get('unknown:C'), undefined);
});

test('①c 空配置 ⇒ 空映射（无盘配置时全缺 priority，不默认 0）', () => {
  const map = buildDrivePriorityMap([]);
  assert.equal(map.size, 0);
  assert.equal(map.get('quark:A'), undefined);
});

// ───────────────────────────────────────────────────────────────────────────
// CasContentListPage 源码级契约（照 secrets-metadata / yun139-transfer 范式）
// ───────────────────────────────────────────────────────────────────────────

test('② CasContentListPage 拉取 drives 配置并按 drive_ref join 优先级（注数据来源）', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/CasContentListPage.tsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /listDriveConfigs/, '必须拉取 drives 配置端点（priority 真源）');
  assert.match(src, /buildDrivePriorityMap/, '必须用 buildDrivePriorityMap 建 driveRef→priority 映射');
  // 数据来源注释：priority 来自 /admin/cas/drives 配置端点，前端按 drive_ref 关联
  assert.match(src, /drives 配置|admin\/cas\/drives|drive_ref/, '须注明 priority 数据来源与关联键');
});

test('③ CasContentListPage lease 展示显式标注为 TTL 闸（三闸之一）+ fixme 完整三闸', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/CasContentListPage.tsx', import.meta.url),
    'utf8',
  );
  // 必须显式标注这是三闸之一的 TTL 闸，别让用户以为这就是完整延迟视图
  assert.match(src, /TTL/, 'lease 列须标注 TTL 闸');
  assert.match(src, /三闸|三闸之一/, '须标注这是延迟删除三闸之一（非完整视图）');
  // fixme：完整三闸 / 哪闸在挡 / 宽限期剩余 待后端补 DTO（fmby-v2 #862）
  assert.match(src, /fixme|待后端|#862|三闸状态/, '须留 fixme 指完整三闸/宽限期待后端补');
});

test('④ CasContentListPage 不伪造秒传来源徽章（无后端字段，fmby-v2 #861）', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../src/pages/manage/CasContentListPage.tsx', import.meta.url),
    'utf8',
  );
  // 不得凭空造「秒传来源」徽章（后端 SourceKind 无 RapidUpload 变体 + source_kind 未进 DTO）
  assert.equal(
    src.includes('秒传来源') && !/秒传来源[^\n]*(?:无|未|待|#861|fixme)/.test(src),
    false,
    '若出现「秒传来源」须注明无后端字段（#861），不得当真实徽章渲染',
  );
});
