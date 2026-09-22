import { Fragment } from 'react';
import {
  type ManagedCollectionRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { Checkbox, StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';
import { useCollectionDetailQuery, useCollectionMutations } from '../hooks';
import { CollectionMemberPanel } from './CollectionMemberPanel';
import { CollectionMemberAdder } from './CollectionMemberAdder';
import { CollectionPresetCreate } from './CollectionPresetCreate';
import { moveMemberIds } from './memberReorder';
import { CollectionRulesPanel } from './CollectionRulesPanel';
import { SOURCE_LABELS, VISIBILITY_LABELS, formatEpochMs } from './labels';

type MutationsShape = ReturnType<typeof useCollectionMutations>;
type DetailQueryShape = ReturnType<typeof useCollectionDetailQuery>;

interface CollectionListTableProps {
  collections: ManagedCollectionRecord[];
  detailQuery: DetailQueryShape;
  selection: {
    selected: string[];
    selectedSet: ReadonlySet<string>;
    headerState: 'checked' | 'unchecked' | 'indeterminate';
    selectAll: () => void;
    invertVisible: () => void;
    clearVisible: () => void;
    toggle: (id: string, checked: boolean, opts?: { shiftKey?: boolean }) => void;
  };
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  setPendingDelete: (record: ManagedCollectionRecord | null) => void;
  setPendingMemberDelete: (state: {
    collectionId: string;
    boundItemId: string | null;
    memberTitle: string;
  } | null) => void;
  setBanner: (message: string | null) => void;
  onEdit: (record: ManagedCollectionRecord) => void;
  mutations: MutationsShape;
}

export function CollectionListTable({
  collections,
  detailQuery,
  selection,
  expandedId,
  setExpandedId,
  setPendingDelete,
  setPendingMemberDelete,
  setBanner,
  onEdit,
  mutations,
}: CollectionListTableProps) {
  const {
    reorderCollectionsMutation,
    reorderMemberMutation,
    patchMemberMutation,
  } = mutations;

  function handleReorderCollections(index: number, step: -1 | 1) {
    const next = moveMemberIds(
      collections.map((c) => c.id),
      index,
      step,
    );
    const current = collections.map((c) => c.id);
    if (next.join(',') !== current.join(',')) {
      reorderCollectionsMutation.mutate({ collectionIds: next });
    }
  }

  return (
    <ManageSectionCard
      title="合集列表"
      description="点击行首箭头展开成员明细；删除合集会级联移除全部成员。"
    >
      <CollectionPresetCreate onCreated={setBanner} />
      {collections.length === 0 ? (
        <div className={styles.emptyInlineState}>
          还没有任何收藏合集，先从右上角新建一个。
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.rowActions} style={{ marginBottom: 8 }}>
            <button className={styles.smallButton} type="button" onClick={selection.selectAll}>
              全选
            </button>
            <button className={styles.smallButton} type="button" onClick={selection.invertVisible}>
              反选
            </button>
            <button className={styles.smallButton} type="button" onClick={selection.clearVisible}>
              清空本页
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <Checkbox
                    checked={
                      selection.headerState === 'checked'
                        ? true
                        : selection.headerState === 'indeterminate'
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={() => {
                      if (selection.headerState === 'checked') selection.clearVisible();
                      else selection.selectAll();
                    }}
                    aria-label="全选合集"
                  />
                </th>
                <th>合集</th>
                <th>来源</th>
                <th>可见性</th>
                <th>更新时间</th>
                <th className="nowrap">排序</th>
                <th className="nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection, index) => {
                const expanded = expandedId === collection.id;
                return (
                  <Fragment key={collection.id}>
                    <tr>
                      <td>
                        <Checkbox
                          checked={selection.selectedSet.has(collection.id)}
                          onClick={(event) => {
                            if (event.shiftKey) {
                              event.preventDefault();
                              selection.toggle(collection.id, !selection.selectedSet.has(collection.id), {
                                shiftKey: true,
                              });
                            }
                          }}
                          onCheckedChange={(checked) =>
                            selection.toggle(collection.id, checked === true)
                          }
                          aria-label={`选择合集 ${collection.title}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.smallButton}
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : collection.id)}
                        >
                          {expanded ? '收起' : '成员'}
                        </button>
                        <span style={{ marginLeft: 8 }}>{collection.title}</span>
                      </td>
                      <td>{SOURCE_LABELS[collection.sourceKind] ?? collection.sourceKind}</td>
                      <td>
                        <StatusBadge
                          label={VISIBILITY_LABELS[collection.visibility] ?? collection.visibility}
                          variant={collection.visibility === 'Active' ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="nowrap">{formatEpochMs(collection.updatedAt)}</td>
                      <td className="nowrap">
                        <div className={styles.rowActions}>
                          <button
                            className={styles.smallButton}
                            type="button"
                            disabled={index === 0 || reorderCollectionsMutation.isPending}
                            aria-label={`将合集「${collection.title}」上移`}
                            onClick={() => handleReorderCollections(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            className={styles.smallButton}
                            type="button"
                            disabled={index === collections.length - 1 || reorderCollectionsMutation.isPending}
                            aria-label={`将合集「${collection.title}」下移`}
                            onClick={() => handleReorderCollections(index, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className="nowrap">
                        <button
                          className={styles.smallButton}
                          type="button"
                          onClick={() => onEdit(collection)}
                        >
                          编辑
                        </button>
                        <button
                          className={styles.smallDangerButton}
                          type="button"
                          onClick={() => setPendingDelete(collection)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr>
                        <td colSpan={7}>
                          <CollectionMemberAdder
                            collectionId={collection.id}
                            onAdded={setBanner}
                          />
                          <CollectionMemberPanel
                            collectionId={collection.id}
                            detailQuery={detailQuery}
                            onRemoveMember={(member) =>
                              setPendingMemberDelete({
                                collectionId: collection.id,
                                boundItemId: member.boundItemId,
                                memberTitle: member.title,
                              })
                            }
                            onReorderMembers={(memberIds) =>
                              reorderMemberMutation.mutate({
                                collectionId: collection.id,
                                input: { memberIds },
                              })
                            }
                            reorderPending={reorderMemberMutation.isPending}
                            reorderError={
                              reorderMemberMutation.isError ? reorderMemberMutation.error : undefined
                            }
                            onToggleMemberEnabled={(member) =>
                              patchMemberMutation.mutate({
                                collectionId: collection.id,
                                memberId: member.id,
                                input: { isEnabled: !member.isEnabled },
                              })
                            }
                            togglePending={patchMemberMutation.isPending}
                          />
                          <CollectionRulesPanel
                            collectionId={collection.id}
                            isRuleCollection={
                              detailQuery.data?.collection.collectionKind === 'rule'
                            }
                            rules={detailQuery.data?.rules ?? []}
                            minEffectiveMembers={
                              detailQuery.data?.collection.minEffectiveMembers ?? null
                            }
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ManageSectionCard>
  );
}
