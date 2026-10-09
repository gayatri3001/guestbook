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

/**
 * The private sign-in at /admin: email → 6-digit code → admin mode.
 * Codes only go to existing accounts, and admin powers come from the
 * database's admins list, so finding this page grants nothing.
 */
export function AdminSignIn({ repository, notAdmin, onStatus }: AdminSignInProps) {
  const ids = { title: useId(), email: useId(), code: useId() };
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await repository.sendAdminCode(email.trim());
      setStep('code');
    });
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => onStatus(await repository.verifyAdminCode(email.trim(), code.trim())));
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
          <form className={styles.form} onSubmit={sendCode}>
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
              {busy ? 'Sending…' : 'Email me a code'}
            </Button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={verify}>
            <p className={styles.text}>We sent a 6-digit code to {email.trim()}.</p>
            <label htmlFor={ids.code} className={styles.label}>
              Code
            </label>
            <input
              id={ids.code}
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" className={styles.submit} disabled={busy || code.trim().length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </Button>
            <button type="button" className={styles.link} onClick={() => setStep('email')}>
              Use a different email
            </button>
          </form>
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
