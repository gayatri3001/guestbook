import { hashString } from '../lib/hash';
import {
  hasDoodleContent,
  type AttachmentType,
  type DoodleData,
  type EntryId,
  type GuestbookEntry,
  type StickyColor,
  type StickyShape,
  type UserId,
  type WallPlacement,
} from './guestbook';
import { checkMessage, MAX_MESSAGE_WORDS } from './messageSheets';

/**
 * What the visitor is putting together in the composer, before it becomes
 * an entry. Lives only in the browser until the entry is placed.
 */

export type DraftSurface = { type: 'sticky'; shape: StickyShape } | { type: 'polaroid' };
export type PolaroidMediaChoice = 'doodle' | 'photo';

export interface DraftPhoto {
  /** Local object URL for previews; the real URL comes from the upload. */
  previewUrl: string;
  blob: Blob;
}

export interface EntryDraft {
  surface: DraftSurface;
  /** Paper colour for stickies; picked for the visitor, not chosen. */
  color: StickyColor;
  doodle: DoodleData;
  /** For Polaroids: whichever tab is active is what gets used. */
  polaroidMedia: PolaroidMediaChoice;
  photo: DraftPhoto | null;
  message: string;
  name: string;
}

export const MAX_NAME_LENGTH = 40;

const STICKY_COLORS: StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'orange'];
const ATTACHMENTS: AttachmentType[] = ['washi-tape', 'pin', 'double-sided-tape'];

export function createEmptyDraft(): EntryDraft {
  return {
    surface: { type: 'sticky', shape: 'square' },
    color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]!,
    doodle: { version: 1, strokes: [] },
    polaroidMedia: 'photo',
    photo: null,
    message: '',
    name: '',
  };
}

export type DraftField = 'content' | 'message' | 'name';
export type DraftErrors = Partial<Record<DraftField, string>>;

/**
 * Stickies need writing or a doodle (at least one). Polaroids need a photo
 * or a doodle, whichever tab is active; their caption is optional. The
 * name is optional for both.
 */
export function validateDraft(draft: EntryDraft): DraftErrors {
  const errors: DraftErrors = {};
  const hasMessage = draft.message.trim().length > 0;
  const hasDoodle = hasDoodleContent(draft.doodle);

  if (draft.surface.type === 'sticky') {
    if (!hasMessage && !hasDoodle) errors.content = 'Write a note or draw a doodle — at least one.';
  } else if (draft.polaroidMedia === 'photo' && !draft.photo) {
    errors.content = 'Add a photo, or switch to the Doodle tab.';
  } else if (draft.polaroidMedia === 'doodle' && !hasDoodle) {
    errors.content = 'Draw a doodle, or switch to the Photo tab.';
  }

  const problem = hasMessage ? checkMessage(draft.message) : null;
  if (problem === 'too-many-words') errors.message = `Keep it to ${MAX_MESSAGE_WORDS} words or fewer.`;
  if (problem === 'too-long') errors.message = 'That’s a bit long — try trimming it a little.';

  // Name is optional; anonymous notes are signed by nobody.
  if (draft.name.trim().length > MAX_NAME_LENGTH) errors.name = `Keep your name under ${MAX_NAME_LENGTH} characters.`;

  return errors;
}

/** Attachment is assigned by the system, deterministically from the id. */
export function assignAttachment(id: EntryId): AttachmentType {
  return ATTACHMENTS[hashString(`attachment:${id}`) % ATTACHMENTS.length]!;
}

/** A natural tilt between 2° and 6°, either way. */
export function assignRotation(id: EntryId): number {
  const h = hashString(`rotation:${id}`);
  const magnitude = 2 + (h % 40) / 10;
  return Math.round((h & 1 ? magnitude : -magnitude) * 10) / 10;
}

interface EntryMeta {
  id: EntryId;
  createdAt: string;
  ownerId: UserId | null;
  placement: WallPlacement;
}

/** Turn a valid draft into an entry. Photo URLs are the local preview until uploaded. */
export function createEntryFromDraft(draft: EntryDraft, meta: EntryMeta): GuestbookEntry {
  const base = {
    ...meta,
    name: draft.name.trim() || null,
    message: draft.message.trim() || null,
    attachment: assignAttachment(meta.id),
    hidden: false,
  };

  if (draft.surface.type === 'sticky') {
    return {
      ...base,
      type: 'sticky',
      shape: draft.surface.shape,
      color: draft.color,
      doodle: hasDoodleContent(draft.doodle) ? draft.doodle : null,
    };
  }

  return {
    ...base,
    type: 'polaroid',
    media:
      draft.polaroidMedia === 'photo' && draft.photo
        ? { kind: 'photo', imageUrl: draft.photo.previewUrl, filter: 'none' }
        : { kind: 'doodle', doodle: draft.doodle },
  };
}
