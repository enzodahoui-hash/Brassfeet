import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { store } from './ui/store';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// gancho de testes de ponta a ponta (só com ?e2e na URL): expõe o estado do jogo ao Playwright
if (new URLSearchParams(location.search).has('e2e')) (window as unknown as { __fmbr: typeof store }).__fmbr = store;
