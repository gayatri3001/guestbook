import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { EntryId, GuestbookEntry, WallPlacement } from '../domain/guestbook';

/**
 * Transient, viewer-local interaction state for the wall. Never persisted.
 *
 *   browsing ──Add yours──▶ composing ──Done──▶ placing ──release──▶ saving ──▶ browsing
 *                              ▲                  │
 *                              └──── Esc / Back ──┘
 */
export type WallMode =
  | { kind: 'browsing' }
  | { kind: 'composing' }
  | {
      kind: 'placing';
      /** The new entry, held in hand; its placement follows the pointer. */
      entry: GuestbookEntry;
      /** Prepared photo to upload once placed. */
      photo: Blob | null;
      /** Pointer is pressed (or a finger is dragging the note). */
      holding: boolean;
      error: string | null;
    }
  | { kind: 'saving'; entry: GuestbookEntry; photo: Blob | null };

interface State {
  mode: WallMode;
  /** Entry the visitor has picked out to read (raised above its neighbours). */
  selectedEntryId: EntryId | null;
}

type Action =
  | { type: 'toggle-entry'; id: EntryId }
  | { type: 'clear-selection' }
  | { type: 'open-composer' }
  | { type: 'close-composer' }
  | { type: 'start-placing'; entry: GuestbookEntry; photo: Blob | null }
  | { type: 'move-pending'; placement: WallPlacement }
  | { type: 'set-holding'; holding: boolean }
  | { type: 'back-to-composer' }
  | { type: 'start-saving'; placement: WallPlacement }
  | { type: 'saving-failed'; error: string }
  | { type: 'placement-failed'; error: string }
  | { type: 'saved' };

export function wallInteractionReducer(state: State, action: Action): State {
  const { mode } = state;
  switch (action.type) {
    case 'toggle-entry':
      if (mode.kind !== 'browsing') return state;
      return { ...state, selectedEntryId: state.selectedEntryId === action.id ? null : action.id };
    case 'clear-selection':
      return state.selectedEntryId === null ? state : { ...state, selectedEntryId: null };
    case 'open-composer':
      return { mode: { kind: 'composing' }, selectedEntryId: null };
    case 'close-composer':
      return mode.kind === 'composing' ? { ...state, mode: { kind: 'browsing' } } : state;
    case 'start-placing':
      return {
        ...state,
        mode: { kind: 'placing', entry: action.entry, photo: action.photo, holding: false, error: null },
      };
    case 'move-pending':
      if (mode.kind !== 'placing') return state;
      // Moving on clears any "no room here" / save-failed message.
      return { ...state, mode: { ...mode, entry: { ...mode.entry, placement: action.placement }, error: null } };
    case 'set-holding':
      if (mode.kind !== 'placing' || mode.holding === action.holding) return state;
      return { ...state, mode: { ...mode, holding: action.holding } };
    case 'back-to-composer':
      return mode.kind === 'placing' ? { ...state, mode: { kind: 'composing' } } : state;
    case 'start-saving':
      if (mode.kind !== 'placing') return state;
      return {
        ...state,
        mode: { kind: 'saving', entry: { ...mode.entry, placement: action.placement }, photo: mode.photo },
      };
    case 'saving-failed':
      if (mode.kind !== 'saving') return state;
      return { ...state, mode: { kind: 'placing', entry: mode.entry, photo: mode.photo, holding: false, error: action.error } };
    case 'placement-failed':
      if (mode.kind !== 'placing') return state;
      return { ...state, mode: { ...mode, holding: false, error: action.error } };
    case 'saved':
      return { mode: { kind: 'browsing' }, selectedEntryId: null };
  }
}

const INITIAL_STATE: State = { mode: { kind: 'browsing' }, selectedEntryId: null };

export function useWallInteraction() {
  const [state, dispatch] = useReducer(wallInteractionReducer, INITIAL_STATE);

  const actions = useMemo(
    () => ({
      toggleEntry: (id: EntryId) => dispatch({ type: 'toggle-entry', id }),
      clearSelection: () => dispatch({ type: 'clear-selection' }),
      openComposer: () => dispatch({ type: 'open-composer' }),
      closeComposer: () => dispatch({ type: 'close-composer' }),
      startPlacing: (entry: GuestbookEntry, photo: Blob | null) => dispatch({ type: 'start-placing', entry, photo }),
      movePending: (placement: WallPlacement) => dispatch({ type: 'move-pending', placement }),
      setHolding: (holding: boolean) => dispatch({ type: 'set-holding', holding }),
      backToComposer: () => dispatch({ type: 'back-to-composer' }),
      /** Stick the note down at `placement` (its final, rule-abiding spot). */
      startSaving: (placement: WallPlacement) => dispatch({ type: 'start-saving', placement }),
      /** Back to holding the note, with a message (also used when there's no free spot). */
      savingFailed: (error: string) => dispatch({ type: 'saving-failed', error }),
      placementFailed: (error: string) => dispatch({ type: 'placement-failed', error }),
      saved: () => dispatch({ type: 'saved' }),
    }),
    [],
  );

  // Escape clears a selection while browsing (placement handles its own Escape).
  const hasSelection = state.selectedEntryId !== null;
  const clearOnEscape = useCallback(
    (event: KeyboardEvent) => event.key === 'Escape' && actions.clearSelection(),
    [actions],
  );
  useEffect(() => {
    if (!hasSelection) return;
    window.addEventListener('keydown', clearOnEscape);
    return () => window.removeEventListener('keydown', clearOnEscape);
  }, [hasSelection, clearOnEscape]);

  return { ...state, ...actions };
}

export type WallInteraction = ReturnType<typeof useWallInteraction>;
