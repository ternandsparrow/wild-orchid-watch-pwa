importScripts('./wow-env-vars.js') // written by DumpVueEnvVarsWebpackPlugin
// vars come from script imported above
const apiUrl = VUE_APP_API_BASE_URL
console.debug(`Using API URL = ${apiUrl}`)
const inatUrl = VUE_APP_INAT_BASE_URL
console.debug(`Using iNat URL = ${inatUrl}`)
const inatStaticUrl = VUE_APP_INAT_STATIC_BASE_URL
console.debug(`Using iNat static URL = ${inatStaticUrl}`)

workbox.core.setCacheNameDetails({ prefix: 'wildorchidwatch' })

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
  `${inatUrl}/users/api_token`,
  new workbox.strategies.NetworkOnly(),
  'GET',
)

workbox.routing.registerRoute(
  new RegExp(`^${apiUrl}/.*`),
  new workbox.strategies.NetworkFirst({
    networkTimeoutSeconds: 10,
  }),
  'GET',
)

workbox.routing.registerRoute(
  new RegExp(`^${inatUrl}/.*`),
  new workbox.strategies.CacheFirst({
    // TODO is this relevant? If so, do we want it?
    // plugins: [
    //   new workbox.expiration.Plugin({
    //     maxEntries: 100, // TODO is this enough?
    //     maxAgeSeconds: 60 * 60, // 1 hour
    //   }),
    // ],
  }),
  'GET',
)

const isStaticServerDifferent = inatUrl !== inatStaticUrl
if (isStaticServerDifferent) {
  workbox.routing.registerRoute(
    new RegExp(`^${inatStaticUrl}/.*`),
    new workbox.strategies.CacheFirst(),
    'GET',
  )
}

addEventListener('message', messageEvent => {
  if (messageEvent.data === 'skipWaiting') return self.skipWaiting()
})
