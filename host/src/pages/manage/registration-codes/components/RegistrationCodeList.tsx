import type { RegistrationCodeBatchRecord, RegistrationCodeRecord } from '@fmby/v2-shared/contracts/manage';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { RegistrationCodeBatchSummary } from '../types';
import { RegistrationCodeBatchCard } from './RegistrationCodeBatchCard';
import { RegistrationCodeDetailTable } from './RegistrationCodeDetailTable';
import { RegistrationCodeDetailMobileList } from './RegistrationCodeDetailMobileList';

export interface RegistrationCodeListProps {
  batchSummaries: RegistrationCodeBatchSummary[];
  expandedBatchIds: string[];
  selectedBatchIds: string[];
  libraryNameMap: Map<string, string>;
  onToggleExpanded: (batchId: string) => void;
  onToggleSelected: (batchId: string) => void;
  onCopyAll: (batch: RegistrationCodeBatchRecord) => void;
  onCopyAvailable: (batch: RegistrationCodeBatchRecord) => void;
  onEdit: (batch: RegistrationCodeBatchRecord) => void;
  onStatusAction: (record: RegistrationCodeRecord) => void;
  onDelete: (record: RegistrationCodeRecord) => void;
}

export function RegistrationCodeList({
  batchSummaries,
  expandedBatchIds,
  selectedBatchIds,
  libraryNameMap,
  onToggleExpanded,
  onToggleSelected,
  onCopyAll,
  onCopyAvailable,
  onEdit,
  onStatusAction,
  onDelete,
}: RegistrationCodeListProps) {
  if (batchSummaries.length === 0) {
    return null;
  }

  return (
    <div className={styles.batchList}>
      {batchSummaries.map((batchSummary) => {
        const expanded = expandedBatchIds.includes(batchSummary.batch.id);
        const selected = selectedBatchIds.includes(batchSummary.batch.id);

        return (
          <RegistrationCodeBatchCard
            key={batchSummary.batch.id}
            batchSummary={batchSummary}
            expanded={expanded}
            selected={selected}
            onToggleExpanded={onToggleExpanded}
            onToggleSelected={onToggleSelected}
            onCopyAll={onCopyAll}
            onCopyAvailable={onCopyAvailable}
            onEdit={onEdit}
          >
            <div className={styles.batchDetailPanel}>
              <RegistrationCodeDetailTable
                records={batchSummary.batch.items}
                libraryNameMap={libraryNameMap}
                onStatusAction={onStatusAction}
                onDelete={onDelete}
              />
              <RegistrationCodeDetailMobileList
                records={batchSummary.batch.items}
                libraryNameMap={libraryNameMap}
                onStatusAction={onStatusAction}
                onDelete={onDelete}
              />
            </div>
          </RegistrationCodeBatchCard>
        );
      })}
    </div>
  );
}
