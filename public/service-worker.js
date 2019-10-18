importScripts('./wow-env-vars.js') // written by DumpVueEnvVarsWebpackPlugin
// vars come from script imported above
const apiUrl = VUE_APP_API_BASE_URL
console.debug(`Using API URL = ${apiUrl}`)
const inatUrl = VUE_APP_INAT_BASE_URL
console.debug(`Using iNat URL = ${inatUrl}`)
const inatStaticUrl = VUE_APP_INAT_STATIC_BASE_URL
console.debug(`Using iNat static URL = ${inatStaticUrl}`)

const cachePrefix = 'wildorchidwatch'
workbox.core.setCacheNameDetails({ prefix: cachePrefix })

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [].concat(self.__precacheManifest || [])
workbox.precaching.precacheAndRoute(self.__precacheManifest, {})

// Redirect to index.html if sw cannot find matching route
workbox.routing.registerNavigationRoute('/index.html', {})

workbox.routing.registerRoute(
  /^https:\/\/fonts/,
  new workbox.strategies.CacheFirst({
    cacheName: 'fonts.googleapis',
    plugins: [],
  }),
  'GET',
)

// never cache requests for API auth tokens.
// we don't need to worry about the iNat token as that is a POST
workbox.routing.registerRoute(
  new RegExp(`^${inatUrl}/users/api_token.*`),
  new workbox.strategies.NetworkOnly(),
  'GET',
)

// Don't let service worker cache anything that's cache busting
workbox.routing.registerRoute(
  new RegExp(`^${apiUrl}/.*cache-bust.*`),
  new workbox.strategies.NetworkOnly(),
  'GET',
)

workbox.routing.registerRoute(
  new RegExp(`^${apiUrl}/.*`),
  new workbox.strategies.NetworkFirst({
    networkTimeoutSeconds: 5,
    cacheName: cachePrefix + '-inat-api',
    plugins: [],
  }),
  'GET',
)

// At the time of writing this, iNat (the Rails app) and the production CDN do
// NOT return CORS headers on images, so we can't cache them. This code is here
// in the hope that we get those headers at some stage, but in the interim, the
// browser disk cache seems to do a passable job. Actually we can cache opaque
// responses but it's a terrible idea, see
// https://cloudfour.com/thinks/when-7-kb-equals-7-mb/ for more details.
workbox.routing.registerRoute(
  new RegExp(`^${inatStaticUrl}/.*`),
  new workbox.strategies.CacheFirst({
    cacheName: cachePrefix + '-inat-static',
    plugins: [
      new workbox.expiration.Plugin({
        maxAgeSeconds: 1 * 24 * 60 * 60, // 1 day
      }),
    ],
  }),
  'GET',
)

addEventListener('message', messageEvent => {
  if (messageEvent.data === 'skipWaiting') return self.skipWaiting()
})
