import styles from './Admin.module.css';

interface AdminBarProps {
  hiddenCount: number;
  message: string | null;
  onSignOut: () => void;
}

/** Shown across the top of the wall in admin mode. */
export function AdminBar({ hiddenCount, message, onSignOut }: AdminBarProps) {
  return (
    <div className={styles.bar} role="region" aria-label="Admin">
      <span className={styles.badge}>Admin mode</span>
      <span className={styles.barText} role="status" aria-live="polite">
        {message ?? `${hiddenCount} hidden · hover a note to move or hide it`}
      </span>
      <a className={styles.barLink} href="/">
        Public view
      </a>
      <button type="button" className={styles.barLink} onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
