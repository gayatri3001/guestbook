import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { DraftPhoto } from '../../domain/draft';
import { PhotoError, preparePhoto } from '../../media/preparePhoto';
import { PolaroidFrame } from '../PolaroidFrame/PolaroidFrame';
import styles from './PhotoUpload.module.css';

interface PhotoUploadProps {
  photo: DraftPhoto | null;
  /** Receives a prepared photo, or null when removed. The owner manages preview URLs. */
  onChange: (photo: DraftPhoto | null) => void;
}

/**
 * The photo picker is the Polaroid itself: an empty print to click or drop
 * a photo onto, which then shows the photo with a bin button to remove it.
 */
export function PhotoUpload({ photo, onChange }: PhotoUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'preparing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus('preparing');
    try {
      const blob = await preparePhoto(file);
      onChange({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (cause) {
      setError(cause instanceof PhotoError ? cause.message : 'Something went wrong with that photo.');
    } finally {
      setStatus('idle');
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void accept(event.target.files?.[0]);
    event.target.value = ''; // Allow choosing the same file again.
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files[0]);
  };

  const remove = () => {
    onChange(null);
    // Back to the empty print; keep keyboard focus on the picker.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className={styles.wrapper}>
      <input ref={inputRef} id={inputId} className={styles.input} type="file" accept="image/*" onChange={handleChange} />

      <PolaroidFrame className={styles.polaroid}>
        {photo ? (
          <div className={styles.print} data-filled>
            <img className={styles.image} src={photo.previewUrl} alt="Your chosen photo" />
            <span className={styles.grain} aria-hidden="true" />
            <span className={styles.innerShadow} aria-hidden="true" />
            <button type="button" className={styles.remove} aria-label="Remove photo" title="Remove photo" onClick={remove}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className={styles.print}
            data-dragging={dragging || undefined}
            aria-busy={status === 'preparing'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <span className={styles.title}>{status === 'preparing' ? 'preparing your photo…' : 'click to add photo'}</span>
            <span className={styles.subtitle}>PNG or JPG, max 10MB</span>
          </label>
        )}
      </PolaroidFrame>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
