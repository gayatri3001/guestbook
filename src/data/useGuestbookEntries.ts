import { useCallback, useEffect, useState } from 'react';
import type { EntryId, GuestbookEntry, WallPlacement } from '../domain/guestbook';
import type { EntryChange, GuestbookRepository } from './guestbookRepository';

export type EntriesState =
  | { status: 'loading' }
  | { status: 'ready'; entries: GuestbookEntry[] }
  | { status: 'error'; error: unknown };

function applyChange(entries: GuestbookEntry[], change: EntryChange): GuestbookEntry[] {
  if (change.type === 'remove') return entries.filter((entry) => entry.id !== change.id);
  const index = entries.findIndex((entry) => entry.id === change.entry.id);
  if (index === -1) return [...entries, change.entry];
  const next = entries.slice();
  next[index] = change.entry;
  return next;
}

/**
 * The wall's entries: loaded once, then kept live as others add or move
 * notes. With `includeHidden` (admin mode) hidden notes are loaded too.
 */
export function useGuestbookEntries(repository: GuestbookRepository, includeHidden = false) {
  const [state, setState] = useState<EntriesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.listEntries({ includeHidden }).then(
      (entries) => !cancelled && setState({ status: 'ready', entries }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    );
    const unsubscribe = repository.subscribe(
      (change) =>
        setState((current) =>
          current.status === 'ready' ? { status: 'ready', entries: applyChange(current.entries, change) } : current,
        ),
      { includeHidden },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repository, includeHidden]);

  const putOnWall = useCallback((entry: GuestbookEntry) => {
    setState((current) =>
      current.status === 'ready'
        ? { status: 'ready', entries: applyChange(current.entries, { type: 'upsert', entry }) }
        : current,
    );
    return entry;
  }, []);

  /**
   * Saves the entry (and its photo) and puts the stored version on the wall.
   * Throws on failure so the caller can keep the visitor's note in hand.
   */
  const publishEntry = useCallback(
    async (entry: GuestbookEntry, photo: Blob | null) => {
      return putOnWall(await repository.createEntry(entry, photo));
    },
    [repository, putOnWall],
  );

  /** Admin: hide or show a note. */
  const setHidden = useCallback(
    async (id: EntryId, hidden: boolean) => putOnWall(await repository.setHidden(id, hidden)),
    [repository, putOnWall],
  );

  /** Admin: move a note. */
  const moveEntry = useCallback(
    async (id: EntryId, placement: WallPlacement) => putOnWall(await repository.moveEntry(id, placement)),
    [repository, putOnWall],
  );

  return { state, publishEntry, setHidden, moveEntry };
}
