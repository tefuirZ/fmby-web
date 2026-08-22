import type {
  ServerGeneralSettings,
  ServerSecuritySettings,
  ServerSessionPolicySettings,
} from '@fmby/v2-shared/contracts/settings';

export interface SiteSettingsDraft {
  general: ServerGeneralSettings;
  security: ServerSecuritySettings;
  sessionPolicy: ServerSessionPolicySettings;
}
