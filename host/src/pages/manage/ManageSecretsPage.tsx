import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  peripheralsApi,
  type SecretSourceKind,
  type SecretsOverrideResultRecord,
} from '@fmby/v2-shared/contracts/manage/peripherals';
import { queryKeys } from '@fmby/v2-shared/query';
import { FeedbackState, StatusBadge } from '@fmby/v2-shared/ui';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from './longtail-shared/ManageShared.module.css';
import { ManagePageHeader, ManageSectionCard } from './longtail-shared/components';
import { useTableRowRoving } from '../../features/a11y/useTableRowRoving';

/** 来源层展示标签（三层链 env > secrets 文件 > 内置；零明文）。 */
const SOURCE_LABELS: Record<SecretSourceKind, string> = {
  env: '环境变量（最高优先）',
  secrets_file: 'secrets 文件覆盖',
  builtin: '内置默认（项目方）',
  unset: '未配置',
};

function sourceVariant(source: SecretSourceKind) {
  switch (source) {
    case 'env':
      return 'info' as const;
    case 'secrets_file':
      return 'success' as const;
    case 'builtin':
      return 'neutral' as const;
    default:
      return 'danger' as const;
  }
}

/** 可覆盖白名单键（与后端 SecretsConfig::apply_override 一一对应；
 * env-only 的 bangumi 键不在覆盖面——文件覆盖对该键无效果，不提供误导入口）。 */
// ★G-13 / FE-1（#642）：原硬编码 OVERRIDABLE_KEYS 常量已彻底删除。
// 可写键完全由后端 `SecretsStatusDto.overridable_keys` 及 entries 元数据驱动（单一真源）。

export function ManageSecretsPage() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: queryKeys.manage.secrets.status(),
    queryFn: () => peripheralsApi.getSecretsStatus(),
  });

  // FE-LIST-KEYNAV-6：表格行键盘漫游（↑↓/Home/End 移动行）。
  // ★刻意**不传 onActivate**：本页是**只读**来源展示表，行内无任何动作
  // （覆盖写入区在下方独立表单，不在行内），造 Enter 语义只能靠伪造 ⇒ 不造。
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const [selectedKey, setSelectedKey] = useState('');
  const [value, setValue] = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SecretsOverrideResultRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = statusQuery.data?.entries ?? [];
  const overridableKeys = useMemo(() => {
    // 优先取后端单一真源 overridableKeys 或从 entries 中过滤 overridable/白名单键
    if (statusQuery.data?.overridableKeys && statusQuery.data.overridableKeys.length > 0) {
      return statusQuery.data.overridableKeys;
    }
    const fromEntries = entries
      .filter((e) => e.overridable !== false)
      .map((e) => e.key);
    if (fromEntries.length > 0) {
      return fromEntries;
    }
    return entries.map((e) => e.key);
  }, [statusQuery.data?.overridableKeys, entries]);

  const entryBySource = useMemo(() => {
    const map = new Map<string, SecretSourceKind>();
    for (const entry of entries) {
      map.set(entry.key, entry.source);
    }
    return map;
  }, [entries]);

  useTableRowRoving({ tbodyRef, rowCount: entries.length });

  const selectedSource = selectedKey ? entryBySource.get(selectedKey) : undefined;

  const overrideMutation = useMutation({
    mutationFn: () =>
      peripheralsApi.applySecretsOverrides({
        overrides: [{ key: selectedKey, value: removeMode ? null : value }],
      }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      setConfirming(false);
      setValue('');
      setRemoveMode(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.manage.secrets.status() });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err));
      setConfirming(false);
    },
  });

  const submitDisabled =
    !selectedKey ||
    (!removeMode && value.trim().length === 0) ||
    overrideMutation.isPending;

  if (statusQuery.isPending) {
    return (
      <FeedbackState
        variant="loading"
        title="正在读取密钥链状态"
        description="正在从服务端拉取各密钥的生效来源层。"
      />
    );
  }

  if (statusQuery.isError) {
    return (
      <FeedbackState
        variant="error"
        title="密钥链状态读取失败"
        description={getErrorMessage(statusQuery.error)}
        action={
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => statusQuery.refetch()}
          >
            重试
          </button>
        }
      />
    );
  }

  const status = statusQuery.data;

  return (
    <div className={styles.page}>
      <ManagePageHeader
        title="密钥链管理"
        description="各服务密钥按三层链解析：环境变量 > secrets 文件覆盖 > 内置默认。本页只展示来源层（零明文）；覆盖值写回 secrets 文件，进程重启后生效。"
        meta={
          <span className={styles.metaText}>
            覆盖写入目标：<span className={styles.mono}>{status.overridesFile}</span>
          </span>
        }
        actions={
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => statusQuery.refetch()}
          >
            刷新状态
          </button>
        }
      />

      <ManageSectionCard
        title="密钥链状态"
        description="装配期逐键记录的生效来源；env 层无法经本页覆盖（需在部署环境配置）。"
      >
        {/* FE-OPT-03：可横向滚动区域须可被键盘访问（axe
            `scrollable-region-focusable`，serious）。 */}
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label="密钥链状态列表（可横向滚动）"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.nowrap}>密钥</th>
                <th className={styles.nowrap}>生效来源</th>
                <th>是否已配置</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {status.entries.map((entry, rowIndex) => (
                <tr key={entry.key} data-row-index={rowIndex}>
                  <td className={styles.mono}>{entry.key}</td>
                  <td>
                    <StatusBadge
                      label={SOURCE_LABELS[entry.source] ?? entry.source}
                      variant={sourceVariant(entry.source)}
                    />
                  </td>
                  <td>
                    {entry.configured ? (
                      <span className={styles.primaryText}>已配置</span>
                    ) : (
                      <span className={styles.mutedText}>未配置</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.hintText}>
          微软网盘双版本自建应用凭据（{status.microsoftEditions.join(' / ')}）由 providers
          内置混淆常量分发，不在本页覆盖面。
        </p>
      </ManageSectionCard>

      <ManageSectionCard
        title="覆盖写入"
        description="写入 secrets 文件（等价“文件层”）；不热更新运行中进程，重启后生效。留空值勾选“删除覆盖”可恢复下层回退。"
      >
        {selectedSource === 'env' ? (
          <div className={styles.emptyInlineState}>
            该键当前由环境变量提供（最高优先）——写文件无法遮蔽 env 层，请直接修改部署环境变量。
          </div>
        ) : null}
        <div className={styles.fieldRow}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="secrets-override-key">
              密钥
            </label>
            <select
              id="secrets-override-key"
              className={styles.select}
              value={selectedKey}
              onChange={(event) => {
                setSelectedKey(event.target.value);
                setResult(null);
                setError(null);
              }}
            >
              <option value="">选择要覆盖的密钥…</option>
              {overridableKeys.map((key) => {
                const entry = entries.find((e) => e.key === key);
                const label = entry?.label ? `${entry.label} (${key})` : key;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="secrets-override-value">
              {removeMode ? '（删除覆盖，恢复下层回退）' : '覆盖值'}
            </label>
            <input
              id="secrets-override-value"
              className={styles.input}
              type="password"
              autoComplete="off"
              placeholder={removeMode ? '—' : '输入新值（写盘后本页不回显）'}
              value={value}
              disabled={removeMode}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>
        <div className={styles.checkboxRow}>
          <label className={styles.label}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={removeMode}
              onChange={(event) => setRemoveMode(event.target.checked)}
            />
            删除该键的文件覆盖（值置空，恢复 env/builtin 层回退）
          </label>
        </div>

        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={submitDisabled}
            onClick={() => setConfirming(true)}
          >
            写入覆盖
          </button>
        </div>

        <SensitiveActionDialog
          open={confirming}
          actionKey="manage.secrets.override"
          title="确认覆盖密钥"
          description={`即将写入或修改密钥覆盖配置：${selectedKey}。该改动将持久化至 secrets 本地配置文件，需在服务重启后生效。`}
          impact={[
            removeMode ? `将清除该密钥的文件覆盖，恢复回落到环境变量或内置默认` : `将使用新值覆盖原有配置，写盘后在页面上不回显敏感明文`,
            `需要重启进程使新配置生效`,
          ]}
          pending={overrideMutation.isPending}
          errorMessage={error ?? undefined}
          onOpenChange={(open) => {
            if (!open) {
              setConfirming(false);
            }
          }}
          onConfirm={() => overrideMutation.mutate()}
        />

        {error && !confirming ? <p className={styles.fieldErrorText}>{error}</p> : null}

        {result ? (
          <div className={styles.inlineMeta}>
            <p className={styles.primaryText}>
              已写入：{result.applied.map((entry) => entry.key).join('、')}（预测来源：
              {result.applied
                .map((entry) => SOURCE_LABELS[entry.source] ?? entry.source)
                .join('、')}
              ）
            </p>
            <p className={styles.hintText}>
              重启后生效：写入不热更新运行中进程（restart_required={String(result.restartRequired)}）。
            </p>
          </div>
        ) : null}
      </ManageSectionCard>
    </div>
  );
}

export default ManageSecretsPage;
