import { useId, useState, type FormEvent } from 'react';
import { userMessageFor } from '../../data/errors';
import type { AdminStatus, GuestbookRepository } from '../../data/guestbookRepository';
import { Button } from '../Button/Button';
import styles from './Admin.module.css';

interface AdminSignInProps {
  repository: GuestbookRepository;
  /** Signed in, but not on the admins list. */
  notAdmin: boolean;
  onStatus: (status: AdminStatus) => void;
}

/** An emailed link that has expired or been used lands back here with the reason in the URL. */
const linkError = new URLSearchParams(window.location.hash.slice(1)).has('error')
  ? 'That sign-in link has expired or was already used. Ask for a new one.'
  : null;

/**
 * The private sign-in at /admin: email → emailed link → admin mode.
 * Links only go to existing accounts, and admin powers come from the
 * database's admins list, so finding this page grants nothing.
 */
export function AdminSignIn({ repository, notAdmin, onStatus }: AdminSignInProps) {
  const ids = { title: useId(), email: useId() };
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(userMessageFor(cause, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const sendLink = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await repository.sendAdminLink(email.trim());
      setStep('sent');
      // Already signed in (the offline mock wall does this straight away).
      const status = await repository.getAdminStatus();
      if (status !== 'signed-out') onStatus(status);
    });
  };

  const signOut = () =>
    void run(async () => {
      await repository.signOutAdmin();
      onStatus('signed-out');
    });

  return (
    <div className={styles.backdrop}>
      <section className={styles.card} aria-labelledby={ids.title}>
        <h1 id={ids.title} className={styles.title}>
          Admin
        </h1>

        {notAdmin ? (
          <>
            <p className={styles.text}>This account isn’t an admin of the guestbook.</p>
            <Button variant="line" onClick={signOut} disabled={busy}>
              Sign out
            </Button>
          </>
        ) : step === 'email' ? (
          <form className={styles.form} onSubmit={sendLink}>
            <label htmlFor={ids.email} className={styles.label}>
              Email
            </label>
            <input
              id={ids.email}
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" className={styles.submit} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        ) : (
          <div className={styles.form}>
            <p className={styles.text}>
              We sent a sign-in link to {email.trim()}. Open it on this device and you’ll land back here, signed in.
            </p>
            <button type="button" className={styles.link} onClick={() => setStep('email')}>
              Use a different email
            </button>
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <a className={styles.link} href="/">
          Back to the guestbook
        </a>
      </section>
    </div>
  );
}
