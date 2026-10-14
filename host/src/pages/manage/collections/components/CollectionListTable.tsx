import { Fragment, useRef } from 'react';
import {
  type ManagedCollectionRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { Checkbox, StatusBadge } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';
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

  // FE-LIST-KEYNAV-10：全仓唯一一处**逻辑父子表**（展开行的 td 里再出一张表）。
  // 主代理裁决 = A 方案：外层 tbody 与子 tbody **各自独立索引域**，`data-row-index` 各从 0 起。
  // 子表的域在 CollectionMemberPanel 内部自己接（见该文件注释），这里只管外层。
  // 展开行 <tr>（colSpan=7 那条）**不给** data-row-index：它不是数据行，
  // 给它索引会让父表行数与「合集条数」不一致 ⇒ ↑↓ 落到一个纯容器行上，语义错。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: collections.length });

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
          {/* treegrid 语义（rv02 评审返工）：父子各为**独立 treegrid**（A 方案：父子 roving 域
              各自独立）⇒ **不并入单一 treegrid**（那会合并两个索引域、破坏 A 方案）。每张表是
              自洽 treegrid、根级 aria-level 从 1 起；父子层级由 **DOM 嵌套**（子表在父展开行 <td> 内）
              + 父行 aria-expanded 传达，**不靠跨表续接 aria-level**（子表 aria-level=2 会是孤儿层级，
              spec 不合规）。
              · 父行 aria-level=1 + aria-expanded（treegrid treeitem 承载展开态）；
              · 展开按钮亦带 aria-expanded（disclosure 控件）—— 行覆盖 roving 聚焦、按钮覆盖
                Tab 聚焦，两种焦点都不丢展开态反馈（rv02 ②）；
              · 子行 aria-level=1（子表自己的根级，见 CollectionMemberPanel）。
              · 展开行(colSpan)不给索引/层级：它是容器非数据行。 */}
          <table className={styles.table} role="treegrid">
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
            <tbody ref={tbodyRef}>
              {collections.map((collection, index) => {
                const expanded = expandedId === collection.id;
                return (
                  <Fragment key={collection.id}>
                    <tr data-row-index={index} aria-level={1} aria-expanded={expanded}>
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
