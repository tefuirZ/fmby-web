import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { manageApi, type DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
import { SensitiveActionDialog } from '@fmby/v2-shared/ui';
import { getErrorMessage } from '@fmby/v2-shared/errors';

interface ResetIpLoginRiskPanelProps {
  wrapperClassName: string;
  fieldClassName: string;
  inputClassName: string;
  hintClassName: string;
  buttonClassName: string;
  onSuccess: (message: string) => void;
}

export function ResetIpLoginRiskPanel({
  wrapperClassName,
  fieldClassName,
  inputClassName,
  hintClassName,
  buttonClassName,
  onSuccess,
}: ResetIpLoginRiskPanelProps) {
  const [ipAddress, setIpAddress] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const targetIp = ipAddress.trim();

  const resetMutation = useMutation({
    mutationFn: (confirmation: DangerousActionRequest) =>
      manageApi.resetIpLoginRisk({
        ipAddress: targetIp,
        ...confirmation,
      }),
    onSuccess: (result) => {
      setDialogOpen(false);
      setIpAddress('');
      onSuccess(result.message || `IP ${result.id} 登录风控已解除。`);
    },
  });

  return (
    <>
      <div className={wrapperClassName}>
        <label className={fieldClassName}>
          来源 IP
          <input
            className={inputClassName}
            type="text"
            value={ipAddress}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="192.168.1.10 / 2001:db8::1"
            onChange={(event) => {
              setIpAddress(event.target.value);
              resetMutation.reset();
            }}
          />
          <span className={hintClassName}>
            只解除该 IP 当前失败登录窗口内的限流影响，失败与解除审计都会保留。
          </span>
        </label>
        <button
          className={buttonClassName}
          type="button"
          disabled={!targetIp || resetMutation.isPending}
          onClick={() => setDialogOpen(true)}
        >
          解除 IP 风控
        </button>
      </div>

      <SensitiveActionDialog
        open={dialogOpen}
        actionKey="reset-ip-login-risk"
        title="解除 IP 登录风控"
        description={`即将解除 ${targetIp || '该来源 IP'} 当前窗口内的登录限流影响。`}
        impact={[
          '只影响该来源 IP 的登录限流计数。',
          '不删除失败登录、限流命中或解除操作审计。',
          '不影响任何账号的失败登录锁定。',
        ]}
        confirmLabel="解除 IP 风控"
        pending={resetMutation.isPending}
        errorMessage={
          resetMutation.isError ? getErrorMessage(resetMutation.error) : undefined
        }
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetMutation.reset();
          }
        }}
        onConfirm={(confirmation) => resetMutation.mutate(confirmation)}
      />
    </>
  );
}
