/**
 * Wall coordinate system.
 *
 * Entries are positioned in *wall units*: a fixed logical space that never
 * changes with the viewport. The renderer maps wall units to screen pixels
 * with a single uniform scale, so a note placed at (800, 550) is in the same
 * spot relative to its neighbours on every device.
 *
 * Wall units are absolute (not 0–1 fractions) so the wall can later grow
 * without moving existing entries.
 */

export interface WallPoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface WallSize {
  width: number;
  height: number;
}

export const WALL_SIZE: WallSize = { width: 1600, height: 1100 };

/** Scale bounds (see `layout.ts`). Below MIN_SCALE handwriting gets too small to read. */
export const MIN_WALL_SCALE = 0.55;
export const MAX_WALL_SCALE = 1.15;

/**
 * A snapshot of how the wall is currently projected onto the screen.
 * `origin` is the client-space position of wall point (0, 0).
 */
export interface WallViewport {
  scale: number;
  origin: ScreenPoint;
}

export function wallToScreen(point: WallPoint, viewport: WallViewport): ScreenPoint {
  return {
    x: viewport.origin.x + point.x * viewport.scale,
    y: viewport.origin.y + point.y * viewport.scale,
  };
}

export function screenToWall(point: ScreenPoint, viewport: WallViewport): WallPoint {
  return {
    x: (point.x - viewport.origin.x) / viewport.scale,
    y: (point.y - viewport.origin.y) / viewport.scale,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
