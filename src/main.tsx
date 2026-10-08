import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createMockGuestbookRepository } from './data/mockGuestbookRepository';
import { MOCK_VIEWER_ID } from './data/mock/mockEntries';
import './styles/global.css';

// The single place the data source is chosen; swap for the Supabase repository later.
const repository = createMockGuestbookRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} viewerId={MOCK_VIEWER_ID} />
  </StrictMode>,
);
