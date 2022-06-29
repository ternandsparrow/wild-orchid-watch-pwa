import { omitBy, isEqual, isNil, get } from 'lodash'
import {
  // FIXME ideally no store operations are called from this module. So remove
  //  all these imports and use the worker
  healthcheckStore,
  processObsFieldName,
  registerWarnHandler,
} from '@/indexeddb/obs-store-common'
import * as cc from '@/misc/constants'
import {
  buildStaleCheckerFn,
  ChainedError,
  fetchSingleRecord,
  namedError,
  now,
  recordTypeEnum as recordType,
  wowWarnMessage,
} from '@/misc/helpers'
import { getWebWorker } from '@/misc/web-worker-manager'

registerWarnHandler(wowWarnMessage)

const initialState = {
  allRemoteObs: [],
  allRemoteObsLastUpdated: 0,
  isUpdatingRemoteObs: false,
  mySpecies: [], // FIXME could probably be just in the component
  mySpeciesLastUpdated: 0,
  selectedObservationUuid: null,
  localQueueSummary: [],
  projectInfo: null, // FIXME only need id and user_ids, can we store the rest (like obs fields) in the DB?
  projectInfoLastUpdated: 0,
  recentlyUsedTaxa: {},
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
  setLocalQueueSummary: (state, value) => (state.localQueueSummary = value),
  handleLocalRecordTransition: (state, { recordUuid, targetOutcome }) => {
    const lqs = state.localQueueSummary
    const i = lqs.findIndex((e) => e.uuid === recordUuid)
    if (i < 0) {
      return
    }
    lqs[i].wowMeta[cc.recordProcessingOutcomeFieldName] = targetOutcome
  },
  handleObsCreateOrEditCompletion: (state, obsSummary) => {
    console.debug(
      `UI thread handling create/edit for uuid=${obsSummary.uuid} completion`,
    )
    const remoteObs = state.allRemoteObs
    const indexOfExisting = remoteObs.findIndex(
      (e) => e.uuid === obsSummary.uuid,
    )
    if (indexOfExisting >= 0) {
      remoteObs.splice(indexOfExisting, 1, obsSummary)
    } else {
      remoteObs.splice(0, 0, obsSummary)
    }
    removeElementWithUuid(state.localQueueSummary, obsSummary.uuid)
  },
  handleObsDeleteCompletion: (state, theUuid) => {
    console.debug(`UI thread handling DELETE ${theUuid} completion`)
    const indexRemote = state.allRemoteObs.findIndex((e) => e.uuid === theUuid)
    if (indexRemote >= 0) {
      state.allRemoteObs.splice(indexRemote, 1)
    }
    removeElementWithUuid(state.localQueueSummary, theUuid)
  },
  setRecentlyUsedTaxa: (state, value) => (state.recentlyUsedTaxa = value),
  addRecentlyUsedTaxa: (state, { type, value }) => {
    const isNothingSelected = !value
    if (isNothingSelected) {
      return
    }
    const stack = state.recentlyUsedTaxa[type] || []
    const existingIndex = stack.findIndex((e) => {
      // objects from the store don't keep nil-ish props
      const valueWithoutNilishProps = omitBy(value, isNil)
      return isEqual(e, valueWithoutNilishProps)
    })
    const isValueAlreadyInStack = existingIndex >= 0
    if (isValueAlreadyInStack) {
      stack.splice(existingIndex, 1)
    }
    stack.splice(0, 0, value)
    const maxItems = 20
    state.recentlyUsedTaxa[type] = stack.slice(0, maxItems)
  },
  setLastUsedResponses: (state, value) => (state.lastUsedResponses = value),
}

const actions = {
  async getFullObsDetail({ state, getters }) {
    const theUuid = state.selectedObservationUuid
    const detailedModeOnlyObsFieldIds = getters.nullSafeProjectObsFields.reduce(
      (accum, curr) => {
        // this doesn't handle conditional requiredness, but we tackle that elsewhere
        accum[curr.id] = curr.required
        return accum
      },
      {},
    )
    const worker = getWebWorker()
    const isLocalRecord = state.localQueueSummary.find(
      (e) => e.uuid === theUuid,
    )
    if (isLocalRecord) {
      const [obsDetail, photos] = await Promise.all([
        worker.getFullLocalObsDetail(theUuid, detailedModeOnlyObsFieldIds),
        worker.getPhotosForLocalObs(theUuid),
      ])
      obsDetail.photos = photos
      return obsDetail
    }
    const obsDetail = await worker.getFullRemoteObsDetail(
      theUuid,
      detailedModeOnlyObsFieldIds,
    )
    obsDetail.photos = obsDetail.photos.map((e, index) => ({
      ...e,
      id: e.id,
      uiKey: `photo-${index}`,
      url: e.url.replace('square', 'medium'),
    }))
    return obsDetail
  },
  async refreshRemoteObsWithDelay({ dispatch }) {
    const delayToLetServerPerformIndexingMs = cc.waitBeforeRefreshSeconds * 1000
    console.debug(
      `Sleeping for ${delayToLetServerPerformIndexingMs}ms before refreshing remote`,
    )
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, delayToLetServerPerformIndexingMs)
    })
    await dispatch('refreshRemoteObs')
  },
  async refreshRemoteObs({ commit, dispatch, rootGetters }) {
    commit('setIsUpdatingRemoteObs', true)
    try {
      const { myUserId } = rootGetters
      if (!myUserId) {
        console.debug(
          'No userID present, refusing to try to get my observations',
        )
        return
      }
      const apiToken = await dispatch('auth/getApiToken', null, { root: true })
      const allSummaries = await getWebWorker().getAllRemoteRecords(
        myUserId,
        apiToken,
      )
      commit('setAllRemoteObs', allSummaries)
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
  async getMySpecies({ commit, dispatch, rootGetters }) {
    // FIXME probably doesn't need to be in the store, handle in component
    const { myUserId } = rootGetters
    if (!myUserId) {
      console.debug('No userID present, refusing to try to get my species')
      return
    }
    const urlSuffix = `/observations/species_counts?user_id=${myUserId}&project_id=${cc.inatProjectSlug}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map((d) => {
        const { taxon } = d
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
    return function (obsFieldsToSort, targetField) {
      if (!targetField) {
        throw new Error('Required string param "targetField" is missing')
      }
      if (!obsFieldsToSort || obsFieldsToSort.constructor !== Array) {
        throw new Error('Required array param "obsFieldsToSort" is missing')
      }
      if (!obsFieldsToSort.every((f) => !!f[targetField])) {
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
  },
  async getProjectInfo({ state, commit }) {
    const url = `${cc.apiUrlBase}/projects/${cc.inatProjectSlug}`
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
      throw ChainedError('Failed to get project info', err)
    }
  },
  async doSpeciesAutocomplete(_, { partialText, speciesListType }) {
    if (!partialText) {
      return []
    }
    return getWebWorker().doSpeciesAutocomplete(partialText, speciesListType)
  },
  inatIdToUuid({ getters }, inatId) {
    const found = [...getters.localRecords, ...getters.remoteRecords].find(
      (e) => e.inatId === inatId,
    )
    if (found) {
      return found.uuid
    }
    return null
  },
  async saveEditAndScheduleUpdate(
    { dispatch },
    { record, photoIdsToDelete, obsFieldIdsToDelete, isDraft },
  ) {
    if (!record.uuid) {
      throw new Error(
        'Edited record does not have UUID set, cannot continue ' +
          'as we do not know what we are editing',
      )
    }
    const worker = getWebWorker()
    const apiToken = await dispatch('auth/getApiToken', null, { root: true })
    try {
      const wowId = await worker.saveEditAndScheduleUpdate({
        record,
        photoIdsToDelete,
        obsFieldIdsToDelete,
        isDraft,
        apiToken,
      })
      await dispatch('refreshLocalRecordQueue')
      return wowId
    } catch (err) {
      const msg = `Failed while saving edit observation for ${record.speciesGuess}`
      await dispatch(
        'flagGlobalError',
        { msg, userMsg: msg, err },
        { root: true },
      )
      dispatch('refreshLocalRecordQueue')
    }
  },
  async saveNewAndScheduleUpload({ dispatch, getters }, { record, isDraft }) {
    const worker = getWebWorker()
    const apiToken = await dispatch('auth/getApiToken', null, { root: true })
    const { projectId } = getters
    try {
      const newRecordId = await worker.saveNewAndScheduleUpload({
        record,
        isDraft,
        apiToken,
        projectId,
      })
      await dispatch('refreshLocalRecordQueue')
      return newRecordId
    } catch (err) {
      const msg = `Failed while saving new observation for ${record.speciesGuess}`
      await dispatch(
        'flagGlobalError',
        { msg, userMsg: msg, err },
        { root: true },
      )
      dispatch('refreshLocalRecordQueue')
    }
  },
  async deleteSelectedRecord({ state, commit, dispatch }) {
    const theUuid = state.selectedObservationUuid
    const worker = getWebWorker()
    const apiToken = await dispatch('auth/getApiToken', null, { root: true })
    await worker.deleteRecord(theUuid, apiToken)
    // worker will send event for UI to update record lists
    commit('setSelectedObservationUuid', null)
  },
  async refreshLocalRecordQueue({ commit }) {
    const startMs = Date.now()
    console.debug('[refreshLocalRecordQueue] starting')
    try {
      const localQueueSummary = await getWebWorker().getLocalQueueSummary()
      commit('setLocalQueueSummary', localQueueSummary)
    } catch (err) {
      throw ChainedError('Failed to refresh localRecordQueue', err)
    } finally {
      console.debug(`[refreshLocalRecordQueue] took ${Date.now() - startMs}ms`)
    }
  },
  cleanupPhotosForObs() {
    return getWebWorker().cleanupPhotosForObs()
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
      await getWebWorker().optimisticallyUpdateComments(obsId, commentResp)
      return commentResp.id
    } catch (err) {
      throw new ChainedError('Failed to create new comment', err)
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
      await getWebWorker().optimisticallyUpdateComments(obsId, commentResp)
      return commentResp.id
    } catch (err) {
      throw new ChainedError('Failed to create new comment', err)
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
      await getWebWorker().optimisticallyUpdateComments(obsId, {
        uuid: commentRecord.uuid,
      })
    } catch (err) {
      throw new ChainedError(
        `Failed to delete comment with ID=${commentId}, owned by obsId=${obsId}`,
        err,
      )
    }
  },
  async retryForSelectedRecord({ state, dispatch }) {
    const selectedUuid = state.selectedObservationUuid
    if (!selectedUuid) {
      throw namedError(
        'InvalidState',
        'Tried to reset the selected observation but no observation is selected',
      )
    }
    await dispatch('retryUpload', [selectedUuid])
  },
  async retryFailedDeletes({ dispatch }) {
    const idsToRetry = dispatch('getDbIdsWithErroredDeletes')
    return dispatch('retryUpload', idsToRetry)
  },
  async retryUpload({ getters, dispatch }, recordUuids) {
    const apiToken = await dispatch('auth/getApiToken', null, { root: true })
    const { projectId } = getters
    return getWebWorker().retryUpload(recordUuids, apiToken, projectId)
  },
  async cancelFailedDeletes({ dispatch }) {
    const idsToCancel = dispatch('getDbIdsWithErroredDeletes')
    await getWebWorker().cancelFailedDeletes(idsToCancel)
  },
  findObsInatIdForUuid({ state }, uuid) {
    const found = state.allRemoteObs.find((e) => e.uuid === uuid)
    if (!found) {
      const allUuids = (state.allRemoteObs || []).map((e) => e.uuid)
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
      throw ChainedError('Failed to init localForage instance', err)
    }
  },
  getFullSizePhotoUrl(_, photoUuid) {
    return getWebWorker().getFullSizePhotoUrl(photoUuid)
  },
  getDbIdsWithErroredDeletes({ state }) {
    return state.localQueueSummary
      .filter(
        (e) =>
          e.wowMeta[cc.recordTypeFieldName] === recordType('delete') &&
          isErrorOutcome(e.wowMeta[cc.recordProcessingOutcomeFieldName]),
      )
      .map((e) => e.uuid)
  },
  getWaitingForDeleteCount({ state }) {
    return state.localQueueSummary.filter(
      (e) =>
        e.wowMeta[cc.recordTypeFieldName] === recordType('delete') &&
        !isErrorOutcome(e.wowMeta[cc.recordProcessingOutcomeFieldName]),
    ).length
  },
}

const gettersObj = {
  // FIXME try to remove these as they're expensive to compute
  selectedObsSummary(state, getters) {
    const allObs = [...getters.remoteRecords, ...getters.localRecords]
    const found = allObs.find((e) => e.uuid === state.selectedObservationUuid)
    return found
  },
  localRecords(state) {
    return state.localQueueSummary.filter(
      (e) => !e.wowMeta[cc.isEventuallyDeletedFieldName],
    )
  },
  remoteRecords(state) {
    const localRecordIds = state.localQueueSummary.map((e) => e.uuid)
    return state.allRemoteObs.filter((e) => {
      const recordHasLocalActionPending = localRecordIds.includes(e.uuid)
      return !recordHasLocalActionPending
    })
  },
  isRemoteObsStale: buildStaleCheckerFn('allRemoteObsLastUpdated', 10),
  isMySpeciesStale: buildStaleCheckerFn('mySpeciesLastUpdated', 10),
  isProjectInfoStale: buildStaleCheckerFn('projectInfoLastUpdated', 10),
  isSelectedRecordEditOfRemote(state, getters) {
    return getters.localRecords
      .filter((e) => {
        const hasRemote = !!e.inatId
        return (
          e.wowMeta[cc.recordTypeFieldName] === recordType('update') &&
          hasRemote
        )
      })
      .some((e) => e.uuid === state.selectedObservationUuid)
  },
  obsFields(_, getters) {
    const projectObsFields = getters.nullSafeProjectObsFields
    if (!projectObsFields.length) {
      return []
    }
    const result = projectObsFields.map((fieldRel) => {
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
          .filter((x) => !!x), // remove zero length strings
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
  nullSafeProjectObsFields(state) {
    // there's a race condition where you can get to an obs detail page before
    // the project info has been cached. This stops an error and will
    // auto-magically update when the project info does arrive
    return get(state, 'projectInfo.project_observation_fields', [])
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
  getters: gettersObj,
}

export const apiTokenHooks = [
  async (store) => {
    // FIXME probably lazy-init most of this
    await store.dispatch('obs/refreshRemoteObs')
    await store.dispatch('obs/getMySpecies')
    await store.dispatch('obs/getProjectInfo')
    // we re-join the user every time they login. We really want them joined XD
    await store.dispatch('autoJoinInatProject')
  },
]

export function isObsSystemError(record) {
  return (
    get(record, `wowMeta.${cc.recordProcessingOutcomeFieldName}`) ===
    cc.systemErrorOutcome
  )
}

export async function migrate(store) {
  // FIXME remove old migration logic
  // await getWebWorker().performMigrations()
  await store.dispatch('obs/refreshLocalRecordQueue')
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

function removeElementWithUuid(collection, theUuid) {
  const index = collection.findIndex((e) => e.uuid === theUuid)
  if (index < 0) {
    return
  }
  collection.splice(index, 1)
}
