import { alwaysUpload } from '@/misc/constants'

const state = {
  appTitle: process.env.VUE_APP_TITLE,
  isFirstRun: true, // remember we restore state from localStorage, so this is default
  topTitle: 'Wild Orchid Watch',
  tsAndCsAccepted: false,
  whenToUpload: alwaysUpload,
}

const mutations = {
  setTopTitle: (state, value) => (state.topTitle = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
  setWhenToUpload: (state, value) => (state.whenToUpload = value),
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
