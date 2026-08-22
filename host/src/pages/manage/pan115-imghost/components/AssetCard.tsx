import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { Pan115ImghostAsset } from '@/domains/manage/pan115Imghost';
import { StatusBadge } from '@/shared/ui';
import type { StatusBadgeVariant } from '@/shared/ui';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const MIRROR_STATUS_LABELS: Record<string, string> = {
  Uploading: '镜像中',
  Ok: '双源就绪',
  Failed: '镜像失败',
  Unreachable: '云端不可达',
  Disabled: '仅本地',
};

function getMirrorBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'Ok':
      return 'success';
    case 'Uploading':
      return 'info';
    case 'Failed':
    case 'Unreachable':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── 复制按钮 Hook ────────────────────────────────────────────────────────────

function useCopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallback();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      try { fallback(); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (__) {}
    }
  };
  return { copied, copy };
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: Pan115ImghostAsset;
}

/**
 * 单张图片卡片。
 *
 * - 优先展示 host_url；加载失败时自动 fallback 到 local_url
 * - 提供「115 链接」「本地链接」两个独立复制按钮
 * - 显示 mirror_status Badge（镜像中 / 双源就绪 / 失败等）
 */
export function AssetCard({ asset }: AssetCardProps) {
  const [imgSrc, setImgSrc] = useState(() => asset.hostUrl ?? asset.localUrl);
  const hostCopy = useCopyButton();
  const localCopy = useCopyButton();

  const handleImgError = () => {
    if (imgSrc !== asset.localUrl) {
      setImgSrc(asset.localUrl);
    }
  };

  const localAbsUrl = window.location.origin + asset.localUrl;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--surface-2)',
      }}
    >
      {/* 缩略图 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '66.67%', // 3:2 ratio
          background: 'var(--surface-1)',
          overflow: 'hidden',
        }}
      >
        <img
          src={imgSrc}
          alt={asset.originalFilename}
          onError={handleImgError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* 镜像状态角标 */}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
          }}
        >
          <StatusBadge
            label={MIRROR_STATUS_LABELS[asset.mirrorStatus] ?? asset.mirrorStatus}
            variant={getMirrorBadgeVariant(asset.mirrorStatus)}
          />
        </span>
      </div>

      {/* 元信息 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          title={asset.originalFilename}
          style={{
            fontSize: '0.82rem',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {asset.originalFilename}
        </div>

        <div className={styles.mutedText} style={{ fontSize: '0.75rem' }}>
          {formatFileSize(asset.size)} · {asset.mime}
        </div>

        {/* 复制按钮行 */}
        <div className={styles.rowActions} style={{ gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={styles.smallButton}
            disabled={!asset.hostUrl}
            title={asset.hostUrl ? '复制 115 云端直链' : '115 云端链接暂不可用'}
            onClick={() => asset.hostUrl && hostCopy.copy(asset.hostUrl)}
            style={{ flex: '1 1 auto' }}
          >
            {hostCopy.copied ? (
              <Check size={13} style={{ flexShrink: 0 }} />
            ) : (
              <Copy size={13} style={{ flexShrink: 0 }} />
            )}
            115 链接
          </button>

          <button
            type="button"
            className={styles.smallButton}
            title="复制本地兜底链接"
            onClick={() => localCopy.copy(localAbsUrl)}
            style={{ flex: '1 1 auto' }}
          >
            {localCopy.copied ? (
              <Check size={13} style={{ flexShrink: 0 }} />
            ) : (
              <Copy size={13} style={{ flexShrink: 0 }} />
            )}
            本地链接
          </button>
        </div>
      </div>
    </div>
  );
}
