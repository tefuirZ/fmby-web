import { useQuery } from '@tanstack/react-query';
import { manageApi } from '@/domains/manage/api';
import { namingCleanupApi } from '@/domains/manage/naming';
import { queryKeys } from '@/shared/query-keys';
import type {
  NamingCleanupLibraryType,
  UpdateNamingScrapeSettingsRequest,
} from '@/domains/manage/naming';

export function useNamingRulesSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.manage.namingScrape.settings(),
    queryFn: () => namingCleanupApi.getScrapeSettings(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useLibrariesQueryForNaming() {
  return useQuery({
    queryKey: queryKeys.manage.libraries.list(),
    queryFn: () => manageApi.getLibraries(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useNamingPreviewQuery(
  debouncedPath: string,
  libraryType: NamingCleanupLibraryType,
  normalizedDraft: UpdateNamingScrapeSettingsRequest | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.manage.namingCleanup.preview(
      normalizedDraft
        ? {
            rawPath: debouncedPath,
            libraryType,
            settings: normalizedDraft.cleanup,
          }
        : undefined,
    ),
    queryFn: () =>
      namingCleanupApi.preview({
        rawPath: debouncedPath,
        libraryType,
        settings: normalizedDraft?.cleanup,
      }),
    enabled,
    retry: false,
    staleTime: 5_000,
  });
}
