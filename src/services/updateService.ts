// App Update Service
// Detects Service Worker updates, version changes, and prompts the user with an Update Notification banner.

export const APP_VERSION = '1.4.2';
export const BUILD_TIMESTAMP = new Date().toISOString().split('T')[0];

const VERSION_KEY = 'lifeos_last_known_version';

export function checkForAppUpdateOnBoot(onNewVersion: (version: string) => void) {
  if (typeof window === 'undefined') return;

  const previousVersion = localStorage.getItem(VERSION_KEY);
  if (previousVersion && previousVersion !== APP_VERSION) {
    // App was recently updated
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    onNewVersion(APP_VERSION);
  } else if (!previousVersion) {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }
}

export function registerServiceWorkerUpdateListener(onUpdateAvailable: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    // Check for updates periodically every 30 minutes
    setInterval(() => {
      registration.update().catch(() => {});
    }, 1000 * 60 * 30);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready to activate!
            onUpdateAvailable();
          }
        });
      }
    });
  }).catch(() => {});

  // Listen to controllerchange (when new SW takes over)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
