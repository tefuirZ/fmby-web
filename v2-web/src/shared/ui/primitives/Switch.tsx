import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import clsx from 'clsx';
import styles from './Switch.module.css';

type SwitchProps = ComponentPropsWithoutRef<typeof RadixSwitch.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch({ className, ...rest }, ref) {
    return (
      <RadixSwitch.Root ref={ref} className={clsx(styles.root, className)} {...rest}>
        <RadixSwitch.Thumb className={styles.thumb} />
      </RadixSwitch.Root>
    );
  },
);
