import { useSyncExternalStore } from 'react';
import { PLACEMENT_IGNORE_ATTR } from '../../interaction/usePlacementDrag';
import { Button } from '../Button/Button';
import styles from './PlacementBanner.module.css';

interface PlacementBannerProps {
  /** Placing a new note, or the admin moving an existing one. */
  purpose: 'new' | 'move';
  /** The note is somewhere it can't stay; releasing will snap it to the nearest free spot. */
  willSnap: boolean;
  saving: boolean;
  error: string | null;
  onBack: () => void;
}

const TOUCH_QUERY = '(hover: none)';

function useIsTouch() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(TOUCH_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => matchMedia(TOUCH_QUERY).matches,
  );
}

/**
 * Toast at the bottom of the screen while the visitor's note is in hand:
 * where to put it, plus the way back to editing (Escape works too).
 */
export function PlacementBanner({ purpose, willSnap, saving, error, onBack }: PlacementBannerProps) {
  const isTouch = useIsTouch();

  let message: string;
  if (purpose === 'move') {
    if (saving) message = 'Moving it…';
    else if (error) message = error;
    else if (isTouch) message = 'Drag the note to its new spot, then let go.';
    else message = 'Move the note to its new spot, then click to drop it.';
  } else if (saving) message = 'Sticking it to the wall…';
  else if (error) message = error;
  else if (willSnap) message = 'Your note will shift to the nearest free spot.';
  else if (isTouch) message = 'Drag your note to a spot you like, then let go to stick it.';
  else message = 'Move your note to a spot you like, then click to stick it.';

  return (
    <div className={styles.banner} {...{ [PLACEMENT_IGNORE_ATTR]: '' }} data-tone={error ? 'warn' : undefined}>
      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>
      {!saving && (
        <Button variant="line" onClick={onBack}>
          {purpose === 'move' ? 'Cancel' : 'Back to edit'}
        </Button>
      )}
    </div>
  );
}
