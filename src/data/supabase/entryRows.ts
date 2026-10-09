import type {
  AttachmentType,
  DoodleData,
  GuestbookEntry,
  PhotoFilter,
  StickyColor,
  StickyShape,
} from '../../domain/guestbook';

/**
 * The `entries` table, as rows come back from Supabase
 * (see supabase/migrations). Kept separate from the domain model so the
 * database's naming and shape never leak into the UI.
 */
export interface EntryRow {
  id: string;
  type: 'sticky' | 'polaroid';
  shape: StickyShape | null;
  color: StickyColor | null;
  media_kind: 'photo' | 'doodle' | null;
  image_path: string | null;
  photo_filter: PhotoFilter;
  doodle: DoodleData | null;
  message: string | null;
  name: string | null;
  x: number;
  y: number;
  rotation: number;
  z_index: number;
  attachment: AttachmentType;
  owner_id: string | null;
  hidden: boolean;
  created_at: string;
}

/** The columns a visitor is allowed to send; the server fills in the rest. */
export type EntryInsert = Pick<
  EntryRow,
  | 'id'
  | 'type'
  | 'shape'
  | 'color'
  | 'media_kind'
  | 'image_path'
  | 'photo_filter'
  | 'doodle'
  | 'message'
  | 'name'
  | 'x'
  | 'y'
  | 'rotation'
  | 'attachment'
>;

export const ENTRY_COLUMNS =
  'id, type, shape, color, media_kind, image_path, photo_filter, doodle, message, name, x, y, rotation, z_index, attachment, owner_id, hidden, created_at';

export function rowToEntry(row: EntryRow, photoUrl: (path: string) => string): GuestbookEntry {
  const base = {
    id: row.id,
    name: row.name,
    message: row.message,
    placement: { x: row.x, y: row.y, rotation: row.rotation, zIndex: row.z_index },
    attachment: row.attachment,
    createdAt: row.created_at,
    ownerId: row.owner_id,
    hidden: row.hidden,
  };

  if (row.type === 'sticky') {
    return { ...base, type: 'sticky', shape: row.shape ?? 'square', color: row.color ?? 'yellow', doodle: row.doodle };
  }

  return {
    ...base,
    type: 'polaroid',
    media:
      row.media_kind === 'photo' && row.image_path
        ? { kind: 'photo', imageUrl: photoUrl(row.image_path), filter: row.photo_filter }
        : { kind: 'doodle', doodle: row.doodle ?? { version: 1, strokes: [] } },
  };
}

export function entryToInsert(entry: GuestbookEntry, imagePath: string | null): EntryInsert {
  const { x, y, rotation } = entry.placement;
  const common = {
    id: entry.id,
    message: entry.message,
    name: entry.name,
    x,
    y,
    rotation,
    attachment: entry.attachment,
  };

  if (entry.type === 'sticky') {
    return {
      ...common,
      type: 'sticky',
      shape: entry.shape,
      color: entry.color,
      media_kind: null,
      image_path: null,
      photo_filter: 'none',
      doodle: entry.doodle,
    };
  }

  const { media } = entry;
  return {
    ...common,
    type: 'polaroid',
    shape: null,
    color: null,
    media_kind: media.kind,
    image_path: media.kind === 'photo' ? imagePath : null,
    photo_filter: media.kind === 'photo' ? media.filter : 'none',
    doodle: media.kind === 'doodle' ? media.doodle : null,
  };
}
