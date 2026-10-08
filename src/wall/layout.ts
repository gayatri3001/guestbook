import type { GuestbookEntry } from '../domain/guestbook';
import { MAX_WALL_SCALE, MIN_WALL_SCALE, WALL_SIZE, clamp, type WallPoint, type WallSize } from './coordinates';
import type { WallRect } from './geometry';

/**
 * How the shared wall is laid out on this screen.
 *
 * Positions are always stored in wall units. A layout maps them to "view"
 * units (the scaled surface the visitor scrolls) and back:
 *
 * - full: the whole wall, scaled to the screen's width (vertical scroll only).
 * - folded: on narrow screens the wall is cut into vertical strips, stacked
 *   top to bottom. The strip holding the heading comes first, then the strips
 *   to its right, then those to its left — so placing a note further down on
 *   a phone puts it further right on the wall.
 */

export const FOLD_STRIP_COUNT = 3;
/** Space either side of a strip, so notes near a cut can overhang it. */
export const FOLD_GUTTER = 24;
/** Fold when fitting the whole wall's width would shrink it below this scale. */
const FOLD_BELOW_SCALE = 0.62;

const STRIP_WIDTH = WALL_SIZE.width / FOLD_STRIP_COUNT;
/** Strip order, top to bottom: the middle strip (with the heading), then right, then left. */
const STRIP_ORDER = [1, 2, 0];

export type WallLayout =
  | { kind: 'full'; scale: number; view: WallSize }
  | { kind: 'folded'; scale: number; view: WallSize };

export function computeWallLayout(containerWidth: number): WallLayout {
  const width = Math.max(containerWidth, 1);
  const fullScale = width / WALL_SIZE.width;
  if (fullScale >= FOLD_BELOW_SCALE) {
    return { kind: 'full', scale: Math.min(fullScale, MAX_WALL_SCALE), view: WALL_SIZE };
  }
  const view = { width: STRIP_WIDTH + FOLD_GUTTER * 2, height: WALL_SIZE.height * FOLD_STRIP_COUNT };
  return { kind: 'folded', scale: clamp(width / view.width, MIN_WALL_SCALE, MAX_WALL_SCALE), view };
}

function stripOf(x: number): number {
  return clamp(Math.floor(x / STRIP_WIDTH), 0, FOLD_STRIP_COUNT - 1);
}

export function wallToView(layout: WallLayout, point: WallPoint): WallPoint {
  if (layout.kind === 'full') return point;
  const strip = stripOf(point.x);
  const position = STRIP_ORDER.indexOf(strip);
  return { x: point.x - strip * STRIP_WIDTH + FOLD_GUTTER, y: point.y + position * WALL_SIZE.height };
}

/**
 * The wall point under a view point. In a folded layout the result always
 * stays inside the strip being pointed at (so a note never jumps strips
 * from hovering in a gutter).
 */
export function viewToWall(layout: WallLayout, point: WallPoint): WallPoint {
  if (layout.kind === 'full') return point;
  const position = clamp(Math.floor(point.y / WALL_SIZE.height), 0, FOLD_STRIP_COUNT - 1);
  const strip = STRIP_ORDER[position]!;
  const left = strip * STRIP_WIDTH;
  return {
    x: clamp(point.x - FOLD_GUTTER + left, left, left + STRIP_WIDTH - 0.01),
    y: point.y - position * WALL_SIZE.height,
  };
}

/** A view-space rect (e.g. the measured intro) as a wall rect, keeping its size. */
export function viewRectToWall(layout: WallLayout, rect: WallRect): WallRect {
  const centre = viewToWall(layout, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  return { ...rect, left: centre.x - rect.width / 2, top: centre.y - rect.height / 2 };
}

/**
 * The entry as drawn in view space. In a folded layout it's nudged so its
 * main sheet stays inside the strip (display only; the stored position is
 * untouched).
 */
export function entryInView(layout: WallLayout, entry: GuestbookEntry, halfWidth: number): GuestbookEntry {
  if (layout.kind === 'full') return entry;
  const point = wallToView(layout, entry.placement);
  const x = clamp(point.x, halfWidth, layout.view.width - halfWidth);
  return { ...entry, placement: { ...entry.placement, x, y: point.y } };
}

/**
 * The part of the wall that's on screen, given the visible view rect. In a
 * folded layout that's limited to the strip under the screen's centre.
 */
export function visibleWallRect(layout: WallLayout, view: WallRect): WallRect {
  if (layout.kind === 'full') return view;
  const centreY = view.top + view.height / 2;
  const position = clamp(Math.floor(centreY / WALL_SIZE.height), 0, FOLD_STRIP_COUNT - 1);
  const stripTop = position * WALL_SIZE.height;
  const top = Math.max(view.top, stripTop);
  const bottom = Math.min(view.top + view.height, stripTop + WALL_SIZE.height);
  const a = viewToWall(layout, { x: FOLD_GUTTER, y: top });
  return { left: a.x, top: a.y, width: STRIP_WIDTH, height: Math.max(0, bottom - top) };
}
