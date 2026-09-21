/**
 * 合集 · 添加成员流（FE-COLLECTIONS-CONSUME-B1）。
 *
 * 消费两条此前**零调用**的端点：
 *  - GET  /api/manage/collections/member-candidates?keyword=  （候选查询）
 *  - POST /api/manage/collections/{id}/members/add {item_id}  （加入成员）
 *
 * 交互：输入关键词（≥2 字符）→ 查候选 → 选条目 → 添加 → 列表刷新。
 *
 * 失败态**分清**（不吞成空列表）：
 *  - 404 合集不存在 → 提示合集已被删除；
 *  - 409 冲突（如重复/约束）→ 提示冲突；
 *  - 403 无权限 → 提示权限不足；
 *  - 其余按后端文案原样显示。
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type ManagedCollectionMemberCandidate,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { getErrorMessage, isApiError } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { useCollectionMemberCandidatesQuery } from '../hooks';

/** 按 HTTP/业务码归类失败语义（不清空列表、不假装成功）。 */
function failureTitle(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'HTTP_404' || error.code === 'not_found') return '合集不存在';
    if (error.code === 'HTTP_409' || error.code === 'conflict') return '成员冲突';
    if (error.code === 'HTTP_403' || error.code === 'forbidden') return '没有权限';
    if (error.code === 'HTTP_401' || error.code === 'unauthorized') return '登录状态已失效';
  }
  return '操作失败';
}

interface CollectionMemberAdderProps {
  collectionId: string;
  onAdded: (message: string) => void;
}

export function CollectionMemberAdder({
  collectionId,
  onAdded,
}: CollectionMemberAdderProps) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<ManagedCollectionMemberCandidate | null>(null);

  const candidatesQuery = useCollectionMemberCandidatesQuery(keyword);

  const addMutation = useMutation({
    mutationFn: (itemId: string) =>
      peripheralsApi.addCollectionMember(collectionId, { itemId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.collections.all() });
      setPicked(null);
      onAdded('成员已加入合集。');
    },
  });

  const trimmed = keyword.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 2;
  const candidates = candidatesQuery.data ?? [];

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        按关键词查找可加入的条目
        <input
          className={styles.input}
          value={keyword}
          placeholder="至少 2 个字符"
          onChange={(event) => {
            setKeyword(event.target.value);
            setPicked(null);
          }}
        />
        <span className={styles.fieldHint}>
          关键词去空白后需 ≥2 字符（后端必填，否则 400）。候选上限 30 条。
        </span>
      </label>

      {tooShort ? (
        <InlineBanner
          variant="warning"
          title="关键词太短"
          description="至少需要 2 个字符才会发起查询（避免注定 400 的请求）。"
        />
      ) : null}

      {candidatesQuery.isError ? (
        <InlineBanner
          variant="error"
          title="候选查询失败"
          description={getErrorMessage(candidatesQuery.error)}
        />
      ) : null}

      {!tooShort && trimmed.length >= 2 && candidatesQuery.isPending ? (
        <div className={styles.mutedText}>正在查询候选…</div>
      ) : null}

      {!tooShort && trimmed.length >= 2 && !candidatesQuery.isPending && candidates.length === 0 ? (
        <div className={styles.mutedText}>没有匹配的候选条目。</div>
      ) : null}

      {candidates.length > 0 ? (
        <div className={styles.fieldRow}>
          <label className={styles.label}>
            候选条目
            <select
              className={styles.input}
              value={picked?.itemId ?? ''}
              onChange={(event) => {
                const next = candidates.find((c) => c.itemId === event.target.value) ?? null;
                setPicked(next);
              }}
            >
              <option value="">请选择…</option>
              {candidates.map((candidate) => (
                <option key={candidate.itemId} value={candidate.itemId}>
                  {candidate.title}
                  {candidate.year ? `（${candidate.year}）` : ''} · {candidate.libraryName}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!picked || addMutation.isPending}
              onClick={() => picked && addMutation.mutate(picked.itemId)}
            >
              {addMutation.isPending ? '加入中…' : '加入合集'}
            </button>
          </div>
        </div>
      ) : null}

      {addMutation.isError ? (
        <InlineBanner
          variant="error"
          title={failureTitle(addMutation.error)}
          description={getErrorMessage(addMutation.error)}
        />
      ) : null}
    </div>
  );
}
