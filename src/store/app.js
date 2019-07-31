const state = {
  appTitle: process.env.VUE_APP_TITLE,
  isFirstRun: true, // remember we restore state from localStorage, so this is default
  topTitle: 'Wild Orchid Watch',
  tsAndCsAccepted: false,
}

const mutations = {
  setTopTitle: (state, value) => (state.topTitle = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
}

const actions = {}
const getters = {}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
