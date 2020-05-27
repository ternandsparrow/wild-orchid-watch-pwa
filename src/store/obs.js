import _ from 'lodash'
import base64js from 'base64-js'
import dayjs from 'dayjs'
import uuid from 'uuid/v1'
import Fuse from 'fuse.js'
import { wrap as comlinkWrap } from 'comlink'
import {
  deleteDbRecordById,
  getRecord,
  healthcheckStore,
  setRecordProcessingOutcome,
  storeRecord,
} from '@/indexeddb/obs-store-common'
import * as constants from '@/misc/constants'
import {
  arrayBufferToBlob,
  blobToArrayBuffer,
  buildStaleCheckerFn,
  chainedError,
  fetchSingleRecord,
  isNoSwActive,
  namedError,
  now,
  recordTypeEnum as recordType,
  triggerSwObsQueue,
  verifyWowDomainPhoto,
  wowIdOf,
  wowWarnHandler,
} from '@/misc/helpers'
import { deserialise } from '@/misc/taxon-s11n'

const isRemotePhotoFieldName = 'isRemote'

let photoObjectUrlsInUse = []
let photoObjectUrlsNoLongerInUse = []
let refreshLocalRecordQueueLock = null
let mapStoreWorker = null
let taxaIndex = null

const state = {
  allRemoteObs: [],
  allRemoteObsLastUpdated: 0,
  isUpdatingRemoteObs: false,
  mySpecies: [],
  mySpeciesLastUpdated: 0,
  selectedObservationId: null,
  _uiVisibleLocalRecords: [],
  localQueueSummary: [],
  projectInfo: null,
  projectInfoLastUpdated: 0,
  recentlyUsedTaxa: {},
}

const mutations = {
  setSelectedObservationId: (state, value) =>
    (state.selectedObservationId = value),
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
    // TODO look at only pulling "new" records to save on bandwidth
    try {
      const myUserId = rootGetters.myUserId
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
      return false
    } finally {
      commit('setIsUpdatingRemoteObs', false)
    }
  },
  async cleanSuccessfulLocalRecordsRemoteHasEchoed({
    state,
    getters,
    dispatch,
  }) {
    // FIXME WOW-135 look at moving this whole function body off the main
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
        accum[curr.uuid] = curr.wowUpdatedAt
        return accum
      },
      {},
    )
    const successfulLocalRecordDbIdsToDelete = getters.successfulLocalQueueSummary
      .filter(e => {
        const currUpdatedDateOnRemote = lastUpdatedDatesOnRemote[e.uuid]
        const isUpdatedOnRemoteAfterLocalUpdate =
          currUpdatedDateOnRemote &&
          // remote times are rounded to the second
          dayjs(currUpdatedDateOnRemote) >=
            dayjs(localUpdatedDates[e.uuid]).startOf('second')
        const isNewAndPresent =
          e[constants.recordTypeFieldName] === recordType('new') &&
          uuidsOfRemoteRecords.includes(e.uuid)
        const isEditAndUpdated =
          e[constants.recordTypeFieldName] === recordType('edit') &&
          uuidsOfRemoteRecords.includes(e.uuid) &&
          isUpdatedOnRemoteAfterLocalUpdate
        const isDeleteAndNotPresent =
          e[constants.recordTypeFieldName] === recordType('delete') &&
          !uuidsOfRemoteRecords.includes(e.uuid)
        return isNewAndPresent || isEditAndUpdated || isDeleteAndNotPresent
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
        dbIdsToDelete.map(currDbId =>
          (async () => {
            const hasBlockedAction = idsWithBlockedActions.includes(currDbId)
            let blockedAction
            if (hasBlockedAction) {
              const record = await getRecord(currDbId)
              const remoteRecord = state.allRemoteObs.find(
                e => e.uuid === currDbId,
              )
              if (!remoteRecord) {
                // this is weird because the reason we're processing this
                // record is *because* we saw it in the list of remote records
                throw new Error(
                  `Unable to find remote record with UUID='${currDbId}', ` +
                    'cannot continue.',
                )
              }
              record.inatId = remoteRecord.inatId
              blockedAction = {
                ...record,
                wowMeta: {
                  ...record.wowMeta[constants.blockedActionFieldName].wowMeta,
                  [constants.recordProcessingOutcomeFieldName]:
                    constants.waitingOutcome,
                },
              }
            }
            await deleteDbRecordById(currDbId)
            if (hasBlockedAction) {
              await storeRecord(blockedAction)
            }
          })(),
        ),
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
  async getMySpecies({ commit, dispatch, rootGetters }) {
    const myUserId = rootGetters.myUserId
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
      return false
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
          'Request to get project info was successful, but ' +
            `contained no result, cannot continue, projectInfo='${projectInfo}'`,
        )
      }
      commit('setProjectInfo', projectInfo)
      return state.projectInfo
    } catch (err) {
      throw chainedError('Failed to get project info', err)
    }
  },
  async doSpeciesAutocomplete(_, partialText, speciesListType) {
    if (!partialText) {
      return []
    }
    if (speciesListType === constants.autocompleteTypeHost) {
      // FIXME need to build and bundle host tree species list
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
  async upsertQueuedAction(
    _,
    { record, photoIdsToDelete = [], newPhotos = [], obsFieldIdsToDelete = [] },
  ) {
    const mergedRecord = {
      ...record,
      wowMeta: {
        ...record.wowMeta,
        // we're writing to the record, it *will* be waiting to be processed when we're done!
        [constants.recordProcessingOutcomeFieldName]: constants.waitingOutcome,
        [constants.photoIdsToDeleteFieldName]: (
          record.wowMeta[constants.photoIdsToDeleteFieldName] || []
        ).concat(photoIdsToDelete),
        [constants.photosToAddFieldName]: (
          record.wowMeta[constants.photosToAddFieldName] || []
        ).concat(newPhotos),
        [constants.obsFieldIdsToDeleteFieldName]: (
          record.wowMeta[constants.obsFieldIdsToDeleteFieldName] || []
        ).concat(obsFieldIdsToDelete),
      },
    }
    return storeRecord(mergedRecord)
  },
  async upsertBlockedAction(
    _,
    { record, photoIdsToDelete = [], newPhotos = [], obsFieldIdsToDelete = [] },
  ) {
    const key = record.uuid
    const existingStoreRecord = await getRecord(key)
    const existingWowMeta = existingStoreRecord.wowMeta
    const existingBlockedActionWowMeta =
      (existingStoreRecord.wowMeta[constants.blockedActionFieldName] || {})
        .wowMeta || {}
    const mergedPhotoIdsToDelete = (
      existingBlockedActionWowMeta[constants.photoIdsToDeleteFieldName] || []
    ).concat(photoIdsToDelete)
    const mergedPhotosToAdd = (
      existingBlockedActionWowMeta[constants.photosToAddFieldName] || []
    ).concat(newPhotos)
    const mergedObsFieldIdsToDelete = (
      existingBlockedActionWowMeta[constants.obsFieldIdsToDeleteFieldName] || []
    ).concat(obsFieldIdsToDelete)
    const mergedRecord = {
      ...record, // passed record is new source of truth
      wowMeta: {
        ...existingWowMeta, // don't touch wowMeta as it's being processed
        [constants.blockedActionFieldName]: {
          wowMeta: {
            ...existingBlockedActionWowMeta,
            ...record.wowMeta,
            [constants.recordTypeFieldName]:
              record.wowMeta[constants.recordTypeFieldName],
            [constants.photoIdsToDeleteFieldName]: mergedPhotoIdsToDelete,
            [constants.photosToAddFieldName]: mergedPhotosToAdd,
            [constants.obsFieldIdsToDeleteFieldName]: mergedObsFieldIdsToDelete,
          },
        },
      },
    }
    return storeRecord(mergedRecord)
  },
  async saveEditAndScheduleUpdate(
    { state, dispatch, getters },
    { record, photoIdsToDelete, obsFieldIdsToDelete },
  ) {
    const editedUuid = record.uuid
    if (!editedUuid) {
      throw new Error(
        'Edited record does not have UUID set, cannot continue ' +
          'as we do not know what we are editing',
      )
    }
    // TODO might need some sort of mutex/lock here (a Promise stored in
    // store/ephemeral that the local queue processor awaits before reading a
    // record from DB). The following race condition could happen:
    //  - store contains a local queued record
    //  - processor sets 'is processing' status on record
    //  - this save action sees the 'is processing' flag and opts to create a
    //      blocked action, but also updates the record in-place
    //  - processor snapshots the record from the DB and processes it
    //  - processing finishes, blocked action is triggered
    // The issue is that some of the blocked action was already processed (the
    // record but not the xIdsToDelete). Processing the blocked action now is
    // slightly redundant but shouldn't fail.
    try {
      // reduce chance of TOCTOU race condition by refreshing the queue right
      // before we use it
      await dispatch('refreshLocalRecordQueue')
      const existingLocalRecord = getters.localRecords.find(
        e => e.uuid === editedUuid,
      )
      const existingRemoteRecord = state.allRemoteObs.find(
        e => e.uuid === editedUuid,
      )
      const existingDbRecord = await (async () => {
        if (existingLocalRecord) {
          const result = await getRecord(editedUuid)
          if (!result) {
            const err = new Error(
              `Failed to find record with UUID=${editedUuid} in DB. We ` +
                `refreshed right before checking the queue summary, found a ` +
                `matching record='${JSON.stringify(
                  existingLocalRecord,
                )}' but then got nothing when we went to the DB. Cannot ` +
                `continue as we have no local record to update. Possibly ` +
                `another instance of this app cleaned the DB and the record ` +
                `is now on the remote but we can't guarantee that we have ` +
                `access to refresh the remote right now.`,
              // although maybe we can just read it from Vuex's persisted copy
              // to localStorage but that feels brittle.
            )
            err.name = 'NoDbRecordError'
            throw err
          }
          return result
        }
        return { inatId: existingRemoteRecord.inatId, uuid: editedUuid }
      })()
      if (!existingLocalRecord && !existingRemoteRecord) {
        throw new Error(
          'Data problem: Cannot find existing local or remote record,' +
            'cannot continue without at least one',
        )
      }
      const newPhotos = (await processPhotos(record.addedPhotos)) || []
      const photos = (() => {
        // existingLocalRecord is the UI version that has a blob URL for the
        // photos. We need the raw photo data itself so we go to the DB record
        // for photos.
        const existingRemotePhotos = (existingRemoteRecord || {}).photos || []
        const existingLocalPhotos = existingDbRecord.photos
        const photosWithDeletesApplied = [
          ...(existingLocalPhotos || existingRemotePhotos),
          ...newPhotos,
        ].filter(p => {
          const isPhotoDeleted = photoIdsToDelete.includes(p.id)
          return !isPhotoDeleted
        })
        return fixIds(photosWithDeletesApplied)
        function fixIds(thePhotos) {
          return thePhotos.map((e, $index) => {
            const isPhotoLocalOnly = e.id < 0
            e.id = isPhotoLocalOnly ? -1 * ($index + 1) : e.id
            return e
          })
        }
      })()
      const enhancedRecord = Object.assign(existingDbRecord, record, {
        photos,
        uuid: editedUuid,
        wowMeta: {
          [constants.recordTypeFieldName]: recordType('edit'),
          // warning: relies on the local device time being synchronised. If
          // the clock has drifted forward, our check for updates having
          // occurred on the remote won't work.
          wowUpdatedAt: new Date().toISOString(),
        },
      })
      delete enhancedRecord.addedPhotos
      try {
        const localQueueSummaryForEditTarget =
          state.localQueueSummary.find(e => e.uuid === enhancedRecord.uuid) ||
          {}
        const isProcessingQueuedNow = isObsStateProcessing(
          localQueueSummaryForEditTarget[
            constants.recordProcessingOutcomeFieldName
          ],
        )
        const isThisIdQueued = !!existingLocalRecord
        const isExistingBlockedAction =
          localQueueSummaryForEditTarget[constants.hasBlockedActionFieldName]
        const strategyKey =
          `${isProcessingQueuedNow ? '' : 'no'}processing.` +
          `${isThisIdQueued ? '' : 'no'}queued.` +
          `${isExistingBlockedAction ? '' : 'no'}existingblocked.` +
          `${existingRemoteRecord ? '' : 'no'}remote`
        console.debug(`[Edit] strategy key=${strategyKey}`)
        const strategy = (() => {
          // FIXME extract to its own function
          const upsertBlockedAction = 'upsertBlockedAction'
          const upsertQueuedAction = 'upsertQueuedAction'
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

              // edits of local-only records *need* to result in a 'new' typed
              // record so we process them with a POST. We can't PUT when
              // there's nothing to update. FIXME this side-effect is hacky
              enhancedRecord.wowMeta[
                constants.recordTypeFieldName
              ] = recordType('new')
              return upsertQueuedAction
            case 'noprocessing.noqueued.noexistingblocked.remote':
              // direct edit of remote
              return upsertQueuedAction

            default:
              // IMPOSSIBLE
              // case 'noprocessing.queued.existingblocked.remote':
              // case 'noprocessing.queued.existingblocked.noremote':
              //   // don't think things that are NOT processing can have a blocked
              //   // action, FIXME is this right?
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
                `Programmer error: impossible situation with strategyKey=${strategyKey}`,
              )
          }
        })()
        console.debug(`[Edit] dispatching action='${strategy}'`)
        await dispatch(strategy, {
          record: enhancedRecord,
          photoIdsToDelete: photoIdsToDelete.filter(id => {
            const photoIsRemote = id > 0
            return photoIsRemote
          }),
          newPhotos,
          obsFieldIdsToDelete,
        })
      } catch (err) {
        const loggingSafeRecord = Object.assign({}, enhancedRecord, {
          photos: (enhancedRecord.photos || []).map(p => ({
            ...p,
            file: '(removed for logging)',
          })),
        })
        throw chainedError(
          `Failed to write record to Db with ` +
            `UUID='${editedUuid}'.\n` +
            `record=${JSON.stringify(loggingSafeRecord)}`,
          err,
        )
      }
      await dispatch('onLocalRecordEvent')
      return wowIdOf(enhancedRecord)
    } catch (err) {
      throw chainedError(
        `Failed to save edited record with UUID='${editedUuid}'` +
          ` to local queue.`,
        err,
      )
    }
  },
  async saveNewAndScheduleUpload({ dispatch }, record) {
    try {
      const newRecordId = uuid()
      const nowDate = new Date()
      const newPhotos = await processPhotos(record.addedPhotos)
      const enhancedRecord = Object.assign(record, {
        captive_flag: false, // it's *wild* orchid watch
        geoprivacy: 'obscured',
        observedAt: nowDate,
        photos: newPhotos,
        wowMeta: {
          [constants.recordTypeFieldName]: recordType('new'),
          [constants.recordProcessingOutcomeFieldName]:
            constants.waitingOutcome,
          [constants.photosToAddFieldName]: newPhotos,
          [constants.photoIdsToDeleteFieldName]: [],
          [constants.obsFieldIdsToDeleteFieldName]: [],
        },
        uuid: newRecordId,
      })
      delete enhancedRecord.addedPhotos
      try {
        await storeRecord(enhancedRecord)
      } catch (err) {
        const loggingSafeRecord = Object.assign({}, enhancedRecord, {
          photos: (enhancedRecord.photos || []).map(p => ({
            ...p,
            file: '(removed for logging)',
          })),
          obsFieldValues: enhancedRecord.obsFieldValues.map(o => ({
            // ignore info available elsewhere. Long traces get truncated :(
            fieldId: o.fieldId,
            value: o.value,
          })),
        })
        throw chainedError(
          `Failed to write record to Db\n` +
            `record=${JSON.stringify(loggingSafeRecord)}`,
          err,
        )
      }
      await dispatch('onLocalRecordEvent')
      return newRecordId
    } catch (err) {
      throw chainedError(`Failed to save new record to local queue.`, err)
    }
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
    refreshLocalRecordQueueLock = worker().finally(() => {
      refreshLocalRecordQueueLock = null
      console.debug('[refreshLocalRecordQueue] finished')
    })
    return refreshLocalRecordQueueLock
    async function worker() {
      try {
        if (!mapStoreWorker) {
          mapStoreWorker = interceptableFns.buildWorker()
        }
        const localQueueSummary = await mapStoreWorker.doit()
        commit('setLocalQueueSummary', localQueueSummary)
        const uiVisibleLocalUuids = localQueueSummary
          .filter(e => !e[constants.isEventuallyDeletedFieldName])
          .map(e => e.uuid)
        const records = await resolveLocalRecordUuids(uiVisibleLocalUuids)
        commit('setUiVisibleLocalRecords', records)
        revokeOldObjectUrls()
      } catch (err) {
        throw chainedError('Failed to refresh localRecordQueue', err)
      }
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
    const processorPromise = worker().finally(() => {
      // we chain this as part of the returned promise so any caller awaiting
      // it won't be able to act until we've cleaned up as they're awaiting
      // this block
      console.debug(
        `${logPrefix} Worker done (could be error or success)` +
          `, killing stored promise`,
      )
      commit('ephemeral/setQueueProcessorPromise', null, { root: true })
    })
    commit('ephemeral/setQueueProcessorPromise', processorPromise, {
      root: true,
    })
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
      const waitingQueue = getters.waitingLocalQueueSummary
      const isRecordToProcess = waitingQueue.length
      if (!isRecordToProcess) {
        console.debug(`${logPrefix} No record to process, ending processing.`)
        return
      }
      const idToProcess = waitingQueue[0].uuid
      try {
        // the DB record may be further edited while we're processing but that
        // won't affect our snapshot here
        const dbRecordSnapshot = await getRecord(idToProcess)
        console.debug(
          `${logPrefix} Processing DB record with ID='${idToProcess}' starting`,
        )
        const strategy = isNoServiceWorkerAvailable
          ? 'processWaitingDbRecordNoSw'
          : 'processWaitingDbRecordWithSw'
        await dispatch(strategy, { dbRecord: dbRecordSnapshot })
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
        data: obsRecord,
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
  async _createPhoto({ dispatch }, { photoRecord, relatedObsId }) {
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
  async processWaitingDbRecordNoSw({ dispatch }, { dbRecord }) {
    await dispatch('transitionToWithLocalProcessorOutcome', wowIdOf(dbRecord))
    const apiRecords = mapObsFromOurDomainOntoApi(dbRecord)
    const strategies = {
      [recordType('new')]: async () => {
        const inatRecordId = await dispatch('_createObservation', {
          obsRecord: apiRecords.observationPostBody,
        })
        await processChildReqs(dbRecord, inatRecordId)
        return dispatch('_linkObsWithProject', { recordId: inatRecordId })
      },
      [recordType('edit')]: async () => {
        const inatRecordId = await dispatch('_editObservation', {
          obsRecord: apiRecords.observationPostBody,
          inatRecordId: dbRecord.inatId,
        })
        return processChildReqs(dbRecord, inatRecordId)
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
    // FIXME add a rollback() fn to each strategy and call it when we encounter
    // an error during the following processing. For 'new' we can just delete
    // the partial obs. For delete, we do nothing. For edit, we should really
    // track which requests have worked so we only replay the
    // failed/not-yet-processed ones, but most users will use the withSw
    // version of the processor and we get this smart retry for free.
    if (!strategy) {
      throw new Error(
        `Could not find a "process waiting DB" strategy for key='${key}', cannot continue`,
      )
    }
    await strategy()
    await dispatch('transitionToSuccessOutcome', dbRecord.uuid)
    await dispatch('refreshRemoteObsWithDelay')
    async function processChildReqs(dbRecordParam, inatRecordId) {
      await Promise.all(
        dbRecordParam.wowMeta[constants.photoIdsToDeleteFieldName].map(id => {
          return dispatch('_deletePhoto', id).then(() => {})
        }),
      )
      for (const curr of apiRecords.photoPostBodyPartials) {
        await dispatch('_createPhoto', {
          photoRecord: curr,
          relatedObsId: inatRecordId,
        })
      }
      for (const curr of apiRecords.obsFieldPostBodyPartials) {
        await dispatch('_createObsFieldValue', {
          obsFieldRecord: curr,
          relatedObsId: inatRecordId,
        })
      }
      for (const id of dbRecordParam.wowMeta[
        constants.obsFieldIdsToDeleteFieldName
      ]) {
        await dispatch('_deleteObsFieldValue', id)
      }
    }
  },
  async processWaitingDbRecordWithSw(
    { state, dispatch, rootState },
    { dbRecord },
  ) {
    const strategies = {
      [recordType('new')]: async () => {
        const payload = generatePayload(dbRecord)
        if (!(state.projectInfo || {}).id) {
          throw new Error(
            'No projectInfo stored, cannot link observation to project without ID',
          )
        }
        const projectId = state.projectInfo.id
        payload[constants.projectIdFieldName] = projectId
        const resp = await doBundleEndpointFetch(payload, 'POST')
        if (!resp.ok) {
          throw new Error(
            `POST to bundle endpoint worked at an HTTP level,` +
              ` but the status code indicates an error. Status=${resp.status}.` +
              ` Message=${await getBundleErrorMsg(resp)}`,
          )
        }
      },
      [recordType('edit')]: async () => {
        const payload = generatePayload(dbRecord)
        const resp = await doBundleEndpointFetch(payload, 'PUT')
        if (!resp.ok) {
          throw new Error(
            `PUT to bundle endpoint worked at an HTTP level,` +
              ` but the status code indicates an error. Status=${resp.status}` +
              ` Message=${await getBundleErrorMsg(resp)}`,
          )
        }
      },
      [recordType('delete')]: () => {
        return dispatch('_deleteObservation', {
          inatRecordId: dbRecord.inatId,
          recordUuid: dbRecord.uuid,
        })
      },
    }
    const key = dbRecord.wowMeta[constants.recordTypeFieldName]
    console.debug(`DB record with UUID='${dbRecord.uuid}' is type='${key}'`)
    const strategy = strategies[key]
    if (!strategy) {
      throw new Error(
        `Could not find a "process waiting DB" strategy for key='${key}', cannot continue`,
      )
    }
    await strategy()
    await dispatch('transitionToWithServiceWorkerOutcome', dbRecord.uuid)
    await dispatch('refreshLocalRecordQueue')
    await triggerSwObsQueue()
    function generatePayload(dbRecordParam) {
      const apiRecords = mapObsFromOurDomainOntoApi(dbRecordParam)
      const result = {}
      result[constants.obsFieldName] = apiRecords.observationPostBody
      result[constants.photoIdsToDeleteFieldName] =
        dbRecordParam.wowMeta[constants.photoIdsToDeleteFieldName]
      result[constants.photosFieldName] = apiRecords.photoPostBodyPartials.map(
        curr => {
          const photoType = `wow-${curr.type}`
          const base64Data = base64js.fromByteArray(
            new Uint8Array(curr.file.data),
          )
          return {
            mime: curr.file.mime,
            data: base64Data,
            wowType: photoType,
          }
        },
      )
      result[constants.obsFieldsFieldName] = apiRecords.obsFieldPostBodyPartials
      result[constants.obsFieldIdsToDeleteFieldName] =
        dbRecordParam.wowMeta[constants.obsFieldIdsToDeleteFieldName]
      return result
    }
    function doBundleEndpointFetch(payload, method) {
      return fetch(constants.serviceWorkerBundleMagicUrl, {
        method,
        headers: {
          Authorization: rootState.auth.apiToken,
        },
        body: JSON.stringify(payload),
        retries: 0,
      })
    }
  },
  async _linkObsWithProject({ state, dispatch }, { recordId }) {
    if (!state.projectInfo) {
      throw new Error(
        'No projectInfo stored, cannot link observation to project without ID',
      )
    }
    const projectId = state.projectInfo.id
    try {
      await dispatch(
        'doApiPost',
        {
          urlSuffix: '/project_observations',
          data: {
            project_id: projectId,
            observation_id: recordId,
          },
        },
        { root: true },
      )
    } catch (err) {
      throw new chainedError(
        `Failed to link observation ID='${recordId}' ` +
          `to project ID='${projectId}'`,
        err,
      )
    }
  },
  async deleteSelectedLocalRecord({ state, dispatch, commit }) {
    const selectedId = state.selectedObservationId
    try {
      const dbId = await dispatch('findDbIdForWowId', selectedId)
      await deleteDbRecordById(dbId)
      commit('setSelectedObservationId', null)
      return dispatch('refreshLocalRecordQueue')
    } catch (err) {
      throw new chainedError(
        `Failed to delete local edit for ID='${selectedId}'`,
        err,
      )
    }
  },
  async deleteSelectedRecord({ state, dispatch, commit }) {
    const wowId = state.selectedObservationId
    const localQueueSummaryForDeleteTarget =
      state.localQueueSummary.find(e => wowIdOf(e) === wowId) || {}
    const isProcessingQueuedNow = isObsStateProcessing(
      localQueueSummaryForDeleteTarget[
        constants.recordProcessingOutcomeFieldName
      ],
    )
    const existingRemoteRecord =
      state.allRemoteObs.find(e => wowIdOf(e) === wowId) || {}
    const record = {
      inatId: existingRemoteRecord.inatId,
      // if we don't have a remote record, the wowId will be a uuid
      uuid: existingRemoteRecord.uuid || wowId,
      wowMeta: {
        [constants.recordTypeFieldName]: recordType('delete'),
      },
    }
    const strategyKey =
      `${isProcessingQueuedNow ? '' : 'no'}processing.` +
      `${existingRemoteRecord.uuid ? '' : 'no'}remote`
    const strategyPromise = (() => {
      switch (strategyKey) {
        case 'noprocessing.noremote':
          console.debug(
            `Record with WOW ID='${wowId}' is local-only so deleting right now.`,
          )
          return dispatch('deleteSelectedLocalRecord', wowId)
        case 'noprocessing.remote':
          return dispatch('upsertQueuedAction', { record })
        case 'processing.noremote':
          return dispatch('upsertBlockedAction', { record })
        case 'processing.remote':
          return dispatch('upsertBlockedAction', { record })
        default:
          throw new Error(
            `Programmer problem: no strategy defined for key='${strategyKey}'`,
          )
      }
    })()
    await strategyPromise
    commit('setSelectedObservationId', null)
    return dispatch('onLocalRecordEvent')
  },
  async resetProcessingOutcomeForSelectedRecord({ state, dispatch }) {
    const selectedId = state.selectedObservationId
    await dispatch('transitionToWaitingOutcome', selectedId)
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
  async getCurrentOutcomeForWowId({ state }, wowId) {
    const found = state.localQueueSummary.find(
      e => e.inatId === wowId || e.uuid === wowId,
    )
    if (!found) {
      throw new Error(
        `Could not find record with wowId=${wowId} in ` +
          `localSummary=${JSON.stringify(state.localQueueSummary)}`,
      )
    }
    return found[constants.recordProcessingOutcomeFieldName]
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
      validFromOutcomes: [
        constants.withLocalProcessorOutcome,
        constants.withServiceWorkerOutcome,
        constants.systemErrorOutcome,
      ],
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
    const fromOutcome = await dispatch('getCurrentOutcomeForWowId', wowId)
    if (!validFromOutcomes.includes(fromOutcome)) {
      throw new Error(
        `Unhandled fromOutcome=${fromOutcome} when transitioning to ${targetOutcome}`,
      )
    }
    const dbId = await dispatch('findDbIdForWowId', wowId)
    await setRecordProcessingOutcome(dbId, targetOutcome)
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
}

const getters = {
  isDoingSync(state, getters, rootState) {
    return (
      state.isUpdatingRemoteObs || rootState.ephemeral.queueProcessorPromise
    )
  },
  observationDetail(state, getters) {
    const allObs = [...getters.remoteRecords, ...getters.localRecords]
    const found = allObs.find(e => wowIdOf(e) === state.selectedObservationId)
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
    // TODO refactor this nested loops stuff to be more efficient
    return state._uiVisibleLocalRecords.map(currLocal => {
      const existingValues =
        state.allRemoteObs.find(
          currRemote => currRemote.uuid === currLocal.uuid,
        ) || {}
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
    const selectedId = state.selectedObservationId
    return getters.localRecords
      .filter(e => {
        const hasRemote = !!e.inatId
        return (
          e.wowMeta[constants.recordTypeFieldName] === recordType('edit') &&
          hasRemote
        )
      })
      .some(e => wowIdOf(e) === selectedId)
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
    return (state.projectInfo || {}).project_observation_fields || []
  },
}

function isErrorOutcome(outcome) {
  return [constants.systemErrorOutcome].includes(outcome)
}

function resolveLocalRecordUuids(ids) {
  photoObjectUrlsNoLongerInUse = photoObjectUrlsInUse
  photoObjectUrlsInUse = []
  const promises = ids
    .map(async currId => {
      const currRecord = await getRecord(currId)
      if (!currRecord) {
        const msg =
          `Could not resolve ID=${currId} to a DB record.` +
          ' Assuming it was deleted while we were busy processing.'
        wowWarnHandler(msg)
        const nothingToDoFilterMeOut = null
        return nothingToDoFilterMeOut
      }
      const photos = (currRecord.photos || []).map(mapPhotoFromDbToUi)
      const result = {
        ...currRecord,
        photos,
      }
      commonApiToOurDomainObsMapping(result, currRecord)
      return result
    })
    .filter(e => !!e)
  return Promise.all(promises)
}

function mapPhotoFromDbToUi(p) {
  const isRemotePhoto = p[isRemotePhotoFieldName]
  if (isRemotePhoto) {
    return p
  }
  const objectUrl = mintObjectUrl(p.file)
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
    const result = (window.webkitURL || window.URL || {}).createObjectURL(blob)
    photoObjectUrlsInUse.push(result)
    return result
  } catch (err) {
    throw chainedError(
      // Don't get distracted, the MIME has no impact. If it fails, it's due to
      // something else, the MIME will just help you debug (hopefully)
      `Failed to mint object URL for blob with MIME='${blobAsArrayBuffer.mime}'`,
      err,
    )
  }
}

function revokeOldObjectUrls() {
  while (photoObjectUrlsNoLongerInUse.length) {
    const curr = photoObjectUrlsNoLongerInUse.shift()
    URL.revokeObjectURL(curr)
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}

export const apiTokenHooks = [
  async store => {
    await store.dispatch('obs/refreshRemoteObs')
    await store.dispatch('obs/getMySpecies')
    await store.dispatch('obs/getProjectInfo')
  },
]

export const networkHooks = [
  async store => {
    await store.dispatch('obs/processLocalQueue')
  },
]

export function isObsSystemError(record) {
  return (
    (record.wowMeta || {})[constants.recordProcessingOutcomeFieldName] ===
    constants.systemErrorOutcome
  )
}

function isObsStateProcessing(state) {
  const processingStates = [
    constants.withLocalProcessorOutcome,
    constants.withServiceWorkerOutcome,
  ]
  return processingStates.includes(state)
}

/**
 * Common in the sense that we use it both for items from the API *and* items
 * from our local DB
 */
function commonApiToOurDomainObsMapping(result, obsFromApi) {
  // FIXME there's more to do here to align our internal DB records to the
  // format that the API uses
  result.geolocationAccuracy = obsFromApi.positional_accuracy
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
  // not sure why we have .photos AND .observation_photos but the latter has
  // the IDs that we need to be working with
  const photos = (obsFromApi.observation_photos || []).map(p => {
    const result = {
      url: p.photo.url,
      uuid: p.uuid,
      id: p.id,
      licenseCode: p.photo.license_code,
      attribution: p.photo.attribution,
      [isRemotePhotoFieldName]: true,
    }
    verifyWowDomainPhoto(result)
    return result
  })
  result.updatedAt = obsFromApi.updated_at
  // we don't use observed_on_string because the iNat web UI uses non-standard
  // values like "2020/01/28 1:46 PM ACDT" for that field, and we can't parse
  // them. The time_observed_at field seems to be standardised, which is good
  // for us to read. We cannot write to time_observed_at though.
  result.observedAt = obsFromApi.time_observed_at
  result.photos = photos
  result.placeGuess = obsFromApi.place_guess
  result.speciesGuess = obsFromApi.species_guess
  result.notes = obsFromApi.description
  commonApiToOurDomainObsMapping(result, obsFromApi)
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
    // FIXME maybe pull the first point in the shape?
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

function mapObsFromOurDomainOntoApi(dbRecord) {
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
  const createObsTask = 1
  const result = {
    totalTaskCount: createObsTask,
  }
  const isRecordToUpload =
    dbRecord.wowMeta[constants.recordTypeFieldName] !== recordType('delete')
  if (!isRecordToUpload) {
    return {}
  }
  const recordIdObjFragment = (() => {
    const inatId = dbRecord.inatId
    if (inatId) {
      return { id: inatId }
    }
    return {}
  })()
  result.observationPostBody = {
    ignore_photos: true,
    observation: Object.keys(dbRecord).reduce(
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
      },
    ),
  }
  // we could store the fields to send in wowMeta like we do with photos, but
  // this approach works and is simple
  result.obsFieldPostBodyPartials = (dbRecord.obsFieldValues || []).map(e => ({
    observation_field_id: e.fieldId,
    value: e.value,
  }))
  result.totalTaskCount += result.obsFieldPostBodyPartials.length
  result.photoPostBodyPartials =
    dbRecord.wowMeta[constants.photosToAddFieldName] || []
  result.totalTaskCount += result.photoPostBodyPartials.length
  return result
}

async function processPhotos(photos) {
  return Promise.all(
    photos.map(async (curr, $index) => {
      const tempId = -1 * ($index + 1)
      const photoDataAsArrayBuffer = await blobToArrayBuffer(curr.file)
      const photo = {
        id: tempId,
        url: '(set at render time)',
        type: curr.type,
        file: {
          data: photoDataAsArrayBuffer,
          mime: curr.file.type,
        },
        // TODO read and use user's default settings for these:
        licenseCode: 'default',
        attribution: 'default',
      }
      verifyWowDomainPhoto(photo)
      return photo
    }),
  )
}

function isAnswer(val) {
  return !['undefined', 'null'].includes(typeof val)
}

export function migrate(store) {
  migrateRecentlyUsedTaxa(store)
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

async function getBundleErrorMsg(resp) {
  try {
    const body = await resp.json()
    return body.msg
  } catch (err) {
    const msg = 'Bundle resp was not JSON, could not extract message'
    console.debug(msg, err)
    return `(${msg})`
  }
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
      new Worker('./map-over-obs-store.worker.js', {
        type: 'module',
      }),
    )
  },
}

export const _testonly = {
  interceptableFns,
  mapObsFromApiIntoOurDomain,
  mapObsFromOurDomainOntoApi,
}
