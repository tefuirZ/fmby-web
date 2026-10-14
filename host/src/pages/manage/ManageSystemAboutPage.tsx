import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  isSystemAboutUnwiredError,
  systemAboutApi,
  systemDependencyStatusLabel,
  type SystemAboutResponse,
} from '@fmby/v2-shared/contracts/manage/system-about';
import { queryKeys } from '@fmby/v2-shared/query';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { useTableRowRoving } from '../../features/a11y/useTableRowRoving';

/**
 * 「运行时」表的行描述符。原来四行是硬编码 <tr>，改成数据驱动只是为了给
 * roving 提供稳定的 `data-row-index`（0..N-1）与 rowCount。
 */
const RUNTIME_ROWS: Array<{ label: string; value: (d: SystemAboutResponse) => string }> = [
  { label: '包版本', value: (d) => d.runtime.rustPackageVersion },
  { label: '目标系统', value: (d) => d.runtime.targetOs },
  { label: '目标架构', value: (d) => d.runtime.targetArch },
  { label: '能力面', value: (d) => d.runtime.features.join('、') },
];

/** 同上，「链接」表的行描述符。 */
const LINK_ROWS: Array<{ label: string; value: (d: SystemAboutResponse) => string }> = [
  { label: '源码仓库', value: (d) => d.links.sourceRepo },
  { label: '分发仓库', value: (d) => d.links.distributionRepo },
  { label: '更新日志', value: (d) => d.links.changelog },
  { label: 'Docker Hub', value: (d) => d.links.dockerhubRepo },
];

function formatGeneratedAt(rfc3339: string): string {
  const t = new Date(rfc3339);
  return Number.isNaN(t.getTime()) ? rfc3339 : t.toLocaleString('zh-CN', { hour12: false });
}

function DependencyRow({
  dep,
  index,
}: {
  dep: SystemAboutResponse['dependencies'][number];
  index: number;
}) {
  return (
    <tr data-row-index={index}>
      <td>{dep.name}</td>
      <td>{systemDependencyStatusLabel(dep.status)}</td>
      <td>{dep.required ? '必需' : '可选'}</td>
      <td>{dep.version ?? '—'}</td>
      <td>{dep.message ?? '—'}</td>
    </tr>
  );
}

export function ManageSystemAboutPage() {
  const aboutQuery = useQuery({
    queryKey: queryKeys.manage.systemAbout.about(),
    queryFn: () => systemAboutApi.about(),
  });

  // FE-LIST-KEYNAV-10：本页三张表都是**只读静态键值/清单表**（行内无控件），
  // Enter 无既有语义可绑 ⇒ 都不传 onActivate。
  // ★hook 必须早于下面 isPending / isError 两个 early return（Hooks 规则）。
  const runtimeTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef: runtimeTbodyRef, rowCount: RUNTIME_ROWS.length });

  const depsTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef: depsTbodyRef, rowCount: aboutQuery.data?.dependencies.length ?? 0 });

  const linksTbodyRef = useRef<HTMLTableSectionElement>(null);
  useTableRowRoving({ tbodyRef: linksTbodyRef, rowCount: LINK_ROWS.length });

  if (aboutQuery.isPending) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="系统关于" description="版本、构建与运行依赖状态。" />
        <ManageSectionCard title="加载中" description="正在探测版本与运行依赖。">
          {/* ManageSectionCard children 为必填（w2 基线 typecheck TS2741 清偿）：
              加载态无额外面板内容，给占位符保持组件契约。 */}
          <span />
        </ManageSectionCard>
      </div>
    );
  }

  if (aboutQuery.isError || !aboutQuery.data) {
    return (
      <div className={styles.page}>
        <ManagePageHeader title="系统关于" description="版本、构建与运行依赖状态。" />
        <ManageSectionCard
          title={isSystemAboutUnwiredError(aboutQuery.error) ? '后端未提供' : '加载失败'}
          description={
            isSystemAboutUnwiredError(aboutQuery.error)
              ? 'GET /api/manage/system/about 当前不可用。'
              : getErrorMessage(aboutQuery.error)
          }
        >
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void aboutQuery.refetch()}
          >
            重试
          </button>
        </ManageSectionCard>
      </div>
    );
  }

  const data = aboutQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="系统关于"
        description="版本、构建与运行依赖状态。"
        meta={<span className={styles.metaText}>刷新于 {formatGeneratedAt(data.generatedAt)}</span>}
      />

      {data.warnings.length > 0 && (
        <div className={styles.emptyInlineState}>{data.warnings.join('；')}</div>
      )}

      <ManageSectionCard title="应用" description="版本与构建元信息。">
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>版本</span>
            <div className={styles.metricValue}>{data.app.version}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>提交</span>
            <div className={styles.metricValue}>{data.app.commitSha ?? '—'}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>构建时间</span>
            <div className={styles.metricValue}>{data.app.buildTime ?? '—'}</div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>构建通道</span>
            <div className={styles.metricValue}>{data.app.buildChannel ?? '—'}</div>
          </div>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="运行时" description="编译目标与启用的能力面。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="运行时信息（可横向滚动）">
          <table className={styles.table}>
            <tbody ref={runtimeTbodyRef}>
              {RUNTIME_ROWS.map((row, index) => (
                <tr key={row.label} data-row-index={index}>
                  <td>{row.label}</td>
                  <td>{row.value(data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="运行依赖" description="PATH 探测（-version 首行）。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="依赖清单（可横向滚动）">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>依赖</th>
                <th>状态</th>
                <th>级别</th>
                <th>版本</th>
                <th>消息</th>
              </tr>
            </thead>
            <tbody ref={depsTbodyRef}>
              {data.dependencies.map((dep, index) => (
                <DependencyRow key={dep.id} dep={dep} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      </ManageSectionCard>

      <ManageSectionCard title="链接" description="源码与分发入口。">
        <div className={`${styles.tableWrap} ${styles.desktopOnly}`} role="region" aria-label="相关链接（可横向滚动）">
          <table className={styles.table}>
            <tbody ref={linksTbodyRef}>
              {LINK_ROWS.map((row, index) => (
                <tr key={row.label} data-row-index={index}>
                  <td>{row.label}</td>
                  <td>{row.value(data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManageSectionCard>
    </div>
  );
}

export default ManageSystemAboutPage;
