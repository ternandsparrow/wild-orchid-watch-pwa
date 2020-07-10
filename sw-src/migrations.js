import { setRecordProcessingOutcome } from '../src/indexeddb/obs-store-common'
import {
  chainedError,
  wowErrorHandler,
  wowWarnHandler,
  wowWarnMessage,
} from '../src/misc/only-common-deps-helpers'
import * as constants from '../src/misc/constants'

// eslint-disable-next-line import/prefer-default-export
export async function doMigrations(context) {
  try {
    const updatedRecordCount = await do2020JulMigrationToBulkObsFields()
    if (updatedRecordCount) {
      await context.triggerRefresh()
    }
    console.debug(
      `[SW] migrations complete, ${updatedRecordCount} observations affected`,
    )
  } catch (err) {
    throw chainedError('Failed during SW migrations', err)
  }
}

async function do2020JulMigrationToBulkObsFields() {
  // before this, we ran two Workbox background sync queues as we uploaded each
  // obs field value individually. Under the new system, we send all obs field
  // values and the project linkage as part of the obs request, and we've moved
  // to using a single queue. The new queue has a new name so in here we have
  // to clean up the two old queues. The most reliable method is to discard all
  // the requests and make re-start the actions under the new system.

  // see scripts/indexeddb-migration-test-fixture.js for help creating the
  // situation to manually test this migration.

  const bundleUuids = await iterateIdb(
    'wow-sw',
    2,
    'keyvaluepairs',
    cursor => {
      const key = cursor.key
      const isOldBundle = key.startsWith('create:') || key.startsWith('update:')
      if (!isOldBundle) {
        return null
      }
      const result = cursor.value.obsUuid
      const delReq = cursor.delete()
      delReq.onsuccess = () => {
        console.log(
          `[SW] IDB delete successful for old depsBundle with key=${key}`,
        )
      }
      delReq.onerror = err => {
        wowWarnHandler(
          `Failed to delete deps bundle with key=${key} while doing IDB ` +
            `migration in SW`,
          err,
        )
      }
      return result
    },
    true,
  )

  const queuedRequestUuids = await iterateIdb(
    'workbox-background-sync',
    // we get this version from
    // https://github.com/GoogleChrome/workbox/blob/v5.1.3/packages/workbox-background-sync/src/lib/QueueStore.ts#L15
    3,
    'requests',
    cursor => {
      const val = cursor.value
      const queueName = val.queueName
      const isNotTargetQueue = !['obs-dependant-queue', 'obs-queue'].includes(
        queueName,
      )
      if (isNotTargetQueue) {
        return null
      }
      const result = val.metadata.obsUuid
      const delReq = cursor.delete()
      delReq.onsuccess = () => {
        console.log(
          `[SW] IDB delete successful for old queued request for obsUuid=${result}`,
        )
      }
      delReq.onerror = err => {
        wowWarnHandler(
          `Failed to delete workbox background sync request in ` +
            `queue=${queueName} for obsUuid=${result} while doing IDB ` +
            `migration in SW`,
          err,
        )
      }
      return result
    },
    true,
  )

  const uniqueUuids = (() => {
    const stage1 = [...bundleUuids, ...queuedRequestUuids].reduce(
      (accum, curr) => {
        accum[curr] = true
        return accum
      },
      {},
    )
    return Object.keys(stage1)
  })()
  const isMigrationsHappened = !!uniqueUuids.length
  if (isMigrationsHappened) {
    wowWarnMessage(
      `[SW] migrating the folowing UUIDs to the 2020Jul format '${JSON.stringify(
        uniqueUuids,
      )}'`,
    )
  }
  for (const curr of uniqueUuids) {
    try {
      await setRecordProcessingOutcome(curr, constants.waitingOutcome)
    } catch (err) {
      // this isn't great but we can't get hung up on it, not sure what else we
      // could do. It's more important to migrate as much as possible and leave
      // the app in a working state.
      wowErrorHandler(
        'Failed to reset obs to "waiting" status, ignoring and carrying on',
        err,
      )
    }
  }
  return uniqueUuids.length
}

function iterateIdb(
  dbName,
  dbVersion,
  objectStoreName,
  cursorMapFn,
  isWrite = false,
) {
  return new Promise((resolve, reject) => {
    const connection = indexedDB.open(dbName, dbVersion)
    connection.onsuccess = e => {
      const database = e.target.result
      const mode = isWrite ? 'readwrite' : 'readonly'
      try {
        const transaction = database.transaction([objectStoreName], mode)
        const mappedItems = new Set()
        const objectStore = transaction.objectStore(objectStoreName)
        const request = objectStore.openCursor()
        request.addEventListener('success', e => {
          const cursor = e.target.result
          if (cursor) {
            const mapped = cursorMapFn(cursor)
            if (mapped) {
              mappedItems.add(mapped)
            }
            cursor.continue()
            return
          }
          const result = []
          for (const curr of mappedItems.keys()) {
            result.push(curr)
          }
          return resolve(result)
        })
        request.addEventListener('error', reject)
      } catch (err) {
        if (err.name === 'NotFoundError') {
          return resolve([])
        }
        return reject(
          chainedError(`Failed to open objectStore '${objectStoreName}'`, err),
        )
      }
    }
  })
}
