import 'formdata-polyfill'
import * as Sentry from '@sentry/browser'
import { Queue } from 'workbox-background-sync/Queue'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute'
import { registerRoute } from 'workbox-routing/registerRoute'
import { NetworkOnly } from 'workbox-strategies/NetworkOnly'
import base64js from 'base64-js'
import { getOrCreateInstance } from '../src/indexeddb/storage-manager'
import { setRecordProcessingOutcome } from '../src/indexeddb/obs-store-common'
import {
  addPhotoIdToObsReq,
  chainedError,
  makeObsRequest,
  wowErrorHandler,
  wowWarnMessage,
} from '../src/misc/only-common-deps-helpers'
import * as devHelpers from '../src/misc/dev-helpers'
import * as constants from '../src/misc/constants'
import { doMigrations } from './migrations'

function initErrorTracker() {
  if (constants.sentryDsn === 'off') {
    console.debug('No sentry DSN provided, refusing to init Sentry in SW')
  } else {
    Sentry.init({
      dsn: constants.sentryDsn,
      release: constants.appVersion,
    })
    Sentry.configureScope(scope => {
      scope.setTag('environment', constants.deployedEnvName)
    })
  }
}
if (process.env.NODE_ENV !== 'test') {
  initErrorTracker()
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

const wowSwStore = getOrCreateInstance('wow-sw')
wowSwStore.ready().catch(err => {
  wowErrorHandler('Failed to init a localForage instance', err)
})
const IGNORE_REMAINING_REQS_FLAG = 'ignoreRemainingReqsForThisObs'

const magicMethod = 'MAGIC'
const poisonPillUrlPrefix = 'http://local.poison-pill'
const photosDonePoisonPillUrl = poisonPillUrlPrefix + '/photos-done'

let authHeaderValue = null

const wowQueue = new Queue('wow-queue', {
  maxRetentionTime: constants.swQueueMaxRetentionMinutes,
  async onSync() {
    const boundFn = onSyncWithPerItemCallback.bind(this)
    await boundFn(
      wowQueueSuccessCb,
      wowQueueClientErrorCb,
      wowQueueCallbackErrorCb,
    )
  },
})

// The queues seem really lazy. They should be eager and sync quickly but that
// doesn't seem to be the case so this is a semi-hacky workaround to make them
// more eager. It probably comes at the cost of battery life but until we
// figure out a better way, this will give the experience that users expect.
const syncPeriod = constants.swQueuePeriodicTrigger * 1000
function scheduleSync() {
  setTimeout(() => {
    wowQueue._onSync().catch(err => {
      wowErrorHandler('Periodically triggered wowQueue sync has failed', err)
    })
    scheduleSync()
  }, syncPeriod)
}
if (syncPeriod) {
  scheduleSync()
}

async function wowQueueSuccessCb(entry, resp) {
  const obsUuid = entry.metadata.obsUuid
  const strategies = [
    {
      matcher: (url, method) =>
        method === 'POST' && url.endsWith('/observation_photos'),
      action: async function handleSuccessfulObsPhoto() {
        // nothing to do, the photo is already attached to the obs
        try {
          const respBody = await resp.json()
          const newPhotoId = respBody.id
          console.debug(
            `[SW] new photo ID='${newPhotoId}' attached to existing obs with ` +
              `UUID='${obsUuid}'/inatId='${entry.metadata.obsId}'`,
          )
        } catch (err) {
          throw new chainedError(
            'Failed to read ID from successful photo upload. We are just ' +
              'going to log the ID to debug but the fact we cannot read it ' +
              'might be a cause for concern',
            err,
          )
        }
      },
    },
    {
      matcher: (url, method) => method === 'POST' && url.endsWith('/photos'),
      action: async function handleSuccessfulPhoto() {
        try {
          const respBody = await resp.json()
          const newPhotoId = respBody.id
          console.debug(
            `[SW] adding uploaded photo ID='${newPhotoId}' to obs with ` +
              `UUID='${obsUuid}'`,
          )
          const obsRecord = await wowSwStore.getItem(obsUuid)
          if (!obsRecord) {
            throw new Error(
              `SW could not find a pending obs with UUID=${obsUuid} to add a ` +
                `photo to`,
            )
          }
          addPhotoIdToObsReq(obsRecord, newPhotoId)
          await wowSwStore.setItem(obsUuid, obsRecord)
        } catch (err) {
          throw new chainedError(
            'Failed to read ID from successful photo upload and add it to ' +
              'the owning observation',
            err,
          )
        }
      },
    },
    {
      matcher: (url, method) =>
        ['POST', 'PUT', 'DELETE'].includes(method) &&
        /observations(\/\d+)?$/.test(url),
      action: async function handleSuccessfulObservation() {
        // FIXME for POST/PUT, confirm (obsResp.project_ids || []).includes(<projectId>)
        await setRecordProcessingOutcome(
          entry.metadata.obsUuid,
          constants.successOutcome,
        )
        await sendMessageToAllClients({
          id: constants.refreshObsMsg,
        })
      },
    },
    {
      matcher: (url, method) =>
        method === 'DELETE' &&
        /\/observation_(field_values|photos)\/\d+$/.test(url),
      action: async function handleSuccessfulFieldOrPhotoDelete() {
        await setRecordProcessingOutcome(
          entry.metadata.obsUuid,
          constants.successOutcome,
        )
        await sendMessageToAllClients({
          id: constants.refreshObsMsg,
        })
      },
    },
    {
      matcher: (url, method) =>
        method === magicMethod && url === photosDonePoisonPillUrl,
      action: async function handlePoisonPill() {
        await enqueueObsRequest(entry)
      },
    },
  ]
  const req = entry.request
  const strategy = strategies.find(s => s.matcher(req.url, req.method))
  if (!strategy) {
    throw new Error(
      `Programmer problem: Could not find a strategy to handle a successful ` +
        `method='${req.method}' to URL='${req.url}', cannot continue`,
    )
  }
  await strategy.action()
}

async function enqueueObsRequest(entry) {
  const obsId = entry.metadata.obsId
  const obsUuid = entry.metadata.obsUuid
  console.debug(
    '[SW] found magic poison pill indicating end of obs photos group',
  )
  const obsRecord = await wowSwStore.getItem(obsUuid)
  const httpMethod = entry.metadata.methodToUse
  if (!httpMethod) {
    throw new Error(
      `Programmer problem: Trying to queue obs request but we haven't ` +
        `been told which HTTP method to use='${httpMethod}', cannot continue`,
    )
  }
  console.debug(
    `[SW] processing obs record (UUID=${obsUuid}) with ` +
      `method='${httpMethod}'`,
  )
  const urlSuffix = (() => {
    switch (httpMethod) {
      case 'POST':
        return ''
      case 'PUT':
        return `/${obsId}`
      default:
        throw new Error(
          `Programmer problem: Unhandled "HTTP method to use"=${httpMethod}`,
        )
    }
  })()
  // yes, it's an object with a key of 0 and an array value
  if (!obsRecord.local_photos || obsRecord.local_photos[0].length === 0) {
    console.debug(
      `[SW] no new photos added, ensuring we don't lose the old ones`,
    )
    delete obsRecord.local_photos
    obsRecord.ignore_photos = true
  }
  await wowQueue.unshiftRequest({
    metadata: {
      // details used when things go wrong so we can clean up
      obsUuid: obsUuid,
      obsId: obsId,
    },
    request: new Request(constants.apiUrlBase + '/observations' + urlSuffix, {
      method: httpMethod,
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(obsRecord),
    }),
  })
  await wowSwStore.removeItem(obsUuid)
}

async function wowQueueClientErrorCb(entry, resp) {
  const obsUuid = entry.metadata.obsUuid
  const respStatus = resp.status
  switch (entry.request.method) {
    case 'DELETE':
      if (respStatus === 404) {
        await setRecordProcessingOutcome(
          entry.metadata.obsUuid,
          constants.successOutcome,
        )
        await sendMessageToAllClients({
          id: constants.refreshObsMsg,
        })
        return // that's fine, the job is done
      }
    // fall through
    case 'POST':
    // enhancement idea: you could rollback by deleting the photos that have
    // been uploaded so far.
    // fall through
    case 'PUT':
      await setRecordProcessingOutcome(obsUuid, constants.systemErrorOutcome)
      await sendMessageToAllClients({
        id: constants.refreshLocalQueueMsg,
      })
      return { flag: IGNORE_REMAINING_REQS_FLAG }
    default:
      throw new Error(
        `Programmer error: we don't know how to handle a client HTTP error ` +
          `for method=${entry.request.method} and URL=${entry.request.url}`,
      )
  }
}

async function wowQueueCallbackErrorCb(entry) {
  const strategies = [
    {
      matcher: (url, method) =>
        method === 'DELETE' && /observations\/\d+$/.test(url),
      action: async function doNothing() {
        // no IndexedDB record to clean up
        return
      },
    },
    {
      matcher: (url, method) => {
        const isObsPostOrPut =
          ['POST', 'PUT'].includes(method) && /observations(\/\d+)?$/.test(url)
        const isPhotoPost = method === 'POST' && url.endsWith('/photos')
        const isPhotoOrObsFieldDelete =
          method === 'DELETE' &&
          /\/observation_(field_values|photos)\/\d+$/.test(url)
        return isObsPostOrPut || isPhotoPost || isPhotoOrObsFieldDelete
      },
      action: async function cleanUpObservation() {
        const obsUuid = entry.metadata.obsUuid
        const key = obsUuid
        console.debug(
          `[SW] cleaning up waiting obs record with key=${key} that would ` +
            `become orphaned`,
        )
        await wowSwStore.removeItem(key)
      },
    },
  ]
  const req = entry.request
  const strategy = strategies.find(s => s.matcher(req.url, req.method))
  if (!strategy) {
    throw new Error(
      `Programmer problem: Could not find a strategy to handle a failed ` +
        `"success callback" with method='${req.method}' and URL='${req.url}', ` +
        `cannot continue`,
    )
  }
  await strategy.action()
}

function isSafeToProcessQueue() {
  const isAuthHeaderSet = !!authHeaderValue
  if (!isAuthHeaderSet) {
    console.debug(
      `[SW] Auth header='${authHeaderValue}' is not set, refusing to ` +
        'even try to replay the queue',
    )
    return false
  }
  return true
}

function isQueueSyncingNow(queue) {
  const isSyncEventSupported = 'sync' in self.registration
  return (
    (isSyncEventSupported && queue._syncInProgress) ||
    queue.wowIsSyncInProgress ||
    false
  )
}

async function onSyncWithPerItemCallback(
  successCb,
  clientErrorCb,
  callbackErrorCb, // handler for when successCb has an error
) {
  const isSyncingAlready = isQueueSyncingNow(this)
  if (!isSafeToProcessQueue() || isSyncingAlready) {
    if (isSyncingAlready) {
      console.debug(
        `[queue=${this._name}] Refusing to sync again as a sync is already running`,
      )
    }
    return
  }
  try {
    // we use our own flag in addition to the Workbox one because in browsers
    // that don't support self.registration.sync, we can't call the built-in
    // Workbox functions that keep that flag updated. Directly manipulating a
    // private field is messy too.
    this.wowIsSyncInProgress = true
    console.debug(`[queue=${this._name}] starting onSync`)
    const obsIdsToIgnore = []
    let entry
    // eslint-disable-next-line no-cond-assign
    while ((entry = await this.shiftRequest())) {
      let resp
      const obsId = entry.metadata.obsId
      const obsUuid = entry.metadata.obsUuid
      try {
        const isIgnoredObsId = obsIdsToIgnore.includes(obsId)
        if (isIgnoredObsId) {
          console.debug(
            `[SW] Discarding '${entry.request.method} ${entry.request.url}' ` +
              `request as it's parent obs id=${obsId}/uuid=${obsUuid} is in ` +
              `the ignore list`,
          )
          continue
        }
        const isLocalOnlySyntheticRequest = entry.request.url.startsWith(
          poisonPillUrlPrefix,
        )
        if (isLocalOnlySyntheticRequest) {
          console.debug(
            `Found req with url stating with '${poisonPillUrlPrefix}' ` +
              `shortcircuiting straight to the success callback, no request ` +
              `will be sent over the network`,
          )
          await successCb(entry, null)
          continue
        }
        const req = entry.request.clone()
        req.headers.set('Authorization', authHeaderValue)
        resp = await fetch(req)
        const statusCode = resp.status
        console.debug(
          `Request for '${entry.request.method} ${entry.request.url}' ` +
            `has been replayed in queue '${this._name}' with status=${statusCode}`,
        )
        if (statusCode === 401) {
          // other queued reqs probably won't succeed (right now), wait for next sync
          throw (() => {
            // throwing so catch block can handle unshifting, etc
            const result = new Error(
              `Response for '${req.method} ${req.url}' indicates failed auth ` +
                `(status=${statusCode}), stopping now but we'll retry on next ` +
                `sync. This is not really an error, everything is working as ` +
                `designed. But we have to throw to stop queue processing.`,
            )
            result.name = 'Server401Error'
            return result
          })()
        }
        const is4xxStatusCode = statusCode >= 400 && statusCode < 500
        if (is4xxStatusCode) {
          console.debug(
            `Response (status=${statusCode}) for '${resp.method} ${resp.url}'` +
              ` indicates client error. Calling cleanup callback, then ` +
              `continuing processing the queue`,
          )
          const cbResult = await clientErrorCb(entry, resp)
          const isIgnoreDepsForId =
            cbResult && cbResult.flag === IGNORE_REMAINING_REQS_FLAG
          if (isIgnoreDepsForId) {
            obsIdsToIgnore.push(obsId)
          }
          continue // other queued reqs may succeed
        }
        const isServerError = statusCode >= 500 && statusCode < 600
        if (isServerError) {
          await setRecordProcessingOutcome(
            entry.metadata.obsUuid,
            constants.systemErrorOutcome,
          )
          await sendMessageToAllClients({
            id: constants.refreshLocalQueueMsg,
          })
          // you'd think a 500 means the server is having a really bad day but
          // that's not always the case. Sending a photo it doesn't like will
          // make it explode but it'll happily accept "good" photos. We cannot
          // complete this observation but other will probably work so let's
          // push on!
          obsIdsToIgnore.push(obsId)
          continue
        }
      } catch (err) {
        // "Failed to fetch" lands us here. It could be a network error or a
        // non-CORS response.
        //---------------------------------------------------------------------
        // TODO there are errors that can be swallowed or at least dropped back
        // to warning level because they're outside our control. It's nice to
        // know how often they happen, but there's nothing we can do so we
        // don't want to cause panic by logging errors when warning will
        // suffice. Known error err.message values:
        //  - "The network connection was lost" on iOS
        if (!entry.metadata.failureCount) {
          entry.metadata.failureCount = 0
        }
        entry.metadata.failureCount += 1
        const failureCountMsgPrefix =
          `Request for '${entry.request.method} ${entry.request.url}' from ` +
          `queue '${this._name}' failed to replay for the ` +
          `${entry.metadata.failureCount} time.`
        const hasReqFailedTooManyTimes =
          entry.metadata.failureCount > constants.maxReqFailureCountInSw
        if (hasReqFailedTooManyTimes) {
          wowWarnMessage(
            `${failureCountMsgPrefix} This is over the ` +
              `${constants.maxReqFailureCountInSw} threshold so we're giving ` +
              `up on this whole obsId=${obsId}. Most recent error: ` +
              `(name=${err.name}) message=${err.message}`,
          )
          await setRecordProcessingOutcome(
            entry.metadata.obsUuid,
            constants.systemErrorOutcome,
          )
          await sendMessageToAllClients({
            id: constants.refreshLocalQueueMsg,
          })
          obsIdsToIgnore.push(obsId) // don't process anything else for this obs
          // not unshifting onto the queue as this has failed too many times!
          continue
        }
        // we have to put it back at the start of the queue as we may have
        // order dependent requests and it's hard to move them all to the end
        // of the queue
        await this.unshiftRequest(entry)
        console.debug(
          `${failureCountMsgPrefix} Putting it back at front of ` +
            `the queue '${this._name}' and stopping queue processing.`,
        )
        // Note: we *need* to throw here to stop an immediate retry on sync.
        // Workbox does this for good reason: it needs to process items that were
        // added to the queue during the sync. It's a bit messy because the error
        // ends up as an "Uncaught (in promise)" but that's due to
        // https://github.com/GoogleChrome/workbox/blob/v5.0.0/packages/workbox-background-sync/src/Queue.ts#L370.
        // Maybe should that just be a console.error/warn?
        throw (() => {
          const result = new Error(
            `Failed to replay queue '${this._name}', due to: ` + err.message,
          )
          result.name = 'QueueReplayError'
          return result
        })()
      }
      try {
        await successCb(entry, resp)
      } catch (err) {
        try {
          await callbackErrorCb(entry)
        } catch (err2) {
          wowErrorHandler(
            'Failed during error handler! Queue success callback failed and ' +
              'while calling the cleanup callback, we encountered another ' +
              'error. The original error will follow this one in the log',
            err2,
          )
          // consciously not short-circuiting here so the original error
          // handling can continue.
        }
        wowErrorHandler(
          `Failed during success callback for a queue item. Ignoring further ` +
            `queue items for obsId=${obsId}/UUID=${obsUuid}, but continuing ` +
            `with queue processing.`,
          err,
        )
        await setRecordProcessingOutcome(
          entry.metadata.obsUuid,
          constants.systemErrorOutcome,
        )
        await sendMessageToAllClients({
          id: constants.refreshLocalQueueMsg,
        })
        obsIdsToIgnore.push(obsId) // don't process anything else for this obs
        continue
      }
    }
  } finally {
    this.wowIsSyncInProgress = false
    console.debug(`[queue=${this._name}] finished onSync`)
  }
}
//
// We don't need to register routes for POST/PUT /observations because if we
// have a SW running, we're using the synthetic bundle endpoints (below).

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ event }) => {
    console.debug('[SW] processing POSTed obs bundle')
    setAuthHeaderFromReq(event.request)
    const payload = await event.request.json()
    const obsRecord = payload[constants.obsFieldName]
    let obsUuid
    try {
      obsUuid = verifyNotImpendingDoom(obsRecord.observation, 'uuid')
    } catch (err) {
      return jsonResponse(
        {
          result: 'failed',
          msg: 'Required parameters are missing. ' + err.toString(),
        },
        400,
      )
    }
    try {
      const newPhotos = payload[constants.photosFieldName]
      verifyPhotos(newPhotos)
      await processPhotosCreatesForNewObs(newPhotos, obsUuid)
      await wowQueue.pushRequest({
        metadata: {
          obsUuid: obsUuid,
          methodToUse: 'POST',
        },
        request: new Request(photosDonePoisonPillUrl, {
          method: magicMethod,
        }),
      })
      const projectId = payload[constants.projectIdFieldName]
      await wowSwStore.setItem(
        obsUuid,
        makeObsRequest(obsRecord, projectId, []),
      )
      return jsonResponse({
        result: 'queued',
        photoCount: newPhotos.length,
        projectId,
      })
    } catch (err) {
      return jsonResponse(
        {
          result: 'failed',
          msg: err.toString(),
        },
        500,
      )
    }
  },
  'POST',
)

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ event }) => {
    console.debug('[SW] processing PUTed obs bundle')
    setAuthHeaderFromReq(event.request)
    const payload = await event.request.json()
    const obsRecord = payload[constants.obsFieldName]
    let obsUuid
    let obsId
    try {
      obsUuid = verifyNotImpendingDoom(obsRecord.observation, 'uuid')
      obsId = verifyNotImpendingDoom(obsRecord.observation, 'id')
    } catch (err) {
      return jsonResponse(
        {
          result: 'failed',
          msg: 'Required parameters are missing' + err.toString(),
        },
        400,
      )
    }
    try {
      const newPhotos = payload[constants.photosFieldName]
      verifyPhotos(newPhotos)
      await processPhotosCreatesForEditObs(newPhotos, obsUuid, obsId)
      const photoIdsToDelete = payload[constants.photoIdsToDeleteFieldName]
      const obsFieldIdsToDelete =
        payload[constants.obsFieldIdsToDeleteFieldName]
      await processPhotoAndObsFieldDeletes(
        photoIdsToDelete,
        obsFieldIdsToDelete,
        obsId,
        obsUuid,
      )
      await wowQueue.pushRequest({
        metadata: {
          obsUuid: obsUuid,
          obsId: obsId,
          methodToUse: 'PUT',
        },
        request: new Request(photosDonePoisonPillUrl, {
          method: magicMethod,
        }),
      })
      const projectIsAlreadyLinked = null
      await wowSwStore.setItem(
        obsUuid,
        makeObsRequest(obsRecord, projectIsAlreadyLinked, []),
      )
      return jsonResponse({
        result: 'queued',
        newPhotoCount: newPhotos.length,
        deletedPhotoCount: photoIdsToDelete.length,
        deletedObsFieldCount: obsFieldIdsToDelete.length,
      })
    } catch (err) {
      return jsonResponse(
        {
          result: 'failed',
          msg: err.toString(),
        },
        500,
      )
    }
  },
  'PUT',
)

async function processPhotoAndObsFieldDeletes(
  photoIdsToDelete,
  obsFieldIdsToDelete,
  obsId,
  obsUuid,
) {
  for (const curr of photoIdsToDelete) {
    console.debug(`Pushing a photo DELETE, for ID=${curr}, to the queue`)
    await wowQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(
        constants.apiUrlBase + '/observation_photos/' + curr,
        {
          method: 'DELETE',
          mode: 'cors',
        },
      ),
    })
  }
  for (const curr of obsFieldIdsToDelete) {
    console.debug(`Pushing an obsField DELETE, for ID=${curr}, to the queue`)
    await wowQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(
        constants.apiUrlBase + '/observation_field_values/' + curr,
        {
          method: 'DELETE',
          mode: 'cors',
        },
      ),
    })
  }
}

registerRoute(
  new RegExp(`${constants.apiUrlBase}/observations/\\d+`),
  async ({ url, event }) => {
    setAuthHeaderFromReq(event.request)
    const obsId = parseInt(
      url.pathname.substr(url.pathname.lastIndexOf('/') + 1),
    )
    console.debug(`[SW] Extracted obs ID='${obsId}' from url=${url.pathname}`)
    await wowQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: event.request.headers.get(constants.wowUuidCustomHttpHeader),
      },
      request: new Request(`${constants.apiUrlBase}/observations/${obsId}`, {
        method: 'DELETE',
        mode: 'cors',
      }),
    })
    return jsonResponse({ result: 'queued' })
  },
  'DELETE',
)

registerRoute(
  constants.serviceWorkerIsAliveMagicUrl,
  async () => {
    console.debug('[SW] Still alive over here!')
    return jsonResponse({
      result: new Date().toISOString(),
    })
  },
  'GET',
)

registerRoute(
  constants.serviceWorkerHealthCheckUrl,
  async () => {
    console.debug('[SW] Performing a health check')
    try {
      return jsonResponse(await buildHealthcheckObj())
    } catch (err) {
      const msg = 'Failed to build SW health check result'
      wowErrorHandler(msg, err)
      return jsonResponse({ error: err.message })
    }
  },
  'GET',
)

registerRoute(
  constants.serviceWorkerObsUuidsInQueueUrl,
  async () => {
    console.debug('[SW] Building list of UUIDs present in queues')
    try {
      return jsonResponse(await getObsUuidsInQueues())
    } catch (err) {
      const msg = 'Failed to build SW list of UUIDs in queues'
      wowErrorHandler(msg, err)
      return jsonResponse({ error: err.message })
    }
  },
  'GET',
)

async function getObsUuidsInQueues() {
  const uuids = new Set()
  const wowQueueEntries = await wowQueue.getAll()
  wowQueueEntries.forEach(e => uuids.add(e.metadata.obsUuid))
  await new Promise(async (resolve, reject) => {
    try {
      await wowSwStore.iterate(
        function valueProcessor(r) {
          uuids.add(r.observation.uuid)
        },
        function doneCallback(_, err) {
          if (!err) {
            return resolve()
          }
          return reject(err)
        },
      )
    } catch (err) {
      return reject(
        chainedError('Failed to iterate wowSw IDB to collect UUIDs', err),
      )
    }
  })
  const result = [...uuids.keys()]
  return result
}

// "the web" is not *a* platform. A platform offers a controlled runtime
// environment. It's a collection of platforms. This tests some of the corner
// cases that make targeting multiple platforms a challenge. Purely for dev
// use.
registerRoute(
  constants.serviceWorkerPlatformTestUrl,
  async () => {
    console.debug('[SW] Performing platform test')
    const tests = [platformTestReqFileSw, platformTestReqBlobSw]
    const testResults = await Promise.all(
      tests.map(async f => ({ name: f.name, result: await f() })),
    )
    return new Response(JSON.stringify(testResults, null, 2), {
      status: 200,
    })
  },
  'POST',
)

function platformTestReqFileSw() {
  return devHelpers.platformTestReqFile()
}

function platformTestReqBlobSw() {
  return devHelpers.platformTestReqBlob()
}

// We have a separate endpoint to update the auth for the case when an obs is
// queued for upload but the auth token that would've been supplied expires
// before we get a chance to upload it. This way, we'll always have the most
// up-to-date auth to use for all items in the queue.
registerRoute(
  constants.serviceWorkerUpdateAuthHeaderUrl,
  async ({ event }) => {
    setAuthHeaderFromReq(event.request)
    return jsonResponse({
      result: 'thanks',
      suppliedAuthHeader: authHeaderValue,
    })
  },
  'POST',
)

registerRoute(
  constants.serviceWorkerUpdateErrorTrackerContextUrl,
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
  new RegExp(`${constants.apiUrlBase}/observations.*cache-bust.*`),
  new NetworkOnly({
    plugins: [
      {
        requestWillFetch: async ({ request }) => {
          setAuthHeaderFromReq(request)
          return request
        },
      },
    ],
  }),
  'GET',
)

// This *does not* execute the requests in the queue, it just discards them
registerRoute(
  constants.serviceWorkerClearEverythingUrl,
  async () => {
    try {
      console.debug('Clearing queue and deleting databases')
      // throw away all entries in the queue
      const wowQueueEntries = await wowQueue.getAll()
      // eslint-disable-next-line no-unused-vars
      for (const _ of wowQueueEntries) {
        await wowQueue.shiftRequest()
      }
      const localForageSizeBeforeClear = await wowSwStore.length()
      await wowSwStore.clear()
      wowSwStore.dropInstance() // no await because it's flakey. See indexeddb/storage-manager.js
      return jsonResponse({
        wowQueueEntriesDiscarded: wowQueueEntries.length,
        swStoreItemsCleared: localForageSizeBeforeClear,
      })
    } catch (err) {
      const msg = 'Failed trying to clear SW storage'
      console.error(msg, err)
      return jsonResponse(
        {
          result: 'failed',
          msg: `${msg}, caused by: ${err.toString()}`,
        },
        500,
      )
    }
  },
  'DELETE',
)

function setAuthHeaderFromReq(req) {
  const newValue = req.headers.get('Authorization')
  if (!newValue || newValue === 'undefined' /*everything gets stringified*/) {
    console.debug(
      `[SW] No auth header='${newValue}' passed, leaving existing value`,
    )
    return
  }
  console.debug(`[SW] setting auth header='${newValue}'`)
  authHeaderValue = newValue
}

let shouldClaimClients = false

self.addEventListener('install', function() {
  console.debug(`[SW] I'm installed!`)
  if (!self.registration.active) {
    console.debug('[SW] no existing active SW')
    self.skipWaiting()
    shouldClaimClients = true
  }
})

self.addEventListener('activate', function(event) {
  console.debug(`[SW] I'm activated!`)
  if (shouldClaimClients) {
    // note: this triggers a page refresh. Eagerly claiming clients is probably
    // not required as a first-time user to the site will need to login to iNat
    // before they can do anything and that OAuth page navigation lets the SW
    // claim the client. For that reason, I've left this disabled.
    // clients.claim()
  }
  event.waitUntil(
    doMigrations({
      triggerRefresh() {
        // you'd think we *can't* talk to the clients until the page has
        // refreshed and the new service worker has claimed the them, but at
        // least in Chrome it seems we can, so we can do things like this. We
        // are talking to the pre-updated page though so if you have new
        // migration code you're relying on, it won't be there yet.
        return sendMessageToAllClients({
          id: constants.triggerLocalQueueProcessingMsg,
        })
      },
    }).catch(err => {
      wowErrorHandler('Failed to perform migrations in SW', err)
    }),
  )
})

self.addEventListener('message', function(event) {
  switch (event.data) {
    case constants.syncSwWowQueueMsg:
      console.debug('[SW] triggering wowQueue processing at request of client')
      wowQueue
        ._onSync()
        .catch(err => {
          console.warn('[SW] Manually triggered wowQueue sync has failed', err)
          event.ports[0].postMessage({ error: err })
        })
        .finally(() => {
          event.ports[0].postMessage('triggered')
        })
      return
    case constants.skipWaitingMsg:
      console.debug('SW is skipping waiting')
      return self.skipWaiting()
    case constants.proxySwConsoleMsg:
      enableSwConsoleProxy()
      return
    case constants.testSendObsPhotoPostMsg:
      doObsPhotoPostTest()
      return
    case constants.testTriggerManualCaughtErrorMsg:
      doManualErrorTest(true)
      return
    case constants.testTriggerManualUncaughtErrorMsg:
      doManualErrorTest(false)
      return
  }
})

async function doObsPhotoPostTest() {
  try {
    const resp = await fetch(`${constants.apiUrlBase}/observation_photos`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        Authorization: authHeaderValue,
      },
      // TODO should probably add formdata to make it more realistic
    })
    const outcome = resp.ok
      ? 'seem ok'
      : `seems NOT ok, status=${resp.status}, statusText=${resp.statusText}`
    console.debug(`Obs photos POST req done; ${outcome}`)
  } catch (err) {
    console.error(`Failed when making POST request to obs photo endpoint`, err)
  }
}

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

function verifyNotImpendingDoom(baseObj, key) {
  const val = baseObj[key]
  const theSkyIsNotFalling = val != null
  if (theSkyIsNotFalling) {
    return val
  }
  throw (() => {
    const result = new Error(
      `${key}='${val}' is null-ish, things will go wrong ` +
        'if we continue. So we are failing fast.',
    )
    result.name = 'MissingValueError'
    return result
  })()
}

function jsonResponse(bodyObj, status = 200) {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: {
      'Content-type': 'application/json',
    },
  })
}

async function processPhotosCreatesForNewObs(photos, obsUuid) {
  for (const curr of photos) {
    const fd = new FormData()
    const photoBuffer = base64js.toByteArray(curr.data)
    // we create a File so we can encode the type of the photo in the
    // filename. Very sneaky ;)
    const theFile = new File([photoBuffer], curr.wowType, { type: curr.mime })
    fd.append('file', theFile)
    console.debug('Pushing a photo to the queue')
    await wowQueue.pushRequest({
      metadata: {
        obsUuid: obsUuid,
      },
      request: new Request(constants.apiUrlBase + '/photos', {
        method: 'POST',
        mode: 'cors',
        body: fd._blob ? fd._blob() : fd,
      }),
    })
  }
}

async function processPhotosCreatesForEditObs(photos, obsUuid, obsId) {
  for (const curr of photos) {
    const fd = new FormData()
    fd.append('observation_photo[observation_id]', obsId)
    const photoBuffer = base64js.toByteArray(curr.data)
    const theFile = new File([photoBuffer], curr.wowType, { type: curr.mime })
    fd.append('file', theFile)
    console.debug('Pushing a photo to the queue')
    await wowQueue.pushRequest({
      metadata: {
        obsUuid,
        obsId,
      },
      request: new Request(constants.apiUrlBase + '/observation_photos', {
        method: 'POST',
        mode: 'cors',
        body: fd._blob ? fd._blob() : fd,
      }),
    })
  }
}

function verifyPhotos(photos) {
  for (const curr of photos) {
    const theSize = curr.data.length
    const isPhotoEmpty = !theSize
    if (isPhotoEmpty) {
      throw new Error(
        `Photo with name='${curr.wowType}' and type='${curr.mime}' ` +
          `has no size='${theSize}'. This will cause a 422 if we were to continue.`,
      )
    }
  }
}

async function buildHealthcheckObj() {
  const wowQueueEntries = await wowQueue.getAll()
  const queueSummary = mapEntries(wowQueueEntries)
  const swStoreItems = await new Promise(async (resolve, reject) => {
    try {
      const result = []
      const valueProcessorFn = r => {
        try {
          const logFriendlyRecord = {
            ...r,
            photos:
              r.photos &&
              r.photos.map(p => {
                const data = (() => {
                  const val = p.data
                  if (!val) {
                    return val
                  }
                  if (typeof val === 'string') {
                    return `${val.substring(0, 10)}...(length=${val.length})`
                  }
                  return `(type=${typeof val})`
                })()
                return {
                  ...p,
                  data: data,
                }
              }),
          }
          result.push(logFriendlyRecord)
        } catch (err) {
          // returning non-undefined will short-circuit. We can't just throw
          // because it won't bubble up for us to handle, so we need to be a
          // bit creative like this.
          return chainedError('Failed to process a wowSw IDB record', err)
        }
      }
      await wowSwStore.iterate(valueProcessorFn, function doneCallback(_, err) {
        if (!err) {
          return resolve(result)
        }
        // if we do have an error, we've already handled it in an inner catch block
        return reject(err)
      })
    } catch (err) {
      return reject(chainedError('Failed to iterate wowSw IDB', err))
    }
  })
  return {
    authHeaderValue,
    isSafeToProcessQueue: isSafeToProcessQueue(),
    wowQueueStatus: {
      syncInProgress: isQueueSyncingNow(wowQueue),
      length: wowQueueEntries.length,
      summary: queueSummary,
      reqsWithFailuresCount: queueSummary.filter(e => e.failureCount).length,
    },
    obsRecordsWaitingOnPhotos: {
      count: swStoreItems.length,
      itemSummaries: swStoreItems,
    },
    uuidsInQueues: await getObsUuidsInQueues(),
  }
  function mapEntries(entries) {
    return entries.map(e => ({
      ...e.metadata,
      reqUrl: e.request.url,
      reqMethod: e.request.method,
    }))
  }
}

// build process will inject manifest into the following statement.
workboxPrecacheAndRoute(self.__WB_MANIFEST)

self.__WB_DISABLE_DEV_LOGS = !constants.isEnableWorkboxLogging

// eslint-disable-next-line import/prefer-default-export
export const _testonly = {
  setAuthHeader(newVal) {
    authHeaderValue = newVal
  },
  isSafeToProcessQueue,
  onSyncWithPerItemCallback,
  verifyNotImpendingDoom,
  logHealthcheck() {
    buildHealthcheckObj().then(o => {
      console.log(JSON.stringify(o, null, 2))
    })
  },
}
