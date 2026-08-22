import type { ServerGeneralSettings, ServerSecuritySettings, ServerSessionPolicySettings, UserAppearanceSettings, UserPlaybackSettings, UserProfileSettings } from './types';
export declare const settingsApi: {
    getUserProfile(): Promise<UserProfileSettings>;
    saveUserProfile(payload: UserProfileSettings): Promise<UserProfileSettings>;
    getUserPlayback(): Promise<UserPlaybackSettings>;
    saveUserPlayback(payload: UserPlaybackSettings): Promise<UserPlaybackSettings>;
    getUserAppearance(): Promise<UserAppearanceSettings>;
    saveUserAppearance(payload: UserAppearanceSettings): Promise<UserAppearanceSettings>;
    getServerGeneral(): Promise<ServerGeneralSettings>;
    saveServerGeneral(payload: ServerGeneralSettings): Promise<ServerGeneralSettings>;
    getServerSecurity(): Promise<ServerSecuritySettings>;
    saveServerSecurity(payload: ServerSecuritySettings): Promise<ServerSecuritySettings>;
    getServerSessionPolicy(): Promise<ServerSessionPolicySettings>;
    saveServerSessionPolicy(payload: ServerSessionPolicySettings): Promise<ServerSessionPolicySettings>;
};
//# sourceMappingURL=api.d.ts.map