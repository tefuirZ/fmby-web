import type {
  LoginMode,
  SensitiveActionConfirmation,
  TokenRotationPolicy,
} from './types';

export interface RawUserProfileResponse {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  default_library_id?: string | null;
  email?: string | null;
  bio?: string | null;
  current_password_required?: boolean;
}

export interface RawUpdateUserProfileRequest {
  display_name?: string | null;
  avatar_url?: string | null;
  default_library_id?: string | null;
  email?: string | null;
  bio?: string | null;
  current_password?: string | null;
}

export interface RawUserPlaybackResponse {
  default_subtitle_language?: string | null;
  default_audio_language?: string | null;
  auto_resume: boolean;
  autoplay_next_episode?: boolean;
  prefer_external_player: boolean;
}

export interface RawUserAppearanceResponse {
  theme: 'system' | 'dark' | 'light';
  poster_density: 'compact' | 'comfortable';
  reduced_motion: boolean;
  home_sections: string[];
}

export interface RawServerGeneralResponse {
  site_name: string;
  registration_enabled: boolean;
  homepage_message: string;
  maintenance_banner?: string;
  support_contact?: string;
}

export interface RawServerSecurityResponse {
  login_mode?: LoginMode;
  login_rate_limit_enabled: boolean;
  login_rate_limit_max_attempts: number;
  login_rate_limit_window_seconds: number;
  failed_login_lockout_enabled: boolean;
  failed_login_lockout_threshold: number;
  failed_login_lockout_seconds: number;
  sensitive_action_confirmation: SensitiveActionConfirmation;
  require_current_password_for_profile_change?: boolean;
}

export interface RawServerSessionPolicyResponse {
  user_session_ttl_seconds: number;
  admin_session_ttl_seconds: number;
  token_rotation_enabled: boolean;
  remember_me_ttl_days?: number;
  token_rotation_policy?: TokenRotationPolicy;
  single_session_for_admins?: boolean;
  compat_legacy_session_fallback_enabled?: boolean;
}
