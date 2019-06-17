workbox.core.setCacheNameDetails({prefix: 'wildorchidwatch'})

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [].concat(self.__precacheManifest || [])
workbox.precaching.suppressWarnings()
workbox.precaching.precacheAndRoute(self.__precacheManifest, {})

// Redirect to index.html if sw cannot find matching route
workbox.routing.registerNavigationRoute('/index.html', {
  /* Do not redirect routes used by firebase auth  */
  blacklist: [
    new RegExp('/__/auth/handler'),
    new RegExp('/__/auth/iframe'),
    new RegExp('/.well-known'),
  ],
})

workbox.routing.registerRoute(
  /^https:\/\/fonts/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: 'fonts.googleapis',
    plugins: [],
  }),
  'GET',
)

workbox.routing.registerRoute(
  new RegExp('^https://api.inaturalist.org/v1/.*'),
  // FIXME is cacheFirst the best choice?
  workbox.strategies.cacheFirst(),
  // FIXME consider setting an expiry or max elements in cache
)

addEventListener('message', (messageEvent) => {
  if (messageEvent.data === 'skipWaiting') return self.skipWaiting()
})
