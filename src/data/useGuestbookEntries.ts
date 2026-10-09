import { useCallback, useEffect, useState } from 'react';
import type { GuestbookEntry } from '../domain/guestbook';
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

/** The wall's entries: loaded once, then kept live as others add or move notes. */
export function useGuestbookEntries(repository: GuestbookRepository) {
  const [state, setState] = useState<EntriesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.listEntries().then(
      (entries) => !cancelled && setState({ status: 'ready', entries }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    );
    const unsubscribe = repository.subscribe((change) =>
      setState((current) =>
        current.status === 'ready' ? { status: 'ready', entries: applyChange(current.entries, change) } : current,
      ),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repository]);

  /**
   * Saves the entry (and its photo) and puts the stored version on the wall.
   * Throws on failure so the caller can keep the visitor's note in hand.
   */
  const publishEntry = useCallback(
    async (entry: GuestbookEntry, photo: Blob | null) => {
      const saved = await repository.createEntry(entry, photo);
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', entries: applyChange(current.entries, { type: 'upsert', entry: saved }) }
          : current,
      );
      return saved;
    },
    [repository],
  );

  return { state, publishEntry };
}
