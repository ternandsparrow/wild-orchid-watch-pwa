import 'formdata-polyfill'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute'
import { registerRoute } from 'workbox-routing/registerRoute'
import { NetworkOnly } from 'workbox-strategies/NetworkOnly'
import sentryInit from '@/misc/sentry-init'
import { wowErrorHandler } from '@/misc/only-common-deps-helpers'
import * as devHelpers from '@/misc/dev-helpers'
import * as cc from '@/misc/constants'

const Sentry = sentryInit('SW')

/**
 * Some situations mean we can't see console messages from the SW (sometimes we
 * can't see anything from the SW). This will send all console messages to all
 * clients (there's probably only one) where we *can* see the messages.
 */
const origConsole = {}
function enableSwConsoleProxy() {
  for (const curr of ['debug', 'info', 'warn', 'error']) {
    doProxy(curr)
  }
  origConsole.debug(
    'SW console has been proxied. You should see this in the *SW*',
  )
  console.debug(
    'SW console has been proxied. You should see this in the *client*',
  )
  function doProxy(fnNameToProxy) {
    origConsole[fnNameToProxy] = console[fnNameToProxy]
    console[fnNameToProxy] = function(msg) {
      sendMessageToAllClients(msg)
        .then(() =>
          origConsole.debug(
            `proxied console message='${msg.substring(0, 30)}...' to clients`,
          ),
        )
        .catch(err => {
          origConsole.error('Failed to proxy console to clients', err)
        })
    }
  }
}

// FIXME have to clear and remove 'wow-queue' queue from old code; and reset
// all in-flight requests

// FIXME do we want a separate reference to the queue so we can kick/clear it?
// Can we trigger the sync event with the expected tag, probably
// `workbox-background-sync:<queueName>, that is expected? Maybe we can still
// access bgSyncPlugin._queue because we don't care about TypeScript.
const bgSyncPlugin = new BackgroundSyncPlugin('wow-queue-v2', {
  maxRetentionTime: cc.swQueueMaxRetentionMinutes,
})

for (const currMethod of ['POST', 'PUT']) {
  registerRoute(
    new RegExp(`${cc.facadeSendObsUrlPrefix}/.*`),
    new NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    currMethod,
  )
}

registerRoute(
  new RegExp(`${cc.apiUrlBase}/observations/.*`),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'DELETE',
)

registerRoute(
  cc.serviceWorkerIsAliveMagicUrl,
  async () => {
    console.debug('[SW] Still alive over here!')
    return jsonResponse({
      result: new Date().toISOString(),
    })
  },
  'GET',
)

// "the web" is not *a* platform. A platform offers a controlled runtime
// environment. It's a collection of platforms. This tests some of the corner
// cases that make targeting multiple platforms a challenge. Purely for dev
// use.
registerRoute(
  cc.serviceWorkerPlatformTestUrl,
  async () => {
    console.debug('[SW] Performing platform test')
    const tests = [
      devHelpers.platformTestReqFile(),
      devHelpers.platformTestReqBlob(),
    ]
    const testResults = await Promise.all(
      tests.map(async f => ({ name: f.name, result: await f() })),
    )
    return new Response(JSON.stringify(testResults, null, 2), {
      status: 200,
    })
  },
  'POST',
)

registerRoute(
  cc.serviceWorkerUpdateErrorTrackerContextUrl,
  async ({ event }) => {
    const newContext = await event.request.json()
    const username = newContext.username
    if (username) {
      console.debug(`[SW] Updating error tracker username to '${username}'`)
      Sentry.configureScope(scope => {
        scope.setUser({ username: username })
      })
    }
    return jsonResponse({
      result: 'thanks',
      suppliedContext: newContext,
    })
  },
  'POST',
)

// We don't want the SW to interfere here but if we have a mapping, calls to
// this endpoint will "wake up" the SW. This will prompt queue processing if
// required so things will get processed sooner.
registerRoute(
  new RegExp(`${cc.apiUrlBase}/observations.*cache-bust.*`),
  new NetworkOnly(),
  'GET',
)

let shouldClaimClients = false

self.addEventListener('install', function() {
  console.debug(`[SW] I'm installed!`)
  if (!self.registration.active) {
    console.debug('[SW] no existing active SW')
    self.skipWaiting()
    shouldClaimClients = true
  }
})

self.addEventListener('activate', function() {
  console.debug(`[SW] I'm activated!`)
  if (shouldClaimClients) {
    // note: this triggers a page refresh. Eagerly claiming clients is probably
    //  not required as a first-time user to the site will need to login to iNat
    //  before they can do anything and that OAuth page navigation lets the SW
    //  claim the client. For that reason, I've left this disabled.
    // clients.claim()
  }
})

// FIXME might be able to replace this (and corresponding client side) with
// built-in workbox magic
// https://developer.chrome.com/docs/workbox/modules/workbox-window/#window-to-service-worker-communication
self.addEventListener('message', function(event) {
  switch (event.data) {
    case cc.skipWaitingMsg:
      console.debug('SW is skipping waiting')
      return self.skipWaiting()
    case cc.proxySwConsoleMsg:
      enableSwConsoleProxy()
      return
    case cc.testTriggerManualCaughtErrorMsg:
      doManualErrorTest(true)
      return
    case cc.testTriggerManualUncaughtErrorMsg:
      doManualErrorTest(false)
      return
  }
})

function doManualErrorTest(isCaught) {
  const err = new Error(
    '[Manually triggered error from /admin] thrown inside service worker',
  )
  err.httpStatus = 418
  err.name = 'ManuallyTriggeredErrorInSw'
  if (!isCaught) {
    throw err
  }
  wowErrorHandler(`Handling manually thrown error with our code`, err)
}

function sendMessageToClient(client, msg) {
  return new Promise(function(resolve, reject) {
    const msgChan = new MessageChannel()
    msgChan.port1.onmessage = function(event) {
      if (event.data.error) {
        return reject(event.data.error)
      }
      // note: it's vital that the client responds to us so this resolves. An
      // alternative is to use setTimeout to resolve if no response has been
      // received in some time frame. It's not awesome but it stops blocking
      // indefinitely.
      return resolve(event.data)
    }
    client.postMessage(msg, [msgChan.port2])
  })
}

async function sendMessageToAllClients(msg) {
  // eslint-disable-next-line no-undef
  const matchedClients = await clients.matchAll()
  for (const client of matchedClients) {
    try {
      const clientResp = await sendMessageToClient(client, msg)
      const noProxyConsoleDebug = origConsole.debug || console.debug
      noProxyConsoleDebug('SW received message: ' + clientResp)
    } catch (err) {
      const noProxyConsoleError = origConsole.error || console.error
      noProxyConsoleError(`Failed to send message=${msg} to client`, err)
      Sentry.captureException(err)
    }
  }
}

function jsonResponse(bodyObj, status = 200) {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: {
      'Content-type': 'application/json',
    },
  })
}

// build process will inject manifest into the following statement.
workboxPrecacheAndRoute(self.__WB_MANIFEST)

self.__WB_DISABLE_DEV_LOGS = !cc.isEnableWorkboxLogging
