/** 合集成员明细面板（V1F 拆分：ManageCollectionsPage → 子组件）。 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { useCollectionDetailQuery } from '../hooks';

interface CollectionMemberPanelProps {
  collectionId: string;
  detailQuery: ReturnType<typeof useCollectionDetailQuery>;
  onRemoveMember: (memberId: string, memberTitle: string) => void;
}

export function CollectionMemberPanel({
  collectionId,
  detailQuery,
  onRemoveMember,
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
