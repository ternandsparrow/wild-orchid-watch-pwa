import {
  apiUrlBase,
  inatProjectSlug,
  obsFieldPrefix,
  obsFieldSeparatorChar,
} from '@/misc/constants'
import db from '@/indexeddb/dexie-store'

// IndexedDB doesn't allow indexing on booleans :(
const NO = 0
// const YES = 1

const state = {
  selectedObservationId: null,
  mySpecies: [],
  myObs: [],
  tabIndex: 0,
  waitingToUploadRecords: [],
  obsFields: [],
}

const mutations = {
  setSelectedObservationId: (state, value) =>
    (state.selectedObservationId = value),
  setMySpecies: (state, value) => (state.mySpecies = value),
  setMyObs: (state, value) => (state.myObs = value),
  setTab: (state, value) => (state.tabIndex = value),
  setWaitingToUploadRecords: (state, value) =>
    (state.waitingToUploadRecords = value),
  setObsFields: (state, value) => (state.obsFields = value),
}

const actions = {
  async getMyObs({ state, commit }) {
    if (state.myObs.length) {
      // FIXME make the service worker do the caching
      return
    }
    // FIXME remove and do it for real
    commit('setMyObs', [])
    const urlBase = apiUrlBase + 'observations/'
    const ids = [
      26911885,
      26911582,
      26907931,
      26792216,
      26854577,
      26832325,
      25977268,
    ]
    const promises = []
    for (const curr of ids) {
      promises.push(
        fetchSingleRecord(urlBase + curr).then(function(d) {
          if (!d) {
            return null
          }
          // TODO do we need any other photo details?
          const photos = (d.photos || []).map(e => e.url)
          return {
            id: d.id,
            photos,
            placeGuess: d.place_guess,
            speciesGuess: d.species_guess,
          }
        }),
      )
    }
    // FIXME shouldn't have to filter, do it a better way
    const records = (await Promise.all(promises)).filter(e => !!e)
    commit('setMyObs', records)
  },
  async getMySpecies({ state, commit }) {
    if (state.mySpecies.length) {
      // FIXME make the service worker do the caching
      return
    }
    // FIXME remove and do it for real
    commit('setMySpecies', [])
    const urlBase = apiUrlBase + 'taxa/'
    const iNatTaxaIds = [
      416798,
      323928,
      549968,
      548100,
      140424,
      148240,
      323438,
      202579,
    ]
    const promises = []
    for (const curr of iNatTaxaIds) {
      promises.push(
        fetchSingleRecord(urlBase + curr).then(function(d) {
          if (!d) {
            return null
          }
          return {
            id: d.id,
            observationCount: d.observations_count,
            defaultPhoto: d.default_photo,
            commonName: d.preferred_common_name || d.name,
            scientificName: d.name,
          }
        }),
      )
    }
    // FIXME shouldn't have to filter, do it a better way
    const records = (await Promise.all(promises)).filter(e => !!e)
    commit('setMySpecies', records)
  },
  async getObsFields({ commit }) {
    commit('setObsFields', [])
    const url = apiUrlBase + 'projects/' + inatProjectSlug
    const fields = await fetchSingleRecord(url).then(function(d) {
      if (!d) {
        return null
      }
      // TODO should we store the other project info too?
      // FIXME should we read project_observation_rules to get required fields?
      return d.project_observation_fields.map(e => {
        const f = e.observation_field
        return {
          id: e.id,
          position: e.position,
          required: e.required,
          name: (f.name || '').replace(obsFieldPrefix, ''),
          description: f.description,
          datatype: f.datatype,
          allowedValues: (f.allowed_values || '')
            .split(obsFieldSeparatorChar)
            .filter(x => !!x), // remove zero length strings
        }
      })
    })
    commit('setObsFields', fields)
  },
  async saveAndUploadIndividual({ dispatch }, record) {
    const enhancedRecord = Object.assign(record, {
      createdAt: new Date(),
      isUploaded: NO,
    })
    // FIXME compress photos
    await db.obsIndividual.put(enhancedRecord)
    dispatch('scheduleUpload')
    await dispatch('refreshWaitingToUpload')
  },
  async refreshWaitingToUpload({ commit }) {
    const individualIds = await db.obsIndividual
      .where('isUploaded')
      .equals(NO)
      .primaryKeys()
    // FIXME also check population and mapping
    const ids = [...individualIds]
    const records = await resolveWaitingToUploadIdsToRecords(ids)
    commit('setWaitingToUploadRecords', records)
  },
  async scheduleUpload() {
    // FIXME check if online
    //  if offline, work out how to retry in future
    // FIXME set isUploaded = YES for each uploaded record. BE SURE they're uploaded
  },
  async deleteSelectedRecord({ state, dispatch }) {
    const recordId = state.selectedObservationId
    await db.obsIndividual.delete(recordId)
    await dispatch('refreshWaitingToUpload')
  },
}

const getters = {
  observationDetail(state) {
    const allObs = [...state.myObs, ...state.waitingToUploadRecords]
    const found = allObs.find(e => e.id === state.selectedObservationId)
    return found
  },
}

async function resolveWaitingToUploadIdsToRecords(ids) {
  const indRecords = await db.obsIndividual
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
  // FIXME also check for population and mapping records
  return [...indRecords]
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}

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
