import { type ReactNode } from 'react';
import type { DangerousActionRequest } from '@fmby/v2-shared/contracts/manage';
interface SensitiveActionDialogProps {
    open: boolean;
    actionKey: string;
    title: string;
    description: string;
    impact?: string | string[];
    errorMessage?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    extraConfirmDisabled?: boolean;
    children?: ReactNode;
    pending?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (payload: DangerousActionRequest) => void;
}
export declare function SensitiveActionDialog({ open, actionKey, title, description, impact, errorMessage, confirmLabel, cancelLabel, extraConfirmDisabled, children, pending, onOpenChange, onConfirm, }: SensitiveActionDialogProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=SensitiveActionDialog.d.ts.map