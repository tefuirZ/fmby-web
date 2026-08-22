/**
 * Aurora Glass 共享 UI 组件入口
 *
 * 统一导出面向下游页面的全部组件。
 * import 路径约定：@/shared/ui
 */

/* ---- 玻璃基础组件 ---- */
export { GlassPanel } from './primitives/GlassPanel';
export { GlassCard } from './primitives/GlassCard';
export { Button, IconButton } from './primitives/Button';
export { Input, Textarea } from './primitives/Field';
export { Select } from './primitives/Select';
export type { SelectOption } from './primitives/Select';
export { Switch } from './primitives/Switch';
export { Checkbox } from './primitives/Checkbox';
export { Tabs } from './primitives/Tabs';
export type { TabItem } from './primitives/Tabs';
export { Tooltip } from './primitives/Tooltip';
export { Dialog } from './primitives/Dialog';
export { Skeleton } from './primitives/Skeleton';

/* ---- 兼容组件（接口与旧皮肤一致） ---- */
export { ConfirmDialog } from './common/ConfirmDialog';
export { SensitiveActionDialog } from './common/SensitiveActionDialog';
export { DetailModal } from './common/DetailModal';
export { SideDrawer, SideDrawer as Drawer } from './common/SideDrawer';
export { FeedbackState } from './common/FeedbackState';
export { ErrorBoundary } from './common/ErrorBoundary';
export { InlineBanner } from './common/InlineBanner';
export { StatusBadge } from './common/StatusBadge';
export type { StatusBadgeVariant } from './common/StatusBadge';
export { HoverScrollArea } from './common/HoverScrollArea';
export { DirectoryBrowser } from './common/DirectoryBrowser';
export type {
  DirectoryBrowserEntry,
  DirectoryBrowserCopy,
  DirectoryBrowserProps,
} from './common/DirectoryBrowser';

/* ---- 反馈（Toast 全家桶） ---- */
export { Toast, ToastProvider, ToastContext, useToast } from './feedback';
export type { ToastItem, ToastVariant, ToastApi, ToastInput } from './feedback';
