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
  performMigrationsInWorker,
  processObsFieldName,
  registerUuidGenerator,
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
  putFormDataWithAuth,
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
registerUuidGenerator(uuid)
let taxaIndex = null
let taskChecksTracker = null
let thumbnailObjectUrlsInUse = []
let thumbnailObjectUrlsNoLongerInUse = []
let obsDetailObjectUrls = []

export async function performMigrations() {
  await performMigrationsInWorker()
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

async function cleanLocalRecord(recordUuid, newRecordSummary) {
  console.debug(
    `[cleanLocalRecord] cleaning local record with UUID=${recordUuid}`,
  )
  const blockedAction = await (async () => {
    // FIXME not sure we need blockedAction support any more
    const record = await getRecord(recordUuid)
    if (!record) {
      return
    }
    if (!newRecordSummary) {
      throw new Error(
        `Blocked action present, but no summary passed for UUID=${recordUuid}`,
      )
    }
    const blockedActionFromDb = record.wowMeta[cc.blockedActionFieldName]
    if (!blockedActionFromDb) {
      return
    }
    console.debug(
      `[cleanLocalRecord] enqueuing blocked action for UUID=${recordUuid}`,
    )
    return {
      // note: the record body has already been updated in-place, it's just
      // the wowMeta changes that store the blocked action. That's why we use
      // the record body as-is.
      ...record,
      inatId: newRecordSummary.inatId,
      wowMeta: {
        ...blockedActionFromDb.wowMeta,
        [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
      },
    }
  })()
  await deleteDbRecordById(recordUuid)
  if (blockedAction) {
    // FIXME do we need to explicitly delete photos from the replaced record?
    // We could leverage the storeRecord fn by injecting the IDs into the
    // record.
    await storeRecord(blockedAction)
    // FIXME probably should trigger sending to facade
  }
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
    const result = {
      url: p.photo.url,
      uuid: p.uuid,
      id: p.id,
      [cc.isRemotePhotoFieldName]: true,
    }
    verifyWowDomainPhoto(result)
    return result
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

async function checkForObsCreateCompletion(task, apiToken) {
  const resp = await getJsonWithAuth(task.statusUrl, apiToken, false)
  const ts = resp.taskStatus
  if (ts === 'processing') {
    console.debug(`facade says record ${task.uuid} is not yet created`)
    return false
  }
  if (ts === 'failure') {
    console.warn(`Failure checking for create ${task.uuid}`)
    await transitionRecord(task.uuid, cc.systemErrorOutcome)
    return true
  }
  if (ts === 'success') {
    console.debug(`Success checking for create ${task.uuid}`)
    const mapped = mapObsFromApiIntoOurDomain(resp.upstreamBody)
    const summary = mapRemoteRecordToSummary(mapped)
    await cleanLocalRecord(task.uuid, summary)
    const remoteObs = await metaStoreRead(cc.remoteObsKey)
    remoteObs.splice(0, 0, mapped)
    await metaStoreWrite(cc.remoteObsKey, remoteObs)
    _postMessageToUiThread(cc.workerMessages.facadeCreateSuccess, { summary })
    return true
  }
  throw new Error(`Unhandled taskStatus: ${ts}`)
}

async function checkForObsEditCompletion(task, apiToken) {
  const resp = await getJsonWithAuth(task.statusUrl, apiToken, false)
  const ts = resp.taskStatus
  if (ts === 'processing') {
    console.debug(`facade says record ${task.uuid} is not yet edited`)
    return false
  }
  if (ts === 'failure') {
    console.warn(`Failure checking for edit ${task.uuid}`)
    await transitionRecord(task.uuid, cc.systemErrorOutcome)
    return true
  }
  if (ts === 'success') {
    console.debug(`Success checking for edit ${task.uuid}`)
    const mapped = mapObsFromApiIntoOurDomain(resp.upstreamBody)
    const summary = mapRemoteRecordToSummary(mapped)
    await cleanLocalRecord(task.uuid, summary)
    const remoteObs = await metaStoreRead(cc.remoteObsKey)
    const indexOfExisting = remoteObs.findIndex((e) => e.uuid === task.uuid)
    if (indexOfExisting >= 0) {
      remoteObs.splice(indexOfExisting, 0)
    }
    remoteObs.splice(0, 0, mapped)
    await metaStoreWrite(cc.remoteObsKey, remoteObs)
    _postMessageToUiThread(cc.workerMessages.facadeEditSuccess, { summary })
    return true
  }
  throw new Error(`Unhandled taskStatus: ${ts}`)
}

async function checkForDeleteCompletion(task, apiToken) {
  const { inatId } = task
  const resp = await getJsonWithAuth(
    `${cc.facadeUrlBase}/task-status/${inatId}/delete`,
    apiToken,
    false,
  )
  const ts = resp.taskStatus
  if (ts === 'processing') {
    console.debug(`facade says record ${inatId} still exists`)
    return false
  }
  if (ts === 'success') {
    console.debug(`Success checking for DELETE ${inatId}`)
    // FIXME remove obs from remote obs cache?
    _postMessageToUiThread(cc.workerMessages.facadeDeleteSuccess, {
      theUuid: task.uuid,
    })
    return true
  }
  throw new Error(`Unhandled taskStatus: ${ts}`)
}

export async function getLocalQueueSummary() {
  thumbnailObjectUrlsNoLongerInUse = thumbnailObjectUrlsInUse
  thumbnailObjectUrlsInUse = []
  const pendingTaskUuids = (await getAllPendingTasks()).map((t) => t.uuid)
  const result = await mapOverObsStore((r) => {
    const hasBlockedAction = !!r.wowMeta[cc.blockedActionFieldName]
    const isEventuallyDeleted = hasBlockedAction
      ? r.wowMeta[cc.blockedActionFieldName].wowMeta[cc.recordTypeFieldName] ===
        recordType('delete')
      : r.wowMeta[cc.recordTypeFieldName] === recordType('delete')
    const rpo = r.wowMeta[cc.recordProcessingOutcomeFieldName]
    const isPossiblyStuck = (() => {
      const isPendingTask = pendingTaskUuids.includes(r.uuid)
      const isBeingProcessed = rpo === cc.beingProcessedOutcome
      return isBeingProcessed && !isPendingTask
    })()
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
        [cc.isEventuallyDeletedFieldName]: isEventuallyDeleted,
        [cc.recordProcessingOutcomeFieldName]: rpo,
        [cc.hasBlockedActionFieldName]: hasBlockedAction,
        [cc.outcomeLastUpdatedAtFieldName]:
          r.wowMeta[cc.outcomeLastUpdatedAtFieldName],
        // wowUpdatedAt isn't used but is useful for debugging
        wowUpdatedAt: r.wowMeta[cc.wowUpdatedAtFieldName],
        isPossiblyStuck,
        isDraft: rpo === cc.draftOutcome,
        // photosToAdd summary isn't used but is useful for debugging
        [cc.photosToAddFieldName]: r.wowMeta[cc.photosToAddFieldName].map(
          (p) => ({
            type: p.type,
            id: p.id,
            fileSummary: `mime=${_.get(p, 'file.mime')}, size=${_.get(
              p,
              'file.data.byteLength',
            )}`,
          }),
        ),
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
  { record, isDraft, apiToken, projectId},
  sendNewObsToFacadeFn = sendNewObsToFacade,
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
  sendNewObsToFacadeFn(newRecordId, apiToken, projectId)
  return newRecordId
}

// FIXME can we have the worker do all network requests and apiToken is stored
//  in localForage. Worker can load apiToken whenever it needs it, and if
//  expired (either decode JWT or 401) we can refresh and send message to UI
//  that it's been updated.

export async function retryUpload(ids, apiToken, projectId) {
  const strategies = {
    [recordType('new')]: (recordUuid) => {
      return sendNewObsToFacade(recordUuid, apiToken, projectId)
    },
    [recordType('edit')]: (recordUuid) => {
      return sendEditObsToFacade(recordUuid, apiToken)
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
  // eslint-disable-next-line no-restricted-globals
  self.postMessage({
    wowKey: msgKey,
    data,
  })
}

async function sendNewObsToFacade(recordUuid, apiToken, projectId) {
  try {
    await transitionRecord(recordUuid, cc.beingProcessedOutcome, true)
    await _sendNewObsToFacade(recordUuid, apiToken, projectId)
    await transitionRecord(recordUuid, cc.successOutcome)
  } catch (err) {
    // record was saved, so we don't need to scare the user. The transition
    // above will make sure the UI reflects the failure.
    wowErrorHandler('Failed to send new record to facade', err)
    await transitionRecord(recordUuid, cc.systemErrorOutcome)
  }
}

async function _sendNewObsToFacade(recordUuid, apiToken, projectId) {
  const dbRecord = await getRecord(recordUuid)
  await saveApiToken(apiToken)
  const observation = await mapObsCoreFromOurDomainOntoApi(dbRecord)
  const newPhotoIds = (dbRecord.wowMeta[cc.photosToAddFieldName] || []).map(
    (e) => e.id,
  )
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
  await addPendingTask({
    uuid: dbRecord.uuid,
    statusUrl: resp.statusUrl,
    type: recordType('new'),
  })
}

async function sendEditObsToFacade(recordUuid, apiToken) {
  try {
    await transitionRecord(recordUuid, cc.beingProcessedOutcome, true)
    await _sendEditObsToFacade(recordUuid, apiToken)
    await transitionRecord(recordUuid, cc.successOutcome)
  } catch (err) {
    // record was saved, so we don't need to scare the user. The transition
    // above will make sure the UI reflects the failure.
    wowErrorHandler('Failed to send edit record to facade', err)
    await transitionRecord(recordUuid, cc.systemErrorOutcome)
  }
}

async function _sendEditObsToFacade(recordUuid, apiToken) {
  const dbRecord = await getRecord(recordUuid)
  await saveApiToken(apiToken)
  const observation = await mapObsCoreFromOurDomainOntoApi(dbRecord)
  const newPhotoIds = (dbRecord.wowMeta[cc.photosToAddFieldName] || []).map(
    (e) => e.id,
  )
  const resp = await putFormDataWithAuth(
    `${cc.facadeSendObsUrlPrefix}/${observation.uuid}`,
    async (form) => {
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
        JSON.stringify(dbRecord.wowMeta[cc.photoIdsToDeleteFieldName] || []),
      )
      form.set(
        cc.obsFieldIdsToDeleteFieldName,
        JSON.stringify(dbRecord.wowMeta[cc.obsFieldIdsToDeleteFieldName] || []),
      )
    },
    apiToken,
  )
  console.debug('Obs edit form is sent')
  await addPendingTask({
    uuid: dbRecord.uuid,
    statusUrl: resp.statusUrl,
    type: recordType('edit'),
  })
}

export async function saveEditAndScheduleUpdate(
  { record, photoIdsToDelete, obsFieldIdsToDelete, isDraft, apiToken },
  runStrategy = realRunStrategy,
  sendEditObsToFacadeFn = sendEditObsToFacade,
) {
  const editedUuid = record.uuid
  let enhancedRecord
  try {
    const existingRemoteRecord = await getFullRemoteObsDetail(
      record.uuid,
      null,
      false,
    )
    const existingLocalRecord = await getRecord(editedUuid)
    if (!existingLocalRecord && !existingRemoteRecord) {
      throw new Error(
        'Data problem: Cannot find existing local or remote record,' +
          'cannot continue without at least one',
      )
    }
    const dbRecord = existingLocalRecord || {
      inatId: (existingRemoteRecord || {}).inatId,
      uuid: editedUuid,
    }
    const newPhotos = (await processPhotos(record.addedPhotos)) || []
    const photos = computePhotos(
      existingRemoteRecord,
      dbRecord,
      photoIdsToDelete,
      newPhotos,
    )
    const outcome = isDraft ? cc.draftOutcome : cc.waitingOutcome
    enhancedRecord = Object.assign(dbRecord, record, {
      photos,
      uuid: editedUuid,
      wowMeta: {
        ...dbRecord.wowMeta,
        [cc.recordTypeFieldName]: recordType('edit'),
        [cc.wowUpdatedAtFieldName]: new Date().toString(),
        [cc.recordProcessingOutcomeFieldName]: outcome,
        [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
      },
    })
    delete enhancedRecord.addedPhotos
    try {
      const strategy = getEditStrategy(
        existingLocalRecord,
        existingRemoteRecord,
      )
      console.debug(`[Edit] using strategy='${strategy.name}'`)
      await runStrategy(strategy, {
        record: enhancedRecord,
        photoIdsToDelete: photoIdsToDelete.filter((id) => {
          const photoIsRemote = id > 0
          return photoIsRemote
        }),
        newPhotos,
        obsFieldIdsToDelete,
      })
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
  sendEditObsToFacadeFn(editedUuid, apiToken)
  return wowIdOf(enhancedRecord)
}

function getEditStrategy(existingLocalRecord, existingRemoteRecord) {
  const isProcessingQueuedNow =
    existingLocalRecord &&
    isObsStateProcessing(
      existingLocalRecord.wowMeta[cc.recordProcessingOutcomeFieldName],
    )
  const isThisIdQueued = !!existingLocalRecord
  const isExistingBlockedAction =
    existingLocalRecord &&
    existingLocalRecord.wowMeta[cc.hasBlockedActionFieldName]
  // FIXME can we simplify this? It shouldn't be possible to catch a local
  //  record process or queued. It should be either success or error.
  const strategyKey =
    `${isProcessingQueuedNow ? '' : 'no'}processing.` +
    `${isThisIdQueued ? '' : 'no'}queued.` +
    `${isExistingBlockedAction ? '' : 'no'}existingblocked.` +
    `${existingRemoteRecord ? '' : 'no'}remote`
  console.debug(`[Edit] strategy key=${strategyKey}`)
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
      return (args) => {
        // edits of local-only records *need* to result in a 'new' typed
        // record so we process them with a POST. We can't PUT when
        // there's nothing to update.
        args.record.wowMeta[cc.recordTypeFieldName] = recordType('new')
        // FIXME verify this ^ works
        return upsertQueuedAction(args)
      }
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

    // IMPOSSIBLE
    default:
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

function isObsStateProcessing(state) {
  const processingStates = [cc.beingProcessedOutcome]
  return processingStates.includes(state)
}

export function deleteRecord(theUuid, apiToken) {
  const doDeleteReqFn = deleteWithAuth
  return _deleteRecord(theUuid, apiToken, doDeleteReqFn)
}

export async function cancelFailedDeletes(dbRecordUuids) {
  await Promise.all(dbRecordUuids.map((currId) => deleteDbRecordById(currId)))
  notifyUiToRefreshLocalRecordQueue()
}

async function _deleteRecord(theUuid, apiToken, doDeleteReqFn) {
  if (!theUuid) {
    throw namedError(
      'InvalidState',
      'Tried to delete record for the selected observation but no ' +
        'observation is selected',
    )
  }
  const localRecord = await getRecord(theUuid)
  if (localRecord) {
    try {
      await deleteDbRecordById(theUuid)
    } catch (err) {
      throw new ChainedError(
        `Failed to delete local record for UUID='${theUuid}'`,
        err,
      )
    }
  }
  const remoteRecords = await metaStoreRead(cc.remoteObsKey)
  const remoteRecord = remoteRecords.find((e) => e.uuid === theUuid)
  if (!remoteRecord) {
    console.info('Observation is local-only, no need to contact iNat')
    // kill any in-flight task for this ID
    await deletePendingTask(theUuid) // FIXME verify works
    _postMessageToUiThread(cc.workerMessages.facadeDeleteSuccess, { theUuid })
    return
  }
  const inatRecordId = remoteRecord.inatId
  if (!inatRecordId) {
    throw new Error(
      `Could not find inatId for ${theUuid}; remote record=${JSON.strategies(
        remoteRecord,
      )}`,
    )
  }
  // FIXME handle errors
  await doDeleteReqFn(`${cc.apiUrlBase}/observations/${inatRecordId}`, apiToken)
  console.debug(`DELETE ${inatRecordId} sent to iNat successfully`)
  await saveApiToken(apiToken)
  await addPendingTask({
    uuid: theUuid,
    inatId: inatRecordId,
    type: recordType('delete'),
  })
}

function realRunStrategy(strategyFn, ...args) {
  // only exists so we can stub it during tests
  return strategyFn(...args)
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
  // FIXME could decode JWT and check expiry
  const tasks = await getAllPendingTasks()
  for (const curr of tasks) {
    const strategies = {
      [recordType('new')]: checkForObsCreateCompletion,
      [recordType('edit')]: checkForObsEditCompletion,
      [recordType('delete')]: checkForDeleteCompletion,
    }
    const rType = curr.type
    const strat = strategies[rType]
    if (!strat) {
      throw new Error(`Unhandled record type: ${rType}`)
    }
    console.debug('[Poll] Doing check for task', curr.uuid)
    try {
      const isComplete = await strat(curr, apiToken)
      if (isComplete) {
        // note: complete != success
        await deletePendingTask(curr.uuid)
      }
    } catch (err) {
      console.error(`Failed to "${strat.name}" for task ${curr.uuid}`, err)
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

async function saveApiToken(apiToken) {
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
  upsertBlockedAction,
  upsertQueuedAction,
}
