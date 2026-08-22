import type {
  ManageMountDetailRecord,
  ManageMountDirectoryBrowserResponse,
  ManageMountProviderType,
  CreateManageMountRequest,
} from '@/domains/manage';
import type { BannerState } from '@/shared/types/ui';
import type { MountFormState, MountFormErrors, MountDrawerState, MountRemoteAuthMode } from '../../types';

export interface MutationShape<TData, TVars> {
  isPending: boolean;
  variables: TVars | undefined;
  mutate: (vars: TVars) => void;
  data?: TData;
  error?: Error | null;
}

export interface MountDetailQueryShape {
  data: ManageMountDetailRecord | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface MountDrawerProps {
  drawerState: MountDrawerState | null;
  mountDetailQuery: MountDetailQueryShape;
  formState: MountFormState;
  setFormState: React.Dispatch<React.SetStateAction<MountFormState>>;
  formErrors: MountFormErrors;
  setFormErrors: React.Dispatch<React.SetStateAction<MountFormErrors>>;
  directoryBrowser: ManageMountDirectoryBrowserResponse | null;
  setDirectoryBrowser: (value: ManageMountDirectoryBrowserResponse | null) => void;
  pendingAuthModeChange: MountRemoteAuthMode | null;
  setPendingAuthModeChange: (value: MountRemoteAuthMode | null) => void;
  isSaving: boolean;
  isDeleting: boolean;
  createMountMutation: MutationShape<ManageMountDetailRecord, CreateManageMountRequest>;
  updateMountMutation: MutationShape<ManageMountDetailRecord, { mountId: string; form: MountFormState }>;
  validateMountMutation: MutationShape<ManageMountDetailRecord, string>;
  refreshMountAccessMutation: MutationShape<ManageMountDetailRecord, string>;
  browseDirectoriesMutation: MutationShape<ManageMountDirectoryBrowserResponse, { providerType: ManageMountProviderType; configJson: Record<string, unknown>; path?: string }>;
  setPendingDelete: (value: ManageMountDetailRecord | null) => void;
  setBanner: (value: BannerState | null) => void;
  setDrawerState: (state: MountDrawerState | null) => void;
  onClose: () => void;
}
