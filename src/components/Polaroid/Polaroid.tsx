import type { PolaroidMedia } from '../../domain/guestbook';
import { Doodle } from '../Doodle/Doodle';
import styles from './Polaroid.module.css';

interface PolaroidProps {
  media: PolaroidMedia;
  caption: string | null;
  /** Author name; left off when the note continues onto a sticky. */
  signature?: string | null | undefined;
}

/**
 * A Polaroid's frame, photo/doodle and caption. Fills its parent.
 * Styling follows the Framer "Polaroid new" component, Variant 3.
 */
export function Polaroid({ media, caption, signature = null }: PolaroidProps) {
  const hasCaption = caption !== null || signature !== null;

  return (
    <div className={styles.polaroid}>
      <div className={styles.photo} data-kind={media.kind}>
        {media.kind === 'photo' ? (
          <>
            <img
              className={styles.image}
              src={media.imageUrl}
              alt=""
              data-filter={media.filter}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
            <span className={styles.grain} aria-hidden="true" />
          </>
        ) : (
          <Doodle className={styles.doodle} doodle={media.doodle} />
        )}
        <span className={styles.innerShadow} aria-hidden="true" />
      </div>
      {hasCaption && (
        <p className={styles.caption}>
          {caption}
          {caption && signature && ' '}
          {signature && <span className={styles.signature}>— {signature}</span>}
        </p>
      )}
    </div>
  );
}
