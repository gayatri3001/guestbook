import { useEffect, useState } from 'react';
import type { VisitorCheck } from './auth/visitorCheck';
import { Composer } from './components/Composer/Composer';
import { GuestbookWall } from './components/GuestbookWall/GuestbookWall';
import { userMessageFor } from './data/errors';
import type { GuestbookRepository } from './data/guestbookRepository';
import { useGuestbookEntries } from './data/useGuestbookEntries';
import { assignRotation, createEntryFromDraft, type EntryDraft } from './domain/draft';
import type { EntryId, WallPlacement } from './domain/guestbook';
import { useWallInteraction } from './interaction/useWallInteraction';
import { WALL_SIZE } from './wall/coordinates';
import { nextZIndex } from './wall/placement';

/** Matches `--motion-snap`; skipped when the visitor prefers reduced motion. */
const SNAP_DURATION_MS = 280;

const wait = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms),
  );

interface AppProps {
  repository: GuestbookRepository;
  /** Invisible bot check for a visitor's first sign-in; null when switched off. */
  visitorCheck: VisitorCheck | null;
}

export function App({ repository, visitorCheck }: AppProps) {
  const { state: entriesState, publishEntry } = useGuestbookEntries(repository);
  const interaction = useWallInteraction();
  const { mode } = interaction;
  // Remounting the composer is how its draft resets after a successful post.
  const [composerKey, setComposerKey] = useState(0);
  const [focusEntryId, setFocusEntryId] = useState<EntryId | null>(null);

  // While someone composes, run the bot check in the background (first-time
  // visitors only) so it's done long before they post.
  const composing = mode.kind === 'composing';
  useEffect(() => {
    if (!composing || !visitorCheck) return;
    void repository.hasVisitor().then((has) => {
      if (!has) visitorCheck.warm();
    });
  }, [composing, repository, visitorCheck]);

  if (entriesState.status === 'error') {
    return <p role="alert">The guestbook couldn’t be loaded. Please try again later.</p>;
  }
  const entries = entriesState.status === 'ready' ? entriesState.entries : [];

  // Done in the composer: the note is created and handed to the visitor to place.
  const handleComposed = (draft: EntryDraft) => {
    const id = crypto.randomUUID();
    const entry = createEntryFromDraft(draft, {
      id,
      createdAt: new Date().toISOString(),
      // The server stamps the real owner when it's saved.
      ownerId: null,
      // Starts mid-wall; placement moves it into view and under the pointer.
      placement: { x: WALL_SIZE.width / 2, y: WALL_SIZE.height / 2, rotation: assignRotation(id), zIndex: nextZIndex(entries) },
    });
    const photo = entry.type === 'polaroid' && entry.media.kind === 'photo' ? (draft.photo?.blob ?? null) : null;
    interaction.startPlacing(entry, photo);
  };

  // `placement` is already snapped to the nearest free spot by the wall (null: no room).
  const handlePlace = (placement: WallPlacement | null) => {
    if (mode.kind !== 'placing') return;
    const { entry, photo } = mode;
    if (!placement) {
      interaction.placementFailed('No free space around here — try another part of the wall.');
      return;
    }
    const snapped = placement.x !== entry.placement.x || placement.y !== entry.placement.y;
    interaction.startSaving(placement);

    const save = async () => {
      // Let the note visibly slide into its snapped spot before it's stuck down.
      await wait(snapped ? SNAP_DURATION_MS : 0);
      // First post from this browser: quietly sign in (after the bot check, if on).
      if (!(await repository.hasVisitor())) {
        await repository.ensureVisitor(visitorCheck ? await visitorCheck.takeToken() : undefined);
      }
      return publishEntry({ ...entry, placement }, photo);
    };

    save().then(
      (saved) => {
        setFocusEntryId(saved.id);
        setComposerKey((key) => key + 1);
        interaction.saved();
      },
      (error: unknown) =>
        interaction.savingFailed(userMessageFor(error, 'Your note couldn’t be saved. Try sticking it again.')),
    );
  };

  return (
    <>
      <GuestbookWall
        entries={entries}
        interaction={interaction}
        onAddMark={interaction.openComposer}
        onPlace={handlePlace}
        focusEntryId={focusEntryId}
      />
      <Composer
        key={composerKey}
        open={mode.kind === 'composing'}
        onClose={interaction.closeComposer}
        onSubmit={handleComposed}
      />
    </>
  );
}
