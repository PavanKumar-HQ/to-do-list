// Service Worker for Saral Life OS - Offline First
const CACHE_NAME = 'saral-cache-v9';

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

  // Handle local origin requests
  if (url.origin === location.origin) {
    // 1. Navigation requests (HTML) -> Network-First (with cache fallback) so latest deploy manifest is always fetched
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === self.registration.scope) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            const indexUrl = new URL('index.html', self.registration.scope).toString();
            return caches.match(indexUrl).then((res) => res || caches.match(self.registration.scope));
          })
      );
      return;
    }

    // 2. Static hashed chunks & assets -> Cache-first with network fallback
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
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
        });
      })
    );
  }
});

/**
 * Perform direct IndexedDB snooze or complete action inside Service Worker
 */
async function performDirectDbAction(action, entityId, entityType) {
  if (!entityId || !self.indexedDB) return;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('PersonalLifeOS_DB');
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        const nowIso = new Date().toISOString();
        const tenMinsLater = new Date(Date.now() + 10 * 60000);
        const newTime = tenMinsLater.toTimeString().slice(0, 5);
        const newDate = tenMinsLater.toISOString().split('T')[0];

        // Determine if task or reminder
        const isTask = entityType === 'task' || entityId.startsWith('task:');
        const cleanId = entityId.replace(/^task:/, '');

        if (isTask && db.objectStoreNames.contains('tasks')) {
          const tx = db.transaction(['tasks'], 'readwrite');
          const store = tx.objectStore('tasks');
          const getReq = store.get(cleanId);
          getReq.onsuccess = () => {
            const task = getReq.result;
            if (task) {
              if (action === 'complete') {
                task.status = 'completed';
                task.completedAt = nowIso;
                task.updatedAt = nowIso;
              } else if (action === 'snooze' || action === 'snooze_10m') {
                task.dueTime = newTime;
                task.dueDate = newDate;
                task.updatedAt = nowIso;
              }
              store.put(task);
            }
            resolve(true);
          };
          getReq.onerror = () => resolve(false);
        } else if (db.objectStoreNames.contains('reminders')) {
          const tx = db.transaction(['reminders'], 'readwrite');
          const store = tx.objectStore('reminders');
          const getReq = store.get(cleanId);
          getReq.onsuccess = () => {
            const reminder = getReq.result;
            if (reminder) {
              if (action === 'complete') {
                reminder.status = 'dismissed';
                reminder.updatedAt = nowIso;
              } else if (action === 'snooze' || action === 'snooze_10m') {
                reminder.status = 'snoozed';
                reminder.date = newDate;
                reminder.time = newTime;
                reminder.snoozedUntil = tenMinsLater.toISOString();
                reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
                reminder.updatedAt = nowIso;
              }
              store.put(reminder);
            }
            resolve(true);
          };
          getReq.onerror = () => resolve(false);
        } else {
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

// Native Notification Click & Action Handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const entityId = data.reminderId || data.taskId || data.id;
  const entityType = data.type || (data.taskId ? 'task' : 'reminder');
  const normalizedAction = action === 'snooze' ? 'snooze_10m' : action;

  // Background action execution
  const bgActionPromise = (normalizedAction === 'complete' || normalizedAction === 'snooze_10m')
    ? performDirectDbAction(normalizedAction, entityId, entityType)
    : Promise.resolve();

  event.waitUntil(
    bgActionPromise.then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it and post notification action message
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: normalizedAction || 'open',
              reminderId: entityId,
              data
            });
            return client.focus();
          }
        }

        // If user explicitly clicked the notification body (not a quick action like snooze or complete),
        // open the app window using the relative scope, NEVER root '/' (which breaks on GitHub Pages / subpaths)
        if (!action || action === 'open') {
          const appScopeUrl = new URL(self.registration.scope || './', self.location.origin).href;
          if (self.clients.openWindow) {
            return self.clients.openWindow(appScopeUrl);
          }
        }
      });
    })
  );
});

// Mobile Push Notification Event Handler
self.addEventListener('push', (event) => {
  let data = { title: 'Saral Reminder', body: 'You have a scheduled reminder.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Scheduled reminder alert',
    icon: './icon-512.svg',
    badge: './icon-512.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'saral-reminder',
    data: data.data || {},
    actions: [
      { action: 'complete', title: 'Complete' },
      { action: 'snooze_10m', title: 'Snooze 10m' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Saral Reminder', options));
});
