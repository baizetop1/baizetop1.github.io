/* Legacy service worker intentionally left as a no-op during the migration.
 * The new layout unregisters old registrations and clears their caches. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
    event.waitUntil(self.registration.unregister());
});
