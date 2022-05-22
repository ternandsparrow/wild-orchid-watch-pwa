import { alwaysUpload } from '@/misc/constants'

const state = {
  // remember we restore state from localStorage, so these are defaults
  isFirstRun: true,
  // FIXME rename to automatic/manual and implement using the flag
  whenToSync: alwaysUpload,
  isDetailedUserMode: false,
  addToHomeIosPromptLastDate: null,
  isEnableHighAccuracy: false,
}

const mutations = {
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setWhenToSync: (state, value) => (state.whenToSync = value),
  setIsDetailedUserMode: (state, value) => (state.isDetailedUserMode = value),
  setAddToHomeIosPromptLastDate: (state, value) =>
    (state.addToHomeIosPromptLastDate = value),
  setEnableHighAccuracy: (state, value) => (state.isEnableHighAccuracy = value),
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
