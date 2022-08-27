export default {
  namespaced: true,
  state: {
    // remember we restore state from localStorage, so these are defaults
    isFirstRun: true,
    isDetailedUserMode: false,
    addToHomeIosPromptLastDate: null,
    isEnableHighAccuracy: false,
  },
  mutations: {
    setIsFirstRun: (state, value) => (state.isFirstRun = value),
    setIsDetailedUserMode: (state, value) => (state.isDetailedUserMode = value),
    setAddToHomeIosPromptLastDate: (state, value) =>
      (state.addToHomeIosPromptLastDate = value),
    setEnableHighAccuracy: (state, value) =>
      (state.isEnableHighAccuracy = value),
  },
  actions: {},
  getters: {},
}
