import { Plugin as BackgroundSyncPlugin } from 'workbox-background-sync/Plugin.mjs'
import { Queue } from 'workbox-background-sync/Queue.mjs'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute.mjs'
import { registerRoute } from 'workbox-routing/registerRoute.mjs'
import { NetworkOnly } from 'workbox-strategies/NetworkOnly.mjs'
import { getOrCreateInstance } from '../src/indexeddb/storage-manager.js'
import { setRecordProcessingOutcome } from '../src/indexeddb/obs-store-common'
import * as constants from '../src/misc/constants.js'

const wowSwStore = getOrCreateInstance('wow-sw')
const createTag = 'create:'
const updateTag = 'update:'
const IGNORE_REMAINING_DEPS_FLAG = 'ignoreRemainingDepReqs'

const magicMethod = 'MAGIC'
const poisonPillUrlPrefix = 'http://local.poison-pill'
const obsPutPoisonPillUrl = poisonPillUrlPrefix + '/obs-put'

let authHeaderValue = null

const depsQueue = new Queue('obs-dependant-queue', {
  maxRetentionTime: 365 * 24 * 60, // FIXME if it doesn't succeed after year, can we let it die?
  async onSync() {
    const boundFn = onSyncWithPerItemCallback.bind(this)
    await boundFn(
      async (entry, req, resp) => {
        const obsUuid = entry.metadata.obsUuid
        const obsId = entry.metadata.obsId
        switch (req.method) {
          case 'POST':
            const isProjectLinkingResp = req.url.endsWith(
              '/project_observations',
            )
            const isEndOfObsPostGroup = isProjectLinkingResp
            if (!isEndOfObsPostGroup) {
              return
            }
            console.debug(
              'resp IS a project linkage one, this marks the end of an obs',
            )
            await setRecordProcessingOutcome(obsUuid, constants.successOutcome)
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            return
          case magicMethod:
            const isEndOfObsPutGroup = req.url === obsPutPoisonPillUrl
            if (isEndOfObsPutGroup) {
              console.debug('found magic poison pill indicating end of obs PUT')
              await setRecordProcessingOutcome(
                obsUuid,
                constants.successOutcome,
              )
              await sendMessageToAllClients({
                id: constants.refreshObsMsg,
              })
              return
            }
            throw new Error(
              `Lazy programmer error: don't know how to handle ` +
                ` the magic method=${magicMethod} with url=${req.url}`,
            )
          case 'PUT':
            throw new Error(
              `Lazy programmer error: not implemented as we don't do PUTs for deps`,
            )
          case 'DELETE':
            // nothing to do
            return
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${req.method}`,
            )
        }
      },
      async (entry, resp) => {
        const obsUuid = entry.metadata.obsUuid
        const obsId = entry.metadata.obsId
        const respStatus = resp.status
        // at this point we have a choice: press on and accept that we'll be
        // missing some of the data on the remote, or rollback everything on
        // the remote and do whatever is necessary to fix it up.
        switch (entry.request.method) {
          case 'POST':
            await setRecordProcessingOutcome(
              obsUuid,
              constants.systemErrorOutcome,
            )
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            console.debug('Handling POST client error by rolling back obs')
            await obsQueue.unshiftRequest({
              metadata: {
                obsId: obsId,
                obsUuid: obsUuid,
              },
              request: new Request(
                `${constants.apiUrlBase}/observations/${obsId}`,
                {
                  method: 'DELETE',
                  mode: 'cors',
                },
              ),
            })
            return { flag: IGNORE_REMAINING_DEPS_FLAG }
          case 'PUT': // we don't update deps, we just clobber with POST
            await setRecordProcessingOutcome(
              obsUuid,
              constants.systemErrorOutcome,
            )
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            return { flag: IGNORE_REMAINING_DEPS_FLAG }
          case 'DELETE':
            if (respStatus === 404) {
              return // that's fine, the job is done
            }
            throw new Error(
              `Lazy programmer error: we don't have deps for DELETEs`,
            )
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${entry.request.method}`,
            )
        }
      },
    )
  },
})

// We don't need to register a route for /observations, etc because:
//  1. if we have a SW, we're using the synthetic bundle endpoint
//  2. fetch calls *from* the SW don't hit the routes configured *in* the SW
const obsQueue = new Queue('obs-queue', {
  maxRetentionTime: 365 * 24 * 60, // FIXME if it doesn't succeed after year, can we let it die?
  async onSync() {
    const boundFn = onSyncWithPerItemCallback.bind(this)
    await boundFn(
      async (entry, req, resp) => {
        let obsId = '(not sure)'
        try {
          const obs = await resp.json()
          obsId = obs.id
          switch (req.method) {
            case 'POST':
              await onObsPostSuccess(obs)
              break
            case 'PUT':
              await onObsPutSuccess(obs)
              break
            case 'DELETE':
              await setRecordProcessingOutcome(
                entry.metadata.obsUuid,
                constants.successOutcome,
              )
              await sendMessageToAllClients({
                id: constants.refreshObsMsg,
              })
              break
            default:
              throw new Error(
                `Programmer error: we don't know how to handle method=${req.method}`,
              )
          }
        } catch (err) {
          // an error happened while *queuing* reqs. Errors from *processing*
          // the queue will not be caught here!

          // FIXME an error that happens while trying to call onObsPostSuccess
          // (ie. this try block) will mean that we never queue up the deps for a
          // successful obs. Might need extra logic to scan obs on the remote and
          // check for pending deps, then trigger the queuing?
          console.warn(
            `Failed to queue dependents of obsId=${obsId}. This is bad.` +
              ` We do not know which, if any, deps were queued. Retrying probably` +
              ` won't help either as the error is not network related.`,
            err,
          )
          throw err
        }
      },
      async (entry, resp) => {
        const obsUuid = entry.metadata.obsUuid
        const obsId = entry.metadata.obsId
        const respStatus = resp.status
        switch (entry.request.method) {
          case 'POST':
            await setRecordProcessingOutcome(
              obsUuid,
              constants.systemErrorOutcome,
            )
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            await wowSwStore.removeItem(createTag + obsUuid)
            break
          case 'DELETE':
            if (respStatus === 404) {
              return // that's fine, the job is done
            }
            await setRecordProcessingOutcome(
              obsUuid,
              constants.systemErrorOutcome,
            )
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            break
          case 'PUT':
            await setRecordProcessingOutcome(
              obsUuid,
              constants.systemErrorOutcome,
            )
            await sendMessageToAllClients({
              id: constants.refreshObsMsg,
            })
            await wowSwStore.removeItem(updateTag + obsUuid)
            break
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${entry.request.method}`,
            )
        }
      },
    )
  },
})

function isSafeToProcessQueue() {
  const isAuthHeaderSet = !!authHeaderValue
  if (!isAuthHeaderSet) {
    console.debug(
      `Auth header='${authHeaderValue}' is not set, refusing to ` +
        'even try to replay the queue',
    )
    return false
  }
  return true
}

async function onSyncWithPerItemCallback(successCb, clientErrorCb) {
  if (!isSafeToProcessQueue()) {
    return
  }
  const obsIdsToIgnore = []
  let entry
  while ((entry = await this.shiftRequest())) {
    let resp
    try {
      const obsId = entry.metadata.obsId
      const isIgnoredObsId = obsIdsToIgnore.includes(obsId)
      if (isIgnoredObsId) {
        console.debug(
          `Ignoring deps req as it relates to an ignored obsId=${obsId}`,
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
        await successCb(entry, entry.request, null)
        continue
      }
      const req = entry.request.clone()
      req.headers.set('Authorization', authHeaderValue)
      resp = await fetch(req)
      console.debug(
        `Request for '${entry.request.url}' ` +
          `has been replayed in queue '${this._name}'`,
      )
      const statusCode = resp.status
      if (statusCode === 401) {
        // other queued reqs probably won't succeed (right now), wait for next sync
        throw (() => {
          // throwing so catch block can handle unshifting, etc
          const result = new Error(
            `Response indicates failed auth (status=${statusCode}), ` +
              `stopping now but we'll retry on next sync.`,
          )
          result.name = 'Server401Error'
          return result
        })()
      }
      const is4xxStatusCode = statusCode >= 400 && statusCode < 500
      if (is4xxStatusCode) {
        console.debug(
          `Response (status=${statusCode}) for '${resp.url}'` +
            ` indicates client error. Calling cleanup callback, then ` +
            `continuing processing the queue`,
        )
        const cbResult = await clientErrorCb(entry, resp)
        const isIgnoreDepsForId =
          cbResult && cbResult.flag === IGNORE_REMAINING_DEPS_FLAG
        if (isIgnoreDepsForId) {
          obsIdsToIgnore.push(obsId)
        }
        continue // other queued reqs may succeed
      }
      const isServerError = statusCode >= 500 && statusCode < 600
      if (isServerError) {
        // other queued reqs probably won't succeed (right now), wait for next sync
        throw (() => {
          // throwing so catch block can handle unshifting, etc
          const result = new Error(
            `Response indicates server error (status=${statusCode})`,
          )
          result.name = 'Server5xxError'
          return result
        })()
      }
    } catch (err) {
      // "Failed to fetch" lands us here. It could be a network error or a
      // non-CORS response.
      await this.unshiftRequest(entry)
      console.debug(
        `Request for '${entry.request.url}' ` +
          `failed to replay, putting it back in queue '${this._name}'.`,
      )
      // Note: we *need* to throw here to stop an immediate retry on sync.
      // Workbox does this for good reason: it needs to process items that were
      // added to the queue during the sync. It's a bit messy because the error
      // ends up as an "Uncaught (in promise)" but that's due to
      // https://github.com/GoogleChrome/workbox/blob/v4.3.1/packages/workbox-background-sync/Queue.mjs#L331.
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
      await successCb(entry, entry.request, resp)
    } catch (err) {
      console.error('Failed during callback for a queue item, re-throwing...')
      // FIXME probably shouldn't throw here. Not sure what to do. Certainly
      // log the error and perhaps continue processing the queue
      throw err
    }
  }
}

async function onObsPutSuccess(obsResp) {
  const obsUuid = obsResp.uuid
  const obsId = obsResp.id
  console.debug(
    `Running post-PUT-success block for obs UUID=${obsUuid}, ` +
      `which has ID=${obsId}`,
  )
  const key = updateTag + obsUuid
  const depsRecord = await wowSwStore.getItem(key)
  if (!depsRecord) {
    throw new Error(
      `No deps found under key='${key}'. We should always have deps!`,
    )
  }
  try {
    await processPhotosAndObsFieldCreates(depsRecord, obsUuid, obsId)
    for (const curr of depsRecord.deletedPhotoIds) {
      console.debug(`Pushing a photo DELETE, for ID=${curr}, to the queue`)
      await depsQueue.pushRequest({
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
    for (const curr of depsRecord.deletedObsFieldIds) {
      console.debug(`Pushing an obsField DELETE, for ID=${curr}, to the queue`)
      await depsQueue.pushRequest({
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
    await depsQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(obsPutPoisonPillUrl, {
        method: magicMethod,
      }),
    })
  } catch (err) {
    // Note: errors related to queue processing won't be caught here. If we're
    // connected to the network, processing will be triggered by pushing items.
    console.debug('caught error while populating queue, rethrowing...')
    throw err
  }
  console.debug(
    'Cleaning up after ourselves. All requests have been generated and ' +
      `queued up for key=${key}, so we do not need this data anymore`,
  )
  await wowSwStore.removeItem(key)
}

async function onObsPostSuccess(obsResp) {
  const obsUuid = obsResp.uuid
  const obsId = obsResp.id
  console.debug(
    `Running post-POST-success block for obs UUID=${obsUuid}, ` +
      `which has ID=${obsId}`,
  )
  const key = createTag + obsUuid
  const depsRecord = await wowSwStore.getItem(key)
  if (!depsRecord) {
    throw new Error(
      `No deps found under key='${key}'. We should always have deps!`,
    )
  }
  try {
    await processPhotosAndObsFieldCreates(depsRecord, obsUuid, obsId)
    console.debug('Pushing project linkage call to the queue')
    await depsQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(constants.apiUrlBase + '/project_observations', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          observation_id: obsId,
          project_id: depsRecord.projectId,
        }),
      }),
    })
  } catch (err) {
    // Note: errors related to queue processing won't be caught here. If we're
    // connected to the network, processing will be triggered by pushing items.
    console.debug('caught error while populating queue, rethrowing...')
    throw err
  }
  console.debug(
    'Cleaning up after ourselves. All requests have been generated and ' +
      `queued up for UUID=${obsUuid}, so we do not need this data anymore`,
  )
  await wowSwStore.removeItem(key)
}

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ url, event, params }) => {
    console.debug('Service worker processing POSTed bundle')
    setAuthHeaderFromReq(event.request)
    const formData = await event.request.formData()
    const obsRecord = JSON.parse(formData.get(constants.obsFieldName))
    const obsUuid = verifyNotImpendingDoom(obsRecord.observation.uuid)
    const projectId = formData.get(constants.projectIdFieldName)
    const depsRecord = {
      obsUuid: obsUuid,
      photos: formData.getAll(constants.photosFieldName),
      obsFields: formData
        .getAll(constants.obsFieldsFieldName)
        .map(e => JSON.parse(e)),
      projectId,
    }
    try {
      verifyDepsRecord(depsRecord)
    } catch (err) {
      return jsonResponse(
        {
          result: 'failed',
          msg: err.toString(),
        },
        400,
      )
    }
    await wowSwStore.setItem(createTag + obsUuid, depsRecord)
    try {
      await obsQueue.pushRequest({
        metadata: {
          // details used when things go wrong so we can clean up
          obsUuid: obsUuid,
        },
        request: new Request(constants.apiUrlBase + '/observations', {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(obsRecord),
        }),
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
    return jsonResponse({
      result: 'queued',
      photoCount: depsRecord.photos.length,
      obsFieldCount: depsRecord.obsFields.length,
      projectId,
    })
  },
  'POST',
)

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ url, event, params }) => {
    console.debug('Service worker processing PUTed bundle')
    setAuthHeaderFromReq(event.request)
    const formData = await event.request.formData()
    const obsRecord = JSON.parse(formData.get(constants.obsFieldName))
    const obsUuid = verifyNotImpendingDoom(obsRecord.observation.uuid)
    const obsId = verifyNotImpendingDoom(obsRecord.observation.id)
    // We could queue all the deps because we have the obsId but it's easier to
    // keep them in localForage so it's easy to clean up if anything goes wrong
    const depsRecord = {
      obsUuid: obsUuid,
      photos: formData.getAll(constants.photosFieldName),
      obsFields: formData
        .getAll(constants.obsFieldsFieldName)
        .map(e => JSON.parse(e)),
      deletedPhotoIds: formData.getAll(constants.photoIdsToDeleteFieldName),
      deletedObsFieldIds: formData.getAll(
        constants.obsFieldIdsToDeleteFieldName,
      ),
    }
    await wowSwStore.setItem(updateTag + obsUuid, depsRecord)
    try {
      await obsQueue.pushRequest({
        metadata: {
          // details used when things go wrong so we can clean up
          obsUuid: obsUuid,
          obsId: obsId,
        },
        request: new Request(`${constants.apiUrlBase}/observations/${obsId}`, {
          method: 'PUT',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(obsRecord),
        }),
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
    return jsonResponse({
      result: 'queued',
      newPhotoCount: depsRecord.photos.length,
      newObsFieldCount: depsRecord.obsFields.length,
      deletedPhotoCount: depsRecord.deletedPhotoIds.length,
      deletedObsFieldCount: depsRecord.deletedObsFieldIds.length,
    })
  },
  'PUT',
)

registerRoute(
  new RegExp(`${constants.apiUrlBase}/observations/\d*`),
  async ({ url, event, params }) => {
    setAuthHeaderFromReq(event.request)
    const obsId = parseInt(
      url.pathname.substr(url.pathname.lastIndexOf('/') + 1),
    )
    console.debug(`Extracted obs ID='${obsId}' from url=${url.pathname}`)
    await obsQueue.pushRequest({
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
  async ({ url, event, params }) => {
    return jsonResponse({
      result: 'yep',
    })
  },
  'GET',
)

// We have a separate endpoint to update the auth for the case when an obs is
// queued for upload but the auth token that would've been supplied expires
// before we get a chance to upload it. This way, we'll always have the most
// up-to-date auth to use for all items in the queue.
registerRoute(
  constants.serviceWorkerUpdateAuthHeaderUrl,
  async ({ url, event, params }) => {
    setAuthHeaderFromReq(event.request)
    return jsonResponse({
      result: 'thanks',
      suppliedAuthHeader: authHeaderValue,
    })
  },
  'POST',
)

// We don't want the SW to interfere here but if we have a mapping, calls to
// this endpoint will "wake up" the SW. This will prompt queue processing if
// required so things will get processed sooner.
registerRoute(
  new RegExp(`${constants.apiUrlBase}/observations.*cache-bust.*`),
  // TODO we could wrap the NetworkOnly strategy to do a setAuthHeaderFromReq()
  // then defer to NetworkOnly. This will help 401'd reqs in the queue get
  // going sooner.
  new NetworkOnly(),
  'GET',
)

function setAuthHeaderFromReq(req) {
  const newValue = req.headers.get('Authorization')
  if (!newValue || newValue === 'undefined' /*everything gets stringified*/) {
    console.debug(`No auth header='${newValue}' passed, leaving existing value`)
    return
  }
  authHeaderValue = newValue
}

self.addEventListener('install', function(event) {
  console.debug('SW installed!')
})

self.addEventListener('activate', function(event) {
  console.debug('SW activated!')
})

self.addEventListener('message', function(event) {
  switch (event.data) {
    case constants.syncDepsQueueMsg:
      if (depsQueue._syncInProgress) {
        // FIXME doesn't seem to work. The flag doesn't seem reliable
        console.debug('depsQueue already seems to be doing a sync')
        return
      }
      console.debug('triggering deps queue processing at request of client')
      depsQueue
        ._onSync()
        .catch(err => {
          console.warn('Manually triggered depsQueue sync has failed', err)
        })
        .finally(() => {
          event.ports[0].postMessage('triggered')
        })
      return
    case constants.syncObsQueueMsg:
      if (obsQueue._syncInProgress) {
        // FIXME doesn't seem to work. The flag doesn't seem reliable
        console.debug('obsQueue already seems to be doing a sync')
        return
      }
      console.debug('triggering obs queue processing at request of client')
      obsQueue
        ._onSync()
        .catch(err => {
          console.warn('Manually triggered obsQueue sync has failed', err)
        })
        .finally(() => {
          event.ports[0].postMessage('triggered')
        })
      return
    case constants.skipWaitingMsg:
      console.debug('SW is skipping waiting')
      return self.skipWaiting()
  }
})

function sendMessageToClient(client, msg) {
  return new Promise(function(resolve, reject) {
    const msgChan = new MessageChannel()
    msgChan.port1.onmessage = function(event) {
      if (event.data.error) {
        return reject(event.data.error)
      }
      return resolve(event.data)
    }
    client.postMessage(msg, [msgChan.port2])
  })
}

async function sendMessageToAllClients(msg) {
  const matchedClients = await clients.matchAll()
  for (let client of matchedClients) {
    try {
      const clientResp = await sendMessageToClient(client, msg)
      console.debug('SW received message: ' + clientResp)
    } catch (err) {
      console.error(`Failed to send message to client`, err)
    }
  }
}

function verifyNotImpendingDoom(val) {
  const theSkyIsNotFalling = val != null
  if (theSkyIsNotFalling) {
    return val
  }
  throw new Error(
    `Value='${val}' is null-ish, things will go wrong ` +
      'if we continue. So we are failing fast.',
  )
}

function jsonResponse(bodyObj, status = 200) {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: {
      'Content-type': 'application/json',
    },
  })
}

async function processPhotosAndObsFieldCreates(depsRecord, obsUuid, obsId) {
  for (const curr of depsRecord.photos) {
    const fd = new FormData()
    fd.append('observation_photo[observation_id]', obsId)
    fd.append('file', curr)
    console.debug('Pushing a photo to the queue')
    await depsQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(constants.apiUrlBase + '/observation_photos', {
        method: 'POST',
        mode: 'cors',
        body: fd,
      }),
    })
  }
  for (const curr of depsRecord.obsFields) {
    console.debug('Pushing an obsField to the queue')
    await depsQueue.pushRequest({
      metadata: {
        obsId: obsId,
        obsUuid: obsUuid,
      },
      request: new Request(constants.apiUrlBase + '/observation_field_values', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          observation_id: obsId,
          ...curr,
        }),
      }),
    })
  }
}

function verifyDepsRecord(depsRecord) {
  for (const curr of depsRecord.photos) {
    const isPhotoEmpty = !curr.size
    if (isPhotoEmpty) {
      throw new Error(
        `Photo with name='${curr.name}' and type='${curr.type}' ` +
          `has no size='${curr.size}'. This will cause a 422 if we were to continue.`,
      )
    }
  }
}

// build process will inject manifest into the following statement.
workboxPrecacheAndRoute([])

export const _testonly = {
  setAuthHeader(newVal) {
    authHeaderValue = newVal
  },
  isSafeToProcessQueue,
  onSyncWithPerItemCallback,
}
