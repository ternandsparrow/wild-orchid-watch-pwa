import { expose as comlinkExpose } from 'comlink'
import * as constants from '@/misc/constants'
import { mapOverObsStore, getRecord } from '@/indexeddb/obs-store-common'
import {
  recordTypeEnum,
  arrayBufferToBlob,
  chainedError,
  wowWarnMessage,
} from '@/misc/helpers'

comlinkExpose({
  cleanupPhotosForObs,
  getData,
  getDbPhotosForObs,
})

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
        ] === recordTypeEnum('delete')
      : r.wowMeta[constants.recordTypeFieldName] === recordTypeEnum('delete')
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

export const _testonly = {
  getData,
}
