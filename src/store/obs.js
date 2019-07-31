import { isNil } from 'lodash'
import {
  apiUrlBase,
  inatProjectSlug,
  obsFieldPrefix,
  obsFieldSeparatorChar,
} from '@/misc/constants'
import { now } from '@/misc/helpers'
import db from '@/indexeddb/dexie-store'

const NOT_UPLOADED = -1

const state = {
  lat: null,
  lng: null,
  locAccuracy: null,
  myObs: [],
  myObsLastUpdated: null,
  mySpecies: [],
  mySpeciesLastUpdated: null,
  obsFields: [],
  selectedObservationId: null,
  speciesAutocompleteItems: [],
  tabIndex: 0,
  waitingToUploadRecords: [],
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
  setTab: (state, value) => (state.tabIndex = value),
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
    commit('setMyObs', [])
    const myUserId = rootGetters.myUserId
    const urlSuffix = `/observations?user_id=${myUserId}`
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
    }
  },
  async getMySpecies({ commit, dispatch, rootGetters }) {
    commit('setMySpecies', [])
    const myUserId = rootGetters.myUserId
    const urlSuffix = `/observations/species_counts?user_id=${myUserId}`
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
  async getObsFields({ commit }) {
    commit('setObsFields', [])
    const url = apiUrlBase + '/projects/' + inatProjectSlug
    const fields = await fetchSingleRecord(url).then(function(d) {
      if (!d) {
        return null
      }
      // TODO should we store the other project info too?
      // FIXME should we read project_observation_rules to get required fields?
      return d.project_observation_fields.map(e => {
        const f = e.observation_field
        return {
          id: f.id,
          position: e.position,
          required: e.required,
          name: processObsFieldName(f.name),
          description: f.description,
          datatype: f.datatype,
          allowedValues: (f.allowed_values || '')
            .split(obsFieldSeparatorChar)
            .filter(x => !!x) // remove zero length strings
            .sort(),
        }
      })
    })
    commit('setObsFields', fields)
  },
  async doSpeciesAutocomplete({ commit, dispatch }, partialText) {
    if (!partialText) {
      commit('setSpeciesAutocompleteItems', [])
      return
    }
    const urlSuffix = `/taxa/autocomplete?q=${partialText}`
    try {
      const resp = await dispatch('doApiGet', { urlSuffix }, { root: true })
      const records = resp.results.map(d => ({
        id: d.id,
        name: d.name,
        preferrerCommonName: d.preferred_common_name,
      }))
      commit('setSpeciesAutocompleteItems', records)
    } catch (err) {
      dispatch(
        'flagGlobalError',
        {
          msg: `Failed to perform species autocomplete on text='${partialText}'`,
          err,
        },
        { root: true },
      )
      return false
    }
  },
  async saveAndUploadIndividual({ dispatch, state }, record) {
    const nowDate = new Date()
    const enhancedRecord = Object.assign(record, {
      captive_flag: false, // it's *wild* orchid watch
      createdAt: nowDate,
      latitude: state.lat,
      longitude: state.lng,
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
    // FIXME should store record in our domain format and then map to API
    // format on the way out
    await db.obs.put(enhancedRecord)
    dispatch('scheduleUpload')
    await dispatch('refreshWaitingToUpload')
  },
  _getWaitingToUploadIds() {
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
  async scheduleUpload({ dispatch }) {
    // FIXME use Background Sync API with auto-retry
    //       Background sync might just be configuring workbox to retry our
    //       POSTs requests to the API
    // FIXME remove the following workaround when we have background sync working
    const waitingToUploadIds = await dispatch('_getWaitingToUploadIds')
    for (const currId of waitingToUploadIds) {
      try {
        const dbRecord = await db.obs.get(currId)
        const ignoredKeys = ['id', 'photos', 'updatedAt']
        const apiRecord = {
          ignore_photos: true,
          observation: Object.keys(dbRecord).reduce((accum, currKey) => {
            const isNotIgnored = ignoredKeys.indexOf(currKey) < 0
            if (isNotIgnored) {
              accum[currKey] = dbRecord[currKey]
            }
            return accum
          }, {}),
        }
        const obsResp = await dispatch(
          'doApiPost',
          { urlSuffix: '/observations', data: apiRecord },
          { root: true },
        )
        const newRecordId = obsResp.id
        const isUpdated = await db.obs.update(currId, {
          updatedAt: obsResp.updatedAt,
          inatId: newRecordId,
          // FIXME should we update other (all) values?
        })
        if (!isUpdated) {
          throw new Error(
            `Dexie update operation to set updatedAt for (Dexie) ID='${currId}' failed`,
          )
        }
        for (const curr of dbRecord.photos) {
          const photoResp = await dispatch(
            'doPhotoPost',
            {
              obsId: newRecordId,
              photoBlob: curr, // FIXME is this right object?
            },
            { root: true },
          )
          // FIXME update DB with photoResp values
          // FIXME trap one photo failure so others can still try
          console.log(photoResp.id) // FIXME delete line when we use photoResp var
        }
        for (const currId of Object.keys(dbRecord.obsFieldValues)) {
          const obsFieldResp = await dispatch(
            'doApiPost',
            {
              urlSuffix: '/observation_field_values',
              data: {
                observation_id: newRecordId,
                observation_field_id: currId,
                // TODO do we need to filter out null value?
                value: dbRecord.obsFieldValues[currId],
              },
            },
            { root: true },
          )
          // FIXME update DB with obsFieldResp values
          // FIXME trap one failure so others can still try
          console.log(obsFieldResp.id) // FIXME delete line when we use photoResp var
          // FIXME once we know that all parts have uploaded correctly:
          //  - replace the Vuex/Dexie record with freshly pulled
          //    record that has been mapped
        }
      } catch (err) {
        dispatch(
          'flagGlobalError',
          { msg: 'Failed to upload an observation', err },
          { root: true },
        )
        // TODO should we let the loop try the next one or short-circuit?
        // FIXME add this item to the retry queue
      } finally {
        await dispatch('refreshWaitingToUpload')
        await dispatch('getMyObs')
      }
    }
  },
  async deleteSelectedRecord({ state, dispatch }) {
    const recordId = state.selectedObservationId
    await db.obs.delete(recordId)
    await dispatch('refreshWaitingToUpload')
  },
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
      return records.map(e => {
        return {
          id: e.id,
          // FIXME apparently we should call revokeObjectURL when we're done.
          // Maybe in the destroy() lifecycle hook of vue? Or, store a list
          // of all URLs we create in this store and we can just clear them
          // all as the first step in the next run.
          photos: e.photos.map(v => URL.createObjectURL(v)),
          placeGuess: '-34.96958,138.6305383', // FIXME just use coords?
          speciesGuess: 'Genusus Speciesus', // FIXME use user's answer
        }
      })
    })
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
        console.error('Made fetch() but it was not ok')
        return false
      }
      return resp.json()
    })
    .then(function(body) {
      // FIXME also check for total_results > 1
      if (!body.total_results) {
        return false
      }
      return body.results[0]
    })
    .catch(err => {
      console.error('Failed to make fetch() call', err)
      return false
    })
}

function mapObsFromApiIntoOurDomain(obsFromApi) {
  const directMappingKeys = ['createdAt', 'updatedAt', 'geojson']
  const result = directMappingKeys.reduce((accum, currKey) => {
    const value = obsFromApi[currKey]
    if (!isNil(value)) {
      accum[currKey] = value
    }
    return accum
  }, {})
  result.inatId = obsFromApi.id
  const photos = (obsFromApi.photos || []).map(p => p.url)
  result.photos = photos
  result.placeGuess = obsFromApi.place_guess
  result.speciesGuess = obsFromApi.species_guess
  const obsFieldValues = obsFromApi.ofvs.map(o => {
    return {
      id: o.id,
      fieldId: o.field_id,
      datatype: o.datatype,
      name: processObsFieldName(o.name),
      value: o.value,
    }
  })
  result.obsFieldValues = obsFieldValues
  result.notes = obsFromApi.description
  return result
}

function processObsFieldName(fieldName) {
  return (fieldName || '').replace(obsFieldPrefix, '')
}

export const _testonly = {
  mapObsFromApiIntoOurDomain,
}
