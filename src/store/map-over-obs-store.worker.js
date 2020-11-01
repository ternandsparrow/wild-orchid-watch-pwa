import { expose as comlinkExpose } from 'comlink'
import uuid from 'uuid/v1'
import * as constants from '@/misc/constants'
import {
  deleteDbRecordById,
  getRecord,
  mapOverObsStore,
  storeRecord,
} from '@/indexeddb/obs-store-common'
import {
  arrayBufferToBlob,
  blobToArrayBuffer,
  chainedError,
  namedError,
  recordTypeEnum as recordType,
  verifyWowDomainPhoto,
  wowIdOf,
  wowWarnMessage,
} from '@/misc/helpers'

const exposed = {
  cleanupPhotosForObs,
  deleteSelectedLocalRecord,
  deleteSelectedRecord,
  getData,
  getDbPhotosForObs,
  saveEditAndScheduleUpdate,
  saveNewAndScheduleUpload,
}
comlinkExpose(exposed)

let thumbnailObjectUrlsInUse = []
let thumbnailObjectUrlsNoLongerInUse = []
let obsDetailObjectUrls = []

async function getData() {
  const localQueueSummary = await getLocalQueueSummary()
  const uiVisibleLocalUuids = localQueueSummary
    .filter(e => !e[constants.isEventuallyDeletedFieldName])
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
    const hasBlockedAction = !!r.wowMeta[constants.blockedActionFieldName]
    const isEventuallyDeleted = hasBlockedAction
      ? r.wowMeta[constants.blockedActionFieldName].wowMeta[
          constants.recordTypeFieldName
        ] === recordType('delete')
      : r.wowMeta[constants.recordTypeFieldName] === recordType('delete')
    return {
      [constants.recordTypeFieldName]: r.wowMeta[constants.recordTypeFieldName],
      [constants.isEventuallyDeletedFieldName]: isEventuallyDeleted,
      [constants.recordProcessingOutcomeFieldName]:
        r.wowMeta[constants.recordProcessingOutcomeFieldName],
      [constants.hasBlockedActionFieldName]: hasBlockedAction,
      [constants.outcomeLastUpdatedAtFieldName]:
        r.wowMeta[constants.outcomeLastUpdatedAtFieldName],
      // at time of writing, this isn't used but it's useful for debugging
      wowUpdatedAt: r.wowMeta[constants.wowUpdatedAtFieldName],
      inatId: r.inatId,
      uuid: r.uuid,
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
    let thumbnailUrl
    const photos = currRecord.photos || []
    if (photos.length) {
      thumbnailUrl = mapPhotoFromDbToUi(photos[0], u =>
        thumbnailObjectUrlsInUse.push(u),
      ).url
    }
    const result = {
      ...currRecord,
      thumbnailUrl,
      wowMeta: {
        ...currRecord.wowMeta,
        [constants.photosToAddFieldName]: currRecord.wowMeta[
          constants.photosToAddFieldName
        ].map(p => ({
          // we don't need ArrayBuffers of photos in memory, slowing things down
          type: p.type,
          id: p.id,
          fileSummary: `mime=${p.file.mime}, size=${p.file.data.byteLength}`,
        })),
      },
    }
    delete result.photos // we load them when we need them
    result.geolocationAccuracy = currRecord.positional_accuracy
    delete result.positional_accuracy
    return result
  })
  return (await Promise.all(promises)).filter(e => !!e)
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

function mapPhotoFromDbToUi(p, urlCallbackFn) {
  const isRemotePhoto = p[constants.isRemotePhotoFieldName]
  if (isRemotePhoto) {
    return p
  }
  const objectUrl = mintObjectUrl(p.file)
  urlCallbackFn(objectUrl)
  const result = {
    ...p,
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
    const outcome = isDraft ? constants.draftOutcome : constants.waitingOutcome
    const newRecordId = uuid()
    const newPhotos = await processPhotos(record.addedPhotos)
    const enhancedRecord = Object.assign(record, {
      captive_flag: false, // it's *wild* orchid watch
      geoprivacy: 'obscured',
      photos: newPhotos,
      wowMeta: {
        [constants.recordTypeFieldName]: recordType('new'),
        [constants.recordProcessingOutcomeFieldName]: outcome,
        [constants.photosToAddFieldName]: newPhotos,
        [constants.photoIdsToDeleteFieldName]: [],
        [constants.obsFieldIdsToDeleteFieldName]: [],
        [constants.wowUpdatedAtFieldName]: new Date().toString(),
        [constants.outcomeLastUpdatedAtFieldName]: new Date().toString(),
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
        obsFieldValues: enhancedRecord.obsFieldValues.map(o => ({
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

async function saveEditAndScheduleUpdate(
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
  const outcome = isDraft ? constants.draftOutcome : constants.waitingOutcome
  try {
    const existingLocalRecord = localRecords.find(e => e.uuid === editedUuid)
    const existingRemoteRecord = allRemoteObs.find(e => e.uuid === editedUuid)
    const existingDbRecord = await (async () => {
      if (existingLocalRecord) {
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
        return result
      }
      return { inatId: existingRemoteRecord.inatId, uuid: editedUuid }
    })()
    if (!existingLocalRecord && !existingRemoteRecord) {
      throw new Error(
        'Data problem: Cannot find existing local or remote record,' +
          'cannot continue without at least one',
      )
    }
    const newPhotos = (await processPhotos(record.addedPhotos)) || []
    const photos = (() => {
      // FIXME adding new photos clobbers old photos
      const existingRemotePhotos = (existingRemoteRecord || {}).photos || []
      const wowMeta = existingDbRecord.wowMeta || {}
      const blockedAction = wowMeta[constants.blockedActionFieldName]
      const existingLocalPhotos = wowMeta[constants.photosToAddFieldName] || []
      const existingBlockedLocalPhotos = (() => {
        if (!blockedAction) {
          return []
        }
        const photosAddedInBlockedAction =
          blockedAction.wowMeta[constants.photosToAddFieldName]
        return photosAddedInBlockedAction || []
      })()
      const photoDeletesFromBlockedAction = (() => {
        if (!blockedAction) {
          return []
        }
        return blockedAction.wowMeta[constants.photoIdsToDeleteFieldName] || []
      })()
      const allPendingPhotoDeletes = [
        ...photoIdsToDelete,
        ...(wowMeta[constants.photoIdsToDeleteFieldName] || []),
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
    })()
    const enhancedRecord = Object.assign(existingDbRecord, record, {
      photos,
      uuid: editedUuid,
      wowMeta: {
        [constants.recordTypeFieldName]: recordType('edit'),
        // warning: relies on the local device time being synchronised. If
        // the clock has drifted forward, our check for updates having
        // occurred on the remote won't work.
        [constants.wowUpdatedAtFieldName]: new Date().toString(),
        [constants.recordProcessingOutcomeFieldName]: outcome,
        [constants.outcomeLastUpdatedAtFieldName]: new Date().toString(),
      },
    })
    delete enhancedRecord.addedPhotos
    try {
      const localQueueSummaryForEditTarget =
        localQueueSummary.find(e => e.uuid === enhancedRecord.uuid) || {}
      const isProcessingQueuedNow = isObsStateProcessing(
        localQueueSummaryForEditTarget[
          constants.recordProcessingOutcomeFieldName
        ],
      )
      const isThisIdQueued = !!existingLocalRecord
      const isExistingBlockedAction =
        localQueueSummaryForEditTarget[constants.hasBlockedActionFieldName]
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
            enhancedRecord.wowMeta[constants.recordTypeFieldName] = recordType(
              'new',
            )
            return upsertQueuedAction
          case 'noprocessing.noqueued.noexistingblocked.remote':
            // direct edit of remote
            return upsertQueuedAction
          case 'noprocessing.queued.existingblocked.remote':
          case 'noprocessing.queued.existingblocked.noremote':
            // I thought that things NOT processing cannot have a blocked
            // action, but it has happened in production. I think this
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
      [constants.photoIdsToDeleteFieldName]: (
        record.wowMeta[constants.photoIdsToDeleteFieldName] || []
      ).concat(photoIdsToDelete),
      [constants.photosToAddFieldName]: (
        record.wowMeta[constants.photosToAddFieldName] || []
      ).concat(newPhotos),
      [constants.obsFieldIdsToDeleteFieldName]: (
        record.wowMeta[constants.obsFieldIdsToDeleteFieldName] || []
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
  const existingWowMeta = existingStoreRecord.wowMeta
  const existingBlockedActionWowMeta =
    (existingStoreRecord.wowMeta[constants.blockedActionFieldName] || {})
      .wowMeta || {}
  const mergedPhotoIdsToDelete = (
    existingBlockedActionWowMeta[constants.photoIdsToDeleteFieldName] || []
  ).concat(photoIdsToDelete)
  const mergedPhotosToAdd = (
    existingBlockedActionWowMeta[constants.photosToAddFieldName] || []
  ).concat(newPhotos)
  const mergedObsFieldIdsToDelete = (
    existingBlockedActionWowMeta[constants.obsFieldIdsToDeleteFieldName] || []
  ).concat(obsFieldIdsToDelete)
  const mergedRecord = {
    ...record, // passed record is new source of truth
    wowMeta: {
      ...existingWowMeta, // don't touch wowMeta as it's being processed
      [constants.blockedActionFieldName]: {
        wowMeta: {
          ...existingBlockedActionWowMeta,
          ...record.wowMeta, // stuff from this save
          [constants.photoIdsToDeleteFieldName]: mergedPhotoIdsToDelete,
          [constants.photosToAddFieldName]: mergedPhotosToAdd,
          [constants.obsFieldIdsToDeleteFieldName]: mergedObsFieldIdsToDelete,
        },
      },
    },
  }
  return storeRecord(mergedRecord)
}

async function processPhotos(photos) {
  return Promise.all(
    photos.map(async (curr, $index) => {
      const tempId = -1 * ($index + 1)
      const photoDataAsArrayBuffer = await blobToArrayBuffer(curr.file)
      const photo = {
        id: tempId,
        url: '(set at render time)',
        type: curr.type,
        file: {
          data: photoDataAsArrayBuffer,
          mime: curr.file.type,
        },
      }
      verifyWowDomainPhoto(photo)
      return photo
    }),
  )
}

function isObsStateProcessing(state) {
  const processingStates = [
    constants.withLocalProcessorOutcome,
    constants.withServiceWorkerOutcome,
  ]
  return processingStates.includes(state)
}

async function deleteSelectedLocalRecord(selectedUuid) {
  if (!selectedUuid) {
    throw namedError(
      'InvalidState',
      'Tried to delete local record for the selected observation but no ' +
        'observation is selected',
    )
  }
  try {
    await deleteDbRecordById(selectedUuid)
  } catch (err) {
    throw new chainedError(
      `Failed to delete local record for UUID='${selectedUuid}'`,
      err,
    )
  }
}

async function deleteSelectedRecord(
  { selectedUuid, localQueueSummary, allRemoteObs },
  runStrategy = realRunStrategy,
) {
  const localQueueSummaryForDeleteTarget =
    localQueueSummary.find(e => e.uuid === selectedUuid) || {}
  if (!localQueueSummaryForDeleteTarget) {
    throw namedError(
      'NoSummaryFound',
      `Tried to find local summary for UUID='${selectedUuid}' but couldn't.`,
    )
  }
  const isProcessingQueuedNow = isObsStateProcessing(
    localQueueSummaryForDeleteTarget[
      constants.recordProcessingOutcomeFieldName
    ],
  )
  const existingRemoteRecord =
    allRemoteObs.find(e => e.uuid === selectedUuid) || {}
  const record = {
    inatId: existingRemoteRecord.inatId,
    uuid: existingRemoteRecord.uuid || selectedUuid,
    wowMeta: {
      [constants.recordTypeFieldName]: recordType('delete'),
      [constants.recordProcessingOutcomeFieldName]: constants.waitingOutcome,
    },
  }
  const strategyKey =
    `${isProcessingQueuedNow ? '' : 'no'}processing.` +
    `${existingRemoteRecord.uuid ? '' : 'no'}remote`
  const strategyPromise = (() => {
    switch (strategyKey) {
      case 'noprocessing.noremote':
        console.debug(
          `Record with UUID='${selectedUuid}' is local-only so deleting right now.`,
        )
        return runStrategy(deleteSelectedLocalRecord, selectedUuid)
      case 'noprocessing.remote':
        return runStrategy(upsertQueuedAction, { record })
      case 'processing.noremote':
        return runStrategy(upsertBlockedAction, { record })
      case 'processing.remote':
        return runStrategy(upsertBlockedAction, { record })
      default:
        throw new Error(
          `Programmer problem: no strategy defined for key='${strategyKey}'`,
        )
    }
  })()
  await strategyPromise
}

function realRunStrategy(strategyFn, ...args) {
  // only exists so we stub it during tests
  return strategyFn(...args)
}

// eslint-disable-next-line import/prefer-default-export
export const _testonly = {
  exposed,
  upsertBlockedAction,
  upsertQueuedAction,
}
