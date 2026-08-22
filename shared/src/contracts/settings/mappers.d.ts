import type { ServerGeneralSettings, ServerSecuritySettings, ServerSessionPolicySettings, UserAppearanceSettings, UserPlaybackSettings, UserProfileSettings } from './types';
import type { RawServerGeneralResponse, RawServerSecurityResponse, RawServerSessionPolicyResponse, RawUpdateUserProfileRequest, RawUserAppearanceResponse, RawUserPlaybackResponse, RawUserProfileResponse } from './raw-types';
export declare function mapUserProfile(raw: RawUserProfileResponse): UserProfileSettings;
export declare function mapUserProfileToApi(payload: UserProfileSettings): RawUpdateUserProfileRequest;
export declare function mapUserPlayback(raw: RawUserPlaybackResponse): UserPlaybackSettings;
export declare function mapUserPlaybackToApi(payload: UserPlaybackSettings): RawUserPlaybackResponse;
export declare function mapUserAppearance(raw: RawUserAppearanceResponse): UserAppearanceSettings;
export declare function mapUserAppearanceToApi(payload: UserAppearanceSettings): RawUserAppearanceResponse;
export declare function mapServerGeneral(raw: RawServerGeneralResponse): ServerGeneralSettings;
export declare function mapServerGeneralToApi(payload: ServerGeneralSettings): RawServerGeneralResponse;
export declare function mapServerSecurity(raw: RawServerSecurityResponse): ServerSecuritySettings;
export declare function mapServerSecurityToApi(payload: ServerSecuritySettings): RawServerSecurityResponse;
export declare function mapServerSessionPolicy(raw: RawServerSessionPolicyResponse): ServerSessionPolicySettings;
export declare function mapServerSessionPolicyToApi(payload: ServerSessionPolicySettings): RawServerSessionPolicyResponse;
//# sourceMappingURL=mappers.d.ts.map