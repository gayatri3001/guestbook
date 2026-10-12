import type { GuestbookEntry } from '../domain/guestbook';
import { GuestbookError } from './errors';
import type { AdminStatus, GuestbookRepository } from './guestbookRepository';
import { MOCK_ENTRIES, MOCK_VIEWER_ID } from './mock/mockEntries';

/**
 * In-memory repository backed by deterministic mock data, for working
 * offline. Changes last until the page reloads; any admin code works.
 */
export function createMockGuestbookRepository(): GuestbookRepository {
  const entries: GuestbookEntry[] = structuredClone(MOCK_ENTRIES);
  let adminStatus: AdminStatus = 'signed-out';

  const update = (id: string, change: (entry: GuestbookEntry) => GuestbookEntry) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) throw new GuestbookError('That note no longer exists.');
    entries[index] = change(entries[index]!);
    return structuredClone(entries[index]!);
  };
  const topZ = () => Math.max(0, ...entries.map((entry) => entry.placement.zIndex)) + 1;

  return {
    async listEntries(query) {
      // Hand out copies so callers can't mutate the store.
      return structuredClone(entries.filter((entry) => query?.includeHidden || !entry.hidden));
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
    async getAdminStatus() {
      return adminStatus;
    },
    // No email offline: asking for a link signs you straight in.
    async sendAdminLink() {
      adminStatus = 'admin';
    },
    async signOutAdmin() {
      adminStatus = 'signed-out';
    },
    async setHidden(id, hidden) {
      return update(id, (entry) => ({ ...entry, hidden }));
    },
    async moveEntry(id, placement) {
      return update(id, (entry) => ({ ...entry, placement: { ...placement, zIndex: topZ() } }));
    },
  };
}
