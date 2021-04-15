import _ from 'lodash'
import dayjs from 'dayjs'
import Fuse from 'fuse.js'
import { wrap as comlinkWrap } from 'comlink'
import Semaphore from '@chriscdn/promise-semaphore'
import {
  deleteDbRecordById,
  getRecord,
  healthcheckStore,
  mapObsFullFromOurDomainOntoApi,
  registerWarnHandler,
  storeRecord,
} from '@/indexeddb/obs-store-common'
import * as constants from '@/misc/constants'
import {
  buildStaleCheckerFn,
  chainedError,
  fetchSingleRecord,
  getJson,
  isNoSwActive,
  makeObsRequest,
  namedError,
  now,
  recordTypeEnum as recordType,
  triggerSwWowQueue,
  verifyWowDomainPhoto,
  wowIdOf,
  wowErrorHandler,
  wowWarnHandler,
  wowWarnMessage,
} from '@/misc/helpers'
import { deserialise } from '@/misc/taxon-s11n'

registerWarnHandler(wowWarnMessage)
const anyFromOutcome = []
let refreshLocalRecordQueueLock = null
let obsStoreWorker = null
function getObsStoreWorker() {
  if (!obsStoreWorker) {
    obsStoreWorker = interceptableFns.buildWorker()
  }
  return obsStoreWorker
}
let taxaIndex = null

const initialState = {
  allRemoteObs: [],
  allRemoteObsLastUpdated: 0,
  isUpdatingRemoteObs: false,
  mySpecies: [],
  mySpeciesLastUpdated: 0,
  selectedObservationUuid: null,
  _uiVisibleLocalRecords: [],
  localQueueSummary: [],
  projectInfo: null,
  projectInfoLastUpdated: 0,
  recentlyUsedTaxa: {},
  forceQueueProcessingAtNextChance: false,
  lastUsedResponses: {},
  uuidsInSwQueues: [],
}

const mutations = {
  setSelectedObservationUuid: (state, value) =>
    (state.selectedObservationUuid = value),
  setMySpecies: (state, value) => {
    state.mySpecies = value
    state.mySpeciesLastUpdated = now()
  },
  setAllRemoteObs: (state, value) => {
    state.allRemoteObs = value
    state.allRemoteObsLastUpdated = now()
  },
  setProjectInfo: (state, value) => {
    state.projectInfo = value
    state.projectInfoLastUpdated = now()
  },
  setIsUpdatingRemoteObs: (state, value) => (state.isUpdatingRemoteObs = value),
  setUiVisibleLocalRecords: (state, value) =>
    (state._uiVisibleLocalRecords = value),
  setLocalQueueSummary: (state, value) => (state.localQueueSummary = value),
  setRecentlyUsedTaxa: (state, value) => (state.recentlyUsedTaxa = value),
  addRecentlyUsedTaxa: (state, { type, value }) => {
    const isNothingSelected = !value
    if (isNothingSelected) {
      return
    }
    const stack = state.recentlyUsedTaxa[type] || []
    const existingIndex = stack.findIndex(e => {
      // objects from the store don't keep nil-ish props
      const valueWithoutNilishProps = _.omitBy(value, _.isNil)
      return _.isEqual(e, valueWithoutNilishProps)
    })
    const isValueAlreadyInStack = existingIndex >= 0
    if (isValueAlreadyInStack) {
      stack.splice(existingIndex, 1)
    }
    stack.splice(0, 0, value)
    const maxItems = 20
    state.recentlyUsedTaxa[type] = stack.slice(0, maxItems)
  },
  setForceQueueProcessingAtNextChance: (state, value) =>
    (state.forceQueueProcessingAtNextChance = value),
  setLastUsedResponses: (state, value) => (state.lastUsedResponses = value),
  setUuidsInSwQueues: (state, value) => (state.uuidsInSwQueues = value),
}

const actions = {
  async refreshRemoteObsWithDelay({ dispatch }) {
    const delayToLetServerPerformIndexingMs =
      constants.waitBeforeRefreshSeconds * 1000
    console.debug(
      `Sleeping for ${delayToLetServerPerformIndexingMs}ms before refreshing remote`,
    )
    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, delayToLetServerPerformIndexingMs)
    })
    await dispatch('refreshRemoteObs')
  },
  async refreshRemoteObs({ commit, dispatch, rootGetters }) {
    commit('setIsUpdatingRemoteObs', true)
    dispatch('refreshObsUuidsInSwQueue')
    // TODO look at only pulling "new" records to save on bandwidth
    try {
      const myUserId = rootGetters.myUserId
      if (!myUserId) {
        console.debug(
          'No userID present, refusing to try to get my observations',
        )
        return
      }
      const baseUrl =
        `/observations` +
        `?user_id=${myUserId}` +
        `&project_id=${constants.inatProjectSlug}`
      const allRawRecords = await dispatch(
        'fetchAllPages',
        { baseUrl, pageSize: constants.obsPageSize },
        { root: true },
      )
      const allMappedRecords = allRawRecords.map(mapObsFromApiIntoOurDomain)
      commit('setAllRemoteObs', allMappedRecords)
      await dispatch('cleanSuccessfulLocalRecordsRemoteHasEchoed')
    } catch (err) {
      dispatch(
        'flagGlobalError',
        {
          msg: 'Failed to refresh remote observations',
          userMsg: 'Error while trying to update observations list',
          err,
        },
        { root: true },
      )
      return
    } finally {
      commit('setIsUpdatingRemoteObs', false)
    }
  },
  async refreshObsUuidsInSwQueue({ commit }) {
    try {
      const isNoServiceWorkerAvailable = await isNoSwActive()
      if (isNoServiceWorkerAvailable) {
        return
      }
      const uuids = await getJson(
        constants.serviceWorkerObsUuidsInQueueUrl,
        false,
      )
      if (!Array.isArray(uuids)) {
        throw new Error(
          `Unexpected value. uuids=${JSON.stringify(
            uuids,
          )} should be an array but seems to not be.`,
        )
      }
      commit('setUuidsInSwQueues', uuids)
    } catch (err) {
      // not using flagGlobalError because we don't need to bother the user
      wowErrorHandler(
        'Failed to get list of obs UUIDs that in SW queues, falling back to ' +
          'an empty array',
        err,
      )
      commit('setUuidsInSwQueues', [])
    }
  },
  async cleanSuccessfulLocalRecordsRemoteHasEchoed({
    state,
    getters,
    dispatch,
  }) {
    // TODO WOW-135 look at moving this whole function body off the main
    // thread
    const uuidsOfRemoteRecords = state.allRemoteObs.map(e => e.uuid)
    const lastUpdatedDatesOnRemote = state.allRemoteObs.reduce(
      (accum, curr) => {
        accum[curr.uuid] = curr.updatedAt
        return accum
      },
      {},
    )
    const localUpdatedDates = getters.successfulLocalQueueSummary.reduce(
      (accum, curr) => {
        accum[curr.uuid] = curr[constants.wowUpdatedAtFieldName]
        return accum
      },
      {},
    )
    const logPrefix = '[clean check]'
    const successfulLocalRecordDbIdsToDelete = getters.successfulLocalQueueSummary
      .filter(e => {
        const theRecordType = e[constants.recordTypeFieldName]
        switch (theRecordType) {
          case recordType('new'):
            return (() => {
              const isNewAndPresent = uuidsOfRemoteRecords.includes(e.uuid)
              console.debug(
                `${logPrefix} UUID=${e.uuid} is new and ` +
                  `present=${isNewAndPresent}`,
              )
              return isNewAndPresent
            })()
          case recordType('edit'):
            return (() => {
              const currUpdatedDateOnRemote = lastUpdatedDatesOnRemote[e.uuid]
              if (!currUpdatedDateOnRemote) {
                console.debug(`${logPrefix} UUID=${e.uuid} is not on remote.`)
                wowWarnHandler(
                  `Obs with UUID=${e.uuid}/iNatID=${e.inatId} is not found ` +
                    `on remote. Maybe it was deleted or removed from the ` +
                    `project.`,
                )
                // TODO not 100% if this is the right response. By returning
                // true, the record will be cleaned up so it won't be sitting
                // in the user's obs list in limbo forever. But if something
                // else has gone wrong, we'd be losing this obervation forever.
                // The assumption is the obs has been consciously removed
                // elsewhere so we're also cleaning up here.
                return true
              }
              const secondsRemoteUpdateDateIsAheadOfLocal =
                // remote times are rounded to the second
                (dayjs(currUpdatedDateOnRemote) -
                  dayjs(localUpdatedDates[e.uuid]).startOf('second')) /
                1000
              const isUpdatedOnRemoteAfterLocalUpdate =
                currUpdatedDateOnRemote &&
                secondsRemoteUpdateDateIsAheadOfLocal >= 0
              const isEditAndUpdated =
                uuidsOfRemoteRecords.includes(e.uuid) &&
                isUpdatedOnRemoteAfterLocalUpdate
              console.debug(
                `${logPrefix} UUID=${e.uuid} is edit and ` +
                  `updated=${isEditAndUpdated}, remote is ahead of local by ` +
                  `${secondsRemoteUpdateDateIsAheadOfLocal}s (${dayjs
                    .duration(secondsRemoteUpdateDateIsAheadOfLocal, 's')
                    .humanize(true)})`,
              )
              return isEditAndUpdated
            })()
          case recordType('delete'):
            return (() => {
              const isDeleteAndNotPresent = !uuidsOfRemoteRecords.includes(
                e.uuid,
              )
              console.debug(
                `${logPrefix} UUID=${e.uuid} is delete and not ` +
                  `present=${isDeleteAndNotPresent}`,
              )
              return isDeleteAndNotPresent
            })()
          default:
            wowWarnMessage(
              `Programmer problem: unhandled record type=${theRecordType}`,
            )
            return false
        }
      })
      .map(e => e.uuid)
    console.debug(
      `Deleting Db IDs that remote ` +
        `has confirmed as successful=[${successfulLocalRecordDbIdsToDelete}]`,
    )
    const dbIdsOfDeletesWithErrorThatNoLongerExistOnRemote = state.localQueueSummary
      .filter(
        e =>
          getters.deletesWithErrorDbIds.includes(e.uuid) &&
          !uuidsOfRemoteRecords.includes(e.uuid),
      )
      .map(e => e.uuid)
    const dbIdsToDelete = [
      ...dbIdsOfDeletesWithErrorThatNoLongerExistOnRemote,
      ...successfulLocalRecordDbIdsToDelete,
    ]
    const idsWithBlockedActions = state.localQueueSummary
      .filter(e => e[constants.hasBlockedActionFieldName])
      .map(e => e.uuid)
    try {
      await Promise.all(
        dbIdsToDelete.map(currDbId => {
          return Promise.all([
            dispatch('checkForLostPhotos', currDbId),
            dispatch('cleanLocalRecord', {
              currDbId,
              idsWithBlockedActions,
            }),
          ])
        }),
      )
      await dispatch('refreshLocalRecordQueue')
    } catch (err) {
      throw chainedError(
        `Failed while trying to delete the following ` +
          `IDs from Db=[${successfulLocalRecordDbIdsToDelete}]`,
        err,
      )
    }
  },
  async cleanLocalRecord({ state }, { currDbId, idsWithBlockedActions }) {
    const blockedAction = await (async () => {
      const hasBlockedAction = idsWithBlockedActions.includes(currDbId)
      if (!hasBlockedAction) {
        return null
      }
      const record = await getRecord(currDbId)
      if (!record) {
        // I guess this could be TOCTOU related where the DB record is
        // gone but the queue summary has not yet updated.
        wowWarnMessage(
          `No obs found for ID=${currDbId}. The queue summary ` +
            `indicated there was a blocked action for this record but ` +
            `when we tried to retrieve the record, nothing was there. ` +
            `This shouldn't happen, even if the user deletes the obs, ` +
            `as that would be a block action itself.`,
        )
        return null
      }
      console.debug(
        `[cleanLocalRecord] enqueuing blocked action for UUID=${currDbId}`,
      )
      const remoteRecord = state.allRemoteObs.find(e => e.uuid === currDbId)
      if (!remoteRecord) {
        // this is weird because the reason we're processing this
        // record is *because* we saw it in the list of remote records
        throw new Error(
          `Unable to find remote record with UUID='${currDbId}', ` +
            'cannot continue.',
        )
      }
      const blockedActionFromDb =
        record.wowMeta[constants.blockedActionFieldName]
      return {
        // note: the record body has already been updated in-place, it's just
        // the wowMeta changes that store the blocked action. That's why we use
        // the record body as-is.
        ...record,
        inatId: remoteRecord.inatId,
        wowMeta: {
          ...blockedActionFromDb.wowMeta,
          [constants.outcomeLastUpdatedAtFieldName]: new Date().toString(),
        },
      }
    })()
    await deleteDbRecordById(currDbId)
    if (blockedAction) {
      // FIXME do we need to explicitly delete photos from the replaced record?
      // We could leverage the storeRecord fn by injecting the IDs into the
      // record.
      await storeRecord(blockedAction)
    }
  },
  checkForLostPhotos({ state, getters }, recordUuid) {
    // TODO enhancement idea: if we find that we might be losing photos, we
    // could halt the delete of the local record and give the user the option
    // to retry to action.
    const logPrefix = '[photo check]'
    try {
      const remoteRecord = state.allRemoteObs.find(e => e.uuid === recordUuid)
      if (!remoteRecord) {
        throw namedError(
          'RecordNotFound',
          `Could not find remote record for UUID=${recordUuid}`,
        )
      }
      const localRecord = getters.localRecords.find(e => e.uuid === recordUuid)
      if (!localRecord) {
        throw namedError(
          'RecordNotFound',
          `Could not find local record for UUID=${recordUuid}`,
        )
      }
      const recordType = localRecord.wowMeta[constants.recordTypeFieldName]
      const isNotRecordTypeWeShouldCheck = !['new', 'edit'].includes(recordType)
      if (isNotRecordTypeWeShouldCheck) {
        console.debug(
          `${logPrefix} Record UUID=${recordUuid} does not need to be checked`,
        )
        return
      }
      const remotePhotoCount = remoteRecord.photos.length
      const localPhotoCount = localRecord.photos.length
      if (remotePhotoCount === localPhotoCount) {
        console.debug(
          `${logPrefix} Record UUID=${recordUuid} has all photos ` +
            `(${remotePhotoCount}) accounted for`,
        )
        return
      }
      wowWarnMessage(
        `Found potential lost photos in record ` +
          `UUID=${recordUuid}/inatId=${remoteRecord.inatId}. Local ` +
          `count=${localPhotoCount}, remote count=${remotePhotoCount}. Record ` +
          `type=${recordType}.`,
      )
    } catch (err) {
      wowWarnHandler('Failed while trying to check for lost photos', err)
    }
  },
  async getMySpecies({ commit, dispatch, rootGetters }) {
    const myUserId = rootGetters.myUserId
    if (!myUserId) {
      console.debug('No userID present, refusing to try to get my species')
      return
    }
    const urlSuffix = `/observations/species_counts?user_id=${myUserId}&project_id=${constants.inatProjectSlug}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map(d => {
        const taxon = d.taxon
        return {
          id: taxon.id,
          observationCount: d.count, // TODO assume this is *my* count, not system count
          defaultPhoto: taxon.default_photo,
          commonName: taxon.preferred_common_name || taxon.name,
          scientificName: taxon.name,
        }
      })
      commit('setMySpecies', records)
    } catch (err) {
      dispatch(
        'flagGlobalError',
        { msg: 'Failed to get my species counts', err },
        { root: true },
      )
      return
    }
  },
  async buildObsFieldSorter({ dispatch }) {
    await dispatch('waitForProjectInfo')
    return dispatch('_buildObsFieldSorterWorkhorse')
  },
  /**
   * Split the core logic into an easily testable function
   */
  _buildObsFieldSorterWorkhorse({ getters }) {
    return function(obsFieldsToSort, targetField) {
      if (!targetField) {
        throw new Error('Required string param "targetField" is missing')
      }
      if (!obsFieldsToSort || obsFieldsToSort.constructor !== Array) {
        throw new Error('Required array param "obsFieldsToSort" is missing')
      }
      if (!obsFieldsToSort.every(f => !!f[targetField])) {
        throw new Error(
          `All obsFieldsToSort MUST have the "${targetField}" field. ` +
            `First item as sample: ${JSON.stringify(obsFieldsToSort[0])}`,
        )
      }
      const positionMapping = getters.obsFieldPositions
      return obsFieldsToSort.sort((a, b) => {
        const aId = a[targetField]
        const bId = b[targetField]
        const aPos = positionMapping[aId]
        const bPos = positionMapping[bId]
        if (aPos < bPos) return -1
        if (aPos > bPos) return 1
        return 0
      })
    }
  },
  async waitForProjectInfo({ state, dispatch, rootState, getters }) {
    const alreadyCachedResult = state.projectInfo
    const isOffline = !rootState.ephemeral.networkOnLine
    if (alreadyCachedResult && (!getters.isProjectInfoStale || isOffline)) {
      console.debug('Using cached project info')
      return
    }
    if (isOffline) {
      // FIXME show nicer message to user
      throw new Error(
        'We have no projectInfo and we have no internet ' +
          'connection, cannot continue',
      )
    }
    console.debug('Refreshing project info')
    await dispatch('getProjectInfo')
    return
  },
  async getProjectInfo({ state, commit }) {
    const url = constants.apiUrlBase + '/projects/' + constants.inatProjectSlug
    try {
      const projectInfo = await fetchSingleRecord(url)
      if (!projectInfo) {
        throw new Error(
          'Request to get project info was either unsuccessful or ' +
            `contained no result; cannot continue, projectInfo='${projectInfo}'`,
        )
      }
      commit('setProjectInfo', projectInfo)
      return state.projectInfo
    } catch (err) {
      throw chainedError('Failed to get project info', err)
    }
  },
  async doSpeciesAutocomplete(_, { partialText, speciesListType }) {
    if (!partialText) {
      return []
    }
    if (speciesListType === constants.autocompleteTypeHost) {
      // TODO need to build and bundle host tree species list
      return []
    }
    if (!taxaIndex) {
      // we rely on the service worker (and possibly the browser) caches to
      // make this less expensive.
      // TODO I don't think we need cache busting because we get that for free
      // as part of the webpack build. Need to confirm
      const url = constants.taxaDataUrl
      const t1 = startTimer(`Fetching taxa index from URL=${url}`)
      const resp = await fetch(url)
      t1.stop()
      const t2 = startTimer('Processing fetched taxa index')
      try {
        const rawData = (await resp.json()).map(e => {
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
        throw chainedError('Failed to fetch and build taxa index', err)
      } finally {
        t2.stop()
      }
    }
    return taxaIndex
      .search(partialText)
      .map(e => e.item)
      .slice(0, constants.maxSpeciesAutocompleteResultLength)
  },
  async findDbIdForWowId({ dispatch, state }, wowId) {
    const result1 = findInLocalQueueSummary()
    if (result1) {
      return result1
    }
    // not allowed to use numbers as keys, so we can shortcircuit
    // see https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Concepts_Behind_IndexedDB#gloss_key
    const isValidIndexedDbKey = typeof wowId !== 'number'
    if (isValidIndexedDbKey) {
      // For a record that hasn't yet been uploaded to iNat, we rely on the UUID
      // and use that as the DB ID. The ID that is passed in will therefore
      // already be a DB ID but we're confirming.
      const possibleDbId = wowId
      // FIXME this call hurts performance on the main thread. Either don't do
      // it or move the call onto the worker.
      if (await getRecord(possibleDbId)) {
        return possibleDbId
      }
    }
    await dispatch('refreshLocalRecordQueue')
    // maybe if we refresh it'll appear
    const result2 = findInLocalQueueSummary()
    if (result2) {
      return result2
    }
    throw namedError(
      'DbRecordNotFoundError',
      `Could not resolve wowId='${wowId}' (typeof=${typeof wowId}) to a DB ID ` +
        `from localQueueSummary=${JSON.stringify(state.localQueueSummary)}`,
    )
    function findInLocalQueueSummary() {
      return (state.localQueueSummary.find(e => wowIdOf(e) === wowId) || {})
        .uuid
    }
  },
  inatIdToUuid({ getters }, inatId) {
    const found = [...getters.localRecords, ...getters.remoteRecords].find(
      e => e.inatId === inatId,
    )
    if (!found) {
      return null
    }
    return found.uuid
  },
  async saveEditAndScheduleUpdate(
    { state, dispatch, getters },
    { record, photoIdsToDelete, obsFieldIdsToDelete, isDraft },
  ) {
    const worker = getObsStoreWorker()
    // reduce chance of TOCTOU race condition by refreshing the queue right
    // before we use it
    await dispatch('refreshLocalRecordQueue')
    const context = {
      localQueueSummary: state.localQueueSummary,
      allRemoteObs: state.allRemoteObs,
      localRecords: getters.localRecords,
    }
    const result = await worker.saveEditAndScheduleUpdate(context, {
      record,
      photoIdsToDelete,
      obsFieldIdsToDelete,
      isDraft,
    })
    await dispatch('onLocalRecordEvent')
    return result
  },
  async saveNewAndScheduleUpload({ dispatch }, { record, isDraft }) {
    const worker = getObsStoreWorker()
    const result = await worker.saveNewAndScheduleUpload({
      record,
      isDraft,
    })
    await dispatch('onLocalRecordEvent')
    return result
  },
  async onLocalRecordEvent({ dispatch }) {
    await dispatch('refreshLocalRecordQueue')
    dispatch('processLocalQueue').catch(err => {
      dispatch(
        'flagGlobalError',
        {
          msg: `Failed while processing local queue triggered by a local record event`,
          userMsg: `Error encountered while trying to synchronise data with the server`,
          err,
        },
        { root: true },
      )
    })
  },
  async refreshLocalRecordQueue({ commit }) {
    if (refreshLocalRecordQueueLock) {
      console.debug(
        '[refreshLocalRecordQueue] worker already running, returning ' +
          'existing promise',
      )
      return refreshLocalRecordQueueLock
    }
    console.debug('[refreshLocalRecordQueue] starting')
    const semaphore = new Semaphore()
    refreshLocalRecordQueueLock = semaphore.acquire()
    try {
      const {
        localQueueSummary,
        uiVisibleLocalRecords,
      } = await getObsStoreWorker().getData()
      commit('setLocalQueueSummary', localQueueSummary)
      commit('setUiVisibleLocalRecords', uiVisibleLocalRecords)
      // TODO do we need to wait for nextTick before revoking the old URLs?
    } catch (err) {
      throw chainedError('Failed to refresh localRecordQueue', err)
    } finally {
      semaphore.release()
      refreshLocalRecordQueueLock = null
      console.debug('[refreshLocalRecordQueue] finished')
    }
  },
  async getPhotosForObs({ state }, obsUuid) {
    const dbPhotos = await getObsStoreWorker().getDbPhotosForObs(obsUuid)
    if (dbPhotos.length) {
      return dbPhotos
    }
    const remotePhotos = (
      state.allRemoteObs.find(e => e.uuid === obsUuid) || {}
    ).photos
    return remotePhotos || []
  },
  cleanupPhotosForObs() {
    return getObsStoreWorker().cleanupPhotosForObs()
  },
  /**
   * Process actions (new/edit/delete) in the local queue.
   * If there are records to process, we process one then call ourselves again.
   * Only when there are no records left to process do we set the 'currently
   * processing' status to false.
   */
  async processLocalQueue({
    getters,
    commit,
    dispatch,
    rootGetters,
    rootState,
  }) {
    const logPrefix = '[localQueue]'
    const existingWorker = rootState.ephemeral.queueProcessorPromise
    if (existingWorker) {
      console.debug(
        `${logPrefix} Worker is already active, returning reference`,
      )
      return existingWorker
    }
    commit(
      'ephemeral/setQueueProcessorPromise',
      worker().finally(() => {
        // we chain this as part of the returned promise so any caller awaiting
        // it won't be able to act until we've cleaned up as they're awaiting
        // this block
        console.debug(
          `${logPrefix} Worker done (could be error or success)` +
            `, killing stored promise`,
        )
        commit('ephemeral/setQueueProcessorPromise', null, { root: true })
      }),
      {
        root: true,
      },
    )
    return rootState.ephemeral.queueProcessorPromise
    async function worker() {
      console.debug(`${logPrefix} Starting to process local queue`)
      if (rootGetters['isSyncDisabled']) {
        console.debug(`${logPrefix} Processing is disallowed, giving up.`)
        return
      }
      const isNoServiceWorkerAvailable = await isNoSwActive()
      if (isNoServiceWorkerAvailable && !rootState.ephemeral.networkOnLine) {
        console.debug(
          `${logPrefix} No network (and no SW) available, refusing to ` +
            `generate HTTP requests that are destined to fail.`,
        )
        return
      }
      await dispatch('refreshLocalRecordQueue')
      // FIXME what about just iterating the DB rather than keeping a cache
      // (that has to be refreshed by itering the DB anyway)? Otherwise, we
      // need to refresh the cache before each iteration
      const waitingQueue = getters.waitingLocalQueueSummary
      const isRecordToProcess = waitingQueue.length
      if (!isRecordToProcess) {
        console.debug(`${logPrefix} No record to process, ending processing.`)
        return
      }
      const idToProcess = waitingQueue[0].uuid
      try {
        console.debug(
          `${logPrefix} Processing DB record with ID='${idToProcess}' starting`,
        )
        const strategy = isNoServiceWorkerAvailable
          ? 'processWaitingDbRecordNoSw'
          : 'processWaitingDbRecordWithSw'
        await dispatch(strategy, idToProcess)
        console.debug(
          `${logPrefix} Processing DB record with ID='${idToProcess}' done`,
        )
      } catch (err) {
        try {
          // TODO enhancement idea: would be nice to be atomic and rollback,
          // but that's a complex problem to tackle
          await dispatch('transitionToSystemErrorOutcome', idToProcess)
          if (err.isDowngradable) {
            // TODO enhancement idea: handle a downgraded error specially in
            // the UI to indicate it's probably just temporary network issues
            wowWarnHandler(
              `Warning while trying upload record with ID='${idToProcess}'`,
              err,
            )
          } else {
            const userValues = (() => {
              const fallbackMsg = {
                userMsg: `Error while trying upload record with ID='${idToProcess}'`,
              }
              // let's try to build a nicer message for the user
              try {
                const found = getters.localRecords.find(
                  e => e.uuid === idToProcess,
                )
                if (!found) {
                  return fallbackMsg
                }
                const firstPhotoUrl = ((found.photos || [])[0] || {}).url
                if (!firstPhotoUrl) {
                  return fallbackMsg
                }
                return {
                  imgUrl: firstPhotoUrl,
                  userMsg: `Failed to process record: ${found.speciesGuess}`,
                }
              } catch (err) {
                wowWarnHandler(
                  'While handling failed processing of a record, we tried to ' +
                    'create a nice error message for the user and had another ' +
                    'error',
                  err,
                )
                return fallbackMsg
              }
            })()
            dispatch(
              'flagGlobalError',
              {
                msg: `Failed to process Db record with ID='${idToProcess}'`,
                err,
                ...userValues,
              },
              { root: true },
            )
          }
        } catch (err2) {
          console.error('Original error for following message: ', err)
          await dispatch(
            'flagGlobalError',
            {
              msg: `Failed while handling error for Db record with UUID='${idToProcess}'`,
              userMsg: `Error while trying to synchronise with the server`,
              err: err2,
            },
            { root: true },
          )
          return // no more processing
        }
      }
      // call ourself so the outer promise only resolves once we have nothing
      // left to process
      await worker()
    }
  },
  optimisticallyUpdateComments({ state, commit }, { obsId, commentRecord }) {
    const existingRemoteObs = _.cloneDeep(state.allRemoteObs)
    const targetObs = existingRemoteObs.find(e => e.inatId === obsId)
    if (!targetObs) {
      throw new Error(
        `Could not find existing remote obs with ID='${obsId}' from IDs=${JSON.stringify(
          existingRemoteObs.map(o => o.inatId),
        )}`,
      )
    }
    const obsComments = targetObs.comments || []
    const strategy = (() => {
      const existingCommentUuids = obsComments.map(c => c.uuid)
      const key =
        `${commentRecord.body ? '' : 'no-'}body|` +
        `${existingCommentUuids.includes(commentRecord.uuid) ? 'not-' : ''}new`
      const result = {
        'body|new': function newStrategy() {
          targetObs.comments.push(mapCommentFromApiToOurDomain(commentRecord))
        },
        'body|not-new': function editStrategy() {
          const targetComment = obsComments.find(
            c => c.uuid === commentRecord.uuid,
          )
          if (!targetComment) {
            throw new Error(
              `Could not find comment with UUID='${commentRecord.uuid}' to ` +
                `edit. Available comment UUIDs=${JSON.stringify(
                  obsComments.map(c => c.uuid),
                )}`,
            )
          }
          for (const currKey of Object.keys(commentRecord)) {
            targetComment[currKey] = commentRecord[currKey]
          }
        },
        'no-body|not-new': function deleteStrategy() {
          const indexOfComment = obsComments.findIndex(
            e => e.uuid === commentRecord.uuid,
          )
          if (!~indexOfComment) {
            throw new Error(
              `Could not find comment with UUID='${commentRecord.uuid}' to ` +
                `delete. Available comment UUIDs=${JSON.stringify(
                  obsComments.map(c => c.uuid),
                )}`,
            )
          }
          obsComments.splice(indexOfComment, 1)
        },
      }[key]
      if (!result) {
        throw new Error(
          `Programmer problem: no strategy found for key='${key}'`,
        )
      }
      return result
    })()
    console.debug(`Using strategy='${strategy.name}' to modify comments`)
    strategy()
    updateIdsAndCommentsFor(targetObs)
    commit('setAllRemoteObs', existingRemoteObs)
  },
  async createComment({ dispatch }, { obsId, commentBody }) {
    try {
      // TODO support background sync with SW. Could be hard because we want
      // the server response to optimistically insert into our local copy
      const commentResp = await dispatch(
        'doApiPost',
        {
          urlSuffix: '/comments',
          data: {
            comment: {
              parent_type: 'Observation',
              parent_id: obsId,
              body: commentBody,
            },
          },
        },
        { root: true },
      )
      await dispatch('optimisticallyUpdateComments', {
        obsId,
        commentRecord: commentResp,
      })
      return commentResp.id
    } catch (err) {
      throw new chainedError('Failed to create new comment', err)
    }
  },
  async editComment({ dispatch }, { obsId, commentRecord }) {
    try {
      // TODO support background sync with SW. Shouldn't need server for this
      // one, we can guess what it'll look like
      const commentResp = await dispatch(
        'doApiPut',
        {
          urlSuffix: `/comments/${commentRecord.inatId}`,
          data: {
            comment: {
              parent_type: 'Observation',
              parent_id: obsId,
              body: commentRecord.body,
            },
          },
        },
        { root: true },
      )
      await dispatch('optimisticallyUpdateComments', {
        obsId,
        commentRecord: commentResp,
      })
      return commentResp.id
    } catch (err) {
      throw new chainedError('Failed to create new comment', err)
    }
  },
  async deleteComment({ dispatch }, { obsId, commentRecord }) {
    const commentId = commentRecord.inatId
    try {
      // TODO support background sync with SW.
      await dispatch(
        'doApiDelete',
        {
          urlSuffix: `/comments/${commentId}`,
        },
        { root: true },
      )
      return dispatch('optimisticallyUpdateComments', {
        obsId,
        commentRecord: {
          uuid: commentRecord.uuid,
        },
      })
    } catch (err) {
      throw new chainedError(
        `Failed to delete comment with ID=${commentId}, owned by obsId=${obsId}`,
        err,
      )
    }
  },
  async _createObservation({ dispatch }, { obsRecord }) {
    const obsResp = await dispatch(
      'doApiPost',
      { urlSuffix: '/observations', data: obsRecord },
      { root: true },
    )
    const newRecordId = obsResp.id
    // FIXME confirm (obsResp.project_ids || []).includes(<projectId>)
    return newRecordId
  },
  async _editObservation({ dispatch }, { obsRecord, inatRecordId }) {
    if (!inatRecordId) {
      throw new Error(
        `Programmer problem: no iNat record ID ` +
          `passed='${inatRecordId}', cannot continue`,
      )
    }
    await dispatch(
      'doApiPut',
      {
        urlSuffix: `/observations/${inatRecordId}`,
        data: {
          // note: obs fields *not* included here are not implicitly deleted.
          ...obsRecord,
          ignore_photos: true,
        },
      },
      { root: true },
    )
    return inatRecordId
  },
  async _deleteObservation({ dispatch }, { inatRecordId, recordUuid }) {
    // SW will intercept this if running
    await dispatch(
      'doApiDelete',
      { urlSuffix: `/observations/${inatRecordId}`, recordUuid },
      { root: true },
    )
  },
  async _createObsPhoto({ dispatch }, { photoRecord, relatedObsId }) {
    const resp = await dispatch(
      'doPhotoPost',
      {
        obsId: relatedObsId,
        photoRecord,
      },
      { root: true },
    )
    return resp.id
  },
  async _createLocalPhoto({ dispatch }, { photoRecord }) {
    const resp = await dispatch(
      'doLocalPhotoPost',
      {
        photoRecord,
      },
      { root: true },
    )
    return resp.id
  },
  async _createObsFieldValue({ dispatch }, { obsFieldRecord, relatedObsId }) {
    // we could do PUTs to modify the existing records but doing a POST
    // clobbers the existing values so it's not worth the effort to track obs
    // field value IDs.
    return dispatch(
      'doApiPost',
      {
        urlSuffix: '/observation_field_values',
        data: {
          observation_id: relatedObsId,
          ...obsFieldRecord,
        },
      },
      { root: true },
    )
  },
  async _deletePhoto({ dispatch }, photoId) {
    return dispatch(
      'doApiDelete',
      {
        urlSuffix: `/observation_photos/${photoId}`,
      },
      { root: true },
    )
  },
  async _deleteObsFieldValue({ dispatch }, obsFieldId) {
    return dispatch(
      'doApiDelete',
      {
        urlSuffix: `/observation_field_values/${obsFieldId}`,
      },
      { root: true },
    )
  },
  async processWaitingDbRecordNoSw({ dispatch, getters }, recordId) {
    await dispatch('transitionToWithLocalProcessorOutcome', recordId)
    // the DB record may be further edited while we're processing but that
    // won't affect our snapshot here
    const dbRecord = await getRecord(recordId)
    const apiRecords = await mapObsFullFromOurDomainOntoApi(dbRecord)
    const strategies = {
      [recordType('new')]: async () => {
        const localPhotoIds = []
        for (const curr of apiRecords.photoPostBodyPartials) {
          const id = await dispatch('_createLocalPhoto', {
            photoRecord: curr,
          })
          localPhotoIds.push(id)
        }
        await dispatch('waitForProjectInfo')
        return dispatch('_createObservation', {
          obsRecord: makeObsRequest(
            apiRecords.observationPostBody,
            getters.projectId,
            localPhotoIds,
          ),
        })
      },
      [recordType('edit')]: async () => {
        const inatRecordId = dbRecord.inatId
        await Promise.all(
          dbRecord.wowMeta[constants.photoIdsToDeleteFieldName].map(id => {
            return dispatch('_deletePhoto', id)
          }),
        )
        for (const curr of apiRecords.photoPostBodyPartials) {
          await dispatch('_createObsPhoto', {
            photoRecord: curr,
            relatedObsId: inatRecordId,
          })
        }
        for (const id of dbRecord.wowMeta[
          constants.obsFieldIdsToDeleteFieldName
        ]) {
          await dispatch('_deleteObsFieldValue', id)
        }
        return dispatch('_editObservation', {
          obsRecord: apiRecords.observationPostBody,
          inatRecordId,
        })
      },
      [recordType('delete')]: async () => {
        return dispatch('_deleteObservation', {
          inatRecordId: dbRecord.inatId,
        })
      },
    }
    const key = dbRecord.wowMeta[constants.recordTypeFieldName]
    console.debug(`DB record with UUID='${dbRecord.uuid}' is type='${key}'`)
    const strategy = strategies[key]
    // enhancement idea: add a rollback() fn to each strategy and call it when
    // we encounter an error during the following processing. For 'new' we can
    // just delete the partial obs. For delete, we do nothing. For edit, we
    // should really track which requests have worked so we only replay the
    // failed/not-yet-processed ones, but most users will use the withSw
    // version of the processor and we get this smart retry for free.
    if (!strategy) {
      throw new Error(
        `Could not find a "process waiting DB" strategy for key='${key}', ` +
          `cannot continue`,
      )
    }
    await strategy()
    await dispatch('transitionToSuccessOutcome', dbRecord.uuid)
    await dispatch('refreshRemoteObsWithDelay')
  },
  async processWaitingDbRecordWithSw(
    { dispatch, rootState, getters, state },
    recordId,
  ) {
    await dispatch('transitionToWithServiceWorkerOutcome', recordId)
    const recordSummary = state.localQueueSummary.find(e => (e.uuid = recordId))
    if (!recordSummary) {
      const ids = JSON.stringify(state.localQueueSummary.map(e => e.uuid))
      throw new Error(
        `Could not find record summary for UUID=${recordId} from IDs=${ids}`,
      )
    }
    const strategies = {
      [recordType('new')]: async () => {
        const apiToken = rootState.auth.apiToken
        const projectId = getters.projectId
        if (!projectId) {
          throw new Error(
            'No projectInfo stored, cannot link observation to project without ID',
          )
        }
        await getObsStoreWorker().doNewRecordStrategy(
          recordId,
          projectId,
          apiToken,
        )
      },
      [recordType('edit')]: async () => {
        const apiToken = rootState.auth.apiToken
        await getObsStoreWorker().doEditRecordStrategy(recordId, apiToken)
      },
      [recordType('delete')]: () => {
        const inatId = recordSummary.inatId
        return dispatch('_deleteObservation', {
          inatRecordId: inatId,
          recordUuid: recordId,
        })
      },
    }
    const key = recordSummary[constants.recordTypeFieldName]
    console.debug(`DB record with UUID='${recordId}' is type='${key}'`)
    const strategy = strategies[key]
    if (!strategy) {
      throw new Error(
        `Could not find a "process waiting DB" strategy for key='${key}', ` +
          `cannot continue`,
      )
    }
    await strategy()
    await dispatch('refreshLocalRecordQueue')
    await dispatch('refreshObsUuidsInSwQueue')
    await triggerSwWowQueue()
  },
  async deleteSelectedLocalRecord({ state, dispatch, commit }) {
    const worker = getObsStoreWorker()
    const selectedUuid = state.selectedObservationUuid
    await worker.deleteSelectedLocalRecord(selectedUuid)
    commit('setSelectedObservationUuid', null)
    return dispatch('refreshLocalRecordQueue')
  },
  async deleteSelectedRecord({ state, dispatch, commit }) {
    const worker = getObsStoreWorker()
    const context = {
      selectedUuid: state.selectedObservationUuid,
      localQueueSummary: state.localQueueSummary,
      allRemoteObs: state.allRemoteObs,
    }
    await worker.deleteSelectedRecord(context)
    commit('setSelectedObservationUuid', null)
    return dispatch('onLocalRecordEvent')
  },
  async resetProcessingOutcomeForSelectedRecord({ state, dispatch }) {
    const selectedUuid = state.selectedObservationUuid
    if (!selectedUuid) {
      throw namedError(
        'InvalidState',
        'Tried to reset the selected observation but no observation is selected',
      )
    }
    await dispatch('transitionToWaitingOutcome', selectedUuid)
    return dispatch('onLocalRecordEvent')
  },
  async retryFailedDeletes({ getters, dispatch }) {
    const idsToRetry = getters.deletesWithErrorDbIds
    await Promise.all(
      idsToRetry.map(currId => dispatch('transitionToWaitingOutcome', currId)),
    )
    return dispatch('onLocalRecordEvent')
  },
  async cancelFailedDeletes({ getters, dispatch }) {
    const idsToCancel = getters.deletesWithErrorDbIds
    await Promise.all(idsToCancel.map(currId => deleteDbRecordById(currId)))
    return dispatch('onLocalRecordEvent')
  },
  async getCurrentOutcomeForWowId({ dispatch }, wowId) {
    const found = await dispatch('getLocalQueueSummaryRecord', wowId)
    return found[constants.recordProcessingOutcomeFieldName]
  },
  getLocalQueueSummaryRecord({ state }, wowId) {
    const found = state.localQueueSummary.find(
      e => e.inatId === wowId || e.uuid === wowId,
    )
    if (!found) {
      throw new Error(
        `Could not find record with wowId=${wowId} in ` +
          `localQueueSummary=${JSON.stringify(state.localQueueSummary)}`,
      )
    }
    return found
  },
  async transitionToSuccessOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.successOutcome,
      validFromOutcomes: [
        constants.withLocalProcessorOutcome,
        constants.withServiceWorkerOutcome,
      ],
    })
  },
  async transitionToWithLocalProcessorOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.withLocalProcessorOutcome,
      validFromOutcomes: [constants.waitingOutcome],
    })
  },
  async transitionToWaitingOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.waitingOutcome,
      validFromOutcomes: anyFromOutcome,
    })
  },
  async transitionToWithServiceWorkerOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.withServiceWorkerOutcome,
      validFromOutcomes: [constants.waitingOutcome],
    })
  },
  async transitionToSystemErrorOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.systemErrorOutcome,
      validFromOutcomes: [
        constants.withLocalProcessorOutcome,
        constants.withServiceWorkerOutcome,
        constants.waitingOutcome,
      ],
    })
  },
  async _transitionHelper(
    { dispatch },
    { wowId, targetOutcome, validFromOutcomes },
  ) {
    const isRestrictFromOutcomes = (validFromOutcomes || []).length
    // FIXME should we still be using this cache?
    const fromOutcome = await dispatch('getCurrentOutcomeForWowId', wowId)
    if (isRestrictFromOutcomes && !validFromOutcomes.includes(fromOutcome)) {
      throw new Error(
        `Unhandled fromOutcome=${fromOutcome} when transitioning to ${targetOutcome}`,
      )
    }
    const dbId = await dispatch('findDbIdForWowId', wowId)
    await getObsStoreWorker().setRecordProcessingOutcome(dbId, targetOutcome)
    await dispatch('refreshLocalRecordQueue')
  },
  findObsInatIdForUuid({ state }, uuid) {
    const found = state.allRemoteObs.find(e => e.uuid === uuid)
    if (!found) {
      const allUuids = (state.allRemoteObs || []).map(e => e.uuid)
      throw new Error(
        `Could not find obs with UUID='${uuid}' from UUIDs=${allUuids}`,
      )
    }
    const result = found.inatId
    if (!result) {
      throw new Error(
        `Found obs matched UUID=${uuid} but it did not have an ` +
          `inatId=${result}. This should never happen!`,
      )
    }
    return result
  },
  async healthcheck() {
    try {
      await healthcheckStore()
    } catch (err) {
      throw chainedError('Failed to init localForage instance', err)
    }
  },
  getFullSizePhotoUrl(_, photoUuid) {
    return getObsStoreWorker().getFullSizePhotoUrl(photoUuid)
  },
}

const getters = {
  isDoingSync(state, getters, rootState) {
    return (
      state.isUpdatingRemoteObs || rootState.ephemeral.queueProcessorPromise
    )
  },
  observationDetail(state, getters) {
    const allObs = [...getters.remoteRecords, ...getters.localRecords]
    const found = allObs.find(e => e.uuid === state.selectedObservationUuid)
    return found
  },
  waitingForDeleteCount(state) {
    return state.localQueueSummary.filter(
      e =>
        e[constants.recordTypeFieldName] === recordType('delete') &&
        !isErrorOutcome(e[constants.recordProcessingOutcomeFieldName]),
    ).length
  },
  deletesWithErrorDbIds(state) {
    return state.localQueueSummary
      .filter(
        e =>
          e[constants.recordTypeFieldName] === recordType('delete') &&
          isErrorOutcome(e[constants.recordProcessingOutcomeFieldName]),
      )
      .map(e => e.uuid)
  },
  deletesWithErrorCount(state, getters) {
    return getters.deletesWithErrorDbIds.length
  },
  localRecords(state) {
    const remoteRecordLookup = state.allRemoteObs.reduce((accum, curr) => {
      accum[curr.uuid] = curr
      return accum
    }, {})
    return state._uiVisibleLocalRecords.map(currLocal => {
      const existingValues = remoteRecordLookup[currLocal.uuid] || {}
      const dontModifyTheOtherObjects = {}
      return Object.assign(dontModifyTheOtherObjects, existingValues, currLocal)
    })
  },
  remoteRecords(state) {
    const localRecordIds = state.localQueueSummary.map(e => e.uuid)
    return state.allRemoteObs.filter(e => {
      const recordHasLocalActionPending = localRecordIds.includes(e.uuid)
      return !recordHasLocalActionPending
    })
  },
  isRemoteObsStale: buildStaleCheckerFn('allRemoteObsLastUpdated', 10),
  isMySpeciesStale: buildStaleCheckerFn('mySpeciesLastUpdated', 10),
  isProjectInfoStale: buildStaleCheckerFn('projectInfoLastUpdated', 10),
  isSelectedRecordEditOfRemote(state, getters) {
    return getters.localRecords
      .filter(e => {
        const hasRemote = !!e.inatId
        return (
          e.wowMeta[constants.recordTypeFieldName] === recordType('edit') &&
          hasRemote
        )
      })
      .some(e => e.uuid === state.selectedObservationUuid)
  },
  isSelectedRecordOnRemote(_, getters) {
    const isRemote = (getters.observationDetail || {}).inatId
    return !!isRemote
  },
  waitingLocalQueueSummary(state) {
    return state.localQueueSummary.filter(
      e =>
        e[constants.recordProcessingOutcomeFieldName] ===
        constants.waitingOutcome,
    )
  },
  successfulLocalQueueSummary(state) {
    return state.localQueueSummary.filter(
      e =>
        e[constants.recordProcessingOutcomeFieldName] ===
        constants.successOutcome,
    )
  },
  obsFields(_, getters) {
    const projectObsFields = getters.nullSafeProjectObsFields
    if (!projectObsFields.length) {
      return []
    }
    const result = projectObsFields.map(fieldRel => {
      // don't get confused: we have the field definition *and* the
      // relationship to the project
      const fieldDef = fieldRel.observation_field
      return {
        id: fieldDef.id,
        position: fieldRel.position,
        required: fieldRel.required,
        name: processObsFieldName(fieldDef.name),
        description: fieldDef.description,
        datatype: fieldDef.datatype,
        allowedValues: (fieldDef.allowed_values || '')
          .split(constants.obsFieldSeparatorChar)
          .filter(x => !!x), // remove zero length strings
      }
    })
    return result
  },
  obsFieldPositions(_, getters) {
    return getters.obsFields.reduce((accum, curr) => {
      accum[curr.id] = curr.position
      return accum
    }, {})
  },
  detailedModeOnlyObsFieldIds(_, getters) {
    // this doesn't handle conditional requiredness, but we tackle that elsewhere
    return getters.nullSafeProjectObsFields.reduce((accum, curr) => {
      accum[curr.id] = curr.required
      return accum
    }, {})
  },
  nullSafeProjectObsFields(state) {
    // there's a race condition where you can get to an obs detail page before
    // the project info has been cached. This stops an error and will
    // auto-magically update when the project info does arrive
    return _.get(state, 'projectInfo.project_observation_fields', [])
  },
  projectId(state) {
    return (state.projectInfo || {}).id
  },
}

function isErrorOutcome(outcome) {
  return [constants.systemErrorOutcome].includes(outcome)
}

export default {
  namespaced: true,
  state: initialState,
  mutations,
  actions,
  getters,
}

export const apiTokenHooks = [
  async store => {
    await store.dispatch('obs/refreshRemoteObs')
    await store.dispatch('obs/getMySpecies')
    await store.dispatch('obs/getProjectInfo')
    // we re-join the user every time they login. We really want them joined
    await store.dispatch('autoJoinInatProject')
  },
]

export const networkHooks = [
  async store => {
    await store.dispatch('obs/processLocalQueue')
  },
]

export function isObsSystemError(record) {
  return (
    _.get(record, `wowMeta.${constants.recordProcessingOutcomeFieldName}`) ===
    constants.systemErrorOutcome
  )
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
  const photos = (obsFromApi.observation_photos || []).map(p => {
    const result = {
      url: p.photo.url,
      uuid: p.uuid,
      id: p.id,
      [constants.isRemotePhotoFieldName]: true,
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
  result.obsFieldValues = obsFromApi.ofvs.map(o => ({
    relationshipId: o.id,
    fieldId: o.field_id,
    datatype: o.datatype,
    name: processObsFieldName(o.name),
    value: o.value,
  }))
  result.identifications = obsFromApi.identifications.map(i => ({
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
  result.comments = obsFromApi.comments.map(c =>
    mapCommentFromApiToOurDomain(c),
  )
  updateIdsAndCommentsFor(result)
  return result
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

function mapCommentFromApiToOurDomain(apiComment) {
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

function updateIdsAndCommentsFor(obs) {
  obs.idsAndComments = [...obs.comments, ...obs.identifications]
  obs.idsAndComments.sort((a, b) => {
    const f = 'createdAt'
    if (dayjs(a[f]).isBefore(b[f])) return -1
    if (dayjs(a[f]).isAfter(b[f])) return 1
    return 0
  })
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

function processObsFieldName(fieldName) {
  return (fieldName || '').replace(constants.obsFieldNamePrefix, '')
}

export async function migrate(store) {
  const qPP = store.state.ephemeral.queueProcessorPromise
  if (refreshLocalRecordQueueLock || qPP) {
    // as the migrations are fired off as the app loads, it would be weird for
    // something else to beat us to it.
    const a = 'rLRQL=' + (refreshLocalRecordQueueLock ? 'yes' : 'no')
    const b = 'qPP=' + (qPP ? 'yes' : 'no')
    wowWarnMessage(
      `Waiting for existing locks (${a},${b}) before migrating. Did not ` +
        'expect this to happen.',
    )
    await Promise.all([
      refreshLocalRecordQueueLock || Promise.resolve(),
      qPP || Promise.resolve(),
    ])
  }
  const semaphore = new Semaphore()
  try {
    const lock = semaphore.acquire()
    console.debug(
      `Blocking "refresh local queue" process with migration promise`,
    )
    refreshLocalRecordQueueLock = lock
    console.debug(`Blocking queue processing with migration promise`)
    // note: this will trigger the sync spinner
    store.commit('ephemeral/setQueueProcessorPromise', lock)
    // don't trigger any of the processes we have blocked above as part of a
    // migration or you'll get a deadlock.
    migrateRecentlyUsedTaxa(store)
    await getObsStoreWorker().performMigrations()
  } finally {
    semaphore.release()
    // note: we're running a fork of localForage so we don't mask the reason
    // for Safari aborting transactions on localForage.setItem:
    //   TypeError: Attempted to add a non-object key to a WeakSet
    // On the main localForage, we were seeing this masking error:
    //   InvalidStateError: Failed to read the 'error' property from 'IDBRequest': The request has not finished.
    // That is triggered by this localForage.setItem code:
    // https://github.com/localForage/localForage/blob/c1cc34f/dist/localforage.js#L1060.
    // Now to figure out what's offending the WeakSet.
    console.debug(`Unblocking queue processing as migration is done`)
    store.commit('ephemeral/setQueueProcessorPromise', null)
    console.debug(
      `Unblocking "refresh local queue" process as migration is done`,
    )
    refreshLocalRecordQueueLock = null
  }
  if (store.state.obs.forceQueueProcessingAtNextChance) {
    console.debug(
      `Triggering local queue processing at request of "force at next ` +
        `chance" flag`,
    )
    store.dispatch('obs/onLocalRecordEvent').catch(err => {
      wowErrorHandler(
        'Failed while triggering queue processing at request of flag in store',
        err,
      )
    })
    store.commit('obs/setForceQueueProcessingAtNextChance', false)
  } else {
    await store.dispatch('obs/refreshLocalRecordQueue')
  }
}

function migrateRecentlyUsedTaxa(store) {
  const recentlyUsedTaxa = store.state.obs.recentlyUsedTaxa || {}
  const cleaned = {}
  for (const currKey of Object.keys(recentlyUsedTaxa)) {
    cleaned[currKey] = recentlyUsedTaxa[currKey].filter(
      e => typeof e === 'object',
    )
  }
  store.commit('obs/setRecentlyUsedTaxa', cleaned)
}

export function extractGeolocationText(record) {
  const coordString = (() => {
    const isCoords = record.lng && record.lat
    if (isCoords) {
      return formatCoords(record.lng, record.lat)
    }
    return null
  })()
  return record.placeGuess || coordString || '(No place guess)'
  function formatCoords(lng, lat) {
    return `${trimDecimalPlaces(lng)},${trimDecimalPlaces(lat)}`
  }
}

function trimDecimalPlaces(val) {
  return parseFloat(val).toFixed(6)
}

function startTimer(task) {
  const start = Date.now()
  return {
    stop() {
      console.debug(`${task} took ${Date.now() - start}ms`)
    },
  }
}

const interceptableFns = {
  buildWorker() {
    return comlinkWrap(
      new Worker('./obs-store.worker.js', {
        type: 'module',
      }),
    )
  },
}

export const _testonly = {
  interceptableFns,
  mapObsFromApiIntoOurDomain,
}
