import { useEffect, useRef } from 'react';
import { buildMountFormState } from '../formUtils';
import type { ManageMountDetailRecord } from '@fmby/v2-shared/contracts/manage';
import type {
  MountDrawerState,
  MountFormErrors,
  MountFormState,
} from '../types';

/**
 * F-47：编辑抽屉预填，且**只认「换了一条 mount / 首次拿到详情」**。
 *
 * 背景：原先这段预填 effect 的 deps 含 detailQuery.data（对象引用），而详情
 * query 在有 pending/running 扫描任务时 1.5s 轮询 ⇒ 扫描运行期间打开抽屉，
 * 服务端每 1.5s 回一个新对象 ⇒ effect 重跑 ⇒ 用户正在输入的表单被旧值覆盖。
 *
 * 判据用 mountId 而非数据引用：同一 mount 的后续刷新不再重置；换 mount 仍正常
 * 预填。关抽屉时调用 `resetPrefill()` 清标记，否则重开**同一个** mount 会被当成
 * 「已预填」而跳过预填、抽屉显示空白。
 */
export function useMountDrawerPrefill(args: {
  drawerState: MountDrawerState | null;
  detail: ManageMountDetailRecord | undefined;
  setFormState: (state: MountFormState) => void;
  setFormErrors: (errors: MountFormErrors) => void;
  clearDirectoryBrowser: () => void;
}): { resetPrefill: () => void } {
  const { drawerState, detail, setFormState, setFormErrors, clearDirectoryBrowser } = args;
  const prefilledMountIdRef = useRef<string | null>(null);
  const mountKey = drawerState?.mode === 'edit' ? drawerState.mountId ?? null : null;

  useEffect(() => {
    if (!mountKey || !detail) {
      return;
    }
    if (prefilledMountIdRef.current === mountKey) {
      return;
    }
    prefilledMountIdRef.current = mountKey;
    setFormState(buildMountFormState(detail));
    setFormErrors({});
    clearDirectoryBrowser();
  }, [mountKey, detail, setFormState, setFormErrors, clearDirectoryBrowser]);

  return { resetPrefill: () => { prefilledMountIdRef.current = null; } };
}
