/** 系统关于响应（GET /api/manage/system/about；V1F-06）。 */

/** 应用版本组。 */
export interface SystemAboutApp {
  name: string;
  /** 展示版本：release tag 归一化优先，缺省 = 后端 Cargo 包版本。 */
  version: string;
  /** 以下构建元信息由后端编译期注入；dev 构建常缺省（wire 上整体省略）。 */
  releaseTag?: string;
  commitSha?: string;
  buildTime?: string;
  buildChannel?: string;
}

/** 分发/仓库链接组。 */
export interface SystemAboutLinks {
  githubProfile: string;
  sourceRepo: string;
  distributionRepo: string;
  dockerhubRepo: string;
  changelog: string;
}

/** 编译运行时组。 */
export interface SystemAboutRuntime {
  rustPackageVersion: string;
  targetOs: string;
  targetArch: string;
  features: string[];
}

/** 运行依赖探测项（ffprobe / ffmpeg）。 */
export interface SystemDependency {
  id: string;
  name: string;
  /** ok / missing / error。 */
  status: string;
  required: boolean;
  version?: string;
  message?: string;
}

/**
 * 系统关于响应（snake_case 直出，与 V1 wire 同形）。
 *
 * 与 V1 的 wire 差异：V1 `deployment{database,redis}` 组 V2 无对位
 * （无 Redis；SQLite 双轨），后端整组省略——本类型不含该字段。
 */
export interface SystemAboutResponse {
  /** RFC3339 UTC。 */
  generatedAt: string;
  app: SystemAboutApp;
  links: SystemAboutLinks;
  runtime: SystemAboutRuntime;
  dependencies: SystemDependency[];
  /** 仅当必需依赖不可用时非空。 */
  warnings: string[];
}

/** 依赖状态 → 展示标签（与 V1 getManageSystemDependencyStatusLabel 同口径）。 */
export function systemDependencyStatusLabel(status?: string | null): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'ok':
      return '正常';
    case 'missing':
      return '缺失';
    case 'unavailable':
      return '不可用';
    case 'error':
      return '错误';
    case 'skipped':
      return '跳过';
    default:
      return status || '未知';
  }
}
