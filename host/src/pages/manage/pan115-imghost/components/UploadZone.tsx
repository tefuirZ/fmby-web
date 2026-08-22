import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { pan115ImghostApi } from '@fmby/v2-shared/contracts/manage/pan115Imghost';
import type { Pan115ImghostUploadResponse } from '@fmby/v2-shared/contracts/manage/pan115Imghost';
import { ManageSectionCard } from '@/pages/manage/longtail-shared/components';
import { InlineBanner } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import styles from '@/pages/manage/longtail-shared/ManageShared.module.css';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const ALLOWED_EXTS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'dng',
] as const;

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB

const ACCEPT = ALLOWED_EXTS.map((e) => `.${e}`).join(',');

// ─── Props ────────────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onUploaded: (asset: Pan115ImghostUploadResponse) => void;
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

/**
 * 拖拽 / 点选图片上传区。
 *
 * - 客户端预校验：扩展名 + 大小（≤ 50 MiB）
 * - 上传中显示实时进度条（XHR）
 * - 成功后通过 onUploaded 回调将结果交给父层插入列表顶部
 */
export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTS.includes(ext as (typeof ALLOWED_EXTS)[number])) {
      return `不支持的格式 .${ext}。支持：${ALLOWED_EXTS.join(', ')}`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MiB），上限为 50 MiB。`;
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setUploading(true);
      setProgress(0);
      try {
        const result = await pan115ImghostApi.uploadAsset(
          file,
          'permanent',
          (pct) => setProgress(pct),
        );
        onUploaded(result);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onUploaded],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // 重置 input，允许重复选同一文件
    e.target.value = '';
  };

  return (
    <ManageSectionCard
      title="上传图片"
      description={`支持 ${ALLOWED_EXTS.join(' / ')}，单文件上限 50 MiB。上传后图片同步存储到本地与 115 云端（需已绑定图床凭据）。`}
    >
      {/* 拖拽 / 点选区域 */}
      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
        aria-label="上传图片区域，点击或拖拽文件到此处"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '32px 24px',
          border: `2px dashed ${dragging ? 'var(--manage-cyan)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-lg)',
          background: dragging ? 'rgba(94,214,204,0.06)' : 'var(--surface-1)',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          outline: 'none',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={uploading ? (e) => e.preventDefault() : handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!uploading && (e.key === 'Enter' || e.key === ' ')) {
            fileInputRef.current?.click();
          }
        }}
      >
        <UploadCloud
          size={36}
          style={{ color: dragging ? 'var(--manage-cyan)' : 'var(--text-secondary)' }}
        />
        {uploading ? (
          <p className={styles.mutedText}>
            上传中{progress !== null ? `（${progress}%）` : '…'}
          </p>
        ) : (
          <>
            <p style={{ margin: 0 }}>拖拽图片到此处，或点击选择文件</p>
            <p className={styles.mutedText} style={{ margin: 0, fontSize: '0.8rem' }}>
              {ALLOWED_EXTS.join(' · ')} · 最大 50 MiB
            </p>
          </>
        )}
      </div>

      {/* 进度条 */}
      {uploading && progress !== null ? (
        <div
          aria-label="上传进度"
          style={{
            height: 4,
            background: 'var(--border-default)',
            borderRadius: 2,
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--manage-cyan)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      ) : null}

      {/* 错误提示 */}
      {error ? (
        <InlineBanner
          variant="error"
          title="上传失败"
          description={error}
          actions={
            <button
              className={styles.smallButton}
              type="button"
              onClick={() => setError(null)}
            >
              关闭
            </button>
          }
        />
      ) : null}

      {/* 隐藏 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
    </ManageSectionCard>
  );
}
