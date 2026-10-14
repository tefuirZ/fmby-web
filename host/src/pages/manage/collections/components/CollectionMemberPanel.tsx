/** 合集成员明细面板（V1F 拆分：ManageCollectionsPage → 子组件）。 */

import { useRef } from 'react';

import { StatusBadge } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '../../longtail-shared/ManageShared.module.css';
import type { useCollectionDetailQuery } from '../hooks';
import { moveMemberIds } from './memberReorder';
import { useTableRowRoving } from '../../../../features/a11y/useTableRowRoving';

interface CollectionMemberPanelProps {
  collectionId: string;
  detailQuery: ReturnType<typeof useCollectionDetailQuery>;
  onRemoveMember: (member: { id: string; boundItemId: string | null; title: string }) => void;
  /** 触发一次排序（member_ids = 当前顺序，按上/下移后的结果）。 */
  onReorderMembers: (memberIds: string[]) => void;
  reorderPending: boolean;
  reorderError: unknown;
  /** 切换成员启用/停用（PATCH /members/{member_id} {is_enabled}）。 */
  onToggleMemberEnabled: (member: { id: string; title: string; isEnabled: boolean }) => void;
  togglePending: boolean;
}

export function CollectionMemberPanel({
  collectionId,
  detailQuery,
  onRemoveMember,
  onReorderMembers,
  reorderPending,
  reorderError,
  onToggleMemberEnabled,
  togglePending,
}: CollectionMemberPanelProps) {
  void collectionId;

  // FE-LIST-KEYNAV-10（A 方案）：本表是**子表**，DOM 上嵌在父表（CollectionListTable）
  // 展开行的 <td> 里。父子**各自独立索引域** ⇒ 这里同样从 0 起算，不与父表拼接，
  // 父表的 data-row-index 也不会被本表影响（两个 tbody 互不读写）。
  // 行内已有 4 个真按钮（上移/下移/启用停用/移除），均有原生 Tab 序 ⇒ 不传 onActivate，
  // 不凭空给行加 Enter 语义。
  //
  // ⚠ hook 必须放在**所有 early return 之前**（Hooks 规则）：本组件上面有三个
  // early return（加载中 / 加载失败 / 空成员），把 hook 放在它们之后会让
  // 「本组件是否含 hook」随数据变化 ⇒ React 报
  // `Internal React error: Expected static flag was missing`（实测复现）。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef, rowCount: detailQuery.data?.members?.length ?? 0 });

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
      <div className={styles.tableWrap} role="region" aria-label="合集成员明细（可横向滚动）">
        {/* 子表**降级为普通 table**（rv02 Important-1 放行选项1）：去掉 role=treegrid 与 aria-level。
            理由：父子是「父表 treegrid（可展开树）+ 子表数据明细表」的现实语义；子表若标
            treegrid + aria-level，会因「独立 treegrid 内 level 无 level=1 祖先」成孤儿层级（r1 判据）。
            去掉后子表是普通数据表，父子层级由**父行 aria-expanded** + **DOM 嵌套**（本表在父表
            展开行 <td> 内）表达，spec 合规。加 aria-label 让 AT 播报表名。
            roving 独立（A 方案）**不动**——用 data-row-index，不依赖 role（useTableRowRoving 不查 role）。
            详见 CollectionListTable 顶部注释。 */}
        <table className={styles.table} aria-label="合集成员明细">
          <thead>
            <tr>
              <th>成员</th>
              <th>类型</th>
              <th>上映年</th>
              <th>启用</th>
              <th>release 序</th>
              <th>watch 序</th>
              <th className="nowrap">排序</th>
              <th className="nowrap">启用</th>
              <th className="nowrap">操作</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {members.map((member, index) => (
              <tr key={member.id} data-row-index={index}>
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
                    className={styles.smallButton}
                    type="button"
                    disabled={togglePending}
                    aria-pressed={member.isEnabled}
                    aria-label={`${member.isEnabled ? '停用' : '启用'}成员「${member.titleSnapshot}」`}
                    onClick={() =>
                      onToggleMemberEnabled({
                        id: member.id,
                        title: member.titleSnapshot,
                        isEnabled: member.isEnabled,
                      })
                    }
                  >
                    {member.isEnabled ? '停用' : '启用'}
                  </button>
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
