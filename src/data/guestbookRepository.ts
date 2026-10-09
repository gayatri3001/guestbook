import type { EntryId, GuestbookEntry, UserId } from '../domain/guestbook';

/** A change to the wall made elsewhere (another visitor, or the admin). */
export type EntryChange = { type: 'upsert'; entry: GuestbookEntry } | { type: 'remove'; id: EntryId };

/**
 * The only boundary between the UI and wherever entries are stored.
 * Implemented by Supabase (real data) and an in-memory mock (offline work).
 */
export interface GuestbookRepository {
  listEntries(): Promise<GuestbookEntry[]>;

  /** Whether this browser already has a visitor identity to post with. */
  hasVisitor(): Promise<boolean>;

  /**
   * Make sure the visitor has an identity, signing them in quietly if not.
   * `captchaToken` is the bot-check token, needed only for a first sign-in
   * when the bot check is switched on.
   */
  ensureVisitor(captchaToken?: string): Promise<UserId>;

  /** Save a fully placed entry (uploading its photo first, if any) and return it as stored. */
  createEntry(entry: GuestbookEntry, photo: Blob | null): Promise<GuestbookEntry>;

  /** Listen for changes made by others. Returns an unsubscribe function. */
  subscribe(listener: (change: EntryChange) => void): () => void;
}
