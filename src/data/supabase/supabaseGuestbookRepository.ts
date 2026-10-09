import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { GuestbookError } from '../errors';
import type { GuestbookRepository } from '../guestbookRepository';
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

  return {
    async listEntries() {
      const { data, error } = await supabase
        .from('entries')
        .select(ENTRY_COLUMNS)
        .eq('hidden', false)
        .order('z_index', { ascending: true })
        .returns<EntryRow[]>();
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

    subscribe(listener) {
      const channel = supabase
        .channel('entries')
        .on<EntryRow>('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            if (payload.old.id) listener({ type: 'remove', id: payload.old.id });
            return;
          }
          const row = payload.new;
          listener(row.hidden ? { type: 'remove', id: row.id } : { type: 'upsert', entry: rowToEntry(row, photoUrl) });
        })
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
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
