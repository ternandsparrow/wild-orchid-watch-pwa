/* eslint-disable no-restricted-globals */
import 'formdata-polyfill'
import { Queue } from 'workbox-background-sync'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute'
import { registerRoute } from 'workbox-routing/registerRoute'
import * as cc from '@/misc/constants'
import { recordTypeEnum as recordType } from '@/misc/only-common-deps-helpers'

// kick the queue with workbox-background-sync:<queueName>
const queueName = 'wow-queue-v2'
const queue = new Queue(queueName, {
  maxRetentionTime: cc.swQueueMaxRetentionMinutes,
  onSync: async () => {
    let entry
    // eslint-disable-next-line no-cond-assign
    while ((entry = await queue.shiftRequest())) {
      const uuid = entry.request.headers.get(cc.xWowUuidHeader)
      const inatId = entry.request.headers.get(cc.xWowInatIdHeader)
      try {
        const theType = computeTaskType(entry)
        console.debug(`SW queue sending req for ${uuid}/${inatId}`)
        const resp = await fetch(entry.request.clone())
        if (resp.status !== 200) {
          // FIXME notify UI of failure 4xx/5xx outcome. Send message to mark
          // obs as error status?
        }
        const bodyJson = await resp.json()
        sendMessageToAllClients({
          msgId: cc.queueItemProcessed,
          taskDetails: {
            uuid,
            inatId,
            statusUrl: bodyJson.statusUrl,
            type: theType,
          },
        })
      } catch (error) {
        console.debug(`SW queue failed to send req for ${uuid}/${inatId}`)
        await queue.unshiftRequest(entry)
        throw new Error('queue-replay-failed')
      }
    }
  },
})

function askQueueToProcessSoon() {
  console.debug('SW queue asked to process soon')
  // there seems to be some rate limiting in effect, because it doesn't always
  // fire right away.
  return queue.registerSync()
}

function computeTaskType(entry) {
  const { method } = entry.request
  if (method === 'POST') {
    return recordType('update')
  }
  if (method === 'DELETE') {
    return recordType('delete')
  }
  throw new Error(`Unhandled method ${method}`)
}

for (const currMethod of ['POST', 'PUT']) {
  registerRoute(
    new RegExp(`${cc.facadeSendObsUrlPrefix}/.*`),
    wowBackgroundSyncHandler,
    currMethod,
  )
}

registerRoute(
  new RegExp(`${cc.apiUrlBase}/observations/.*`),
  wowBackgroundSyncHandler,
  'DELETE',
)

// the out-of-the-box Workbox background sync handler *will* queue the req when
// we're offline, but it'll return an error to the UI. This is confusing to the
// UI, so we roll our own plugin that sends a nice resp.
async function wowBackgroundSyncHandler({ event }) {
  const uuid = event.request.headers.get(cc.xWowUuidHeader)
  try {
    console.debug(`SW attempting req for ${uuid}`)
    const response = await fetch(event.request.clone())
    // this request worked, so fire the others off!
    askQueueToProcessSoon() // don't await it
    return response
  } catch (err) {
    console.warn(`SW attempted req for ${uuid} failed, queuing for later`)
    // FIXME if multiple requests for a single UUID are queued, things could
    // get weird. The first req might trigger cleanup of the local record and
    // subsequent queued reqs won't have a local record to operate against when
    // they complete.
    await queue.pushRequest({ request: event.request })
    return jsonResponse({
      status: 'resp queued in SW for later background sync',
      isQueuedInSw: true,
      errMsg: err.message,
    })
  }
}

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

self.addEventListener('message', function (event) {
  const strategies = {
    [cc.skipWaitingMsg]: () => {
      console.debug('SW is skipping waiting')
      return self.skipWaiting()
    },
    [cc.proxySwConsoleMsg]: enableSwConsoleProxy,
    [cc.swForceProcessingMsg]: askQueueToProcessSoon,
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

// build process will inject manifest into the following statement.
workboxPrecacheAndRoute(self.__WB_MANIFEST)

self.__WB_DISABLE_DEV_LOGS = !cc.isEnableWorkboxLogging
