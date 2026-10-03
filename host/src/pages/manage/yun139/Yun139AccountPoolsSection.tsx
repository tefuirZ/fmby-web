/**
 * 139 账号池管理面（FE-YUN139-POOLS-UI）。
 *
 * 契约层（段 A 8 方法）此前已合入，本卡补 **UI**：池列表 + 建/改名/删除 + 成员增删。
 *
 * ★字段与解包键按 `shared/src/contracts/manage/yun139/{types,api}.ts` 实测（不凭记忆）：
 *   - 列表 `items` / 单池 `pool` / 成员列表 `items` / 加成员 `member` / 删除 `ok`（布尔）。
 *   - 时间字段（createdAt/updatedAt/payloadExpiresAt…）为 **epoch 毫秒**；池无时间展示需求。
 *   - 建池除 name 外均可省；改池 **PATCH**（只发要改的字段）；加成员 weight 可省 ⇒ 不传。
 *
 * ★复用既有外壳/样式（不新造）：`ManageSectionCard` / `ConfirmDialog` /
 *   `FeedbackState` / `InlineBanner` / `StatusBadge` + `ManageShared.module.css`，
 *   形态照 `Yun139ProfilesSection.tsx`。
 * ★错误文案走既有 `getErrorMessage` 出后端原文，不本地臆造。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  yun139Api,
  type Yun139AccountPool,
  type Yun139AccountPoolMember,
} from '@fmby/v2-shared/contracts/manage/yun139';
import { queryKeys } from '@fmby/v2-shared/query';
import { ConfirmDialog, FeedbackState, InlineBanner, StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';

function invalidatePools(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.manage.yun139.pools() });
}

function invalidateMembers(
  queryClient: ReturnType<typeof useQueryClient>,
  poolId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.manage.yun139.poolMembers(poolId),
  });
}

export function Yun139AccountPoolsSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 新建表单
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // 改名
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // 删除确认（不可逆）
  const [pendingDelete, setPendingDelete] = useState<Yun139AccountPool | null>(null);

  // 当前展开成员的池
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [memberProfileId, setMemberProfileId] = useState('');
  const [memberWeight, setMemberWeight] = useState('');

  const poolsQuery = useQuery({
    queryKey: queryKeys.manage.yun139.pools(),
    queryFn: () => yun139Api.listAccountPools(),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.manage.yun139.poolMembers(expandedPoolId ?? undefined),
    queryFn: () =>
      expandedPoolId ? yun139Api.listAccountPoolMembers(expandedPoolId) : Promise.resolve([]),
    enabled: Boolean(expandedPoolId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      yun139Api.createAccountPool({
        name: newName.trim(),
        // 描述留空 ⇒ 不发送（后端 Option）
        ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setNotice('账号池已创建。');
      setNewName('');
      setNewDescription('');
      invalidatePools(queryClient);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const renameMutation = useMutation({
    mutationFn: ({ poolId, name }: { poolId: string; name: string }) =>
      yun139Api.updateAccountPool(poolId, { name }),
    onSuccess: () => {
      setError(null);
      setNotice('账号池已改名。');
      setRenamingId(null);
      invalidatePools(queryClient);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (poolId: string) => yun139Api.deleteAccountPool(poolId),
    onSuccess: () => {
      setError(null);
      setNotice('账号池已删除。');
      setPendingDelete(null);
      invalidatePools(queryClient);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ poolId, profileId, weight }: { poolId: string; profileId: string; weight?: number }) =>
      // weight 留空 ⇒ 不传，交后端缺省
      yun139Api.addAccountPoolMember(poolId, weight === undefined ? { profileId } : { profileId, weight }),
    onSuccess: () => {
      setError(null);
      setNotice('成员已加入。');
      setMemberProfileId('');
      setMemberWeight('');
      invalidateMembers(queryClient, expandedPoolId ?? '');
      invalidatePools(queryClient);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ poolId, profileId }: { poolId: string; profileId: string }) =>
      yun139Api.removeAccountPoolMember(poolId, profileId),
    onSuccess: () => {
      setError(null);
      setNotice('成员已移除。');
      invalidateMembers(queryClient, expandedPoolId ?? '');
      invalidatePools(queryClient);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const pools = poolsQuery.data ?? [];
  const members: Yun139AccountPoolMember[] = membersQuery.data ?? [];

  function renderBody() {
    if (poolsQuery.isPending) {
      return <div className={styles.fieldHint}>正在读取账号池…</div>;
    }

    if (poolsQuery.isError) {
      return (
        <FeedbackState
          variant="error"
          title="无法读取账号池"
          description={getErrorMessage(poolsQuery.error)}
          action={
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void poolsQuery.refetch()}
            >
              重试
            </button>
          }
        />
      );
    }

    if (pools.length === 0) {
      return (
        <FeedbackState
          variant="empty"
          title="尚无账号池"
          description="创建账号池后可集中调度 139 凭据档案。"
        />
      );
    }

    return (
      <ul className={styles.entityGrid}>
        {pools.map((pool) => (
          <li key={pool.id} className={styles.entityCard}>
            <div className={styles.batchHeaderRow}>
              <span className={styles.activityTitle}>{pool.name}</span>
              <StatusBadge
                label={pool.isEnabled ? '启用' : '停用'}
                variant={pool.isEnabled ? 'success' : 'neutral'}
              />
            </div>

            {pool.description ? (
              <p className={styles.tableHint}>{pool.description}</p>
            ) : null}

            <div className={styles.batchMetaRow}>
              <span>策略 {pool.strategy}</span>
              <span>成员 {pool.memberCount}</span>
              <span>并发 {pool.maxConcurrent}</span>
              <span>冷却 {pool.cooldownSeconds}s</span>
            </div>

            {renamingId === pool.id ? (
              <div className={styles.buttonRow}>
                <input
                  className={styles.input}
                  aria-label="账号池新名称"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={renameMutation.isPending}
                  onClick={() =>
                    renameMutation.mutate({ poolId: pool.id, name: renameDraft.trim() })
                  }
                >
                  保存
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setRenamingId(null)}
                >
                  取消
                </button>
              </div>
            ) : null}

            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setRenamingId(pool.id);
                  setRenameDraft(pool.name);
                }}
              >
                改名
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-expanded={expandedPoolId === pool.id}
                onClick={() =>
                  setExpandedPoolId((prev) => (prev === pool.id ? null : pool.id))
                }
              >
                {expandedPoolId === pool.id ? '收起成员' : '管理成员'}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => setPendingDelete(pool)}
              >
                删除
              </button>
            </div>

            {expandedPoolId === pool.id ? (
              <div className={styles.batchDetailPanel}>
                {membersQuery.isPending ? (
                  <div className={styles.fieldHint}>正在读取成员…</div>
                ) : membersQuery.isError ? (
                  <InlineBanner variant="error" title={getErrorMessage(membersQuery.error)} />
                ) : members.length === 0 ? (
                  <div className={styles.fieldHint}>该池暂无成员。</div>
                ) : (
                  <ul className={styles.activityList}>
                    {members.map((m) => (
                      <li key={m.profileId} className={styles.activityItem}>
                        <span className={styles.activityTitle}>
                          {m.profileLabel ?? m.profileId}
                        </span>
                        <span className={styles.activityTime}>
                          权重 {m.weight} · 失败 {m.failCount}
                          {m.profileStatus ? ` · ${m.profileStatus}` : ''}
                        </span>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={removeMemberMutation.isPending}
                          onClick={() =>
                            removeMemberMutation.mutate({
                              poolId: pool.id,
                              profileId: m.profileId,
                            })
                          }
                        >
                          移除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.buttonRow}>
                  <input
                    className={styles.input}
                    aria-label="加入成员的凭据档案 ID"
                    placeholder="凭据档案 ID"
                    value={memberProfileId}
                    onChange={(e) => setMemberProfileId(e.target.value)}
                  />
                  <input
                    className={styles.input}
                    aria-label="成员权重（可留空）"
                    placeholder="权重（可留空）"
                    value={memberWeight}
                    onChange={(e) => setMemberWeight(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={addMemberMutation.isPending || !memberProfileId.trim()}
                    onClick={() => {
                      const trimmedWeight = memberWeight.trim();
                      addMemberMutation.mutate({
                        poolId: pool.id,
                        profileId: memberProfileId.trim(),
                        ...(trimmedWeight ? { weight: Number(trimmedWeight) } : {}),
                      });
                    }}
                  >
                    加入成员
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ManageSectionCard
        title="139 账号池"
        description="集中调度 139 凭据档案：按策略分配账号、限制并发与失败冷却。删除不可逆。"
      >
        {notice ? <InlineBanner variant="success" title={notice} /> : null}
        {error ? <InlineBanner variant="error" title={error} /> : null}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            新池名称（必填）
            <input
              className={styles.input}
              aria-label="新账号池名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            描述（可留空）
            <input
              className={styles.input}
              aria-label="新账号池描述"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={createMutation.isPending || !newName.trim()}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? '创建中…' : '新建账号池'}
          </button>
        </div>

        {renderBody()}
      </ManageSectionCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除账号池"
        description={
          pendingDelete
            ? `确定删除「${pendingDelete.name}」？该操作不可逆，池内成员关系一并移除。`
            : ''
        }
        confirmLabel="删除"
        pending={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
      />
    </>
  );
}
