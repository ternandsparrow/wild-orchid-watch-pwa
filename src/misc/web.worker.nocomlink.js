import 'formdata-polyfill'
import Fuse from 'fuse.js'
import dayjs from 'dayjs'
import _ from 'lodash'
import uuid from 'uuid/v1'
import * as cc from '@/misc/constants'
import {
  // importing this module will implicitly call sentryInit()
  deleteDbRecordById,
  getPhotoRecord,
  getRecord,
  mapCommentFromApiToOurDomain,
  mapObsCoreFromOurDomainOntoApi,
  mapOverObsStore,
  processObsFieldName,
  registerWarnHandler,
  setRecordProcessingOutcome,
  storeRecord,
  updateIdsAndCommentsFor,
} from '@/indexeddb/obs-store-common'
import {
  arrayBufferToBlob,
  ChainedError,
  deleteWithAuth,
  findCommonString,
  getJsonWithAuth,
  namedError,
  postFormDataWithAuth,
  recordTypeEnum as recordType,
  rectangleAlongPathAreaValueToTitle,
  verifyWowDomainPhoto,
  wowErrorHandler,
  wowIdOf,
  wowWarnMessage,
} from '@/misc/helpers'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import { deserialise } from '@/misc/taxon-s11n'

registerWarnHandler(wowWarnMessage)
let taxaIndex = null
let taskChecksTracker = null
let thumbnailObjectUrlsInUse = []
let thumbnailObjectUrlsNoLongerInUse = []
let obsDetailObjectUrls = []
let postMessageFnOverride

export async function doFacadeMigration(apiToken, projectId) {
  const start = Date.now()
  const migrationName = '"facade"'
  console.debug(`Starting ${migrationName} migration`)
  const isAlreadyMigrated = await isMigrationDone(cc.facadeMigrationKey)
  const migratedIds = []
  if (isAlreadyMigrated) {
    console.debug(
      `Already done ${migrationName} migration previously, skipping`,
    )
    return migratedIds
  }
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const obsIds = await obsStore.keys()
  for (const currId of obsIds) {
    const record = await obsStore.getItem(currId)
    if (record.wowMeta[cc.versionFieldName] === cc.currentRecordVersion) {
      continue
    }
    console.debug(`Doing ${migrationName} migration for UUID=${record.uuid}`)
    delete record.wowMeta.blockedAction
    record.wowMeta[cc.recordProcessingOutcomeFieldName] = cc.waitingOutcome
    if (record.wowMeta[cc.recordTypeFieldName] === 'delete') {
      await storeRecord(record)
      await deleteRecord(record.uuid, apiToken)
    } else {
      record.wowMeta[cc.recordTypeFieldName] = recordType('update')
      await storeRecord(record)
      await sendUpdateToFacade(record.uuid, apiToken, projectId)
    }
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
      )} (${migratedIds.length} records). ${elapsedMsg}`,
    )
  }
  await deleteIndexedDbDatabase('wow-sw')
  await markMigrationDone(cc.facadeMigrationKey)
}

function deleteIndexedDbDatabase(dbName) {
  return new Promise((r) => {
    const DBDeleteRequest = window.indexedDB.deleteDatabase(dbName)
    DBDeleteRequest.onerror = function () {
      wowWarnMessage(`Failed to delete DB=${dbName}`)
      r()
    }
    DBDeleteRequest.onsuccess = function () {
      console.debug(`DB=${dbName} deleted successfully`)
      r()
    }
  })
}

function markMigrationDone(key) {
  return metaStoreWrite(key, new Date().toISOString())
}

function isMigrationDone(key) {
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  return metaStore.getItem(key)
}

export async function getAllJournalPosts(apiToken) {
  const baseUrl = `/projects/${cc.inatProjectSlug}/posts/`
  const allRawRecords = await fetchAllPages(baseUrl, cc.obsPageSize, apiToken)
  return allRawRecords
}

export async function getAllRemoteRecords(myUserId, apiToken) {
  await saveApiToken(apiToken)
  // FIXME cancel any pending checks, await current one to finish, and trigger a check now
  const baseUrl =
    `/observations` +
    `?user_id=${myUserId}` +
    `&project_id=${cc.inatProjectSlug}`
  const allRawRecords = await fetchAllPages(baseUrl, cc.obsPageSize, apiToken)
  // FIXME probably a waste of effort to map everything. We only need to map
  //  the summary here and the detail mapping can be done later, when the
  //  ObsDetail view is opened.
  const allMappedRecords = allRawRecords.map(mapObsFromApiIntoOurDomain)
  await metaStoreWrite(cc.remoteObsKey, allMappedRecords)
  const allRecordSummaries = allMappedRecords.map(mapRemoteRecordToSummary)
  return allRecordSummaries
}

export async function getFullRemoteObsDetail(
  theUuid,
  detailedModeOnlyObsFieldIds,
  throwOnMissing = true,
) {
  const remoteObs = await metaStoreRead(cc.remoteObsKey)
  const found = remoteObs?.find((e) => e.uuid === theUuid)
  if (!found && throwOnMissing) {
    throw new Error(`Selected obs ${theUuid} has no remote record in the db`)
  }
  if (detailedModeOnlyObsFieldIds) {
    mapObsFieldValuesToUi(found, detailedModeOnlyObsFieldIds)
  }
  return found
}

function computeIsPossiblyStuck(record, pendingTasks) {
  const rpo = record.wowMeta[cc.recordProcessingOutcomeFieldName]
  const isPendingTask = !!pendingTasks.find((t) => t.uuid === record.uuid)
  const shouldHaveTask = [cc.beingProcessedOutcome, cc.successOutcome].includes(
    rpo,
  )
  return shouldHaveTask && !isPendingTask
  // FIXME what about when offline and it's been sent to SW but no response has come back?
}

export async function getFullLocalObsDetail(
  theUuid,
  detailedModeOnlyObsFieldIds,
) {
  // FIXME if we move fetching project into into the worker, we don't need to
  //  pass detailedModeOnlyObsFieldIds because we can pull it directly from the
  //  store
  const result = await getRecord(theUuid)
  result.geolocationAccuracy = result.positional_accuracy
  delete result.positional_accuracy
  const pendingTasks = await getAllPendingTasks()
  result.wowMeta.isPossiblyStuck = computeIsPossiblyStuck(result, pendingTasks)
  mapObsFieldValuesToUi(result, detailedModeOnlyObsFieldIds)
  return result
}

function mapObsFieldValuesToUi(record, detailedModeOnlyObsFieldIds) {
  if (!record.obsFieldValues) {
    return record
  }
  const valueMappers = {
    [cc.approxAreaSearchedObsFieldId]: rectangleAlongPathAreaValueToTitle,
    [cc.areaOfPopulationObsFieldId]: rectangleAlongPathAreaValueToTitle,
  }
  record.obsFieldValues = record.obsFieldValues.reduce((accum, curr) => {
    const val = curr.value
    const defaultStrat = (v) => v
    const strategy = valueMappers[curr.fieldId] || defaultStrat
    const mappedValue = strategy(val)
    const multiselectId = cc.getMultiselectId(curr.fieldId)
    const isMultiselect = !!multiselectId
    if (!isMultiselect) {
      accum.push({
        ...curr,
        title: mappedValue, // don't clobber the "value" property
        isDetailedMode: (() => {
          // looking for == notCollected probably isn't the most robust
          // check. In a perfect world we would recreate the complex rules
          // around our conditionally required fields and use that knowledge
          // here. But this is easy and has the same effect because required
          // fields can't be not collected
          const isNotCollected = curr.value === cc.notCollected
          const isDefinitelyDetailed =
            !!detailedModeOnlyObsFieldIds[curr.fieldId]
          return isDefinitelyDetailed || isNotCollected
        })(),
      })
      return accum
    }
    const existingQuestionContainer = accum.find(
      (e) => e.multiselectId === multiselectId,
    )
    if (!existingQuestionContainer) {
      accum.push({
        ...curr,
        multiselectId,
        multiselectValues: [{ name: curr.name, value: mappedValue }],
        // we don't have any required multiselects so we can simply hide them
        // all in basic mode
        isDetailedMode: true,
      })
      return accum
    }
    const trimTrailingStuffRegex = /[^\w]*$/
    const trimLeadingStuffRegex = /^[^\w]*/
    existingQuestionContainer.name = findCommonString(
      curr.name,
      existingQuestionContainer.name,
    ).replace(trimTrailingStuffRegex, '')
    ;(function fixUpFirstValue() {
      const firstValue = existingQuestionContainer.multiselectValues[0]
      firstValue.name = firstValue.name
        .replace(existingQuestionContainer.name, '')
        .replace(trimLeadingStuffRegex, '')
    })()
    const thisMultiselectValueName = curr.name
      .replace(existingQuestionContainer.name, '')
      .replace(trimLeadingStuffRegex, '')
    existingQuestionContainer.multiselectValues.push({
      name: thisMultiselectValueName,
      value: mappedValue,
    })
    return accum
  }, [])
  return record
}

function mapRemoteRecordToSummary(r) {
  const fieldsToMap = [
    'commentCount',
    'idCount',
    'inatId',
    'lat',
    'lng',
    'observedAt',
    'speciesGuess',
    'uuid',
  ]
  const result = fieldsToMap.reduce((accum, currField) => {
    accum[currField] = r[currField]
    return accum
  }, {})
  result.thumbnailUrl = (() => {
    if (r.thumbnailUrl) {
      return r.thumbnailUrl
    }
    const remotePhotoUrl = ((r.photos || [])[0] || {}).url
    if (remotePhotoUrl) {
      return remotePhotoUrl
    }
    return cc.noImagePlaceholderUrl
  })()
  return result
}

async function fetchAllPages(baseUrl, pageSize, apiToken) {
  // FIXME move to worker, but that means we also have to
  // - move all the helper fns from store/auth
  // - store the required auth keys in the worker (and update them)
  // - update calling code to use the worker
  // - maybe rename the worker to something that supports the whole app, and
  //   move the reference to a shared location
  let isMorePages = true
  let allRecords = []
  let currPage = 1
  while (isMorePages) {
    try {
      console.debug(`Getting page=${currPage} of ${baseUrl}`)
      const isExistingQueryString = ~baseUrl.indexOf('?')
      const joiner = isExistingQueryString ? '&' : '?'
      const urlSuffix = `${baseUrl}${joiner}per_page=${pageSize}&page=${currPage}`
      const resp = await getJsonWithAuth(
        `${cc.apiUrlBase}${urlSuffix}`,
        apiToken,
      )
      const { results } = resp
      // note: we use the per_page from the resp because if we request too
      // many records per page, the server will ignore our page size and
      // the following check won't work
      isMorePages = results.length === resp.per_page
      allRecords = allRecords.concat(results)
      currPage += 1
    } catch (err) {
      throw ChainedError(
        `Failed while trying to get page=${currPage} of ${baseUrl}`,
        err,
      )
    }
  }
  return allRecords
}

/**
 * Maps an API record into our app domain.
 */
function mapObsFromApiIntoOurDomain(obsFromApi) {
  // BEWARE: these records will be serialised into localStorage so things like
  // Dates will be flattened into something more primitive. For this reason,
  // it's best to keep everything simple. Alternatively, you can fix it by
  // hooking vuex-persistedstate to deserialse objects correctly.
  const directMappingKeys = ['uuid', 'geoprivacy']
  const result = directMappingKeys.reduce((accum, currKey) => {
    const value = obsFromApi[currKey]
    if (!_.isNil(value)) {
      accum[currKey] = value
    }
    return accum
  }, {})
  result.inatId = obsFromApi.id
  // not sure why the API provides .photos AND .observation_photos but the
  // latter has the IDs that we need to be working with.
  const photos = (obsFromApi.observation_photos || []).map((p) => {
    const result2 = {
      url: p.photo.url,
      uuid: p.uuid,
      id: p.id,
      [cc.isRemotePhotoFieldName]: true,
    }
    verifyWowDomainPhoto(result2)
    return result2
  })
  result.updatedAt = obsFromApi.updated_at
  result.observedAt = getObservedAt(obsFromApi)
  result.photos = photos
  result.placeGuess = obsFromApi.place_guess
  result.speciesGuess = obsFromApi.species_guess
  result.notes = obsFromApi.description
  result.geolocationAccuracy = obsFromApi.positional_accuracy
  delete result.positional_accuracy
  const { lat, lng } = mapGeojsonToLatLng(
    obsFromApi.private_geojson || obsFromApi.geojson,
  )
  result.lat = lat
  result.lng = lng
  result.obsFieldValues = obsFromApi.ofvs.map((o) => ({
    relationshipId: o.id,
    fieldId: o.field_id,
    datatype: o.datatype,
    name: processObsFieldName(o.name),
    value: o.value,
  }))
  result.identifications = obsFromApi.identifications.map((i) => ({
    uuid: i.uuid,
    createdAt: i.created_at,
    isCurrent: i.current,
    body: i.body, // we are trusting iNat to sanitise this
    taxonLatinName: i.taxon.name,
    taxonCommonName: i.taxon.preferred_common_name,
    taxonId: i.taxon_id,
    taxonPhotoUrl: (i.taxon.default_photo || {}).square_url,
    userLogin: i.user.login,
    userId: i.user.id,
    category: i.category,
    wowType: 'identification',
  }))
  result.comments = obsFromApi.comments.map((c) =>
    mapCommentFromApiToOurDomain(c),
  )
  updateIdsAndCommentsFor(result)
  return result
}

function mapGeojsonToLatLng(geojson) {
  if (!geojson || geojson.type !== 'Point') {
    // TODO maybe pull the first point in the shape?
    return { lat: null, lng: null }
  }
  return {
    lat: parseFloat(geojson.coordinates[1]),
    lng: parseFloat(geojson.coordinates[0]),
  }
}

function getObservedAt(obsFromApi) {
  // we don't use observed_on_string because the iNat web UI uses non-standard
  // values like "2020/01/28 1:46 PM ACDT" for that field, and we can't parse
  // them. The time_observed_at field seems to be standardised, which is good
  // for us to read. We cannot write to time_observed_at though.
  const timeVal = obsFromApi.time_observed_at
  if (timeVal) {
    return parse(timeVal)
  }
  return parse(obsFromApi.observed_on)
  function parse(v) {
    return dayjs(v).unix() * 1000
  }
}

async function checkForTaskCompletion(task, apiToken) {
  const resp = await getJsonWithAuth(task.statusUrl, apiToken, false)
  const ts = resp.taskStatus
  if (ts === 'pending') {
    console.debug(`facade says task for ${task.uuid} is not yet processed`)
    return false
  }
  if (ts === 'failure') {
    console.warn(`Failure checking for task for ${task.uuid}`)
    await transitionRecord(task.uuid, cc.systemErrorOutcome)
    return true
  }
  if (ts === 'success') {
    console.debug(`Success checking for task for ${task.uuid}`)
    const allRemoteObs = await metaStoreRead(cc.remoteObsKey)
    const indexOfExisting = allRemoteObs.findIndex((e) => e.uuid === task.uuid)
    if (indexOfExisting >= 0) {
      allRemoteObs.splice(indexOfExisting, 0)
    }
    const isUpdateTypeTask = !!resp.upstreamBody
    let summary
    if (isUpdateTypeTask) {
      const mapped = mapObsFromApiIntoOurDomain(resp.upstreamBody)
      summary = mapRemoteRecordToSummary(mapped)
      allRemoteObs.splice(0, 0, mapped)
    }
    await metaStoreWrite(cc.remoteObsKey, allRemoteObs)
    await deleteDbRecordById(task.uuid)
    if (isUpdateTypeTask) {
      _postMessageToUiThread(cc.workerMessages.facadeUpdateSuccess, { summary })
    } else {
      _postMessageToUiThread(cc.workerMessages.facadeDeleteSuccess, {
        theUuid: task.uuid,
      })
    }
    return true
  }
  throw new Error(`Unhandled taskStatus: ${ts}`)
}

export async function getLocalQueueSummary() {
  thumbnailObjectUrlsNoLongerInUse = thumbnailObjectUrlsInUse
  thumbnailObjectUrlsInUse = []
  const pendingTasks = await getAllPendingTasks()
  const result = await mapOverObsStore((r) => {
    const rpo = r.wowMeta[cc.recordProcessingOutcomeFieldName]
    const isEventuallyDeleted = pendingTasks.find(
      (t) => t.type === recordType('delete') && t.uuid === r.uuid,
    )
    const isPossiblyStuck = computeIsPossiblyStuck(r, pendingTasks)
    const currSummary = {
      geolocationAccuracy: r.positional_accuracy,
      inatId: r.inatId,
      lat: r.lat,
      lng: r.lng,
      observedAt: r.observedAt,
      speciesGuess: r.speciesGuess,
      uuid: r.uuid,
      wowMeta: {
        [cc.versionFieldName]: r.wowMeta[cc.versionFieldName],
        [cc.recordTypeFieldName]: r.wowMeta[cc.recordTypeFieldName],
        [cc.recordProcessingOutcomeFieldName]: rpo,
        [cc.isEventuallyDeletedFieldName]: !!isEventuallyDeleted,
        [cc.outcomeLastUpdatedAtFieldName]:
          r.wowMeta[cc.outcomeLastUpdatedAtFieldName],
        // wowUpdatedAt isn't used but is useful for debugging
        wowUpdatedAt: r.wowMeta[cc.wowUpdatedAtFieldName],
        isPossiblyStuck,
        isDraft: rpo === cc.draftOutcome,
        // photosToAdd summary isn't used but is useful for debugging
        [cc.photosToAddFieldName]: (
          r.wowMeta[cc.photosToAddFieldName] || []
        ).map((p) => ({
          type: p.type,
          id: p.id,
          fileSummary: `mime=${_.get(p, 'file.mime')}, size=${_.get(
            p,
            'file.data.byteLength',
          )}`,
        })),
      },
    }
    currSummary.thumbnailUrl = (() => {
      const photos = r.photos || []
      if (!photos.length) {
        return null
      }
      // the spec (http://www.exif.org/Exif2-2.PDF) on page 27 tells us that
      // "Compressed thumbnails shall be recorded in no more than 64KB,
      // including all other data to be recorded in APP1." So if it's bigger,
      // it's *not* a thumbnail.
      const maxSizeForExifThumbnail = 64000
      const firstPhotoWithThumbnail = photos.find((e) => {
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
      return mapPhotoFromDbToUi(firstPhotoWithThumbnail, (u) =>
        thumbnailObjectUrlsInUse.push(u),
      ).url
    })()
    return currSummary
  })
  result.sort(newestObsFirst)
  revokeObjectUrls(thumbnailObjectUrlsNoLongerInUse)
  return result
}

function newestObsFirst(a, b) {
  const ad = a.observedAt
  const bd = b.observedAt
  if (ad < bd) {
    return 1
  }
  if (ad > bd) {
    return -1
  }
  return 0
}

export async function getPhotosForLocalObs(obsUuid) {
  try {
    const record = await getRecord(obsUuid)
    if (!record) {
      throw new Error(`Could not find DB obs record: ${obsUuid}`)
    }
    obsDetailObjectUrls = []
    return (record.photos || []).map((p) => {
      return mapPhotoFromDbToUi(p, (u) => obsDetailObjectUrls.push(u))
    })
  } catch (err) {
    throw ChainedError(`Failed to get DB photos for UUID=${obsUuid}`, err)
  }
}

export function cleanupPhotosForObs() {
  revokeObjectUrls(obsDetailObjectUrls)
}

export async function getFullSizePhotoUrl(photoUuid) {
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
    throw ChainedError(
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
  // "z" doesn't mean anything, it's just a unique fn name
  return (
    // eslint-disable-next-line no-restricted-globals
    self.webkitURL || self.URL || {}
  )
}

export async function saveNewAndScheduleUpload(
  { record, isDraft, apiToken, projectId },
  sendUpdateToFacadeFn = sendUpdateToFacade,
) {
  const newRecordId = uuid()
  let enhancedRecord
  try {
    const outcome = isDraft ? cc.draftOutcome : cc.waitingOutcome
    const newPhotos = await processPhotos(record.addedPhotos)
    enhancedRecord = Object.assign(record, {
      captive_flag: false, // it's *wild* orchid watch
      geoprivacy: 'obscured',
      photos: newPhotos,
      wowMeta: {
        [cc.recordTypeFieldName]: recordType('update'),
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
      const loggingSafeRecord = {
        ...enhancedRecord,
        photos: (enhancedRecord.photos || []).map((p) => ({
          ...p,
          file: '(removed for logging)',
        })),
        obsFieldValues: (enhancedRecord.obsFieldValues || []).map((o) => ({
          // ignore info available elsewhere. Long traces get truncated :(
          fieldId: o.fieldId,
          value: o.value,
        })),
      }
      throw ChainedError(
        `Failed to write record to Db\n` +
          `record=${JSON.stringify(loggingSafeRecord)}`,
        err,
      )
    }
  } catch (err) {
    throw ChainedError(`Failed to save new record to local queue.`, err)
  }
  sendUpdateToFacadeFn(newRecordId, apiToken, projectId)
  return newRecordId
}

export async function retryUpload(ids, apiToken, projectId) {
  const strategies = {
    [recordType('update')]: (recordUuid) => {
      return sendUpdateToFacade(recordUuid, apiToken, projectId)
    },
    [recordType('delete')]: (recordUuid) => {
      return deleteRecord(recordUuid, apiToken)
    },
  }
  for (const currId of ids) {
    const record = await getRecord(currId)
    const rType = record.wowMeta[cc.recordTypeFieldName]
    const strat = strategies[rType]
    if (!strat) {
      throw new Error(`Unhandled record type: ${rType}`)
    }
    await strat(currId)
    // this is fairly implicit. We could recompute things about the obs like
    // isPossiblyStuck and send the values, but I'm trying to avoid the expense
    // of computing that.
    _postMessageToUiThread(cc.workerMessages.onRetryComplete, currId)
  }
}

export async function transitionRecord(recordUuid, targetOutcome) {
  await setRecordProcessingOutcome(recordUuid, targetOutcome)
  _postMessageToUiThread(cc.workerMessages.onLocalRecordTransition, {
    recordUuid,
    targetOutcome,
  })
}

function notifyUiToRefreshLocalRecordQueue() {
  _postMessageToUiThread('refreshLocalRecordQueue')
}

function _postMessageToUiThread(msgKey, data) {
  /* eslint-disable-next-line no-restricted-globals */
  const fnToUse = postMessageFnOverride || self.postMessage
  fnToUse({
    wowKey: msgKey,
    data,
  })
}

async function sendUpdateToFacade(recordUuid, apiToken, projectId) {
  try {
    await transitionRecord(recordUuid, cc.beingProcessedOutcome, true)
    await _sendUpdateToFacade(recordUuid, apiToken, projectId)
    await transitionRecord(recordUuid, cc.successOutcome)
  } catch (err) {
    // record was saved, so we don't need to scare the user. The transition
    // above will make sure the UI reflects the failure.
    wowErrorHandler('Failed to send update to facade', err)
    await transitionRecord(recordUuid, cc.systemErrorOutcome)
  }
}

async function _sendUpdateToFacade(recordUuid, apiToken, projectId) {
  const dbRecord = await getRecord(recordUuid)
  await saveApiToken(apiToken)
  const observation = await mapObsCoreFromOurDomainOntoApi(dbRecord)
  const resp = await postFormDataWithAuth(
    `${cc.facadeSendObsUrlPrefix}/${observation.uuid}`,
    async (form) => {
      form.set('projectId', projectId)
      form.set(
        'observation',
        new Blob([JSON.stringify(observation)], {
          type: 'application/json',
        }),
      )
      await Promise.all(
        dbRecord.wowMeta[cc.photosToAddFieldName].map(
          async ({ id: currId }) => {
            const photo = await getPhotoRecord(currId)
            if (!photo) {
              // FIXME is it wise to push on if a photo is missing?
              console.warn(`Could not load photo with ID=${currId}`)
              return
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
          },
        ),
      )
      form.set(
        cc.photoIdsToDeleteFieldName,
        JSON.stringify(dbRecord.wowMeta[cc.photoIdsToDeleteFieldName] || []),
      )
      form.set(
        cc.obsFieldIdsToDeleteFieldName,
        JSON.stringify(dbRecord.wowMeta[cc.obsFieldIdsToDeleteFieldName] || []),
      )
    },
    apiToken,
  )
  console.debug('Obs update form is sent successfully')
  await addPendingTask({
    uuid: dbRecord.uuid,
    inatId: dbRecord.inatId,
    statusUrl: resp.statusUrl,
    type: recordType('update'),
  })
}

export async function saveEditAndScheduleUpdate(
  { record, photoIdsToDelete, obsFieldIdsToDelete, isDraft, apiToken },
  sendUpdateToFacadeFn = sendUpdateToFacade,
) {
  const editedUuid = record.uuid
  let result
  try {
    const existingRemoteRecord = await getFullRemoteObsDetail(
      record.uuid,
      null,
      false,
    )
    const existingLocalRecord = await getRecord(editedUuid)
    if (!existingLocalRecord && !existingRemoteRecord) {
      throw new Error(
        'Data problem: Cannot find existing local or remote record, ' +
          'cannot continue without at least one',
      )
    }
    const dbRecord = existingLocalRecord || {
      inatId: existingRemoteRecord.inatId,
      uuid: editedUuid,
    }
    const newPhotos = await processPhotos(record.addedPhotos || [])
    const photos = computePhotos(
      existingRemoteRecord,
      dbRecord,
      photoIdsToDelete,
      newPhotos,
    )
    const outcome = isDraft ? cc.draftOutcome : cc.waitingOutcome
    const enhancedRecord = Object.assign(dbRecord, record, {
      photos,
      wowMeta: {
        ...dbRecord.wowMeta,
        [cc.wowUpdatedAtFieldName]: new Date().toString(),
        [cc.recordTypeFieldName]: recordType('update'),
        [cc.recordProcessingOutcomeFieldName]: outcome,
        [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
        [cc.photoIdsToDeleteFieldName]: [
          ...(dbRecord.wowMeta?.[cc.photoIdsToDeleteFieldName] || []),
          ...photoIdsToDelete.filter((id) => {
            const photoIsRemote = id > 0
            return photoIsRemote
          }),
        ],
        [cc.photosToAddFieldName]: [
          ...(dbRecord.wowMeta?.[cc.photosToAddFieldName] || []),
          ...newPhotos,
        ],
        [cc.obsFieldIdsToDeleteFieldName]: [
          ...(dbRecord.wowMeta?.[cc.obsFieldIdsToDeleteFieldName] || []),
          ...obsFieldIdsToDelete,
        ],
      },
    })
    delete enhancedRecord.addedPhotos
    try {
      await storeRecord(enhancedRecord)
      result = wowIdOf(enhancedRecord)
    } catch (err) {
      const loggingSafeRecord = {
        ...enhancedRecord,
        photos: (enhancedRecord.photos || []).map((p) => ({
          ...p,
          file: '(removed for logging)',
        })),
      }
      throw ChainedError(
        `Failed to write record to Db with ` +
          `UUID='${editedUuid}'.\n` +
          `record=${JSON.stringify(loggingSafeRecord)}`,
        err,
      )
    }
  } catch (err) {
    throw ChainedError(
      `Failed to save edited record with UUID='${editedUuid}'`,
      err,
    )
  }
  sendUpdateToFacadeFn(editedUuid, apiToken)
  return result
}

function processPhotos(photos) {
  return photos.map((curr) => {
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

export function deleteRecord(theUuid, apiToken) {
  const doDeleteReqFn = deleteWithAuth
  return _deleteRecord(theUuid, apiToken, doDeleteReqFn)
}

export async function cancelFailedDeletes(dbRecordUuids) {
  await Promise.all(dbRecordUuids.map((currId) => deleteDbRecordById(currId)))
  notifyUiToRefreshLocalRecordQueue()
}

export async function undoLocalEdit(theUuid) {
  try {
    await deleteDbRecordById(theUuid)
    // kill any in-flight task for this ID
    await deletePendingTask(theUuid)
  } catch (err) {
    throw new ChainedError(
      `Failed to undo local edit record for UUID='${theUuid}'`,
      err,
    )
  }
}

async function _deleteRecord(theUuid, apiToken, doDeleteReqFn) {
  if (!theUuid) {
    throw namedError(
      'InvalidState',
      'Tried to delete record for the selected observation but no ' +
        'observation is selected',
    )
  }
  const remoteRecords = await metaStoreRead(cc.remoteObsKey)
  const remoteRecord = remoteRecords.find((e) => e.uuid === theUuid)
  const localRecord = await getRecord(theUuid)
  if (!localRecord && !remoteRecord) {
    throw new Error(
      'Data problem: Cannot find existing local or remote record,' +
        'cannot continue without at least one',
    )
  }
  const dbRecord = {
    ...(localRecord || {}),
    inatId: (remoteRecord || {}).inatId,
    uuid: theUuid,
    wowMeta: {
      ...(localRecord?.wowMeta || {}),
      [cc.wowUpdatedAtFieldName]: new Date().toString(),
      [cc.recordTypeFieldName]: recordType('delete'),
      [cc.recordProcessingOutcomeFieldName]: cc.waitingOutcome,
      [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
    },
  }
  const inatRecordId = dbRecord.inatId || 0
  try {
    await storeRecord(dbRecord)
    await transitionRecord(theUuid, cc.beingProcessedOutcome, true)
    const resp = await doDeleteReqFn(
      `${cc.facadeUrlBase}/observations/${inatRecordId}/${theUuid}`,
      apiToken,
    )
    await transitionRecord(theUuid, cc.successOutcome, true)
    console.debug(`DELETE ${theUuid} sent to API facade successfully`)
    await saveApiToken(apiToken)
    await addPendingTask({
      uuid: theUuid,
      inatId: inatRecordId,
      statusUrl: resp.statusUrl,
      type: recordType('delete'),
    })
  } catch (err) {
    wowErrorHandler('Failed to delete record', err)
    await transitionRecord(theUuid, cc.systemErrorOutcome)
  }
}

export async function doSpeciesAutocomplete(partialText, speciesListType) {
  if (speciesListType === cc.autocompleteTypeHost) {
    // TODO need to build and bundle host tree species list
    return []
  }
  if (!taxaIndex) {
    // we rely on the service worker (and possibly the browser) caches to
    // make this less expensive.
    const url = cc.taxaDataUrl
    const t1 = startTimer(`Fetching taxa index from URL=${url}`)
    const resp = await fetch(url)
    t1.stop()
    const t2 = startTimer('Processing fetched taxa index')
    try {
      const rawData = (await resp.json()).map((e) => {
        const d = deserialise(e)
        return {
          ...d,
          // the UI looks weird with no common name field
          preferredCommonName: d.preferredCommonName || d.name,
        }
      })
      taxaIndex = new Fuse(rawData, {
        keys: ['name', 'preferredCommonName'],
        threshold: 0.4,
      })
    } catch (err) {
      throw ChainedError('Failed to fetch and build taxa index', err)
    } finally {
      t2.stop()
    }
  }
  return taxaIndex
    .search(partialText)
    .map((e) => e.item)
    .slice(0, cc.maxSpeciesAutocompleteResultLength)
}

function startTimer(task) {
  const start = Date.now()
  return {
    stop() {
      console.debug(`${task} took ${Date.now() - start}ms`)
    },
  }
}

function computePhotos(
  existingRemoteRecord,
  dbRecord,
  photoIdsToDelete,
  newPhotos,
) {
  const existingRemotePhotos = existingRemoteRecord?.photos || []
  const wowMeta = dbRecord.wowMeta || {}
  const existingLocalPhotos = wowMeta[cc.photosToAddFieldName] || []
  const existingQueuedDeletes = wowMeta?.[cc.photoIdsToDeleteFieldName] || []
  const allPendingPhotoDeletes = [...photoIdsToDelete, ...existingQueuedDeletes]
  const photosWithDeletesApplied = [
    ...existingRemotePhotos,
    ...existingLocalPhotos,
    ...newPhotos,
  ].filter((p) => {
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

export async function getAllPendingTasks() {
  const taskMapping = await _getPendingTasks()
  return Object.values(taskMapping)
}

async function _getPendingTasks() {
  const raw = await metaStoreRead(cc.pendingTasksKey)
  return raw || {}
}

async function _setPendingTasks(tasks) {
  if (Object.keys(tasks).length === 0) {
    clearTimeout(taskChecksTracker)
  }
  await metaStoreWrite(cc.pendingTasksKey, tasks)
}

async function addPendingTask(task) {
  if (!task.uuid) {
    throw new Error(`Task has no UUID: ${JSON.stringify(task)}`)
  }
  // FIXME is it safe to only have one pending task for a uuid? When a new task
  //  comes in, we clobber the old one. If that's the case, we also need a way
  //  to cancell the polling. Maybe stop spinning off separate fns and have a
  //  periodic processor that fires all due tasks and sends events on
  //  completion.
  const taskMapping = await _getPendingTasks()
  task.dateAdded = new Date().toString() // for debugging
  taskMapping[task.uuid] = task
  await _setPendingTasks(taskMapping)
  const enoughMsForServerToPossiblyProcessUpload = 20 * 1000
  scheduleTaskChecks(enoughMsForServerToPossiblyProcessUpload)
}

export async function deletePendingTask(theUuid) {
  // not atomic, just hope no task gets added after read but before write. I
  // think single threaded JS saves us.
  const taskMapping = await _getPendingTasks()
  delete taskMapping[theUuid]
  await _setPendingTasks(taskMapping)
}

// assumption: apiToken will only be refreshed when a user does something, and
//  that doing something will trigger these task checks
export function scheduleTaskChecks(delayMs = 13) {
  if (taskChecksTracker) {
    console.debug('Asked to schedule checks, but already running')
    return
  }
  taskChecksTracker = {}
  taskChecksTracker.intervalObj = setTimeout(() => {
    const promise = runChecksForTasks()
    taskChecksTracker.promise = promise
    promise.catch((err) => {
      // FIXME send to Sentry?
      console.error('Failed to run checks for tasks', err)
    })
  }, delayMs)
}

async function runChecksForTasks() {
  const apiToken = await metaStoreRead(cc.apiTokenKey)
  if (!apiToken) {
    console.warn('No apiToken, refusing to run checks')
    return
  }
  // FIXME could decode JWT and check expiry. If expired, renew and send
  //  message to UI thread to update vuex.
  const tasks = await getAllPendingTasks()
  for (const curr of tasks) {
    console.debug('[Poll] Doing check for task', curr.uuid)
    try {
      const isComplete = await checkForTaskCompletion(curr, apiToken)
      if (isComplete) {
        // note: complete != success
        await deletePendingTask(curr.uuid)
      }
    } catch (err) {
      const isAuthError = err.httpStatus === 401
      if (isAuthError) {
        console.warn(
          `Failed to check for task ${curr.uuid} due to ` +
            'expired auth, requesting fresh token',
        )
        _postMessageToUiThread(cc.workerMessages.requestApiTokenRefresh)
      } else {
        console.error(`Failed to check for task ${curr.uuid}`, err)
      }
      // FIXME do we need to cancel the task or something?
    }
  }
  taskChecksTracker = null
  const remainingTasks = await getAllPendingTasks()
  if (!remainingTasks.length) {
    console.debug('[Poll] no tasks left, not scheduling another check')
    return
  }
  console.debug('[Poll] tasks remain, scheduling another check')
  scheduleTaskChecks(cc.frequencyOfTaskChecksSeconds * 1000)
}

export async function optimisticallyUpdateComments(obsId, commentRecord) {
  const allRemoteObs = await metaStoreRead(cc.remoteObsKey)
  const targetObsIndex = allRemoteObs.findIndex((e) => e.inatId === obsId)
  if (targetObsIndex < 0) {
    throw new Error(
      `Could not find existing remote obs with ID='${obsId}' from IDs=${JSON.stringify(
        allRemoteObs.map((o) => o.inatId),
      )}`,
    )
  }
  const targetObs = allRemoteObs[targetObsIndex]
  const obsComments = targetObs.comments || []
  const strategy = (() => {
    const existingCommentUuids = obsComments.map((c) => c.uuid)
    const key =
      `${commentRecord.body ? '' : 'no-'}body|` +
      `${existingCommentUuids.includes(commentRecord.uuid) ? 'not-' : ''}new`
    const result = {
      'body|new': function newStrategy() {
        obsComments.push(mapCommentFromApiToOurDomain(commentRecord))
      },
      'body|not-new': function editStrategy() {
        const targetComment = obsComments.find(
          (c) => c.uuid === commentRecord.uuid,
        )
        if (!targetComment) {
          throw new Error(
            `Could not find comment with UUID='${commentRecord.uuid}' to ` +
              `edit. Available comment UUIDs=${JSON.stringify(
                obsComments.map((c) => c.uuid),
              )}`,
          )
        }
        Object.keys(commentRecord).forEach((currKey) => {
          targetComment[currKey] = commentRecord[currKey]
        })
      },
      'no-body|not-new': function deleteStrategy() {
        const indexOfComment = obsComments.findIndex(
          (e) => e.uuid === commentRecord.uuid,
        )
        if (!~indexOfComment) {
          throw new Error(
            `Could not find comment with UUID='${commentRecord.uuid}' to ` +
              `delete. Available comment UUIDs=${JSON.stringify(
                obsComments.map((c) => c.uuid),
              )}`,
          )
        }
        obsComments.splice(indexOfComment, 1)
      },
    }[key]
    if (!result) {
      throw new Error(`Programmer problem: no strategy found for key='${key}'`)
    }
    return result
  })()
  console.debug(`Using strategy='${strategy.name}' to modify comments`)
  strategy()
  updateIdsAndCommentsFor(targetObs)
  allRemoteObs.splice(targetObsIndex, 1, targetObs)
  metaStoreWrite(cc.remoteObsKey, allRemoteObs)
}

export async function saveApiToken(apiToken) {
  await metaStoreWrite(cc.apiTokenKey, apiToken)
}

async function metaStoreRead(key) {
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  return metaStore.getItem(key)
}

async function metaStoreWrite(key, val) {
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
  return metaStore.setItem(key, val)
}

// eslint-disable-next-line import/prefer-default-export
export const _testonly = {
  _deleteRecord,
  mapObsFromApiIntoOurDomain,
  doFacadeMigration,
  overridePostMessageFn(fn) {
    postMessageFnOverride = fn
  },
}
