import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EntryId, GuestbookEntry, WallPlacement } from '../../domain/guestbook';
import { usePlacementDrag } from '../../interaction/usePlacementDrag';
import type { WallInteraction } from '../../interaction/useWallInteraction';
import { WALL_SIZE } from '../../wall/coordinates';
import { getEntryFootprint, INTRO_VERTICAL_ANCHOR, sortByReadingOrder } from '../../wall/geometry';
import { entryInView, viewRectToWall, type WallLayout } from '../../wall/layout';
import { fitsAt, moveWithinWall, nearestFreePlacement, NO_OBSTACLES, type WallObstacles } from '../../wall/placement';
import { useWallViewport } from '../../wall/useWallViewport';
import { PendingEntry } from '../PendingEntry/PendingEntry';
import { PlacementBanner } from '../PlacementBanner/PlacementBanner';
import { WallEntry, type AdminEntryActions } from '../WallEntry/WallEntry';
import { WallIntro } from '../WallIntro/WallIntro';
import styles from './GuestbookWall.module.css';

interface GuestbookWallProps {
  entries: GuestbookEntry[];
  interaction: WallInteraction;
  onAddMark: () => void;
  /**
   * Stick the in-hand note at `placement`: where it was dropped, or the
   * nearest free spot if that broke a spacing rule. Null when there's no room.
   */
  onPlace: (placement: WallPlacement | null) => void;
  /** Entry to focus when it appears — the visitor's freshly placed note. */
  focusEntryId: EntryId | null;
  /** Admin mode: move / hide controls on every note. */
  admin?: AdminEntryActions | null | undefined;
}

/** Where the intro's centre sits: 40% down the screen, staying within the first strip/wall. */
const INTRO_MAX_CENTER_Y = WALL_SIZE.height - 260;

const toView = (layout: WallLayout, entry: GuestbookEntry) =>
  entryInView(layout, entry, getEntryFootprint(entry).width / 2);

/**
 * The wall: a vertically scrolling viewport onto a scaled surface. Entries
 * are stored in wall units; the layout maps them onto the surface — the
 * whole wall on wide screens, folded into stacked strips on narrow ones.
 */
export function GuestbookWall({ entries, interaction, onAddMark, onPlace, focusEntryId, admin = null }: GuestbookWallProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const viewport = useWallViewport(viewportRef);
  const layout = viewport?.layout ?? null;
  const { mode, selectedEntryId, toggleEntry, clearSelection } = interaction;

  const pending = mode.kind === 'placing' || mode.kind === 'saving' ? mode.entry : null;
  const purpose = mode.kind === 'placing' || mode.kind === 'saving' ? mode.purpose : 'new';
  // A note being moved is drawn in hand, not in its old spot.
  const movingId = pending && purpose === 'move' ? pending.id : null;

  // Entries as drawn on this screen, in reading order.
  const ordered = useMemo(
    () =>
      layout
        ? sortByReadingOrder(entries.filter((entry) => entry.id !== movingId).map((entry) => toView(layout, entry)))
        : [],
    [entries, layout, movingId],
  );

  // Only the first batch of entries gets the staggered entrance.
  const initialIds = useRef<Set<EntryId> | null>(null);
  if (initialIds.current === null && entries.length > 0) {
    initialIds.current = new Set(entries.map((entry) => entry.id));
  }

  // Where the heading, subtitle and CTA render on this screen, converted to wall units for the rules.
  const [introInView, setIntroInView] = useState<WallObstacles>(NO_OBSTACLES);
  const obstacles = useMemo<WallObstacles>(
    () =>
      layout
        ? {
            text: introInView.text.map((rect) => viewRectToWall(layout, rect)),
            cta: introInView.cta && viewRectToWall(layout, introInView.cta),
          }
        : NO_OBSTACLES,
    [introInView, layout],
  );

  // Where it is now breaks a spacing rule: on release it will snap to the nearest free spot.
  // (The admin moving a note isn't bound by the spacing rules.)
  const pendingFits = pending && purpose === 'new' ? fitsAt(pending, entries, obstacles) : true;

  const place = () => {
    if (mode.kind !== 'placing') return;
    onPlace(
      mode.purpose === 'move'
        ? moveWithinWall(mode.entry, mode.entry.placement)
        : nearestFreePlacement(mode.entry, entries, obstacles),
    );
  };

  const { onNotePointerDown } = usePlacementDrag({
    entry: mode.kind === 'placing' ? mode.entry : null,
    // A moved note starts where it already is; a new one starts in view.
    chooseStart: purpose === 'new',
    others: entries,
    obstacles,
    layout,
    viewportRef,
    surfaceRef,
    onMove: interaction.movePending,
    onHoldingChange: interaction.setHolding,
    onRelease: place,
    onCancel: interaction.backToComposer,
  });

  return (
    <div className={styles.wall}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        role="region"
        aria-label="Guestbook wall"
        data-mode={mode.kind}
        data-layout={layout?.kind}
        onClick={clearSelection}
      >
        {viewport !== null && layout !== null && (
          <div
            className={styles.sizer}
            style={{ width: layout.view.width * layout.scale, height: layout.view.height * layout.scale }}
          >
            <div
              ref={surfaceRef}
              className={styles.surface}
              style={
                {
                  width: layout.view.width,
                  height: layout.view.height,
                  '--wall-scale': layout.scale,
                } as CSSProperties
              }
            >
              <WallIntro
                centerX={layout.view.width / 2}
                centerY={Math.min(viewport.visibleHeight * INTRO_VERTICAL_ANCHOR, INTRO_MAX_CENTER_Y)}
                onLayout={setIntroInView}
                // Keep a 16px screen gutter either side on narrow screens.
                fitWidth={Math.min(viewport.visibleWidth, layout.view.width) - 32 / layout.scale}
                onAddMark={onAddMark}
                // Busy while a just-made note is being placed.
                addDisabled={mode.kind === 'placing' || mode.kind === 'saving'}
              />

              <ol className={styles.entries} aria-label="Guestbook entries">
                {ordered.map((entry, index) => (
                  <WallEntry
                    key={entry.id}
                    entry={entry}
                    isSelected={entry.id === selectedEntryId}
                    onToggle={toggleEntry}
                    enterIndex={initialIds.current?.has(entry.id) ? index : 0}
                    focusOnMount={entry.id === focusEntryId}
                    admin={mode.kind === 'browsing' ? admin : null}
                  />
                ))}
              </ol>

              {pending && (
                <PendingEntry
                  key={pending.id}
                  entry={pending}
                  display={toView(layout, pending)}
                  holding={mode.kind === 'placing' && mode.holding}
                  saving={mode.kind === 'saving'}
                  onPointerDown={onNotePointerDown}
                  onMove={interaction.movePending}
                  onPlace={place}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {pending && (
        <PlacementBanner
          purpose={purpose}
          willSnap={!pendingFits}
          saving={mode.kind === 'saving'}
          error={mode.kind === 'placing' ? mode.error : null}
          onBack={interaction.backToComposer}
        />
      )}
    </div>
  );
}
