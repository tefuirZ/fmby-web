import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useHoverWheelScroll } from '@/shared/hooks';

interface HoverScrollAreaProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  children: ReactNode;
  axis?: 'x' | 'y';
  delayMs?: number;
}

export function HoverScrollArea({
  children,
  axis = 'x',
  delayMs = 50,
  ...props
}: HoverScrollAreaProps) {
  const { enabled, scrolling, bindings } = useHoverWheelScroll<HTMLDivElement>({
    axis,
    delayMs,
  });

  return (
    <div
      {...props}
      {...bindings}
      data-wheel-active={enabled ? 'true' : 'false'}
      data-wheel-scrolling={scrolling ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}
