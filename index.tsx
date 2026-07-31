import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PlannerProvider } from './src/context/PlannerContext';

/**
 * Take a new deploy on the first reload, not the second.
 *
 * The service worker serves the cached build while it installs the new one in the background, so a
 * plain refresh right after a deploy still runs the OLD code — measured, not assumed. That turns
 * "I refreshed and it's still broken" into a real and repeated experience. Reloading once when the
 * new worker takes control closes that gap; the guard stops it looping.
 */
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  // A tab left open all day would otherwise never look for a new build.
  const checkForUpdate = () => navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
  window.setInterval(checkForUpdate, 30 * 60_000);
  window.addEventListener('focus', checkForUpdate);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <PlannerProvider>
      <App />
    </PlannerProvider>
  </React.StrictMode>
);