/**
 * 合集 · 从预设模板创建（FE-COLLECTIONS-CONSUME-B3）。
 *
 * 消费：
 *  - GET  /api/manage/collections/presets   （模板列表，纯静态数据零 IO）
 *  - POST /api/manage/collections/presets/create  {preset_key}
 *
 * 交互：下拉选模板 → 创建 → 列表刷新。失败态分清（404 模板不存在 / 409 已存在 / 403）。
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { peripheralsApi } from '@fmby/v2-shared/contracts/manage/peripherals';
import { getErrorMessage, isApiError } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner } from '@fmby/v2-shared/ui';
import styles from '../../longtail-shared/ManageShared.module.css';
import { useCollectionPresetsQuery } from '../hooks';

function failureTitle(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'HTTP_404' || error.code === 'not_found') return '预设模板不存在';
    if (error.code === 'HTTP_409' || error.code === 'conflict') return '合集已存在';
    if (error.code === 'HTTP_403' || error.code === 'forbidden') return '没有权限';
    if (error.code === 'HTTP_401' || error.code === 'unauthorized') return '登录状态已失效';
  }
  return '创建失败';
}

interface CollectionPresetCreateProps {
  onCreated: (message: string) => void;
}

export function CollectionPresetCreate({ onCreated }: CollectionPresetCreateProps) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState('');
  const presetsQuery = useCollectionPresetsQuery();

  const createMutation = useMutation({
    mutationFn: (presetKey: string) =>
      peripheralsApi.createCollectionFromPreset({ presetKey }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.collections.all() });
      setPicked('');
      onCreated('已从预设创建合集。');
    },
  });

  const presets = presetsQuery.data ?? [];

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        从预设模板创建合集
        <select
          className={styles.input}
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
        >
          <option value="">请选择模板…</option>
          {presets.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.title}
              {preset.itemCount ? `（${preset.itemCount} 个条目）` : ''}
            </option>
          ))}
        </select>
        <span className={styles.fieldHint}>
          预设为静态模板（漫威电影宇宙 / DC 扩展宇宙 / 福尔摩斯），一键生成带成员与规则的合集。
        </span>
      </label>

      {presetsQuery.isError ? (
        <InlineBanner
          variant="error"
          title="模板列表加载失败"
          description={getErrorMessage(presetsQuery.error)}
        />
      ) : null}

      {presets.length > 0 ? (
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!picked || createMutation.isPending}
            onClick={() => createMutation.mutate(picked)}
          >
            {createMutation.isPending ? '创建中…' : '从预设创建'}
          </button>
        </div>
      ) : null}

      {createMutation.isError ? (
        <InlineBanner
          variant="error"
          title={failureTitle(createMutation.error)}
          description={getErrorMessage(createMutation.error)}
        />
      ) : null}
    </div>
  );
}
