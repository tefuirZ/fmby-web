import { httpClient } from '@/shared/api/client';
import type {
  ServerGeneralSettings,
  ServerSecuritySettings,
  ServerSessionPolicySettings,
  UserAppearanceSettings,
  UserPlaybackSettings,
  UserProfileSettings,
} from './types';
import {
  mapServerGeneral,
  mapServerGeneralToApi,
  mapServerSecurity,
  mapServerSecurityToApi,
  mapServerSessionPolicy,
  mapServerSessionPolicyToApi,
  mapUserAppearance,
  mapUserAppearanceToApi,
  mapUserPlayback,
  mapUserPlaybackToApi,
  mapUserProfile,
  mapUserProfileToApi,
} from './mappers';
import type {
  RawServerGeneralResponse,
  RawServerSecurityResponse,
  RawServerSessionPolicyResponse,
  RawUserAppearanceResponse,
  RawUserPlaybackResponse,
  RawUserProfileResponse,
} from './raw-types';

export const settingsApi = {
  async getUserProfile(): Promise<UserProfileSettings> {
    const raw = await httpClient.get<RawUserProfileResponse>('/api/settings/user/profile');
    return mapUserProfile(raw);
  },

  async saveUserProfile(payload: UserProfileSettings): Promise<UserProfileSettings> {
    const raw = await httpClient.put<RawUserProfileResponse>('/api/settings/user/profile', {
      body: mapUserProfileToApi(payload),
    });
    return mapUserProfile(raw);
  },

  async getUserPlayback(): Promise<UserPlaybackSettings> {
    const raw = await httpClient.get<RawUserPlaybackResponse>('/api/settings/user/playback');
    return mapUserPlayback(raw);
  },

  async saveUserPlayback(payload: UserPlaybackSettings): Promise<UserPlaybackSettings> {
    const raw = await httpClient.put<RawUserPlaybackResponse>(
      '/api/settings/user/playback',
      {
        body: mapUserPlaybackToApi(payload),
      },
    );
    return mapUserPlayback(raw);
  },

  async getUserAppearance(): Promise<UserAppearanceSettings> {
    const raw = await httpClient.get<RawUserAppearanceResponse>('/api/settings/user/appearance');
    return mapUserAppearance(raw);
  },

  async saveUserAppearance(payload: UserAppearanceSettings): Promise<UserAppearanceSettings> {
    const raw = await httpClient.put<RawUserAppearanceResponse>(
      '/api/settings/user/appearance',
      {
        body: mapUserAppearanceToApi(payload),
      },
    );
    return mapUserAppearance(raw);
  },

  async getServerGeneral(): Promise<ServerGeneralSettings> {
    const raw = await httpClient.get<RawServerGeneralResponse>('/api/settings/server/general');
    return mapServerGeneral(raw);
  },

  async saveServerGeneral(payload: ServerGeneralSettings): Promise<ServerGeneralSettings> {
    const raw = await httpClient.put<RawServerGeneralResponse>(
      '/api/settings/server/general',
      {
        body: mapServerGeneralToApi(payload),
      },
    );
    return mapServerGeneral(raw);
  },

  async getServerSecurity(): Promise<ServerSecuritySettings> {
    const raw = await httpClient.get<RawServerSecurityResponse>('/api/settings/server/security');
    return mapServerSecurity(raw);
  },

  async saveServerSecurity(payload: ServerSecuritySettings): Promise<ServerSecuritySettings> {
    const raw = await httpClient.put<RawServerSecurityResponse>(
      '/api/settings/server/security',
      {
        body: mapServerSecurityToApi(payload),
      },
    );
    return mapServerSecurity(raw);
  },

  async getServerSessionPolicy(): Promise<ServerSessionPolicySettings> {
    const raw = await httpClient.get<RawServerSessionPolicyResponse>(
      '/api/settings/server/session-policy',
    );
    return mapServerSessionPolicy(raw);
  },

  async saveServerSessionPolicy(
    payload: ServerSessionPolicySettings,
  ): Promise<ServerSessionPolicySettings> {
    const raw = await httpClient.put<RawServerSessionPolicyResponse>(
      '/api/settings/server/session-policy',
      {
        body: mapServerSessionPolicyToApi(payload),
      },
    );
    return mapServerSessionPolicy(raw);
  },
};
