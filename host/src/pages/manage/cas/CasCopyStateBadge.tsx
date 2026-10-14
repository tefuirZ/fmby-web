/**
 * fmby-web#8：CAS 扇出副本状态徽章（卡面目标 2「扇出状态与徽章展示」）。
 *
 * 纯展示逻辑在 ./formatCasDrive（抽出以便行为断言 —— 留在组件里就只能靠读
 * 源码字符串断言，那种断言对「把未知默认成已复制」的变异是恒绿的）。
 *
 * ★四条不伪造事实（承契约层 `casAdmin/types.ts`）：
 * 1. `copyState` 是后端开放字符串 ⇒ 未知值**显示原文码**，绝不默认「已复制」；
 * 2. `sizeBytes === null` ⇒ 「大小未知」，不显示 0 字节；
 * 3. `lastVerifiedAt === null` ⇒ 「未核验」，不显示 1970 年；
 * 4. #671 `reason_code`：**key 缺失 = 无原因** ⇒ **整行不渲染**，
 *    绝不渲染空串（那会把「健康」画成「有原因但空白」）。
 */

import { StatusBadge } from '@fmby/v2-shared/ui';
import type { CasDriveStatus } from '@fmby/v2-shared/contracts/manage/casAdmin';
import {
  formatSize,
  formatVerifiedAt,
  hasFailureReason,
  resolveCopyStateLabel,
  resolveCopyStateTone,
  resolveReasonDetail,
  resolveReasonLabel,
} from './formatCasDrive';

export function CasCopyStateBadge({ drive }: { drive: CasDriveStatus }) {
  // ★「有无原因」走纯函数，且**区分 key 不存在 vs 存在但为空**（rb01 硬要求）。
  const showReason = hasFailureReason(drive.reasonCode, drive.reasonCodePresent);
  const detail = resolveReasonDetail(drive.reasonDetail);

  return (
    <div>
      <StatusBadge
        label={resolveCopyStateLabel(drive.copyState)}
        variant={resolveCopyStateTone(drive.copyState)}
      />
      <div>
        {drive.providerType} · {drive.driveRef}
      </div>
      <div>
        {formatSize(drive.sizeBytes)} · {formatVerifiedAt(drive.lastVerifiedAt)}
      </div>
      {showReason ? (
        <div>
          <span>失败原因：{resolveReasonLabel(drive.reasonCode, drive.reasonCodePresent)}</span>
          {detail ? <span>（{detail}）</span> : null}
        </div>
      ) : null}
    </div>
  );
}