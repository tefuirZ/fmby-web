export * from "./types";
export {
  peripheralsApi,
  isBackendUnavailableError,
  isServiceUnwiredError,
  // FE-USER-COLLECTIONS-BROWSE：用户面合集详情复用同一 DTO mapper。
  fromDetail,
} from "./api";
export type { RawManagedCollectionDetail } from "./api";
