import type {
  ManageSourcePathGrantInput,
  ManageSourcePathPolicyInput,
} from '@/domains/manage';

import styles from './ManageShared.module.css';

interface MountOption {
  id: string;
  name: string;
  pathLabel?: string;
}

function normalizeGrantPathPrefix(value: string) {
  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized === '' || normalized === '/') {
    return '';
  }
  return normalized
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
}

function createEmptyGrant(mountId?: string): ManageSourcePathGrantInput {
  return {
    mountId: mountId ?? '',
    pathPrefix: '',
  };
}

function createEmptyPolicy(): ManageSourcePathPolicyInput {
  return {
    pathPrefix: '',
    priority: 0,
  };
}

export function SourceGrantEditor({
  title,
  description,
  mounts,
  value,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  mounts: MountOption[];
  value: ManageSourcePathGrantInput[];
  disabled?: boolean;
  onChange: (value: ManageSourcePathGrantInput[]) => void;
}) {
  const hasMounts = mounts.length > 0;

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.stackText}>
        <strong>{title}</strong>
        <span className={styles.mutedText}>{description}</span>
      </div>

      {!hasMounts ? (
        <div className={styles.emptyInlineState}>
          当前还没有可选数据源，先把媒体来源建起来，再回来配路径授权。
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className={styles.emptyInlineState}>
          还没加任何来源路径规则。留空表示继续沿用旧媒体库授权兜底。
        </div>
      ) : null}

      {value.map((grant, index) => {
        const selectedMount = mounts.find((mount) => mount.id === grant.mountId);
        return (
          <article key={`${grant.mountId}-${grant.pathPrefix}-${index}`} className={styles.entityCard}>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                数据源
                <select
                  className={styles.select}
                  value={grant.mountId}
                  disabled={disabled || !hasMounts}
                  onChange={(event) =>
                    onChange(
                      value.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              mountId: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="">请选择数据源</option>
                  {mounts.map((mount) => (
                    <option key={mount.id} value={mount.id}>
                      {mount.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.label}>
                路径前缀
                <input
                  className={styles.input}
                  value={grant.pathPrefix}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      value.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              pathPrefix: normalizeGrantPathPrefix(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                  placeholder="留空表示整个数据源根目录"
                />
              </label>
            </div>

            <div className={styles.inlineMeta}>
              <span className={styles.mutedText}>
                {selectedMount
                  ? `当前指向：${selectedMount.name}${selectedMount.pathLabel ? ` · ${selectedMount.pathLabel}` : ''}`
                  : '先选数据源，再决定是整个根目录还是某个子目录。'}
              </span>
              <button
                className={styles.ghostButton}
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                删除规则
              </button>
            </div>
          </article>
        );
      })}

      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={disabled || !hasMounts}
          onClick={() => onChange([...value, createEmptyGrant(mounts[0]?.id)])}
        >
          添加来源路径
        </button>
      </div>
    </div>
  );
}

export function SourcePathPolicyEditor({
  value,
  disabled = false,
  onChange,
}: {
  value: ManageSourcePathPolicyInput[];
  disabled?: boolean;
  onChange: (value: ManageSourcePathPolicyInput[]) => void;
}) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.stackText}>
        <strong>高级路径策略</strong>
        <span className={styles.mutedText}>
          留空就继续用默认选源。只有你真要做路径优先级和并发分流时，才需要这里。
        </span>
      </div>

      {value.length === 0 ? (
        <div className={styles.emptyInlineState}>
          当前没有高级路径策略。系统会直接按默认顺序选可播放来源。
        </div>
      ) : null}

      {value.map((policy, index) => (
        <article key={`${policy.id ?? 'new'}-${policy.pathPrefix}-${index}`} className={styles.entityCard}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              路径前缀
              <input
                className={styles.input}
                value={policy.pathPrefix}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            pathPrefix: normalizeGrantPathPrefix(event.target.value),
                          }
                        : item,
                    ),
                  )
                }
                placeholder="留空表示整个数据源根目录"
              />
            </label>

            <label className={styles.label}>
              优先级
              <input
                className={styles.input}
                type="number"
                value={policy.priority}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            priority: Number.isFinite(Number(event.target.value))
                              ? Math.trunc(Number(event.target.value))
                              : item.priority,
                          }
                        : item,
                    ),
                  )
                }
              />
              <span className={styles.fieldHint}>数字越小越优先。</span>
            </label>

            <label className={styles.label}>
              最大同时播放数
              <input
                className={styles.input}
                type="number"
                min={1}
                value={policy.maxConcurrentStreams ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            maxConcurrentStreams:
                              event.target.value.trim() === ''
                                ? undefined
                                : Math.max(1, Math.trunc(Number(event.target.value) || 1)),
                          }
                        : item,
                    ),
                  )
                }
                placeholder="留空表示不限制"
              />
            </label>
          </div>

          <div className={styles.inlineMeta}>
            <span className={styles.mutedText}>
              例子：115 路径设 10，满了以后，起播前才会切去下一个还能播的来源。
            </span>
            <button
              className={styles.ghostButton}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            >
              删除策略
            </button>
          </div>
        </article>
      ))}

      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, createEmptyPolicy()])}
        >
          添加路径策略
        </button>
      </div>
    </div>
  );
}
