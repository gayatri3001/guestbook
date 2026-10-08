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
    >
      <div
        ref={ref}
        className={styles.entry}
        role="button"
        tabIndex={0}
        aria-label={describeEntry(entry)}
        aria-pressed={isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.body}>
          <EntryArtwork entry={entry} showAttachment />
        </div>
      </div>
    </li>
  );
});
