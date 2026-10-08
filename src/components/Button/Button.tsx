import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Framer "Button New 2" variants: "Fill landing" (default) or "Line landing". */
  variant?: 'fill' | 'line';
}

/**
 * Pill button matching the Framer "Button New 2" component: an accent dot
 * that grows into an arrow on hover.
 */
export function Button({ children, className, variant = 'fill', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `${styles.button} ${className}` : styles.button}
      data-variant={variant}
      {...rest}
    >
      <span className={styles.dotSlot} aria-hidden="true">
        <span className={styles.dot}>
          <svg className={styles.arrow} viewBox="0 0 16 16">
            <path d="M9 3.333 13.667 8 9 12.667M2.333 8h11" />
          </svg>
        </span>
      </span>
      <span className={styles.label}>{children}</span>
    </button>
  );
}
