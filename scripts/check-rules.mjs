// Checks the database security rules from the outside, as a visitor would,
// using only the public (publishable) key from .env.local.
//
//   node scripts/check-rules.mjs
//
// The signed-in checks create one real test note and one tiny test photo;
// their ids are printed so they can be removed afterwards.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('=')),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const results = {};
const expectBlocked = (r) => (r.error ? `blocked ✓ (${r.error.message})` : 'ALLOWED ✗ — problem!');
const note = (overrides = {}) => ({
  id: crypto.randomUUID(),
  type: 'sticky',
  shape: 'square',
  color: 'yellow',
  message: 'rules check — safe to delete',
  x: 800,
  y: 900,
  rotation: 2,
  attachment: 'pin',
  ...overrides,
});

// --- As a stranger (not signed in) -------------------------------------------
const read = await sb.from('entries').select('id');
results['stranger: read the wall'] = read.error ? `ERROR ✗ ${read.error.message}` : `ok ✓ (${read.data.length} notes)`;
results['stranger: add a note'] = expectBlocked(await sb.from('entries').insert(note()));
results['stranger: upload a photo'] = expectBlocked(
  await sb.storage.from('photos').upload(`someone/${crypto.randomUUID()}.jpg`, new Blob(['x'], { type: 'image/jpeg' })),
);

// --- As an anonymous visitor -------------------------------------------------
const signIn = await sb.auth.signInAnonymously();
if (signIn.error) {
  results['anonymous sign-in'] = `not available (${signIn.error.message}) — enable it in the dashboard`;
} else {
  const me = signIn.data.user.id;
  results['anonymous sign-in'] = 'works ✓';

  const mine = note();
  const add = await sb.from('entries').insert(mine).select('id, owner_id, hidden, z_index').single();
  results['visitor: add own note'] = add.error
    ? `ERROR ✗ ${add.error.message}`
    : add.data.owner_id === me && add.data.hidden === false
      ? `ok ✓ (owner stamped by server, z_index ${add.data.z_index})`
      : 'ERROR ✗ owner/hidden not set by server';

  results['visitor: second note within a minute'] = expectBlocked(await sb.from('entries').insert(note()));
  results['visitor: post a note pre-hidden'] = expectBlocked(
    await sb.from('entries').insert(note({ hidden: true })),
  );
  results['visitor: post a note as someone else'] = expectBlocked(
    await sb.from('entries').insert(note({ owner_id: crypto.randomUUID() })),
  );
  results['visitor: edit a note’s text'] = expectBlocked(
    await sb.from('entries').update({ message: 'changed' }).eq('id', mine.id),
  );

  // Not the admin: these match no rows, so nothing changes.
  const move = await sb.from('entries').update({ x: 100 }).eq('id', mine.id).select('id');
  results['visitor: move a note (admin only for now)'] =
    !move.error && move.data.length === 0 ? 'blocked ✓ (no rows changed)' : 'ALLOWED ✗ — problem!';
  const hide = await sb.from('entries').update({ hidden: true }).eq('id', mine.id).select('id');
  results['visitor: hide a note'] =
    hide.error || hide.data.length === 0 ? 'blocked ✓' : 'ALLOWED ✗ — problem!';
  const del = await sb.from('entries').delete().eq('id', mine.id).select('id');
  results['visitor: delete a note'] = del.error || del.data.length === 0 ? 'blocked ✓' : 'ALLOWED ✗ — problem!';

  const ownPath = `${me}/${mine.id}.jpg`;
  const up = await sb.storage.from('photos').upload(ownPath, new Blob(['x'], { type: 'image/jpeg' }));
  results['visitor: upload to own folder'] = up.error ? `ERROR ✗ ${up.error.message}` : 'ok ✓';
  results['visitor: upload to someone else’s folder'] = expectBlocked(
    await sb.storage
      .from('photos')
      .upload(`${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`, new Blob(['x'], { type: 'image/jpeg' })),
  );
  results['visitor: upload a non-image'] = expectBlocked(
    await sb.storage.from('photos').upload(`${me}/note.txt`, new Blob(['x'], { type: 'text/plain' })),
  );

  results['cleanup'] = { testNoteId: mine.id, testPhotoPath: up.error ? null : ownPath };
}

console.log(JSON.stringify(results, null, 2));
