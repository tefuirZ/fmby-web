/*
 * 扫码二维码图（FE-UI-1）。
 * ------------------------------------------------------------
 * 为什么单独一个组件：改前**六处**扫码二维码各自为政，两种病态：
 *   ① 三处 115 弹窗写死 `width:220;height:220` inline style ⇒ 窄视口不缩；
 *   ② 三处页内 <img> 误用 `.readonlyField`（`width:100%` 的**只读文本框**类）
 *      ⇒ 二维码被拉到整行宽、**比例失真**（height 不联动），且无上限。
 * 用户原话：「扫码登录（115、139）为啥那个二维码那么大？不能缩放一下？」
 *
 * 尺寸口径（三档，与 ManageShared.module.css 既有断点 1279/767 对齐）：
 *   桌面（≥1280）  280px —— 上限，不再无限撑大
 *   平板（≤1279）  260px
 *   手机（≤767）   240px —— 下限由 --scan-qr-min 兜底
 * 容器窄于档位值时二维码跟着缩（`width:100%`）；容器窄于下限时**保底不缩**
 * （`min-width` 胜过 `max-width`）。
 *
 * ★下限 180px 的证据（不许拍脑袋，全文见 docs/FE-UI-1-QR-IMAGE-RESPONSIVE.md）：
 *   115 图源 185×185 / 29 模块 ⇒ 每模块 ≈6.4px（qrcodeapi.115.com 实测 curl）。
 *   缩到 180px ⇒ 每模块 ≈6.2px，仍在「≥6px/模块」可扫区间；再往下
 *   （<150px ⇒ <5px/模块）手机摄像头在常规距离解析失败 ⇒ 扫码失败。
 *   故手机档取 240px 而不是 40vw：375px 视口下 40vw=150px < 180px 会扫不出来。
 *
 * ★清晰度（位图不许糊）：
 *   - `kind="vector"`（139 的 SVG data URI）—— 矢量任意缩放不失真，无额外约束；
 *   - `kind="bitmap"`（115 / TOTP 的 PNG data URI）—— **只缩不放**：
 *     传 `naturalSize`（图源原生边长）后，`max-width` 钉死在该值，
 *     绝不放大 ⇒ 无重采样模糊。115 实测原生 185×185（见 docs）。
 *
 * ★层级：容器与 img 均为 `position:static`、无 z-index —— 扫码图只是内容，
 *   不抢 DetailModal 的 `--z-modal` 浮层（改前三处 inline style 同样没设，
 *   本组件显式不设，防止后人顺手加）。
 *
 * ★为什么容器上没有 padding：115 PNG 自带 4 模块白 quiet zone（20/185px），
 *   139 SVG 自带 `fill=#fff` 底 + 4 模块 border。再加 padding 会让
 *   「图宽 = 框宽 - padding」，下限 180px 的账算不准 ⇒ 一律不加，
 *   边框+底色已经足够框住二维码。
 */

import type { CSSProperties } from 'react';
import styles from './ScanQrImage.module.css';

export type ScanQrImageKind =
  /** 位图（PNG/JPEG data URI）—— 只缩不放，避免放大模糊。 */
  | 'bitmap'
  /** 矢量（SVG data URI）—— 任意缩放不失真。 */
  | 'vector';

export interface ScanQrImageProps {
  src: string;
  alt: string;
  /** 图源种类，决定「只缩不放」是否生效。默认 bitmap（115 / TOTP 都是 PNG）。 */
  kind?: ScanQrImageKind;
  /** 图源原生像素边长（位图已知时传入）—— 作为放大上限，杜绝模糊。 */
  naturalSize?: number;
  className?: string;
}

export function ScanQrImage({
  src,
  alt,
  kind = 'bitmap',
  naturalSize,
  className,
}: ScanQrImageProps) {
  // 位图且已知原生尺寸 ⇒ 上限钉死在原生尺寸（只缩不放）。
  // 矢量 / 未知尺寸 ⇒ 不设内联上限，交给 CSS 的三档 max-width。
  const cap =
    kind === 'bitmap' && naturalSize && naturalSize > 0
      ? ({ maxWidth: `${naturalSize}px` } satisfies CSSProperties)
      : undefined;
  return (
    <span
      className={className ? `${styles.frame} ${className}` : styles.frame}
      data-kind={kind}
      style={cap}
    >
      <img className={styles.image} src={src} alt={alt} />
    </span>
  );
}
