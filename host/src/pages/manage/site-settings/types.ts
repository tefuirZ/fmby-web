import type {
  ServerGeneralSettings,
  ServerSecuritySettings,
  ServerSessionPolicySettings,
} from '@/domains/settings';

export interface SiteSettingsDraft {
  general: ServerGeneralSettings;
  security: ServerSecuritySettings;
  sessionPolicy: ServerSessionPolicySettings;
}
