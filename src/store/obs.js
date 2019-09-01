import { isNil } from 'lodash'
import * as uuid from 'uuid/v1'
import {
  apiUrlBase,
  inatProjectSlug,
  obsFieldPrefix,
  obsFieldSeparatorChar,
  recordProcessingOutcomeFieldName,
  targetTaxaNodeId,
} from '@/misc/constants'
import {
  buildStaleCheckerFn,
  buildUrlSuffix,
  chainedError,
  makeEnumValidator,
  now,
  verifyWowDomainPhoto,
} from '@/misc/helpers'
import db from '@/indexeddb/dexie-store'

const hasRemoteRecordFieldName = 'hasRemoteRecord'
const isRemotePhotoFieldName = 'isRemote'

const recordTypeFieldName = 'recordType'
const recordType = makeEnumValidator(['delete', 'edit', 'new'])

const recordProcessingOutcome = makeEnumValidator([
  'waiting', // waiting to be processed
  'success', // successfully processed
  'userError', // processed but encountered an error the user can fix
  'systemError', // processed but encountered an error the user CANNOT fix
])

let photoObjectUrlsInUse = []

const state = {
  lat: null,
  lng: null,
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
  // To both indicate that processing is happening and also ensure that only
  // one thread of processing happens at a time, we could move this outside of
  // Vuex (or just to the ephemeral namespace) and store a promise in it when
  // we start. Then if we can another call to start processing and we still
  // have a reference to a promise, just return that promise. We only trigger a
  // new thread of processing when we don't already have a promise reference.
  isProcessingLocalQueue: false,
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
  setSpeciesAutocompleteItems: (state, value) =>
    (state.speciesAutocompleteItems = value),
  setIsProcessingLocalQueue: (state, value) =>
    (state.isProcessingLocalQueue = value),
  addRecentlyUsedTaxa: (state, { type, value }) => {
    const isValueEmpty = (value || '').trim().length === 0
    if (isValueEmpty) {
      return
    }
    const stack = state.recentlyUsedTaxa[type] || []
    const existingIndex = stack.indexOf(value)
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
  async refreshRemoteObs({ commit, dispatch, rootGetters }) {
    commit('setIsUpdatingRemoteObs', true)
    const myUserId = rootGetters.myUserId
    // TODO look at only pulling "new" records to save on bandwidth
    const urlSuffix = `/observations?user_id=${myUserId}&project_id=${inatProjectSlug}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map(mapObsFromApiIntoOurDomain)
      commit('setAllRemoteObs', records)
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
    const uuidsOfRemoteRecords = state.allRemoteObs.map(e => e.uuid)
    const successfulLocalRecordDbIdsToDelete = getters.successfulLocalQueueSummary
      .filter(e => uuidsOfRemoteRecords.includes(e.uuid))
      .map(e => e.id)
    console.debug(
      `Deleting Db IDs that remote ` +
        `has echoed back=[${successfulLocalRecordDbIdsToDelete}]`,
    )
    const dbIdsOfDeletesWithErrorThatNoLongerExistOnRemote = state.localQueueSummary
      .filter(
        e =>
          getters.deletesWithErrorDbIds.includes(e.id) &&
          !uuidsOfRemoteRecords.includes(e.inatId),
      )
      .map(e => e.id)
    const dbIdsToDelete = [
      ...dbIdsOfDeletesWithErrorThatNoLongerExistOnRemote,
      ...successfulLocalRecordDbIdsToDelete,
    ]
    try {
      await Promise.all(dbIdsToDelete.map(e => deleteDbRecordById(e)))
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
    const urlSuffix = `/observations/species_counts?user_id=${myUserId}&project_id=${inatProjectSlug}`
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
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported')
      // FIXME notify user that we won't have accurate location
      // FIXME store flag in Vuex so the rest of the app knows we won't have accurate location
      return
    }
    navigator.geolocation.getCurrentPosition(
      loc => {
        commit('setLat', loc.coords.latitude)
        commit('setLng', loc.coords.longitude)
        commit('setLocAccuracy', loc.coords.accuracy)
        // TODO should we get altitude, altitudeAccuracy and heading values?
      },
      () => {
        console.warn('Location access is blocked')
        // FIXME notify user that we *need* geolocation
        // FIXME store flag in Vuex so the rest of the app knows we won't have accurate location
      },
    )
  },
  async waitForProjectInfo({ state, dispatch, rootState, getters }) {
    const alreadyCachedResult = state.projectInfo
    const isOffline = !rootState.ephemeral.networkOnLine
    if (alreadyCachedResult && (!getters.isProjectInfoStale || isOffline)) {
      console.debug('Returning cached project info')
      return
    }
    if (isOffline) {
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
    const url = apiUrlBase + '/projects/' + inatProjectSlug
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
        .filter(d => d.ancestor_ids.find(e => e === targetTaxaNodeId))
        .map(d => ({
          id: d.id,
          name: d.name,
          preferredCommonName: d.preferred_common_name,
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
  findDbIdForInatId({ state }, inatId) {
    const result = (
      state.localQueueSummary.find(e => e.inatId === inatId) || {}
    ).id
    if (!result) {
      throw new Error(
        `Could not resolve inatId='${inatId}' to a Db ID ` +
          `using localQueueSummary=${JSON.stringify(state.localQueueSummary)}`,
      )
    }
    return result
  },
  async deleteSelectedLocalEditOnly({ state, dispatch }) {
    const selectedInatId = state.selectedObservationId
    try {
      const dbId = await dispatch('findDbIdForInatId', selectedInatId)
      await db.obs.delete(dbId)
      await dispatch('refreshLocalRecordQueue')
    } catch (err) {
      throw new chainedError(
        `Failed to delete local edit for ID='${selectedInatId}'`,
        err,
      )
    }
  },
  async saveEditAndScheduleUpdate(
    { state, dispatch, getters },
    { record, photoIdsToDelete, existingRecordId, obsFieldIdsToDelete },
  ) {
    try {
      const existingLocalRecord = getters.localRecords.find(
        e => e.inatId === existingRecordId,
      )
      const existingDbRecord = await (() => {
        if (existingLocalRecord) {
          return db.obs.get(existingLocalRecord.id)
        }
        return { inatId: existingRecordId }
      })()
      const existingRemoteRecord = state.allRemoteObs.find(
        e => e.inatId === existingRecordId,
      )
      const photos = (() => {
        const newPhotos = compressPhotos(record.photos) || []
        const isEditingRemoteDirectly =
          !existingLocalRecord && existingRemoteRecord
        if (isEditingRemoteDirectly) {
          return [...newPhotos, ...(existingRemoteRecord.photos || [])]
        }
        // existingLocalRecord is the UI version that has a blob URL for the
        // photos. We need the raw photo data itself so we go to the DB record
        // for photos.
        const existingPhotos = existingDbRecord.photos || []
        return [...newPhotos, ...existingPhotos]
      })()
      const nowDate = new Date()
      const enhancedRecord = Object.assign(existingDbRecord, record, {
        photos,
        updated_at: nowDate,
        uuid: (existingLocalRecord || {}).uuid || existingRemoteRecord.uuid,
        wowMeta: {
          [recordTypeFieldName]: recordType('edit'),
          [recordProcessingOutcomeFieldName]: recordProcessingOutcome(
            'waiting',
          ),
          [hasRemoteRecordFieldName]: !!existingRemoteRecord,
          photoIdsToDelete: photoIdsToDelete,
          obsFieldIdsToDelete: obsFieldIdsToDelete,
        },
      })
      try {
        const isEditOfLocalOnlyRecord = !existingRemoteRecord
        if (isEditOfLocalOnlyRecord) {
          // edits of local-only records *need* to result in a 'new' typed
          // record so we process them with a POST. If we mark them as an
          // 'edit' then the PUT won't work
          enhancedRecord.wowMeta[recordTypeFieldName] = recordType('new')
        }
        await db.obs.put(enhancedRecord)
      } catch (err) {
        const loggingSafeRecord = Object.assign({}, enhancedRecord, {
          photos: enhancedRecord.photos.map(p => ({
            ...p,
            file: '(removed for logging)',
          })),
        })
        throw chainedError(
          `Failed to write record to Db with ` +
            `ID='${existingRecordId}'.\n` +
            `record=${JSON.stringify(loggingSafeRecord)}`,
          err,
        )
      }
      await dispatch('onLocalRecordEvent')
    } catch (err) {
      throw chainedError(
        `Failed to save edited record with ` +
          `ID='${existingRecordId}' to local queue.`,
        err,
      )
    }
  },
  async saveNewAndScheduleUpload({ dispatch, state }, record) {
    try {
      const nowDate = new Date()
      // TODO change to be our internal format
      //   - use camel case names
      //   - only assign values we care about
      //   - let the rest of the values be assigned on upload
      const enhancedRecord = Object.assign(record, {
        captive_flag: false, // it's *wild* orchid watch
        created_at: nowDate,
        latitude: state.lat,
        longitude: state.lng,
        geoprivacy: 'obscured',
        // FIXME uploaded records fail the "Date specified" check
        // are we sending the date in the correct format? ISO string or ms number
        observed_on: nowDate,
        positional_accuracy: state.locAccuracy,
        photos: compressPhotos(record.photos),
        time_observed_at: nowDate,
        updated_at: nowDate,
        wowMeta: {
          [recordTypeFieldName]: recordType('new'),
          [recordProcessingOutcomeFieldName]: recordProcessingOutcome(
            'waiting',
          ),
          [hasRemoteRecordFieldName]: false,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
        },
        uuid: uuid(),
        // FIXME get these from UI
        // place_guess: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA', // probably need to use a geocoding service for this
        // FIXME what do we do with these?
        // observed_on_string: '2019-07-17 3:42:32 PM GMT+09:30',
        // owners_identification_from_vision: false,
      })
      try {
        await db.obs.put(enhancedRecord)
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
    } catch (err) {
      throw chainedError(`Failed to save new record to local queue.`, err)
    }
  },
  async onLocalRecordEvent({ state, dispatch }) {
    // TODO do we need to call this refresh or can we rely on the processor to do it?
    await dispatch('refreshLocalRecordQueue')
    if (state.isProcessingLocalQueue) {
      return
    }
    // FIXME can we use Vuex.watch to trigger processLocalQueue when we have
    // something in the local queue?
    dispatch('processLocalQueue')
  },
  async refreshLocalRecordQueue({ commit }) {
    try {
      const localQueueSummary = await db.obs.toArray(records => {
        return records.map(r => ({
          id: r.id,
          inatId: r.inatId,
          [recordTypeFieldName]: r.wowMeta[recordTypeFieldName],
          [recordProcessingOutcomeFieldName]:
            r.wowMeta[recordProcessingOutcomeFieldName],
          uuid: r.uuid,
        }))
      })
      commit('setLocalQueueSummary', localQueueSummary)
      const uiVisibleLocalIds = localQueueSummary
        .filter(e => e[recordTypeFieldName] !== recordType('delete'))
        .map(e => e.id)
      const records = await resolveLocalRecordIds(uiVisibleLocalIds)
      commit('setUiVisibleLocalRecords', records)
    } catch (err) {
      throw chainedError('Failed to refresh localRecordQueue', err)
    }
  },
  /**
   * Process actions (new/edit/delete) in the local queue.
   * If there are records to process, we process one then call ourselves again.
   * Only when there are no records left to process do we set the 'currently
   * processing' status to false.
   */
  async processLocalQueue({ getters, commit, dispatch, rootGetters }) {
    const logPrefix = '[localQueue]'
    console.debug(`${logPrefix} Starting to process local queue`)
    // FIXME use Background Sync API with auto-retry
    //       Background sync might just be configuring workbox to retry our
    //       POSTs requests to the API
    // FIXME how do we handle dev or no service worker support?
    // FIXME how do we ensure we only have one "thread" of processing running?
    if (!rootGetters['canUploadNow']) {
      // FIXME with background sync, we need to create the HTTP request so do
      // we just go ahead anyway? Need to differentiate between being offline
      // and user setting upload policy to NEVER
      console.debug(`${logPrefix} Processing is disallowed, giving up.`)
      return
    }
    commit('setIsProcessingLocalQueue', true)
    await dispatch('refreshLocalRecordQueue')
    const waitingQueue = getters.waitingLocalQueueSummary
    const isRecordToProcess = waitingQueue.length
    if (!isRecordToProcess) {
      console.debug(`${logPrefix} No record to process, ending processing.`)
      commit('setIsProcessingLocalQueue', false)
      return
    }
    const idToProcess = waitingQueue[0].id
    try {
      const dbRecord = await db.obs.get(idToProcess)
      console.debug(
        `${logPrefix} Processing DB record with ID='${idToProcess}' starting`,
      )
      await dispatch('processWaitingDbRecord', dbRecord)
      await setRecordProcessingOutcome(idToProcess, 'success')
      console.debug(
        `${logPrefix} Processing DB record with ID='${idToProcess}' done`,
      )
      dispatch('refreshRemoteObs') // FIXME can we defer until the end and only do it once?
      await dispatch('refreshLocalRecordQueue')
    } catch (err) {
      // FIXME how do we compute this?
      const isUserError = false
      if (isUserError) {
        console.debug(
          `Failed to process Db record with ID='${idToProcess}' ` +
            `due to a user error. Notifying the user.`,
        )
        // FIXME send toast (or system notification?) to notify user that they
        // need to check obs list
        await setRecordProcessingOutcome(idToProcess, 'userError')
      } else {
        // TODO should we try the next one or short-circuit? For system error, maybe halt as it might affect others?
        // FIXME do we need to be atomic and rollback?
        await setRecordProcessingOutcome(idToProcess, 'systemError')
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
    }
    dispatch('processLocalQueue')
  },
  async _createObservation({ dispatch }, { obsRecord, dbRecordId }) {
    const obsResp = await dispatch(
      'doApiPost',
      { urlSuffix: '/observations', data: obsRecord },
      { root: true },
    )
    const newRecordId = obsResp.id
    const isUpdated = await db.obs.update(dbRecordId, {
      updated_at: obsResp.updated_at,
    })
    if (!isUpdated) {
      throw new Error(
        `Db update operation to set updatedAt for (Db) ID='${dbRecordId}' failed`,
      )
    }
    return newRecordId
  },
  async _editObservation(
    { dispatch },
    { obsRecord, dbRecordId, inatRecordId },
  ) {
    const obsResp = await dispatch(
      'doApiPut',
      {
        urlSuffix: `/observations/${inatRecordId}`,
        data: obsRecord,
      },
      { root: true },
    )
    const isUpdated = await db.obs.update(dbRecordId, {
      updated_at: obsResp.updated_at,
    })
    if (!isUpdated) {
      throw new Error(
        `Db update operation to set updatedAt for (Db) ID='${dbRecordId}' failed`,
      )
    }
    return inatRecordId
  },
  async _deleteObservation({ commit, dispatch }, { inatRecordId }) {
    await dispatch(
      'doApiDelete',
      { urlSuffix: `/observations/${inatRecordId}` },
      { root: true },
    )
    const allRemoteObsWithoutThisRecord = state.allRemoteObs.filter(
      e => e.inatId !== inatRecordId,
    )
    commit('setAllRemoteObs', allRemoteObsWithoutThisRecord)
  },
  async _createPhoto({ dispatch }, { photoRecord, relatedObsId }) {
    const resp = await dispatch(
      'doPhotoPost',
      {
        obsId: relatedObsId,
        ...photoRecord,
      },
      { root: true },
    )
    return resp.id
  },
  async _createObsFieldValue({ dispatch }, { obsFieldRecord, relatedObsId }) {
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
  async processWaitingDbRecord({ dispatch }, dbRecord) {
    const apiRecords = mapObsFromOurDomainOntoApi(dbRecord)
    let tasksLeftTodo = apiRecords.totalTaskCount // TODO probably should commit changes to store
    tasksLeftTodo += (dbRecord.wowMeta.photoIdsToDelete || []).length
    tasksLeftTodo += (dbRecord.wowMeta.obsFieldIdsToDelete || []).length
    const strategies = {
      [recordType('new')]: {
        async start() {
          const linkWithProjectTask = 1
          tasksLeftTodo += linkWithProjectTask
          const inatRecordId = await dispatch('_createObservation', {
            obsRecord: apiRecords.observationPostBody,
            dbRecordId: dbRecord.id,
          })
          return inatRecordId
        },
        async end() {
          await dispatch('_linkObsWithProject', { recordId: inatRecordId })
          tasksLeftTodo--
        },
      },
      [recordType('edit')]: {
        async start() {
          const inatRecordId = await dispatch('_editObservation', {
            obsRecord: apiRecords.observationPostBody,
            dbRecordId: dbRecord.id,
            inatRecordId: dbRecord.inatId,
          })
          return inatRecordId
        },
        async end() {},
      },
      [recordType('delete')]: {
        async start() {
          await dispatch('_deleteObservation', {
            inatRecordId: dbRecord.inatId,
          })
          const inatRecordId = null
          return inatRecordId // it won't be used anyway
        },
        async end() {
          // only delete after the photos have been successfully deleted
          return deleteDbRecordById(dbRecord.id)
        },
      },
    }
    const key = dbRecord.wowMeta[recordTypeFieldName]
    console.debug(`DB record with ID='${dbRecord.id}' is type='${key}'`)
    const strategy = strategies[key]
    if (!strategy) {
      throw new Error(
        `Could not find a "process waiting DB" strategy for key='${key}', cannot continue`,
      )
    }
    const inatRecordId = await strategy.start()
    tasksLeftTodo--
    await Promise.all(
      dbRecord.wowMeta.photoIdsToDelete.map(id => {
        return dispatch('_deletePhoto', id).then(() => {
          tasksLeftTodo--
        })
      }),
    )
    for (const curr of apiRecords.photoPostBodyPartials) {
      // TODO go parallel?
      // TODO can we also store "photo type", curr.type, on the server?
      await dispatch('_createPhoto', {
        photoRecord: curr,
        relatedObsId: inatRecordId,
      })
      tasksLeftTodo--
      // FIXME trap one photo failure so others can still try
    }
    await Promise.all(
      dbRecord.wowMeta.obsFieldIdsToDelete.map(id => {
        return dispatch('_deleteObsFieldValue', id).then(() => {
          tasksLeftTodo--
        })
      }),
    )
    // FIXME should we be doing PUTs for modified obsFieldValues?
    await Promise.all(
      apiRecords.obsFieldPostBodyPartials.map(curr => {
        return dispatch('_createObsFieldValue', {
          obsFieldRecord: curr,
          relatedObsId: inatRecordId,
        }).then(() => {
          tasksLeftTodo--
        })
      }),
      // FIXME trap one failure so others can still try
    )
    await strategy.end()
    console.log(`Tasks left ${tasksLeftTodo}`) // FIXME delete line when we use value
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
  async deleteSelectedRecord({ state, getters, dispatch, commit }) {
    // FIXME handle when in process of uploading, maybe queue delete operation?
    const recordInatId = state.selectedObservationId
    const existingRemoteRecord = state.allRemoteObs.find(
      e => e.inatId === recordInatId,
    )
    const isLocalOnlyRecord = !existingRemoteRecord
    if (isLocalOnlyRecord) {
      console.debug(
        `Record with iNat ID='${recordInatId}' is local-only so deleting right now.`,
      )
      const existingLocalRecord = getters.localRecords.find(
        e => e.inatId === recordInatId,
      )
      await deleteDbRecordById(existingLocalRecord.id)
      await dispatch('refreshLocalRecordQueue')
      return
    }
    const theyreCascadeDeletedByTheObs = []
    const record = {
      inatId: recordInatId,
      uuid: existingRemoteRecord.uuid,
      wowMeta: {
        [recordTypeFieldName]: recordType('delete'),
        [recordProcessingOutcomeFieldName]: recordProcessingOutcome('waiting'),
        [hasRemoteRecordFieldName]: !!existingRemoteRecord,
        photoIdsToDelete: theyreCascadeDeletedByTheObs,
        obsFieldIdsToDelete: [],
      },
    }
    await db.obs.put(record)
    commit('setSelectedObservationId', null)
    return dispatch('onLocalRecordEvent')
  },
  async resetProcessingOutcomeForSelectedRecord({ state, dispatch }) {
    const selectedInatId = state.selectedObservationId
    const dbId = await dispatch('findDbIdForInatId', selectedInatId)
    await setRecordProcessingOutcome(dbId, 'waiting')
    return dispatch('onLocalRecordEvent')
  },
  async retryFailedDeletes({ getters, dispatch }) {
    const idsToRetry = getters.deletesWithErrorDbIds
    await Promise.all(
      idsToRetry.map(e => setRecordProcessingOutcome(e, 'waiting')),
    )
    return dispatch('onLocalRecordEvent')
  },
}

async function deleteDbRecordById(id) {
  try {
    return db.obs.delete(id)
  } catch (err) {
    throw chainedError(`Failed to delete db record with ID='${id}'`, err)
  }
}

const getters = {
  observationDetail(state, getters) {
    const allObs = [...getters.remoteRecords, ...getters.localRecords]
    const found = allObs.find(e => e.inatId === state.selectedObservationId)
    return found
  },
  waitingForDeleteCount(state) {
    return state.localQueueSummary.filter(
      e =>
        e[recordTypeFieldName] === recordType('delete') &&
        !isErrorOutcome(e[recordProcessingOutcomeFieldName]),
    ).length
  },
  deletesWithErrorDbIds(state) {
    return state.localQueueSummary
      .filter(
        e =>
          e[recordTypeFieldName] === recordType('delete') &&
          isErrorOutcome(e[recordProcessingOutcomeFieldName]),
      )
      .map(e => e.id)
  },
  deletesWithErrorCount(state, getters) {
    return getters.deletesWithErrorDbIds.length
  },
  localRecords(state) {
    return state._uiVisibleLocalRecords.map(currLocal => {
      const existingValues =
        state.allRemoteObs.find(
          currRemote => currRemote.inatId === currLocal.inatId,
        ) || {}
      const dontModifyTheOtherObjects = {}
      return Object.assign(dontModifyTheOtherObjects, existingValues, currLocal)
    })
  },
  remoteRecords(state) {
    const localRecordIds = state.localQueueSummary.map(e => e.inatId)
    return state.allRemoteObs.filter(e => {
      const recordHasLocalActionPending = localRecordIds.includes(e.inatId)
      return !recordHasLocalActionPending
    })
  },
  isRemoteObsStale: buildStaleCheckerFn('allRemoteObsLastUpdated', 10),
  isMySpeciesStale: buildStaleCheckerFn('mySpeciesLastUpdated', 10),
  isProjectInfoStale: buildStaleCheckerFn('projectInfoLastUpdated', 10),
  isSelectedRecordEditOfRemote(state, getters) {
    const selectedId = state.selectedObservationId
    return getters.localRecords
      .filter(
        e =>
          e.wowMeta[recordTypeFieldName] === recordType('edit') &&
          e.wowMeta[hasRemoteRecordFieldName],
      )
      .map(e => e.inatId)
      .includes(selectedId)
  },
  waitingLocalQueueSummary(state) {
    return state.localQueueSummary.filter(
      e =>
        e[recordProcessingOutcomeFieldName] ===
        recordProcessingOutcome('waiting'),
    )
  },
  successfulLocalQueueSummary(state) {
    return state.localQueueSummary.filter(
      e =>
        e[recordProcessingOutcomeFieldName] ===
        recordProcessingOutcome('success'),
    )
  },
  obsFields(state) {
    const projectInfo = state.projectInfo
    if (!projectInfo) {
      return []
    }
    const result = projectInfo.project_observation_fields.map(fieldRel => {
      // we have the field definition *and* the relationship to the project
      const fieldDef = fieldRel.observation_field
      return {
        id: fieldDef.id,
        position: fieldRel.position,
        required: fieldRel.required,
        name: processObsFieldName(fieldDef.name),
        description: fieldDef.description,
        datatype: fieldDef.datatype,
        allowedValues: (fieldDef.allowed_values || '')
          .split(obsFieldSeparatorChar)
          .filter(x => !!x) // remove zero length strings
          .sort(),
      }
    })
    return result
  },
}

function isErrorOutcome(outcome) {
  return [
    recordProcessingOutcome('systemError'),
    recordProcessingOutcome('userError'),
  ].includes(outcome)
}

async function resolveLocalRecordIds(ids) {
  const rawRecords = await db.obs
    .where('id')
    .anyOf(ids)
    .toArray()
  // FIXME sometimes triggers a 404 because we revoke the in-use URLs
  // before we've set the new ones. Possible solution: set the new values,
  // then revoke the old. Doesn't affect users as-is though.
  revokeExistingObjectUrls()
  return rawRecords.map(e => {
    const photos = e.photos.map(mapPhotoFromDbToUi)
    const result = {
      ...e,
      lat: e.latitude,
      lng: e.longitude,
      photos,
    }
    commonApiToOurDomainObsMapping(result, e)
    if (!result.inatId) {
      // new records won't have it set, edit and delete will
      result.inatId = -1 * e.id
    }
    return result
  })
}

function mapPhotoFromDbToUi(p) {
  if (p[isRemotePhotoFieldName]) {
    return p
  }
  const objectUrl = mintObjectUrl(p.file)
  const result = {
    ...p,
    url: objectUrl,
  }
  return result
}

function mintObjectUrl(blob) {
  try {
    const result = URL.createObjectURL(blob)
    photoObjectUrlsInUse.push(result)
    return result
  } catch (err) {
    throw chainedError(
      `Failed to mint object URL for blob of type='${typeof blob}'`,
      err,
    )
  }
}

function revokeExistingObjectUrls() {
  for (const curr of photoObjectUrlsInUse) {
    URL.revokeObjectURL(curr)
  }
  photoObjectUrlsInUse = []
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}

export const apiTokenHooks = [
  store => {
    store.dispatch('obs/refreshRemoteObs')
    store.dispatch('obs/getMySpecies')
    store.dispatch('obs/getProjectInfo')
  },
]

export function isObsSystemError(record) {
  return (
    (record.wowMeta || {})[recordProcessingOutcomeFieldName] ===
    recordProcessingOutcome('systemError')
  )
}

function fetchSingleRecord(url) {
  return fetch(url)
    .then(function(resp) {
      if (!resp.ok) {
        console.error(`Made fetch() for url='${url}' but it was not ok`)
        return false
      }
      return resp.json()
    })
    .then(function(body) {
      // FIXME also check for total_results > 1
      if (!body.total_results) {
        return null
      }
      return body.results[0]
    })
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

function mapObsFromApiIntoOurDomain(obsFromApi) {
  const directMappingKeys = ['uuid', 'geojson', 'geoprivacy']
  const result = directMappingKeys.reduce((accum, currKey) => {
    const value = obsFromApi[currKey]
    if (!isNil(value)) {
      accum[currKey] = value
    }
    return accum
  }, {})
  result.inatId = obsFromApi.id
  // TODO what's the difference between .photos and .observation_photos?
  const photos = (obsFromApi.photos || []).map(p => {
    const result = {
      url: p.url,
      id: p.id,
      licenseCode: p.license_code,
      attribution: p.attribution,
      [isRemotePhotoFieldName]: true,
    }
    verifyWowDomainPhoto(result)
    return result
  })
  result.createdAt = new Date(obsFromApi.created_at)
  result.updatedAt = new Date(obsFromApi.updated_at)
  result.photos = photos
  result.placeGuess = obsFromApi.place_guess
  result.speciesGuess = obsFromApi.species_guess
  result.notes = obsFromApi.description
  commonApiToOurDomainObsMapping(result, obsFromApi)
  const { lat, lng } = mapGeojsonToLatLng(result.geojson)
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
  return (fieldName || '').replace(obsFieldPrefix, '')
}

function mapObsFromOurDomainOntoApi(dbRecord) {
  const ignoredKeys = [
    'id',
    'obsFieldValues',
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
    dbRecord.wowMeta[recordTypeFieldName] !== recordType('delete')
  if (isRecordToUpload) {
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
          species_guess: dbRecord.speciesGuess,
          created_at: dbRecord.createdAt,
        },
      ),
    }
  }
  result.obsFieldPostBodyPartials = (dbRecord.obsFieldValues || []).map(e => ({
    observation_field_id: e.fieldId,
    value: e.value,
  }))
  result.totalTaskCount += result.obsFieldPostBodyPartials.length
  result.photoPostBodyPartials = (dbRecord.photos || [])
    .filter(e => !e[isRemotePhotoFieldName])
    .map(e => ({
      photoBlob: e.file,
    }))
  result.totalTaskCount += result.photoPostBodyPartials.length
  return result
}

function setRecordProcessingOutcome(dbId, outcome) {
  return db.obs
    .where('id')
    .equals(dbId)
    .modify({
      [`wowMeta.${recordProcessingOutcomeFieldName}`]: recordProcessingOutcome(
        outcome,
      ),
    })
}

function compressPhotos(photos) {
  // FIXME implement compression here
  return photos
}

function isAnswer(val) {
  return !['undefined', 'null'].includes(typeof val)
}

export const _testonly = {
  mapObsFromApiIntoOurDomain,
}
