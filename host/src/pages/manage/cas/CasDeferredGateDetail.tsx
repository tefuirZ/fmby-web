/**
 * #862 · #658 ⑤「删除安全 · 延迟删除三闸」**逐闸明细**展示件（两处复用）。
 *
 * 为什么抽成件：同一语义要在两个页面出现（编排页「扇出状态」区、发布编排页扇出明细），
 * 复制两份必然漂移；且「在挡的闸」文案必须与列表页共用同一族助手
 * （`formatCasDrive.ts` 的 `resolveDeferredGateLabel`），不得各写一套。
 *
 * 数据来源：后端 `CasFanoutStatusDto.deferred`（DTO 必含；未装配/老版本为 `null`）
 * ⇒ `null` 时**不渲染**（不编造状态）。纪律同族：未知码原样透出、缺失显 `—`。
 */
import type { CasDeferredGate } from '@fmby/v2-shared/contracts/manage/casAdmin';
import { resolveDeferredGateLabel, formatGraceRemaining } from './formatCasDrive';
import styles from './CasDeferredGateDetail.module.css';

export function CasDeferredGateDetail({ deferred }: { deferred: CasDeferredGate | null }) {
  if (!deferred) {
    return null;
  }
  return (
    <div className={styles.panel} data-testid="cas-deferred-gate-detail">
      <strong>删除安全（延迟删除三闸）</strong>
      <span>
        当前在挡：{resolveDeferredGateLabel(deferred.blockingGate)}
        {deferred.blockingGate === 'grace'
          ? `（还剩 ${formatGraceRemaining(deferred.graceRemainingMs)}）`
          : ''}
      </span>
      <span className={styles.muted}>
        闸① 会话已关闭：{deferred.sessionClosed ? '是' : '否'} · 闸② TTL 已到：
        {deferred.leaseExpired ? '是' : '否'} · 闸③ 宽限期已满：
        {deferred.graceElapsed ? '是' : '否'}
      </span>
    </div>
  );
}
