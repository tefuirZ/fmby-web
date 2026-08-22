import { Outlet } from 'react-router';

/**
 * 浏览布局
 *
 * 浏览类页面的氛围完全由各页自己的 hero / 背景承担，这一层不需要再包一层
 * 容器或额外的内边距 —— 多包一层反而会在纯黑画布上切出可见的边界。
 * 因此这里刻意只透传 Outlet，保留它是为了给浏览分支留一个统一的挂载点。
 */
export function BrowseLayout() {
  return <Outlet />;
}
