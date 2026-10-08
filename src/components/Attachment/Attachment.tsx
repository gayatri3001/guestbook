import type { CSSProperties } from 'react';
import type { AttachmentType } from '../../domain/guestbook';
import type { AttachmentAnchor } from '../../wall/geometry';
import { pick, signedUnit } from '../../presentation/variation';
import styles from './Attachment.module.css';

interface AttachmentProps {
  type: AttachmentType;
  anchor: AttachmentAnchor;
  /** Stable per-entry seed so tape pattern and angle never change between renders. */
  seed: number;
}

const WASHI_COLORS = ['--washi-1', '--washi-2', '--washi-3', '--washi-4'] as const;
const WASHI_PATTERNS = ['stripes', 'dots', 'grid', 'plain'] as const;

/**
 * How an entry is fixed to the wall. Positioned within the entry's own
 * (already rotated) box, so it moves and rotates with the entry.
 */
export function Attachment({ type, anchor, seed }: AttachmentProps) {
  const position = { left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` };

  switch (type) {
    case 'washi-tape':
      return (
        <span
          className={styles.washi}
          data-pattern={pick(WASHI_PATTERNS, seed, 1)}
          aria-hidden="true"
          style={
            {
              ...position,
              '--tape-color': `var(${pick(WASHI_COLORS, seed)})`,
              '--tape-angle': `${signedUnit(seed, 2) * 7}deg`,
              '--tape-shift': `${signedUnit(seed, 3) * 11}px`,
            } as CSSProperties
          }
        />
      );
    case 'pin':
      return <span className={styles.pin} aria-hidden="true" style={position} />;
    case 'double-sided-tape':
      return (
        <span
          className={styles.doubleSided}
          aria-hidden="true"
          style={
            {
              ...position,
              '--tape-angle': `${signedUnit(seed, 4) * 4}deg`,
              '--tape-shift': `${signedUnit(seed, 5) * 24}px`,
            } as CSSProperties
          }
        />
      );
  }
}
