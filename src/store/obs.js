import { apiUrlBase } from '@/misc/constants'

const state = {
  selectedObservationId: null,
  mySpecies: [],
  myObs: [],
  tabIndex: 0,
}

const mutations = {
  setSelectedObservationId: (state, value) =>
    (state.selectedObservationId = value),
  setMySpecies: (state, value) => (state.mySpecies = value),
  setMyObs: (state, value) => (state.myObs = value),
  setTab: (state, value) => (state.tabIndex = value),
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
          return {
            id: d.id,
            obsPhotos: d.observation_photos,
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
}
const getters = {
  observationDetail: state => {
    const found = state.myObs.find(e => e.id === state.selectedObservationId)
    return found
  },
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
