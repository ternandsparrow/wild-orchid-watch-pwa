import { isNil } from 'lodash'
import Observations from '@/pages/obs/index.vue'

const state = {
  appTitle: process.env.VUE_APP_TITLE,
  networkOnLine: true,
  SWRegistrationForNewContent: null,
  showAddToHomeScreenModalForApple: false,
  refreshingApp: false,
  topTitle: 'Wild Orchid Watch',
  innerPageStack: [Observations], // FIXME naming?
}

const mutations = {
  setNetworkOnline: (state, value) => (state.networkOnLine = value),
  setSWRegistrationForNewContent: (state, value) =>
    (state.SWRegistrationForNewContent = value),
  setShowAddToHomeScreenModalForApple: (state, value) =>
    (state.showAddToHomeScreenModalForApple = value),
  setRefreshingApp: (state, value) => (state.refreshingApp = value),
  setTopTitle: (state, value) => (state.topTitle = value),
  pushInnerPage: (state, value) => (state.innerPageStack = [value]),
}

const actions = {
  /**
   * Closes "add to home screen" modal for apple
   */
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
