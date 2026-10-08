import type { GuestbookEntry } from '../domain/guestbook';
import type { GuestbookRepository } from './guestbookRepository';
import { MOCK_ENTRIES } from './mock/mockEntries';

/**
 * In-memory repository backed by deterministic mock data. New entries and
 * photos last until the page reloads.
 */
export function createMockGuestbookRepository(): GuestbookRepository {
  const entries: GuestbookEntry[] = structuredClone(MOCK_ENTRIES);

  return {
    async listEntries() {
      // Hand out copies so callers can't mutate the store.
      return structuredClone(entries);
    },
    async createEntry(entry) {
      entries.push(structuredClone(entry));
      return structuredClone(entry);
    },
    async uploadPhoto(photo) {
      return URL.createObjectURL(photo);
    },
  };
}
