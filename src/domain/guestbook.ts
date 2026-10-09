/**
 * Guestbook domain model.
 *
 * Everything in this file describes *persisted* data — what a Supabase row
 * will eventually hold. Temporary UI state (hover, selection, drag previews,
 * viewport scale) must never be added here; it lives in `src/interaction`
 * and `src/wall`.
 */

export type EntryId = string;
export type UserId = string;

export type EntryType = 'sticky' | 'polaroid';
export type StickyShape = 'square' | 'apple' | 'clover';
export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';
export type AttachmentType = 'washi-tape' | 'pin' | 'double-sided-tape';
export type PhotoFilter = 'none' | 'warm' | 'mono' | 'faded';

/**
 * Doodle strokes are stored in a resolution-independent square canvas of
 * DOODLE_CANVAS_SIZE units, so the same data renders on a sticky note or a
 * Polaroid at any size. Serialises cleanly to a jsonb column.
 */
export const DOODLE_CANVAS_SIZE = 100;

export type DoodleTool = 'pen' | 'highlighter' | 'crayon' | 'eraser';

export interface DoodleStroke {
  tool: DoodleTool;
  /** CSS colour; ignored for the eraser. */
  color: string;
  /** Stroke width in doodle-canvas units. */
  width: number;
  /** Flat [x0, y0, x1, y1, …] list in doodle-canvas units. */
  points: number[];
}

export interface DoodleData {
  version: 1;
  /** In drawing order; eraser strokes erase whatever was drawn before them. */
  strokes: DoodleStroke[];
}

export const EMPTY_DOODLE: DoodleData = { version: 1, strokes: [] };

/** True when the doodle has at least one visible (non-eraser) mark. */
export function hasDoodleContent(doodle: DoodleData | null): doodle is DoodleData {
  return doodle !== null && doodle.strokes.some((stroke) => stroke.tool !== 'eraser');
}

/**
 * Where an entry sits on the wall, in wall units (see `src/wall/coordinates.ts`).
 * (x, y) is the entry's *centre*, so rotation and future cursor-anchored
 * dragging both pivot around the same point.
 */
export interface WallPlacement {
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Stacking order; higher sits on top. */
  zIndex: number;
}

interface BaseEntry {
  id: EntryId;
  /** Display name of the author; null when anonymous. */
  name: string | null;
  /**
   * Handwritten text, stored whole. How it's split across sheets (a long
   * note continues onto a second sticky) is derived when rendering — see
   * `messageSheets.ts` — so that rule can change without migrating data.
   */
  message: string | null;
  placement: WallPlacement;
  /** Assigned automatically by the system, never chosen by the visitor. */
  attachment: AttachmentType;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Owning user; null for legacy / anonymous entries. Compared against the viewer to derive `isOwn`. */
  ownerId: UserId | null;
  /** Taken down by the admin. Only the admin ever receives hidden entries. */
  hidden: boolean;
}

export interface StickyNoteEntry extends BaseEntry {
  type: 'sticky';
  shape: StickyShape;
  color: StickyColor;
  doodle: DoodleData | null;
}

export type PolaroidMedia =
  | { kind: 'photo'; imageUrl: string; filter: PhotoFilter }
  | { kind: 'doodle'; doodle: DoodleData };

export interface PolaroidEntry extends BaseEntry {
  type: 'polaroid';
  media: PolaroidMedia;
}

export type GuestbookEntry = StickyNoteEntry | PolaroidEntry;

/** Ownership is derived per viewer rather than persisted as a boolean. */
export function isOwnEntry(entry: GuestbookEntry, viewerId: UserId | null): boolean {
  return viewerId !== null && entry.ownerId === viewerId;
}

/** Human-readable summary used for accessible labels. */
export function describeEntry(entry: GuestbookEntry): string {
  const author = entry.name ? `from ${entry.name}` : 'from an anonymous guest';
  const kind =
    entry.type === 'sticky'
      ? `${entry.shape === 'square' ? '' : `${entry.shape}-shaped `}sticky note`
      : 'Polaroid';
  const contents: string[] = [];
  if (entry.type === 'polaroid') {
    contents.push(entry.media.kind === 'photo' ? 'a photo' : 'a doodle');
  } else if (entry.doodle) {
    contents.push('a doodle');
  }
  const body = entry.message ? `: “${entry.message}”` : '';
  const withContents = contents.length ? ` with ${contents.join(' and ')}` : '';
  return `${kind[0]!.toUpperCase()}${kind.slice(1)} ${author}${withContents}${body}`;
}
