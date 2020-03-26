// Functions related to the dealing with our observation store that are required
// by both the client and the service worker. We don't want the SW to import
// the vuex code hence this module
import { getOrCreateInstance } from './storage-manager'
import { chainedError } from '../misc/only-common-deps-helpers'
import * as constants from '../misc/constants'

const obsStore = getOrCreateInstance(constants.lfWowObsStoreName)

export async function deleteDbRecordById(id) {
  try {
    return obsStore.removeItem(id)
  } catch (err) {
    throw chainedError(`Failed to delete db record with ID='${id}'`, err)
  }
}

export async function storeRecord(record) {
  const key = record.uuid
  try {
    if (!key) {
      throw new Error('Record has no key, cannot continue')
    }
    return obsStore.setItem(key, record)
  } catch (err) {
    throw chainedError(`Failed to store db record with ID='${key}'`, err)
  }
}

export async function getRecord(recordId) {
  try {
    if (!recordId) {
      throw new Error(`No record ID='${recordId}' supplied, cannot continue`)
    }
    return obsStore.getItem(recordId)
  } catch (err) {
    throw chainedError(`Failed to get db record with ID='${recordId}'`, err)
  }
}

export function mapOverObsStore(mapperFn) {
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
  record.wowMeta[constants.recordProcessingOutcomeFieldName] = targetOutcome
  return storeRecord(record)
}
