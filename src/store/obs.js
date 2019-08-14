import { isNil } from 'lodash'
import {
  apiUrlBase,
  inatProjectSlug,
  obsFieldPrefix,
  obsFieldSeparatorChar,
} from '@/misc/constants'
import { now, chainedError, verifyWowDomainPhoto } from '@/misc/helpers'
import db from '@/indexeddb/dexie-store'

const NOT_UPLOADED = -1

let photoObjectUrlsInUse = []

const state = {
  lat: null,
  lng: null,
  locAccuracy: null,
  myObs: [],
  myObsLastUpdated: null,
  isUpdatingMyObs: false,
  mySpecies: [],
  mySpeciesLastUpdated: null,
  obsFields: [],
  selectedObservationId: null,
  speciesAutocompleteItems: [],
  tabIndex: 0,
  waitingToUploadRecords: [],
  projectInfo: null,
  projectInfoLastUpdated: null,
}

const mutations = {
  setSelectedObservationId: (state, value) =>
    (state.selectedObservationId = value),
  setMySpecies: (state, value) => {
    state.mySpecies = value
    state.mySpeciesLastUpdated = now()
  },
  setMyObs: (state, value) => {
    state.myObs = value
    state.myObsLastUpdated = now()
  },
  setProjectInfo: (state, value) => {
    state.projectInfo = value
    state.projectInfoLastUpdated = now()
  },
  setTab: (state, value) => (state.tabIndex = value),
  setIsUpdatingMyObs: (state, value) => (state.isUpdatingMyObs = value),
  setWaitingToUploadRecords: (state, value) =>
    (state.waitingToUploadRecords = value),
  setLat: (state, value) => (state.lat = value),
  setLng: (state, value) => (state.lng = value),
  setObsFields: (state, value) => (state.obsFields = value),
  setLocAccuracy: (state, value) => (state.locAccuracy = value),
  setSpeciesAutocompleteItems: (state, value) =>
    (state.speciesAutocompleteItems = value),
}

const actions = {
  async getMyObs({ commit, dispatch, rootGetters }) {
    commit('setIsUpdatingMyObs', true)
    const myUserId = rootGetters.myUserId
    // TODO look at only pulling "new" records to save on bandwidth
    const urlSuffix = `/observations?user_id=${myUserId}&project_id=${inatProjectSlug}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map(mapObsFromApiIntoOurDomain)
      commit('setMyObs', records)
    } catch (err) {
      dispatch(
        'flagGlobalError',
        { msg: 'Failed to get my observations', err },
        { root: true },
      )
      return false
    } finally {
      commit('setIsUpdatingMyObs', false)
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
  async getProjectInfoUsingCache({ state, dispatch }) {
    // TODO add logic to periodically refresh this (once a day?)
    const alreadyCachedResult = state.projectInfo
    if (alreadyCachedResult) {
      return alreadyCachedResult
    }
    return dispatch('getProjectInfo')
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
  async getObsFields({ commit, dispatch }) {
    const projectInfo = await dispatch('getProjectInfoUsingCache')
    const fields = projectInfo.project_observation_fields.map(field => {
      // we have the field definition *and* the relationship to the project
      const obsField = field.observation_field
      return {
        id: obsField.id,
        position: field.position,
        required: field.required,
        name: processObsFieldName(obsField.name),
        description: obsField.description,
        datatype: obsField.datatype,
        allowedValues: (obsField.allowed_values || '')
          .split(obsFieldSeparatorChar)
          .filter(x => !!x) // remove zero length strings
          .sort(),
      }
    })
    commit('setObsFields', fields)
  },
  async doSpeciesAutocomplete({ dispatch }, partialText) {
    if (!partialText) {
      return []
    }
    const urlSuffix = `/taxa/autocomplete?q=${partialText}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map(d => ({
        id: d.id,
        name: d.name,
        preferrerCommonName: d.preferred_common_name,
      }))
      return records
    } catch (err) {
      throw chainedError(
        'Failed to do species autocomplete with text=' + partialText,
        err,
      )
    }
  },
  async saveEditAndScheduleUpdate(
    { dispatch },
    { record, photoIdsToDelete, existingRecordId },
  ) {
    // TODO Can we schedule this by
    //   - updating the DB now
    //   - keep a table of operations to perform that hold things like photoIdsToDelete
    // FIXME handle errors
    // FIXME not actually scheduling, we're doing it now
    await Promise.all(
      photoIdsToDelete.map(id => {
        return dispatch(
          'doApiDelete',
          {
            urlSuffix: `/observation_photos/${id}`,
          },
          { root: true },
        )
      }),
    )
    // FIXME de-dupe with stuff in save function
    // FIXME need to do merge
    //   - use our fields that can change
    //   - use fields from server that we need
    //   - set relevant fields: updated at
    const apiRecords = mapObsFromOurDomainOntoApi(record)
    await dispatch(
      'doApiPut',
      {
        urlSuffix: `/observations/${existingRecordId}`,
        data: apiRecords.observationPostBody,
      },
      { root: true },
    )
    // adding new photos
    for (const curr of apiRecords.photoPostBodyPartials) {
      // TODO go parallel
      // TODO can we also store "photo type", curr.type, on the server?
      await dispatch(
        'doPhotoPost',
        {
          obsId: existingRecordId,
          ...curr,
        },
        { root: true },
      )
      // FIXME trap one photo failure so others can still try
    }
    await Promise.all(
      apiRecords.obsFieldPostBodyPartials.map(curr => {
        return dispatch(
          'doApiPost',
          {
            urlSuffix: '/observation_field_values',
            data: {
              observation_id: existingRecordId,
              ...curr,
            },
          },
          { root: true },
        )
        // FIXME trap one failure so others can still try
      }),
    )
  },
  async saveNewAndScheduleUpload({ dispatch, state }, record) {
    const nowDate = new Date()
    // TODO change to be our internal format
    //   - use camel case names
    //   - only assign values we care about
    //   - let the rest of the values be assigned on upload
    const enhancedRecord = Object.assign(record, {
      captive_flag: false, // it's *wild* orchid watch
      createdAt: nowDate,
      latitude: state.lat,
      longitude: state.lng,
      geoprivacy: 'obscured',
      // FIXME uploaded records fail the "Date specified" check
      observed_on: nowDate,
      positional_accuracy: state.locAccuracy,
      time_observed_at: nowDate,
      updatedAt: NOT_UPLOADED,
      // FIXME get these from UI
      // place_guess: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
      // FIXME what do we do with these?
      // id_please: false,
      // identifications_count: 1,
      // observed_on_string: '2019-07-17 3:42:32 PM GMT+09:30',
      // out_of_range: false,
      // owners_identification_from_vision: false,
      // rank_level: 0,
      // site_id: '1',
      // uuid: '3ab8f7ab-ac5b-4e9b-af7f-15730b0d9b66',
    })
    // FIXME compress photos
    await db.obs.put(enhancedRecord)
    dispatch('scheduleUpload')
    await dispatch('refreshWaitingToUpload')
  },
  _getWaitingToUploadIds() {
    // FIXME how do we deal with edited records? Do we still show the old
    // version plus the new one as waiting? Probably not. How do we find edited
    // records? Do we set updatedAt back to NOT_UPLOADED, or use a separate
    // flag?
    return db.obs
      .where('updatedAt')
      .equals(NOT_UPLOADED)
      .primaryKeys()
  },
  async refreshWaitingToUpload({ commit, dispatch }) {
    const ids = await dispatch('_getWaitingToUploadIds')
    const records = await resolveWaitingToUploadIdsToRecords(ids)
    commit('setWaitingToUploadRecords', records)
  },
  async scheduleUpload({ dispatch, rootGetters }) {
    // FIXME use Background Sync API with auto-retry
    //       Background sync might just be configuring workbox to retry our
    //       POSTs requests to the API
    // FIXME how do we handle dev or no service worker support?
    // FIXME remove the following workaround when we have background sync working
    if (!rootGetters['canUploadNow']) {
      return
    }
    const waitingToUploadIds = await dispatch('_getWaitingToUploadIds')
    for (const currId of waitingToUploadIds) {
      try {
        const dbRecord = await db.obs.get(currId)
        const apiRecords = mapObsFromOurDomainOntoApi(dbRecord)
        const obsResp = await dispatch(
          'doApiPost',
          { urlSuffix: '/observations', data: apiRecords.observationPostBody },
          { root: true },
        )
        const newRecordId = obsResp.id
        const isUpdated = await db.obs.update(currId, {
          updatedAt: obsResp.updatedAt,
          inatId: newRecordId,
        })
        if (!isUpdated) {
          throw new Error(
            `Dexie update operation to set updatedAt for (Dexie) ID='${currId}' failed`,
          )
        }
        for (const curr of apiRecords.photoPostBodyPartials) {
          // TODO go parallel
          // TODO can we also store "photo type", curr.type, on the server?
          await dispatch(
            'doPhotoPost',
            {
              obsId: newRecordId,
              ...curr,
            },
            { root: true },
          )
          // FIXME trap one photo failure so others can still try
        }
        await Promise.all(
          apiRecords.obsFieldPostBodyPartials.map(curr => {
            return dispatch(
              'doApiPost',
              {
                urlSuffix: '/observation_field_values',
                data: {
                  observation_id: newRecordId,
                  ...curr,
                },
              },
              { root: true },
            )
            // FIXME trap one failure so others can still try
          }),
        )
        // FIXME only run for first save, don't need for edit
        // must be run AFTER obs fields have been uploaded
        await dispatch('_linkObsWithProject', { recordId: newRecordId })
        // TODO are we confident that everything has worked? Do we need to go
        // further like setting a UUID on this record then waiting until we see
        // it come back down when we request the latest obs, then delete? If we
        // do this, we need to set a flag on the DB record to hide it from UI
        await deleteDexieRecordById(dbRecord.id)
      } catch (err) {
        dispatch(
          'flagGlobalError',
          { msg: 'Failed to upload an observation', err },
          { root: true },
        )
        // TODO should we let the loop try the next one or short-circuit?
        // FIXME add this item to the retry queue
        // FIXME do we need to be atomic and rollback?
      } finally {
        await dispatch('refreshWaitingToUpload')
        // FIXME there is a race condition here where the server might not
        // include our new record in the response. Should we set a delay to
        // workaround it?
        await dispatch('getMyObs')
      }
    }
  },
  async _linkObsWithProject({ dispatch }, { recordId }) {
    const projectId = (await dispatch('getProjectInfoUsingCache')).id
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
  async deleteSelectedRecord({ state, dispatch, commit }) {
    const recordId = state.selectedObservationId
    if (isWaitingToUploadRecord(recordId)) {
      const dexieId = localObsIdToDexieId(recordId)
      await deleteDexieRecordById(dexieId)
      // FIXME handle when in process of uploading, maybe queue delete operation?
      await dispatch('refreshWaitingToUpload')
    } else {
      // FIXME handle when offline
      const { photos } = state.myObs.find(e => e.inatId === recordId)
      const myObsWithoutDeleted = state.myObs.filter(e => e.inatId !== recordId)
      commit('setMyObs', myObsWithoutDeleted)
      commit('setIsUpdatingMyObs', true)
      photos.forEach(async p => {
        await dispatch(
          'doApiDelete',
          { urlSuffix: `/observation_photos/${p.id}` },
          { root: true },
        )
      })
      await dispatch(
        'doApiDelete',
        { urlSuffix: `/observations/${recordId}` },
        { root: true },
      )
      await dispatch('getMyObs')
      dispatch('getMySpecies')
    }
    commit('setSelectedObservationId', null)
  },
}

async function deleteDexieRecordById(id) {
  try {
    return db.obs.delete(id)
  } catch (err) {
    throw chainedError(`Failed to delete dexie record with ID='${id}'`, err)
  }
}

const getters = {
  observationDetail(state) {
    const allObs = [...state.myObs, ...state.waitingToUploadRecords]
    const found = allObs.find(e => e.inatId === state.selectedObservationId)
    return found
  },
  isMyObsStale: buildStaleCheckerFn('myObsLastUpdated'),
  isMySpeciesStale: buildStaleCheckerFn('mySpeciesLastUpdated'),
}

function localObsIdToDexieId(id) {
  return Math.abs(id)
}

function isWaitingToUploadRecord(id) {
  return id < 0
}

function buildStaleCheckerFn(stateKey) {
  return function(state) {
    const lastUpdatedMs = state[stateKey]
    const staleThresholdMinutes = 10
    return (
      !lastUpdatedMs ||
      lastUpdatedMs < now() - staleThresholdMinutes * 60 * 1000
    )
  }
}

async function resolveWaitingToUploadIdsToRecords(ids) {
  return db.obs
    .where('id')
    .anyOf(ids)
    .toArray(records => {
      revokeExistingObjectUrls() // FIXME might be calling wrongly, getting a 404-ish
      return records.map(e => {
        const photos = e.photos.map(p => {
          const objectUrl = mintObjectUrl(p.file)
          const result = {
            ...p,
            url: objectUrl,
          }
          return result
        })
        return {
          ...e,
          inatId: -1 * e.id,
          photos,
        }
      })
    })
}

function mintObjectUrl(blob) {
  const result = URL.createObjectURL(blob)
  photoObjectUrlsInUse.push(result)
  return result
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
    store.dispatch('obs/getMyObs')
    store.dispatch('obs/getMySpecies')
  },
]

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

function mapObsFromApiIntoOurDomain(obsFromApi) {
  const directMappingKeys = ['createdAt', 'updatedAt', 'geojson', 'geoprivacy']
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
    }
    verifyWowDomainPhoto(result)
    return result
  })
  result.photos = photos
  result.placeGuess = obsFromApi.place_guess
  result.speciesGuess = obsFromApi.species_guess
  result.notes = obsFromApi.description
  result.geolocationAccuracy = obsFromApi.positional_accuracy
  const { lat, lng } = mapGeojsonToLatLng(result.geojson)
  result.lat = lat
  result.lng = lng
  const obsFieldValues = obsFromApi.ofvs.map(o => {
    return {
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
    'photos',
    'updatedAt',
    'obsFieldValues',
    'speciesGuess',
    'placeGuess',
    'createdAt',
  ]
  const result = {}
  result.observationPostBody = {
    ignore_photos: true,
    observation: Object.keys(dbRecord).reduce(
      (accum, currKey) => {
        const isNotIgnored = ignoredKeys.indexOf(currKey) < 0
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
  result.obsFieldPostBodyPartials = dbRecord.obsFieldValues.map(e => ({
    observation_field_id: e.fieldId,
    value: e.value,
  }))
  result.photoPostBodyPartials = dbRecord.photos.map(e => ({
    photoBlob: e.file,
  }))
  return result
}

function isAnswer(val) {
  return ['undefined', 'null'].indexOf(typeof val) < 0
}

export const _testonly = {
  mapObsFromApiIntoOurDomain,
}
