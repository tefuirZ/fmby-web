/**
 * fmby-web#671 / FE-CAS-G4：CAS 写操作**回执**的纯展示逻辑（抽出以便行为断言）。
 *
 * 为什么必须抽出来：后端在这两个端点上给了区分性回执
 *   · `CasReconcileTriggerDto{task_id, created}` —— `created=false` = 幂等命中，**没有**新建任务；
 *   · `CasRetryCopyDto{copy_state, reason_code, reason_detail}` —— `pending` = 秒传未命中
 *     **回落常规上传，不是错误**；`failed` 才是失败。
 * 而接线初版把两者都映射成 `Promise<void>`，UI 只剩「已触发 / 已重试」一句 ——
 * 那等于**两种谎**：把幂等命中说成新建、把 failed 说成已重试。这类「文案撒谎」留在 JSX 里
 * 只能靠读源码断言，改一个字就静默回归 ⇒ 落成纯函数，逐分支直接可测。
 *
 * ★口径来源＝后端 DTO 注释（`crates/fmby-v2-contracts/src/dto/cas_admin.rs`），不猜。
 */

import type { CasReconcileTrigger, CasRetryCopy } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { resolveReasonLabel } from './formatCasDrive';

export type CasReceiptTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface CasReceiptView {
  label: string;
  tone: CasReceiptTone;
}

/** 触发对账：区分「本次入队」与「幂等命中（在途任务未重复入队）」。 */
export function resolveReconcileReceiptView(receipt: CasReconcileTrigger): CasReceiptView {
  if (receipt.created) {
    return { label: `已入队对账任务 #${receipt.taskId}`, tone: 'success' };
  }
  // ★幂等命中不是失败，也不是新建：必须明说「未重复入队」，否则用户会以为排了两个队。
  return {
    label: `已有在途对账任务 #${receipt.taskId}（幂等命中，本次未重复入队）`,
    tone: 'warning',
  };
}

/**
 * 单档重试复制：按 `copy_state` 分支。
 *
 * ★三条硬口径：
 * 1. `pending` **不是错误**（秒传未命中 → 已回落常规上传）⇒ 用 warning/neutral 语气，禁「失败」字样；
 * 2. `failed` **绝不**显示成成功，且要把 `reason_code`/`reason_detail` 带出来；
 * 3. 未知态原样透出（后端是开放字符串，折叠两态会静默丢信息 —— 与 `formatCasDrive` 同纪律）。
 */
export function resolveRetryCopyView(receipt: CasRetryCopy): CasReceiptView {
  const state = receipt.copyState.trim().toLowerCase();
  // ★只在 key **缺失**时才不接后缀；key 存在但值为空必须显示「原因未提供」——
  //   用 hasFailureReason() 当门槛会把这两态压成同一句话（我写的第 ⑤ 条测试当场抓到）。
  const reason = receipt.reasonCodePresent
    ? ` · ${resolveReasonLabel(receipt.reasonCode, true)}`
    : '';
  if (state === 'present') {
    return { label: `盘 #${receipt.driveId} 已就绪（present）`, tone: 'success' };
  }
  if (state === 'pending') {
    return {
      label: `盘 #${receipt.driveId} 秒传未命中，已转常规上传（pending，非错误）${reason}`,
      tone: 'warning',
    };
  }
  if (state === 'failed') {
    return { label: `盘 #${receipt.driveId} 重试仍失败（failed）${reason}`, tone: 'danger' };
  }
  // 空串（后端没给 copy_state）也走这里：不猜成功、不猜失败，只说「未返回」。
  const shown = receipt.copyState.trim() || '未返回状态';
  return { label: `盘 #${receipt.driveId} 重试回执状态未识别（${shown}）${reason}`, tone: 'neutral' };
}
