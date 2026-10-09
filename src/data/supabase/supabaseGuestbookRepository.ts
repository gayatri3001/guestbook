import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { GuestbookError } from '../errors';
import type { AdminStatus, GuestbookRepository } from '../guestbookRepository';
import { ENTRY_COLUMNS, entryToInsert, rowToEntry, type EntryRow } from './entryRows';

const PHOTO_BUCKET = 'photos';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/**
 * Real data: notes in the `entries` table, photos in the `photos` bucket,
 * visitors signed in anonymously when they first post. What each visitor
 * may do is enforced by the database's security rules, not by this code.
 */
export function createSupabaseGuestbookRepository(config: SupabaseConfig): GuestbookRepository {
  const supabase: SupabaseClient = createClient(config.url, config.publishableKey);
  const photoUrl = (path: string) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

  const currentUserId = async () => (await supabase.auth.getSession()).data.session?.user.id ?? null;

  const adminStatus = async (): Promise<AdminStatus> => {
    const user = (await supabase.auth.getSession()).data.session?.user;
    // A visitor's anonymous account doesn't count as being signed in as admin.
    if (!user || user.is_anonymous) return 'signed-out';
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    return data ? 'admin' : 'not-admin';
  };

  const updateEntry = async (id: string, changes: Partial<Pick<EntryRow, 'x' | 'y' | 'rotation' | 'hidden'>>) => {
    const { data, error } = await supabase
      .from('entries')
      .update(changes)
      .eq('id', id)
      .select(ENTRY_COLUMNS)
      .maybeSingle<EntryRow>();
    if (error) throw toGuestbookError(error, 'That change couldn’t be saved. Please try again.');
    if (!data) throw new GuestbookError('Only the admin can do that — try signing in again.');
    return rowToEntry(data, photoUrl);
  };

  return {
    async listEntries(query) {
      let request = supabase.from('entries').select(ENTRY_COLUMNS);
      // Hidden notes only ever reach the admin (the database enforces that);
      // everyone else, and the admin on the public page, asks for visible ones.
      if (!query?.includeHidden) request = request.eq('hidden', false);
      const { data, error } = await request.order('z_index', { ascending: true }).returns<EntryRow[]>();
      if (error) throw toGuestbookError(error, 'The guestbook couldn’t be loaded.');
      return data.map((row) => rowToEntry(row, photoUrl));
    },

    async hasVisitor() {
      return (await currentUserId()) !== null;
    },

    async ensureVisitor(captchaToken) {
      const existing = await currentUserId();
      if (existing) return existing;
      const { data, error } = await supabase.auth.signInAnonymously(
        captchaToken ? { options: { captchaToken } } : undefined,
      );
      if (error || !data.user) {
        throw new GuestbookError('We couldn’t verify your browser. Please try sticking it again.', {
          cause: error,
        });
      }
      return data.user.id;
    },

    async createEntry(entry, photo) {
      const userId = await currentUserId();
      if (!userId) throw new GuestbookError('Something went wrong signing you in. Please try again.');

      // Photos live in the visitor's own folder: <user id>/<entry id>.jpg
      let imagePath: string | null = null;
      if (photo && entry.type === 'polaroid' && entry.media.kind === 'photo') {
        imagePath = `${userId}/${entry.id}.jpg`;
        const upload = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(imagePath, photo, { contentType: photo.type || 'image/jpeg', upsert: false });
        if (upload.error) {
          throw new GuestbookError('Your photo couldn’t be uploaded. Please try again.', { cause: upload.error });
        }
      }

      const { data, error } = await supabase
        .from('entries')
        .insert(entryToInsert(entry, imagePath))
        .select(ENTRY_COLUMNS)
        .single<EntryRow>();
      if (error) {
        // The visitor's account no longer exists (e.g. cleaned up), but this
        // browser still holds its old sign-in. Forget it so the next try
        // starts fresh with a new anonymous identity.
        if (error.code === '23503') {
          await supabase.auth.signOut({ scope: 'local' });
          throw new GuestbookError('Something went wrong on our side. Please try sticking it again.', { cause: error });
        }
        throw toGuestbookError(error, 'Your note couldn’t be saved. Try sticking it again.');
      }
      return rowToEntry(data, photoUrl);
    },

    subscribe(listener, query) {
      const includeHidden = query?.includeHidden ?? false;
      const channel = supabase
        .channel(`wall-${crypto.randomUUID()}`)
        .on<EntryRow>('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            if (payload.old.id) listener({ type: 'remove', id: payload.old.id });
            return;
          }
          const row = payload.new;
          listener(
            row.hidden && !includeHidden
              ? { type: 'remove', id: row.id }
              : { type: 'upsert', entry: rowToEntry(row, photoUrl) },
          );
        })
        // Visitors can't read a note once it's hidden, so they hear about it here.
        .on<{ entry_id: string }>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'hidden_entries' },
          (payload) => {
            if (!includeHidden) listener({ type: 'remove', id: payload.new.entry_id });
          },
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },

    getAdminStatus: adminStatus,

    async sendAdminCode(email) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) {
        throw new GuestbookError(
          error.status === 429
            ? 'Too many codes requested — please wait a few minutes.'
            : 'We couldn’t send a code to that email.',
          { cause: error },
        );
      }
    },

    async verifyAdminCode(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw new GuestbookError('That code didn’t work — check it, or request a new one.', { cause: error });
      return adminStatus();
    },

    async signOutAdmin() {
      await supabase.auth.signOut({ scope: 'local' });
    },

    setHidden(id, hidden) {
      return updateEntry(id, { hidden });
    },

    moveEntry(id, placement) {
      return updateEntry(id, { x: placement.x, y: placement.y, rotation: placement.rotation });
    },
  };
}

/** Turn database errors into messages visitors can act on. */
function toGuestbookError(error: PostgrestError, fallback: string): GuestbookError {
  if (error.hint === 'rate_limited') {
    return new GuestbookError('You just added a note — please wait a minute before adding another.', { cause: error });
  }
  if (error.code === '23514') {
    // A check constraint: the database rejected the content itself.
    return new GuestbookError('Something about this note didn’t fit — try shortening it.', { cause: error });
  }
  return new GuestbookError(fallback, { cause: error });
}
