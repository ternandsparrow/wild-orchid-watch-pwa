import { isNil } from 'lodash'
import * as constants from '@/misc/constants'

/**
 * A vuex module for anything that should NOT be saved to local storage.
 *
 * Put anything here that meets any of the following:
 *  - doesn't serialise well, like functions or references
 *  - shouldn't be saved between sessions, like "are we online" flag
 */

const state = {
  networkOnLine: true,
  refreshingApp: false,
  showAddToHomeScreenModalForApple: false,
  swReg: null, // current sw
  SWRegistrationForNewContent: null, // new, waiting sw
  isSplitterOpen: false,
  isForceShowLoginToast: false,
  isGlobalErrorState: false,
  globalErrorUserMsg: null,
  queueProcessorPromise: null,
  isWarnOnLeaveRoute: false,
  isHelpModalVisible: false,
  previewedPhoto: null,
}

const mutations = {
  setNetworkOnline: (state, value) => (state.networkOnLine = value),
  setSWRegistrationForNewContent: (state, value) =>
    (state.SWRegistrationForNewContent = value),
  setShowAddToHomeScreenModalForApple: (state, value) =>
    (state.showAddToHomeScreenModalForApple = value),
  setRefreshingApp: (state, value) => (state.refreshingApp = value),
  setQueueProcessorPromise: (state, value) =>
    (state.queueProcessorPromise = value),
  setServiceWorkerRegistration: (state, value) => (state.swReg = value),
  toggleSplitter(state, shouldOpen) {
    if (typeof shouldOpen === 'boolean') {
      state.isSplitterOpen = shouldOpen
    } else {
      state.isSplitterOpen = !state.isSplitterOpen
    }
  },
  setForceShowLoginToast: (state, value) =>
    (state.isForceShowLoginToast = value),
  flagGlobalError: (state, userMsg) => {
    state.isGlobalErrorState = true
    state.globalErrorUserMsg = userMsg
  },
  resetGlobalErrorState: state => {
    state.isGlobalErrorState = false
    state.globalErrorUserMsg = null
  },
  enableWarnOnLeaveRoute: state => (state.isWarnOnLeaveRoute = true),
  disableWarnOnLeaveRoute: state => (state.isWarnOnLeaveRoute = false),
  showHelpModal: state => (state.isHelpModalVisible = true),
  hideHelpModal: state => (state.isHelpModalVisible = false),
  previewPhoto: (state, previewedPhoto) =>
    (state.previewedPhoto = previewedPhoto),
  closePhotoPreview: state => (state.previewedPhoto = null),
}

const actions = {
  closeAddToHomeScreenModalForApple: async ({ commit }) => {
    commit('app/setAddToHomeIosPromptLastDate', Date.now(), { root: true })
    commit('setShowAddToHomeScreenModalForApple', false)
  },

  /**
   * Trigger service worker skipWating so the new service worker can take over.
   * This will also trigger a window refresh (see /src/misc/register-service-worker.js)
   */
  serviceWorkerSkipWaiting({ state, commit }) {
    if (isNil(state.SWRegistrationForNewContent)) {
      return
    }
    commit('setRefreshingApp', true)
    state.SWRegistrationForNewContent.waiting.postMessage(
      constants.skipWaitingMsg,
    )
  },

  async manualServiceWorkerUpdateCheck({ state }) {
    if (!state.swReg) {
      return false
    }
    try {
      await state.swReg.update()
    } catch (err) {
      // probably the server is down
      console.warn('Failed while trying to check for a new service worker', err)
    }
    return true
  },
}

const ACTIVE = 'active'

const getters = {
  newContentAvailable: state => !isNil(state.SWRegistrationForNewContent),
  swStatus: state => {
    const nullSafeSwReg = state.swReg || {}
    return [ACTIVE, 'installing', 'waiting'].reduce((accum, curr) => {
      accum[curr] = !!nullSafeSwReg[curr]
      return accum
    }, {})
  },
  isSwStatusActive: (state, getters) => getters.swStatus[ACTIVE],
  isLocalProcessorRunning: state => !!state.queueProcessorPromise,
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
