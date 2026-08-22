import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router';
import type { ManageLibraryDetailRecord } from '@fmby/v2-shared/contracts/manage';
import { StatusBadge } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import { buildLibraryBindingHint, buildLibraryBindingSummary, buildLibraryFormState, getLibraryStatusLabel } from '../../../formUtils';
import type { LibraryDrawerState, LibraryFormState } from '../../../types';
import styles from '../../../../ManagePages.module.css';
import type { MutationShape } from '../types';

interface LibraryDrawerViewOverviewSectionProps {
  currentDetail: ManageLibraryDetailRecord;
  setFormState: Dispatch<SetStateAction<LibraryFormState>>;
  setDrawerState: (state: LibraryDrawerState | null) => void;
  triggerLibraryScanMutation: MutationShape<string>;
  isTriggeringScan: boolean;
  hasActiveScanTask: boolean;
}

export function LibraryDrawerViewOverviewSection({
  currentDetail,
  setFormState,
  setDrawerState,
  triggerLibraryScanMutation,
  isTriggeringScan,
  hasActiveScanTask,
}: LibraryDrawerViewOverviewSectionProps) {
  return (
    <ManageSectionCard
      title="库概览"
      description="查看当前媒体库的规模、状态和访问摘要。"
      actions={
        <div className={styles.rowActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setFormState(buildLibraryFormState(currentDetail));
              setDrawerState({ mode: 'edit', libraryId: currentDetail.library.id });
            }}
          >
            编辑媒体库
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => triggerLibraryScanMutation.mutate(currentDetail.library.id)}
            disabled={isTriggeringScan || hasActiveScanTask || currentDetail.sourceBindings.length === 0}
            title={currentDetail.sourceBindings.length === 0 ? '请先绑定来源再发起扫描' : undefined}
          >
            {isTriggeringScan ? '创建任务中…' : hasActiveScanTask ? '扫描进行中…' : '发起扫描'}
          </button>
          <Link
            className={styles.smallButton}
            to={`/manage/probe-tasks?libraryId=${encodeURIComponent(currentDetail.library.id)}`}
          >
            技术探测
          </Link>
          <Link className={styles.smallButton} to={`/libraries/${currentDetail.library.id}`}>
            查看前台
          </Link>
        </div>
      }
    >
      <div className={styles.fieldRow}>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>状态</span>
          <StatusBadge
            label={getLibraryStatusLabel(currentDetail.library.status)}
            variant={getManageStatusVariant(currentDetail.library.status)}
          />
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>类型</span>
          <span className={styles.primaryText}>{currentDetail.library.typeLabel}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>内容数</span>
          <span className={styles.primaryText}>{currentDetail.library.itemCount.toLocaleString('zh-CN')}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>最近更新</span>
          <span className={styles.primaryText}>
            {formatDateTime(currentDetail.library.updatedAt || currentDetail.library.lastScanAt)}
          </span>
        </div>
      </div>
      <div className={styles.fieldGroup}>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>说明</span>
          <span>{currentDetail.library.description || '暂无说明'}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>访问摘要</span>
          <span>{currentDetail.library.visibilityLabel || '当前没有单独授权摘要。'}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>来源摘要</span>
          <span>{buildLibraryBindingSummary(currentDetail.library)}</span>
          <span className={styles.mutedText}>{buildLibraryBindingHint(currentDetail.library)}</span>
        </div>
      </div>
    </ManageSectionCard>
  );
}
