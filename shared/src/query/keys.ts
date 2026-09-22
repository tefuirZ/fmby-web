/**
 * 全局 Query Key Factory
 *
 * 集中管理所有 TanStack Query 缓存键，避免内联字符串散落各处导致失效不一致。
 *
 * 用法：
 * ```ts
 * import { queryKeys } from '@fmby/v2-shared/query';
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
    // V1F-10：人物面（/people/:personId 数据面；路径 `/api/items/people/{id}`）。
    person: (id: string) => ['item', 'person', id] as const,
    personItems: (id: string) => ['item', 'person-items', id] as const,
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
    emailChannel: () => ['settings', 'server', 'email-channel'] as const,
  },

  manage: {
    overview: () => ['manage', 'overview'] as const,
    overviewHome: () => ['manage', 'overview', 'home'] as const,
    siteSettings: () => ['manage', 'site-settings'] as const,
    siteBrand: () => ['manage', 'site-brand'] as const,
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
      sharePreview: (previewId: string) =>
        ['manage', 'pan115', 'share-preview', previewId] as const,
      shareItem: () => ['manage', 'pan115', 'share-item'] as const,
      syncOverview: (mountId: string) =>
        ['manage', 'pan115', 'sync-overview', mountId] as const,
    },

    microsoft: {
      configStatus: () => ['manage', 'microsoft', 'config-status'] as const,
      profiles: () => ['manage', 'microsoft', 'profiles'] as const,
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

    collections: {
      all: () => ['manage', 'collections'] as const,
      list: () => ['manage', 'collections', 'list'] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'collections', 'detail', id] as const)
          : (['manage', 'collections', 'detail'] as const),
      memberCandidates: (keyword: string) =>
        ['manage', 'collections', 'member-candidates', keyword] as const,
      presets: () => ['manage', 'collections', 'presets'] as const,
    },

    rewards: {
      account: (userId?: string) =>
        userId
          ? (['manage', 'rewards', 'account', userId] as const)
          : (['manage', 'rewards', 'account'] as const),
      ledger: (userId?: string, limit?: number) =>
        userId
          ? (['manage', 'rewards', 'ledger', userId, limit ?? null] as const)
          : (['manage', 'rewards', 'ledger'] as const),
      rule: () => (['manage', 'rewards', 'rule'] as const),
      stats: () => (['manage', 'rewards', 'stats'] as const),
    },

    telegramBot: {
      status: () => ['manage', 'telegram-bot', 'status'] as const,
    },

    license: {
      status: () => ['manage', 'license', 'status'] as const,
      deviceFlow: () => ['manage', 'license', 'device-flow'] as const,
    },

    secrets: {
      status: () => ['manage', 'secrets', 'status'] as const,
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

    mediaReviews: {
      all: () => ['manage', 'media-reviews'] as const,
      list: (query?: Record<string, unknown>) =>
        ['manage', 'media-reviews', 'list', query ?? {}] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'media-reviews', 'detail', id] as const)
          : (['manage', 'media-reviews', 'detail'] as const),
      providerSearch: (provider: string, query: string) =>
        ['manage', 'media-reviews', 'provider-search', provider, query] as const,
    },

    events: {
      list: (query?: Record<string, unknown>) =>
        ['manage', 'events', 'list', query ?? {}] as const,
      detail: (requestId?: string) =>
        requestId
          ? (['manage', 'events', 'detail', requestId] as const)
          : (['manage', 'events', 'detail'] as const),
    },

    operations: {
      overview: (days: number) => ['manage', 'operations', 'overview', days] as const,
    },

    systemAbout: {
      about: () => ['manage', 'system-about'] as const,
    },

    upstreams: {
      all: () => ['manage', 'upstreams'] as const,
      list: (query?: object) => ['manage', 'upstreams', 'list', query ?? {}] as const,
      detail: (id?: string) =>
        id
          ? (['manage', 'upstreams', 'detail', id] as const)
          : (['manage', 'upstreams', 'detail'] as const),
      health: (id: string) => ['manage', 'upstreams', 'health', id] as const,
      discovery: () => ['manage', 'upstreams', 'discovery'] as const,
      categories: (id?: string) =>
        id
          ? (['manage', 'upstreams', 'categories', id] as const)
          : (['manage', 'upstreams', 'categories'] as const),
      libraries: (id?: string) =>
        id
          ? (['manage', 'upstreams', 'libraries', id] as const)
          : (['manage', 'upstreams', 'libraries'] as const),
      bindings: (id?: string, libraryId?: string) =>
        id
          ? (['manage', 'upstreams', 'bindings', id, libraryId ?? null] as const)
          : (['manage', 'upstreams', 'bindings'] as const),
      presets: (id?: string) =>
        id
          ? (['manage', 'upstreams', 'presets', id] as const)
          : (['manage', 'upstreams', 'presets'] as const),
      syncJobs: (id: string) => ['manage', 'upstreams', 'sync-jobs', id] as const,
      embyImportJobs: (id: string) => ['manage', 'upstreams', 'emby-import-jobs', id] as const,
    },
  },
} as const;
