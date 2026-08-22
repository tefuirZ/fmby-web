export declare const QUICK_LINKS: readonly [{
    readonly id: "add-media";
    readonly label: "添加媒体";
    readonly description: "按顺序把来源、媒体库、刮削和入库主链路走通。";
    readonly to: "/manage/media/add";
}, {
    readonly id: "libraries";
    readonly label: "媒体库";
    readonly description: "查看电影库、剧集库和来源绑定是否完整。";
    readonly to: "/manage/media/libraries";
}, {
    readonly id: "mounts";
    readonly label: "媒体来源";
    readonly description: "检查本地目录、OpenList 和其他来源是否可用。";
    readonly to: "/manage/media/mounts";
}, {
    readonly id: "site-settings";
    readonly label: "站点设置";
    readonly description: "把注册、登录安全和会话时长放在一页调整。";
    readonly to: "/manage/site/settings";
}, {
    readonly id: "invites";
    readonly label: "邀请与用户";
    readonly description: "准备邀请码、新建账号并管理现有用户。";
    readonly to: "/manage/site/users/registration-codes";
}];
export declare function mapRoleToLabel(raw: string): "超级管理员" | "管理员" | "受限用户" | "普通用户";
export declare function mapEnvironmentLabel(raw: string): "环境异常" | "需要关注" | "运行正常";
//# sourceMappingURL=labels.d.ts.map