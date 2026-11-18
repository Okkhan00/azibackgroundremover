import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { WorkspaceProvider } from './state/workspace';
import { registerSW } from 'virtual:pwa-register';
import { isNative } from './lib/platform';

// Installable PWA + offline cache on the web. The Android app already ships every file locally,
// so a service worker would only duplicate ~60 MB of storage there.
if (!isNative()) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
);
