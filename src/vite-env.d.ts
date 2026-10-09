/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://<project>.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (public) key. Never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Cloudflare Turnstile site key; the bot check is off when unset. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Set to "true" to use the in-memory mock wall instead of Supabase. */
  readonly VITE_USE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
