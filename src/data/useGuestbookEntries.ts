import { useCallback, useEffect, useState } from 'react';
import type { GuestbookEntry } from '../domain/guestbook';
import type { GuestbookRepository } from './guestbookRepository';

export type EntriesState =
  | { status: 'loading' }
  | { status: 'ready'; entries: GuestbookEntry[] }
  | { status: 'error'; error: unknown };

export function useGuestbookEntries(repository: GuestbookRepository) {
  const [state, setState] = useState<EntriesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.listEntries().then(
      (entries) => !cancelled && setState({ status: 'ready', entries }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  /**
   * Uploads the photo (if any), stores the entry, then adds it to the wall.
   * Throws on failure so the caller can keep the visitor's note in hand.
   */
  const publishEntry = useCallback(
    async (entry: GuestbookEntry, photo: Blob | null) => {
      let toSave = entry;
      if (photo && entry.type === 'polaroid' && entry.media.kind === 'photo') {
        const imageUrl = await repository.uploadPhoto(photo);
        toSave = { ...entry, media: { ...entry.media, imageUrl } };
      }
      const saved = await repository.createEntry(toSave);
      setState((current) =>
        current.status === 'ready' ? { status: 'ready', entries: [...current.entries, saved] } : current,
      );
      return saved;
    },
    [repository],
  );

  return { state, publishEntry };
}
