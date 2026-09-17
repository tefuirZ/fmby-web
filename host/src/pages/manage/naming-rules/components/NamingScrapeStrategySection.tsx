/** 刮削策略与语言偏好区（V1F 拆分：scrape-sections.tsx → 独立组件）。 */

import { Image as ImageIcon, Languages, ShieldAlert } from 'lucide-react';

import type { UpdateNamingScrapeSettingsRequest } from '@fmby/v2-shared/contracts/manage/naming';
import { InlineBanner } from '@fmby/v2-shared/ui';

import sharedStyles from '../../longtail-shared/ManageShared.module.css';
import styles from '../../ManageNamingRulesPage.module.css';
import { ManageSectionCard } from '../../longtail-shared/components';

export function NamingScrapeStrategySection({
  draft,
  onDraftChange,
  selectedLibraryName,
}: {
  draft: UpdateNamingScrapeSettingsRequest;
  onDraftChange: (
    updater: (current: UpdateNamingScrapeSettingsRequest) => UpdateNamingScrapeSettingsRequest,
  ) => void;
  selectedLibraryName?: string;
}) {
  return (
    <ManageSectionCard
      title="刮削策略与语言偏好"
      description="主标题来源、元数据语言、海报语言和识别后自动刮削都在这里。这里改的是系统默认策略，不是单条媒体的手工覆盖。"
    >
      <div className={styles.strategyGrid}>
        <div className={styles.strategyCard}>
          <div className={styles.signalEyebrow}>元数据</div>
          <strong>
            <Languages size={16} />
            元数据和字幕语言
          </strong>
          <div className={styles.strategyFormGrid}>
            <label className={sharedStyles.label}>
              元数据语言
              <input
                className={sharedStyles.input}
                placeholder="例如：zh-CN / zh-TW / en-US"
                value={draft.metadataLanguage}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    metadataLanguage: event.target.value,
                  }))
                }
              />
              <span className={sharedStyles.fieldHint}>
                主标题、简介、演员、类型等默认按这个语言去取。
              </span>
            </label>

            <label className={sharedStyles.label}>
              地区偏好
              <input
                className={sharedStyles.input}
                placeholder="例如：CN / TW / US / JP"
                value={draft.metadataRegion}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    metadataRegion: event.target.value.toUpperCase(),
                  }))
                }
              />
              <span className={sharedStyles.fieldHint}>
                用于 TMDB 结果落地区域化标题和上映信息。
              </span>
            </label>
          </div>

          <label className={sharedStyles.label}>
            默认字幕语言
            <input
              className={sharedStyles.input}
              placeholder="例如：zh-CN，留空表示不指定"
              value={draft.subtitleLanguage ?? ''}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  subtitleLanguage: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className={styles.strategyCard}>
          <div className={styles.signalEyebrow}>标题与海报</div>
          <strong>
            <ImageIcon size={16} />
            主元数据来源和海报语言
          </strong>
          <div className={styles.strategyFormGrid}>
            <label className={sharedStyles.label}>
              主元数据来源
              <select
                className={sharedStyles.select}
                value={draft.metadataSource}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    metadataSource: event.target.value === 'douban' ? 'douban' : 'tmdb',
                  }))
                }
              >
                <option value="tmdb">TMDB 为主</option>
                <option value="douban">豆瓣为主</option>
              </select>
              <span className={sharedStyles.fieldHint}>
                主来源负责标题、简介、人物和默认图片；另一个来源只补缺失字段或外部 ID。
              </span>
            </label>

            <label className={sharedStyles.label}>
              海报语言偏好
              <select
                className={sharedStyles.select}
                value={draft.posterLanguageMode}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    posterLanguageMode:
                      event.target.value === 'original'
                        ? 'original'
                        : event.target.value === 'any'
                          ? 'any'
                          : 'metadata',
                  }))
                }
              >
                <option value="metadata">跟随元数据语言</option>
                <option value="original">优先原始语言海报</option>
                <option value="any">接受任意语言海报</option>
              </select>
              <span className={sharedStyles.fieldHint}>
                海报会先下载到本地缓存，再写 sidecar 资产，不再只留外链。
              </span>
            </label>
          </div>

          <label className={sharedStyles.checkboxRow}>
            <input
              className={sharedStyles.checkbox}
              type="checkbox"
              checked={draft.scrapeAfterIdentify}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  scrapeAfterIdentify: event.target.checked,
                }))
              }
            />
            <span>
              <strong>识别成功后自动触发刮削</strong>
              <div className={sharedStyles.mutedText}>
                新媒体首次入库、识别绑定成功后会自动入队 scrape。关闭后只保留手动触发。
              </div>
            </span>
          </label>          <label className={sharedStyles.checkboxRow}>
            <input
              className={sharedStyles.checkbox}
              type="checkbox"
              checked={draft.imghostAutoUpload}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  imghostAutoUpload: event.target.checked,
                }))
              }
            />
            <span>
              <strong>刮削海报自动上传到 115 图床（多源直链加速）</strong>
              <div className={sharedStyles.mutedText}>
                开启后，刮削写盘的 poster/backdrop/thumb 会异步推送到 115 图床，前端优先消费 CDN 直链，节省家里上行带宽。需要先在「工具 / 115 图床」绑定图床凭据，未绑定时自动跳过。
              </div>
            </span>
          </label>

          <InlineBanner
            variant="info"
            title="当前策略说明"
            description={
              draft.metadataSource === 'douban'
                ? `豆瓣负责主标题、简介、人物与默认图片；若你要求原始语言或指定语言海报，则会优先回退 TMDB 的语言化海报。当前海报策略：${posterLanguageModeLabel(draft.posterLanguageMode)}。`
                : `TMDB 负责主元数据，豆瓣只补缺失字段和外部 ID。当前海报策略：${posterLanguageModeLabel(draft.posterLanguageMode)}。`
            }
          />
          {selectedLibraryName ? (
            <span className={styles.inlineMuted}>
              当前媒体库选择器默认会带上：{selectedLibraryName}
            </span>
          ) : null}
        </div>

        <div className={styles.strategyCard}>
          <div className={styles.signalEyebrow}>可达性保护</div>
          <strong>
            <ShieldAlert size={16} />
            数据源可见性与失效保护
          </strong>
          <label className={sharedStyles.checkboxRow}>
            <input
              className={sharedStyles.checkbox}
              type="checkbox"
              checked={draft.sourceAvailability.enabled}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  sourceAvailability: {
                    ...current.sourceAvailability,
                    enabled: event.target.checked,
                  },
                }))
              }
            />
            <span>
              <strong>启用失效源自动隐藏</strong>
              <div className={sharedStyles.mutedText}>
                连续失败达到阈值后，这个媒体源关联的资源会从普通浏览里隐藏，历史记录只保留不可达提示。
              </div>
            </span>
          </label>

          <div className={styles.strategyFormGrid}>
            <label className={sharedStyles.label}>
              连续失败阈值
              <input
                className={sharedStyles.input}
                type="number"
                min={1}
                max={20}
                value={draft.sourceAvailability.failureThreshold}
                disabled={!draft.sourceAvailability.enabled}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  onDraftChange((current) => ({
                    ...current,
                    sourceAvailability: {
                      ...current.sourceAvailability,
                      failureThreshold: Number.isFinite(nextValue)
                        ? nextValue
                        : current.sourceAvailability.failureThreshold,
                    },
                  }));
                }}
              />
              <span className={sharedStyles.fieldHint}>
                默认 3 次；429 限流不会计数，也不会触发隐藏。
              </span>
            </label>

            <label className={sharedStyles.checkboxRow}>
              <input
                className={sharedStyles.checkbox}
                type="checkbox"
                checked={draft.sourceAvailability.autoRecoverOnSuccess}
                disabled={!draft.sourceAvailability.enabled}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    sourceAvailability: {
                      ...current.sourceAvailability,
                      autoRecoverOnSuccess: event.target.checked,
                    },
                  }))
                }
              />
              <span>
                <strong>成功一次后自动恢复</strong>
                <div className={sharedStyles.mutedText}>
                  数据源恢复可读后，允许自动解除隐藏；关闭后只能管理员手动恢复。
                </div>
              </span>
            </label>
          </div>

          <label className={sharedStyles.label}>
            无权限条目怎么展示
            <select
              className={sharedStyles.select}
              value={draft.sourceAccess.unauthorizedVisibilityMode}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  sourceAccess: {
                    unauthorizedVisibilityMode:
                      event.target.value === 'visible_blocked'
                        ? 'visible_blocked'
                        : 'hidden',
                  },
                }))
              }
            >
              <option value="hidden">直接隐藏，看不到也点不到</option>
              <option value="visible_blocked">可以看到，但点开后提示无权限</option>
            </select>
            <span className={sharedStyles.fieldHint}>
              这个策略只影响来源路径没授权的资源；和数据源真实失效不是一回事。
            </span>
          </label>

          <InlineBanner
            variant={draft.sourceAvailability.enabled ? 'warning' : 'info'}
            title={
              draft.sourceAvailability.enabled
                ? `当前阈值：连续失败 ${draft.sourceAvailability.failureThreshold} 次`
                : '当前已关闭自动隐藏'
            }
            description={
              draft.sourceAvailability.enabled
                ? '这个保护是按媒体库来源粒度生效，不是一刀切把整个库全删可见性。'
                : '关闭后来源即使连续失败，也不会自动隐藏资源。'
            }
          />
        </div>
      </div>
    </ManageSectionCard>
  );
}

function posterLanguageModeLabel(value: UpdateNamingScrapeSettingsRequest['posterLanguageMode']) {
  switch (value) {
    case 'original':
      return '优先原始语言海报';
    case 'any':
      return '接受任意语言海报';
    default:
      return '跟随元数据语言';
  }
}
