import React from 'react';

/**
 * Wraps dynamic React.lazy imports with auto-recovery and cache-busting logic.
 * If a new deployment rolls out and an old chunk hash returns 404, this catches
 * "Failed to fetch dynamically imported module" and reloads the page once
 * to retrieve the latest deployment manifest.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>,
  name: string = 'component'
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem(`retry-lazy-refreshed-${name}`) || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem(`retry-lazy-refreshed-${name}`, 'false');
      return component.default ? component : { default: component };
    } catch (error: any) {
      console.warn(`Dynamic import error loading [${name}]:`, error);

      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem(`retry-lazy-refreshed-${name}`, 'true');
        
        // Purge old cache if available so fresh HTML is retrieved
        if ('caches' in window) {
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((k) => caches.delete(k)));
          } catch (e) {
            // ignore
          }
        }
        
        window.location.reload();
        // Return a non-resolving promise so React waits for the page reload
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
