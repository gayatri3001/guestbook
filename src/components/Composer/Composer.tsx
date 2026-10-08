import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import {
  createEmptyDraft,
  MAX_NAME_LENGTH,
  validateDraft,
  type DraftErrors,
  type DraftPhoto,
  type EntryDraft,
  type PolaroidMediaChoice,
} from '../../domain/draft';
import { countWords, MAX_MESSAGE_WORDS } from '../../domain/messageSheets';
import { Button } from '../Button/Button';
import { DoodlePad } from '../DoodlePad/DoodlePad';
import { PhotoUpload } from '../PhotoUpload/PhotoUpload';
import { TabCell } from '../TabCell/TabCell';
import { SurfacePicker } from './SurfacePicker';
import styles from './Composer.module.css';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  /** Called with a valid draft when the visitor clicks Done. */
  onSubmit: (draft: EntryDraft) => void;
}

const MEDIA_TABS: { id: PolaroidMediaChoice; label: string }[] = [
  { id: 'doodle', label: 'Doodle' },
  { id: 'photo', label: 'Photo' },
];

/**
 * The "Add yours" modal. Holds the draft for as long as it's mounted, so
 * going back from placement returns to exactly what the visitor made.
 */
export function Composer({ open, onClose, onSubmit }: ComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const ids = { title: useId(), note: useId(), name: useId(), content: useId(), tabs: useId() };
  const [draft, setDraft] = useState<EntryDraft>(createEmptyDraft);

  const update = (patch: Partial<EntryDraft>) => setDraft((current) => ({ ...current, ...patch }));
  // Checked live: the CTA stays disabled until the draft has what it needs
  // (a doodle or note for stickies; a photo or doodle for Polaroids).
  const errors: DraftErrors = validateDraft(draft);
  const canSubmit = Object.keys(errors).length === 0;
  const isPolaroid = draft.surface.type === 'polaroid';

  // Open and close the native dialog (it handles focus trapping and inertness).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Photo previews are object URLs owned here; release them when replaced or on unmount.
  const photoUrl = draft.photo?.previewUrl;
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const setPhoto = (photo: DraftPhoto | null) => update({ photo });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit(draft);
  };

  // Close on a backdrop click, but not when a doodle stroke merely ends outside the panel.
  const handleBackdropDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const handleBackdropUp = (event: PointerEvent<HTMLDialogElement>) => {
    if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
    pressedBackdrop.current = false;
  };

  const handleTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: PolaroidMediaChoice = draft.polaroidMedia === 'doodle' ? 'photo' : 'doodle';
    update({ polaroidMedia: next });
    document.getElementById(`${ids.tabs}-${next}`)?.focus();
  };

  const wordCount = countWords(draft.message);

  const doodlePad = (
    <DoodlePad
      value={draft.doodle}
      onChange={(doodle) => update({ doodle })}
      shape={draft.surface.type === 'sticky' ? draft.surface.shape : null}
      label={isPolaroid ? 'Doodle area for your Polaroid' : 'Doodle area for your sticky note'}
    />
  );

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={ids.title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={handleBackdropDown}
      onPointerUp={handleBackdropUp}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 id={ids.title} className={styles.title}>
            Add your mark
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {/* 1. Surface */}
          <SurfacePicker
            value={draft.surface}
            onChange={(surface) =>
              // Choosing the Polaroid opens on the photo tab.
              update(surface.type === 'polaroid' && draft.surface.type !== 'polaroid' ? { surface, polaroidMedia: 'photo' } : { surface })
            }
          />

          {/* 2–3. Doodle, or for Polaroids a choice of doodle or photo */}
          <section className={styles.section} aria-labelledby={ids.content}>
            <div className={styles.labelGroup}>
              <h3 id={ids.content} className={styles.label}>
                {isPolaroid ? 'Doodle something or add a photo' : 'Doodle something here'}
              </h3>
              {!isPolaroid && <span className={styles.hint}>(or just leave a note)</span>}
            </div>

            {isPolaroid ? (
              <div className={styles.card}>
                <div className={styles.tabs} role="tablist" aria-label="Polaroid content">
                  {MEDIA_TABS.map((tab) => (
                    <TabCell
                      key={tab.id}
                      id={`${ids.tabs}-${tab.id}`}
                      selected={draft.polaroidMedia === tab.id}
                      aria-controls={`${ids.tabs}-panel`}
                      tabIndex={draft.polaroidMedia === tab.id ? 0 : -1}
                      onClick={() => update({ polaroidMedia: tab.id })}
                      onKeyDown={handleTabKey}
                    >
                      {tab.label}
                    </TabCell>
                  ))}
                </div>
                <div
                  id={`${ids.tabs}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${ids.tabs}-${draft.polaroidMedia}`}
                  className={styles.tabPanel}
                >
                  {draft.polaroidMedia === 'doodle' ? doodlePad : <PhotoUpload photo={draft.photo} onChange={setPhoto} />}
                </div>
              </div>
            ) : (
              <div className={styles.card}>{doodlePad}</div>
            )}

          </section>

          {/* 4. Note */}
          <section className={styles.section}>
            <div className={styles.labelRow}>
              <span className={styles.labelGroup}>
                <label htmlFor={ids.note} className={styles.label}>
                  Add a note
                </label>
                <span className={styles.hint}>{isPolaroid ? '(Optional)' : '(Optional if you’ve doodled!)'}</span>
              </span>
              <span className={styles.counter} data-over={wordCount > MAX_MESSAGE_WORDS || undefined}>
                {wordCount}/{MAX_MESSAGE_WORDS} words
              </span>
            </div>
            <textarea
              id={ids.note}
              className={styles.textarea}
              rows={3}
              value={draft.message}
              placeholder={isPolaroid ? 'Say something about it…' : 'Say hello, share a memory…'}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={`${ids.note}-help`}
              onChange={(event) => update({ message: event.target.value })}
            />
            <div id={`${ids.note}-help`}>
              {errors.message && (
                <p className={styles.error} role="alert">
                  {errors.message}
                </p>
              )}
            </div>
          </section>

          {/* 5. Name */}
          <section className={styles.section}>
            <div className={styles.labelGroup}>
              <label htmlFor={ids.name} className={styles.label}>
                Your name
              </label>
              <span className={styles.hint}>(Optional)</span>
            </div>
            <input
              id={ids.name}
              className={styles.input}
              type="text"
              autoComplete="name"
              maxLength={MAX_NAME_LENGTH}
              value={draft.name}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => update({ name: event.target.value })}
            />
            {errors.name && (
              <p className={styles.error} role="alert">
                {errors.name}
              </p>
            )}
          </section>
        </div>

        {/* 6. Done */}
        <footer className={styles.footer}>
          <Button type="submit" className={styles.submit} disabled={!canSubmit}>
            {isPolaroid ? 'Add your polaroid to the wall!' : 'Add your note to the wall!'}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
