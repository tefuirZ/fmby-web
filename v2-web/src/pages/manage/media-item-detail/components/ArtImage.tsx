import { useEffect, useState } from 'react';
import styles from '../MediaItemDetail.module.css';

interface ArtImageProps {
  src?: string;
  alt: string;
  /** 缺图或加载失败时显示的说明文案。 */
  placeholder: string;
  /** 横构图（背景图 / 缩略图）用 16:9，默认海报比例 2:3。 */
  wide?: boolean;
  /** 资产网格里的小预览用更紧凑的一套盒子。 */
  compact?: boolean;
}

/**
 * 详情页统一的图片位。
 *
 * 图片地址来自挂载点或远程图床，随时可能失效，所以加载失败必须退化成
 * 一个可读的占位而不是浏览器默认的破图标 —— 管理员据此就能判断
 * 「这张图挂了」，不需要打开控制台。
 */
export function ArtImage({
  src,
  alt,
  placeholder,
  wide = false,
  compact = false,
}: ArtImageProps) {
  const [failed, setFailed] = useState(false);

  // 切换资源时重置失败标记，否则上一张图的失败态会粘住新地址。
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const frameClass = [
    compact ? styles.assetPreview : styles.artFrame,
    wide ? (compact ? styles.assetPreviewWide : styles.artFrameWide) : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!src || failed) {
    return (
      <div className={frameClass}>
        <div className={styles.artPlaceholder}>{placeholder}</div>
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <img
        alt={alt}
        className={compact ? styles.assetPreviewImage : styles.artImage}
        loading="lazy"
        src={src}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
