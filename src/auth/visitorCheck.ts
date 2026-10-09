import { GuestbookError } from '../data/errors';

/**
 * Cloudflare Turnstile, the invisible bot check that guards a visitor's
 * first (anonymous) sign-in. Off unless VITE_TURNSTILE_SITE_KEY is set.
 *
 * Use `warm()` when the composer opens so a token is ready by the time they
 * post, and `takeToken()` right before signing in. Tokens are single-use and
 * expire after five minutes, so stale ones are replaced automatically.
 */
export interface VisitorCheck {
  warm(): void;
  takeToken(): Promise<string>;
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Turnstile tokens last 300s; refresh a little early. */
const TOKEN_LIFETIME_MS = 270_000;

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptLoad = null; // allow a retry later
    throw error;
  });
  return scriptLoad;
}

const VERIFY_FAILED = 'We couldn’t verify your browser. Please try sticking it again.';

export function createVisitorCheck(siteKey: string | undefined): VisitorCheck | null {
  if (!siteKey) return null;

  let token: { value: string; at: number } | null = null;
  let running: Promise<string> | null = null;
  let widgetId: string | null = null;
  // Invisible widgets render nothing visible; the container just has to exist.
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');

  const fresh = () => token !== null && Date.now() - token.at < TOKEN_LIFETIME_MS;

  const run = () =>
    (running ??= loadTurnstile()
      .then(
        (api) =>
          new Promise<string>((resolve, reject) => {
            if (!container.isConnected) document.body.appendChild(container);
            if (widgetId) api.remove(widgetId);
            widgetId = api.render(container, {
              sitekey: siteKey,
              callback: (value: string) => {
                token = { value, at: Date.now() };
                resolve(value);
              },
              'error-callback': () => reject(new GuestbookError(VERIFY_FAILED)),
              'expired-callback': () => {
                token = null;
              },
            });
          }),
      )
      .catch((error: unknown) => {
        throw error instanceof GuestbookError ? error : new GuestbookError(VERIFY_FAILED, { cause: error });
      })
      .finally(() => {
        running = null;
      }));

  return {
    warm() {
      if (!fresh() && !running) run().catch(() => {}); // failures resurface in takeToken
    },
    async takeToken() {
      if (!fresh()) await run();
      const value = token!.value;
      token = null; // single use
      return value;
    },
  };
}
