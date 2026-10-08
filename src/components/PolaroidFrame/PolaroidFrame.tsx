import type { ReactNode } from 'react';
import styles from './PolaroidFrame.module.css';

interface PolaroidFrameProps {
  children: ReactNode;
  className?: string | undefined;
}

/**
 * An empty Polaroid frame (same paper and proportions as on the wall) for
 * the composer: whatever goes inside sits in the square print area.
 */
export function PolaroidFrame({ children, className }: PolaroidFrameProps) {
  return <div className={className ? `${styles.frame} ${className}` : styles.frame}>{children}</div>;
}
