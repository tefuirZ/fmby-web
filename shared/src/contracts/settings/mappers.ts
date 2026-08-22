import type {
  HomeSectionPreference,
  SelectOption,
  ServerGeneralSettings,
  ServerSecuritySettings,
  ServerSessionPolicySettings,
  UserAppearanceSettings,
  UserPlaybackSettings,
  UserProfileSettings,
} from './types';
import type {
  RawServerGeneralResponse,
  RawServerSecurityResponse,
  RawServerSessionPolicyResponse,
  RawUpdateUserProfileRequest,
  RawUserAppearanceResponse,
  RawUserPlaybackResponse,
  RawUserProfileResponse,
} from './raw-types';

const AVAILABLE_LANGUAGES: SelectOption[] = [
  { value: '', label: '跟随内容默认' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

const HOME_SECTION_CATALOG: Array<{ id: string; label: string }> = [
  { id: 'continue', label: '继续观看' },
  { id: 'recent', label: '最近观看' },
  { id: 'added', label: '最近加入' },
  { id: 'libraries', label: '媒体库入口' },
];

export function mapUserProfile(raw: RawUserProfileResponse): UserProfileSettings {
  return {
    username: raw.username,
    displayName: raw.display_name ?? '',
    avatarUrl: raw.avatar_url ?? '',
    email: raw.email ?? '',
    bio: raw.bio ?? '',
    defaultLibraryId: raw.default_library_id ?? '',
    currentPassword: '',
    currentPasswordRequired: raw.current_password_required ?? false,
    availableLibraries: [],
  };
}

export function mapUserProfileToApi(
  payload: UserProfileSettings,
): RawUpdateUserProfileRequest {
  return {
    display_name: emptyToNull(payload.displayName),
    avatar_url: emptyToNull(payload.avatarUrl),
    default_library_id: emptyToNull(payload.defaultLibraryId),
    email: emptyToNull(payload.email),
    bio: emptyToNull(payload.bio),
    current_password: emptyToNull(payload.currentPassword),
  };
}

export function mapUserPlayback(raw: RawUserPlaybackResponse): UserPlaybackSettings {
  return {
    subtitleLanguage: raw.default_subtitle_language ?? '',
    audioLanguage: raw.default_audio_language ?? '',
    resumePlayback: raw.auto_resume,
    autoplayNextEpisode: raw.autoplay_next_episode ?? true,
    preferExternalPlayer: raw.prefer_external_player,
    availableLanguages: AVAILABLE_LANGUAGES,
  };
}

export function mapUserPlaybackToApi(
  payload: UserPlaybackSettings,
): RawUserPlaybackResponse {
  return {
    default_subtitle_language: emptyToNull(payload.subtitleLanguage),
    default_audio_language: emptyToNull(payload.audioLanguage),
    auto_resume: payload.resumePlayback,
    autoplay_next_episode: payload.autoplayNextEpisode,
    prefer_external_player: payload.preferExternalPlayer,
  };
}

export function mapUserAppearance(
  raw: RawUserAppearanceResponse,
): UserAppearanceSettings {
  const enabled = new Set(raw.home_sections ?? []);
  return {
    theme: raw.theme,
    posterDensity: raw.poster_density,
    reducedMotion: raw.reduced_motion,
    homeSections: HOME_SECTION_CATALOG.map((section): HomeSectionPreference => ({
      id: section.id,
      label: section.label,
      enabled: enabled.has(section.id),
    })),
  };
}

export function mapUserAppearanceToApi(
  payload: UserAppearanceSettings,
): RawUserAppearanceResponse {
  return {
    theme: payload.theme,
    poster_density: payload.posterDensity,
    reduced_motion: payload.reducedMotion,
    home_sections: payload.homeSections
      .filter((item) => item.enabled)
      .map((item) => item.id),
  };
}

export function mapServerGeneral(
  raw: RawServerGeneralResponse,
): ServerGeneralSettings {
  return {
    siteName: raw.site_name,
    allowRegistration: raw.registration_enabled,
    publicHomepageMessage: raw.homepage_message,
    maintenanceBanner: raw.maintenance_banner ?? '',
    supportContact: raw.support_contact ?? '',
  };
}

export function mapServerGeneralToApi(
  payload: ServerGeneralSettings,
): RawServerGeneralResponse {
  return {
    site_name: payload.siteName,
    registration_enabled: payload.allowRegistration,
    homepage_message: payload.publicHomepageMessage,
    maintenance_banner: payload.maintenanceBanner,
    support_contact: payload.supportContact,
  };
}

export function mapServerSecurity(
  raw: RawServerSecurityResponse,
): ServerSecuritySettings {
  return {
    loginMode: raw.login_mode ?? 'password',
    loginRateLimitEnabled: raw.login_rate_limit_enabled ?? true,
    loginRateLimitMaxAttempts: positiveIntegerOrFallback(
      raw.login_rate_limit_max_attempts,
      5,
    ),
    loginRateLimitWindowSeconds: positiveIntegerOrFallback(
      raw.login_rate_limit_window_seconds,
      900,
    ),
    failedLoginLockoutEnabled: raw.failed_login_lockout_enabled ?? true,
    failedLoginLockoutThreshold: positiveIntegerOrFallback(
      raw.failed_login_lockout_threshold,
      5,
    ),
    failedLoginLockoutSeconds: positiveIntegerOrFallback(
      raw.failed_login_lockout_seconds,
      900,
    ),
    sensitiveActionConfirmation: raw.sensitive_action_confirmation ?? 'session',
    requireCurrentPasswordForProfileChange:
      raw.require_current_password_for_profile_change ?? false,
  };
}

export function mapServerSecurityToApi(
  payload: ServerSecuritySettings,
): RawServerSecurityResponse {
  return {
    login_mode: payload.loginMode,
    login_rate_limit_enabled: payload.loginRateLimitEnabled,
    login_rate_limit_max_attempts: payload.loginRateLimitMaxAttempts,
    login_rate_limit_window_seconds: payload.loginRateLimitWindowSeconds,
    failed_login_lockout_enabled: payload.failedLoginLockoutEnabled,
    failed_login_lockout_threshold: payload.failedLoginLockoutThreshold,
    failed_login_lockout_seconds: payload.failedLoginLockoutSeconds,
    sensitive_action_confirmation: payload.sensitiveActionConfirmation,
    require_current_password_for_profile_change:
      payload.requireCurrentPasswordForProfileChange,
  };
}

export function mapServerSessionPolicy(
  raw: RawServerSessionPolicyResponse,
): ServerSessionPolicySettings {
  return {
    userSessionTtlSeconds: positiveIntegerOrFallback(
      raw.user_session_ttl_seconds,
      60 * 60,
    ),
    adminSessionTtlSeconds: positiveIntegerOrFallback(
      raw.admin_session_ttl_seconds,
      30 * 60,
    ),
    tokenRotationEnabled: raw.token_rotation_enabled ?? true,
    rememberMeTtlDays: positiveIntegerOrFallback(raw.remember_me_ttl_days, 14),
    tokenRotationPolicy: raw.token_rotation_policy ?? 'daily',
    singleSessionForAdmins: raw.single_session_for_admins ?? false,
    compatLegacySessionFallbackEnabled:
      raw.compat_legacy_session_fallback_enabled ?? false,
  };
}

export function mapServerSessionPolicyToApi(
  payload: ServerSessionPolicySettings,
): RawServerSessionPolicyResponse {
  return {
    user_session_ttl_seconds: payload.userSessionTtlSeconds,
    admin_session_ttl_seconds: payload.adminSessionTtlSeconds,
    token_rotation_enabled: payload.tokenRotationEnabled,
    remember_me_ttl_days: payload.rememberMeTtlDays,
    token_rotation_policy: payload.tokenRotationPolicy,
    single_session_for_admins: payload.singleSessionForAdmins,
    compat_legacy_session_fallback_enabled:
      payload.compatLegacySessionFallbackEnabled,
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function positiveIntegerOrFallback(
  value: number | null | undefined,
  fallback: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.round(value);
}
