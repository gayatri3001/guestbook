import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { GuestbookEntry, WallPlacement } from '../domain/guestbook';
import { screenToWall, type WallPoint } from '../wall/coordinates';
import { viewToWall, visibleWallRect, type WallLayout } from '../wall/layout';
import { moveWithinWall, nearestFreePlacement, type WallObstacles } from '../wall/placement';

interface PlacementDragOptions {
  /** The entry in hand, or null when not placing. */
  entry: GuestbookEntry | null;
  /** Entries already on the wall and the intro's shapes (for choosing a free starting spot). */
  others: readonly GuestbookEntry[];
  obstacles: WallObstacles;
  /** How the wall is laid out on screen (whole or folded into strips). */
  layout: WallLayout | null;
  viewportRef: RefObject<HTMLElement | null>;
  surfaceRef: RefObject<HTMLElement | null>;
  onMove: (placement: WallPlacement) => void;
  onHoldingChange: (holding: boolean) => void;
  /** Pointer released: try to stick the note where it is. */
  onRelease: () => void;
  onCancel: () => void;
}

/** Elements marked with this attribute (e.g. the "Back" button) don't pick the note up. */
export const PLACEMENT_IGNORE_ATTR = 'data-placement-ignore';

const EDGE_ZONE = 64;
/** Screen pixels at the bottom reserved for the placement toast. */
const TOAST_CLEARANCE = 120;
const MAX_SCROLL_SPEED = 16;

interface Drag {
  pointerId: number;
  /** Where on the note it was grabbed, relative to its centre (wall units). */
  grabOffset: WallPoint;
}

/**
 * Pointer handling while a new note is in hand.
 *
 * - Mouse: the note follows the cursor; press and release to stick it.
 * - Touch/pen: the note waits in view; drag it with a finger and let go.
 * While dragging near an edge, the wall scrolls so any spot is reachable.
 */
export function usePlacementDrag({
  entry,
  others,
  obstacles,
  layout,
  viewportRef,
  surfaceRef,
  onMove,
  onHoldingChange,
  onRelease,
  onCancel,
}: PlacementDragOptions) {
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const othersRef = useRef(others);
  othersRef.current = others;
  const obstaclesRef = useRef(obstacles);
  obstaclesRef.current = obstacles;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef<Drag | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const callbacks = useRef({ onMove, onHoldingChange, onRelease, onCancel });
  callbacks.current = { onMove, onHoldingChange, onRelease, onCancel };

  /** Screen point → point on the scaled surface ("view" units). */
  const toView = useCallback(
    (clientX: number, clientY: number): WallPoint | null => {
      const surface = surfaceRef.current;
      if (!surface || !layout) return null;
      const rect = surface.getBoundingClientRect();
      return screenToWall({ x: clientX, y: clientY }, { scale: layout.scale, origin: { x: rect.left, y: rect.top } });
    },
    [layout, surfaceRef],
  );

  /** Screen point → the wall point under it (through the fold, if any). */
  const toWall = useCallback(
    (clientX: number, clientY: number): WallPoint | null => {
      const view = toView(clientX, clientY);
      return view && layout ? viewToWall(layout, view) : null;
    },
    [toView, layout],
  );

  const followPointer = useCallback(
    (clientX: number, clientY: number) => {
      const current = entryRef.current;
      const point = toWall(clientX, clientY);
      if (!current || !point) return;
      const offset = dragRef.current?.grabOffset ?? { x: 0, y: 0 };
      callbacks.current.onMove(moveWithinWall(current, { x: point.x - offset.x, y: point.y - offset.y }));
    },
    [toWall],
  );

  const isPlacing = entry !== null;
  const entryId = entry?.id ?? null;
  // The note a starting spot was last chosen for. A note handed back after a
  // failed save keeps its place (and its error message) instead of re-centring.
  const startedFor = useRef<string | null>(null);

  // A newly picked-up note starts at the free spot nearest the middle of the view.
  useEffect(() => {
    const viewport = viewportRef.current;
    const current = entryRef.current;
    if (!entryId || !viewport || !current || startedFor.current === entryId) return;
    startedFor.current = entryId;
    const rect = viewport.getBoundingClientRect();
    const centre = toWall(rect.left + rect.width / 2, rect.top + rect.height / 2);
    // Look only on screen, keeping the bottom clear of the toast.
    const topLeft = toView(rect.left, rect.top);
    const bottomRight = toView(rect.right, rect.bottom - TOAST_CLEARANCE);
    const currentLayout = layoutRef.current;
    if (!centre || !topLeft || !bottomRight || !currentLayout) return;
    const visible = visibleWallRect(currentLayout, {
      left: topLeft.x,
      top: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    });
    const atCentre = { ...current, placement: moveWithinWall(current, centre) };
    callbacks.current.onMove(
      nearestFreePlacement(atCentre, othersRef.current, obstaclesRef.current, visible) ?? atCentre.placement,
    );
    // Only when a new note is picked up — not on every resize while it's in hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  useEffect(() => {
    if (!isPlacing) return;

    const endDrag = () => {
      dragRef.current = null;
      callbacks.current.onHoldingChange(false);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (event.pointerType !== 'mouse' && drag?.pointerId !== event.pointerId) return;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      followPointer(event.clientX, event.clientY);
    };

    // Mouse: pressing anywhere picks the note up (it's already under the cursor).
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if ((event.target as Element | null)?.closest(`[${PLACEMENT_IGNORE_ATTR}]`)) return;
      event.preventDefault();
      dragRef.current = { pointerId: event.pointerId, grabOffset: { x: 0, y: 0 } };
      lastPointer.current = { x: event.clientX, y: event.clientY };
      callbacks.current.onHoldingChange(true);
      followPointer(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      endDrag();
      callbacks.current.onRelease();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) endDrag();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        callbacks.current.onCancel();
      }
    };

    // Edge auto-scroll while something is being dragged.
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const viewport = viewportRef.current;
      const pointer = lastPointer.current;
      if (!dragRef.current || !viewport || !pointer) return;
      const rect = viewport.getBoundingClientRect();
      const speed = (distance: number) =>
        distance < EDGE_ZONE ? Math.ceil(((EDGE_ZONE - distance) / EDGE_ZONE) * MAX_SCROLL_SPEED) : 0;
      const dx = speed(rect.right - pointer.x) - speed(pointer.x - rect.left);
      const dy = speed(rect.bottom - pointer.y) - speed(pointer.y - rect.top);
      if (dx || dy) {
        viewport.scrollBy(dx, dy);
        followPointer(pointer.x, pointer.y);
      }
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      dragRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlacing, followPointer, viewportRef]);

  /** Touch/pen: grab the note itself and drag it, keeping the grab point under the finger. */
  const onNotePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = entryRef.current;
      if (event.pointerType === 'mouse' || !current) return;
      const point = toWall(event.clientX, event.clientY);
      if (!point) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        grabOffset: { x: point.x - current.placement.x, y: point.y - current.placement.y },
      };
      lastPointer.current = { x: event.clientX, y: event.clientY };
      callbacks.current.onHoldingChange(true);
    },
    [toWall],
  );

  return { onNotePointerDown };
}
