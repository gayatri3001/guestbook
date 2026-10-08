import type { ButtonHTMLAttributes } from 'react';
import styles from './TabCell.module.css';

interface TabCellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/**
 * A compact tab: dark label with a golden dot when selected, lighter label
 * and no dot otherwise. Use inside a `role="tablist"`.
 */
export function TabCell({ selected, children, className, ...rest }: TabCellProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={className ? `${styles.tab} ${className}` : styles.tab}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
      {selected && <span className={styles.dot} aria-hidden="true" />}
    </button>
  );
}
