import _ from 'lodash'
import dayjs from 'dayjs'
import Fuse from 'fuse.js'
import { wrap as comlinkWrap, proxy as comlinkProxy } from 'comlink'
import Semaphore from '@chriscdn/promise-semaphore'
import {
  deleteDbRecordById,
  getRecord,
  healthcheckStore,
  registerWarnHandler,
  storeRecord,
} from '@/indexeddb/obs-store-common'
import * as cc from '@/misc/constants'
import {
  buildStaleCheckerFn,
  chainedError,
  fetchSingleRecord,
  isNoSwActive,
  namedError,
  now,
  recordTypeEnum as recordType,
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
  localQueueSummary: [], // FIXME should we delete this? We could replace it
  //  with a function in the worker and add caching there because all DB writes
  //  have to go through the same module, so we can invalidate.
  projectInfo: null, // FIXME only need id and user_ids, can we bin the rest?
  projectInfoLastUpdated: 0,
  recentlyUsedTaxa: {},
  forceQueueProcessingAtNextChance: false,
  lastUsedResponses: {},
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
}

const actions = {
  async refreshRemoteObsWithDelay({ dispatch }) {
    const delayToLetServerPerformIndexingMs = cc.waitBeforeRefreshSeconds * 1000
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
        `&project_id=${cc.inatProjectSlug}`
      const allRawRecords = await dispatch('fetchAllPages', {
        baseUrl,
        pageSize: cc.obsPageSize,
      })
      const allMappedRecords = allRawRecords.map(mapObsFromApiIntoOurDomain)
      // FIXME store allMappedRecords in metaStore, and only have a summary in vuex
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
  // FIXME remove this fn altogether. Don't run this logic every refresh,
  // instead have separate background worker that do the check. If it happens
  // in a web worker, have to signal the main thread to update the UI
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
        accum[curr.uuid] = curr[cc.wowUpdatedAtFieldName]
        return accum
      },
      {},
    )
    const logPrefix = '[clean check]'
    const successfulLocalRecordDbIdsToDelete = getters.successfulLocalQueueSummary
      // FIXME change to use the status endpoint on the facade for each waiting local
      .filter(e => {
        const theRecordType = e[cc.recordTypeFieldName]
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
      .filter(e => e[cc.hasBlockedActionFieldName])
      .map(e => e.uuid)
    try {
      await Promise.all(
        dbIdsToDelete.map(currDbId => {
          return dispatch('cleanLocalRecord', {
            currDbId,
            idsWithBlockedActions,
          })
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
      const blockedActionFromDb = record.wowMeta[cc.blockedActionFieldName]
      return {
        // note: the record body has already been updated in-place, it's just
        // the wowMeta changes that store the blocked action. That's why we use
        // the record body as-is.
        ...record,
        inatId: remoteRecord.inatId,
        wowMeta: {
          ...blockedActionFromDb.wowMeta,
          [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
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
  async getMySpecies({ commit, dispatch, rootGetters }) {
    const myUserId = rootGetters.myUserId
    if (!myUserId) {
      console.debug('No userID present, refusing to try to get my species')
      return
    }
    const urlSuffix = `/observations/species_counts?user_id=${myUserId}&project_id=${cc.inatProjectSlug}`
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
    const url = cc.apiUrlBase + '/projects/' + cc.inatProjectSlug
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
    if (speciesListType === cc.autocompleteTypeHost) {
      // TODO need to build and bundle host tree species list
      return []
    }
    if (!taxaIndex) {
      // we rely on the service worker (and possibly the browser) caches to
      // make this less expensive.
      // TODO I don't think we need cache busting because we get that for free
      // as part of the webpack build. Need to confirm
      const url = cc.taxaDataUrl
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
      .slice(0, cc.maxSpeciesAutocompleteResultLength)
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
    // worker.pollForObsCreateCompletion(comlinkProxy(() => {
    // // FIXME trigger polling of facade to check for completion, with exponential backoff
    //   // syntax error
    // })) FIXME
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
  async pollForPendingTasks({ dispatch }) {
    const worker = getObsStoreWorker()
    const tasks = await worker.getPendingTasks()
    for (const curr of tasks) {
      const strategies = {
        [recordType('delete')]: 'pollForDeleteCompletion',
        // FIXME add new and edit support
      }
      const rt = curr[cc.recordTypeFieldName]
      const strat = strategies[rt]
      if (!strat) {
        throw new Error(`Unhandled record type: ${rt}`)
      }
      console.debug('Firing poll process for task', curr)
      dispatch(strat, {
        theUuid: curr.uuid,
        inatId: curr.inatId,
        taskId: curr.taskId,
      })
    }
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
        // FIXME won't work in worker
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
        await dispatch('transitionToBeingProcessedOutcome', idToProcess)
        const apiToken = rootState.auth.apiToken
        const projectId = getters.projectId
        await getObsStoreWorker().processWaitingDbRecord({
          recordId: idToProcess,
          apiToken,
          projectId,
        })
        await dispatch('transitionToSuccessOutcome', idToProcess)
        await dispatch('refreshRemoteObsWithDelay') // FIXME do we still need this?
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
              'flagGlobalError', // FIXME won't work in worker
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
  async deleteSelectedRecord({ state, rootState, commit, dispatch }) {
    const theUuid = state.selectedObservationUuid
    const inatId = (() => {
      const existingRemoteRecord = state.allRemoteObs.find(
        e => e.uuid === theUuid,
      )
      if (existingRemoteRecord) {
        return existingRemoteRecord.inatId
      }
      return null
    })()
    const worker = getObsStoreWorker()
    const apiToken = rootState.auth.apiToken
    const pendingTaskId = await worker.deleteRecord(theUuid, inatId, apiToken)
    if (pendingTaskId) {
      dispatch('pollForDeleteCompletion', { theUuid, inatId, pendingTaskId })
    }
    commit('setSelectedObservationUuid', null)
  },
  pollForDeleteCompletion({ commit, state }, { theUuid, inatId, taskId }) {
    const worker = getObsStoreWorker()
    worker.pollForDeleteCompletion(
      inatId,
      comlinkProxy(async err => {
        if (err) {
          console.error(`Failure while polling for DELETE ${inatId}`, err)
          // FIXME do we delete the pending task or trigger a retry?
          return
        }
        console.debug(`DELETE ${inatId} complete`)
        const filteredRemoteObs = state.allRemoteObs.filter(
          e => e.uuid !== theUuid,
        )
        commit('setAllRemoteObs', filteredRemoteObs)
        await worker.deletePendingTask(taskId)
      }),
    )
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
    return found[cc.recordProcessingOutcomeFieldName]
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
      targetOutcome: cc.successOutcome,
      validFromOutcomes: [cc.beingProcessedOutcome],
    })
  },
  async transitionToBeingProcessedOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: cc.beingProcessedOutcome,
      validFromOutcomes: [cc.waitingOutcome],
    })
  },
  async transitionToWaitingOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: cc.waitingOutcome,
      validFromOutcomes: anyFromOutcome,
    })
  },
  async transitionToSystemErrorOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: cc.systemErrorOutcome,
      validFromOutcomes: [cc.beingProcessedOutcome, cc.waitingOutcome],
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
  async fetchAllPages({ dispatch }, { baseUrl, pageSize }) {
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
        const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
        const results = resp.results
        // note: we use the per_page from the resp because if we request too
        // many records per page, the server will ignore our page size and
        // the following check won't work
        isMorePages = results.length === resp.per_page
        allRecords = allRecords.concat(results)
        currPage += 1
      } catch (err) {
        throw chainedError(
          `Failed while trying to get page=${currPage} of ${baseUrl}`,
          err,
        )
      }
    }
    return allRecords
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
        e[cc.recordTypeFieldName] === recordType('delete') &&
        !isErrorOutcome(e[cc.recordProcessingOutcomeFieldName]),
    ).length
  },
  deletesWithErrorDbIds(state) {
    return state.localQueueSummary
      .filter(
        e =>
          e[cc.recordTypeFieldName] === recordType('delete') &&
          isErrorOutcome(e[cc.recordProcessingOutcomeFieldName]),
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
      // FIXME do we need to do this? Don't local records contain all the new state?
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
          e.wowMeta[cc.recordTypeFieldName] === recordType('edit') && hasRemote
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
      e => e[cc.recordProcessingOutcomeFieldName] === cc.waitingOutcome,
    )
  },
  successfulLocalQueueSummary(state) {
    return state.localQueueSummary.filter(
      e => e[cc.recordProcessingOutcomeFieldName] === cc.successOutcome,
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
          .split(cc.obsFieldSeparatorChar)
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
  return [cc.systemErrorOutcome].includes(outcome)
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
    _.get(record, `wowMeta.${cc.recordProcessingOutcomeFieldName}`) ===
    cc.systemErrorOutcome
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
  return (fieldName || '').replace(cc.obsFieldNamePrefix, '')
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
