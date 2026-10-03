export * from "./types";
export {
  peripheralsApi,
  isBackendUnavailableError,
  isServiceUnwiredError,
  // FE-USER-COLLECTIONS-BROWSE：用户面合集详情复用同一 DTO mapper。
  fromDetail,
  // FE-USER-COLLECTIONS-LIST-PAGE-2：用户面合集列表复用同一 mapper。
  fromCollection,
} from "./api";
export type { RawManagedCollectionDetail, RawManagedCollection } from "./api";
