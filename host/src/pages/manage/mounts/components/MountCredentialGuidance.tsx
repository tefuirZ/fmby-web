/**
 * 凭据过期引导（DATASOURCE-CRUD-BACKFILL-UI 项 3）。
 *
 * 依据：后端 `MountHealthDto.last_fault_kind == "credential_expired"`
 * （`crates/fmby-v2-http/src/dto/manage.rs`，扫描观测落库事实 0049）。
 *
 * ★诚实边界：只有**明确观测到** credential_expired 才提示「凭据已过期」；
 *   `last_fault_kind === null`（无观测）显示「未知」，**不伪造**过期结论。
 * ★用户裁定（2026-09-22 16:15）：不做本地预检，靠上游 401 浮出 + 管理员看得见。
 */

import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { resolveCredentialGuidance } from '../formUtils';
import styles from '../../ManagePages.module.css';

interface MountCredentialGuidanceProps {
  mountId: string;
  /** 重绑入口（由宿主按 provider 提供；未给则只提示、不假造按钮）。 */
  onRebind?: () => void;
  rebindLabel?: string;
}

export function MountCredentialGuidance({ mountId }: MountCredentialGuidanceProps) {
  const healthQuery = useQuery({
    queryKey: queryKeys.manage.mounts.health(),
    queryFn: () => manageApi.getMountsHealth(),
  });

  const items = healthQuery.data?.items ?? [];
  const mine = items.find((item) => item.mountId === mountId);
  const guidance = resolveCredentialGuidance(mine);

  if (healthQuery.isError || guidance.kind !== 'expired') {
    return null;
  }

  return (
    <InlineBanner
      variant="error"
      title={guidance.title ?? '凭据已过期'}
      description={guidance.action ?? '该数据源凭据已过期，请重新绑定或激活后重试。'}
    />
  );
}

export function MountCredentialRebindAction({
  mountId,
  onRebind,
  rebindLabel = '重新绑定凭据',
}: MountCredentialGuidanceProps) {
  const healthQuery = useQuery({
    queryKey: queryKeys.manage.mounts.health(),
    queryFn: () => manageApi.getMountsHealth(),
  });

  const items = healthQuery.data?.items ?? [];
  const mine = items.find((item) => item.mountId === mountId);
  const guidance = resolveCredentialGuidance(mine);

  if (guidance.kind !== 'expired' || !onRebind) {
    return null;
  }

  return (
    <button className={styles.primaryButton} type="button" onClick={onRebind}>
      {rebindLabel}
    </button>
  );
}
