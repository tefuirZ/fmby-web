/**
 * CAS 编排页（fmby-web#8 卡面目标 1「多盘扇出配置/触发/状态」+ 目标 2 的容器）。
 *
 * 数据源 = fmby-v2 #42-N5（PR #378）提供的四端点：
 *   GET/PUT /api/admin/cas/drives、GET /api/admin/cas/fanout/{contentId}、
 *   GET /api/admin/cas/reconcile。契约层见 `contracts/manage/casAdmin`。
 *
 * ★fail-closed：端口未装配（后端 fail-closed 500 / not_implemented）时显示
 *   「服务未启用」并**停止请求**，**不得**渲染成「0 个盘」这类看似正常的空态 ——
 *   那会让运维以为「配好了但一个盘都没有」。
 *
 * 范式照 ManageEmailChannelPage：GET 载入回显、PUT 提交、queryKeys 工厂键、
 * 组件保持在 400 行门禁内（component-size）。
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  casAdminApi,
  type CasDriveConfig,
} from '@fmby/v2-shared/contracts/manage/casAdmin';
import { isServiceUnwiredError } from '@fmby/v2-shared/contracts/manage/peripherals';
import { FeedbackState, InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { queryKeys } from '@fmby/v2-shared/query';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { CasCopyStateBadge } from './cas/CasCopyStateBadge';

export function ManageCasPage() {
  const queryClient = useQueryClient();
  const [contentIdInput, setContentIdInput] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const drivesQuery = useQuery({
    queryKey: queryKeys.manage.cas.drives(),
    queryFn: async () => {
      try {
        return await casAdminApi.listDriveConfigs();
      } catch (err) {
        // 端口未装配 ⇒ 归一为 null，让下面显式渲染「未启用」而非空态。
        if (isServiceUnwiredError(err)) return null;
        throw err;
      }
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (config: CasDriveConfig) => casAdminApi.upsertDriveConfig(config),
    onSuccess: async () => {
      setBanner('盘配置已保存');
      await queryClient.invalidateQueries({ queryKey: queryKeys.manage.cas.drives() });
    },
    onError: (err) => setBanner(getErrorMessage(err)),
  });

  const unwired = drivesQuery.data === null;

  return (
    <>
      <ManagePageHeader
        title="CAS 编排"
        description="多盘扇出配置与状态（后端 #42-N5）。未启用时不会显示成空列表。"
      />

      {unwired ? (
        <InlineBanner
          variant="warning"
          title="CAS 编排服务未启用（后端端口未装配），以下功能不可用。"
        />
      ) : (
        <ManageSectionCard title="盘配置（CAS 矩阵）">
          {drivesQuery.isPending ? (
            <FeedbackState variant="loading" title="载入盘配置…" description="正在读取 CAS 矩阵配置。" />
          ) : drivesQuery.isError ? (
            <FeedbackState
              variant="error"
              title="盘配置载入失败"
              description={getErrorMessage(drivesQuery.error)}
            />
          ) : (
            <DriveConfigTable
              configs={drivesQuery.data ?? []}
              onSave={(config) => upsertMutation.mutate(config)}
              saving={upsertMutation.isPending}
            />
          )}
          {banner ? <InlineBanner variant="info" title={banner} /> : null}
        </ManageSectionCard>
      )}

      <ManageSectionCard title="扇出状态">
        <FanoutLookup
          value={contentIdInput}
          onChange={setContentIdInput}
          enabled={!unwired}
        />
      </ManageSectionCard>
    </>
  );
}

function DriveConfigTable({
  configs,
  onSave,
  saving,
}: {
  configs: CasDriveConfig[];
  onSave: (config: CasDriveConfig) => void;
  saving: boolean;
}) {
  if (configs.length === 0) {
    // 空列表是**真状态**（端口装配了但一个盘都没配），与「未启用」区分开。
    return <p>尚未配置任何盘。CAS 扇出不会发生。</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>盘</th>
          <th>纳入扇出</th>
          <th>优先级</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {configs.map((config) => (
          <tr key={`${config.providerType}:${config.driveRef}`}>
            <td>
              {config.providerType} · {config.driveRef}
            </td>
            <td>{config.enabled ? '是' : '否'}</td>
            <td>{config.priority}</td>
            <td>
              <button type="button" disabled={saving} onClick={() => onSave(config)}>
                保存
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FanoutLookup({
  value,
  onChange,
  enabled,
}: {
  value: string;
  onChange: (next: string) => void;
  enabled: boolean;
}) {
  const contentId = Number(value);
  const valid = Number.isInteger(contentId) && contentId > 0;

  const fanoutQuery = useQuery({
    queryKey: queryKeys.manage.cas.fanout(contentId),
    queryFn: () => casAdminApi.fanoutStatus(contentId),
    enabled: enabled && valid,
  });

  return (
    <div>
      <label>
        内容 ID
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
        />
      </label>
      {!valid ? (
        <p>输入内容 ID 后查询其多盘副本状态。</p>
      ) : fanoutQuery.isPending ? (
        <FeedbackState variant="loading" title="查询扇出状态…" description="正在读取该内容的多盘副本。" />
      ) : fanoutQuery.isError ? (
        <FeedbackState
          variant="error"
          title="扇出状态查询失败"
          description={getErrorMessage(fanoutQuery.error)}
        />
      ) : (
        (fanoutQuery.data?.drives ?? []).map((drive) => (
          <CasCopyStateBadge
            key={`${drive.driveId}:${drive.driveRef}`}
            drive={drive}
          />
        ))
      )}
    </div>
  );
}