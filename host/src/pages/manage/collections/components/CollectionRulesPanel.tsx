/**
 * 合集 · 规则编辑面板（FE-COLLECTIONS-CONSUME-B3，仅 rule 合集显示）。
 *
 * 消费：
 *  - POST /api/manage/collections/rules/preview  {min_effective_members?, rules[]}
 *  - PATCH /api/manage/collections/{id}/rules      {auto_expand_enabled?, min_effective_members?, artwork_mode?, rules[]}
 *  - POST /api/manage/collections/{id}/sync        （手动同步，仅 rule 合集）
 *
 * 交互（用户可完成的一件事）：
 *  - 增/删规则（8 类条件 person/genre/studio/year/decade/rating/library/media_type）
 *  - 预览命中数（可见性）
 *  - 保存规则（单事务覆盖替换，后端整组重算成员）
 *  - 手动同步（按规则重算成员）
 *
 * 失败态分清：404 合集/成员不存在 / 409 冲突 / 403 无权限 / 400 规则非法，不吞不假成功。
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type CollectionRuleType,
  type ManagedCollectionRuleInput,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { getErrorMessage, isApiError } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { useCollectionMutations } from '../hooks';

const RULE_TYPES: CollectionRuleType[] = [
  'person',
  'genre',
  'studio',
  'year',
  'decade',
  'rating',
  'library',
  'media_type',
];

const RULE_TYPE_LABELS: Record<string, string> = {
  person: '人物',
  genre: '类型',
  studio: '制片厂',
  year: '年份',
  decade: '年代',
  rating: '评分',
  library: '媒体库',
  media_type: '媒体形态',
};

function failureTitle(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'HTTP_404' || error.code === 'not_found') return '合集不存在';
    if (error.code === 'HTTP_409' || error.code === 'conflict') return '规则冲突';
    if (error.code === 'HTTP_403' || error.code === 'forbidden') return '没有权限';
    if (error.code === 'HTTP_401' || error.code === 'unauthorized') return '登录状态已失效';
  }
  return '操作失败';
}

interface RuleDraft extends ManagedCollectionRuleInput {
  /** 客户端临时 id，便于列表增删（后端返回时才稳定）。 */
  key: string;
}

interface CollectionRulesPanelProps {
  collectionId: string;
  isRuleCollection: boolean;
  rules: ManagedCollectionRuleLike[];
  minEffectiveMembers: number | null;
}

interface ManagedCollectionRuleLike {
  id?: string;
  ruleType: string;
  isExclusion: boolean;
  values: string[];
}

export function CollectionRulesPanel({
  collectionId,
  isRuleCollection,
  rules,
  minEffectiveMembers,
}: CollectionRulesPanelProps) {
  const queryClient = useQueryClient();
  const { updateCollectionRulesMutation, syncCollectionMutation } = useCollectionMutations({
    onSuccess: (message) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.collections.all() });
      setBanner(message);
    },
  });
  const [banner, setBanner] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<RuleDraft[]>(
    rules.map((r, i) => ({
      key: `r-${i}`,
      ruleType: r.ruleType,
      isExclusion: r.isExclusion,
      values: r.values,
    })),
  );
  const [newType, setNewType] = useState<CollectionRuleType>('genre');
  const [newValues, setNewValues] = useState('');
  const [preview, setPreview] = useState<{ matchCount: number; visible: boolean } | null>(null);

  if (!isRuleCollection) {
    return (
      <div className={styles.tableHint}>
        这是手工合集，不支持规则编辑；规则合集才能配置自动成员条件与手动同步。
      </div>
    );
  }

  const addRule = () => {
    const values = newValues
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) return;
    setDrafts((prev) => [
      ...prev,
      { key: `r-${Date.now()}`, ruleType: newType, isExclusion: false, values },
    ]);
    setNewValues('');
  };

  const removeRule = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const runPreview = async () => {
    const res = await peripheralsApi.previewCollectionRules({
      minEffectiveMembers: minEffectiveMembers ?? undefined,
      rules: drafts,
    });
    setPreview({ matchCount: res.matchCount, visible: res.visible });
  };

  const save = () => {
    updateCollectionRulesMutation.mutate({
      collectionId,
      input: {
        minEffectiveMembers: minEffectiveMembers ?? undefined,
        rules: drafts,
      },
    });
  };

  return (
    <div className={styles.fieldGroup}>
      {banner ? (
        <InlineBanner variant="success" title={banner} description="操作已写回服务端。" />
      ) : null}

      <div className={styles.label}>当前规则（{drafts.length} 条）</div>
      {drafts.length === 0 ? (
        <div className={styles.tableHint}>还没有规则；添加一条条件以自动聚合成员。</div>
      ) : (
        <ul className={styles.listPlain}>
          {drafts.map((d) => (
            <li key={d.key} className={styles.rowActions}>
              <span>
                {d.isExclusion ? '排除 ' : '包含 '}
                {RULE_TYPE_LABELS[d.ruleType] ?? d.ruleType}：{d.values.join('、')}
              </span>
              <button
                className={styles.smallDangerButton}
                type="button"
                aria-label={`删除规则 ${RULE_TYPE_LABELS[d.ruleType] ?? d.ruleType}`}
                onClick={() => removeRule(d.key)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.label}>
          添加条件
          <select
            className={styles.input}
            value={newType}
            onChange={(event) => setNewType(event.target.value as CollectionRuleType)}
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RULE_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          取值（逗号或换行分隔）
          <input
            className={styles.input}
            value={newValues}
            placeholder="例如：科幻,动作"
            onChange={(event) => setNewValues(event.target.value)}
          />
        </label>
        <div className={styles.buttonRow}>
          <button className={styles.smallButton} type="button" onClick={addRule}>
            添加规则
          </button>
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button
          className={styles.smallButton}
          type="button"
          disabled={drafts.length === 0}
          onClick={() => void runPreview()}
        >
          预览命中数
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={drafts.length === 0 || updateCollectionRulesMutation.isPending}
          onClick={save}
        >
          {updateCollectionRulesMutation.isPending ? '保存中…' : '保存规则'}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={syncCollectionMutation.isPending}
          onClick={() => syncCollectionMutation.mutate(collectionId)}
        >
          {syncCollectionMutation.isPending ? '同步中…' : '手动同步'}
        </button>
      </div>

      {preview ? (
        <InlineBanner
          variant="info"
          title={`命中 ${preview.matchCount} 个条目`}
          description={preview.visible ? '达到生效门槛，规则可见。' : '未达到生效门槛（min_effective_members）。'}
        />
      ) : null}

      {updateCollectionRulesMutation.isError ? (
        <InlineBanner
          variant="error"
          title={failureTitle(updateCollectionRulesMutation.error)}
          description={getErrorMessage(updateCollectionRulesMutation.error)}
        />
      ) : null}
      {syncCollectionMutation.isError ? (
        <InlineBanner
          variant="error"
          title={failureTitle(syncCollectionMutation.error)}
          description={getErrorMessage(syncCollectionMutation.error)}
        />
      ) : null}
    </div>
  );
}
