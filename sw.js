// Service Worker for Kanso PWA - Offline First
const CACHE_NAME = 'kanso-cache-v6';

self.addEventListener('install', (event) => {
  // In development, skip caching
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    self.skipWaiting();
    return;
  }
  const scope = self.registration.scope;
  const assetsToCache = [
    scope,
    new URL('index.html', scope).toString(),
    new URL('manifest.json', scope).toString(),
    new URL('icon-192.png', scope).toString(),
    new URL('icon-512.png', scope).toString(),
    new URL('icon-512.svg', scope).toString()
  ];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // In development on localhost, clear all caches and unregister
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // In development (localhost / 127.0.0.1), NEVER intercept network requests so Vite HMR is never blocked
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept Vite internal modules or node_modules
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules') || url.pathname.includes('?v=')) {
    return;
  }

  // If local origin request, try cache first, fall back to network, then offline shell
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background (stale-while-revalidate for local assets)
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {
            // Network fetch failed, cached response already served
          });
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // If navigation request fails, return cached index.html
          if (event.request.mode === 'navigate') {
            const indexUrl = new URL('index.html', self.registration.scope).toString();
            return caches.match(indexUrl).then(res => res || caches.match(self.registration.scope));
          }
        });
      })
    );
  }
});

// Native Notification Click & Action Handling (Section 37, 44)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const reminderId = event.notification.data?.reminderId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post message
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action,
            reminderId
          });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Mobile Push Notification Event Handler
self.addEventListener('push', (event) => {
  let data = { title: 'Kanso Reminder', body: 'You have a scheduled reminder.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Scheduled reminder alert',
    icon: '/icon-512.svg',
    badge: '/icon-512.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'life-os-reminder',
    data: data.data || {},
    actions: [
      { action: 'complete', title: 'Complete' },
      { action: 'snooze', title: 'Snooze 10m' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
