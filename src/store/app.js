import { alwaysUpload } from '@/misc/constants'

const state = {
  // remember we restore state from localStorage, so these are defaults
  isFirstRun: true,
  // FIXME delete, things are always sent now. Unless we still support it with
  // a metaStore entry of tasks to process. Those be banked when not syncing so
  // processed on app start. Although it's not easy to reload in the app-mode.
  // Maybe add a window.reload button
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

export function callback(store) {
  // FIXME possibly don't need this
  store.watch(
    state => state.app.whenToSync,
    () => {
      console.debug('whenToSync value changed, triggering localQueueProcessing')
      store.dispatch('obs/processLocalQueue')
    },
  )
}
