/* eslint-disable no-restricted-globals */
import 'formdata-polyfill'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute'
import { registerRoute } from 'workbox-routing/registerRoute'
import { NetworkOnly } from 'workbox-strategies/NetworkOnly'
import * as cc from '@/misc/constants'

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
    console[fnNameToProxy] = function (msg) {
      sendMessageToAllClients(msg)
        .then(() =>
          origConsole.debug(
            `proxied console message='${msg.substring(0, 30)}...' to clients`,
          ),
        )
        .catch((err) => {
          origConsole.error('Failed to proxy console to clients', err)
        })
    }
  }
}

const queueName = 'wow-queue-v2'

const bgSyncPlugin = new BackgroundSyncPlugin(queueName, {
  maxRetentionTime: cc.swQueueMaxRetentionMinutes,
})

// FIXME need to handle error and send a "it's been queued" response. Or
// modify the caller code to suppress the error message if the uuid is
// still queued in the SW. That latter approach could be good because if
// the queue eventually gives up and refuses to retry, the UI will suddenly
// show the error.
for (const currMethod of ['POST', 'PUT']) {
  registerRoute(
    new RegExp(`${cc.facadeSendObsUrlPrefix}/.*`),
    new NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    currMethod,
  )
}

// FIXME need offline handler for this too (continued from above)
registerRoute(
  new RegExp(`${cc.apiUrlBase}/observations/.*`),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'DELETE',
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

self.addEventListener('install', function () {
  console.debug(`[SW] I'm installed!`)
  if (!self.registration.active) {
    console.debug('[SW] no existing active SW')
    self.skipWaiting()
    shouldClaimClients = true
  }
})

self.addEventListener('activate', function () {
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
self.addEventListener('message', function (event) {
  const strategies = {
    [cc.skipWaitingMsg]: () => {
      console.debug('SW is skipping waiting')
      return self.skipWaiting()
    },
    [cc.proxySwConsoleMsg]: enableSwConsoleProxy,
  }
  const strat = strategies[event.data]
  if (strat) {
    strat()
  }
})

function sendMessageToClient(client, msg) {
  return new Promise(function (resolve, reject) {
    const msgChan = new MessageChannel()
    msgChan.port1.onmessage = function (event) {
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
      noProxyConsoleDebug(`SW received message: ${clientResp}`)
    } catch (err) {
      const noProxyConsoleError = origConsole.error || console.error
      noProxyConsoleError(`Failed to send message=${msg} to client`, err)
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
