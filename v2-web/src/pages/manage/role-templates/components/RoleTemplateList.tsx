import type { Dispatch, SetStateAction } from 'react';
import type { RoleTemplateRecord } from '@/domains/manage';
import { StatusBadge } from '@/shared/ui';
import { formatDateTime } from '@/shared/utils/date';
import { ManageSectionCard, getManageStatusVariant } from '../../longtail-shared/components';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { RoleTemplateFormState } from '../types';
import { buildFormStateFromRecord } from '../formUtils';

interface RoleTemplateListProps {
  items: RoleTemplateRecord[];
  filteredItems: RoleTemplateRecord[];
  unrestrictedCount: number;
  searchKeyword: string;
  setSearchKeyword: (value: string) => void;
  libraryNameMap: Map<string, string>;
  setSuccessMessage: (value: string | null) => void;
  setFormMode: Dispatch<SetStateAction<'create' | 'edit'>>;
  setEditingRecord: Dispatch<SetStateAction<RoleTemplateRecord | null>>;
  setFormState: Dispatch<SetStateAction<RoleTemplateFormState>>;
  setPendingDeleteRecord: (record: RoleTemplateRecord | null) => void;
}

export function RoleTemplateList({
  items,
  filteredItems,
  unrestrictedCount,
  searchKeyword,
  setSearchKeyword,
  libraryNameMap,
  setSuccessMessage,
  setFormMode,
  setEditingRecord,
  setFormState,
  setPendingDeleteRecord,
}: RoleTemplateListProps) {
  return (
    <ManageSectionCard
      title="模板列表"
      description={`系统模板只读展示；自定义模板按媒体库范围和会话策略维护。当前有 ${unrestrictedCount} 个全媒体库用户模板。`}
      actions={
        <label className={styles.label}>
          搜索
          <input
            className={styles.searchInput}
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索模板名称、编码、媒体库或来源路径"
          />
        </label>
      }
    >
      {filteredItems.length === 0 ? (
        <div className={styles.emptyInlineState}>
          {items.length === 0 ? '当前还没有模板。' : '没有匹配的模板。'}
        </div>
      ) : (
        <div className={styles.entityGrid}>
          {filteredItems.map((item) => {
            const libraryLabels = item.defaultLibraries.map(
              (libraryId) => libraryNameMap.get(libraryId) ?? libraryId,
            );

            return (
              <article key={item.id} className={styles.entityCard}>
                <div className={styles.inlineMeta}>
                  <div className={styles.stackText}>
                    <strong>{item.name}</strong>
                    <span className={styles.mono}>{item.code}</span>
                  </div>
                  <StatusBadge
                    label={item.isSystem ? '系统内置' : '用户模板'}
                    variant={
                      item.isSystem
                        ? 'info'
                        : getManageStatusVariant(item.status)
                    }
                  />
                </div>

                <div className={styles.detailSummaryGrid}>
                  <div className={styles.detailCard}>
                    <span className={styles.detailCardLabel}>模板类型</span>
                    <span className={styles.detailCardValue}>
                      {item.isSystem
                        ? '后台内置'
                        : item.defaultLibraries.length > 0
                          ? '限定媒体库'
                          : '全媒体库'}
                    </span>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailCardLabel}>默认会话数</span>
                    <span className={styles.detailCardValue}>
                      {item.defaultMaxSessions ?? '不限制'}
                    </span>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailCardLabel}>默认有效天数</span>
                    <span className={styles.detailCardValue}>
                      {item.defaultValidDays ?? '不覆盖'}
                    </span>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailCardLabel}>更新时间</span>
                    <span className={styles.detailCardValue}>
                      {formatDateTime(item.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className={styles.detailSummaryGrid}>
                  <div className={styles.detailCard}>
                    <span className={styles.detailCardLabel}>来源路径授权</span>
                    <span className={styles.detailCardValue}>
                      {item.sourceGrants.length > 0
                        ? `${item.sourceGrants.length} 条`
                        : '未指定'}
                    </span>
                    <span className={styles.mutedText}>
                      {item.sourceGrants.length > 0
                        ? '更适合做 VIP / SVIP 这类按来源目录区分的模板。'
                        : '当前仅定义媒体库范围和默认会话数。'}
                    </span>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.stackText}>
                    <strong>模板说明</strong>
                    <span className={styles.mutedText}>
                      {item.description ?? '未填写说明'}
                    </span>
                  </div>

                  <div className={styles.stackText}>
                    <strong>默认媒体库</strong>
                    <div className={styles.chipRow}>
                      {libraryLabels.length === 0 ? (
                        <span className={styles.chip}>不限制</span>
                      ) : (
                        libraryLabels.map((libraryLabel) => (
                          <span
                            key={`${item.id}-${libraryLabel}`}
                            className={styles.chip}
                          >
                            {libraryLabel}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {item.isSystem ? (
                    <div className={styles.stackText}>
                      <strong>内部能力项</strong>
                      <span className={styles.mutedText}>
                        {item.capabilities.length} 项内置权限，由系统角色控制。
                      </span>
                    </div>
                  ) : null}

                  <div className={styles.stackText}>
                    <strong>创建时间</strong>
                    <span className={styles.mutedText}>
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                {item.isSystem ? (
                  <p className={styles.fieldHint}>
                    后台管理员权限保持系统内置单层，这类模板只读展示，不在这里继续拆级。
                  </p>
                ) : null}

                <div className={styles.rowActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={item.isSystem}
                    title={item.isSystem ? '系统模板不允许编辑' : '编辑模板'}
                    onClick={() => {
                      setSuccessMessage(null);
                      setFormMode('edit');
                      setEditingRecord(item);
                      setFormState(buildFormStateFromRecord(item));
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    disabled={item.isSystem}
                    title={item.isSystem ? '系统模板不允许停用' : '停用模板'}
                    onClick={() => setPendingDeleteRecord(item)}
                  >
                    停用模板
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ManageSectionCard>
  );
}
