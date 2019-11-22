import { Plugin as BackgroundSyncPlugin } from 'workbox-background-sync/Plugin.mjs'
import { Queue } from 'workbox-background-sync/Queue.mjs'
import { precacheAndRoute as workboxPrecacheAndRoute } from 'workbox-precaching/precacheAndRoute.mjs'
import { registerRoute } from 'workbox-routing/registerRoute.mjs'
import { NetworkOnly } from 'workbox-strategies/NetworkOnly.mjs'
import { getOrCreateInstance } from '../src/indexeddb/storage-manager.js'
import * as constants from '../src/misc/constants.js'

const obsStore = getOrCreateInstance('wow-sw')
const createTag = 'create:'
const updateTag = 'update:'
const IGNORE_REMAINING_DEPS_FLAG = 'ignoreRemainingDepReqs'

let authHeaderValue = null

// FIXME why is the page not refreshing when we accept the update prompt?

const depsQueue = new Queue('obs-dependant-queue', {
  maxRetentionTime: 365 * 24 * 60, // FIXME if it doesn't succeed after year, can we let it die?
  async onSync() {
    const boundFn = onSyncWithPerItemCallback.bind(this)
    await boundFn(
      async (req, resp) => {
        switch (req.method) {
          case 'POST':
            const isProjectLinkingResp = resp.url.endsWith(
              '/project_observations',
            )
            if (!isProjectLinkingResp) {
              return
            }
            console.debug(
              'resp IS a project linkage one, this marks the end of an obs',
            )
            sendMessageToAllClients({ id: constants.refreshObsMsg })
            return
          case 'PUT':
          // probably don't have to do anything
          case 'DELETE':
            // probably don't have to do anything
            throw new Error(
              `Lazy programmer error: not implemented for this demo`,
            )
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${
                req.method
              }`,
            )
        }
      },
      async (entry, resp) => {
        const uniqueId = entry.metadata.obsUniqueId
        const obsId = entry.metadata.obsId
        // at this point we have a choice: press on and accept that we'll be
        // missing some of the data on the remote, or rollback everything on
        // the remote and do whatever is necessary to fix it up.
        switch (entry.request.method) {
          case 'POST':
            sendMessageToAllClients({
              id: constants.failedToUploadObsMsg,
              msg:
                `Failed to completely create observation with ` +
                `obsId=${obsId},uniqueId=${uniqueId}`,
            })
            console.debug('Handling POST client error by rolling back obs')
            await obsQueue.unshiftRequest({
              metadata: {
                obsId: obsId,
                obsUniqueId: uniqueId,
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
          case 'PUT': // we don't really update deps, we just delete+create
            sendMessageToAllClients({
              id: constants.failedToUploadObsMsg,
              msg:
                `Failed to completely update observation with ` +
                `obsId=${obsId},uniqueId=${uniqueId}`,
            })
            return { flag: IGNORE_REMAINING_DEPS_FLAG }
          case 'DELETE':
            // if we get a client error when trying to do a deps req then we
            // don't want to delete the obs but we need to do something. It
            // could be a 404, in which case we don't have to worry. If it's a
            // 401 then it's more serious but we can't recover here.
            throw new Error(
              `Lazy programmer error: not implemented for this demo`,
            )
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${
                entry.request.method
              }`,
            )
        }
      },
    )
  },
})

// We don't need to register a route for /observations, etc because:
//  1. if we have a SW, we're using the synthetic bundle endpoint
//  2. fetch calls made *from* the SW don't hit the routes we configure
const obsQueue = new Queue('obs-queue', {
  maxRetentionTime: 365 * 24 * 60, // FIXME if it doesn't succeed after year, can we let it die?
  async onSync() {
    const boundFn = onSyncWithPerItemCallback.bind(this)
    await boundFn(
      async (req, resp) => {
        let obsId = '(not sure)'
        try {
          const obs = await resp.json()
          obsId = obs.id
          switch (req.method) {
            case 'POST':
              await onObsPostSuccess(obs)
              break
            case 'PUT':
            // we would generate all the reqs for deps
            case 'DELETE':
              sendMessageToAllClients({ id: constants.refreshObsMsg })
              break
            default:
              throw new Error(
                `Programmer error: we don't know how to handle method=${
                  req.method
                }`,
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
        switch (entry.request.method) {
          case 'POST':
            const uniqueId = entry.metadata.obsUniqueId
            sendMessageToAllClients({
              id: constants.failedToUploadObsMsg,
              msg: `Failed to completely create observation with uniqueId=${uniqueId}`,
            })
            // FIXME what if we have pending PUTs or DELETEs?
            break
            await obsStore.removeItem(createTag + uniqueId)
            break
          case 'DELETE':
            // I guess it's already been deleted
            // FIXME
            throw new Error('FIXME do we need to notify the client?')
            break
          case 'PUT':
            // FIXME make sure we don't retry this req
            throw new Error(
              'FIXME what do we do here? Notify UI, remove any pending deps reqs.',
            )
            break
          default:
            throw new Error(
              `Programmer error: we don't know how to handle method=${
                entry.request.method
              }`,
            )
        }
      },
    )
  },
})

async function onSyncWithPerItemCallback(successCb, clientErrorCb) {
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
      const req = entry.request.clone()
      req.headers.set('Authorization', authHeaderValue)
      resp = await fetch(req)
      console.log(
        `Request for '${entry.request.url}' ` +
          `has been replayed in queue '${this._name}'`,
      )
      const statusCode = resp.status
      const is4xxStatusCode = statusCode >= 400 && statusCode < 500
      if (is4xxStatusCode) {
        console.log(
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
      console.log(
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
      await successCb(entry.request, resp)
    } catch (err) {
      console.error('Failed during callback for a queue item, re-throwing...')
      // FIXME probably shouldn't throw here. Not sure what to do. Certainly
      // log the error and perhaps continue processing the queue
      throw err
    }
  }
}

async function onObsPostSuccess(obsResp) {
  // it would be nice to print a warning if there are still items in the queue.
  // For this demo, things can get crazy when this is the case.
  const obsUniqueId = obsResp.uniqueId
  const obsId = obsResp.id
  console.debug(
    `Running post-success block for obs unique ID=${obsUniqueId}, ` +
      `which has ID=${obsId}`,
  )
  // We're using localForage in the hope that webkit won't silently eat our
  // blobs. If it does, you need to reserialise them to ArrayBuffers to avoid
  // heartache.
  // https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/indexeddb-best-practices#not_everything_can_be_stored_in_indexeddb_on_all_platforms
  const depsRecord = await obsStore.getItem(createTag + obsUniqueId)
  if (!depsRecord) {
    // FIXME this is probably an error. We *always* have deps!
    console.warn(`No deps found for obsUniqueId=${obsUniqueId}`)
    return
  }
  try {
    for (const curr of depsRecord.photos) {
      const fd = new FormData()
      fd.append('obsId', obsId)
      fd.append('file', curr)
      console.debug('Pushing a photo to the queue')
      await depsQueue.pushRequest({
        metadata: {
          // details used when things go wrong so we can clean up
          obsId: obsId,
          obsUniqueId: obsUniqueId,
        },
        request: new Request(constants.apiUrlBase + '/photos', {
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
          // details used when things go wrong so we can clean up
          obsId: obsId,
          obsUniqueId: obsUniqueId,
        },
        request: new Request(constants.apiUrlBase + '/obs-fields', {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-type': 'application/json',
          },
          body: JSON.stringify({
            field: curr,
            obsId,
          }),
        }),
      })
    }
    console.debug('Pushing project linkage call to the queue')
    await depsQueue.pushRequest({
      metadata: {
        // details used when things go wrong so we can clean up
        obsId: obsId,
        obsUniqueId: obsUniqueId,
      },
      request: new Request(constants.apiUrlBase + '/project_observations', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          obsId,
          projectId: depsRecord.projectId,
        }),
      }),
    })
    // if (!depsQueue._syncInProgress) {
    //   console.debug('depsQueue is not currently processing, giving it a kick')
    //   depsQueue._onSync() // FIXME do we need to catch errors here?
    // }
  } catch (err) {
    // Note: error related to queue processing, which if we're connected to the
    // network will be triggered by pushing items, won't be caught here.
    console.debug('caught error while populating queue, rethrowing...')
    throw err
  }
  console.debug(
    'Cleaning up after ourselves. All requests have been generated and ' +
      `queued up for uniqueId=${obsUniqueId}, so we do not need this data anymore`,
  )
  await obsStore.removeItem(createTag + obsUniqueId)
}

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ url, event, params }) => {
    console.debug('Service worker processing POSTed bundle')
    const formData = await event.request.formData()
    const obs = JSON.parse(formData.get(constants.obsFieldName))
    const photos = formData.getAll(constants.photosFieldName)
    const obsFields = formData
      .getAll(constants.obsFieldsFieldName)
      .map(e => JSON.parse(e))
    const projectId = formData.get(constants.projectIdFieldName)
    await obsStore.setItem(createTag + obs.uniqueId, {
      uniqueId: obs.uniqueId,
      photos,
      obsFields,
      projectId,
    })
    try {
      await obsQueue.pushRequest({
        metadata: {
          // details used when things go wrong so we can clean up
          obsUniqueId: obs.uniqueId,
        },
        request: new Request(constants.apiUrlBase + '/observations', {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(obs),
        }),
      })
      // TODO the real sync doesn't seem to check before running so you can get
      // two threads of processing running at once; messy. If the queue has seen
      // an error, it won't start processing when we push a new request so that's
      // when this would be good.
      // if (!obsQueue._syncInProgress) {
      //   console.debug('obsQueue is not currently processing, giving it a kick')
      //   obsQueue._onSync() // FIXME do we need to catch errors here?
      // }
    } catch (err) {
      // FIXME not sure what to do here? We should probably re-throw so the
      // client knows we failed. Is it important for the client to distinguish
      // between "no SW" and "there is a SW but it failed"?
      console.error('Failed to push obs req onto queue', err)
    }
    return new Response(
      JSON.stringify({
        result: 'queued',
        photoCount: photos.length,
        obsFieldCount: obsFields.length,
        projectId,
      }),
    )
  },
  'POST',
)

registerRoute(
  constants.serviceWorkerBundleMagicUrl,
  async ({ url, event, params }) => {
    console.debug('Service worker processing PUTed bundle')
    const formData = await event.request.formData()
    const obs = JSON.parse(formData.get(constants.obsFieldName))
    // in a real system, we'd break apart the bundle in the same way as the
    // POST. We could queue all the deps because we have the obsId but it's
    // easier to keep them in localForage so it's easy to clean up if anything
    // goes wrong
    await obsStore.setItem(updateTag + obs.uniqueId, {
      uniqueId: obs.uniqueId,
      newPhotos: [],
      newObsFields: [],
      removedPhotos: [],
      removedObsFields: [],
    })
    // FIXME it's possible for the PUT to be queued while the POST is still
    // waiting. If this is the case, we should probably stash the obs PUT req
    // until we have the response from the POST. Then when we get the
    // response from the POST, we need to generate the obs PUT request. Maybe
    // if the obsId is some placeholder token then we know to wait for the
    // POST resp?
    await obsQueue.pushRequest({
      metadata: {
        // details used when things go wrong so we can clean up
        obsUniqueId: obs.uniqueId,
        obsId: obs.obsId,
      },
      request: new Request(
        `${constants.apiUrlBase}/observations/${obs.obsId}`,
        {
          method: 'PUT',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    })
    // no try-catch so if anything goes wrong, the client can deal with it
    return new Response(
      JSON.stringify({
        result: 'queued',
        // we would send back a summary of what we queued here
      }),
    )
  },
  'PUT',
)

registerRoute(
  new RegExp(`${constants.apiUrlBase}/observations/\d*`),
  async ({ url, event, params }) => {
    const obsId = url.pathname.substr(url.pathname.lastIndexOf('/') + 1)
    console.log('found id ' + obsId)
    const isObsLocalOnly = false
    if (isObsLocalOnly) {
      // FIXME if we have this ID queued, kill it and shortcircuit
      sendMessageToAllClients({ id: constants.refreshObsMsg })
      return new Response(JSON.stringify({ result: 'deleted' }))
    }
    await obsQueue.pushRequest({
      metadata: {
        obsId: obsId,
        // obsUniqueId: FIXME find this
      },
      request: new Request(`${constants.apiUrlBase}/observations/${obsId}`, {
        method: 'DELETE',
        mode: 'cors',
      }),
    })
    return new Response(JSON.stringify({ result: 'queued' }))
  },
  'DELETE',
)

registerRoute(
  constants.serviceWorkerIsAliveMagicUrl,
  async ({ url, event, params }) => {
    return new Response(
      JSON.stringify({
        result: 'yep',
      }),
    )
  },
  'GET',
)

registerRoute(
  constants.serviceWorkerUpdateAuthHeaderUrl,
  async ({ url, event, params }) => {
    authHeaderValue = event.request.headers.get('Authorization')
    return new Response(
      JSON.stringify({
        result: 'thanks',
        suppliedAuthHeader: authHeaderValue,
      }),
    )
  },
  'POST',
)

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
        console.log('depsQueue already seems to be doing a sync')
        return
      }
      console.log('triggering deps queue processing at request of client')
      depsQueue._onSync().catch(err => {
        console.warn('Manually triggered depsQueue sync has failed', err)
      })
      return
    case constants.syncObsQueueMsg:
      if (obsQueue._syncInProgress) {
        // FIXME doesn't seem to work. The flag doesn't seem reliable
        console.log('obsQueue already seems to be doing a sync')
        return
      }
      console.log('triggering obs queue processing at request of client')
      obsQueue._onSync().catch(err => {
        console.warn('Manually triggered obsQueue sync has failed', err)
      })
      return
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

function sendMessageToAllClients(msg) {
  clients.matchAll().then(clients => {
    clients.forEach(client => {
      sendMessageToClient(client, msg).then(m =>
        console.log('SW received message: ' + m),
      )
    })
  })
}

workboxPrecacheAndRoute([])
