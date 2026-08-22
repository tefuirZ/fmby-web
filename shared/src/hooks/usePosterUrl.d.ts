import type { ArtworkSet } from '@fmby/v2-shared/contracts/assets';
/**
 * 海报图片智能降级 hook
 *
 * 优先级：poster -> thumb -> backdrop -> null（文字占位）
 * 原生由 <img> 的 onError 触发下级切换，避免由于 pre-fetch 失败导致整链截断。
 */
export declare function usePosterUrl(artwork: ArtworkSet): {
    url: string | null;
    isLoading: boolean;
    onError: () => void;
};
/**
 * 背景大图智能降级 hook
 *
 * 优先级：banner -> backdrop -> thumb -> poster -> null
 */
export declare function useBackdropUrl(artwork: ArtworkSet): {
    url: string | null;
    onError: () => void;
};
/**
 * 根据标题生成无封面条目的占位底色。
 */
export declare function generatePlaceholderColor(title: string): string;
//# sourceMappingURL=usePosterUrl.d.ts.map