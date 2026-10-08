import type { GuestbookEntry, WallPlacement } from '../domain/guestbook';
import { WALL_SIZE, clamp, type WallPoint } from './coordinates';
import {
  getEntryExtent,
  getEntryRects,
  intersectionArea,
  rectsOverlap,
  type WallRect,
} from './geometry';

/**
 * Rules for where a new entry may go, and how it snaps when dropped
 * somewhere it can't:
 *
 * - it may cover at most 10% of any older entry,
 * - at most 5% of the heading + subtitle,
 * - and none of the CTA, which keeps a 10% margin around it.
 *
 * Shapes are compared as their unrotated rectangles (main sheet plus any
 * continuation stickies); tilts are small enough not to matter.
 */

export const MAX_ENTRY_OVERLAP = 0.1;
export const MAX_INTRO_TEXT_OVERLAP = 0.05;
export const CTA_MARGIN = 0.1;

const WALL_MARGIN = 12;

/**
 * Where the intro actually renders on this screen, in wall units. It's
 * measured live because the intro's position and size depend on the device.
 */
export interface WallObstacles {
  /** Heading and subtitle. */
  text: WallRect[];
  cta: WallRect | null;
}

export const NO_OBSTACLES: WallObstacles = { text: [], cta: null };

/** The CTA plus a margin of 10% of its width on every side. */
function ctaKeepOut(cta: WallRect): WallRect {
  const margin = cta.width * CTA_MARGIN;
  return { left: cta.left - margin, top: cta.top - margin, width: cta.width + margin * 2, height: cta.height + margin * 2 };
}

/** Move the entry's centre to `point`, nudged so it stays fully on the wall. */
export function moveWithinWall(entry: GuestbookEntry, point: WallPoint): WallPlacement {
  const { x, y } = entry.placement;
  const extent = getEntryExtent(entry);
  // Extent relative to the centre, so it can be re-applied at the new point.
  const left = extent.left - x;
  const top = extent.top - y;
  const right = left + extent.width;
  const bottom = top + extent.height;

  return {
    ...entry.placement,
    x: clamp(point.x, WALL_MARGIN - left, WALL_SIZE.width - WALL_MARGIN - right),
    y: clamp(point.y, WALL_MARGIN - top, WALL_SIZE.height - WALL_MARGIN - bottom),
  };
}

/** Fraction of `target` (a set of rects) that `cover` overlaps. */
function coveredFraction(cover: WallRect[], target: WallRect[]): number {
  const area = target.reduce((sum, r) => sum + r.width * r.height, 0);
  if (area === 0) return 0;
  let covered = 0;
  for (const a of cover) for (const b of target) covered += intersectionArea(a, b);
  return covered / area;
}

/** Whether the entry, where it currently sits, follows every placement rule. */
export function fitsAt(
  entry: GuestbookEntry,
  others: readonly GuestbookEntry[],
  obstacles: WallObstacles,
): boolean {
  const rects = getEntryRects(entry);
  if (obstacles.cta) {
    const keepOut = ctaKeepOut(obstacles.cta);
    if (rects.some((r) => rectsOverlap(r, keepOut))) return false;
  }
  if (coveredFraction(rects, obstacles.text) > MAX_INTRO_TEXT_OVERLAP) return false;
  return others.every(
    (other) => other.id === entry.id || coveredFraction(rects, getEntryRects(other)) <= MAX_ENTRY_OVERLAP,
  );
}

const SEARCH_STEP = 10;
const SEARCH_RADIUS = 1200;

function containsRect(outer: WallRect, inner: WallRect): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height
  );
}

/**
 * The closest placement to where the entry is now that follows the rules,
 * searching outward in rings. `within` limits the search to an area (e.g.
 * the part of the wall on screen). Null if there's no free spot.
 */
export function nearestFreePlacement(
  entry: GuestbookEntry,
  others: readonly GuestbookEntry[],
  obstacles: WallObstacles,
  within?: WallRect,
): WallPlacement | null {
  const origin = entry.placement;
  const at = (placement: WallPlacement) => ({ ...entry, placement });
  const allowed = (placement: WallPlacement) =>
    (!within || containsRect(within, getEntryExtent(at(placement)))) && fitsAt(at(placement), others, obstacles);

  const start = moveWithinWall(entry, origin);
  if (allowed(start)) return start;

  for (let radius = SEARCH_STEP; radius <= SEARCH_RADIUS; radius += SEARCH_STEP) {
    let best: WallPlacement | null = null;
    let bestDistance = Infinity;
    const samples = Math.ceil((2 * Math.PI * radius) / SEARCH_STEP);
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * 2 * Math.PI;
      const candidate = moveWithinWall(entry, {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      });
      const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
      if (distance < bestDistance && allowed(candidate)) {
        best = candidate;
        bestDistance = distance;
      }
    }
    // The first ring with any free spot holds the nearest one.
    if (best) return best;
  }
  return null;
}

/** New entries go on top of everything already on the wall. */
export function nextZIndex(entries: readonly GuestbookEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.placement.zIndex), 0) + 1;
}
