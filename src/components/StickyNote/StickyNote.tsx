import { useId, type CSSProperties } from 'react';
import type { DoodleData, StickyColor, StickyShape } from '../../domain/guestbook';
import { Doodle } from '../Doodle/Doodle';
import { STICKY_SHAPES } from './stickyShapes';
import styles from './StickyNote.module.css';

interface StickyNoteProps {
  shape: StickyShape;
  color: StickyColor;
  message: string | null;
  doodle?: DoodleData | null | undefined;
  /** Author name, written at the bottom of the (last) sheet. */
  signature?: string | null | undefined;
}

/** One sticky note sheet and its contents. Fills its parent; sizing/placement is the caller's job. */
export function StickyNote({ shape: shapeName, color, message, doodle = null, signature = null }: StickyNoteProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `sticky-shape-${uid}`;
  const gradientId = `sticky-sheen-${uid}`;
  const shape = STICKY_SHAPES[shapeName];
  const { top, right, bottom, left } = shape.content;
  const hasDoodle = doodle !== null;

  const contentStyle = {
    inset: `${top}% ${right}% ${bottom}% ${left}%`,
    '--message-size': `${messageSize(message, hasDoodle, shapeName)}px`,
  } as CSSProperties;

  return (
    <div className={styles.note} data-shape={shapeName}>
      <svg className={styles.paper} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {/* The silhouette is a union of parts; clipping avoids double-shading where they overlap. */}
          <clipPath id={clipId}>
            {shape.parts.map((part, i) => (
              <path key={i} d={part.d} transform={part.transform} />
            ))}
          </clipPath>
          {/* Faint sheen at the adhesive edge, slight shade where the paper lifts. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.07" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width="100" height="100" style={{ fill: `var(--paper-${color})` }} />
          <rect width="100" height="100" fill={`url(#${gradientId})`} />
        </g>
      </svg>

      {/* The doodle covers the whole sheet, exactly as drawn on the composer's shaped pad. */}
      {doodle && <Doodle className={styles.doodle} doodle={doodle} clipShape={shapeName} />}

      <div className={styles.content} style={contentStyle} data-with-doodle={hasDoodle || undefined}>
        {message && (
          <p className={styles.message} data-with-doodle={hasDoodle || undefined}>
            {message}
          </p>
        )}
        {signature && <span className={styles.signature}>— {signature}</span>}
      </div>
    </div>
  );
}

/**
 * Shorter notes get bigger handwriting, like they would on paper. The
 * smallest steps must fit the capacities in `domain/messageSheets.ts`
 * (sizes are before `--hand-scale` is applied).
 */
function messageSize(message: string | null, hasDoodle: boolean, shape: StickyShape): number {
  const length = message?.length ?? 0;
  const base = hasDoodle
    ? length <= 20 ? 22 : 18
    : length <= 20 ? 29 : length <= 45 ? 24 : length <= 80 ? 19 : length <= 115 ? 15.5 : length <= 140 ? 14.5 : 13.5;
  return shape === 'square' ? base : Math.round(base * 0.7 * 10) / 10;
}
