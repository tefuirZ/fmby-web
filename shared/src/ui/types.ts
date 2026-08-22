/** 页面内联横幅状态（通用于 manage 页面的轻提示）。 */
export type BannerState = {
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
};
