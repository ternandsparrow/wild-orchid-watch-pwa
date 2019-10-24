import _ from 'lodash'
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
  arrayBufferToBlob,
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
let photoObjectUrlsNoLongerInUse = []

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
  findDbIdForInatId({ state }, inatId) {
    const result = (
      state.localQueueSummary.find(e => e.inatId === inatId) || {}
    ).id
    if (result) {
      return result
    }
    // For a record that failed the first POST of the observation itself to
    // iNat, we won't have an iNat ID. The ID that is passed in will
    // therefore already be a Dexie ID but we're confirming.
    const possibleDexieId = inatId
    const record = db.obs.get(possibleDexieId)
    if (record) {
      return possibleDexieId
    }
    throw new Error(
      `Could not resolve inatId='${inatId}' to a Db ID ` +
        `using localQueueSummary=${JSON.stringify(state.localQueueSummary)}`,
    )
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
    { record, photoIdsToDelete, existingRecord, obsFieldIdsToDelete },
  ) {
    if (!existingRecord) {
      throw new Error(
        'No existing record is passed, cannot continue ' +
          'as we do not know what we are editing',
      )
    }
    const existingRecordId = existingRecord.id
    const existingRecordUuid = existingRecord.uuid
    try {
      const existingLocalRecord = getters.localRecords.find(
        e => e.uuid === existingRecordUuid,
      )
      const existingRemoteRecord = state.allRemoteObs.find(
        e => e.uuid === existingRecordUuid,
      )
      const existingDbRecord = await (() => {
        if (existingLocalRecord) {
          return db.obs.get(existingLocalRecord.id)
        }
        return { inatId: existingRemoteRecord.inatId }
      })()
      if (!existingLocalRecord && !existingRemoteRecord) {
        throw new Error(
          'Data problem: Cannot find existing local or remote record,' +
            'cannot continue without at least one',
        )
      }
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
      const enhancedRecord = Object.assign(existingDbRecord, record, {
        photos,
        uuid: (existingLocalRecord || existingRemoteRecord).uuid,
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
        `Failed to save edited record with ID='${existingRecordId}'` +
          ` and UUID='${existingRecordUuid}' to local queue.`,
        err,
      )
    }
  },
  async saveNewAndScheduleUpload({ dispatch, state }, record) {
    try {
      const nowDate = new Date()
      const enhancedRecord = Object.assign(record, {
        captive_flag: false, // it's *wild* orchid watch
        lat: state.lat,
        lng: state.lng,
        geoprivacy: 'obscured',
        observedAt: nowDate,
        positional_accuracy: state.locAccuracy,
        photos: compressPhotos(record.photos),
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
      const localQueueSummary = await mapOverDexieCollection(db.obs, r => ({
        id: r.id,
        inatId: r.inatId,
        [recordTypeFieldName]: r.wowMeta[recordTypeFieldName],
        [recordProcessingOutcomeFieldName]:
          r.wowMeta[recordProcessingOutcomeFieldName],
        uuid: r.uuid,
      }))
      commit('setLocalQueueSummary', localQueueSummary)
      const uiVisibleLocalIds = localQueueSummary
        .filter(e => e[recordTypeFieldName] !== recordType('delete'))
        .map(e => e.id)
      const records = await resolveLocalRecordIds(uiVisibleLocalIds)
      commit('setUiVisibleLocalRecords', records)
      revokeOldObjectUrls()
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
      worker().then(() => {
        // we chain this as part of the returned promise so any caller awaiting
        // it won't be able to act until we've cleaned up as they're awaiting
        // this then() block
        console.debug(`${logPrefix} Worker done, killing stored promise`)
        commit('ephemeral/setQueueProcessorPromise', null, { root: true })
      }),
      { root: true },
    )
    return rootState.ephemeral.queueProcessorPromise
    async function worker() {
      console.debug(`${logPrefix} Starting to process local queue`)
      // FIXME use Background Sync API with auto-retry
      //       Background sync might just be configuring workbox to retry our
      //       POSTs requests to the API
      // FIXME how do we handle dev or no service worker support?
      if (!rootGetters['canUploadNow']) {
        // FIXME with background sync, we need to create the HTTP request so do
        // we just go ahead anyway? Need to differentiate between being offline
        // and user setting upload policy to NEVER
        console.debug(`${logPrefix} Processing is disallowed, giving up.`)
        return
      }
      if (!rootState.ephemeral.networkOnLine) {
        // FIXME this is an interim fix until we get the workbox background
        // sync logic working. Remove this once we have that in place.  We also
        // have a hook for when we're back online that will trigger queue
        // processing again. That should probably be cleaned up too
        console.debug(
          `${logPrefix} No network available, refusing to generate ` +
            `HTTP requests that are destined to fail.`,
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
        await dispatch('refreshLocalRecordQueue')
        const antiRaceConditionDelayToLetServerIndexNewRecord = 1337
        await new Promise(resolve => {
          setTimeout(() => {
            dispatch('refreshRemoteObs').then(() => {
              resolve()
            })
          }, antiRaceConditionDelayToLetServerIndexNewRecord)
        })
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
          // TODO should we try the next one or short-circuit? For system
          // error, maybe halt as it might affect others?
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
  async _deleteObservation({ dispatch }, { inatRecordId }) {
    await dispatch(
      'doApiDelete',
      { urlSuffix: `/observations/${inatRecordId}` },
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
    const selectedInatId = Math.abs(state.selectedObservationId)
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
  isDoingSync(state, getters, rootState) {
    return (
      state.isUpdatingRemoteObs || rootState.ephemeral.queueProcessorPromise
    )
  },
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
          .filter(x => !!x), // remove zero length strings
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

/**
 * Map over a Dexie collection
 *
 * We can't just call Collection.toArray() because once the result is large
 * enough, we'll get "Maximum IPC message size exceeded" error. This is a
 * memory-friendly implementation.
 */
function mapOverDexieCollection(collection, mapperFn) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = []
      await collection.each(r => {
        result.push(mapperFn(r))
      })
      return resolve(result)
    } catch (err) {
      return reject(err)
    }
  })
}

function resolveLocalRecordIds(ids) {
  photoObjectUrlsNoLongerInUse = photoObjectUrlsInUse
  photoObjectUrlsInUse = []
  return mapOverDexieCollection(db.obs.where('id').anyOf(ids), e => {
    const photos = e.photos.map(mapPhotoFromDbToUi)
    const result = {
      ...e,
      photos,
    }
    commonApiToOurDomainObsMapping(result, e)
    // new records won't have inatId set, edit and delete will
    const isNewRecord = !result.inatId
    if (isNewRecord) {
      result.inatId = -1 * e.id
    }
    return result
  })
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
      `Failed to mint object URL for blob with MIME='${
        blobAsArrayBuffer.mime
      }'`,
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
  result.updatedAt = obsFromApi.updated_at
  result.observedAt = obsFromApi.observed_on_string
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
  return (fieldName || '').replace(obsFieldPrefix, '')
}

function mapObsFromOurDomainOntoApi(dbRecord) {
  const ignoredKeys = [
    'id',
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
          latitude: dbRecord.lat,
          longitude: dbRecord.lng,
          observed_on_string: dbRecord.observedAt,
          species_guess: dbRecord.speciesGuess,
        },
      ),
    }
  }
  result.obsFieldPostBodyPartials = (dbRecord.obsFieldValues || []).map(e => ({
    observation_field_id: e.fieldId,
    value: e.value,
  }))
  result.totalTaskCount += result.obsFieldPostBodyPartials.length
  result.photoPostBodyPartials = (dbRecord.photos || []).filter(
    e => !e[isRemotePhotoFieldName],
  )
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

export const _testonly = {
  mapObsFromApiIntoOurDomain,
}
