import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import clsx from 'clsx';
import styles from './Checkbox.module.css';

type CheckboxProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Root>;

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox({ className, checked, ...rest }, ref) {
    return (
      <RadixCheckbox.Root
        ref={ref}
        checked={checked}
        className={clsx(styles.root, className)}
        {...rest}
      >
        <RadixCheckbox.Indicator className={styles.indicator}>
          {checked === 'indeterminate' ? (
            <Minus size={13} aria-hidden="true" />
          ) : (
            <Check size={13} aria-hidden="true" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
    );
  },
);
