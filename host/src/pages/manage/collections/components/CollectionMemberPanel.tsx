/** 合集成员明细面板（V1F 拆分：ManageCollectionsPage → 子组件）。 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { useCollectionDetailQuery } from '../hooks';
import { moveMemberIds } from './memberReorder';

interface CollectionMemberPanelProps {
  collectionId: string;
  detailQuery: ReturnType<typeof useCollectionDetailQuery>;
  onRemoveMember: (member: { id: string; boundItemId: string | null; title: string }) => void;
  /** 触发一次排序（member_ids = 当前顺序，按上/下移后的结果）。 */
  onReorderMembers: (memberIds: string[]) => void;
  reorderPending: boolean;
  reorderError: unknown;
}

export function CollectionMemberPanel({
  collectionId,
  detailQuery,
  onRemoveMember,
  onReorderMembers,
  reorderPending,
  reorderError,
}: CollectionMemberPanelProps) {
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

  const orderedIds = members.map((m) => m.id);

  const handleMove = (index: number, step: -1 | 1) => {
    const next = moveMemberIds(orderedIds, index, step);
    if (next !== orderedIds) onReorderMembers(next);
  };

  return (
    <div>
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
              <th className="nowrap">排序</th>
              <th className="nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
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
                  <div className={styles.rowActions}>
                    <button
                      className={styles.smallButton}
                      type="button"
                      disabled={index === 0 || reorderPending}
                      aria-label={`将「${member.titleSnapshot}」上移`}
                      onClick={() => handleMove(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className={styles.smallButton}
                      type="button"
                      disabled={index === members.length - 1 || reorderPending}
                      aria-label={`将「${member.titleSnapshot}」下移`}
                      onClick={() => handleMove(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="nowrap">
                  <button
                    className={styles.smallDangerButton}
                    type="button"
                    aria-label={`移除成员「${member.titleSnapshot}」`}
                    onClick={() =>
                      onRemoveMember({
                        id: member.id,
                        boundItemId: member.boundItemId,
                        title: member.titleSnapshot,
                      })
                    }
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reorderError ? (
        <div className={styles.tableHint}>排序失败：{getErrorMessage(reorderError)}</div>
      ) : null}
    </div>
  );
}
