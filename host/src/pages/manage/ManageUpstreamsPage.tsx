import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  isUpstreamsUnwiredError,
  upstreamsApi,
} from '@fmby/v2-shared/contracts/manage/upstreams';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, InlineBanner, Tabs } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { UpstreamSourceListSection } from './upstreams/UpstreamSourceListSection';
import { UpstreamBindingsOverview, UpstreamBindingsSection } from './upstreams/UpstreamBindingsSection';
import { UpstreamMappingPresetsSection } from './upstreams/UpstreamMappingPresetsSection';
import { UpstreamMappingWizardSection } from './upstreams/UpstreamMappingWizardSection';

/**
 * 上游源管理（V1F-02-A + S1..S4 + S4b）。
 *
 * 结构：Tab1「上游源」= 源本体 CRUD + 探活 + 局域网发现（选择一行后，
 * Tab2/Tab3 针对该源操作类别绑定与映射）。
 */
export function ManageUpstreamsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.manage.upstreams.list({}),
    queryFn: () => upstreamsApi.list(),
  });

  const sources = listQuery.data?.items ?? [];
  const activeId = selectedId ?? sources[0]?.id ?? null;
  const activeSource = sources.find((s) => s.id === activeId) ?? null;

  if (listQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在加载上游源"
        description="正在同步上游源配置、探活状态与凭据密封信息。"
      />
    );
  }

  if (listQuery.isError) {
    if (isUpstreamsUnwiredError(listQuery.error)) {
      return (
        <div className={styles.page}>
          <ManagePageHeader title="上游源" description="Emby / Apple CMS / WebDAV 等上游源的接入配置与探活。" />
          <ManageSectionCard title="上游源端口未装配" description="GET /api/manage/upstreams 当前不可用。">
            <InlineBanner variant="info" title="等待后端装配" description="上游源端点尚未提供或端口未注入。本页不伪造空列表。" />
            <button className={styles.secondaryButton} type="button" onClick={() => void listQuery.refetch()}>
              重新检测
            </button>
          </ManageSectionCard>
        </div>
      );
    }
    return (
      <FeedbackState
        variant="error"
        title="上游源加载失败"
        description={getErrorMessage(listQuery.error)}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => listQuery.refetch()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="上游源"
        description="源本体、类别与媒体库绑定、映射预设与映射应用。"
        meta={<span className={styles.metaText}>当前共 {sources.length} 个上游源</span>}
      />

      <Tabs
        aria-label="上游源管理分区"
        defaultValue="sources"
        items={[
          {
            value: 'sources',
            label: '上游源',
            content: (
              <>
                <UpstreamSourceListSection />
                {sources.length > 0 ? (
                  <ManageSectionCard
                    title="选择要配置的源"
                    description="选定后，可在「类目绑定」「映射」两个 Tab 里针对该源操作。"
                  >
                    <div className={styles.toolbar}>
                      <label className={styles.label}>
                        目标源
                        <select
                          className={styles.select}
                          value={activeId ?? ''}
                          onChange={(e) => setSelectedId(e.target.value)}
                        >
                          {sources.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                      <span className={styles.tableHint}>
                        {activeSource ? `已选：${activeSource.name}（${activeSource.sourceTypeLabel || activeSource.sourceType}）` : '未选择'}
                      </span>
                    </div>
                  </ManageSectionCard>
                ) : null}
              </>
            ),
          },
          {
            value: 'bindings',
            label: '类目绑定',
            disabled: !activeId,
            content: activeId ? (
              <>
                <UpstreamBindingsSection sourceId={activeId} />
                <UpstreamBindingsOverview sourceId={activeId} />
              </>
            ) : (
              <div className={styles.emptyInlineState}>请先在「上游源」Tab 选择或新建一个源。</div>
            ),
          },
          {
            value: 'mapping',
            label: '映射',
            disabled: !activeId,
            content: activeId ? (
              <>
                <UpstreamMappingPresetsSection sourceId={activeId} />
                <UpstreamMappingWizardSection sourceId={activeId} />
              </>
            ) : (
              <div className={styles.emptyInlineState}>请先在「上游源」Tab 选择或新建一个源。</div>
            ),
          },
        ]}
      />
    </div>
  );
}

export default ManageUpstreamsPage;
