import type { AttachmentType, GuestbookEntry, StickyShape } from '../domain/guestbook';
import { splitEntryMessage } from '../domain/messageSheets';
import { hashString } from '../lib/hash';
import type { WallSize } from './coordinates';

/**
 * Physical footprint of each kind of entry, in wall units.
 *
 * Size is derived from type/shape rather than persisted: it keeps rows small
 * and means placement/collision logic and the renderer always agree.
 */
const STICKY_SIZES: Record<StickyShape, WallSize> = {
  square: { width: 147, height: 147 },
  apple: { width: 163, height: 163 },
  clover: { width: 171, height: 171 },
};

/**
 * Proportions follow the Framer "Polaroid new" Variant 3 card (140 wide:
 * 8 padding, 124 square photo, 8 gap, caption, 8 padding), scaled up to
 * this footprint, with room for a two-line caption.
 */
const POLAROID_SIZE: WallSize = { width: 179, height: 226 };

export function getEntryFootprint(entry: GuestbookEntry): WallSize {
  return entry.type === 'polaroid' ? POLAROID_SIZE : STICKY_SIZES[entry.shape];
}

export interface WallRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Axis-aligned (unrotated) bounds of an entry's main sheet, in wall units. */
export function getEntryBounds(entry: GuestbookEntry): WallRect {
  const { width, height } = getEntryFootprint(entry);
  const { x, y } = entry.placement;
  return { left: x - width / 2, top: y - height / 2, width, height };
}

/**
 * The extra square stickies a long note continues onto, relative to the
 * main sheet's centre (before the entry's own rotation). They hang below
 * in a loose chain, each tucked just behind the bottom edge of the one
 * above (so no writing is covered), nudged sideways 1–2% and tilted a bit.
 */
export interface ContinuationSheet {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotation: number;
}

const CONTINUATION_OVERLAP = 12;

export function getContinuationSheets(entry: GuestbookEntry): ContinuationSheet[] {
  const count = splitEntryMessage(entry).continuations.length;
  if (count === 0) return [];
  const main = getEntryFootprint(entry);
  const { width, height } = STICKY_SIZES.square;
  const seed = hashString(`continuation:${entry.id}`);
  const lean = entry.placement.rotation > 0 ? -1 : 1;

  return Array.from({ length: count }, (_, i) => {
    const tilt = 2 + ((seed >> (i * 4)) % 20) / 10; // 2–4°
    const nudge = 0.01 + ((seed >> (i * 3 + 1)) % 11) / 1000; // 1–2% of the width
    const side = i % 2 === 0 ? lean : -lean;
    return {
      offsetX: side * main.width * nudge,
      offsetY: main.height / 2 + height / 2 - CONTINUATION_OVERLAP + i * (height - CONTINUATION_OVERLAP),
      width,
      height,
      rotation: side * tilt,
    };
  });
}

/**
 * Everything the entry covers (main sheet plus any continuations), as an
 * axis-aligned box. Rotation is ignored: it's small enough not to matter
 * for keeping entries on the wall and off the intro.
 */
export function getEntryExtent(entry: GuestbookEntry): WallRect {
  const main = getEntryBounds(entry);
  const { x, y } = entry.placement;
  let left = main.left;
  let right = main.left + main.width;
  let top = main.top;
  let bottom = main.top + main.height;
  for (const sheet of getContinuationSheets(entry)) {
    left = Math.min(left, x + sheet.offsetX - sheet.width / 2);
    right = Math.max(right, x + sheet.offsetX + sheet.width / 2);
    top = Math.min(top, y + sheet.offsetY - sheet.height / 2);
    bottom = Math.max(bottom, y + sheet.offsetY + sheet.height / 2);
  }
  return { left, top, width: right - left, height: bottom - top };
}

/** Every sheet an entry is made of (main + continuations), as axis-aligned rects. */
export function getEntryRects(entry: GuestbookEntry): WallRect[] {
  const { x, y } = entry.placement;
  return [
    getEntryBounds(entry),
    ...getContinuationSheets(entry).map((sheet) => ({
      left: x + sheet.offsetX - sheet.width / 2,
      top: y + sheet.offsetY - sheet.height / 2,
      width: sheet.width,
      height: sheet.height,
    })),
  ];
}

export function rectsOverlap(a: WallRect, b: WallRect): boolean {
  return intersectionArea(a, b) > 0;
}

export function intersectionArea(a: WallRect, b: WallRect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The intro's layout width, in wall units (its content is centred within). */
export const INTRO_WIDTH = 700;

/** The intro's centre sits this far down the visible part of the wall (40% from the top). */
export const INTRO_VERTICAL_ANCHOR = 0.45;

/**
 * Where the attachment is fixed, as fractions of the entry's footprint.
 * Tape can overhang an edge; a pin must land on paper, so irregular
 * sticky shapes push it down onto the body.
 */
export interface AttachmentAnchor {
  x: number;
  y: number;
}

export function getAttachmentAnchor(entry: GuestbookEntry, attachment: AttachmentType): AttachmentAnchor {
  const isPin = attachment === 'pin';
  if (entry.type === 'polaroid') return { x: 0.5, y: isPin ? 0.028 : 0 };
  switch (entry.shape) {
    case 'square':
      return { x: 0.5, y: isPin ? 0.08 : 0 };
    case 'apple':
      return { x: 0.5, y: isPin ? 0.3 : 0.2 };
    case 'clover':
      return { x: 0.5, y: isPin ? 0.18 : 0.1 };
  }
}

/**
 * Order entries the way a person would read the wall: in loose horizontal
 * bands, top to bottom, then left to right. Used for DOM/tab order so
 * keyboard and screen-reader users get a sensible sequence regardless of
 * stacking order.
 */
const READING_BAND_HEIGHT = 240;

export function sortByReadingOrder<T extends GuestbookEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const bandA = Math.floor(a.placement.y / READING_BAND_HEIGHT);
    const bandB = Math.floor(b.placement.y / READING_BAND_HEIGHT);
    return bandA - bandB || a.placement.x - b.placement.x;
  });
}
