/** 运行日志详情弹窗（V1F 拆分：ManageRuntimeLogsPage → 子组件）。 */

import { Dialog } from '@fmby/v2-shared/ui';
import { formatDateTime } from '@fmby/v2-shared/time';
import styles from '../longtail-shared/ManageShared.module.css';
import { ManageSectionCard } from '../longtail-shared/components';
import type { RuntimeLogView } from '../runtimeLogPresentation';
import {
  DetailCard,
  DetailFieldCard,
  formatLevelLabel,
  lookupFieldValue,
} from './components';

interface RuntimeLogDetailDialogProps {
  view: RuntimeLogView | null;
  onClose: () => void;
}

export function RuntimeLogDetailDialog({ view, onClose }: RuntimeLogDetailDialogProps) {
  return (
  <Dialog
    open={view !== null}
    title={view?.headline ?? '运行日志详情'}
    description={
      view
        ? `${formatDateTime(view.record.timestamp)} · ${view.targetLabel} · ${view.record.sourceFile}`
        : '查看标准化日志详情'
    }
    eyebrow="运行日志详情"
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    {view ? (
      <div className={styles.page}>
        <ManageSectionCard
          title="日志概览"
          description="先看最关键的请求、结果和归属信息。"
        >
          <div className={styles.detailSummaryGrid}>
            <DetailCard label="级别" value={formatLevelLabel(view.record.level)} />
            <DetailCard label="类别" value={view.targetLabel} />
            <DetailCard label="事件" value={view.eventLabel} />
            <DetailCard label="结果" value={view.resultLabel} />
            <DetailCard
              label="客户端 / IP"
              value={view.actorLabel}
            />
            <DetailCard
              label="用户"
              value={view.requestLabel}
            />
            <DetailCard
              label="请求 ID"
              value={lookupFieldValue(view, 'request_id') ?? '未记录'}
            />
            <DetailCard
              label="日志文件"
              value={view.record.sourceFile}
            />
          </div>
        </ManageSectionCard>

        <ManageSectionCard
          title="标准化字段"
          description="这里只展示已拆解成中文字段的关键信息。"
        >
          <div className={styles.detailFieldGrid}>
            {view.primaryFields.length > 0 ? (
              view.primaryFields.map((field) => (
                <DetailFieldCard key={field.key} field={field} />
              ))
            ) : (
              <div className={styles.emptyInlineState}>当前日志没有提取到结构化字段。</div>
            )}
          </div>
        </ManageSectionCard>

        {view.extraFields.length > 0 ? (
          <ManageSectionCard
            title="补充字段"
            description="保留没有进入概览卡片的其它字段，方便继续深挖。"
          >
            <div className={styles.detailFieldGrid}>
              {view.extraFields.map((field) => (
                <DetailFieldCard key={field.key} field={field} />
              ))}
            </div>
          </ManageSectionCard>
        ) : null}

        <ManageSectionCard
          title="原始日志"
          description="这是文件里的原始日志行，保留给专业排查时兜底使用。"
        >
          <pre className={styles.jsonBlock}>{view.record.rawLine}</pre>
        </ManageSectionCard>
      </div>
    ) : null}
  </Dialog>
  );
}
