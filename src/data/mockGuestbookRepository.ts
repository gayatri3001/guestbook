import type { GuestbookEntry } from '../domain/guestbook';
import type { GuestbookRepository } from './guestbookRepository';
import { MOCK_ENTRIES, MOCK_VIEWER_ID } from './mock/mockEntries';

/**
 * In-memory repository backed by deterministic mock data, for working
 * offline. New entries and photos last until the page reloads.
 */
export function createMockGuestbookRepository(): GuestbookRepository {
  const entries: GuestbookEntry[] = structuredClone(MOCK_ENTRIES);

  return {
    async listEntries() {
      // Hand out copies so callers can't mutate the store.
      return structuredClone(entries);
    },
    async hasVisitor() {
      return true;
    },
    async ensureVisitor() {
      return MOCK_VIEWER_ID;
    },
    async createEntry(entry, photo) {
      let saved = entry;
      if (photo && entry.type === 'polaroid' && entry.media.kind === 'photo') {
        saved = { ...entry, media: { ...entry.media, imageUrl: URL.createObjectURL(photo) } };
      }
      entries.push(structuredClone(saved));
      return structuredClone(saved);
    },
    subscribe() {
      return () => {};
    },
  };
}
