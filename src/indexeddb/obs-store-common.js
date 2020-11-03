// Functions related to the dealing with our observation store that are required
// by both the client and the service worker. We don't want the SW to import
// the vuex code hence this module
import _ from 'lodash'
import { blobToArrayBuffer, getExifFromBlob } from '@/misc/helpers'
import { chainedError } from '@/misc/only-common-deps-helpers'
import * as cc from '@/misc/constants'
import { getOrCreateInstance } from './storage-manager'

// rationale: we want to emit warning but:
//   1. we don't want to pass a handler all the way down the chain
//   2. we don't want to import Sentry or our wrappers of Sentry here
//   3. we can't throw an error
let warnHandler = console.warn
export function registerWarnHandler(handler) {
  warnHandler = handler
}

async function storeRecordImpl(obsStore, photoStore, record) {
  const key = record.uuid
  try {
    if (!key) {
      throw new Error('Record has no key, cannot continue')
    }
    await deleteLocalPhotos(record, `wowMeta.${cc.photoIdsToDeleteFieldName}`)
    await deleteLocalPhotos(
      record,
      `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photoIdsToDeleteFieldName}`,
    )
    const newPhotos = _.get(record, `wowMeta.${cc.photosToAddFieldName}`, [])
    if (newPhotos.length) {
      const thumbnails = await savePhotosAndReplaceWithThumbnails(newPhotos)
      record.wowMeta[cc.photosToAddFieldName] = thumbnails
    }
    const blockedActionPhotos = _.get(
      record,
      `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photosToAddFieldName}`,
      [],
    )
    if (blockedActionPhotos.length) {
      const thumbnails = await savePhotosAndReplaceWithThumbnails(
        blockedActionPhotos,
      )
      record.wowMeta[cc.blockedActionFieldName].wowMeta[
        cc.photosToAddFieldName
      ] = thumbnails
    }
    return obsStore.setItem(key, record)
  } catch (err) {
    throw chainedError(`Failed to store db record with ID='${key}'`, err)
  }
  async function savePhotosAndReplaceWithThumbnails(photos) {
    const thumbnails = []
    for (const currIndex in photos) {
      const curr = photos[currIndex]
      // FIXME this won't work for migration
      const isAlreadyThumbnail =
        _.get(curr, 'file.data.constructor') === ArrayBuffer ||
        curr.file === null
      if (isAlreadyThumbnail) {
        thumbnails.push(curr)
        continue
      }
      const currThumb = await interceptableFns.storePhotoRecord(
        photoStore,
        curr,
      )
      thumbnails.push(currThumb)
      // update the array of all photos to use the thumbnail
      record.photos.splice(currIndex, 1, currThumb)
    }
    return thumbnails
  }
  async function deleteLocalPhotos(record, propPath) {
    const ids = _.get(record, propPath, [])
    if (!ids.length) {
      return
    }
    const idsToDelete = ids.filter(e => {
      // we use strings for photo IDs locally, iNat uses numbers
      const isLocalPhoto = typeof e === 'string'
      return isLocalPhoto
    })
    for (const curr of idsToDelete) {
      console.debug(`Deleting local photo with ID=${curr}`)
      await photoStore.removeItem(curr)
    }
    _.set(record, propPath, _.difference(ids, idsToDelete))
  }
}

async function storePhotoRecord(photoStore, photoRecord) {
  const photoDataAsArrayBuffer = await blobToArrayBuffer(photoRecord.file)
  const photoDbId = photoRecord.id
  const recordToSave = {
    ...photoRecord,
    file: {
      data: photoDataAsArrayBuffer,
      mime: photoRecord.file.type,
    },
  }
  await photoStore.setItem(photoDbId, recordToSave)
  const exif = await getExifFromBlob(photoRecord.file)
  const thumbBlob = _.get(exif, 'thumbnail.blob')
  if (!thumbBlob) {
    warnHandler(
      `Photo of type=${photoRecord.type} and ID=${photoRecord.id} does not ` +
        `have a thumbnail in EXIF`,
    )
    return { ...photoRecord, file: null }
  }
  const thumbnailDataAsArrayBuffer = await blobToArrayBuffer(thumbBlob)
  const thumbnailRecord = {
    ...photoRecord,
    file: {
      data: thumbnailDataAsArrayBuffer,
      mime: thumbBlob.type,
    },
  }
  return thumbnailRecord
}

async function getRecordImpl(store, recordId) {
  try {
    if (!recordId) {
      throw new Error(`No record ID='${recordId}' supplied, cannot continue`)
    }
    return store.getItem(recordId)
  } catch (err) {
    throw chainedError(`Failed to get db record with ID='${recordId}'`, err)
  }
}

export async function deleteDbRecordById(id) {
  // FIXME need to also delete photos
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  try {
    return store.removeItem(id)
  } catch (err) {
    throw chainedError(`Failed to delete db record with ID='${id}'`, err)
  }
}

export async function storeRecord(record) {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return storeRecordImpl(obsStore, photoStore, record)
}

export async function getRecord(recordId) {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return getRecordImpl(store, recordId)
}

export function mapOverObsStore(mapperFn) {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return new Promise(async (resolve, reject) => {
    try {
      const result = []
      await store.iterate(r => {
        result.push(mapperFn(r))
      })
      return resolve(result)
    } catch (err) {
      return reject(err)
    }
  })
}

export async function setRecordProcessingOutcome(dbId, targetOutcome) {
  console.debug(`Transitioning dbId=${dbId} to outcome=${targetOutcome}`)
  const record = await getRecord(dbId)
  if (!record) {
    throw new Error('Could not find record for ID=' + dbId)
  }
  record.wowMeta[cc.recordProcessingOutcomeFieldName] = targetOutcome
  record.wowMeta[cc.outcomeLastUpdatedAtFieldName] = new Date().toString()
  return storeRecord(record)
}

export function healthcheckStore() {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return store.ready()
}

const interceptableFns = {
  storePhotoRecord,
}

export const _testonly = {
  getRecordImpl,
  interceptableFns,
  storeRecordImpl,
}
