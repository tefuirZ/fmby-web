/** 媒体审核工单页共享标签与格式化工具。 */

export const REVIEW_STAGE_LABELS: Record<string, string> = {
  Identify: '识别失败',
  Scrape: '刮削失败',
  VersionMerge: '版本合并',
  PolicyCheck: '策略检查',
  AiAssist: 'AI 复核',
  VisibilityGovernance: '可见性治理',
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  Open: '待处理',
  Claimed: '处理中',
  Resolved: '已解决',
  Ignored: '已忽略',
  Cancelled: '已取消',
};

/** 处理动作清单（V1F-03b：可见性治理动作需 DangerousAction + confirmed 二次闸门）。 */
export const RESOLVE_ACTIONS: { value: string; label: string }[] = [
  { value: 'ApproveScraped', label: '批准刮削结果' },
  { value: 'RejectScraped', label: '驳回刮削结果' },
  { value: 'ManualMatch', label: '人工匹配（锁定外部 ID）' },
  { value: 'Dismiss', label: '忽略' },
  { value: 'KeepVisible', label: '保持可见' },
  { value: 'ApproveVisibilityHide', label: '批准隐藏' },
  { value: 'RetryIdentify', label: '重试识别' },
];

export function formatEpochMs(epochMs: number | null): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) {
    return '—';
  }
  return new Date(epochMs).toLocaleString('zh-CN', { hour12: false });
}

export function parseSnapshot(json: string | null): unknown {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
