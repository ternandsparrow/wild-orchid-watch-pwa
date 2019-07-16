const state = {
  myMissions: [],
  availableMissions: [],
  tabIndex: 0,
}

const mutations = {
  setMyMissions: (state, value) => (state.myMissions = value),
  setAvailableMissions: (state, value) => (state.availableMissions = value),
  setTab: (state, value) => (state.tabIndex = value),
}

const actions = {
  async getMyMissions({ commit }) {
    // FIXME remove and do it for real
    commit('setMyMissions', [])
    const records = []
    records[0] = {
      id: 0,
      targetSpecies: 'A yellow one',
      targetObservationCount: 5,
      targetSearchPoint: '2123.123, 123132.31231',
      photoUrl:
        'https://static.inaturalist.org/photos/41817887/medium.jpeg?1560430573',
    }
    commit('setMyMissions', records)
  },
  async getAvailableMissions({ commit }) {
    // FIXME remove and do it for real
    commit('setAvailableMissions', [])
    const records = []
    records[0] = {
      id: 1,
      targetSpecies: 'A purple one',
      targetObservationCount: 5,
      targetSearchPoint: '2123.123, 123132.31231',
      photoUrl:
        'https://static.inaturalist.org/photos/41724201/medium.jpg?1560338158',
    }
    commit('setAvailableMissions', records)
  },
}
const getters = {}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
