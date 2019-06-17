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
    commit('setMyMissions', records)
  },
  async getAvailableMissions({ commit }) {
    // FIXME remove and do it for real
    commit('setAvailableMissions', [])
    const records = []
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
