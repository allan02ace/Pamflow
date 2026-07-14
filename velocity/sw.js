// Velocity Log service worker — offline support for the app shell and music library

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const VERSION = 'v1';
const PAGE_CACHE = `velocity-pages-${VERSION}`;
const ASSET_CACHE = `velocity-assets-${VERSION}`;
const MUSIC_CACHE = `velocity-music-${VERSION}`;

const { registerRoute } = workbox.routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { RangeRequestsPlugin } = workbox.rangeRequests;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Optional: let the page ask us to download the whole music library up
  // front, instead of waiting for each track to be played once.
  // Send: navigator.serviceWorker.controller.postMessage({ type: 'CACHE_ALL_MUSIC', urls: [...] })
  if (event.data && event.data.type === 'CACHE_ALL_MUSIC' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(MUSIC_CACHE).then((cache) => cache.addAll(event.data.urls))
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// The app page itself: try the network first (so you get updates), fall
// back to the cached copy the moment you're offline.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: PAGE_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// App shell: manifest, icons, fonts, the Leaflet map library/CSS.
registerRoute(
  ({ request, url }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.endsWith('manifest.json'),
  new StaleWhileRevalidate({
    cacheName: ASSET_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Music library: the first time a track is played, cache it permanently.
// Every play after that (including offline) is served from the cache.
// RangeRequestsPlugin makes seeking within a cached track work too.
registerRoute(
  ({ url }) => url.pathname.includes('/assets/music/'),
  new CacheFirst({
    cacheName: MUSIC_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200, 206] }),
      new RangeRequestsPlugin(),
    ],
  })
);
