import type { useManageMediaItemMetadataMutations } from '../media-items/hooks';

/**
 * 详情页各段落共享的 mutation 集合。
 *
 * 所有写操作都由 `useManageMediaItemMetadataMutations` 在页面顶层建好并向下传，
 * 保证缓存失效逻辑只有一份：段落只负责触发和展示状态，不自己拼请求。
 */
export type MediaItemMutations = ReturnType<typeof useManageMediaItemMetadataMutations>;
