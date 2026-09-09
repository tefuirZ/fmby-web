import { Fragment, useEffect, useState } from 'react';
import {
  type CollectionVisibility,
  type ManagedCollectionRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { Dialog, FeedbackState, InlineBanner, SensitiveActionDialog, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { useCollectionDetailQuery, useCollectionMutations, useCollectionsQuery } from './collections/hooks';

interface CollectionFormState {
  title: string;
  overview: string;
  posterUrl: string;
  visibility: CollectionVisibility;
}

const VISIBILITY_LABELS: Record<CollectionVisibility, string> = {
  Active: '对外可见',
  Hidden: '已隐藏',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: '手工创建',
  douban_doulist: '豆瓣片单同步',
  preset: '预设合集',
};

function createInitialFormState(): CollectionFormState {
  return { title: '', overview: '', posterUrl: '', visibility: 'Active' };
}

function buildFormStateFromRecord(record: ManagedCollectionRecord): CollectionFormState {
  return {
    title: record.title,
    overview: record.overview ?? '',
    posterUrl: record.posterUrl ?? '',
    visibility: record.visibility,
  };
}

function formatEpochMs(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function ManageCollectionsPage() {
  const collectionsQuery = useCollectionsQuery();
  const [editingRecord, setEditingRecord] = useState<ManagedCollectionRecord | null>(null);
  const [formState, setFormState] = useState<CollectionFormState>(createInitialFormState);
  const [formOpen, setFormOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedCollectionRecord | null>(null);
  const [pendingMemberDelete, setPendingMemberDelete] = useState<{ collectionId: string; memberId: string; memberTitle: string } | null>(null);

  const { createMutation, updateMutation, deleteMutation, deleteMemberMutation } =
    useCollectionMutations({
      onSuccess: (message) => {
        setBanner(message);
      },
    });

  const detailQuery = useCollectionDetailQuery(expandedId);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timer = window.setTimeout(() => setBanner(null), 4200);
    return () => window.clearTimeout(timer);
  }, [banner]);

  if (collectionsQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载收藏合集"
        description="正在同步合集列表与来源形态。"
      />
    );
  }

  if (collectionsQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="收藏合集加载失败"
        description={getErrorMessage(collectionsQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => collectionsQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const collections = collectionsQuery.data ?? [];
  const manualCount = collections.filter((c) => c.sourceKind === 'manual').length;
  const hiddenCount = collections.filter((c) => c.visibility === 'Hidden').length;

  const actionError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? deleteMemberMutation.error;
  const formPending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditingRecord(null);
    setFormState(createInitialFormState());
    setFormOpen(true);
  }

  function openEdit(record: ManagedCollectionRecord) {
    setEditingRecord(record);
    setFormState(buildFormStateFromRecord(record));
    setFormOpen(true);
  }

  function submitForm() {
    const input = {
      title: formState.title.trim(),
      overview: formState.overview.trim() || undefined,
      posterUrl: formState.posterUrl.trim() || undefined,
      visibility: formState.visibility,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="收藏合集管理"
        description="手工合集的创建、改名与上下线都在这里；豆瓣同步与预设合集只读维护。"
        meta={
          <span className={styles.metaText}>
            当前共 {collections.length} 个合集，其中手工创建 {manualCount} 个、隐藏 {hiddenCount} 个
          </span>
        }
        actions={
          <button className={styles.primaryButton} type="button" onClick={openCreate}>
            新建合集
          </button>
        }
      />

      {banner ? (
        <InlineBanner variant="success" title={banner} description="操作已写回服务端。" />
      ) : null}

      {actionError ? (
        <InlineBanner
          variant="error"
          title="合集操作失败"
          description={getErrorMessage(actionError)}
        />
      ) : null}

      <ManageSectionCard
        title="合集列表"
        description="点击行首箭头展开成员明细；删除合集会级联移除全部成员。"
      >
        {collections.length === 0 ? (
          <div className={styles.emptyInlineState}>
            还没有任何收藏合集，先从右上角新建一个。
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>合集</th>
                  <th>来源</th>
                  <th>可见性</th>
                  <th>更新时间</th>
                  <th className="nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => {
                  const expanded = expandedId === collection.id;
                  return (
                    <Fragment key={collection.id}>
                      <tr>
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
                          <button
                            className={styles.smallButton}
                            type="button"
                            onClick={() => openEdit(collection)}
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
                          <td colSpan={5}>
                            <CollectionMemberPanel
                              collectionId={collection.id}
                              detailQuery={detailQuery}
                              onRemoveMember={(memberId, memberTitle) =>
                                setPendingMemberDelete({
                                  collectionId: collection.id,
                                  memberId,
                                  memberTitle,
                                })
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

      <Dialog
        open={formOpen}
        eyebrow={editingRecord ? '编辑合集' : '新建合集'}
        title={editingRecord ? `编辑：${editingRecord.title}` : '新建手工合集'}
        description="标题必填；可见性决定合集是否在浏览面出现。"
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
          }
        }}
        footer={
          <>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={formPending}
            >
              取消
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={submitForm}
              disabled={formPending || formState.title.trim().length === 0}
            >
              {formPending ? '保存中…' : editingRecord ? '保存修改' : '创建合集'}
            </button>
          </>
        }
      >
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            标题（必填，最长 512 字）
            <input
              className={styles.input}
              value={formState.title}
              maxLength={512}
              onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
              placeholder="例如：科幻经典补完计划"
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              可见性
              <select
                className={styles.select}
                value={formState.visibility}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, visibility: e.target.value as CollectionVisibility }))
                }
              >
                <option value="Active">Active（对外可见）</option>
                <option value="Hidden">Hidden（隐藏）</option>
              </select>
            </label>
            <label className={styles.label}>
              海报地址（可选，最长 512 字）
              <input
                className={styles.input}
                value={formState.posterUrl}
                maxLength={512}
                onChange={(e) => setFormState((s) => ({ ...s, posterUrl: e.target.value }))}
                placeholder="https://…"
              />
            </label>
          </div>
          <label className={styles.label}>
            简介（可选，最长 2000 字）
            <textarea
              className={styles.textarea}
              rows={4}
              value={formState.overview}
              maxLength={2000}
              onChange={(e) => setFormState((s) => ({ ...s, overview: e.target.value }))}
              placeholder="这个合集收录了什么、按什么顺序看。"
            />
          </label>
        </div>
      </Dialog>

      <SensitiveActionDialog
        open={pendingDelete !== null}
        actionKey="delete-managed-collection"
        title={pendingDelete ? `删除合集：${pendingDelete.title}` : ''}
        description="删除会同时移除合集内的全部成员记录，且不可恢复。"
        impact={[
          '物理删除，级联清空成员。',
          '豆瓣同步/预设来源的合集删除后，需要重新同步才能恢复。',
        ]}
        errorMessage={
          deleteMutation.isError ? getErrorMessage(deleteMutation.error) : undefined
        }
        confirmLabel="确认删除"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />

      <SensitiveActionDialog
        open={pendingMemberDelete !== null}
        actionKey="delete-managed-collection-member"
        title={pendingMemberDelete ? `移除成员：${pendingMemberDelete.memberTitle}` : ''}
        description="成员会从这个合集里移除，媒体本体不受影响。"
        errorMessage={
          deleteMemberMutation.isError ? getErrorMessage(deleteMemberMutation.error) : undefined
        }
        confirmLabel="确认移除"
        pending={deleteMemberMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteMemberMutation.isPending) {
            setPendingMemberDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingMemberDelete) {
            deleteMemberMutation.mutate({
              collectionId: pendingMemberDelete.collectionId,
              memberId: pendingMemberDelete.memberId,
            });
            setPendingMemberDelete(null);
          }
        }}
      />
    </div>
  );
}

interface CollectionMemberPanelProps {
  collectionId: string;
  detailQuery: ReturnType<typeof useCollectionDetailQuery>;
  onRemoveMember: (memberId: string, memberTitle: string) => void;
}

function CollectionMemberPanel({ collectionId, detailQuery, onRemoveMember }: CollectionMemberPanelProps) {
  void collectionId;
  if (detailQuery.isPending) {
    return <div className={styles.tableHint}>正在加载成员明细…</div>;
  }
  if (detailQuery.isError) {
    return (
      <div className={styles.tableHint}>成员明细加载失败：{getErrorMessage(detailQuery.error)}</div>
    );
  }
  const members = detailQuery.data?.members ?? [];
  if (members.length === 0) {
    return <div className={styles.tableHint}>这个合集还没有成员。</div>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>成员</th>
            <th>类型</th>
            <th>上映年</th>
            <th>启用</th>
            <th>release 序</th>
            <th>watch 序</th>
            <th className="nowrap">操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.titleSnapshot}</td>
              <td>{member.mediaKind}</td>
              <td>{member.yearSnapshot ?? '—'}</td>
              <td>
                <StatusBadge
                  label={member.isEnabled ? '启用' : '停用'}
                  variant={member.isEnabled ? 'success' : 'neutral'}
                />
              </td>
              <td>{member.releaseOrder ?? '—'}</td>
              <td>{member.watchOrder ?? '—'}</td>
              <td className="nowrap">
                <button
                  className={styles.smallDangerButton}
                  type="button"
                  onClick={() => onRemoveMember(member.id, member.titleSnapshot)}
                >
                  移除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ManageCollectionsPage;
