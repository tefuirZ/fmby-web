import type { ComponentPropsWithoutRef, ReactNode } from 'react';
interface HoverScrollAreaProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
    children: ReactNode;
    axis?: 'x' | 'y';
    delayMs?: number;
}
export declare function HoverScrollArea({ children, axis, delayMs, ...props }: HoverScrollAreaProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=HoverScrollArea.d.ts.map