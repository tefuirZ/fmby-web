/**
 * 迁移 ledger 检视 / 导出（FE-UI-BACKLOG-3）。
 *
 * 契约层 `migrationApi`（inspect / export）已合入且**前端无页面**；后端
 * `migration_inspect` / `migration_export` 为**真实实现**（能力门 `VIEW_AUDIT`；
 * 端口未装配 ⇒ fail-closed，不返空壳）——见 `FE-MIGRATION-WIZARD.md`。
 *
 * ★`POST /manage/migration/import` 后端是 `ErrorCode::NotImplemented` **501 占位**，
 *   契约层**不提供**对应方法（避免接线占位）⇒ 本页**不提供导入入口**，并在说明里
 *   如实标注「导入未开放」。**不为凑功能伪造导入按钮**。
 *
 * ★字段按 `shared/src/contracts/manage/migration/types.ts` 实测（不凭记忆）：
 *   - wire 已是 **camelCase**（`appliedAtMs` / `currentVersion`）⇒ **不做** snake→camel；
 *   - `MigrationInspectResponse{ count, currentVersion, entries }`；
 *   - `MigrationExportResponse{ entries }`；
 *   - `MigrationEntry{ version, name, checksum, appliedAtMs }`，`appliedAtMs` 为 **epoch 毫秒**。
 *
 * 错误一律经既有 `getErrorMessage` 出后端原文（端口未装配的 fail-closed 也原样呈现），
 * 不在本层吞成空列表。
 *
 * 形态照同目录既有管理面：`ManageSectionCard` + `FeedbackState` + `InlineBanner` +
 * `StatusBadge` + `ManageShared.module.css`，未新造外壳/样式。
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { migrationApi } from '@fmby/v2-shared/contracts/manage/migration';
import { FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from './longtail-shared/components';

const MIGRATION_INSPECT_KEY = ['manage', 'migration', 'inspect'] as const;
const MIGRATION_EXPORT_KEY = ['manage', 'migration', 'export'] as const;

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function MigrationLedgerSection() {
  const [showExport, setShowExport] = useState(false);

  const inspectQuery = useQuery({
    queryKey: MIGRATION_INSPECT_KEY,
    queryFn: () => migrationApi.inspect(),
  });

  const exportQuery = useQuery({
    queryKey: MIGRATION_EXPORT_KEY,
    queryFn: () => migrationApi.export(),
    enabled: showExport,
  });

  const inspect = inspectQuery.data;

  return (
    <ManageSectionCard
      title="迁移 ledger"
      description="检视已应用的迁移记录并导出可导入集合。导入（远程执行 DDL）后端尚未实现，暂不开放。"
    >
      {inspectQuery.isPending ? (
        <div className={styles.fieldHint}>正在读取迁移 ledger…</div>
      ) : inspectQuery.isError ? (
        // ★如实呈现（含端口未装配的 fail-closed），不吞成空列表
        <FeedbackState
          variant="error"
          title="无法读取迁移 ledger"
          description={getErrorMessage(inspectQuery.error)}
          action={
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void inspectQuery.refetch()}
            >
              重试
            </button>
          }
        />
      ) : !inspect || inspect.count === 0 ? (
        <FeedbackState
          variant="empty"
          title="暂无迁移记录"
          description="当前 ledger 中还没有已应用的迁移条目。"
        />
      ) : (
        <>
          <div className={styles.batchMetaRow}>
            <span>条目数 {inspect.count}</span>
            <span>当前版本 v{inspect.currentVersion}</span>
            <StatusBadge label="已检视" variant="info" />
          </div>

          <ul className={styles.activityList}>
            {inspect.entries.map((entry) => (
              <li key={entry.version} className={styles.activityItem}>
                <span className={styles.activityTitle}>
                  v{entry.version} {entry.name}
                </span>
                <span className={styles.mono}>{entry.checksum}</span>
                <span className={styles.activityTime}>
                  {formatEpochMs(entry.appliedAtMs)}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              aria-expanded={showExport}
              onClick={() => setShowExport((prev) => !prev)}
            >
              {showExport ? '收起导出' : '导出可导入集合'}
            </button>
          </div>

          {showExport ? (
            exportQuery.isPending ? (
              <div className={styles.fieldHint}>正在导出…</div>
            ) : exportQuery.isError ? (
              <InlineBanner variant="error" title={getErrorMessage(exportQuery.error)} />
            ) : (
              <>
                <div className={styles.fieldHint}>
                  可导入条目 {exportQuery.data?.entries.length ?? 0} 条（= 当前已应用条目）。
                </div>
                <ul className={styles.activityList}>
                  {(exportQuery.data?.entries ?? []).map((entry) => (
                    <li key={`export-${entry.version}`} className={styles.activityItem}>
                      <span className={styles.activityTitle}>
                        v{entry.version} {entry.name}
                      </span>
                      <span className={styles.mono}>{entry.checksum}</span>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
        </>
      )}
    </ManageSectionCard>
  );
}
