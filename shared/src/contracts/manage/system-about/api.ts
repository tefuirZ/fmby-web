import { httpClient } from "@fmby/v2-shared/api/client";
import { isApiError } from "@fmby/v2-shared/errors";
import type { SystemAboutResponse } from "./types";

/** 后端依赖探测 IO 失败等 fail-closed 判定（与 operations 同口径）。 */
export function isSystemAboutUnwiredError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return status === 500;
}

interface RawSystemAboutResponse {
  generated_at: string;
  app: {
    name: string;
    version: string;
    release_tag?: string;
    commit_sha?: string;
    build_time?: string;
    build_channel?: string;
  };
  links: {
    github_profile: string;
    source_repo: string;
    distribution_repo: string;
    dockerhub_repo: string;
    changelog: string;
  };
  runtime: {
    rust_package_version: string;
    target_os: string;
    target_arch: string;
    features: string[];
  };
  dependencies: Array<{
    id: string;
    name: string;
    status: string;
    required: boolean;
    version?: string;
    message?: string;
  }>;
  warnings?: string[];
}

function fromRaw(raw: RawSystemAboutResponse): SystemAboutResponse {
  return {
    generatedAt: raw.generated_at,
    app: {
      name: raw.app.name,
      version: raw.app.version,
      releaseTag: raw.app.release_tag,
      commitSha: raw.app.commit_sha,
      buildTime: raw.app.build_time,
      buildChannel: raw.app.build_channel,
    },
    links: {
      githubProfile: raw.links.github_profile,
      sourceRepo: raw.links.source_repo,
      distributionRepo: raw.links.distribution_repo,
      dockerhubRepo: raw.links.dockerhub_repo,
      changelog: raw.links.changelog,
    },
    runtime: {
      rustPackageVersion: raw.runtime.rust_package_version,
      targetOs: raw.runtime.target_os,
      targetArch: raw.runtime.target_arch,
      features: raw.runtime.features,
    },
    dependencies: raw.dependencies.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      required: d.required,
      version: d.version,
      message: d.message,
    })),
    warnings: raw.warnings ?? [],
  };
}

/** 系统关于 API（V1F-06，capability ManageAccess）。 */
export const systemAboutApi = {
  async about(): Promise<SystemAboutResponse> {
    const raw = await httpClient.get<RawSystemAboutResponse>("/api/manage/system/about");
    return fromRaw(raw);
  },
};
