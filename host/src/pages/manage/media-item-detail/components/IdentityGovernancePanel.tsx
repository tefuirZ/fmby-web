import { useMemo, useState } from 'react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import { Fingerprint, Eye, Link2 } from 'lucide-react';
import { SensitiveActionDialog, useToast } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { ManageMediaItemDetailRecord,
  ManageMediaItemProviderSearchCandidate,
  ManageMediaItemVisibilityState,
} from '@fmby/v2-shared/contracts/manage/media-items';
import { mediaItemsApi } from '@fmby/v2-shared/contracts/manage/media-items';
import sharedStyles from '../../ManagePages.module.css';
import { ManageSectionCard } from '../../components';
import styles from '../MediaItemDetail.module.css';
import type { MediaItemMutations } from '../types';

interface IdentityGovernancePanelProps {
  detail: ManageMediaItemDetailRecord;
  mutations: MediaItemMutations;
}

const VISIBILITY_OPTIONS: { value: ManageMediaItemVisibilityState; label: string }[] = [
  { value: 'visible', label: '可见' },
  { value: 'hidden', label: '隐藏' },
  { value: 'manualhidden', label: '人工隐藏' },
  { value: 'restore', label: '恢复默认可见性' },
];

/**
 * 「身份与可见性治理」段落。
 *
 * 收口三件事：条目级可见性切换（危险闸）、触发识别（幂等入队）、手工绑定身份
 * （危险闸，带 provider 候选搜索）。这三项都围绕「这条资源在刮削源里是谁、
 * 是否对普通用户可见」，与上方「元数据流水线」的识别/绑定/刮削链路天然相邻，
 * 因此放在同一详情页、由 PipelineSection 引用。
 */
export function MediaItemIdentityGovernancePanel({ detail, mutations }: IdentityGovernancePanelProps) {
  const { toast } = useToast();
  const { visibilityMutation, manualMatchMutation, identifyMutation } = mutations;
  const itemId = detail.item.id;

  // ---- 可见性 ----
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<ManageMediaItemVisibilityState>('visible');

  const handleVisibilitySubmit = (state: ManageMediaItemVisibilityState) => {
    setPendingVisibility(state);
    setVisibilityOpen(true);
  };

  const handleVisibilityConfirm = (confirmation: DangerousActionRequest) => {
    visibilityMutation.mutate(
      { state: pendingVisibility, confirmation },
      {
        onSuccess: () => {
          setVisibilityOpen(false);
          toast.success({
            title: '可见性已更新',
            description: `这条资源已切换为「${VISIBILITY_OPTIONS.find((o) => o.value === pendingVisibility)?.label}」。`,
          });
        },
        onError: (error) => {
          toast.error({ title: '可见性更新失败', description: getErrorMessage(error) });
        },
      },
    );
  };

  // ---- 触发识别 ----
  const handleIdentify = () => {
    identifyMutation.mutate(
      {},
      {
        onSuccess: (result) => {
          toast.success({
            title: '已触发识别',
            description: `任务 ${result.taskId} 已入队，当前状态：${result.status}。`,
          });
        },
        onError: (error) => {
          toast.error({ title: '触发识别失败', description: getErrorMessage(error) });
        },
      },
    );
  };

  // ---- 人工匹配身份（含 provider-search） ----
  const [matchProvider, setMatchProvider] = useState('');
  const [matchKeyword, setMatchKeyword] = useState('');
  const [matchProviderItemId, setMatchProviderItemId] = useState('');
  const [matchReason, setMatchReason] = useState('');
  const [matchOpen, setMatchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ManageMediaItemProviderSearchCandidate[]>([]);

  const canSearch = matchProvider.trim() !== '' && matchKeyword.trim().length >= 2;

  const handleSearch = async () => {
    if (!canSearch) {
      return;
    }
    setSearching(true);
    try {
      const res = await mediaItemsApi.searchMediaItemProvider(itemId, {
        provider: matchProvider.trim(),
        query: matchKeyword.trim(),
      });
      setCandidates(res.candidates);
    } catch (error) {
      toast.error({ title: '候选搜索失败', description: getErrorMessage(error) });
    } finally {
      setSearching(false);
    }
  };

  const handlePickCandidate = (providerItemId: string) => {
    setMatchProviderItemId(providerItemId);
  };

  const handleMatchSubmit = () => {
    if (matchProvider.trim() === '' || matchProviderItemId.trim() === '') {
      toast.error({ title: '缺少参数', description: '请填写刮削源并选择或填写外部编号。' });
      return;
    }
    setMatchOpen(true);
  };

  const handleMatchConfirm = (confirmation: DangerousActionRequest) => {
    manualMatchMutation.mutate(
      {
        payload: {
          provider: matchProvider.trim(),
          providerItemId: matchProviderItemId.trim(),
          reason: matchReason.trim() || undefined,
        },
        confirmation,
      },
      {
        onSuccess: () => {
          setMatchOpen(false);
          setCandidates([]);
          toast.success({ title: '已提交人工匹配', description: '身份绑定已更新，刮削任务将随之开始。' });
        },
        onError: (error) => {
          toast.error({ title: '人工匹配失败', description: getErrorMessage(error) });
        },
      },
    );
  };

  const matchPending = visibilityMutation.isPending || manualMatchMutation.isPending || identifyMutation.isPending;
  const selectedVisibilityLabel = useMemo(
    () => VISIBILITY_OPTIONS.find((o) => o.value === pendingVisibility)?.label,
    [pendingVisibility],
  );

  return (
    <ManageSectionCard
      title="身份与可见性治理"
      description="切换普通用户可见性、触发识别、或手工把这条资源绑定到刮削源上的具体条目。"
    >
      <div className={styles.govRow}>
        <div className={styles.govBlock}>
          <div className={styles.govLabel}>
            <Eye size={14} />
            条目可见性
          </div>
          <div className={styles.govControls}>
            <select
              className={sharedStyles.select}
              defaultValue="visible"
              onChange={(e) => handleVisibilitySubmit(e.target.value as ManageMediaItemVisibilityState)}
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.govHint}>
            隐藏后普通用户在前台将无法看到这条资源；危险操作需二次确认。
          </p>
        </div>

        <div className={styles.govBlock}>
          <div className={styles.govLabel}>
            <Fingerprint size={14} />
            识别与绑定
          </div>
          <div className={styles.govControls}>
            <button
              className={sharedStyles.smallButton}
              disabled={identifyMutation.isPending}
              type="button"
              onClick={handleIdentify}
            >
              <Fingerprint size={14} />
              {identifyMutation.isPending ? '提交中…' : '触发识别'}
            </button>
          </div>
          <p className={styles.govHint}>
            让后端重新尝试自动识别这条资源的刮削源身份。
          </p>
        </div>
      </div>

      <div className={styles.govMatch}>
        <div className={styles.govLabel}>
          <Link2 size={14} />
          手工匹配身份
        </div>
        <div className={styles.govMatchForm}>
          <input
            className={sharedStyles.input}
            placeholder="刮削源（如 tmdb / douban）"
            value={matchProvider}
            onChange={(e) => setMatchProvider(e.target.value)}
          />
          <input
            className={sharedStyles.input}
            placeholder="搜索关键词（≥2 字）"
            value={matchKeyword}
            onChange={(e) => setMatchKeyword(e.target.value)}
          />
          <button
            className={sharedStyles.smallButton}
            disabled={!canSearch || searching}
            type="button"
            onClick={() => void handleSearch()}
          >
            {searching ? '搜索中…' : '搜索候选'}
          </button>
        </div>

        {candidates.length > 0 ? (
          <ul className={styles.candidateList}>
            {candidates.map((c) => (
              <li
                key={`${c.provider}:${c.providerItemId}`}
                className={`${styles.candidateItem} ${
                  matchProviderItemId === c.providerItemId ? styles.candidateActive : ''
                }`}
              >
                <button
                  className={styles.candidatePick}
                  type="button"
                  onClick={() => handlePickCandidate(c.providerItemId)}
                >
                  <span className={styles.candidateTitle}>{c.title}</span>
                  <span className={styles.candidateMeta}>
                    {c.provider} · {c.providerItemId}
                    {c.year ? ` · ${c.year}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.govMatchForm}>
          <input
            className={sharedStyles.input}
            placeholder="外部编号（从候选中选择或手动填写）"
            value={matchProviderItemId}
            onChange={(e) => setMatchProviderItemId(e.target.value)}
          />
          <input
            className={sharedStyles.input}
            placeholder="匹配原因（可选）"
            value={matchReason}
            onChange={(e) => setMatchReason(e.target.value)}
          />
          <button
            className={sharedStyles.primaryButton}
            disabled={matchPending}
            type="button"
            onClick={handleMatchSubmit}
          >
            提交匹配
          </button>
        </div>
      </div>

      <SensitiveActionDialog
        open={visibilityOpen}
        actionKey="set-media-item-visibility"
        title="切换资源可见性"
        description="此操作会改变普通用户能否在前台看到这条资源。"
        impact={[
          '隐藏后资源从前台消失，但管理端仍可见；',
          '恢复后回到扫描/刮削决定的默认可见状态。',
        ]}
        pending={visibilityMutation.isPending}
        onOpenChange={setVisibilityOpen}
        onConfirm={handleVisibilityConfirm}
      >
        <p className={styles.govConfirmText}>
          确认将可见性切换为「{selectedVisibilityLabel}」？
        </p>
      </SensitiveActionDialog>

      <SensitiveActionDialog
        open={matchOpen}
        actionKey="manual-match-media-item-identity"
        title="手工绑定资源身份"
        description="此操作会把这条资源永久绑定到刮削源上的指定条目，并可能触发重新刮削。"
        impact={[
          '绑定后自动匹配不再生效；',
          '若绑定错误，需手动改绑或解除。',
        ]}
        pending={manualMatchMutation.isPending}
        onOpenChange={setMatchOpen}
        onConfirm={handleMatchConfirm}
      >
        <p className={styles.govConfirmText}>
          确认将「{detail.item.title}」绑定到 {matchProvider.trim()} 的 {matchProviderItemId.trim()}？
        </p>
      </SensitiveActionDialog>
    </ManageSectionCard>
  );
}

export default MediaItemIdentityGovernancePanel;
