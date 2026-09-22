import { useEffect, useRef, useState } from 'react';
import { pan115Api } from '@fmby/v2-shared/contracts/manage/pan115';
import { FeedbackState } from '@fmby/v2-shared/ui';
import { SideDrawer } from '@fmby/v2-shared/ui';
import { useCredentialProbe } from '@fmby/v2-shared/hooks/useCredentialProbe';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import { logger } from '@fmby/v2-shared/utils/logger';
import styles from '../../../ManagePages.module.css';
import type { MountDrawerProps } from './types';
import {
  buildMountFormState,
  getMountDrawerDescription,
  getMountDrawerTitle,
  isWebDavProvider,
  isS3Provider,
  supportsDirectoryBrowser,
} from '../../formUtils';
import { MountDirectoryBrowserCard } from '../MountDirectoryBrowserCard';
import { useAdvancedSectionState, useMountDrawerHandlers } from './hooks';
import {
  BasicInfoSection,
  MountProviderFields,
  CapabilitiesSection,
  PathPoliciesSection,
  PreservedConfigSection,
  MountOverviewSection,
  MountCapabilitiesViewSection,
  MountPathPoliciesViewSection,
  MountReferencesSection,
  MountConnectionConfigSection,
  MountLinkedSourcesSection,
  MountScanTasksSection,
  MountViewWarningBanners,
  MountCredentialCard,
  MountDeletePanel,
  AdvancedSectionWrapper,
  Pan115CredentialsSection,
  Pan115DirectoryBrowserSection,
  type Pan115CreatePendingActivation,
} from './sections';
import { useMountHealthFaultMap } from '../../hooks/useMountHealthFaultMap';

export function MountDrawer({
  drawerState,
  mountDetailQuery,
  formState,
  setFormState,
  formErrors,
  setFormErrors,
  directoryBrowser,
  setDirectoryBrowser,
  pendingAuthModeChange: _pendingAuthModeChange,
  setPendingAuthModeChange,
  isSaving,
  isDeleting,
  createMountMutation,
  updateMountMutation,
  validateMountMutation,
  refreshMountAccessMutation,
  browseDirectoriesMutation,
  setPendingDelete,
  setBanner,
  setDrawerState,
  onClose,
}: MountDrawerProps) {
  const currentDetail = mountDetailQuery.data;
  // 观察面补充文案（与列表面同源；不参与徽标判定，只在不重复告警时补一句）
  const healthFaultActionById = useMountHealthFaultMap();
  const isDrawerOpen = drawerState !== null;
  const isWebDavS3Form =
    isWebDavProvider(formState.providerType) || isS3Provider(formState.providerType);
  // Pan115 创建凭据：扫码 / 手填 cookie 二选一，等 mount 创建成功后再 activate
  const [pan115Pending, setPan115Pending] = useState<Pan115CreatePendingActivation | null>(null);
  const activateAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    const detail = createMountMutation.data;
    if (!detail) return;
    if (detail.providerType !== 'pan115') return;
    if (activateAttemptedRef.current === detail.mount.id) return;
    if (!pan115Pending) return;
    activateAttemptedRef.current = detail.mount.id;
    const payload = pan115Pending.mode === 'qr'
      ? { mountId: detail.mount.id, sessionId: pan115Pending.sessionId, cookieApp: pan115Pending.cookieApp }
      : { mountId: detail.mount.id, cookieHeader: pan115Pending.cookieHeader };
    pan115Api.activate(payload).catch((err) => {
      // activate 失败不影响 mount 创建成功的状态；详情抽屉里可重试，
      // 所以这里不打扰用户，只在开发态留一条线索。
      logger.warn('[pan115] 自动激活失败，挂载已创建，可在详情抽屉里重试', err);
    });
  }, [createMountMutation.data, pan115Pending]);
  // 关闭抽屉时清掉本地状态
  useEffect(() => {
    if (!drawerState) {
      setPan115Pending(null);
      activateAttemptedRef.current = null;
    }
  }, [drawerState]);
  const supportsDirectoryBrowserForm = supportsDirectoryBrowser(formState.providerType);
  const isBrowsingDirectories = browseDirectoriesMutation.isPending;

  const { advancedOpen, setAdvancedOpen } = useAdvancedSectionState(drawerState, isDrawerOpen);

  const credentialProbe = useCredentialProbe({
    enabled: isDrawerOpen && (drawerState?.mode === 'create' || drawerState?.mode === 'edit'),
    providerType: formState.providerType,
    endpoint: formState.remoteConfig.endpoint,
    authMode: formState.remoteConfig.authMode,
    username: formState.remoteConfig.username,
    password: formState.remoteConfig.password,
    token: formState.remoteConfig.token,
  });

  const {
    handleProviderTypeChange,
    handleSaveMount,
    handleBrowseDirectories,
    handleRemoteAuthModeChange,
  } = useMountDrawerHandlers({
    formState,
    setFormState,
    formErrors,
    setFormErrors,
    drawerState,
    currentDetail,
    directoryBrowser,
    setDirectoryBrowser,
    setPendingAuthModeChange,
    setBanner,
    createMountMutation,
    updateMountMutation,
    browseDirectoriesMutation,
  });

  return (
    <SideDrawer
      open={isDrawerOpen}
      title={getMountDrawerTitle(drawerState, currentDetail)}
      description={getMountDrawerDescription(drawerState)}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      {drawerState?.mode === 'create' ? (
        <>
          <BasicInfoSection
            formState={formState}
            setFormState={setFormState}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            isEdit={false}
            isSaving={isSaving}
            supportsDirectoryBrowser={supportsDirectoryBrowserForm}
            onProviderTypeChange={handleProviderTypeChange}
          />
          <MountProviderFields
            formState={formState}
            setFormState={setFormState}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            isSaving={isSaving}
            mode="create"
            setDirectoryBrowser={setDirectoryBrowser}
            credentialProbeStatus={credentialProbe.status}
            credentialProbeMessage={credentialProbe.message}
            onAuthModeChange={handleRemoteAuthModeChange}
            pan115Pending={pan115Pending}
            onPan115PendingChange={setPan115Pending}
            isWebDavS3Form={isWebDavS3Form}
          />
          {supportsDirectoryBrowserForm ? (
            <MountDirectoryBrowserCard
              providerType={formState.providerType}
              value={formState.rootPath}
              browser={directoryBrowser}
              error={formErrors.browse}
              disabled={isSaving}
              isLoading={isBrowsingDirectories}
              onBrowse={handleBrowseDirectories}
              onChange={(path) => {
                setFormErrors((prev) => ({ ...prev, rootPath: undefined }));
                setFormState((prev) => ({ ...prev, rootPath: path }));
              }}
            />
          ) : null}
          <AdvancedSectionWrapper advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen}>
            <CapabilitiesSection
              formState={formState}
              setFormState={setFormState}
              isSaving={isSaving}
              description="创建时先声明当前来源稳定支持哪些能力，后面媒体库和播放链路会按这里的能力做判断。"
            />
            <PathPoliciesSection
              formState={formState}
              setFormState={setFormState}
              isSaving={isSaving}
              description="只有你需要对同一个数据源的不同目录做优先级和并发控制时，才需要这块高级配置。"
            />
            <PreservedConfigSection
              preservedConfig={formState.preservedConfig}
              title="保留的高级字段"
              description="如果当前来源还有一些没有拆成表单字段的配置，会保留在这里随本次保存一并提交。"
            />
          </AdvancedSectionWrapper>
          <div className={styles.stickyBar}>
            <div className={styles.stackText}>
              <strong>创建数据源</strong>
              <span className={styles.mutedText}>创建后即可在媒体库页绑定为多来源扫描入口。</span>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={isSaving}>取消</button>
              <button className={styles.primaryButton} type="button" onClick={handleSaveMount} disabled={isSaving}>
                {isSaving ? '创建中…' : '创建来源'}
              </button>
            </div>
          </div>
        </>
      ) : drawerState?.mode === 'edit' && mountDetailQuery.isPending && !mountDetailQuery.data ? (
        <FeedbackState variant="loading" title="正在加载来源详情" description="正在读取配置、能力声明与关联来源绑定。" />
      ) : drawerState?.mode === 'edit' && mountDetailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="来源详情加载失败"
          description={getErrorMessage(mountDetailQuery.error)}
          action={<button className={styles.primaryButton} type="button" onClick={() => mountDetailQuery.refetch()}>重试</button>}
        />
      ) : drawerState?.mode === 'edit' ? (
        <>
          <BasicInfoSection
            formState={formState}
            setFormState={setFormState}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            isEdit={true}
            isSaving={isSaving}
            supportsDirectoryBrowser={supportsDirectoryBrowserForm}
            onProviderTypeChange={handleProviderTypeChange}
          />
          <MountProviderFields
            formState={formState}
            setFormState={setFormState}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            isSaving={isSaving}
            mode="edit"
            setDirectoryBrowser={setDirectoryBrowser}
            credentialProbeStatus={credentialProbe.status}
            credentialProbeMessage={credentialProbe.message}
            onAuthModeChange={handleRemoteAuthModeChange}
            pan115Pending={pan115Pending}
            onPan115PendingChange={setPan115Pending}
            isWebDavS3Form={isWebDavS3Form}
          />
          {supportsDirectoryBrowserForm ? (
            <MountDirectoryBrowserCard
              providerType={formState.providerType}
              value={formState.rootPath}
              browser={directoryBrowser}
              error={formErrors.browse}
              disabled={isSaving}
              isLoading={isBrowsingDirectories}
              onBrowse={handleBrowseDirectories}
              onChange={(path) => {
                setFormErrors((prev) => ({ ...prev, rootPath: undefined }));
                setFormState((prev) => ({ ...prev, rootPath: path }));
              }}
            />
          ) : null}
          {/* 115 走 accounts browse（已绑定凭据），不走 mount 级 browse（凭据不在 config_json）。 */}
          {formState.providerType === 'pan115' && currentDetail ? (
            <Pan115DirectoryBrowserSection
              mountId={currentDetail.mount.id}
              value={formState.rootPath}
              disabled={isSaving}
              onChange={(path) => {
                setFormErrors((prev) => ({ ...prev, rootPath: undefined }));
                setFormState((prev) => ({ ...prev, rootPath: path }));
              }}
            />
          ) : null}
          <AdvancedSectionWrapper advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen}>
            <CapabilitiesSection
              formState={formState}
              setFormState={setFormState}
              isSaving={isSaving}
              description="这里决定系统如何理解当前来源的读取能力、旁路资源能力和播放目标生成能力。"
            />
            <PathPoliciesSection
              formState={formState}
              setFormState={setFormState}
              isSaving={isSaving}
              description="这些规则只在起播前选源时生效；不配置就继续用默认逻辑，不会打扰普通管理员。"
            />
            <PreservedConfigSection
              preservedConfig={formState.preservedConfig}
              title="保留的高级字段"
              description="这些字段不会出现在普通表单里，但会继续跟着当前来源一起保存，不需要你再跳到别的页面处理。"
            />
          </AdvancedSectionWrapper>
          {currentDetail ? (
            <MountDeletePanel
              currentDetail={currentDetail}
              isDeleting={isSaving || isDeleting}
              onDelete={() => setPendingDelete(currentDetail)}
            />
          ) : null}
          <div className={styles.stickyBar}>
            <div className={styles.stackText}>
              <strong>保存来源配置</strong>
              <span className={styles.mutedText}>提交后会同步覆盖根路径、能力声明和 config_json。</span>
            </div>
            <div className={styles.rowActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  if (!currentDetail) { onClose(); return; }
                  setFormErrors({});
                  setDirectoryBrowser(null);
                  setFormState(buildMountFormState(currentDetail));
                  setDrawerState({ mode: 'view', mountId: currentDetail.mount.id });
                }}
                disabled={isSaving}
              >
                返回详情
              </button>
              <button className={styles.primaryButton} type="button" onClick={handleSaveMount} disabled={isSaving}>
                {isSaving ? '保存中…' : '保存变更'}
              </button>
            </div>
          </div>
        </>
      ) : mountDetailQuery.isPending ? (
        <FeedbackState variant="loading" title="正在加载来源详情" description="正在读取配置、能力声明与关联来源绑定。" />
      ) : mountDetailQuery.isError ? (
        <FeedbackState
          variant="error"
          title="来源详情加载失败"
          description={getErrorMessage(mountDetailQuery.error)}
          action={<button className={styles.primaryButton} type="button" onClick={() => mountDetailQuery.refetch()}>重试</button>}
        />
      ) : currentDetail ? (
        <>
          <MountViewWarningBanners currentDetail={currentDetail} />
          <MountCredentialCard
            currentDetail={currentDetail}
            lastFaultAction={healthFaultActionById[currentDetail.mount.id] ?? null}
          />
          <MountOverviewSection
            currentDetail={currentDetail}
            validateMountMutation={validateMountMutation}
            refreshMountAccessMutation={refreshMountAccessMutation}
            setFormErrors={setFormErrors}
            setDirectoryBrowser={setDirectoryBrowser}
            setFormState={setFormState}
            setDrawerState={setDrawerState}
          />
          {currentDetail.providerType === 'pan115' ? (
            <Pan115CredentialsSection currentDetail={currentDetail} />
          ) : null}
          <MountCapabilitiesViewSection currentDetail={currentDetail} />
          <MountPathPoliciesViewSection currentDetail={currentDetail} />
          <MountReferencesSection currentDetail={currentDetail} />
          <MountConnectionConfigSection currentDetail={currentDetail} />
          <MountLinkedSourcesSection currentDetail={currentDetail} />
          <MountScanTasksSection currentDetail={currentDetail} />
          <MountDeletePanel
            currentDetail={currentDetail}
            isDeleting={isDeleting}
            onDelete={() => setPendingDelete(currentDetail)}
          />
        </>
      ) : null}
    </SideDrawer>
  );
}