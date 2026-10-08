import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { GuestbookEntry, WallPlacement } from '../../domain/guestbook';
import { getEntryBounds } from '../../wall/geometry';
import { moveWithinWall } from '../../wall/placement';
import { EntryArtwork } from '../WallEntry/EntryArtwork';
import styles from './PendingEntry.module.css';

interface PendingEntryProps {
  /** The entry with its real wall placement (keyboard moves work on this). */
  entry: GuestbookEntry;
  /** The same entry positioned where it's drawn on this screen's layout. */
  display: GuestbookEntry;
  holding: boolean;
  saving: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onMove: (placement: WallPlacement) => void;
  onPlace: () => void;
}

const KEY_STEP = 12;
const KEY_STEP_LARGE = 60;

/**
 * The visitor's new note while it's in hand: lifted off the wall, not yet
 * attached. Keyboard users move it with the arrow keys and press Enter.
 */
export function PendingEntry({ entry, display, holding, saving, onPointerDown, onMove, onPlace }: PendingEntryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const bounds = getEntryBounds(display);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (saving) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const { x, y } = entry.placement;
      onMove(moveWithinWall(entry, { x: x + move[0], y: y + move[1] }));
      ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPlace();
    }
  };

  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--rotation': `${entry.placement.rotation}deg`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={styles.pending}
      style={style}
      data-type={entry.type}
      data-holding={holding || undefined}
      data-saving={saving || undefined}
      role="application"
      tabIndex={0}
      aria-roledescription="draggable note"
      aria-label="Your note. Use the arrow keys to move it, Enter to stick it to the wall, or Escape to go back and edit."
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.body}>
        <EntryArtwork entry={display} showAttachment={saving} />
      </div>
    </div>
  );
}
