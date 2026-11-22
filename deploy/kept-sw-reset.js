// Tingfinder dev: served instead of Kept's sw.js only when the device has no gate
// session. It removes the cached app shell, which otherwise answers every PWA
// navigation (also /_device/login), and reloads open windows through the network
// so the gate login appears. After login Kept registers its real worker again.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => null)));
  })());
});
