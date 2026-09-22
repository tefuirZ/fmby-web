/**
 * W5-B：凭据动作后的状态刷新（**范围必须完整**，否则界面自相矛盾）。
 *
 * 一次绑定/重绑成功后，下面三类事实都可能变化，必须**一起**失效：
 * 1. `mounts.list`  —— 列表项的 `credential_status`（徽标/入口来源）
 * 2. `mounts.detail(id)` —— 详情的 `credential_status`（与列表同值同源派生）
 * 3. `mounts.health` —— 观察面 `last_fault_kind/last_fault_action`（补充文案来源）
 *
 * ★为什么不能只刷一部分：
 *   只刷列表 → 详情仍显示旧的「已过期」；
 *   只刷列表+详情 → 观察面仍报过期，出现「状态正常但仍提示重新绑定」的自相矛盾；
 *   只刷观察面 → 徽标不更新，动作做完入口不消失。
 *   provider 私有的账号态（如 pan115.account）由各自区块自行失效，本 hook 不越权。
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@fmby/v2-shared/query';

export function useInvalidateCredentialState() {
  const queryClient = useQueryClient();

  return useCallback(
    (mountId?: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.detail(mountId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.health() });
    },
    [queryClient],
  );
}
