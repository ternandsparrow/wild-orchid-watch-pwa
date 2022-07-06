// Functions related to the dealing with our observation store that are required
// by the client, worker(s) and the service worker. We don't want the workers
// to import the vuex code hence this module.
import _ from 'lodash'
import dayjs from 'dayjs'
import {
  blobToArrayBuffer,
  ChainedError,
  getExifFromBlob,
} from '@/misc/only-common-deps-helpers'
import * as cc from '@/misc/constants'
import { getOrCreateInstance } from './storage-manager'

// rationale: we want to emit a warning but:
//   1. we don't want to pass a handler all the way down the chain
//   2. we don't want to import Sentry or our wrappers of Sentry here
//   3. we can't throw an error
let warnHandler = console.warn
export function registerWarnHandler(handler) {
  warnHandler = handler
}

async function storeRecordImpl(obsStore, photoStore, record) {
  // enhancement idea: when clobbering an existing record, we could calculate
  // if any photos are implicity deleted (orphaned) and delete them.
  const key = record.uuid
  try {
    if (!key) {
      throw new Error('Record has no key, cannot continue')
    }
    log('Processing photo deletes')
    await deleteLocalPhotos(
      record,
      `wowMeta.${cc.photoIdsToDeleteFieldName}`,
      photoStore,
    )
    log('Processing photo adds')
    await savePhotosAndReplaceWithThumbnails(
      record,
      `wowMeta.${cc.photosToAddFieldName}`,
      photoStore,
    )
    record.wowMeta[cc.versionFieldName] = cc.currentRecordVersion
    log('Saving record')
    return obsStore.setItem(key, record)
  } catch (err) {
    throw ChainedError(`Failed to store db record with ID='${key}'`, err)
  }
  function log(msg) {
    console.debug(`[storeRecordImpl] ${msg}`)
  }
}

async function savePhotosAndReplaceWithThumbnails(
  record,
  propPath,
  photoStore,
) {
  const photos = _.get(record, propPath, [])
  if (!photos.length) {
    return
  }
  const result = []
  for (const curr of photos) {
    const isAlreadyThumbnail =
      _.get(curr, 'file.data.constructor') === ArrayBuffer || curr.file === null
    if (isAlreadyThumbnail) {
      result.push(curr)
      continue
    }
    const currThumb = await interceptableFns.storePhotoRecord(photoStore, curr)
    result.push(currThumb)
    // update the array of all photos to use the thumbnail
    const foundIndex = record.photos.findIndex((e) => e.id === curr.id)
    if (!~foundIndex) {
      warnHandler(
        `Inconsistent data error: could not find photo with ` +
          `ID=${curr.id} to replace with thumbnail. Processing ${propPath},` +
          ` available photo IDs=${JSON.stringify(photos.map((e) => e.id))}. ` +
          `Adding it to the list of photos.`,
      )
      record.photos.push(currThumb)
    } else {
      record.photos.splice(foundIndex, 1, currThumb)
    }
  }
  _.set(record, propPath, result)
}

async function deleteLocalPhotos(record, propPath, photoStore) {
  const ids = _.get(record, propPath, [])
  if (!ids.length) {
    return
  }
  const idsToDelete = ids.filter(isLocalPhotoId)
  for (const curr of idsToDelete) {
    console.debug(`Deleting local photo with ID=${curr}`)
    await photoStore.removeItem(curr)
  }
  _.set(record, propPath, _.difference(ids, idsToDelete))
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
    throw ChainedError(`Failed to get DB record with ID='${recordId}'`, err)
  }
}

async function getPhotoRecordImpl(store, recordId) {
  try {
    if (!recordId) {
      throw new Error(
        `No photo record ID='${recordId}' supplied, cannot continue`,
      )
    }
    return store.getItem(recordId)
  } catch (err) {
    throw ChainedError(
      `Failed to get photo DB record with ID='${recordId}'`,
      err,
    )
  }
}

export function deleteDbRecordById(id) {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return deleteDbRecordByIdImpl(obsStore, photoStore, id)
}

async function deleteDbRecordByIdImpl(obsStore, photoStore, id) {
  try {
    const existingObsRecord = await obsStore.getItem(id)
    if (!existingObsRecord) {
      console.warn(
        `Asked to delete ${id} from the DB, but it doesn't exist. Not a ` +
          `concern if a remote-only record. Nothing to do.`,
      )
      return
    }
    const idsToDelete = (existingObsRecord.photos || [])
      .map((e) => e.id)
      .filter(isLocalPhotoId)
    for (const curr of idsToDelete) {
      console.debug(`Deleting local photo with ID=${curr}`)
      await photoStore.removeItem(curr)
    }
    return obsStore.removeItem(id)
  } catch (err) {
    throw ChainedError(`Failed to delete db record with ID='${id}'`, err)
  }
}

export function storeRecord(record) {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return storeRecordImpl(obsStore, photoStore, record)
}

export function getRecord(recordId) {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return getRecordImpl(store, recordId)
}

export function getPhotoRecord(recordId) {
  const store = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return getPhotoRecordImpl(store, recordId)
}

export function mapOverObsStore(mapperFn) {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return mapOverObsStoreImpl(store, mapperFn)
}

export async function mapOverObsStoreImpl(obsStore, mapperFn) {
  const result = []
  await obsStore.iterate((r) => {
    result.push(mapperFn(r))
  })
  return result
}

export function setRecordProcessingOutcome(dbId, targetOutcome) {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return setRecordProcessingOutcomeImpl(
    obsStore,
    photoStore,
    dbId,
    targetOutcome,
  )
}

async function setRecordProcessingOutcomeImpl(
  obsStore,
  photoStore,
  dbId,
  targetOutcome,
) {
  console.debug(`Transitioning dbId=${dbId} to outcome=${targetOutcome}`)
  const record = await getRecordImpl(obsStore, dbId)
  if (!record) {
    throw new Error(`Could not find record for ID=${dbId}`)
  }
  record.wowMeta[cc.recordProcessingOutcomeFieldName] = targetOutcome
  record.wowMeta[cc.outcomeLastUpdatedAtFieldName] = new Date().toString()
  return storeRecordImpl(obsStore, photoStore, record)
}

export function healthcheckStore() {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return store.ready()
}

function isLocalPhotoId(id) {
  // we use strings for photo IDs locally, iNat uses numbers
  return typeof id === 'string'
}

/**
 * Map only the observation payload
 */
export async function mapObsCoreFromOurDomainOntoApi(dbRecord) {
  const ignoredKeys = [
    'id',
    'inatId',
    'lat',
    'lng',
    'obsFieldValues',
    'observedAt',
    'photos',
    'placeGuess',
    'speciesGuess',
    'wowMeta',
  ]
  const recordIdObjFragment = (() => {
    const { inatId } = dbRecord
    if (inatId) {
      return { id: inatId }
    }
    return {}
  })()
  return Object.keys(dbRecord).reduce(
    (accum, currKey) => {
      const isNotIgnored = !ignoredKeys.includes(currKey)
      const value = dbRecord[currKey]
      if (isNotIgnored && isAnswer(value)) {
        accum[currKey] = value
      }
      return accum
    },
    {
      ...recordIdObjFragment,
      latitude: dbRecord.lat,
      longitude: dbRecord.lng,
      observed_on_string: dbRecord.observedAt,
      species_guess: dbRecord.speciesGuess,
      observation_field_values_attributes: (
        dbRecord.obsFieldValues || []
      ).reduce((accum, curr, index) => {
        accum[index] = {
          observation_field_id: curr.fieldId,
          value: curr.value,
        }
        return accum
      }, {}),
    },
  )
}

function isAnswer(val) {
  return !['undefined', 'null'].includes(typeof val)
}

export function mapCommentFromApiToOurDomain(apiComment) {
  return {
    inatId: apiComment.id,
    uuid: apiComment.uuid,
    body: apiComment.body, // we are trusting iNat to sanitise this
    createdAt: apiComment.created_at,
    isHidden: apiComment.hidden,
    userLogin: apiComment.user.login,
    userId: apiComment.user.id,
    wowType: 'comment',
  }
}

export function updateIdsAndCommentsFor(obs) {
  obs.idsAndComments = [...obs.comments, ...obs.identifications]
  obs.idsAndComments.sort((a, b) => {
    const f = 'createdAt'
    if (dayjs(a[f]).isBefore(b[f])) return -1
    if (dayjs(a[f]).isAfter(b[f])) return 1
    return 0
  })
}

export function processObsFieldName(fieldName) {
  return (fieldName || '').replace(cc.obsFieldNamePrefix, '')
}

const interceptableFns = {
  storePhotoRecord,
}

export const _testonly = {
  deleteDbRecordByIdImpl,
  getRecordImpl,
  getPhotoRecordImpl,
  interceptableFns,
  storeRecordImpl,
}
