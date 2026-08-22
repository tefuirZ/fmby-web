import styles from '../../styles/detail.module.css';
import type { StreamInfo, StreamType } from '../types';
import { buildStreamSummary, buildStreamFacts } from '../formUtils';

interface StreamDisclosureGroupProps {
  title: string;
  streams: StreamInfo[];
  type: StreamType;
  defaultCollapsed?: boolean;
}

export function StreamDisclosureGroup({
  title,
  streams,
  type,
  defaultCollapsed = false,
}: StreamDisclosureGroupProps) {
  const streamList = (
    <div className={styles.detailStreamList}>
      {streams.map((stream, index) => {
        const summary = buildStreamSummary(stream, type, index);
        const facts = buildStreamFacts(stream, type);
        return (
          <details
            key={`${type}-${stream.index ?? index}-${summary}`}
            className={styles.detailDisclosure}
          >
            <summary className={styles.detailDisclosureSummary}>
              <strong>{summary}</strong>
              <span className={styles.detailDisclosureHint}>展开查看详细参数</span>
            </summary>
            <div className={styles.detailDisclosureBody}>
              <div className={styles.detailFactsList}>
                {facts.map((fact) => (
                  <div key={fact.label} className={styles.detailFactRow}>
                    <span className={styles.detailFactTerm}>{fact.label}</span>
                    <div className={styles.detailFactDescription}>{fact.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );

  if (defaultCollapsed) {
    return (
      <details className={styles.detailGroupDisclosure}>
        <summary className={styles.detailGroupSummary}>
          <strong>{title}</strong>
          <span className={styles.detailDisclosureHint}>默认收起，点此展开</span>
        </summary>
        <div className={styles.detailGroupBody}>{streamList}</div>
      </details>
    );
  }

  return (
    <div className={styles.detailStreamBlock}>
      <h3 className={styles.detailSubsectionTitle}>{title}</h3>
      {streamList}
    </div>
  );
}
