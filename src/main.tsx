import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createVisitorCheck } from './auth/visitorCheck';
import { createMockGuestbookRepository } from './data/mockGuestbookRepository';
import { createSupabaseGuestbookRepository } from './data/supabase/supabaseGuestbookRepository';
import './styles/global.css';

const env = import.meta.env;

// The single place the data source is chosen: Supabase when configured
// (see .env.local), otherwise the in-memory mock wall for offline work.
const useSupabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_USE_MOCK_DATA !== 'true';
const repository = useSupabase
  ? createSupabaseGuestbookRepository({ url: env.VITE_SUPABASE_URL!, publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY! })
  : createMockGuestbookRepository();

// Invisible bot check before a visitor's first sign-in (off until a site key is set).
const visitorCheck = useSupabase ? createVisitorCheck(env.VITE_TURNSTILE_SITE_KEY) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} visitorCheck={visitorCheck} />
  </StrictMode>,
);
