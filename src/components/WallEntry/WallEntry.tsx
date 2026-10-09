import { memo, useEffect, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { describeEntry, type EntryId, type GuestbookEntry } from '../../domain/guestbook';
import { getEntryBounds } from '../../wall/geometry';
import { EntryArtwork } from './EntryArtwork';
import styles from './WallEntry.module.css';

interface WallEntryProps {
  entry: GuestbookEntry;
  isSelected: boolean;
  onToggle: (id: EntryId) => void;
  /** Position in reading order; staggers the entrance animation. */
  enterIndex: number;
  /** Move keyboard focus here on mount (the visitor's freshly placed note). */
  focusOnMount?: boolean | undefined;
  /** Admin mode: controls to move the note and hide/show it. */
  admin?: AdminEntryActions | null | undefined;
}

export interface AdminEntryActions {
  onMove: (id: EntryId) => void;
  onToggleHidden: (id: EntryId) => void;
  /** Id of a note whose hide/show is being saved. */
  busyId: EntryId | null;
}

/**
 * Places one entry on the wall (in wall units) and owns its interaction
 * feedback. The paper components inside know nothing about position.
 */
export const WallEntry = memo(function WallEntry({
  entry,
  isSelected,
  onToggle,
  enterIndex,
  focusOnMount = false,
  admin = null,
}: WallEntryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const bounds = getEntryBounds(entry);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const { rotation, zIndex } = entry.placement;

  const slotStyle = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--z': zIndex,
    '--rotation': `${rotation}deg`,
    // On hover, ease slightly toward straight — like nudging the paper.
    '--hover-nudge': `${-Math.sign(rotation) * Math.min(1.5, Math.abs(rotation) * 0.3)}deg`,
    '--enter-delay': `${Math.min(enterIndex, 20) * 35}ms`,
  } as CSSProperties;

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    onToggle(entry.id);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle(entry.id);
    }
  };

  return (
    <li
      className={styles.slot}
      style={slotStyle}
      data-selected={isSelected || undefined}
      data-type={entry.type}
      data-attachment={entry.attachment}
      data-hidden={entry.hidden || undefined}
    >
      <div
        ref={ref}
        className={styles.entry}
        role="button"
        tabIndex={0}
        aria-label={entry.hidden ? `Hidden: ${describeEntry(entry)}` : describeEntry(entry)}
        aria-pressed={isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.body}>
          <EntryArtwork entry={entry} showAttachment />
        </div>
        {entry.hidden && <span className={styles.hiddenBadge}>Hidden</span>}
      </div>

      {admin && (
        <div className={styles.adminControls}>
          <button type="button" className={styles.adminButton} onClick={() => admin.onMove(entry.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
            </svg>
            Move
          </button>
          <button
            type="button"
            className={styles.adminButton}
            disabled={admin.busyId === entry.id}
            onClick={() => admin.onToggleHidden(entry.id)}
          >
            {entry.hidden ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            )}
            {entry.hidden ? 'Show' : 'Hide'}
          </button>
        </div>
      )}
    </li>
  );
});
