import type { GuestbookEntry } from '../domain/guestbook';

/**
 * The only boundary between the UI and wherever entries are stored.
 *
 * The mock implementation backs it today; a Supabase implementation will
 * replace it (adding a move method for owners) without touching components.
 */
export interface GuestbookRepository {
  listEntries(): Promise<GuestbookEntry[]>;
  /** Persists a fully placed entry and returns it as stored. */
  createEntry(entry: GuestbookEntry): Promise<GuestbookEntry>;
  /** Stores a prepared photo and returns its public URL. */
  uploadPhoto(photo: Blob): Promise<string>;
}
