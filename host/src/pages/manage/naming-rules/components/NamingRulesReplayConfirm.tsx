import { ConfirmDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';
import type { NamingCleanupReplayScope } from '@fmby/v2-shared/contracts/manage/naming';

export function NamingRulesReplayConfirm({
  open,
  replayScope,
  selectedLibraryName,
  isPending,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  replayScope: NamingCleanupReplayScope;
  selectedLibraryName?: string;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="确认手动重排命名清洗识别"
      description={
        replayScope === 'all'
          ? '这会按当前已保存规则版本，把全部媒体库重新入队 identify。动作比较大，别在规则还没确认时乱抡。'
          : `这会按当前已保存规则版本，把 ${selectedLibraryName ?? '所选媒体库'} 重新入队 identify。`
      }
      impact={[
        replayScope === 'all'
          ? '范围：全部媒体库'
          : `范围：${selectedLibraryName ?? '所选媒体库'}`,
        '已有历史媒体会按当前规则版本重新构建 identify 指纹并入队。',
        '这个动作不会自动保存当前草稿，也不会关闭扫描新增/变更时的自动清洗。',
      ]}
      errorMessage={error ? getErrorMessage(error) : undefined}
      confirmLabel="确认重排"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      pending={isPending}
    />
  );
}
