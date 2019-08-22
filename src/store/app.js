import { alwaysUpload, appTitle } from '@/misc/constants'

const state = {
  appTitle: appTitle,
  isFirstRun: true, // remember we restore state from localStorage, so this is default
  topTitle: 'Wild Orchid Watch',
  tsAndCsAccepted: false,
  whenToUpload: alwaysUpload,
  addToHomeIosPromptLastDate: null,
}

const mutations = {
  setTopTitle: (state, value) => (state.topTitle = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
  setWhenToUpload: (state, value) => (state.whenToUpload = value),
  setAddToHomeIosPromptLastDate: (state, value) =>
    (state.addToHomeIosPromptLastDate = value),
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
