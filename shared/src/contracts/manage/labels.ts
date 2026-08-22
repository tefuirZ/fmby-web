// UI 展示常量：中文标签、枚举显示文本等。

export const QUICK_LINKS = [
  {
    id: "add-media",
    label: "添加媒体",
    description: "按顺序把来源、媒体库、刮削和入库主链路走通。",
    to: "/manage/media/add",
  },
  {
    id: "libraries",
    label: "媒体库",
    description: "查看电影库、剧集库和来源绑定是否完整。",
    to: "/manage/media/libraries",
  },
  {
    id: "mounts",
    label: "媒体来源",
    description: "检查本地目录、OpenList 和其他来源是否可用。",
    to: "/manage/media/mounts",
  },
  {
    id: "site-settings",
    label: "站点设置",
    description: "把注册、登录安全和会话时长放在一页调整。",
    to: "/manage/site/settings",
  },
  {
    id: "invites",
    label: "邀请与用户",
    description: "准备邀请码、新建账号并管理现有用户。",
    to: "/manage/site/users/registration-codes",
  },
] as const;

export function mapRoleToLabel(raw: string) {
  switch (raw) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "restricted_user":
      return "受限用户";
    default:
      return "普通用户";
  }
}

export function mapEnvironmentLabel(raw: string) {
  switch (raw) {
    case "critical":
      return "环境异常";
    case "warning":
      return "需要关注";
    default:
      return "运行正常";
  }
}
