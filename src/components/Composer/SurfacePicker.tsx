import { useId, type CSSProperties } from 'react';
import type { DraftSurface } from '../../domain/draft';
import type { StickyShape } from '../../domain/guestbook';
import { STICKY_SHAPES } from '../StickyNote/stickyShapes';
import styles from './Composer.module.css';

interface SurfacePickerProps {
  value: DraftSurface;
  onChange: (surface: DraftSurface) => void;
}

const SHAPES: { shape: StickyShape; label: string; size: number }[] = [
  { shape: 'square', label: 'Square sticky note', size: 40 },
  { shape: 'apple', label: 'Apple-shaped sticky note', size: 46 },
  { shape: 'clover', label: 'Clover-shaped sticky note', size: 46 },
];

/**
 * Pick a sticky shape (to write or doodle) or a Polaroid (photo or doodle,
 * plus a caption). Bare shapes: the chosen one is bigger, darker and tilted;
 * the rest fade back. Hovering tilts an option.
 */
export function SurfacePicker({ value, onChange }: SurfacePickerProps) {
  const tooltipId = useId();
  const isSticky = (shape: StickyShape) => value.type === 'sticky' && value.shape === shape;

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>Choose your surface</legend>
      <div className={styles.surfaces}>
        <div className={styles.surfaceGroup}>
          {SHAPES.map(({ shape, label, size }) => (
            <label key={shape} className={styles.surfaceOption}>
              <input
                type="radio"
                name="surface"
                className={styles.radio}
                checked={isSticky(shape)}
                onChange={() => onChange({ type: 'sticky', shape })}
              />
              <span className={styles.surfaceArt}>
                <svg
                  viewBox="0 0 100 100"
                  width={size}
                  height={size}
                  aria-hidden="true"
                  style={{ fill: isSticky(shape) ? 'var(--surface-icon-selected)' : 'var(--surface-icon)' } as CSSProperties}
                >
                  {STICKY_SHAPES[shape].parts.map((part, i) => (
                    <path key={i} d={part.d} transform={part.transform} />
                  ))}
                </svg>
              </span>
              <span className={styles.visuallyHidden}>{label}</span>
            </label>
          ))}
        </div>

        <span className={styles.surfaceDivider} aria-hidden="true" />

        <label className={styles.surfaceOption}>
          <input
            type="radio"
            name="surface"
            className={styles.radio}
            checked={value.type === 'polaroid'}
            aria-describedby={tooltipId}
            onChange={() => onChange({ type: 'polaroid' })}
          />
          <span className={styles.surfaceArt}>
            <span className={styles.miniPolaroid} />
          </span>
          <span className={styles.visuallyHidden}>Polaroid</span>
          <span id={tooltipId} role="tooltip" className={styles.tooltip}>
            Choose a polaroid if you want to add a photo or a doodle
          </span>
        </label>
      </div>
    </fieldset>
  );
}
