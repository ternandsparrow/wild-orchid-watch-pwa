// Functions related to the dealing with our observation store that are required
// by both the client and the service worker. We don't want the SW to import
// the vuex code hence this module
import { getOrCreateInstance } from './storage-manager'
import { chainedError } from '../misc/only-common-deps-helpers'
import * as constants from '../misc/constants'

async function storeRecordImpl(store, record) {
  const key = record.uuid
  try {
    if (!key) {
      throw new Error('Record has no key, cannot continue')
    }
    return store.setItem(key, record)
  } catch (err) {
    throw chainedError(`Failed to store db record with ID='${key}'`, err)
  }
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
  const store = getOrCreateInstance(constants.lfWowObsStoreName)
  try {
    return store.removeItem(id)
  } catch (err) {
    throw chainedError(`Failed to delete db record with ID='${id}'`, err)
  }
}

export async function storeRecord(record) {
  const store = getOrCreateInstance(constants.lfWowObsStoreName)
  return storeRecordImpl(store, record)
}

export async function getRecord(recordId) {
  const store = getOrCreateInstance(constants.lfWowObsStoreName)
  return getRecordImpl(store, recordId)
}

export function mapOverObsStore(mapperFn) {
  const store = getOrCreateInstance(constants.lfWowObsStoreName)
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
  record.wowMeta[constants.recordProcessingOutcomeFieldName] = targetOutcome
  return storeRecord(record)
}

export function healthcheckStore() {
  const store = getOrCreateInstance(constants.lfWowObsStoreName)
  return store.ready()
}

export const _testonly = {
  getRecordImpl,
  storeRecordImpl,
}
