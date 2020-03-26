import { alwaysUpload, appTitle } from '@/misc/constants'

const state = {
  // remember we restore state from localStorage, so these are defaults
  appTitle: appTitle,
  isFirstRun: true,
  topTitle: 'Wild Orchid Watch',
  tsAndCsAccepted: false,
  whenToSync: alwaysUpload,
  isAdvancedUserMode: false,
  addToHomeIosPromptLastDate: null,
  isEnablePhotoCompression: false,
}

const mutations = {
  setTopTitle: (state, value) => (state.topTitle = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
  setWhenToSync: (state, value) => (state.whenToSync = value),
  setIsAdvancedUserMode: (state, value) => (state.isAdvancedUserMode = value),
  setAddToHomeIosPromptLastDate: (state, value) =>
    (state.addToHomeIosPromptLastDate = value),
  setEnablePhotoCompression: (state, value) =>
    (state.isEnablePhotoCompression = value),
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
  store.watch(
    state => state.app.whenToSync,
    () => {
      console.debug('whenToSync value changed, triggering localQueueProcessing')
      store.dispatch('obs/processLocalQueue')
    },
  )
}
