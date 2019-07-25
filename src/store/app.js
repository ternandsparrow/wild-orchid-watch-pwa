import { isNil } from 'lodash'

const state = {
  appTitle: process.env.VUE_APP_TITLE,
  networkOnLine: true,
  SWRegistrationForNewContent: null,
  showAddToHomeScreenModalForApple: false,
  refreshingApp: false,
  topTitle: 'Wild Orchid Watch',
  swReg: null,
  // remember that we restore state from localStorage, so this is the initial value
  isFirstRun: true,
  tsAndCsAccepted: false,
}

const mutations = {
  setNetworkOnline: (state, value) => (state.networkOnLine = value),
  setSWRegistrationForNewContent: (state, value) =>
    (state.SWRegistrationForNewContent = value),
  setShowAddToHomeScreenModalForApple: (state, value) =>
    (state.showAddToHomeScreenModalForApple = value),
  setRefreshingApp: (state, value) => (state.refreshingApp = value),
  setTopTitle: (state, value) => (state.topTitle = value),
  setServiceWorkerRegistration: (state, value) => (state.swReg = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
}

const actions = {
  closeAddToHomeScreenModalForApple: async ({ commit }) => {
    localStorage.setItem('addToHomeIosPromptLastDate', Date.now())
    commit('setShowAddToHomeScreenModalForApple', false)
  },

  /**
   * Trigger service worker skipWating so the new service worker can take over.
   * This will also trigger a window refresh (see /src/misc/register-service-worker.js)
   */
  serviceWorkerSkipWaiting({ state, commit }) {
    if (isNil(state.SWRegistrationForNewContent)) return

    commit('setRefreshingApp', true)
    state.SWRegistrationForNewContent.waiting.postMessage('skipWaiting')
  },

  manualServiceWorkerUpdateCheck({ state }) {
    if (!state.swReg) {
      return false
    }
    state.swReg.update()
    return true
  },
}
const getters = {
  newContentAvailable: state => !isNil(state.SWRegistrationForNewContent),
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
