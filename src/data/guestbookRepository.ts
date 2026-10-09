import type { EntryId, GuestbookEntry, UserId, WallPlacement } from '../domain/guestbook';

/** A change to the wall made elsewhere (another visitor, or the admin). */
export type EntryChange = { type: 'upsert'; entry: GuestbookEntry } | { type: 'remove'; id: EntryId };

/** Whether this browser is signed in as the admin. */
export type AdminStatus = 'admin' | 'not-admin' | 'signed-out';

export interface WallQuery {
  /** Include hidden notes (only the admin actually receives them). */
  includeHidden?: boolean;
}

/**
 * The only boundary between the UI and wherever entries are stored.
 * Implemented by Supabase (real data) and an in-memory mock (offline work).
 */
export interface GuestbookRepository {
  listEntries(query?: WallQuery): Promise<GuestbookEntry[]>;

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
  subscribe(listener: (change: EntryChange) => void, query?: WallQuery): () => void;

  // --- Admin ----------------------------------------------------------------

  getAdminStatus(): Promise<AdminStatus>;
  /** Email a 6-digit sign-in code (only to an existing account). */
  sendAdminCode(email: string): Promise<void>;
  verifyAdminCode(email: string, code: string): Promise<AdminStatus>;
  signOutAdmin(): Promise<void>;
  /** Admin only: take a note down, or put it back. */
  setHidden(id: EntryId, hidden: boolean): Promise<GuestbookEntry>;
  /** Admin only: move a note (it comes to the top of the stack). */
  moveEntry(id: EntryId, placement: WallPlacement): Promise<GuestbookEntry>;
}
