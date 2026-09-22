/**
 * 观察面故障建议映射（W5-A 去重用）。
 *
 * 观察面 = `MountHealthDto.last_fault_kind`（扫描观测落库事实，
 * `crates/fmby-v2-server/src/bridges/manage/provider_health.rs:172`），
 * 与权威凭据状态 `mount.credentialStatus` 是**两条证据链**。
 *
 * ★这里**只**产出补充文案，不参与徽标判定：
 *   徽标与行动入口的唯一来源是 credentialStatus（见 credentialPresentation 合并判据）。
 * 查询失败 → 空 map（观察面缺失不阻止列表渲染，也不降级为「已查为 0」）。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@fmby/v2-shared/contracts/manage';
import { queryKeys } from '@fmby/v2-shared/query';

export function useMountHealthFaultMap(): Record<string, string | null> {
  const healthQuery = useQuery({
    queryKey: queryKeys.manage.mounts.health(),
    queryFn: () => manageApi.getMountsHealth(),
    retry: false,
  });

  return useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const item of healthQuery.data?.items ?? []) {
      map[item.mountId] = item.lastFaultAction ?? null;
    }
    return map;
  }, [healthQuery.data]);
}
