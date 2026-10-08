import type { CSSProperties } from 'react';
import type { GuestbookEntry, StickyColor } from '../../domain/guestbook';
import { splitEntryMessage } from '../../domain/messageSheets';
import { getAttachmentAnchor, getContinuationSheets, getEntryFootprint } from '../../wall/geometry';
import { hashString, pick } from '../../presentation/variation';
import { Attachment } from '../Attachment/Attachment';
import { Polaroid } from '../Polaroid/Polaroid';
import { StickyNote } from '../StickyNote/StickyNote';
import styles from './WallEntry.module.css';

interface EntryArtworkProps {
  entry: GuestbookEntry;
  /** Off while the note is still in hand — it isn't stuck to the wall yet. */
  showAttachment: boolean;
}

const CONTINUATION_COLORS: StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'orange'];

/**
 * Everything physical about an entry, drawn inside its main sheet's box:
 * the sheet, extra stickies when the note is long, and the attachment.
 */
export function EntryArtwork({ entry, showAttachment }: EntryArtworkProps) {
  const { primary, continuations } = splitEntryMessage(entry);
  const sheets = getContinuationSheets(entry);
  const main = getEntryFootprint(entry);
  // The signature goes on whichever sheet the note ends on.
  const mainSignature = sheets.length ? null : entry.name;
  const seed = hashString(entry.id);
  const continuationColor = entry.type === 'sticky' ? entry.color : pick(CONTINUATION_COLORS, seed);

  return (
    <>
      {entry.type === 'sticky' ? (
        <StickyNote
          shape={entry.shape}
          color={entry.color}
          message={primary}
          doodle={entry.doodle}
          signature={mainSignature}
        />
      ) : (
        <Polaroid media={entry.media} caption={primary} signature={mainSignature} />
      )}

      {sheets.map((sheet, i) => (
        <div
          key={i}
          className={styles.continuation}
          style={
            {
              left: main.width / 2 + sheet.offsetX - sheet.width / 2,
              top: main.height / 2 + sheet.offsetY - sheet.height / 2,
              width: sheet.width,
              height: sheet.height,
              // Each sheet tucks behind the one before it.
              zIndex: -1 - i,
              '--sheet-rotation': `${sheet.rotation}deg`,
            } as CSSProperties
          }
        >
          <StickyNote
            shape="square"
            color={continuationColor}
            message={continuations[i] ?? null}
            signature={i === sheets.length - 1 ? entry.name : null}
          />
        </div>
      ))}

      {showAttachment && (
        <Attachment type={entry.attachment} anchor={getAttachmentAnchor(entry, entry.attachment)} seed={seed} />
      )}
    </>
  );
}
