// Functions related to the dealing with our observation store that are required
// by the client, worker(s) and the service worker. We don't want the workers
// to import the vuex code hence this module.
import _ from 'lodash'
import {
  arrayBufferToBlob,
  blobToArrayBuffer,
  chainedError,
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

// rationale: ideally we'd import 'uuid/v1' here but rollup doesn't play nice
// with that. We don't actually need this function in the SW so we'll just let
// the worker supply it.
let uuidGenerator = () => {
  throw new Error('Programmer error: pass a real generator in')
}
export function registerUuidGenerator(fn) {
  uuidGenerator = fn
}

async function storeRecordImpl(obsStore, photoStore, record) {
  // enhancement idea: when clobbering an existing record, we could calculate
  // if any photos are implicity deleted (orphaned) and delete them.
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
    await savePhotosAndReplaceWithThumbnails(
      record,
      `wowMeta.${cc.photosToAddFieldName}`,
    )
    await savePhotosAndReplaceWithThumbnails(
      record,
      `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photosToAddFieldName}`,
    )
    record.wowMeta[cc.versionFieldName] = cc.currentRecordVersion
    return obsStore.setItem(key, record)
  } catch (err) {
    throw chainedError(`Failed to store db record with ID='${key}'`, err)
  }
  async function savePhotosAndReplaceWithThumbnails(record, propPath) {
    const photos = _.get(record, propPath, [])
    if (!photos.length) {
      return
    }
    const result = []
    for (const curr of photos) {
      const isAlreadyThumbnail =
        _.get(curr, 'file.data.constructor') === ArrayBuffer ||
        curr.file === null
      if (isAlreadyThumbnail) {
        result.push(curr)
        continue
      }
      const currThumb = await interceptableFns.storePhotoRecord(
        photoStore,
        curr,
      )
      result.push(currThumb)
      // update the array of all photos to use the thumbnail
      const foundIndex = record.photos.findIndex(e => e.id === curr.id)
      if (!~foundIndex) {
        throw new Error(
          `Inconsistent data error: could not find photo with ` +
            `ID=${curr.id} to replace with thumbnail. Processing ${propPath},` +
            ` available photo IDs=${JSON.stringify(photos.map(e => e.id))}`,
        )
      }
      record.photos.splice(foundIndex, 1, currThumb)
    }
    _.set(record, propPath, result)
  }
  async function deleteLocalPhotos(record, propPath) {
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

export function deleteDbRecordById(id) {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  return deleteDbRecordByIdImpl(obsStore, photoStore, id)
}

async function deleteDbRecordByIdImpl(obsStore, photoStore, id) {
  try {
    const existingObsRecord = await obsStore.getItem(id)
    if (!existingObsRecord) {
      // nothing to do
      return
    }
    const idsToDelete = (existingObsRecord.photos || [])
      .map(e => e.id)
      .filter(isLocalPhotoId)
    for (const curr of idsToDelete) {
      console.debug(`Deleting local photo with ID=${curr}`)
      await photoStore.removeItem(curr)
    }
    return obsStore.removeItem(id)
  } catch (err) {
    throw chainedError(`Failed to delete db record with ID='${id}'`, err)
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

export function mapOverObsStore(mapperFn) {
  const store = getOrCreateInstance(cc.lfWowObsStoreName)
  return mapOverObsStoreImpl(store, mapperFn)
}

export function mapOverObsStoreImpl(obsStore, mapperFn) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = []
      await obsStore.iterate(r => {
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

function isLocalPhotoId(id) {
  // we use strings for photo IDs locally, iNat uses numbers
  return typeof id === 'string'
}

export async function performMigrationsInWorker() {
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  const migratedIds = await doGh69SeparatingPhotosMigration(
    obsStore,
    photoStore,
    metaStore,
  )
  if (migratedIds.length) {
    warnHandler(`Migrated ${migratedIds.length} records in GH-69 migration`)
  }
}

async function doGh69SeparatingPhotosMigration(
  obsStore,
  photoStore,
  metaStore,
) {
  const start = Date.now()
  const migrationName = '"GH-69 separating photos"'
  console.debug(`Starting ${migrationName} migration`)
  const isAlreadyMigrated = await isMigrationDoneImpl(
    metaStore,
    cc.gh69MigrationKey,
  )
  const migratedIds = []
  if (isAlreadyMigrated) {
    console.debug(
      `Already done ${migrationName} migration previously, skipping`,
    )
    return migratedIds
  }
  const obsIds = await obsStore.keys()
  for (const currId of obsIds) {
    const record = await obsStore.getItem(currId)
    const isMigrationRequired1 = await prepForMigration(
      record,
      `wowMeta.${cc.photosToAddFieldName}`,
    )
    const isMigrationRequired2 = await prepForMigration(
      record,
      `wowMeta.${cc.blockedActionFieldName}.wowMeta.${cc.photosToAddFieldName}`,
    )
    if (!isMigrationRequired1 && !isMigrationRequired2) {
      continue
    }
    console.debug(`Doing ${migrationName} migration for UUID=${record.uuid}`)
    await storeRecordImpl(obsStore, photoStore, record)
    migratedIds.push(record.uuid)
  }
  const elapsedMsg = `Took ${Date.now() - start}ms.`
  if (!migratedIds.length) {
    console.debug(
      `Migration ${migrationName} found no records needing migration. ${elapsedMsg}`,
    )
  } else {
    console.debug(
      `Successfully performed ${migrationName} migration on IDs=${JSON.stringify(
        migratedIds,
      )}. ${elapsedMsg}`,
    )
  }
  await markMigrationDoneImpl(metaStore, cc.gh69MigrationKey)
  return migratedIds
}

async function prepForMigration(obsRecord, propPath) {
  const photos = _.get(obsRecord, propPath, [])
  if (!photos.length) {
    return false
  }
  let isMigrationRequired = false
  for (const curr of photos) {
    const isMigratedLocalPhoto = isLocalPhotoId(curr.id)
    if (isMigratedLocalPhoto) {
      continue
    }
    curr.id = uuidGenerator()
    curr.file = await arrayBufferToBlob(curr.file.data, curr.file.mime)
    isMigrationRequired = true
  }
  return isMigrationRequired
}

export function markMigrationDone(key) {
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  return markMigrationDoneImpl(metaStore, key)
}

function markMigrationDoneImpl(metaStore, key) {
  return metaStore.setItem(key, new Date().toISOString())
}

export function isMigrationDone(key) {
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  return isMigrationDoneImpl(metaStore, key)
}

function isMigrationDoneImpl(metaStore, key) {
  return metaStore.getItem(key)
}

const interceptableFns = {
  storePhotoRecord,
}

export const _testonly = {
  deleteDbRecordByIdImpl,
  doGh69SeparatingPhotosMigration,
  getRecordImpl,
  interceptableFns,
  storeRecordImpl,
}
