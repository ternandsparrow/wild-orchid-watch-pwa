import 'formdata-polyfill'
import { expose as comlinkExpose } from 'comlink'
import _ from 'lodash'
import uuid from 'uuid/v1'
import * as cc from '@/misc/constants'
import {
  // importing this module will implicitly call sentryInit()
  deleteDbRecordById,
  getPhotoRecord,
  getRecord,
  mapObsCoreFromOurDomainOntoApi,
  mapOverObsStore,
  performMigrationsInWorker,
  registerUuidGenerator,
  registerWarnHandler,
  setRecordProcessingOutcome as setRPO,
  storeRecord,
} from '@/indexeddb/obs-store-common'
import {
  arrayBufferToBlob,
  chainedError,
  deleteWithAuth,
  getJsonNoAuth,
  namedError,
  postFormDataWithAuth,
  putFormDataWithAuth,
  recordTypeEnum as recordType,
  verifyWowDomainPhoto,
  wowIdOf,
  wowWarnMessage,
} from '@/misc/helpers'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'

registerWarnHandler(wowWarnMessage)
registerUuidGenerator(uuid)

const exposed = {
  cleanupPhotosForObs,
  deletePendingTask,
  deleteRecord,
  getData,
  getDbPhotosForObs,
  getFullSizePhotoUrl,
  getPendingTasks,
  performMigrations,
  pollForDeleteCompletion,
  processWaitingDbRecord,
  saveEditAndScheduleUpdate,
  saveNewAndScheduleUpload,
  setRecordProcessingOutcome,
}
comlinkExpose(exposed)

let thumbnailObjectUrlsInUse = []
let thumbnailObjectUrlsNoLongerInUse = []
let obsDetailObjectUrls = []

async function performMigrations() {
  await performMigrationsInWorker()
}

async function doSleep(currSleepTime) {
  await new Promise(r => setTimeout(r, currSleepTime))
  const sleepMapping = {
    '1000': 2000,
    '2000': 3000,
    '3000': 4000,
    '4000': 10000,
    '10000': 30000,
  }
  const mapping = sleepMapping[currSleepTime]
  if (mapping) {
    return mapping
  }
  const oneHour = 60 * 60 * 1000
  return Math.min(currSleepTime * 2, oneHour)
}

async function pollForDeleteCompletion(inatId, cb) {
  let nextSleepTime = 1000
  let iterationCount = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // FIXME implement
    nextSleepTime = await doSleep(nextSleepTime)
    try {
      const resp = await getJsonNoAuth(
        `${cc.facadeUrlBase}/task-status/${inatId}/delete`,
        false,
      )
      const ts = resp.taskStatus
      if (ts === 'processing') {
        console.debug(`facade says record ${inatId} still exists`)
        continue
      }
      if (ts === 'success') {
        console.debug(
          `Success after ${iterationCount} iterations, polling for DELETE ${inatId}`,
        )
        return cb(null)
      }
      throw new Error(`Unhandled taskStatus: ${ts}`)
    } catch (err) {
      // FIXME when do we keep trying and when do we give up?
      console.debug(
        `Failure after ${iterationCount} iterations, polling for DELETE ${inatId}`,
      )
      return cb(err)
    } finally {
      iterationCount += 1
    }
  }
}

async function getData() {
  const localQueueSummary = await getLocalQueueSummary()
  const uiVisibleLocalUuids = localQueueSummary
    .filter(e => !e[cc.isEventuallyDeletedFieldName])
    .map(e => e.uuid)
  thumbnailObjectUrlsNoLongerInUse = thumbnailObjectUrlsInUse
  thumbnailObjectUrlsInUse = []
  const uiVisibleLocalRecords = await getUiVisibleLocalRecords(
    uiVisibleLocalUuids,
  )
  revokeObjectUrls(thumbnailObjectUrlsNoLongerInUse)
  return {
    localQueueSummary,
    uiVisibleLocalRecords,
  }
}

async function getLocalQueueSummary() {
  const result = await mapOverObsStore(r => {
    const hasBlockedAction = !!r.wowMeta[cc.blockedActionFieldName]
    const isEventuallyDeleted = hasBlockedAction
      ? r.wowMeta[cc.blockedActionFieldName].wowMeta[cc.recordTypeFieldName] ===
        recordType('delete')
      : r.wowMeta[cc.recordTypeFieldName] === recordType('delete')
    return {
      [cc.recordTypeFieldName]: r.wowMeta[cc.recordTypeFieldName],
      [cc.isEventuallyDeletedFieldName]: isEventuallyDeleted,
      [cc.recordProcessingOutcomeFieldName]:
        r.wowMeta[cc.recordProcessingOutcomeFieldName],
      [cc.hasBlockedActionFieldName]: hasBlockedAction,
      [cc.outcomeLastUpdatedAtFieldName]:
        r.wowMeta[cc.outcomeLastUpdatedAtFieldName],
      // at time of writing, this isn't used but it's useful for debugging
      wowUpdatedAt: r.wowMeta[cc.wowUpdatedAtFieldName],
      inatId: r.inatId,
      uuid: r.uuid,
      [cc.versionFieldName]: r.wowMeta[cc.versionFieldName],
    }
  })
  return result
}

async function getUiVisibleLocalRecords(uuids) {
  console.debug('Getting list of UI visible local records')
  const promises = uuids.map(async currId => {
    const currRecord = await getRecord(currId)
    if (!currRecord) {
      const msg =
        `Could not resolve ID=${currId} to a DB record.` +
        ' Assuming it was deleted while we were busy processing.'
      wowWarnMessage(msg)
      const nothingToDoFilterMeOut = null
      return nothingToDoFilterMeOut
    }
    const thumbnailUrl = (() => {
      const photos = currRecord.photos || []
      if (!photos.length) {
        return null
      }
      // the spec (http://www.exif.org/Exif2-2.PDF) on page 27 tells us that
      // "Compressed thumbnails shall be recorded in no more than 64KB,
      // including all other data to be recorded in APP1." So if it's bigger,
      // it's *not* a thumbnail.
      const maxSizeForExifThumbnail = 64000
      const firstPhotoWithThumbnail = photos.find(e => {
        if (e.isRemote) {
          return true
        }
        const fileSize = _.get(e, 'file.data.byteLength', 0)
        const hasThumnailSizedImage =
          fileSize && fileSize < maxSizeForExifThumbnail
        return hasThumnailSizedImage
      })
      if (!firstPhotoWithThumbnail) {
        return cc.noPreviewAvailableUrl
      }
      if (firstPhotoWithThumbnail.isRemote) {
        return firstPhotoWithThumbnail.url
      }
      return mapPhotoFromDbToUi(firstPhotoWithThumbnail, u =>
        thumbnailObjectUrlsInUse.push(u),
      ).url
    })()
    const result = {
      ...currRecord,
      thumbnailUrl,
      wowMeta: {
        ...currRecord.wowMeta,
        [cc.photosToAddFieldName]: currRecord.wowMeta[
          cc.photosToAddFieldName
        ].map(p => ({
          type: p.type,
          id: p.id,
          // we'll load the photos, even if only thumbnails, when we need them.
          fileSummary: `mime=${_.get(p, 'file.mime')}, size=${_.get(
            p,
            'file.data.byteLength',
          )}`,
        })),
      },
    }
    delete result.photos // we load them when we need them
    result.geolocationAccuracy = currRecord.positional_accuracy
    delete result.positional_accuracy
    return result
  })
  const unsortedResult = (await Promise.all(promises)).filter(e => !!e)
  const sortedOldestFirst = _.sortBy(unsortedResult, ['observedAt'])
  return _.reverse(sortedOldestFirst)
}

async function getDbPhotosForObs(obsUuid) {
  try {
    const record = await getRecord(obsUuid)
    if (!record) {
      // must be a remote record
      return []
    }
    obsDetailObjectUrls = []
    return (record.photos || []).map(p => {
      return mapPhotoFromDbToUi(p, u => obsDetailObjectUrls.push(u))
    })
  } catch (err) {
    console.error('Failed to get DB photos for UUID=' + obsUuid)
    throw err
  }
}

function cleanupPhotosForObs() {
  revokeObjectUrls(obsDetailObjectUrls)
}

async function getFullSizePhotoUrl(photoUuid) {
  const record = await getPhotoRecord(photoUuid)
  const url = mintObjectUrl(record.file)
  obsDetailObjectUrls.push(url)
  return url
}

function mapPhotoFromDbToUi(p, urlCallbackFn) {
  const isRemotePhoto = p[cc.isRemotePhotoFieldName]
  if (isRemotePhoto) {
    return p
  }
  if (!p.file) {
    return {
      ...p,
      isLocalPhoto: true,
      url: cc.noPreviewAvailableUrl,
    }
  }
  const objectUrl = mintObjectUrl(p.file)
  urlCallbackFn(objectUrl)
  const result = {
    ...p,
    isLocalPhoto: true,
    url: objectUrl,
  }
  return result
}

function mintObjectUrl(blobAsArrayBuffer) {
  if (!blobAsArrayBuffer) {
    throw new Error(
      'Supplied blob is falsey/nullish, refusing to even try to use it',
    )
  }
  try {
    const blob = arrayBufferToBlob(
      blobAsArrayBuffer.data,
      blobAsArrayBuffer.mime,
    )
    return zUrl().createObjectURL(blob)
  } catch (err) {
    throw chainedError(
      // Don't get distracted, the MIME has no impact. If it fails, it's due to
      // something else, the MIME will just help you debug (hopefully)
      `Failed to mint object URL for blob with MIME='${blobAsArrayBuffer.mime}'`,
      err,
    )
  }
}

// It seems that even once you call revoke on a URL, you can still see it in
// the list of resources in the browser devtools. This MDN demo behaves like
// that:
// https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications#Example_Using_object_URLs_to_display_images.
function revokeObjectUrls(urls) {
  while (urls.length) {
    const curr = urls.shift()
    zUrl().revokeObjectURL(curr)
  }
}

function zUrl() {
  return self.webkitURL || self.URL || {}
}

async function saveNewAndScheduleUpload({ record, isDraft }) {
  try {
    const outcome = isDraft ? cc.draftOutcome : cc.waitingOutcome
    const newRecordId = uuid()
    const newPhotos = await processPhotos(record.addedPhotos)
    const enhancedRecord = Object.assign(record, {
      captive_flag: false, // it's *wild* orchid watch
      geoprivacy: 'obscured',
      photos: newPhotos,
      wowMeta: {
        [cc.recordTypeFieldName]: recordType('new'),
        [cc.recordProcessingOutcomeFieldName]: outcome,
        [cc.photosToAddFieldName]: newPhotos,
        [cc.photoIdsToDeleteFieldName]: [],
        [cc.obsFieldIdsToDeleteFieldName]: [],
        [cc.wowUpdatedAtFieldName]: new Date().toString(),
        [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
      },
      uuid: newRecordId,
    })
    delete enhancedRecord.addedPhotos
    try {
      await storeRecord(enhancedRecord)
    } catch (err) {
      const loggingSafeRecord = Object.assign({}, enhancedRecord, {
        photos: (enhancedRecord.photos || []).map(p => ({
          ...p,
          file: '(removed for logging)',
        })),
        obsFieldValues: (enhancedRecord.obsFieldValues || []).map(o => ({
          // ignore info available elsewhere. Long traces get truncated :(
          fieldId: o.fieldId,
          value: o.value,
        })),
      })
      throw chainedError(
        `Failed to write record to Db\n` +
          `record=${JSON.stringify(loggingSafeRecord)}`,
        err,
      )
    }
    return newRecordId
  } catch (err) {
    throw chainedError(`Failed to save new record to local queue.`, err)
  }
}

async function saveEditAndScheduleUpdate( // FIXME can we simplify this?
  { localQueueSummary, allRemoteObs, localRecords },
  { record, photoIdsToDelete, obsFieldIdsToDelete, isDraft },
  runStrategy = realRunStrategy,
) {
  const editedUuid = record.uuid
  if (!editedUuid) {
    throw new Error(
      'Edited record does not have UUID set, cannot continue ' +
        'as we do not know what we are editing',
    )
  }
  const outcome = isDraft ? cc.draftOutcome : cc.waitingOutcome
  try {
    const existingRemoteRecord = allRemoteObs.find(e => e.uuid === editedUuid)
    const { dbRecord, isExistingLocalRecord } = await (async () => {
      const existingLocalRecord = localRecords.find(e => e.uuid === editedUuid)
      if (!existingLocalRecord) {
        const baseForNewDbRecord = {
          inatId: existingRemoteRecord.inatId,
          uuid: editedUuid,
        }
        return { dbRecord: baseForNewDbRecord, isExistingLocalRecord: false }
      }
      const result = await getRecord(editedUuid)
      if (!result) {
        const err = new Error(
          `Failed to find record with UUID=${editedUuid} in DB. We ` +
            `refreshed right before checking the queue summary, found a ` +
            `matching record='${JSON.stringify(
              existingLocalRecord,
            )}' but then got nothing when we went to the DB. Cannot ` +
            `continue as we have no local record to update. Possibly ` +
            `another instance of this app cleaned the DB and the record ` +
            `is now on the remote but we can't guarantee that we have ` +
            `access to refresh the remote right now.`,
          // although maybe we can just read it from Vuex's persisted copy
          // to localStorage but that feels brittle.
        )
        err.name = 'NoDbRecordError'
        throw err
      }
      return { dbRecord: result, isExistingLocalRecord: true }
    })()
    if (!isExistingLocalRecord && !existingRemoteRecord) {
      throw new Error(
        'Data problem: Cannot find existing local or remote record,' +
          'cannot continue without at least one',
      )
    }
    const newPhotos = (await processPhotos(record.addedPhotos)) || []
    const photos = computePhotos(
      existingRemoteRecord,
      dbRecord,
      photoIdsToDelete,
      newPhotos,
    )
    const enhancedRecord = Object.assign(dbRecord, record, {
      photos,
      uuid: editedUuid,
      wowMeta: {
        ...dbRecord.wowMeta,
        [cc.recordTypeFieldName]: recordType('edit'),
        // warning: relies on the local device time being synchronised. If
        // the clock has drifted forward, our check for updates having
        // occurred on the remote won't work.
        [cc.wowUpdatedAtFieldName]: new Date().toString(),
        [cc.recordProcessingOutcomeFieldName]: outcome,
        [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
      },
    })
    delete enhancedRecord.addedPhotos
    try {
      const localQueueSummaryForEditTarget =
        localQueueSummary.find(e => e.uuid === enhancedRecord.uuid) || {}
      const isProcessingQueuedNow = isObsStateProcessing(
        localQueueSummaryForEditTarget[cc.recordProcessingOutcomeFieldName],
      )
      const isThisIdQueued = !!isExistingLocalRecord
      const isExistingBlockedAction =
        localQueueSummaryForEditTarget[cc.hasBlockedActionFieldName]
      const strategyKey =
        `${isProcessingQueuedNow ? '' : 'no'}processing.` +
        `${isThisIdQueued ? '' : 'no'}queued.` +
        `${isExistingBlockedAction ? '' : 'no'}existingblocked.` +
        `${existingRemoteRecord ? '' : 'no'}remote`
      console.debug(`[Edit] strategy key=${strategyKey}`)
      const strategy = (() => {
        switch (strategyKey) {
          // POSSIBLE
          case 'processing.queued.existingblocked.remote':
            // follow up edit of remote
            return upsertBlockedAction
          case 'processing.queued.existingblocked.noremote':
            // follow up edit of local-only
            return upsertBlockedAction
          case 'processing.queued.noexistingblocked.remote':
            // follow up edit of remote
            return upsertBlockedAction
          case 'processing.queued.noexistingblocked.noremote':
            // edit of local only: add blocked PUT action
            return upsertBlockedAction
          case 'noprocessing.queued.noexistingblocked.remote':
            // follow up edit of remote
            return upsertQueuedAction
          case 'noprocessing.queued.noexistingblocked.noremote':
            // follow up edit of local-only

            // edits of local-only records *need* to result in a 'new' typed
            // record so we process them with a POST. We can't PUT when
            // there's nothing to update. TODO this side-effect is hacky
            enhancedRecord.wowMeta[cc.recordTypeFieldName] = recordType('new')
            return upsertQueuedAction
          case 'noprocessing.noqueued.noexistingblocked.remote':
            // direct edit of remote
            return upsertQueuedAction
          case 'noprocessing.queued.existingblocked.remote':
          case 'noprocessing.queued.existingblocked.noremote':
            // I thought that things NOT processing cannot have a blocked
            // action, but it has happened in production. I think this is
            // because the recently introduced migration can reset obs back
            // to "noprocessing".
            return upsertBlockedAction

          default:
            // IMPOSSIBLE
            // case 'noprocessing.noqueued.noexistingblocked.noremote':
            //   // impossible if there's no remote and nothing queued
            // case 'processing.noqueued.noexistingblocked.remote':
            // case 'processing.noqueued.noexistingblocked.noremote':
            //   // anything that's processing but has nothing queued is
            //   // impossible because what is it processing if nothing is queued?
            // case 'processing.noqueued.existingblocked.remote':
            // case 'processing.noqueued.existingblocked.noremote':
            // case 'noprocessing.noqueued.existingblocked.remote':
            // case 'noprocessing.noqueued.existingblocked.noremote':
            //   // anything with noqueued and existingblocked is impossible
            //   // because we can't have a blocked action if there's nothing
            //   // queued to block it.
            throw new Error(
              `Programmer error: impossible situation with ` +
                `strategyKey=${strategyKey}`,
            )
        }
      })()
      console.debug(`[Edit] using strategy='${strategy.name}'`)
      await runStrategy(strategy, {
        record: enhancedRecord,
        photoIdsToDelete: photoIdsToDelete.filter(id => {
          const photoIsRemote = id > 0
          return photoIsRemote
        }),
        newPhotos,
        obsFieldIdsToDelete,
      })
    } catch (err) {
      const loggingSafeRecord = Object.assign({}, enhancedRecord, {
        photos: (enhancedRecord.photos || []).map(p => ({
          ...p,
          file: '(removed for logging)',
        })),
      })
      throw chainedError(
        `Failed to write record to Db with ` +
          `UUID='${editedUuid}'.\n` +
          `record=${JSON.stringify(loggingSafeRecord)}`,
        err,
      )
    }
    return wowIdOf(enhancedRecord)
  } catch (err) {
    throw chainedError(
      `Failed to save edited record with UUID='${editedUuid}'` +
        ` to local queue.`,
      err,
    )
  }
}

async function upsertQueuedAction({
  record,
  photoIdsToDelete = [],
  newPhotos = [],
  obsFieldIdsToDelete = [],
}) {
  const mergedRecord = {
    ...record,
    wowMeta: {
      ...record.wowMeta,
      [cc.photoIdsToDeleteFieldName]: (
        record.wowMeta[cc.photoIdsToDeleteFieldName] || []
      ).concat(photoIdsToDelete),
      [cc.photosToAddFieldName]: (
        record.wowMeta[cc.photosToAddFieldName] || []
      ).concat(newPhotos),
      [cc.obsFieldIdsToDeleteFieldName]: (
        record.wowMeta[cc.obsFieldIdsToDeleteFieldName] || []
      ).concat(obsFieldIdsToDelete),
    },
  }
  return storeRecord(mergedRecord)
}

async function upsertBlockedAction({
  record,
  photoIdsToDelete = [],
  newPhotos = [],
  obsFieldIdsToDelete = [],
}) {
  const key = record.uuid
  const existingStoreRecord = await getRecord(key)
  const existingBlockedActionWowMeta = _.get(
    existingStoreRecord,
    `wowMeta.${cc.blockedActionFieldName}.wowMeta`,
    {},
  )
  const mergedPhotoIdsToDelete = (
    existingBlockedActionWowMeta[cc.photoIdsToDeleteFieldName] || []
  ).concat(photoIdsToDelete)
  const mergedPhotosToAdd = (
    existingBlockedActionWowMeta[cc.photosToAddFieldName] || []
  ).concat(newPhotos)
  const mergedObsFieldIdsToDelete = (
    existingBlockedActionWowMeta[cc.obsFieldIdsToDeleteFieldName] || []
  ).concat(obsFieldIdsToDelete)
  const mergedRecord = {
    ...record, // passed record is new source of truth
    wowMeta: {
      ...existingStoreRecord.wowMeta, // don't touch wowMeta as it's being processed
      [cc.blockedActionFieldName]: {
        wowMeta: {
          ...existingBlockedActionWowMeta,
          ...record.wowMeta, // stuff from this save
          [cc.photoIdsToDeleteFieldName]: mergedPhotoIdsToDelete,
          [cc.photosToAddFieldName]: mergedPhotosToAdd,
          [cc.obsFieldIdsToDeleteFieldName]: mergedObsFieldIdsToDelete,
        },
      },
    },
  }
  return storeRecord(mergedRecord)
}

function processPhotos(photos) {
  return photos.map(curr => {
    const photo = {
      id: uuid(),
      url: '(set at render time)',
      type: curr.type,
      file: curr.file,
    }
    verifyWowDomainPhoto(photo)
    return photo
  })
}

function isObsStateProcessing(state) {
  const processingStates = [cc.beingProcessedOutcome]
  return processingStates.includes(state)
}

function deleteRecord(theUuid, inatRecordId, apiToken) {
  const doDeleteFn = deleteDbRecordById
  return _deleteRecord(theUuid, inatRecordId, apiToken, doDeleteFn)
}

async function _deleteRecord(theUuid, inatRecordId, apiToken, doDeleteFn) {
  if (!theUuid) {
    throw namedError(
      'InvalidState',
      'Tried to delete record for the selected observation but no ' +
        'observation is selected',
    )
  }
  try {
    await doDeleteFn(theUuid)
  } catch (err) {
    throw new chainedError(
      `Failed to delete local record for UUID='${theUuid}'`,
      err,
    )
  }
  const isLocalOnly = !inatRecordId && theUuid
  if (isLocalOnly) {
    const pendingTaskId = null
    console.warn('Observation is local-only, no need to contact iNat')
    return pendingTaskId
  }
  // FIXME handling failed bundle requests could be tricky. If request 1 fails,
  // but then request 2 succeeds, we don't need to retry req 1. We need a way
  // to know what the most recent request is and how many pending requests
  // there are. I guess we keep an array of these in wowMeta, so we can make
  // the decision on how to deal with fails/successes as they come in. We can
  // use timestamps as the keys and pass that to the callback fn closure. We
  // also need logic to kick off pending "polling for completion" checks on app
  // start.
  const pendingTaskId = Date.now()
  addPendingTask({
    taskId: pendingTaskId,
    inatId: inatRecordId,
    uuid: theUuid,
    [cc.recordTypeFieldName]: recordType('delete'),
  })
  // FIXME handle errors
  await deleteWithAuth(
    `${cc.apiUrlBase}/observations/${inatRecordId}`,
    apiToken,
  )
  console.debug(`DELETE ${inatRecordId} sent to iNat successfully`)
  return pendingTaskId
}

function realRunStrategy(strategyFn, ...args) {
  // only exists so we can stub it during tests
  return strategyFn(...args)
}

function computePhotos(
  existingRemoteRecord,
  dbRecord,
  photoIdsToDelete,
  newPhotos,
) {
  const existingRemotePhotos = _.get(existingRemoteRecord, 'photos', [])
  const existingLocalPhotos = _.get(
    dbRecord,
    `wowMeta.${cc.photosToAddFieldName}`,
    [],
  )
  const existingQueuedDeletes = _.get(
    dbRecord,
    `wowMeta.${cc.photoIdsToDeleteFieldName}`,
    [],
  )
  const existingBlockedLocalPhotos = _.get(
    dbRecord,
    `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photosToAddFieldName}`,
    [],
  )
  const photoDeletesFromBlockedAction = _.get(
    dbRecord,
    `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photoIdsToDeleteFieldName}`,
    [],
  )
  const allPendingPhotoDeletes = [
    ...photoIdsToDelete,
    ...existingQueuedDeletes,
    ...photoDeletesFromBlockedAction,
  ]
  const photosWithDeletesApplied = [
    ...existingRemotePhotos,
    ...existingLocalPhotos,
    ...existingBlockedLocalPhotos,
    ...newPhotos,
  ].filter(p => {
    const isPhotoDeleted = allPendingPhotoDeletes.includes(p.id)
    return !isPhotoDeleted
  })
  // note: this fixIds call is side-effecting the newPhotos items
  return fixIds(photosWithDeletesApplied)
  function fixIds(thePhotos) {
    return thePhotos.map((e, $index) => {
      const isPhotoLocalOnly = e.id < 0
      e.id = isPhotoLocalOnly ? -1 * ($index + 1) : e.id
      return e
    })
  }
}

// FIXME hook poll call that results in terminal failure, to update UI
// FIXME can we simplify the alerts around "saved but not uploaded", single and
//   double tick like WhatsApp
// FIXME need to flag when sent to SW, so we can show in the UI and know we
//   don't have to fire it off when the app loads again

async function setRecordProcessingOutcome(dbId, outcome) {
  await setRPO(dbId, outcome)
}

async function processWaitingDbRecord({ recordId, apiToken, projectId }) {
  // the DB record may be further edited while we're processing but that
  // won't affect our snapshot here
  const dbRecord = await getRecord(recordId)
  const strategies = {
    [recordType('new')]: async () => {
      const observation = await mapObsCoreFromOurDomainOntoApi(dbRecord)
      const newPhotoIds = (dbRecord.wowMeta[cc.photosToAddFieldName] || []).map(
        e => e.id,
      )
      await postFormDataWithAuth(
        `${cc.facadeSendObsUrlPrefix}/${observation.uuid}`,
        async form => {
          form.set('projectId', projectId)
          form.set(
            'observation',
            new Blob([JSON.stringify(observation)], {
              type: 'application/json',
            }),
          )
          for (const currId of newPhotoIds) {
            const photo = await getPhotoRecord(currId)
            if (!photo) {
              // FIXME is it wise to push on if a photo is missing?
              console.warn(`Could not load photo with ID=${currId}`)
              continue
            }
            const theSize = photo.file.data.byteLength
            const isPhotoEmpty = !theSize
            if (isPhotoEmpty) {
              throw new Error(
                `Photo with name='${photo.type}' and type='${photo.file.mime}' ` +
                  `has no size='${theSize}'. This will cause a 422 if we were to continue.`,
              )
            }
            form.append(
              'photos',
              new File([photo.file.data], `${photo.id}.${photo.type}`, {
                type: photo.file.mime,
              }),
            )
          }
        },
        apiToken,
      )
      console.debug('Obs create form is sent')
    },
    [recordType('edit')]: async () => {
      const observation = await mapObsCoreFromOurDomainOntoApi(dbRecord)
      const newPhotoIds = (dbRecord.wowMeta[cc.photosToAddFieldName] || []).map(
        e => e.id,
      )
      await putFormDataWithAuth(
        `${cc.facadeSendObsUrlPrefix}/${observation.uuid}`,
        async form => {
          // FIXME refactor common code with "new" strat
          form.set(
            'observation',
            new Blob([JSON.stringify(observation)], {
              type: 'application/json',
            }),
          )
          for (const currId of newPhotoIds) {
            const photo = await getPhotoRecord(currId)
            if (!photo) {
              // FIXME is it wise to push on if a photo is missing?
              console.warn(`Could not load photo with ID=${currId}`)
              continue
            }
            const theSize = photo.file.data.byteLength
            const isPhotoEmpty = !theSize
            if (isPhotoEmpty) {
              throw new Error(
                `Photo with name='${photo.type}' and type='${photo.file.mime}' ` +
                  `has no size='${theSize}'. This will cause a 422 if we were to continue.`,
              )
            }
            form.append(
              'photos',
              new File([photo.file.data], `${photo.id}.${photo.type}`, {
                type: photo.file.mime,
              }),
            )
          }
          form.set(
            cc.photoIdsToDeleteFieldName,
            JSON.stringify(dbRecord.wowMeta[cc.photoIdsToDeleteFieldName]),
          )
          form.set(
            cc.obsFieldIdsToDeleteFieldName,
            JSON.stringify(dbRecord.wowMeta[cc.obsFieldIdsToDeleteFieldName]),
          )
        },
        apiToken,
      )
      console.debug('Obs edit form is sent')
    },
  }
  const key = dbRecord.wowMeta[cc.recordTypeFieldName]
  console.debug(`DB record with UUID='${dbRecord.uuid}' is type='${key}'`)
  const strategy = strategies[key]
  if (!strategy) {
    throw new Error(`No "record strategy" for key='${key}, cannot continue`)
  }
  await strategy()
}

async function getPendingTasks() {
  // FIXME consider updating our fork of localForage
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  const raw = await metaStore.getItem(cc.pendingTasksKey)
  return raw || []
}

async function _setPendingTasks(tasks) {
  if (tasks.constructor !== Array) {
    throw new Error(`tasks param must be an array, it is ${tasks}`)
  }
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  await metaStore.setItem(cc.pendingTasksKey, tasks)
}

async function addPendingTask(task) {
  // FIXME do we have to worry about deduping for an obs ID?
  const tasks = await getPendingTasks()
  tasks.push(task)
  await _setPendingTasks(tasks)
}

async function deletePendingTask(taskId) {
  const tasks = await getPendingTasks()
  const filteredTasks = tasks.filter(t => t.taskId !== taskId)
  await _setPendingTasks(filteredTasks)
}

// eslint-disable-next-line import/prefer-default-export
export const _testonly = {
  exposed,
  getUiVisibleLocalRecords,
  upsertBlockedAction,
  upsertQueuedAction,
  _deleteRecord, // FIXME test this
}
