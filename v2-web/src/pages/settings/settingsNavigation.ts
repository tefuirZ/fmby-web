/**
 * 设置中心导航结构
 *
 * 设置中心只承载「当前用户的个人偏好」。服务器级设置（站点常规 / 安全策略 /
 * 会话策略）统一收敛到管理端 /manage/site/settings 一处维护，避免同一份配置
 * 出现两套入口与两套表单。
 */
export interface SettingsNavItem {
  to: string;
  label: string;
  description: string;
}

export interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

export const settingsNavGroups: SettingsNavGroup[] = [
  {
    label: '个人',
    items: [
      {
        to: '/settings/profile',
        label: '个人资料',
        description: '昵称、头像、默认媒体库',
      },
      {
        to: '/settings/playback',
        label: '播放偏好',
        description: '字幕、音轨与继续播放策略',
      },
      {
        to: '/settings/appearance',
        label: '外观',
        description: '主题、海报密度与动效偏好',
      },
    ],
  },
];
