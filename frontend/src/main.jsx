import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root');
const basename = window.location.pathname.startsWith('/SIH-2026-P2') ? '/SIH-2026-P2' : '';

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

// Force unregister any lingering service workers from previous PWA setups
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}
