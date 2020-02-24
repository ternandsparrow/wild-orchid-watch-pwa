import _ from 'lodash'
import moment from 'moment'
import uuid from 'uuid/v1'
import { wrap as comlinkWrap } from 'comlink'
import dms2dec from 'dms2dec'
import {
  getRecord,
  storeRecord,
  deleteDbRecordById,
  mapOverObsStore,
  setRecordProcessingOutcome,
} from '@/indexeddb/obs-store-common'
import * as constants from '@/misc/constants'
import {
  arrayBufferToBlob,
  blobToArrayBuffer,
  buildStaleCheckerFn,
  buildUrlSuffix,
  chainedError,
  fetchSingleRecord,
  getExifFromBlob,
  isNoSwActive,
  makeEnumValidator,
  now,
  verifyWowDomainPhoto,
  wowWarnHandler,
  wowIdOf,
} from '@/misc/helpers'

const isRemotePhotoFieldName = 'isRemote'

const recordType = makeEnumValidator(['delete', 'edit', 'new'])

let photoObjectUrlsInUse = []
let photoObjectUrlsNoLongerInUse = []
let imageCompressionWorker = null

const state = {
  lat: null,
  lng: null,
  isGeolocationAccessible: true,
  locAccuracy: null,
  allRemoteObs: [],
  allRemoteObsLastUpdated: 0,
  isUpdatingRemoteObs: false,
  mySpecies: [],
  mySpeciesLastUpdated: 0,
  selectedObservationId: null,
  speciesAutocompleteItems: [],
  tabIndex: 0,
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
  setTab: (state, value) => (state.tabIndex = value),
  setIsUpdatingRemoteObs: (state, value) => (state.isUpdatingRemoteObs = value),
  setUiVisibleLocalRecords: (state, value) =>
    (state._uiVisibleLocalRecords = value),
  setLocalQueueSummary: (state, value) => (state.localQueueSummary = value),
  setLat: (state, value) => (state.lat = value),
  setLng: (state, value) => (state.lng = value),
  setLocAccuracy: (state, value) => (state.locAccuracy = value),
  setIsGeolocationAccessible: (state, value) =>
    (state.isGeolocationAccessible = value),
  setSpeciesAutocompleteItems: (state, value) =>
    (state.speciesAutocompleteItems = value),
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
    // TODO is there a better way than simply waiting for some period. We keep
    // it short-ish so it doesn't look like we're taking forever to process the
    // record. If we're still too fast, then the user will just have to wait
    // until the next refresh.
    const delayToLetServerPerformIndexingMs = 10 * 1000
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
          moment(currUpdatedDateOnRemote) >=
            moment(localUpdatedDates[e.uuid]).startOf('second')
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
  markUserGeolocation({ commit }) {
    commit('setIsGeolocationAccessible', true)
    if (!navigator.geolocation) {
      console.debug('Geolocation is not supported by user agent')
      commit('setIsGeolocationAccessible', false)
      return Promise.reject(constants.notSupported)
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        loc => {
          commit('setLat', loc.coords.latitude)
          commit('setLng', loc.coords.longitude)
          commit('setLocAccuracy', loc.coords.accuracy)
          return resolve()
        },
        err => {
          commit('setIsGeolocationAccessible', false)
          // enum from https://developer.mozilla.org/en-US/docs/Web/API/PositionError
          const permissionDenied = 1
          const positionUnavailable = 2
          const timeout = 3
          switch (err.code) {
            case permissionDenied:
              console.debug('Geolocation is blocked')
              return reject(constants.blocked)
            case positionUnavailable:
            case timeout:
              console.debug(
                'Geolocation is supported but not avaible or timed out',
              )
              return reject(constants.failed)
            default:
              return reject(err)
          }
        },
      )
    })
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
  async doSpeciesAutocomplete({ dispatch, getters }, partialText) {
    if (!partialText) {
      return []
    }
    const locale = getters.myLocale
    const placeId = getters.myPlaceId
    const urlSuffix = buildUrlSuffix('/taxa/autocomplete', {
      q: partialText,
      locale: locale,
      preferred_place_id: placeId,
    })
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results
        .filter(d => d.ancestor_ids.find(e => e === constants.targetTaxaNodeId))
        .map(d => ({
          name: d.name,
          preferredCommonName: d.preferred_common_name,
          photoUrl: (d.default_photo || {}).square_url,
        }))
      // FIXME we might want bigger pages or perform paging to get enough
      // results to fill the UI
      return records
    } catch (err) {
      throw chainedError(
        'Failed to do species autocomplete with text=' + partialText,
        err,
      )
    }
  },
  async findDbIdForWowId({ state }, wowId) {
    const result = (
      state.localQueueSummary.find(e => wowIdOf(e) === wowId) || {}
    ).uuid
    if (result) {
      return result
    }
    // For a record that hasn't yet been uploaded to iNat, we rely on the UUID
    // and use that as the DB ID. The ID that is passed in will therefore
    // already be a DB ID but we're confirming.
    const possibleDbId = wowId
    const record = await getRecord(possibleDbId)
    if (record) {
      return possibleDbId
    }
    throw new Error(
      `Could not resolve wowId='${wowId}' (typeof=${typeof wowId}) to a DB ID ` +
        `from localQueueSummary=${JSON.stringify(state.localQueueSummary)}`,
    )
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
      const existingLocalRecord = getters.localRecords.find(
        e => e.uuid === editedUuid,
      )
      const existingRemoteRecord = state.allRemoteObs.find(
        e => e.uuid === editedUuid,
      )
      const existingDbRecord = await (() => {
        if (existingLocalRecord) {
          return getRecord(editedUuid)
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
        const existingRemotePhotos = (existingRemoteRecord || []).photos || []
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
          photos: enhancedRecord.photos.map(p => ({
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
          photos: enhancedRecord.photos.map(p => ({
            ...p,
            file: '(removed for logging)',
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
    // TODO do we need to call this refresh or can we rely on the processor to
    // do it?
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
    try {
      // FIXME WOW-135 consider using a web worker for this task
      const localQueueSummary = await mapOverObsStore(r => {
        const hasBlockedAction = !!r.wowMeta[constants.blockedActionFieldName]
        const isEventuallyDeleted = hasBlockedAction
          ? r.wowMeta[constants.blockedActionFieldName].wowMeta[
              constants.recordTypeFieldName
            ] === recordType('delete')
          : r.wowMeta[constants.recordTypeFieldName] === recordType('delete')
        return {
          [constants.recordTypeFieldName]:
            r.wowMeta[constants.recordTypeFieldName],
          [constants.isEventuallyDeletedFieldName]: isEventuallyDeleted,
          [constants.recordProcessingOutcomeFieldName]:
            r.wowMeta[constants.recordProcessingOutcomeFieldName],
          [constants.hasBlockedActionFieldName]: hasBlockedAction,
          wowUpdatedAt: r.wowMeta.wowUpdatedAt,
          inatId: r.inatId,
          uuid: r.uuid,
        }
      })
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
  },
  // FIXME add ability to send messages to the SW so we can manually trigger a
  // refresh
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
          const isUserError = false // FIXME how do we compute this?
          if (isUserError) {
            console.debug(
              `Failed to process Db record with ID='${idToProcess}' ` +
                `due to a user error. Notifying the user.`,
            )
            // FIXME send toast (or system notification?) to notify user that they
            // need to check obs list
            await dispatch('transitionToUserErrorOutcome', idToProcess)
          } else {
            // TODO should we try the next one or short-circuit? For system
            // error, maybe halt as it might affect others?
            // FIXME do we need to be atomic and rollback?
            await dispatch('transitionToSystemErrorOutcome', idToProcess)
            dispatch(
              'flagGlobalError',
              {
                msg: `Failed to process Db record with ID='${idToProcess}'`,
                // FIXME use something more user friendly than the ID
                userMsg: `Error while trying upload record with ID='${idToProcess}'`,
                err,
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
              err2,
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
        const formData = generateFormData(dbRecord)
        if (!(state.projectInfo || {}).id) {
          throw new Error(
            'No projectInfo stored, cannot link observation to project without ID',
          )
        }
        const projectId = state.projectInfo.id
        formData.append(constants.projectIdFieldName, projectId)
        const resp = await doBundleEndpointFetch(formData, 'POST')
        if (!resp.ok) {
          throw new Error(
            `POST to bundle endpoint worked at an HTTP level,` +
              ` but the status code indicates an error. Status=${resp.status}.` +
              ` Message=${await getBundleErrorMsg(resp)}`,
          )
        }
      },
      [recordType('edit')]: async () => {
        const formData = generateFormData(dbRecord)
        const resp = await doBundleEndpointFetch(formData, 'PUT')
        if (!resp.ok) {
          throw new Error(
            `POST to bundle endpoint worked at an HTTP level,` +
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
    function generateFormData(dbRecordParam) {
      const apiRecords = mapObsFromOurDomainOntoApi(dbRecordParam)
      const fd = new FormData()
      fd.append(
        constants.obsFieldName,
        JSON.stringify(apiRecords.observationPostBody),
      )
      for (const curr of dbRecordParam.wowMeta[
        constants.photoIdsToDeleteFieldName
      ]) {
        fd.append(constants.photoIdsToDeleteFieldName, curr)
      }
      for (const curr of apiRecords.photoPostBodyPartials) {
        const photoBlob = arrayBufferToBlob(curr.file.data, curr.file.mime)
        // we create a File so we can encode the type of the photo in the
        // filename. Very sneaky ;)
        const photoType = `wow-${curr.type}`
        const photoFile = new File([photoBlob], photoType, {
          type: photoBlob.type,
        })
        fd.append(constants.photosFieldName, photoFile)
      }
      for (const curr of apiRecords.obsFieldPostBodyPartials) {
        fd.append(constants.obsFieldsFieldName, JSON.stringify(curr))
      }
      for (const curr of dbRecordParam.wowMeta[
        constants.obsFieldIdsToDeleteFieldName
      ]) {
        fd.append(constants.obsFieldIdsToDeleteFieldName, curr)
      }
      return fd
    }
    function doBundleEndpointFetch(fd, method) {
      return fetch(constants.serviceWorkerBundleMagicUrl, {
        method,
        headers: {
          Authorization: rootState.auth.apiToken,
        },
        body: fd,
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
    const dbId = await dispatch('findDbIdForWowId', selectedId)
    await dispatch('transitionToWaitingOutcome', dbId)
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
        constants.userErrorOutcome,
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
      ],
    })
  },
  async transitionToUserErrorOutcome({ dispatch }, wowId) {
    return dispatch('_transitionHelper', {
      wowId,
      targetOutcome: constants.userErrorOutcome,
      validFromOutcomes: [
        // TODO add supported cases when we start using this outcome
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
  async compressPhotoIfRequired({ rootState }, blobish) {
    let originalMetadata
    try {
      originalMetadata = await getExifFromBlob(blobish)
    } catch (err) {
      console.warn(
        'Could not read EXIF data, cannot process image, leaving as is',
        err,
      )
      // TODO enhancement idea: brute force image dimensions to do resizing
      return {
        data: blobish,
      }
    }
    const originalImageSizeMb = blobish.size / 1024 / 1024
    const { lat, lng } = extractGps(originalMetadata)
    if (!rootState.app.isEnablePhotoCompression) {
      console.debug('Photo compression disabled, using original photo')
      return withLocation(blobish)
    }
    const maxWidthOrHeight = constants.photoCompressionThresholdPixels
    const dimensionX = originalMetadata.PixelXDimension
    const dimensionY = originalMetadata.PixelYDimension
    const hasDimensionsInExif = dimensionX && dimensionY
    const isPhotoAlreadySmallEnoughDimensions =
      hasDimensionsInExif &&
      dimensionX < maxWidthOrHeight &&
      dimensionY < maxWidthOrHeight
    const isPhotoAlreadySmallEnoughStorage =
      originalImageSizeMb <= constants.photoCompressionThresholdMb
    if (
      isPhotoAlreadySmallEnoughDimensions ||
      isPhotoAlreadySmallEnoughStorage
    ) {
      // don't bother compressing an image that's already small enough
      const dimMsg = hasDimensionsInExif
        ? `X=${dimensionX}, Y=${dimensionY}`
        : '(No EXIF dimensions)'
      console.debug(
        `No compresion needed for ${dimMsg},` +
          ` ${originalImageSizeMb.toFixed(3)} MB image`,
      )
      return withLocation(blobish)
    }
    try {
      if (!imageCompressionWorker) {
        // FIXME can we get SW to cache the worker?
        imageCompressionWorker = comlinkWrap(
          new Worker('./image-compression.worker.js', {
            type: 'module',
          }),
        )
      }
      const compressedBlobish = await imageCompressionWorker.resize(
        blobish,
        maxWidthOrHeight,
      )
      return withLocation(compressedBlobish)
    } catch (err) {
      wowWarnHandler(
        `Failed to compress a photo with MIME=${blobish.type}, ` +
          `size=${blobish.size} and EXIF=${JSON.stringify(
            originalMetadata,
          )}. ` +
          'Falling back to original image.',
        err,
      )
      // fallback to using the fullsize image
      return withLocation(blobish)
    }
    function withLocation(data) {
      return {
        location: { lat, lng, isPresent: !!(lat && lng) },
        data,
      }
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
  obsFields(state) {
    const projectInfo = state.projectInfo
    if (!projectInfo) {
      return []
    }
    const result = projectInfo.project_observation_fields.map(fieldRel => {
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
}

function isErrorOutcome(outcome) {
  return [constants.systemErrorOutcome, constants.userErrorOutcome].includes(
    outcome,
  )
}

function resolveLocalRecordUuids(ids) {
  photoObjectUrlsNoLongerInUse = photoObjectUrlsInUse
  photoObjectUrlsInUse = []
  return Promise.all(
    ids.map(async currId => {
      const currRecord = await getRecord(currId)
      const photos = currRecord.photos.map(mapPhotoFromDbToUi)
      const result = {
        ...currRecord,
        photos,
      }
      commonApiToOurDomainObsMapping(result, currRecord)
      return result
    }),
  )
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
  const { lat, lng } = mapGeojsonToLatLng(obsFromApi.geojson)
  result.lat = lat
  result.lng = lng
  const obsFieldValues = obsFromApi.ofvs.map(o => {
    return {
      relationshipId: o.id,
      fieldId: o.field_id,
      datatype: o.datatype,
      name: processObsFieldName(o.name),
      value: o.value,
    }
  })
  result.obsFieldValues = obsFieldValues
  return result
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
  return (fieldName || '').replace(constants.obsFieldPrefix, '')
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

function extractGps(parsedExif) {
  const theArgs = [
    parsedExif.GPSLatitude,
    parsedExif.GPSLatitudeRef,
    parsedExif.GPSLongitude,
    parsedExif.GPSLongitudeRef,
  ]
  const isAllFieldsPresent = theArgs.every(e => !!e)
  if (!isAllFieldsPresent) {
    return {}
  }
  const [latDec, lonDec] = dms2dec(...theArgs)
  return { lat: latDec, lng: lonDec }
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

export const _testonly = {
  mapObsFromApiIntoOurDomain,
  mapObsFromOurDomainOntoApi,
}
