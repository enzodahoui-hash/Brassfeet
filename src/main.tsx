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

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  store.installPrompt = e as unknown as typeof store.installPrompt;
  store.bump();
});
window.addEventListener('appinstalled', () => {
  store.installPrompt = null;
  store.bump();
});

// aplicativo instalável (PWA): só no site servido com o manifesto (não na versão de arquivo único nem no modo de desenvolvimento)
if (import.meta.env.PROD && 'serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
