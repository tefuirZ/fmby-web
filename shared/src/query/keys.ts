/**
 * 全局 Query Key Factory
 *
 * 集中管理所有 TanStack Query 缓存键，避免内联字符串散落各处导致失效不一致。
 *
 * 用法：
 * ```ts
 * import { queryKeys } from '@/shared/query-keys';
 * useQuery({ queryKey: queryKeys.manage.mounts.list(), ... });
 * queryClient.invalidateQueries({ queryKey: queryKeys.manage.mounts.list() });
 * ```
 */

export const queryKeys = {
  auth: {
    setupStatus: () => ['auth', 'setup-status'] as const,
  },

  browse: {
    home: () => ['browse', 'home'] as const,
    libraries: () => ['browse', 'libraries'] as const,
    librariesHome: () => ['browse', 'libraries', 'home'] as const,
    library: (id: string) => ['browse', 'library', id] as const,
  },

  history: {
    overview: () => ['history', 'overview'] as const,
    recentHome: () => ['history', 'recent', 'home'] as const,
  },

  item: {
    detail: (id: string) => ['item', id] as const,
    seasonEpisodes: (seasonId: string) => ['item', 'season-episodes', seasonId] as const,
    technicalFallback: (id?: string) => ['item', 'technical-fallback', id] as const,
  },

  playback: {
    info: (id: string) => ['playback', id] as const,
    item: (id: string) => ['playback-item', id] as const,
    season: (id?: string) => ['playback-season', id] as const,
    series: (id?: string) => ['playback-series', id] as const,
    seriesEpisodes: (id?: string) => ['playback-series-episodes', id] as const,
  },

  search: {
    results: (query: string) => ['search', query] as const,
  },

  settings: {
    profile: () => ['settings', 'profile'] as const,
    appearance: () => ['settings', 'appearance'] as const,
    playback: () => ['settings', 'playback'] as const,
    server: {
      general: () => ['settings', 'server', 'general'] as const,
      security: () => ['settings', 'server', 'security'] as const,
      sessionPolicy: () => ['settings', 'server', 'session-policy'] as const,
    },
  },

  manage: {
    overview: () => ['manage', 'overview'] as const,
    overviewHome: () => ['manage', 'overview', 'home'] as const,
    siteSettings: () => ['manage', 'site-settings'] as const,
    advanced: () => ['manage', 'advanced'] as const,
    auditLogs: () => ['manage', 'audit-logs'] as const,
    sessions: () => ['manage', 'sessions'] as const,
    scans: () => ['manage', 'scans'] as const,
    taskCenter: {
      all: () => ['manage', 'task-center'] as const,
      overview: () => ['manage', 'task-center', 'overview'] as const,
      list: (query?: Record<string, unknown>) =>
        ['manage', 'task-center', 'list', query ?? {}] as const,
      detail: (category?: string, taskId?: string) =>
        category && taskId
          ? (['manage', 'task-center', 'detail', category, taskId] as const)
          : (['manage', 'task-center', 'detail'] as const),
    },
    mediaItems: {
      all: () => ['manage', 'media-items'] as const,
      list: (query?: Record<string, unknown>) =>
        ['manage', 'media-items', 'list', query ?? {}] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'media-items', 'detail', id] as const)
          : (['manage', 'media-items', 'detail'] as const),
      pipeline: (id?: string) =>
        id
          ? (['manage', 'media-items', 'pipeline', id] as const)
          : (['manage', 'media-items', 'pipeline'] as const),
    },

    libraries: {
      list: () => ['manage', 'libraries'] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'libraries', 'detail', id] as const)
          : (['manage', 'libraries', 'detail'] as const),
      mountsPicker: () => ['manage', 'mounts', 'picker'] as const,
      usersPicker: () => ['manage', 'users', 'picker'] as const,
    },

    mounts: {
      list: () => ['manage', 'mounts'] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'mounts', 'detail', id] as const)
          : (['manage', 'mounts', 'detail'] as const),
      picker: () => ['manage', 'mounts', 'picker'] as const,
    },

    pan115: {
      account: (mountId: string) => ['manage', 'pan115', 'account', mountId] as const,
    },

    pan115Imghost: {
      credentials: () => ['manage', 'pan115-imghost', 'credentials'] as const,
      assets: {
        all: () => ['manage', 'pan115-imghost', 'assets'] as const,
        list: (page: number) => ['manage', 'pan115-imghost', 'assets', page] as const,
      },
    },

    users: {
      all: () => ['manage', 'users'] as const,
      list: (query?: object) =>
        ['manage', 'users', 'list', query ?? {}] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'users', 'detail', id] as const)
          : (['manage', 'users', 'detail'] as const),
    },

    probeTasks: {
      all: () => ['manage', 'probe-tasks'] as const,
      list: (
        statusFilter?: string,
        keyword?: string,
        libraryId?: string,
        mountId?: string,
      ) => ['manage', 'probe-tasks', statusFilter, keyword, libraryId, mountId] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'probe-tasks', 'detail', id] as const)
          : (['manage', 'probe-tasks', 'detail'] as const),
    },

    registrationCodes: {
      list: () => ['manage', 'registration-codes'] as const,
    },

    roleTemplates: {
      list: () => ['manage', 'role-templates'] as const,
    },

    namingCleanup: {
      settings: () => ['manage', 'naming-cleanup', 'settings'] as const,
      preview: (payload?: Record<string, unknown>) =>
        ['manage', 'naming-cleanup', 'preview', payload ?? {}] as const,
    },

    namingScrape: {
      settings: () => ['manage', 'naming-scrape', 'settings'] as const,
    },

    runtimeLogs: (...args: unknown[]) => ['manage', 'runtime-logs', ...args] as const,
  },
} as const;
