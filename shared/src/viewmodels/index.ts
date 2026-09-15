/**
 * View-model 层入口（WEB-B1，L3 主题前置）。
 *
 * 职责边界（docs/09-webui.md §2 分层）：
 * - `contracts/`：DTO + mapper（raw 后端形态 ↔ 领域类型）；
 * - **`viewmodels/`：取数编排 + 展示派生 → `{ data, state, actions, layout }`**；
 * - `pages/`：只调 viewmodel + 渲染，**不再直接 `useQuery`**。
 *
 * 主题（L3）只消费 viewmodel 输出的成型视图数据，`data` 已是展示形态
 * （heroSlides / 分组 / 统计 / 合并后的技术信息），无需理解后端字段。
 */

export * from './types';
export * from './mediaMeta';
export * from './useLayoutHint';
export * from './useHome';
export * from './useLibraryList';
export * from './useLibraryDetail';
export * from './useItemDetail';
export * from './usePersonDetail';
export * from './useHistory';
export * from './usePlaybackSession';
export * from './useSearchOverlay';
