import { Link } from 'react-router';
import type { ManageMountDetailRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { ManageSectionCard, getManageStatusVariant } from '../../../../components';
import {
  canValidateMount,
  getMountStatusLabel,
  buildMountFormState,
} from '../../../formUtils';
import type { MountFormState, MountDrawerState } from '../../../types';
import type { MutationShape } from '../types';
import styles from '../../../../ManagePages.module.css';

interface MountOverviewSectionProps {
  currentDetail: ManageMountDetailRecord;
  validateMountMutation: MutationShape<ManageMountDetailRecord, string>;
  refreshMountAccessMutation: MutationShape<ManageMountDetailRecord, string>;
  setFormErrors: (value: {}) => void;
  setDirectoryBrowser: (value: null) => void;
  setFormState: (state: MountFormState) => void;
  setDrawerState: (state: MountDrawerState) => void;
}

export function MountOverviewSection({
  currentDetail,
  validateMountMutation,
  refreshMountAccessMutation,
  setFormErrors,
  setDirectoryBrowser,
  setFormState,
  setDrawerState,
}: MountOverviewSectionProps) {
  return (
    <ManageSectionCard
      title="来源概览"
      description="查看当前来源的类型、健康状态、根路径与关键操作。"
      actions={
        <div className={styles.rowActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              setFormErrors({});
              setDirectoryBrowser(null);
              setFormState(buildMountFormState(currentDetail));
              setDrawerState({ mode: 'edit', mountId: currentDetail.mount.id });
            }}
          >
            编辑来源
          </button>
          <button
            className={styles.smallButton}
            type="button"
            disabled={!canValidateMount(currentDetail) || validateMountMutation.isPending}
            title={canValidateMount(currentDetail) ? '校验来源健康状态' : '当前来源类型暂不支持真实校验'}
            onClick={() => validateMountMutation.mutate(currentDetail.mount.id)}
          >
            {validateMountMutation.isPending && validateMountMutation.variables === currentDetail.mount.id ? '校验中…' : '校验来源'}
          </button>
          <button
            className={styles.smallButton}
            type="button"
            disabled={!currentDetail.capabilityState.canRefreshCredentials || refreshMountAccessMutation.isPending}
            title={currentDetail.capabilityState.canRefreshCredentials ? '刷新上游访问凭据' : '当前来源无需刷新凭据'}
            onClick={() => refreshMountAccessMutation.mutate(currentDetail.mount.id)}
          >
            {refreshMountAccessMutation.isPending && refreshMountAccessMutation.variables === currentDetail.mount.id ? '刷新中…' : '刷新访问'}
          </button>
          <Link className={styles.smallButton} to={`/manage/probe-tasks?mountId=${encodeURIComponent(currentDetail.mount.id)}`}>
            技术探测
          </Link>
        </div>
      }
    >
      <div className={styles.fieldRow}>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>状态</span>
          <StatusBadge label={getMountStatusLabel(currentDetail.mount.healthStatus)} variant={getManageStatusVariant(currentDetail.mount.healthStatus)} />
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>类型</span>
          <span className={styles.primaryText}>{currentDetail.mount.typeLabel}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>根路径 / 地址</span>
          <span className={styles.primaryText}>{currentDetail.rootPath}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>最近校验</span>
          <span className={styles.primaryText}>{formatDateTime(currentDetail.mount.lastCheckedAt)}</span>
        </div>
        <div className={styles.stackText}>
          <span className={styles.mutedText}>已隐藏绑定</span>
          <span className={styles.primaryText}>{currentDetail.mount.unavailableBindingCount}</span>
        </div>
      </div>
      {currentDetail.mount.description ? (
        <div className={styles.stackText}>
          <span className={styles.mutedText}>说明</span>
          <span className={styles.primaryText}>{currentDetail.mount.description}</span>
        </div>
      ) : null}
    </ManageSectionCard>
  );
}
