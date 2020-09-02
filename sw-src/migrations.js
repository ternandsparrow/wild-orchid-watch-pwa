import { setRecordProcessingOutcome } from '../src/indexeddb/obs-store-common'
import {
  chainedError,
  iterateIdb,
  wowErrorHandler,
  wowWarnHandler,
  wowWarnMessage,
} from '../src/misc/only-common-deps-helpers'
import * as constants from '../src/misc/constants'

// eslint-disable-next-line import/prefer-default-export
export async function doMigrations(context) {
  const start = Date.now()
  try {
    const updatedRecordCount = await do2020JulMigrationToBulkObsFields()
    if (updatedRecordCount) {
      // note: we don't await this as Safari/WebKit will get stuck on it. I
      // think it's because this SW can see clients but cannot send messages to
      // them. It doesn't really matter if this call doesn't work because the
      // queue processing will eventually be kicked off. It's just better UX if
      // we kick it off right away.
      context
        .triggerRefresh()
        .then(() => {
          console.debug('[SW] successfully triggered refresh on client')
        })
        .catch(err => {
          wowErrorHandler('Failed to trigger refresh on client(s) from SW', err)
        })
    }
    console.debug(
      `[SW] migrations complete, ${updatedRecordCount} observations affected`,
    )
  } catch (err) {
    if (err.isVersionError) {
      console.debug(
        `[SW] error during migration is a 'versioning' error, which means our ` +
          `migrations aren't needed.`,
      )
      return
    }
    throw chainedError('Failed during SW migrations', err)
  } finally {
    const elapsed = Date.now() - start
    console.debug(`[SW] migrations took ${elapsed} ms`)
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
    2, // hardcoding because the version we migrate *from* will never change
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
    3, // hardcoding because the version we migrate *from* will never change
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
