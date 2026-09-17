/** 注册码批次区（筛选 + 列表 + 多选操作条）（V1F 拆分）。 */

import type { Dispatch, SetStateAction } from 'react';
import type { RegistrationCodeBatchRecord, RegistrationCodeRecord, RegistrationCodeStatus } from '@fmby/v2-shared/contracts/manage';
import { ManageSectionCard } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import { RegistrationCodeFilters } from './RegistrationCodeFilters';
import { RegistrationCodeList } from './RegistrationCodeList';
import { RegistrationCodeBatchActionsBar } from './RegistrationCodeBatchActionsBar';
import type { RegistrationCodeBatchSummary } from '../types';

interface RegistrationCodeBatchSectionProps {
  batchSummaries: RegistrationCodeBatchSummary[];
  batches: RegistrationCodeBatchRecord[];
  filteredCount: number;
  expandedBatchIds: string[];
  selectedBatchIds: string[];
  libraryNameMap: Map<string, string>;
  searchKeyword: string;
  setSearchKeyword: Dispatch<SetStateAction<string>>;
  statusFilter: 'all' | RegistrationCodeStatus;
  setStatusFilter: Dispatch<SetStateAction<'all' | RegistrationCodeStatus>>;
  selectedBatches: RegistrationCodeBatchRecord[];
  onToggleExpanded: (batchId: string) => void;
  onToggleSelected: (batchId: string) => void;
  onCopyAll: (batch: RegistrationCodeBatchRecord) => void;
  onCopyAvailable: (batch: RegistrationCodeBatchRecord) => void;
  onEdit: (batch: RegistrationCodeBatchRecord) => void;
  onStatusAction: (record: RegistrationCodeRecord) => void;
  onDelete: (record: RegistrationCodeRecord) => void;
  onClearSelection: () => void;
  onCopySelectedAll: () => void;
  onCopySelectedAvailable: () => void;
  onBatchDelete: () => void;
}

export function RegistrationCodeBatchSection({
  batchSummaries,
  batches,
  filteredCount,
  expandedBatchIds,
  selectedBatchIds,
  libraryNameMap,
  searchKeyword,
  setSearchKeyword,
  statusFilter,
  setStatusFilter,
  selectedBatches,
  onToggleExpanded,
  onToggleSelected,
  onCopyAll,
  onCopyAvailable,
  onEdit,
  onStatusAction,
  onDelete,
  onClearSelection,
  onCopySelectedAll,
  onCopySelectedAvailable,
  onBatchDelete,
}: RegistrationCodeBatchSectionProps) {
  return (
    <>
      <ManageSectionCard
        title="注册码批次"
        description="批次维度支持折叠、整批复制、多选复制和整批真删除；展开后再处理单条注册码。"
        actions={
          <RegistrationCodeFilters
            searchKeyword={searchKeyword}
            setSearchKeyword={setSearchKeyword}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        }
      >
        {filteredCount === 0 ? (
          <div className={styles.emptyInlineState}>
            {batches.length === 0
              ? '还没有任何注册码批次，先创建一个。'
              : '当前筛选条件下没有匹配结果。'}
          </div>
        ) : (
          <RegistrationCodeList
            batchSummaries={batchSummaries}
            expandedBatchIds={expandedBatchIds}
            selectedBatchIds={selectedBatchIds}
            libraryNameMap={libraryNameMap}
            onToggleExpanded={onToggleExpanded}
            onToggleSelected={onToggleSelected}
            onCopyAll={onCopyAll}
            onCopyAvailable={onCopyAvailable}
            onEdit={onEdit}
            onStatusAction={onStatusAction}
            onDelete={onDelete}
          />
        )}
      </ManageSectionCard>

      <RegistrationCodeBatchActionsBar
        selectedBatches={selectedBatches}
        onClearSelection={onClearSelection}
        onCopyAll={onCopySelectedAll}
        onCopyAvailable={onCopySelectedAvailable}
        onBatchDelete={onBatchDelete}
      />
    </>
  );
}
