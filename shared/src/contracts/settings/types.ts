export interface SelectOption {
  value: string;
  label: string;
}

export interface UserProfileSettings {
  username: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  defaultLibraryId: string;
  bio: string;
  currentPassword: string;
  currentPasswordRequired: boolean;
  availableLibraries: SelectOption[];
}

export interface UserPlaybackSettings {
  subtitleLanguage: string;
  audioLanguage: string;
  resumePlayback: boolean;
  autoplayNextEpisode: boolean;
  preferExternalPlayer: boolean;
  availableLanguages: SelectOption[];
}

export interface HomeSectionPreference {
  id: string;
  label: string;
  enabled: boolean;
}

export interface UserAppearanceSettings {
  theme: 'system' | 'dark' | 'light';
  posterDensity: 'compact' | 'comfortable';
  reducedMotion: boolean;
  homeSections: HomeSectionPreference[];
}

export interface ServerGeneralSettings {
  siteName: string;
  allowRegistration: boolean;
  publicHomepageMessage: string;
  maintenanceBanner: string;
  supportContact: string;
}

export type LoginMode = 'password' | 'password+otp';
export type SensitiveActionConfirmation = 'none' | 'password' | 'session';
export type TokenRotationPolicy = 'always' | 'daily' | 'risk-only';

export interface ServerSecuritySettings {
  loginMode: LoginMode;
  loginRateLimitEnabled: boolean;
  loginRateLimitMaxAttempts: number;
  loginRateLimitWindowSeconds: number;
  failedLoginLockoutEnabled: boolean;
  failedLoginLockoutThreshold: number;
  failedLoginLockoutSeconds: number;
  sensitiveActionConfirmation: SensitiveActionConfirmation;
  requireCurrentPasswordForProfileChange: boolean;
}

export interface ServerSessionPolicySettings {
  userSessionTtlSeconds: number;
  adminSessionTtlSeconds: number;
  tokenRotationEnabled: boolean;
  rememberMeTtlDays: number;
  tokenRotationPolicy: TokenRotationPolicy;
  singleSessionForAdmins: boolean;
  compatLegacySessionFallbackEnabled: boolean;
}
